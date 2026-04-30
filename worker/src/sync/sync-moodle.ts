import {
  createSyncRun,
  findTasksDueForNotification,
  finishSyncRun,
  markTasksNotified,
  upsertTasks
} from "@moodle-ai/db";
import { getConfig } from "../config";
import { fetchIcsTasks } from "../ics/fetch-ics";
import { scrapeMoodleTasks } from "../moodle/playwright-scraper";
import { sendTelegramDueDigest } from "../notifications/telegram";
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
    const upserted = await upsertTasks(normalized);
    const dueTasks = await findTasksDueForNotification(config.NOTIFY_DUE_HOURS);
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
        notified: notified ? dueTasks.length : 0
      }
    });

    return {
      status: extraction.status,
      tasksSeen: extraction.tasks.length,
      tasksUpserted: upserted.length,
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
  try {
    const tasks = await scrapeMoodleTasks(config);
    return { status: "success" as const, tasks, primarySource: "playwright", errorMessage: null };
  } catch (error) {
    if (!config.MOODLE_ICS_URL) {
      throw error;
    }

    const tasks = await fetchIcsTasks(config.MOODLE_ICS_URL);
    return {
      status: "partial" as const,
      tasks,
      primarySource: "ics",
      errorMessage: error instanceof Error ? error.message : "Playwright failed; ICS fallback used"
    };
  }
}

