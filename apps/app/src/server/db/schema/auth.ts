import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const user = mysqlTable("user", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  timezone: varchar("timezone", { length: 100 }), // User timezone preference (e.g., "America/New_York")
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = mysqlTable("session", {
  id: varchar("id", { length: 255 }).primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: varchar("token", { length: 500 }).notNull().unique(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: varchar("ip_address", { length: 100 }),
  userAgent: text("user_agent"),
  userId: varchar("user_id", { length: 255 }).notNull(),
});

export const account = mysqlTable("account", {
  id: varchar("id", { length: 255 }).primaryKey(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 100 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: varchar("password", { length: 255 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = mysqlTable("verification", {
  id: varchar("id", { length: 255 }).primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const jwks = mysqlTable("jwks", {
  id: varchar("id", { length: 255 }).primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

// Composio connections for external service integrations
export const composioConnections = mysqlTable(
  "composio_connections",
  {
    id: varchar("id", { length: 255 }).primaryKey(), // Composio connection ID or request ID
    userId: varchar("user_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 100 }).notNull(), // e.g., "gmail", "notion"
    authConfigId: varchar("auth_config_id", { length: 255 }).notNull(), // Composio auth config ID
    connectionRequestId: varchar("connection_request_id", { length: 255 }), // For tracking OAuth flow
    // New fields for multi-account + ownership
    composioUserId: varchar("composio_user_id", { length: 255 }), // Composio user id used during connect
    email: varchar("email", { length: 255 }), // Resolved account email (if available)
    isDefault: boolean("is_default").notNull().default(false),
    status: varchar("status", { length: 50 }).notNull().default("pending"), // "pending" | "connected" | "failed" | "disconnected"
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("composio_connections_user_idx").on(table.userId),
    uniqueIndex("composio_connections_composio_user_unique").on(
      table.composioUserId
    ),
    uniqueIndex("composio_connections_user_provider_email_unique").on(
      table.userId,
      table.providerId,
      table.email
    ),
    index("composio_connections_provider_idx").on(table.providerId),
  ]
);

// Processed emails - track Gmail messages that have been processed
export const processedEmails = mysqlTable(
  "processed_emails",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    messageId: varchar("message_id", { length: 255 }).notNull(), // Gmail message ID
    processedAt: timestamp("processed_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("processed_emails_user_message_unique").on(
      table.userId,
      table.messageId
    ),
    index("processed_emails_user_idx").on(table.userId),
  ]
);

// Conversation summaries - store summarized conversation history
export const conversationSummaries = mysqlTable(
  "conversation_summaries",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    threadId: varchar("thread_id", { length: 255 }).notNull(),
    summary: text("summary").notNull(),
    messageCount: int("message_count").notNull(),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("conversation_summaries_user_thread_idx").on(
      table.userId,
      table.threadId
    ),
  ]
);
