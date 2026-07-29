import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const plannerState = sqliteTable("planner_state", {
  userId: text("user_id").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});
