import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const taskSource = pgEnum("task_source", ["moodle", "ics", "manual"]);
export const taskStatus = pgEnum("task_status", ["pending", "submitted", "graded", "overdue", "unknown"]);
export const syncStatus = pgEnum("sync_status", ["success", "partial", "failed"]);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: taskSource("source").notNull().default("moodle"),
    externalId: text("external_id").notNull(),
    course: text("course").notNull(),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    moodleStatus: taskStatus("moodle_status").notNull().default("unknown"),
    link: text("link"),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    manuallyDone: boolean("manually_done").notNull().default(false),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sourceExternalIdUnique: uniqueIndex("tasks_source_external_id_unique").on(table.source, table.externalId),
    dueAtIdx: index("tasks_due_at_idx").on(table.dueAt),
    courseIdx: index("tasks_course_idx").on(table.course),
    manuallyDoneIdx: index("tasks_manually_done_idx").on(table.manuallyDone)
  })
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: syncStatus("status").notNull().default("success"),
    source: text("source").notNull(),
    tasksSeen: integer("tasks_seen").notNull().default(0),
    tasksUpserted: integer("tasks_upserted").notNull().default(0),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`)
  },
  (table) => ({
    startedAtIdx: index("sync_runs_started_at_idx").on(table.startedAt)
  })
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type SyncRun = typeof syncRuns.$inferSelect;
export type NewSyncRun = typeof syncRuns.$inferInsert;

