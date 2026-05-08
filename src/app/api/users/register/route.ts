import { NextResponse } from "next/server";
import { z } from "zod";
import {
  BASECAMP_AUTH_COOKIE,
  createFounderAuthSession,
  listFounderSessions,
  registerFounderUser
} from "@/lib/sessionStore";

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(160),
  provider: z.enum(["site", "google", "microsoft", "meta"]).default("site")
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Name and a valid email are required." }, { status: 400 });
  }

  const user = registerFounderUser(parsed.data);
  const { token, expiresAt } = createFounderAuthSession(user.id);
  const sessions = listFounderSessions(user.id).slice(0, 6);
  const response = NextResponse.json({ user, sessions });
  response.cookies.set(BASECAMP_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  });
  return response;
}
