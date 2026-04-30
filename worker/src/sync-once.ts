import { closeDb } from "@moodle-ai/db";
import { syncMoodleTasks } from "./sync/sync-moodle";

try {
  const result = await syncMoodleTasks();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await closeDb();
}

