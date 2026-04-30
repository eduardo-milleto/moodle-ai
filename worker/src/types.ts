import { createHash } from "node:crypto";
import { z } from "zod";

export const extractedTaskSchema = z.object({
  source: z.enum(["moodle", "ics"]).default("moodle"),
  externalId: z.string().optional(),
  course: z.string().min(1),
  title: z.string().min(1),
  dueAt: z.string().datetime().nullable().optional(),
  moodleStatus: z.enum(["pending", "submitted", "graded", "overdue", "unknown"]).default("unknown"),
  link: z.string().url().nullable().optional(),
  raw: z.record(z.string(), z.unknown()).default({})
});

export type ExtractedTask = z.infer<typeof extractedTaskSchema>;

export function normalizeExtractedTask(task: ExtractedTask) {
  const externalId = task.externalId?.trim() || stableTaskId(task);

  return {
    source: task.source,
    externalId,
    course: task.course.trim(),
    title: task.title.trim(),
    dueAt: task.dueAt ? new Date(task.dueAt) : null,
    moodleStatus: task.moodleStatus,
    link: task.link ?? null,
    raw: task.raw
  };
}

export function stableTaskId(task: Pick<ExtractedTask, "course" | "title" | "dueAt" | "link">) {
  return createHash("sha256")
    .update([task.course, task.title, task.dueAt ?? "", task.link ?? ""].join("|"))
    .digest("hex");
}

