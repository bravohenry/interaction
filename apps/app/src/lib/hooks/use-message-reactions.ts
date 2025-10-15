"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RouterOutputs } from "~/lib/trpc";
import { useTRPC } from "~/trpc/react";

type ChatUpdates = RouterOutputs["chat"]["updates"];

export function useMessageReactions(messageId: string) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const chatKey = trpc.chat.updates.queryKey();

  const updateCache = (updater: (old: ChatUpdates) => ChatUpdates) => {
    qc.setQueryData<ChatUpdates>(chatKey, (old) => (old ? updater(old) : old));
  };

  const addReaction = useMutation(
    trpc.messages.addReaction.mutationOptions({
      onMutate: async ({ type }) => {
        await qc.cancelQueries({ queryKey: chatKey });
        const prev = qc.getQueryData<ChatUpdates>(chatKey);
        updateCache((old) => ({
          ...old,
          messages: old.messages.map((m) =>
            String(m.id) !== String(messageId)
              ? m
              : {
                  ...m,
                  reactions: [
                    ...(m.reactions ?? []),
                    {
                      messageId: String(messageId),
                      userId: "",
                      reactorRole: "user",
                      type,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    },
                  ],
                }
          ),
        }));
        return { prev };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.prev) qc.setQueryData(chatKey, ctx.prev);
      },
      onSettled: () => {
        qc.invalidateQueries({ queryKey: chatKey });
      },
    })
  );

  const removeReaction = useMutation(
    trpc.messages.removeReaction.mutationOptions({
      onMutate: async () => {
        await qc.cancelQueries({ queryKey: chatKey });
        const prev = qc.getQueryData<ChatUpdates>(chatKey);
        updateCache((old) => ({
          ...old,
          messages: old.messages.map((m) =>
            String(m.id) !== String(messageId)
              ? m
              : {
                  ...m,
                  reactions: (m.reactions ?? []).filter(
                    (r) => r.reactorRole !== "user"
                  ),
                }
          ),
        }));
        return { prev };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.prev) qc.setQueryData(chatKey, ctx.prev);
      },
      onSettled: () => {
        qc.invalidateQueries({ queryKey: chatKey });
      },
    })
  );

  const isPending = addReaction.isPending || removeReaction.isPending;

  return {
    addReaction: (type: string) => addReaction.mutate({ messageId, type }),
    removeReaction: () => removeReaction.mutate({ messageId }),
    isPending,
  };
}
