import { NextResponse } from "next/server";
import {
  BASECAMP_GOOGLE_OAUTH_STATE_COOKIE,
  createGoogleOAuthRequest,
  googleOAuthConfigStatus
} from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = googleOAuthConfigStatus();
  if (!config.configured) {
    return NextResponse.json(
      {
        error: "Google sign-in is not configured.",
        config: {
          hasPublicUrl: Boolean(config.publicUrl),
          hasClientId: config.hasClientId,
          hasClientSecret: config.hasClientSecret,
          hasAuthSecret: config.hasAuthSecret
        }
      },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const authRequest = createGoogleOAuthRequest({
    requestUrl: request.url,
    returnTo: url.searchParams.get("returnTo")
  });
  const response = NextResponse.redirect(authRequest.authorizationUrl);
  response.cookies.set(BASECAMP_GOOGLE_OAUTH_STATE_COOKIE, authRequest.nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    expires: authRequest.expiresAt
  });
  return response;
}
