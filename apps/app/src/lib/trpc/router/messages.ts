import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { tryCatch } from "~/lib/try-catch";
import { messageReactions, messages } from "~/server/db/schema/agents";
import { protectedProcedure } from "../trpc";
export const messagesRouter = {
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { limit, cursor } = input;

      const { data: items, error: queryError } = await tryCatch(
        ctx.db.query.messages.findMany({
          where: cursor
            ? and(
                eq(messages.userId, userId),
                gt(messages.createdAt, new Date(cursor))
              )
            : eq(messages.userId, userId),
          orderBy: [desc(messages.createdAt)],
          limit: limit + 1,
        })
      );

      if (queryError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch messages: ${queryError.message}`,
        });
      }

      const messageList = items || [];
      let nextCursor: string | undefined;
      if (messageList.length > limit) {
        const nextItem = messageList.pop();
        nextCursor = nextItem?.createdAt.toISOString();
      }

      return {
        items: messageList
          .filter((m) => m.content !== null)
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content as string,
            createdAt: m.createdAt,
            threadId: m.threadId || undefined,
            runId: m.runId || undefined,
          }))
          .reverse(),
        nextCursor,
      };
    }),

  getReactions: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const reactions = await ctx.db
        .select()
        .from(messageReactions)
        .where(eq(messageReactions.messageId, input.messageId));
      return reactions;
    }),

  addReaction: protectedProcedure
    .input(z.object({ messageId: z.string(), type: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(messageReactions)
        .where(
          and(
            eq(messageReactions.messageId, input.messageId),
            eq(messageReactions.reactorRole, "user")
          )
        )
        .limit(1);

      const now = new Date();

      // If exists, update type (toggle or change reaction)
      if (existing.length > 0) {
        if (existing[0].type === input.type) {
          // Same type - remove it (toggle off)
          await ctx.db
            .delete(messageReactions)
            .where(
              and(
                eq(messageReactions.messageId, input.messageId),
                eq(messageReactions.reactorRole, "user")
              )
            );
          return { removed: true };
        }
        // Different type - update it
        await ctx.db
          .update(messageReactions)
          .set({ type: input.type, updatedAt: now })
          .where(
            and(
              eq(messageReactions.messageId, input.messageId),
              eq(messageReactions.reactorRole, "user")
            )
          );
      } else {
        // Insert new reaction
        await ctx.db.insert(messageReactions).values({
          messageId: input.messageId,
          userId: ctx.session.user.id,
          reactorRole: "user",
          type: input.type,
          createdAt: now,
          updatedAt: now,
        });
      }

      const [reaction] = await ctx.db
        .select()
        .from(messageReactions)
        .where(
          and(
            eq(messageReactions.messageId, input.messageId),
            eq(messageReactions.reactorRole, "user")
          )
        );

      return reaction;
    }),

  removeReaction: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(messageReactions)
        .where(
          and(
            eq(messageReactions.messageId, input.messageId),
            eq(messageReactions.reactorRole, "user")
          )
        );

      return { success: true };
    }),
} satisfies TRPCRouterRecord;
