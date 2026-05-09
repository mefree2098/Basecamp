import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const BASECAMP_NATIVE_GOOGLE_CALLBACK_URL = "basecamputah://auth/google";

export const BASECAMP_GOOGLE_OAUTH_STATE_COOKIE = "basecamp.google_oauth_state";

type GoogleOAuthStatePayload = {
  nonce: string;
  issuedAt: number;
  returnTo: string;
};

type GoogleOAuthRequest = {
  authorizationUrl: URL;
  nonce: string;
  state: string;
  expiresAt: Date;
};

type GoogleTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
};

type GoogleUserInfoResponse = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export class GoogleOAuthError extends Error {
  status?: number;
  code?: string;
  description?: string;

  constructor(message: string, options?: { status?: number; code?: string; description?: string }) {
    super(message);
    this.name = "GoogleOAuthError";
    this.status = options?.status;
    this.code = options?.code;
    this.description = options?.description;
  }
}

export type GoogleFounderProfile = {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
};

export function createGoogleOAuthRequest({
  requestUrl,
  returnTo
}: {
  requestUrl: string;
  returnTo?: string | null;
}): GoogleOAuthRequest {
  const nonce = randomUUID();
  const safeReturnTo = normalizeReturnTo(returnTo);
  const state = createGoogleOAuthState({ nonce, returnTo: safeReturnTo });
  const authorizationUrl = new URL(GOOGLE_AUTH_URL);
  authorizationUrl.searchParams.set("client_id", googleClientId());
  authorizationUrl.searchParams.set("redirect_uri", googleOAuthRedirectUri(requestUrl));
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("access_type", "online");
  authorizationUrl.searchParams.set("prompt", "select_account");

  return {
    authorizationUrl,
    nonce,
    state,
    expiresAt: new Date(Date.now() + GOOGLE_OAUTH_STATE_TTL_MS)
  };
}

export function verifyGoogleOAuthState(state: string | null | undefined, nonce: string | null | undefined) {
  if (!state || !nonce) {
    throw new Error("Google sign-in state is missing.");
  }

  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature || !signatureMatches(encodedPayload, signature)) {
    throw new Error("Google sign-in state could not be verified.");
  }

  const payload = parseStatePayload(encodedPayload);
  if (payload.nonce !== nonce) {
    throw new Error("Google sign-in state does not match this browser session.");
  }
  if (Date.now() - payload.issuedAt > GOOGLE_OAUTH_STATE_TTL_MS) {
    throw new Error("Google sign-in state has expired.");
  }

  return {
    ...payload,
    returnTo: normalizeReturnTo(payload.returnTo)
  };
}

export function googleOAuthAppUrl(path: string, requestUrl: string) {
  return new URL(path, publicBaseUrl(requestUrl));
}

export function isNativeGoogleOAuthReturnTo(returnTo: string) {
  try {
    const url = new URL(returnTo);
    return url.protocol === "basecamputah:" && url.host === "auth" && url.pathname === "/google";
  } catch {
    return false;
  }
}

export function googleOAuthNativeCallbackUrl(
  returnTo: string,
  result:
    | { token: string; expiresAt: string; userId: string; error?: never }
    | { error: string; token?: never; expiresAt?: never; userId?: never }
) {
  const url = new URL(isNativeGoogleOAuthReturnTo(returnTo) ? returnTo : BASECAMP_NATIVE_GOOGLE_CALLBACK_URL);
  url.search = "";
  if (typeof result.error === "string") {
    url.searchParams.set("error", result.error);
  } else {
    url.searchParams.set("token", result.token);
    url.searchParams.set("expiresAt", result.expiresAt);
    url.searchParams.set("userId", result.userId);
  }
  return url;
}

export async function exchangeGoogleCodeForProfile({
  code,
  requestUrl
}: {
  code: string;
  requestUrl: string;
}): Promise<GoogleFounderProfile> {
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      redirect_uri: googleOAuthRedirectUri(requestUrl),
      grant_type: "authorization_code"
    })
  });
  const tokenPayload = (await readJson(tokenResponse)) as GoogleTokenResponse | { error?: string };
  if (!tokenResponse.ok || !("access_token" in tokenPayload) || !tokenPayload.access_token) {
    throw new GoogleOAuthError("Google token exchange failed.", {
      status: tokenResponse.status,
      code: "error" in tokenPayload ? tokenPayload.error : undefined,
      description:
        "error_description" in tokenPayload && typeof tokenPayload.error_description === "string"
          ? tokenPayload.error_description
          : undefined
    });
  }

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    cache: "no-store"
  });
  const profile = (await readJson(userInfoResponse)) as GoogleUserInfoResponse;
  if (!userInfoResponse.ok || !profile.sub || !profile.email || !profile.email_verified) {
    throw new GoogleOAuthError("Google did not return a verified email profile.", {
      status: userInfoResponse.status
    });
  }

  return {
    googleId: profile.sub,
    email: profile.email,
    name: profile.name?.trim() || fallbackNameFromEmail(profile.email),
    avatarUrl: profile.picture
  };
}

export function googleOAuthErrorSummary(error: unknown) {
  if (error instanceof GoogleOAuthError) {
    return {
      message: error.message,
      status: error.status,
      code: error.code,
      description: error.description
    };
  }
  return {
    message: error instanceof Error ? error.message : "Google OAuth failed."
  };
}

export function googleOAuthRedirectUri(requestUrl: string) {
  return `${publicBaseUrl(requestUrl)}/api/auth/google/callback`;
}

export function googleOAuthConfigStatus() {
  const publicUrl = publicBaseUrl(null);
  const hasClientId = Boolean(readEnv("GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID", "BASECAMP_GOOGLE_CLIENT_ID"));
  const hasClientSecret = Boolean(
    readEnv("GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET", "BASECAMP_GOOGLE_CLIENT_SECRET")
  );
  const hasAuthSecret = Boolean(readEnv("BASECAMP_AUTH_SECRET"));
  return {
    configured: Boolean(publicUrl && hasClientId && hasClientSecret && hasAuthSecret),
    publicUrl,
    hasClientId,
    hasClientSecret,
    hasAuthSecret
  };
}

function createGoogleOAuthState({ nonce, returnTo }: { nonce: string; returnTo: string }) {
  const payload: GoogleOAuthStatePayload = {
    nonce,
    returnTo,
    issuedAt: Date.now()
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signStatePayload(encodedPayload)}`;
}

function parseStatePayload(encodedPayload: string): GoogleOAuthStatePayload {
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<GoogleOAuthStatePayload>;
    if (typeof payload.nonce !== "string" || typeof payload.issuedAt !== "number") {
      throw new Error("Invalid state payload.");
    }
    return {
      nonce: payload.nonce,
      issuedAt: payload.issuedAt,
      returnTo: typeof payload.returnTo === "string" ? payload.returnTo : "/profile"
    };
  } catch {
    throw new Error("Google sign-in state could not be read.");
  }
}

function signStatePayload(encodedPayload: string) {
  return createHmac("sha256", authSecret()).update(encodedPayload).digest("base64url");
}

function signatureMatches(encodedPayload: string, signature: string) {
  const expected = signStatePayload(encodedPayload);
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

function publicBaseUrl(requestUrl: string | null) {
  const configured = readEnv("BASECAMP_PUBLIC_URL");
  if (configured) return configured.replace(/\/+$/, "");
  if (requestUrl) return new URL(requestUrl).origin.replace(/\/+$/, "");
  return "";
}

function googleClientId() {
  const value = readEnv("GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID", "BASECAMP_GOOGLE_CLIENT_ID");
  if (!value) throw new Error("Google OAuth client ID is not configured.");
  return value;
}

function googleClientSecret() {
  const value = readEnv("GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET", "BASECAMP_GOOGLE_CLIENT_SECRET");
  if (!value) throw new Error("Google OAuth client secret is not configured.");
  return value;
}

function authSecret() {
  const value = readEnv("BASECAMP_AUTH_SECRET");
  if (!value || value === "long-random-secret") {
    throw new Error("BASECAMP_AUTH_SECRET is not configured.");
  }
  return value;
}

function normalizeReturnTo(value: string | null | undefined) {
  if (!value) return "/profile";
  try {
    if (isNativeGoogleOAuthReturnTo(value)) return BASECAMP_NATIVE_GOOGLE_CALLBACK_URL;
    if (!value.startsWith("/") || value.startsWith("//")) return "/profile";
    const parsed = new URL(value, "https://basecamp.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/profile";
  } catch {
    return "/profile";
  }
}

function fallbackNameFromEmail(email: string) {
  const localPart = email.split("@")[0] || "Founder";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
