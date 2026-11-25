"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

import { generateId } from "ai";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "~/trpc/react";
import type { RouterOutputs } from "../trpc";

type ChatUpdatesResponse = RouterOutputs["chat"]["updates"];
type ServerMessage = ChatUpdatesResponse["messages"][number];

export type ChatMessage = ServerMessage;

interface UpdateContext {
  previous: ChatUpdatesResponse | undefined;
  input: string;
  fullKey: ReturnType<
    ReturnType<typeof useTRPC>["chat"]["updates"]["queryKey"]
  >;
  clientMessageId: string;
}

export function useChat() {
  const qc = useQueryClient();
  const trpc = useTRPC();
  const [input, setInput] = useState("");

  const { data } = useSuspenseQuery(
    trpc.chat.updates.queryOptions(undefined, {
      staleTime: 0,
      gcTime: 30_000,
      retry: false,
      // 若为 demo 线程（或服务器降级到 demo-thread），关闭轮询，避免服务器空列表覆盖本地消息
      refetchInterval: (query) => {
        const d = query.state.data as ChatUpdatesResponse | undefined;
        if (d?.threadId === "demo-thread") return false;
        return 1000;
      },
      structuralSharing: true,
    })
  );

  const prevMessagesRef = useRef<ChatMessage[]>([]);

  const messages = useMemo<ChatMessage[]>(() => {
    if (!data?.messages) return prevMessagesRef.current;

    const serverRaw: ServerMessage[] = data.messages;

    // Server messages are already properly typed from tRPC
    const serverMsgs: ChatMessage[] = serverRaw;

    const isClientId = (id: unknown) => String(id).startsWith("client:");

    // Build set of server-confirmed runIds (non-optimistic messages only)
    const realRunIds = new Set(
      serverMsgs
        .filter((m) => m.runId && !isClientId(m.id))
        .map((m) => m.runId as string)
    );

    // Fallback: server "user" content keys (by thread + exact content)
    const serverUserKeys = new Set(
      serverMsgs
        .filter((m) => !isClientId(m.id) && m.role === "user")
        .map((m) => `${m.threadId ?? ""}::${m.content?.trim() ?? ""}`)
    );

    // Dedupe: remove optimistic copies when server copy exists with same runId or content
    const serverMsgsDeduped = serverMsgs.filter((m) => {
      if (!isClientId(m.id)) return true;
      if (m.runId && realRunIds.has(m.runId)) return false;
      if (
        m.role === "user" &&
        serverUserKeys.has(`${m.threadId ?? ""}::${m.content?.trim() ?? ""}`)
      )
        return false;
      return true;
    });

    // Find optimistic messages from previous state
    const prevOptimistic = prevMessagesRef.current.filter((m) =>
      isClientId(m.id)
    );

    // Build sets for filtering previous optimistic messages
    const currentIds = new Set(serverMsgsDeduped.map((m) => m.id));

    // Keep only prev optimistic messages that:
    // - are not already in current data (avoid re-adding)
    // - are not acknowledged by server (runId match with any message)
    // - do not duplicate a server user message with identical content
    const remainingOptimistic = prevOptimistic.filter((o) => {
      if (currentIds.has(o.id)) return false;
      if (o.runId && realRunIds.has(o.runId)) return false;
      if (
        o.role === "user" &&
        serverUserKeys.has(`${o.threadId ?? ""}::${o.content?.trim() ?? ""}`)
      )
        return false;
      return true;
    });

    // Merge and sort by timestamp
    const combined = [...serverMsgsDeduped, ...remainingOptimistic].sort(
      (a, b) => {
        const aMs = a.createdAt.getTime();
        const bMs = b.createdAt.getTime();
        if (aMs !== bMs) return aMs - bMs;
        return a.id.localeCompare(b.id);
      }
    );

    // Structural sharing: reuse message objects when unchanged
    const prevById = new Map(prevMessagesRef.current.map((m) => [m.id, m]));
    let mutated = prevMessagesRef.current.length !== combined.length;
    const next: ChatMessage[] = new Array(combined.length);

    for (let i = 0; i < combined.length; i++) {
      const m = combined[i];
      const prev = prevById.get(m.id);

      // Deep equality check for reuse
      const canReuse =
        prev &&
        prev.role === m.role &&
        prev.content === m.content &&
        prev.runId === m.runId &&
        prev.status === m.status &&
        prev.reactions.length === m.reactions.length;

      const item = canReuse ? prev : m;
      next[i] = item;

      if (
        !mutated &&
        (!prevMessagesRef.current[i] ||
          prevMessagesRef.current[i].id !== m.id ||
          item !== prevMessagesRef.current[i])
      ) {
        mutated = true;
      }
    }

    if (!mutated) {
      return prevMessagesRef.current;
    }

    prevMessagesRef.current = next;
    return next;
  }, [data]);

  const baseKey = trpc.chat.updates.queryKey();

  const sendMutation = useMutation(
    trpc.chat.send.mutationOptions({
      onMutate: async (vars): Promise<UpdateContext> => {
        const clientMessageId = generateId();
        const fullKey = trpc.chat.updates.queryKey();

        await qc.cancelQueries({ queryKey: baseKey });

        const previous = qc.getQueryData<ChatUpdatesResponse>(fullKey);

        // Add optimistic user message (without runId yet)
        qc.setQueryData<ChatUpdatesResponse>(fullKey, (old) => {
          if (!old) return old;

          return {
            ...old,
            messages: [
              ...old.messages,
              {
                id: `client:${clientMessageId}`,
                role: "user" as const,
                content: vars.content,
                createdAt: new Date(),
                updatedAt: new Date(),
                runId: null,
                userId: "",
                threadId: old.threadId,
                clientMessageId,
                replyTo: null,
                status: "final" as const,
                stepId: null,
                reactions: [],
              },
            ],
          };
        });

        return { previous, input: vars.content, fullKey, clientMessageId };
      },
      onSuccess: (result, _vars, ctx) => {
        if (!ctx?.fullKey) return;

        // Update optimistic message with runId from server
        qc.setQueryData<ChatUpdatesResponse>(ctx.fullKey, (old) => {
          if (!old) return old;

          return {
            ...old,
            messages: old.messages.map((m) =>
              String(m.id) === `client:${ctx.clientMessageId}`
                ? { ...m, runId: result.runId }
                : m
            ),
          };
        });

        // 如果服务器直接返回助手消息（demo/无数据库时），直接追加
        if (result.assistant) {
          const assistantId = generateId();
          qc.setQueryData<ChatUpdatesResponse>(ctx.fullKey, (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: [
                ...old.messages,
                {
                  id: assistantId,
                  role: "assistant",
                  content: result.assistant,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  runId: result.runId,
                  userId: "",
                  threadId: result.threadId,
                  clientMessageId: undefined,
                  replyTo: null,
                  status: "final" as const,
                  stepId: null,
                  reactions: [],
                },
              ],
            };
          });

          // demo 场景下不触发后端刷新，避免空列表覆盖本地消息
          return;
        }

        // Trigger refetch after runId is set in cache
        qc.invalidateQueries({ queryKey: baseKey });
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous && ctx.fullKey) {
          qc.setQueryData(ctx.fullKey, ctx.previous);
        }
        if (ctx?.input) {
          setInput(ctx.input);
        }
        toast.error("Failed to send message", {
          action: {
            label: "Retry",
            onClick: () => {
              if (ctx?.input) {
                sendMutation.mutate({ content: ctx.input });
              }
            },
          },
        });
      },
    })
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text) return;

      sendMutation.mutate({ content: text });
      setInput("");
    },
    [input, sendMutation]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isSending: sendMutation.isPending,
    error: sendMutation.error ?? null,
  };
}
