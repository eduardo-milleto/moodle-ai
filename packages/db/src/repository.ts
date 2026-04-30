import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./client";
import { syncRuns, tasks, type NewSyncRun, type SyncRun, type Task } from "./schema";

export const taskInputSchema = z.object({
  source: z.enum(["moodle", "ics", "manual"]).default("moodle"),
  externalId: z.string().min(1),
  course: z.string().min(1),
  title: z.string().min(1),
  dueAt: z.coerce.date().nullable().optional(),
  moodleStatus: z.enum(["pending", "submitted", "graded", "overdue", "unknown"]).default("unknown"),
  link: z.string().url().nullable().optional(),
  raw: z.record(z.string(), z.unknown()).default({})
});

export type TaskInput = z.infer<typeof taskInputSchema>;

export type TaskFilters = {
  course?: string;
  status?: "all" | "done" | "pending";
  urgency?: "all" | "overdue" | "today" | "week";
};

export async function listTasks(filters: TaskFilters = {}) {
  const db = getDb();
  const now = new Date();
  const startOfTomorrow = new Date(now);
  startOfTomorrow.setHours(24, 0, 0, 0);
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const where = [
    filters.course ? eq(tasks.course, filters.course) : undefined,
    filters.status === "done" ? eq(tasks.manuallyDone, true) : undefined,
    filters.status === "pending" ? eq(tasks.manuallyDone, false) : undefined,
    filters.urgency === "overdue" ? and(lte(tasks.dueAt, now), eq(tasks.manuallyDone, false)) : undefined,
    filters.urgency === "today" ? and(lte(tasks.dueAt, startOfTomorrow), eq(tasks.manuallyDone, false)) : undefined,
    filters.urgency === "week" ? and(lte(tasks.dueAt, endOfWeek), eq(tasks.manuallyDone, false)) : undefined
  ].filter(Boolean);

  return db
    .select()
    .from(tasks)
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(asc(tasks.manuallyDone), sql`${tasks.dueAt} asc nulls last`, asc(tasks.course), asc(tasks.title));
}

export async function listCourses() {
  const db = getDb();
  const rows = await db
    .selectDistinct({ course: tasks.course })
    .from(tasks)
    .orderBy(asc(tasks.course));

  return rows.map((row) => row.course);
}

export async function listActivePendingTasks() {
  const db = getDb();
  const now = new Date();

  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.manuallyDone, false),
        or(eq(tasks.moodleStatus, "pending"), eq(tasks.moodleStatus, "unknown")),
        or(isNull(tasks.dueAt), gte(tasks.dueAt, now))
      )
    )
    .orderBy(sql`${tasks.dueAt} asc nulls last`, asc(tasks.course), asc(tasks.title));
}

export async function getLatestSyncRuns(limit = 5) {
  const db = getDb();

  return db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(limit);
}

export async function setTaskDone(id: string, manuallyDone: boolean) {
  const db = getDb();
  const [task] = await db
    .update(tasks)
    .set({ manuallyDone, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();

  return task;
}

export async function upsertTasks(inputs: TaskInput[]) {
  const results = await upsertTasksWithStatus(inputs);

  return results.map((result) => result.task);
}

export async function upsertTasksWithStatus(inputs: TaskInput[]) {
  const db = getDb();
  const parsed = inputs.map((input) => taskInputSchema.parse(input));

  if (parsed.length === 0) {
    return [];
  }

  const existingWhere = parsed.map((task) =>
    and(eq(tasks.source, task.source), eq(tasks.externalId, task.externalId))
  );
  const existing = await db
    .select({ source: tasks.source, externalId: tasks.externalId })
    .from(tasks)
    .where(or(...existingWhere));
  const existingKeys = new Set(existing.map((task) => taskKey(task.source, task.externalId)));

  const upserted = await db
    .insert(tasks)
    .values(
      parsed.map((task) => ({
        ...task,
        dueAt: task.dueAt ?? null,
        link: task.link ?? null,
        updatedAt: new Date()
      }))
    )
    .onConflictDoUpdate({
      target: [tasks.source, tasks.externalId],
      set: {
        course: sql`excluded.course`,
        title: sql`excluded.title`,
        dueAt: sql`excluded.due_at`,
        moodleStatus: sql`excluded.moodle_status`,
        link: sql`excluded.link`,
        raw: sql`excluded.raw`,
        updatedAt: new Date()
      }
    })
    .returning();

  return upserted.map((task) => ({
    task,
    isNew: !existingKeys.has(taskKey(task.source, task.externalId))
  }));
}

function taskKey(source: string, externalId: string) {
  return `${source}\u0000${externalId}`;
}

export async function createSyncRun(input: Pick<NewSyncRun, "source" | "metadata">) {
  const db = getDb();
  const [run] = await db.insert(syncRuns).values(input).returning();

  if (!run) {
    throw new Error("Failed to create sync run");
  }

  return run;
}

export async function finishSyncRun(
  id: string,
  patch: Pick<NewSyncRun, "status" | "tasksSeen" | "tasksUpserted" | "errorMessage" | "metadata">
) {
  const db = getDb();
  const [run] = await db
    .update(syncRuns)
    .set({ ...patch, finishedAt: new Date() })
    .where(eq(syncRuns.id, id))
    .returning();

  return run;
}

export async function findTasksDueForNotification(hours: number) {
  const db = getDb();
  const now = new Date();
  const dueBefore = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.manuallyDone, false),
        isNull(tasks.notifiedAt),
        or(eq(tasks.moodleStatus, "pending"), eq(tasks.moodleStatus, "unknown"), eq(tasks.moodleStatus, "overdue")),
        gte(tasks.dueAt, now),
        lte(tasks.dueAt, dueBefore)
      )
    )
    .orderBy(asc(tasks.dueAt));
}

export async function markTasksNotified(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const db = getDb();
  return db.update(tasks).set({ notifiedAt: new Date(), updatedAt: new Date() }).where(inArray(tasks.id, ids)).returning();
}

export type { SyncRun, Task };
