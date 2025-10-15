import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { composioConnections } from "~/server/db/schema/auth";
import { getGravatarUrl } from "~/server/utils/gravatar";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const gmailRouter = createTRPCRouter({
  connections: protectedProcedure.query(async ({ ctx }) => {
    const connections = await ctx.db
      .select()
      .from(composioConnections)
      .where(
        and(
          eq(composioConnections.userId, ctx.session.user.id),
          eq(composioConnections.providerId, "gmail")
        )
      );

    return connections.map((conn) => ({
      id: conn.id,
      email: conn.email,
      status: conn.status,
      metadata: {
        avatar_url: conn.email ? getGravatarUrl(conn.email) : undefined,
        is_default: conn.isDefault,
      },
    }));
  }),

  setPrimary: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await ctx.db.transaction(async (tx) => {
        const connection = await tx
          .select()
          .from(composioConnections)
          .where(
            and(
              eq(composioConnections.id, input.connectionId),
              eq(composioConnections.userId, userId),
              eq(composioConnections.providerId, "gmail")
            )
          )
          .limit(1);

        if (connection.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Connection not found",
          });
        }

        await tx
          .update(composioConnections)
          .set({ isDefault: false })
          .where(
            and(
              eq(composioConnections.userId, userId),
              eq(composioConnections.providerId, "gmail")
            )
          );

        await tx
          .update(composioConnections)
          .set({ isDefault: true })
          .where(eq(composioConnections.id, input.connectionId));
      });

      return { primaryId: input.connectionId };
    }),
});
