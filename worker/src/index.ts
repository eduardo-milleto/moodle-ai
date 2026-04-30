import cron from "node-cron";
import { closeDb } from "@moodle-ai/db";
import { getConfig } from "./config";
import { syncMoodleTasks } from "./sync/sync-moodle";

const config = getConfig();
let running = false;

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
  await closeDb();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await closeDb();
  process.exit(0);
});

console.log(`Worker scheduled with cron "${config.SYNC_CRON}"`);

