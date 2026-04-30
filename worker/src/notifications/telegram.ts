import type { Task } from "@moodle-ai/db";

export async function sendTelegramDueDigest({
  botToken,
  chatId,
  tasks
}: {
  botToken?: string;
  chatId?: string;
  tasks: Task[];
}) {
  if (!botToken || !chatId || tasks.length === 0) {
    return false;
  }

  const lines = tasks.map((task) => {
    const due = task.dueAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(task.dueAt) : "sem prazo";
    const link = task.link ? `\n${task.link}` : "";
    return `• ${task.title}\n${task.course} · ${due}${link}`;
  });

  const text = ["Tarefas vencendo em breve:", ...lines].join("\n\n");
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram notification failed with ${response.status}`);
  }

  return true;
}

