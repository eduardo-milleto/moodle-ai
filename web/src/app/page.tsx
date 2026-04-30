import { getLatestSyncRuns, listCourses, listTasks } from "@moodle-ai/db";
import { Dashboard } from "@/components/dashboard";
import { requireAuth } from "@/lib/auth";
import { serializeSyncRun, serializeTask } from "@/lib/serializers";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireAuth();

  const [tasks, courses, syncRuns] = await Promise.all([listTasks(), listCourses(), getLatestSyncRuns(5)]);

  return (
    <Dashboard
      initialTasks={tasks.map(serializeTask)}
      courses={courses}
      syncRuns={syncRuns.map(serializeSyncRun)}
      generatedAt={new Date().toISOString()}
    />
  );
}
