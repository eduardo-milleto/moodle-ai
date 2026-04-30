import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";

export const sessionCookieName = "moodle_ai_session";

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export function createSessionToken() {
  const password = getRequiredEnv("DASHBOARD_PASSWORD");
  const secret = getRequiredEnv("SESSION_SECRET");

  return createHmac("sha256", secret).update(password).digest("hex");
}

export function isValidPassword(input: string) {
  const expected = getRequiredEnv("DASHBOARD_PASSWORD");
  const a = Buffer.from(input);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAuthed() {
  const token = (await cookies()).get(sessionCookieName)?.value;

  return token === createSessionToken();
}

export async function requireAuth() {
  if (!(await isAuthed())) {
    redirect("/login");
  }
}

