import { NextResponse } from "next/server";
import {
  BASECAMP_AUTH_COOKIE,
  deleteAuthSession,
  readAuthTokenFromCookieHeader
} from "@/lib/sessionStore";

export function POST(request: Request) {
  const token = readAuthTokenFromCookieHeader(request.headers.get("cookie"));
  deleteAuthSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(BASECAMP_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  });
  return response;
}
