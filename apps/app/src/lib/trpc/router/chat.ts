import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { generateId } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "~/env";
import { tryCatch } from "~/lib/try-catch";
import { agentRuns, chatThreads, messages } from "~/server/db/schema/agents";
import { logger } from "~/server/utils/logger";
import { protectedProcedure } from "../trpc";

export const chatRouter = {
  send: protectedProcedure
    .input(
      z.object({
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messageId = generateId();
      const runId = generateId();
      const userId = ctx.session.user.id;

      // Get or create thread
      const { data: existing, error: queryError } = await tryCatch(
        ctx.db.query.chatThreads.findFirst({
          where: eq(chatThreads.userId, userId),
        })
      );

      if (queryError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to query thread: ${queryError.message}`,
        });
      }

      let threadId: string;
      if (existing) {
        threadId = existing.id;
      } else {
        const newId = generateId();
        const { error: insertError } = await tryCatch(
          ctx.db.insert(chatThreads).values({
            id: newId,
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        );

        if (insertError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to create thread: ${insertError.message}`,
          });
        }

        const { data: row, error: refetchError } = await tryCatch(
          ctx.db.query.chatThreads.findFirst({
            where: eq(chatThreads.userId, userId),
          })
        );

        if (refetchError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to refetch thread: ${refetchError.message}`,
          });
        }

        if (!row) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to resolve thread",
          });
        }

        threadId = row.id;
      }

      logger.start(
        `[${runId}] Starting chat flow for user ${userId} (thread ${threadId})`
      );

      const chatRequest = {
        user_id: userId,
        thread_id: threadId,
        message: input.content,
        run_id: runId,
        message_id: messageId,
      };

      const { error: fetchError } = await tryCatch(
        fetch(`${env.NEXT_PUBLIC_PY_BACKEND_URL}/api/v1/chat/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.PY_SERVICE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chatRequest),
        }).then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`${res.status}: ${text}`);
          }
          // Python returns 202 Accepted with empty body; don't attempt JSON parsing
          if (res.status === 202) {
            return { ok: true } as const;
          }
          const contentType = res.headers.get("content-type") ?? "";
          if (!contentType.includes("application/json")) {
            // Consume text to avoid stream leaks, but ignore body content
            await res.text();
            return { ok: true } as const;
          }
          return res.json();
        })
      );

      if (fetchError) {
        const errorMsg = `Failed to connect to Python backend: ${fetchError.message}`;
        logger.error(`[${runId}] ${errorMsg}`);

        await tryCatch(
          ctx.db
            .update(agentRuns)
            .set({
              state: "failed",
              lastError: errorMsg,
              updatedAt: new Date(),
            })
            .where(eq(agentRuns.id, runId))
        );

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: errorMsg,
        });
      }

      logger.info(`[${runId}] Python accepted request`);

      const { error: updateError } = await tryCatch(
        ctx.db
          .update(agentRuns)
          .set({ state: "running", updatedAt: new Date() })
          .where(eq(agentRuns.id, runId))
      );

      if (updateError) {
        logger.error(
          `[${runId}] Failed to update run state: ${updateError.message}`
        );
        // Don't fail the request since Python already accepted it
      }

      logger.info(
        `[${runId}] Returning runId - Python processing in background`
      );

      return { runId, threadId };
    }),

  updates: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get or create thread
    const { data: existing, error: queryError } = await tryCatch(
      ctx.db.query.chatThreads.findFirst({
        where: eq(chatThreads.userId, userId),
      })
    );

    if (queryError) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to query thread: ${queryError.message}`,
      });
    }

    let threadId: string;
    if (existing) {
      threadId = existing.id;
    } else {
      const newId = generateId();
      const { error: insertError } = await tryCatch(
        ctx.db.insert(chatThreads).values({
          id: newId,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      if (insertError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create thread: ${insertError.message}`,
        });
      }

      const { data: row, error: refetchError } = await tryCatch(
        ctx.db.query.chatThreads.findFirst({
          where: eq(chatThreads.userId, userId),
        })
      );

      if (refetchError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to refetch thread: ${refetchError.message}`,
        });
      }

      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to resolve thread",
        });
      }

      threadId = row.id;
    }

    // Fetch messages with reactions
    const { data: threadMessages, error: messagesError } = await tryCatch(
      ctx.db.query.messages.findMany({
        where: eq(messages.threadId, threadId),
        // biome-ignore lint/nursery/noShadow: it's ok.
        orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        with: {
          reactions: true,
        },
      })
    );

    if (messagesError) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch messages: ${messagesError.message}`,
      });
    }

    return {
      threadId,
      messages: threadMessages ?? [],
    };
  }),

  clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const { error: fetchError } = await tryCatch(
      fetch(`${env.NEXT_PUBLIC_PY_BACKEND_URL}/api/v1/chat/history`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${env.PY_SERVICE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userId }),
      }).then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status}: ${text}`);
        }
        return res.json();
      })
    );

    if (fetchError) {
      const errorMsg = `Failed to clear history: ${fetchError.message}`;
      logger.error(errorMsg);

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: errorMsg,
      });
    }

    logger.info(`Cleared chat history for user ${userId}`);

    return { success: true };
  }),
} satisfies TRPCRouterRecord;
