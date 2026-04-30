import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, isValidPassword, sessionCookieName } from "@/lib/auth";

const loginSchema = z.object({
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success || !isValidPassword(parsed.data.password)) {
    return NextResponse.json({ error: "Senha inválida" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}

