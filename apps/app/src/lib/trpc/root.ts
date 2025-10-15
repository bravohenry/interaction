import { chatRouter } from "./router/chat";
import { gmailRouter } from "./router/gmail";
import { messagesRouter } from "./router/messages";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  chat: chatRouter,
  gmail: gmailRouter,
  messages: messagesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
