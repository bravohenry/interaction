import { relations } from "drizzle-orm";
import {
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// Canonical chat threads (single thread per user)
export const chatThreads = mysqlTable(
  "chat_threads",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    title: text("title"),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("chat_threads_user_unique").on(table.userId),
    index("chat_threads_user_idx").on(table.userId),
  ]
);

// Messages for conversation history
export const messages = mysqlTable(
  "messages",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    threadId: varchar("thread_id", { length: 255 }),
    role: varchar("role", { length: 50 }).notNull(), // 'user' | 'assistant' | 'system'
    content: text("content"), // string content for simple chat
    clientMessageId: varchar("client_message_id", { length: 255 }), // client-generated ID for idempotency
    replyTo: varchar("reply_to", { length: 255 }), // ID of the message this is replying to
    status: varchar("status", { length: 50 }).default("final"), // 'sending' | 'streaming' | 'final' | 'error'
    runId: varchar("run_id", { length: 255 }),
    stepId: varchar("step_id", { length: 255 }),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("messages_user_idx").on(table.userId, table.createdAt),
    index("messages_user_updated_idx").on(table.userId, table.updatedAt),
    index("messages_thread_idx").on(table.threadId, table.createdAt),
  ]
);

export const messagesRelations = relations(messages, ({ many }) => ({
  reactions: many(messageReactions),
}));

// Agent instances (persistent agent records)
export const agentInstances = mysqlTable(
  "agent_instances",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    type: varchar("type", { length: 100 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("idle"),
    threadId: varchar("thread_id", { length: 255 }),
    memoryKey: varchar("memory_key", { length: 255 }),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_user_type").on(table.userId, table.type),
    index("idx_status").on(table.status),
  ]
);

// Agent runs (main orchestration entity)
export const agentRuns = mysqlTable(
  "agent_runs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    threadId: varchar("thread_id", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    agentType: varchar("agent_type", { length: 50 }).notNull(), // 'interaction' | 'execution'
    state: varchar("state", { length: 50 }).notNull(), // 'queued' | 'running' | 'completed' | 'failed'
    graphVersion: varchar("graph_version", { length: 50 })
      .notNull()
      .default("v1"),
    currentNode: varchar("current_node", { length: 255 }),
    currentStep: int("current_step").notNull().default(0),
    maxRetries: int("max_retries").notNull().default(3),
    config: text("config"), // JSON stored as text
    lastError: text("last_error"),
    canceledAt: timestamp("canceled_at"),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("runs_state_idx").on(table.state),
    index("runs_user_idx").on(table.userId),
    index("runs_thread_idx").on(table.threadId),
    index("runs_created_idx").on(table.createdAt),
  ]
);

// Steps within a run (model calls, tool calls, etc.)
export const runSteps = mysqlTable(
  "run_steps",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    runId: varchar("run_id", { length: 255 }).notNull(),
    idx: int("idx").notNull(), // monotonic step index
    type: varchar("type", { length: 50 }).notNull(), // 'model_message' | 'tool_call' | 'tool_result' | 'aggregation'
    state: varchar("state", { length: 50 }).notNull(), // 'pending' | 'running' | 'completed' | 'failed'
    payload: text("payload"), // JSON stored as text
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("steps_run_idx").on(table.runId, table.idx)]
);

// Execution agent logs - store all execution agent activity
export const executionAgentLogs = mysqlTable(
  "execution_agent_logs",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    agentName: varchar("agent_name", { length: 255 }).notNull(),
    tag: varchar("tag", { length: 100 }).notNull(), // 'agent_request' | 'agent_action' | 'tool_response' | 'agent_response'
    payload: text("payload").notNull(),
    timestamp: varchar("timestamp", { length: 100 }).notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("execution_logs_user_agent_idx").on(
      table.userId,
      table.agentName,
      table.createdAt
    ),
    index("execution_logs_created_idx").on(table.createdAt),
  ]
);

// Conversation log entries - store interaction agent conversation history
export const conversationLogEntries = mysqlTable(
  "conversation_log_entries",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    threadId: varchar("thread_id", { length: 255 }),
    tag: varchar("tag", { length: 100 }).notNull(), // 'user_message' | 'agent_message' | 'poke_reply' | 'wait'
    payload: text("payload").notNull(),
    timestamp: varchar("timestamp", { length: 100 }).notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("conversation_log_user_thread_idx").on(
      table.userId,
      table.threadId,
      table.createdAt
    ),
    index("conversation_log_created_idx").on(table.createdAt),
  ]
);

// Working memory entries - store working memory log entries for summarization
export const workingMemoryEntries = mysqlTable(
  "working_memory_entries",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    threadId: varchar("thread_id", { length: 255 }),
    tag: varchar("tag", { length: 100 }).notNull(),
    payload: text("payload").notNull(),
    timestamp: varchar("timestamp", { length: 100 }),
    idx: int("idx").notNull(), // for ordering
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("working_memory_user_thread_idx").on(
      table.userId,
      table.threadId,
      table.idx
    ),
  ]
);

// Agent roster - track active execution agents per user
export const agentRoster = mysqlTable(
  "agent_roster",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    agentName: varchar("agent_name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("agent_roster_user_agent_unique").on(
      table.userId,
      table.agentName
    ),
    index("agent_roster_user_idx").on(table.userId),
  ]
);

// Message reactions - both user and assistant can react (one reaction per participant per message)
export const messageReactions = mysqlTable(
  "message_reactions",
  {
    messageId: varchar("message_id", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(), // tenant partition
    reactorRole: varchar("reactor_role", { length: 20 }).notNull(), // 'user' | 'assistant' - who reacted
    type: varchar("type", { length: 20 }).notNull(), // 'heart' | 'like' | 'dislike' | 'laugh' | 'emphasize' | 'question'
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    pk: { columns: [table.messageId, table.reactorRole] },
    messageIdx: index("message_reactions_message_idx").on(table.messageId),
    userMessageIdx: index("message_reactions_user_message_idx").on(
      table.userId,
      table.messageId
    ),
  })
);

export const messageReactionsRelations = relations(
  messageReactions,
  ({ one }) => ({
    message: one(messages, {
      fields: [messageReactions.messageId],
      references: [messages.id],
    }),
  })
);

// Export types
export type ChatThread = typeof chatThreads.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type MessageWithReactions = Message & { reactions: MessageReaction[] };
export type AgentInstance = typeof agentInstances.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type RunStep = typeof runSteps.$inferSelect;
export type ExecutionAgentLog = typeof executionAgentLogs.$inferSelect;
export type ConversationLogEntry = typeof conversationLogEntries.$inferSelect;
export type WorkingMemoryEntry = typeof workingMemoryEntries.$inferSelect;
export type AgentRosterEntry = typeof agentRoster.$inferSelect;
