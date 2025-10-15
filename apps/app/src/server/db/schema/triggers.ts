import {
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const triggers = mysqlTable(
  "triggers",
  {
    id: int("id").primaryKey().autoincrement(),
    agentName: varchar("agent_name", { length: 255 }).notNull(),
    payload: text("payload").notNull(),
    startTime: timestamp("start_time"),
    nextTrigger: timestamp("next_trigger"),
    recurrenceRule: varchar("recurrence_rule", { length: 255 }),
    timezone: varchar("timezone", { length: 100 }),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_triggers_agent_next").on(table.agentName, table.nextTrigger),
  ]
);
