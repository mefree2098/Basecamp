import { NextResponse } from "next/server";
import { z } from "zod";
import type { AuthProviderId } from "@/lib/types";
import {
  BASECAMP_AUTH_COOKIE,
  createFounderAuthSession,
  listFounderSessions,
  listUserNotifications,
  registerFounderUser
} from "@/lib/sessionStore";

const providerSchema = z.enum(["site", "google", "microsoft", "meta"]);

const schema = z.object({
  provider: providerSchema.default("site"),
  name: z.string().max(80).optional(),
  email: z.string().email().max(160).optional(),
  avatarUrl: z.string().url().optional()
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
    return NextResponse.json({ error: "A valid account provider is required." }, { status: 400 });
  }

  const provider = parsed.data.provider;
  const profile = provider === "site" ? parsed.data : fallbackProviderProfile(provider, parsed.data);
  if (!profile.name?.trim() || !profile.email?.trim()) {
    return NextResponse.json({ error: "Name and a valid email are required." }, { status: 400 });
  }

  const user = registerFounderUser({
    name: profile.name,
    email: profile.email,
    provider,
    avatarUrl: profile.avatarUrl
  });
  const { token, expiresAt } = createFounderAuthSession(user.id);
  const notifications = listUserNotifications(user.id).slice(0, 12);
  const response = NextResponse.json({
    user,
    notifications,
    unreadCount: notifications.filter((notification) => !notification.readAt).length,
    sessions: listFounderSessions(user.id).slice(0, 6)
  });
  response.cookies.set(BASECAMP_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  });
  return response;
}

function fallbackProviderProfile(
  provider: AuthProviderId,
  input: { name?: string; email?: string; avatarUrl?: string }
) {
  if (input.name && input.email) return input;
  const labels: Record<AuthProviderId, string> = {
    site: "Founder",
    google: "Google Founder",
    microsoft: "Microsoft Founder",
    meta: "Meta Founder"
  };
  return {
    ...input,
    name: input.name || labels[provider],
    email: input.email || `founder.${provider}@startupstate.local`
  };
}
