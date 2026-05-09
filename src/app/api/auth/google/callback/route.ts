import { NextResponse } from "next/server";
import {
  BASECAMP_GOOGLE_OAUTH_STATE_COOKIE,
  exchangeGoogleCodeForProfile,
  googleOAuthAppUrl,
  googleOAuthErrorSummary,
  googleOAuthNativeCallbackUrl,
  isNativeGoogleOAuthReturnTo,
  verifyGoogleOAuthState
} from "@/lib/googleAuth";
import {
  BASECAMP_AUTH_COOKIE,
  createFounderAuthSession,
  registerFounderUser
} from "@/lib/sessionStore";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const nonce = cookieValue(request.headers.get("cookie"), BASECAMP_GOOGLE_OAUTH_STATE_COOKIE);
  const fallbackRedirect = googleOAuthAppUrl("/profile?auth=google_error", request.url);
  let verifiedReturnTo: string | null = null;

  try {
    if (!code) throw new Error("Google did not return an authorization code.");
    const verifiedState = verifyGoogleOAuthState(state, nonce);
    verifiedReturnTo = verifiedState.returnTo;
    const profile = await exchangeGoogleCodeForProfile({ code, requestUrl: request.url });
    const user = registerFounderUser({
      name: profile.name,
      email: profile.email,
      provider: "google",
      avatarUrl: profile.avatarUrl
    });
    const { token, expiresAt } = createFounderAuthSession(user.id);
    const redirectTarget = isNativeGoogleOAuthReturnTo(verifiedState.returnTo)
      ? googleOAuthNativeCallbackUrl(verifiedState.returnTo, { token, expiresAt, userId: user.id })
      : googleOAuthAppUrl(verifiedState.returnTo, request.url);
    const response = NextResponse.redirect(redirectTarget);
    response.cookies.set(BASECAMP_AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(expiresAt)
    });
    clearGoogleStateCookie(response);
    return response;
  } catch (error) {
    console.warn("Google OAuth callback failed", googleOAuthErrorSummary(error));
    const redirectTarget =
      verifiedReturnTo && isNativeGoogleOAuthReturnTo(verifiedReturnTo)
        ? googleOAuthNativeCallbackUrl(verifiedReturnTo, { error: "google_error" })
        : fallbackRedirect;
    const response = NextResponse.redirect(redirectTarget);
    clearGoogleStateCookie(response);
    return response;
  }
}

function clearGoogleStateCookie(response: NextResponse) {
  response.cookies.set(BASECAMP_GOOGLE_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 0
  });
}

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  for (const cookie of cookies) {
    const [cookieName, ...valueParts] = cookie.split("=");
    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return null;
}
