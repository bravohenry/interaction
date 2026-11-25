import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { generateId, streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "~/env";
import { tryCatch } from "~/lib/try-catch";
import { agentRuns, chatThreads, messages } from "~/server/db/schema/agents";
import { logger } from "~/server/utils/logger";
import { protectedProcedure, publicProcedure } from "../trpc";

const DEMO_USER_ID = "demo-user";
const DEMO_THREAD_ID = "demo-thread";

// 系统提示词 - 健康助手角色
const SYSTEM_PROMPT = `You are Carol, a warm and empathetic AI health companion focused on emotional wellness and health insurance navigation. Your role is to:

- Provide emotional support and understanding
- Help users navigate health insurance questions and concerns
- Offer guidance on healthcare decisions with compassion
- Reduce anxiety around medical and insurance topics
- Be a calm, reassuring presence

Speak in a warm, gentle, and understanding tone. Avoid medical diagnoses or specific treatment advice - instead, guide users to appropriate resources and help them understand their options.`;

export const chatRouter = {
  send: publicProcedure
    .input(
      z.object({
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messageId = generateId();
      const runId = generateId();
      const userId = ctx.session?.user?.id ?? DEMO_USER_ID;
      const isDemo = userId === DEMO_USER_ID;

      // Get or create thread（尝试使用数据库，如果可用的话）
      let threadId: string | null = null;
      
      // 尝试从数据库获取或创建 thread
      const { data: existing, error: queryError } = await tryCatch(
        ctx.db.query.chatThreads.findFirst({
          where: eq(chatThreads.userId, userId),
        })
      );

      if (queryError) {
        logger.warn(`[${runId}] Failed to query thread: ${queryError.message}`);
        // 数据库不可用时，使用 demo thread ID
        threadId = isDemo ? DEMO_THREAD_ID : null;
      } else if (existing) {
        threadId = existing.id;
      } else {
        // 尝试创建新的 thread
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
          logger.warn(`[${runId}] Failed to create thread: ${insertError.message}`);
          // 创建失败时，使用 demo thread ID（如果是 demo 模式）
          threadId = isDemo ? DEMO_THREAD_ID : null;
        } else {
          // 创建成功，尝试获取新创建的 thread
          const { data: row, error: refetchError } = await tryCatch(
            ctx.db.query.chatThreads.findFirst({
              where: eq(chatThreads.userId, userId),
            })
          );

          if (refetchError || !row) {
            logger.warn(`[${runId}] Failed to refetch thread: ${refetchError?.message ?? "unknown"}`);
            threadId = isDemo ? DEMO_THREAD_ID : null;
          } else {
            threadId = row.id;
          }
        }
      }

      // 如果最终没有 threadId，使用 demo thread ID
      if (!threadId) {
        threadId = DEMO_THREAD_ID;
      }

      logger.start(
        `[${runId}] Starting chat flow for user ${userId} (thread ${threadId || DEMO_THREAD_ID})`
      );

      // 保存用户消息（尝试保存，即使是在 demo 模式下，如果数据库可用）
      if (threadId) {
        const { error: messageError } = await tryCatch(
          ctx.db.insert(messages).values({
            id: messageId,
            userId,
            threadId: threadId!,
            role: "user",
            content: input.content.trim(),
            runId,
            status: "final",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        );

        if (messageError) {
          logger.error(`Failed to save user message: ${messageError.message}`);
          // 在 demo 模式下，如果数据库不可用，这是正常的，不抛出错误
          if (!isDemo) {
            // 非 demo 模式下，记录错误但继续（降级为 demo 模式）
            logger.warn(`Database unavailable, continuing in demo mode`);
          }
        }

        // 创建 agent run（仅在非 demo 模式下）
        if (!isDemo) {
          const { error: runError } = await tryCatch(
            ctx.db.insert(agentRuns).values({
              id: runId,
              threadId: threadId!,
              userId,
              agentType: "interaction",
              state: "running",
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          );

          if (runError) {
            logger.error(`Failed to create agent run: ${runError.message}`);
          }
        }
      }

      // 获取历史消息用于上下文（跳过 demo 模式）
      let historyMessages: Array<{ role: string; content: string | null }> = [];
      if (!isDemo && threadId) {
        const { data } = await tryCatch(
          ctx.db.query.messages.findMany({
            where: eq(messages.threadId, threadId),
            orderBy: (messages, { asc }) => [asc(messages.createdAt)],
            limit: 20,
          })
        );
        historyMessages = (data || []) as Array<{ role: string; content: string | null }>;
      }

      // 构建消息历史（Vercel AI SDK 格式）
      const aiMessages = historyMessages
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .map((msg): { role: "user" | "assistant"; content: string } => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content || "",
        }));

      // 添加当前用户消息
      aiMessages.push({
        role: "user",
        content: input.content.trim(),
      });

      // 检查 Gemini API 密钥
      // 优先使用 env.GEMINI_API_KEY，如果不存在则尝试从 process.env 读取
      const apiKey = env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "placeholder_gemini_api_key" || apiKey.trim() === "") {
        logger.error(`[${runId}] GEMINI_API_KEY 未配置或无效。env.GEMINI_API_KEY: ${env.GEMINI_API_KEY ? "已设置" : "undefined"}, process.env.GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "已设置" : "undefined"}`);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GEMINI_API_KEY 未配置。请在 .env 文件中添加有效的 Google Gemini API key。获取方式：https://makersuite.google.com/app/apikey",
        });
      }

      // 统一的 Gemini 调用逻辑
      const runGemini = async (google: ReturnType<typeof createGoogleGenerativeAI>) => {
        const result = streamText({
          model: google("models/gemini-2.0-flash"),
          system: SYSTEM_PROMPT,
          messages: aiMessages,
        });

        let fullText = "";
        for await (const chunk of result.textStream) {
          fullText += chunk;
        }

        logger.info(`[${runId}] Gemini API response received, length: ${fullText.length}`);

        if (!fullText || fullText.trim().length === 0) {
          logger.warn(`[${runId}] Empty response from Gemini API, using fallback copy`);
          fullText = "抱歉，我暂时没有获取到回复，请稍后再试。";
        }

        return fullText;
      };

      const isDemoThread = threadId === DEMO_THREAD_ID;

      // Demo 线程或数据库不可用时：同步获取并返回助手回复，避免依赖数据库
      if (isDemoThread) {
        const google = createGoogleGenerativeAI({ apiKey });
        const fullText = await runGemini(google);
        return { runId, threadId: DEMO_THREAD_ID, assistant: fullText };
      }

      // 非 demo 线程：异步后台写数据库
      void (async () => {
        const originalApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

        try {
          const google = createGoogleGenerativeAI({ apiKey });
          const fullText = await runGemini(google);

          if (threadId) {
            const assistantMessageId = generateId();
            const { error: insertError } = await tryCatch(
              ctx.db.insert(messages).values({
                id: assistantMessageId,
                userId,
                threadId,
                role: "assistant",
                content: fullText,
                runId,
                status: "final",
                createdAt: new Date(),
                updatedAt: new Date(),
              })
            );

            if (insertError) {
              logger.error(`[${runId}] Failed to save assistant message: ${insertError.message}`);
            } else {
              logger.info(`[${runId}] Assistant message saved: ${assistantMessageId}`);
            }

            const { error: updateError } = await tryCatch(
              ctx.db
                .update(agentRuns)
                .set({
                  state: "completed",
                  updatedAt: new Date(),
                })
                .where(eq(agentRuns.id, runId))
            );

            if (updateError) {
              logger.error(`[${runId}] Failed to update agent run: ${updateError.message}`);
            } else {
              logger.info(`[${runId}] Agent run completed successfully`);
            }
          } else {
            logger.info(`[${runId}] No threadId available, message not saved`);
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`[${runId}] Gemini API error: ${errorMessage}`);
          logger.error(`[${runId}] Error stack: ${error instanceof Error ? error.stack : "N/A"}`);

          const { error: updateError } = await tryCatch(
            ctx.db
              .update(agentRuns)
              .set({
                state: "failed",
                lastError: errorMessage,
                updatedAt: new Date(),
              })
              .where(eq(agentRuns.id, runId))
          );

          if (updateError) {
            logger.error(`[${runId}] Failed to update agent run to failed state: ${updateError.message}`);
          }
        } finally {
          if (originalApiKey !== undefined) {
            process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalApiKey;
          } else {
            delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
          }
        }
      })();

      logger.info(`[${runId}] Gemini API request initiated (async)`);

      return { runId, threadId: threadId || DEMO_THREAD_ID };
    }),

  updates: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id ?? DEMO_USER_ID;
    const isDemo = userId === DEMO_USER_ID;

    // 尝试从数据库获取消息（即使是在 demo 模式下，如果数据库可用）
    let threadId: string = DEMO_THREAD_ID;

    // Get or create thread
    const { data: existing, error: queryError } = await tryCatch(
      ctx.db.query.chatThreads.findFirst({
        where: eq(chatThreads.userId, userId),
      })
    );

    if (queryError) {
      logger.warn(`Failed to query thread: ${queryError.message}`);
      // 如果数据库不可用，返回空消息列表（但使用 DEMO_THREAD_ID）
      return { threadId: DEMO_THREAD_ID, messages: [] };
    }
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
        logger.error(`Failed to create thread: ${insertError.message}`);
        return { threadId: DEMO_THREAD_ID, messages: [] };
      }

      const { data: row, error: refetchError } = await tryCatch(
        ctx.db.query.chatThreads.findFirst({
          where: eq(chatThreads.userId, userId),
        })
      );

      if (!row || refetchError) {
        logger.error(
          `Failed to resolve thread: ${refetchError?.message ?? "unknown"}`
        );
        return { threadId: DEMO_THREAD_ID, messages: [] };
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
      logger.error(`Failed to fetch messages: ${messagesError.message}`);
      return { threadId, messages: [] };
    }

    return {
      threadId,
      messages: threadMessages ?? [],
    };
  }),

  clearHistory: publicProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session?.user?.id ?? DEMO_USER_ID;
    const isDemo = userId === DEMO_USER_ID;

    if (isDemo) {
      return { success: true };
    }

    // 获取用户的 thread
    const { data: thread } = await tryCatch(
      ctx.db.query.chatThreads.findFirst({
        where: eq(chatThreads.userId, userId),
      })
    );

    if (!thread) {
      return { success: true };
    }

    // 删除该线程的所有消息
    const { error: deleteError } = await tryCatch(
      ctx.db.delete(messages).where(eq(messages.threadId, thread.id))
    );

    if (deleteError) {
      const errorMsg = `Failed to clear history: ${deleteError.message}`;
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

