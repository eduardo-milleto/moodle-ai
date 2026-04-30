import { listActivePendingTasks, type Task } from "@moodle-ai/db";

const telegramDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short"
});

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

  const lines = tasks.map(formatTaskLine);

  const text = ["Tarefas vencendo em breve:", ...lines].join("\n\n");
  await sendTelegramMessage({ botToken, chatId, text });

  return true;
}

export async function sendTelegramNewTaskDigest({
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

  const lines = tasks.map(formatTaskLine);
  const text = ["Novas tarefas encontradas:", ...lines].join("\n\n");
  await sendTelegramMessage({ botToken, chatId, text });

  return true;
}

export function startTelegramCommandPolling({
  botToken,
  chatId
}: {
  botToken?: string;
  chatId?: string;
}) {
  if (!botToken || !chatId) {
    return () => undefined;
  }

  const token = botToken;
  const targetChatId = chatId;
  let stopped = false;
  let offset: number | undefined;

  async function poll() {
    try {
      const initialUpdates = await getTelegramUpdates({ botToken: token, timeout: 0 });
      offset = getNextOffset(initialUpdates);
    } catch (error) {
      console.error("Telegram command bootstrap failed", error);
    }

    while (!stopped) {
      try {
        const updates = await getTelegramUpdates({ botToken: token, offset, timeout: 25 });
        offset = getNextOffset(updates, offset);

        for (const update of updates) {
          const message = update.message;
          if (!message || String(message.chat.id) !== targetChatId) {
            continue;
          }

          const textCommand = message.text?.trim().split(/\s+/, 1)[0];
          const command = textCommand?.split("@", 1)[0]?.toLowerCase();
          if (command === "/tarefas") {
            const tasks = await listActivePendingTasks();
            await sendTelegramTaskList({ botToken: token, chatId: targetChatId, tasks });
          }
        }
      } catch (error) {
        console.error("Telegram command polling failed", error);
        await delay(5000);
      }
    }
  }

  void poll();

  return () => {
    stopped = true;
  };
}

async function sendTelegramTaskList({
  botToken,
  chatId,
  tasks
}: {
  botToken: string;
  chatId: string;
  tasks: Task[];
}) {
  const visibleTasks = tasks.slice(0, 20);

  if (visibleTasks.length === 0) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text: "Nenhuma tarefa em andamento e não vencida no momento."
    });
    return;
  }

  const suffix = tasks.length > visibleTasks.length ? `\n\nMostrando ${visibleTasks.length} de ${tasks.length}.` : "";
  await sendTelegramMessage({
    botToken,
    chatId,
    text: ["Tarefas em andamento:", ...visibleTasks.map(formatTaskLine)].join("\n\n") + suffix
  });
}

async function sendTelegramMessage({
  botToken,
  chatId,
  text
}: {
  botToken: string;
  chatId: string;
  text: string;
}) {
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
    throw new Error(`Telegram message failed with ${response.status}`);
  }
}

async function getTelegramUpdates({
  botToken,
  offset,
  timeout
}: {
  botToken: string;
  offset?: number;
  timeout: number;
}) {
  const params = new URLSearchParams({
    timeout: String(timeout),
    allowed_updates: JSON.stringify(["message"])
  });

  if (offset !== undefined) {
    params.set("offset", String(offset));
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Telegram updates failed with ${response.status}`);
  }

  const payload = (await response.json()) as TelegramUpdatesResponse;
  if (!payload.ok) {
    throw new Error("Telegram updates returned ok=false");
  }

  return payload.result;
}

function getNextOffset(updates: TelegramUpdate[], fallback?: number) {
  if (updates.length === 0) {
    return fallback;
  }

  return Math.max(...updates.map((update) => update.update_id)) + 1;
}

function formatTaskLine(task: Task) {
  const due = task.dueAt ? telegramDateFormatter.format(task.dueAt) : "sem prazo";
  const link = task.link ? `\n${task.link}` : "";
  return `• ${task.title}\n${task.course} · ${due}${link}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type TelegramUpdatesResponse = {
  ok: boolean;
  result: TelegramUpdate[];
};

type TelegramUpdate = {
  update_id: number;
  message?: {
    text?: string;
    chat: {
      id: number | string;
    };
  };
};
