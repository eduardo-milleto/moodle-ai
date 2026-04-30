import cron from "node-cron";
import { closeDb } from "@moodle-ai/db";
import { getConfig } from "./config";
import { startTelegramCommandPolling } from "./notifications/telegram";
import { syncMoodleTasks } from "./sync/sync-moodle";

const config = getConfig();
let running = false;
const stopTelegramPolling = startTelegramCommandPolling({
  botToken: config.TELEGRAM_BOT_TOKEN,
  chatId: config.TELEGRAM_CHAT_ID
});

async function runSync() {
  if (running) {
    console.log("Sync already running; skipping this tick.");
    return;
  }

  running = true;

  try {
    const result = await syncMoodleTasks();
    console.log("Sync finished", result);
  } catch (error) {
    console.error("Sync failed", error);
  } finally {
    running = false;
  }
}

if (config.SYNC_ON_START) {
  void runSync();
}

cron.schedule(config.SYNC_CRON, () => {
  void runSync();
});

process.on("SIGTERM", async () => {
  stopTelegramPolling();
  await closeDb();
  process.exit(0);
});

process.on("SIGINT", async () => {
  stopTelegramPolling();
  await closeDb();
  process.exit(0);
});

console.log(`Worker scheduled with cron "${config.SYNC_CRON}"`);
