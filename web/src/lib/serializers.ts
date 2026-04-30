import type { SyncRun, Task } from "@moodle-ai/db";

export type SerializedTask = Omit<Task, "dueAt" | "notifiedAt" | "firstSeenAt" | "updatedAt"> & {
  dueAt: string | null;
  notifiedAt: string | null;
  firstSeenAt: string;
  updatedAt: string;
};

export type SerializedSyncRun = Omit<SyncRun, "startedAt" | "finishedAt"> & {
  startedAt: string;
  finishedAt: string | null;
};

export function serializeTask(task: Task): SerializedTask {
  return {
    ...task,
    dueAt: task.dueAt?.toISOString() ?? null,
    notifiedAt: task.notifiedAt?.toISOString() ?? null,
    firstSeenAt: task.firstSeenAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

export function serializeSyncRun(run: SyncRun): SerializedSyncRun {
  return {
    ...run,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null
  };
}

