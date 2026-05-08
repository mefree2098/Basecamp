import { NextResponse } from "next/server";
import {
  listUserNotifications,
  readAuthTokenFromCookieHeader,
  readFounderAuthSession
} from "@/lib/sessionStore";

export function GET(request: Request) {
  const token = readAuthTokenFromCookieHeader(request.headers.get("cookie"));
  const auth = readFounderAuthSession(token);
  if (!auth) {
    return NextResponse.json({ user: null, notifications: [], unreadCount: 0 });
  }

  const notifications = listUserNotifications(auth.user.id).slice(0, 12);
  return NextResponse.json({
    user: auth.user,
    notifications,
    unreadCount: notifications.filter((notification) => !notification.readAt).length
  });
}
