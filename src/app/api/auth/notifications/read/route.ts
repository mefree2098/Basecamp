import { NextResponse } from "next/server";
import { z } from "zod";
import {
  markUserNotificationsRead,
  readAuthTokenFromCookieHeader,
  readFounderAuthSession
} from "@/lib/sessionStore";

const schema = z.object({
  ids: z.array(z.string()).optional()
});

export async function POST(request: Request) {
  const token = readAuthTokenFromCookieHeader(request.headers.get("cookie"));
  const auth = readFounderAuthSession(token);
  if (!auth) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Notification ids must be an array." }, { status: 400 });
  }

  const notifications = markUserNotificationsRead(auth.user.id, parsed.data.ids).slice(0, 12);
  return NextResponse.json({
    notifications,
    unreadCount: notifications.filter((notification) => !notification.readAt).length
  });
}
