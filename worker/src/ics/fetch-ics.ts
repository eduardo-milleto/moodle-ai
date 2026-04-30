import ical from "node-ical";
import type { ExtractedTask } from "../types";

type CalendarEvent = {
  type?: string;
  summary?: unknown;
  start?: unknown;
  description?: unknown;
  uid?: unknown;
  url?: unknown;
  location?: unknown;
};

export async function fetchIcsTasks(icsUrl: string): Promise<ExtractedTask[]> {
  const response = await fetch(icsUrl);

  if (!response.ok) {
    throw new Error(`ICS request failed with ${response.status}`);
  }

  const body = await response.text();
  const parsed = ical.sync.parseICS(body);
  const tasks: ExtractedTask[] = [];

  for (const event of Object.values(parsed) as CalendarEvent[]) {
    if (event.type !== "VEVENT") {
      continue;
    }

    const title = String(event.summary ?? "").trim();

    if (!title) {
      continue;
    }

    const dueAt = event.start instanceof Date ? event.start.toISOString() : null;
    const course = inferCourse(title, String(event.description ?? ""));

    tasks.push({
      source: "ics",
      externalId: String(event.uid ?? `${course}:${title}:${dueAt ?? ""}`),
      course,
      title,
      dueAt,
      moodleStatus: "pending",
      link: event.url ? String(event.url) : null,
      raw: {
        uid: event.uid,
        description: event.description,
        location: event.location
      }
    });
  }

  return tasks;
}

function inferCourse(title: string, description: string) {
  const bracket = title.match(/\[([^\]]+)\]/);

  if (bracket?.[1]) {
    return bracket[1].trim();
  }

  const descriptionCourse = description.match(/(?:course|disciplina|curso):\s*(.+)/i);

  if (descriptionCourse?.[1]) {
    return descriptionCourse[1].split("\n")[0]?.trim() || "Moodle";
  }

  return "Moodle";
}
