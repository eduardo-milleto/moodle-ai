import OpenAI from "openai";
import { z } from "zod";
import { extractedTaskSchema, type ExtractedTask } from "../types";

const agentOutputSchema = z.object({
  tasks: z.array(extractedTaskSchema)
});

export async function extractTasksWithAgent({
  apiKey,
  model,
  course,
  pageText,
  links
}: {
  apiKey: string;
  model: string;
  course: string;
  pageText: string;
  links: Array<{ text: string; href: string }>;
}): Promise<ExtractedTask[]> {
  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Extraia tarefas acadêmicas do Moodle. Retorne somente JSON no formato {\"tasks\": [...]}. Não invente tarefas. Use ISO datetime com timezone quando houver prazo claro."
      },
      {
        role: "user",
        content: JSON.stringify({
          course,
          pageText,
          links,
          taskShape: {
            source: "moodle",
            externalId: "string opcional",
            course: "string",
            title: "string",
            dueAt: "ISO datetime ou null",
            moodleStatus: "pending | submitted | graded | overdue | unknown",
            link: "url ou null",
            raw: {}
          }
        })
      }
    ]
  });

  const content = completion.choices[0]?.message.content;

  if (!content) {
    return [];
  }

  return agentOutputSchema.parse(JSON.parse(content)).tasks;
}

