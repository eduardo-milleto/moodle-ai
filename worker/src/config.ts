import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  MOODLE_BASE_URL: z.string().url().default("https://moodle.unisinos.br"),
  MOODLE_USERNAME: z.string().optional(),
  MOODLE_PASSWORD: z.string().optional(),
  MOODLE_ICS_URL: z.string().url().optional().or(z.literal("")),
  SYNC_CRON: z.string().default("0 */6 * * *"),
  SYNC_ON_START: z.coerce.boolean().default(true),
  NOTIFY_DUE_HOURS: z.coerce.number().int().positive().default(48),
  AGENT_ENABLED: z.coerce.boolean().default(false),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional()
});

export type WorkerConfig = z.infer<typeof envSchema>;

export function getConfig() {
  const config = envSchema.parse(process.env);

  if (config.AGENT_ENABLED && !config.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when AGENT_ENABLED=true");
  }

  return config;
}

