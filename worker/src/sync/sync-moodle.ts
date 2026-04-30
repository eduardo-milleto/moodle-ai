import {
  createSyncRun,
  findTasksDueForNotification,
  finishSyncRun,
  markTasksNotified,
  upsertTasksWithStatus
} from "@moodle-ai/db";
import { getConfig } from "../config";
import { fetchIcsTasks } from "../ics/fetch-ics";
import { scrapeMoodleTasks } from "../moodle/playwright-scraper";
import { sendTelegramDueDigest, sendTelegramNewTaskDigest } from "../notifications/telegram";
import { normalizeExtractedTask } from "../types";

export async function syncMoodleTasks() {
  const config = getConfig();
  const run = await createSyncRun({
    source: config.MOODLE_ICS_URL ? "moodle+ics" : "moodle",
    metadata: {
      agentEnabled: config.AGENT_ENABLED,
      fallbackEnabled: Boolean(config.MOODLE_ICS_URL)
    }
  });

  try {
    const extraction = await extractWithFallback(config);
    const normalized = extraction.tasks.map(normalizeExtractedTask);
    const upserted = await upsertTasksWithStatus(normalized);
    const newTasks = upserted.filter((result) => result.isNew).map((result) => result.task);
    const newTaskIds = new Set(newTasks.map((task) => task.id));
    const newTasksNotified = await sendTelegramNewTaskDigest({
      botToken: config.TELEGRAM_BOT_TOKEN,
      chatId: config.TELEGRAM_CHAT_ID,
      tasks: newTasks
    });
    const dueTasks = (await findTasksDueForNotification(config.NOTIFY_DUE_HOURS)).filter(
      (task) => !newTaskIds.has(task.id)
    );
    const notified = await sendTelegramDueDigest({
      botToken: config.TELEGRAM_BOT_TOKEN,
      chatId: config.TELEGRAM_CHAT_ID,
      tasks: dueTasks
    });

    if (notified) {
      await markTasksNotified(dueTasks.map((task) => task.id));
    }

    await finishSyncRun(run.id, {
      status: extraction.status,
      tasksSeen: extraction.tasks.length,
      tasksUpserted: upserted.length,
      errorMessage: extraction.errorMessage,
      metadata: {
        ...run.metadata,
        primarySource: extraction.primarySource,
        newTasksNotified: newTasksNotified ? newTasks.length : 0,
        notified: notified ? dueTasks.length : 0
      }
    });

    return {
      status: extraction.status,
      tasksSeen: extraction.tasks.length,
      tasksUpserted: upserted.length,
      newTasksNotified: newTasksNotified ? newTasks.length : 0,
      notified: notified ? dueTasks.length : 0
    };
  } catch (error) {
    await finishSyncRun(run.id, {
      status: "failed",
      tasksSeen: 0,
      tasksUpserted: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown sync error",
      metadata: run.metadata
    });
    throw error;
  }
}

async function extractWithFallback(config: ReturnType<typeof getConfig>) {
  const tasks = [];
  let playwrightError: Error | null = null;

  try {
    tasks.push(...(await scrapeMoodleTasks(config)));
  } catch (error) {
    playwrightError = error instanceof Error ? error : new Error("Playwright failed");
  }

  if (config.MOODLE_ICS_URL) {
    const icsTasks = await fetchIcsTasks(config.MOODLE_ICS_URL);
    tasks.push(...icsTasks);
  }

  if (tasks.length === 0 && playwrightError) {
    if (!config.MOODLE_ICS_URL) {
      throw playwrightError;
    }

    return {
      status: "failed" as const,
      tasks,
      primarySource: "none",
      errorMessage: playwrightError.message
    };
  }

  if (playwrightError) {
    return {
      status: "partial" as const,
      tasks,
      primarySource: "ics",
      errorMessage: playwrightError.message
    };
  }

  return {
    status: "success" as const,
    tasks,
    primarySource: config.MOODLE_ICS_URL ? "playwright+ics" : "playwright",
    errorMessage: null
  };
}
