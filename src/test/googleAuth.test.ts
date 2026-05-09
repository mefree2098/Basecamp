import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createGoogleOAuthRequest,
  googleOAuthAppUrl,
  googleOAuthConfigStatus,
  googleOAuthRedirectUri,
  verifyGoogleOAuthState
} from "@/lib/googleAuth";

const envKeys = [
  "BASECAMP_PUBLIC_URL",
  "BASECAMP_AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "BASECAMP_GOOGLE_CLIENT_ID",
  "BASECAMP_GOOGLE_CLIENT_SECRET"
] as const;

const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

beforeEach(() => {
  process.env.BASECAMP_PUBLIC_URL = "https://basecamp.example";
  process.env.BASECAMP_AUTH_SECRET = "test-auth-secret-with-enough-entropy";
  process.env.GOOGLE_CLIENT_ID = "client.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
});

afterEach(() => {
  for (const key of envKeys) {
    const value = previousEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("Google OAuth helpers", () => {
  it("builds a Google authorization URL using the configured public URL", () => {
    const request = createGoogleOAuthRequest({
      requestUrl: "http://127.0.0.1:4302/api/auth/google/start",
      returnTo: "/profile?tab=settings"
    });

    expect(request.authorizationUrl.origin).toBe("https://accounts.google.com");
    expect(request.authorizationUrl.searchParams.get("client_id")).toBe("client.apps.googleusercontent.com");
    expect(request.authorizationUrl.searchParams.get("redirect_uri")).toBe(
      "https://basecamp.example/api/auth/google/callback"
    );
    expect(request.authorizationUrl.searchParams.get("scope")).toContain("email");

    expect(verifyGoogleOAuthState(request.state, request.nonce).returnTo).toBe("/profile?tab=settings");
  });

  it("rejects a tampered state value", () => {
    const request = createGoogleOAuthRequest({
      requestUrl: "https://basecamp.example/api/auth/google/start",
      returnTo: "/profile"
    });

    expect(() => verifyGoogleOAuthState(`${request.state}tampered`, request.nonce)).toThrow(
      "Google sign-in state could not be verified."
    );
  });

  it("normalizes unsafe return paths", () => {
    const request = createGoogleOAuthRequest({
      requestUrl: "https://basecamp.example/api/auth/google/start",
      returnTo: "//evil.example/callback"
    });

    expect(verifyGoogleOAuthState(request.state, request.nonce).returnTo).toBe("/profile");
  });

  it("reports missing config without exposing values", () => {
    delete process.env.GOOGLE_CLIENT_SECRET;

    expect(googleOAuthConfigStatus()).toMatchObject({
      configured: false,
      hasClientId: true,
      hasClientSecret: false,
      hasAuthSecret: true
    });
  });

  it("falls back to the request origin only when no public URL is configured", () => {
    delete process.env.BASECAMP_PUBLIC_URL;

    expect(googleOAuthRedirectUri("https://preview.example/api/auth/google/start")).toBe(
      "https://preview.example/api/auth/google/callback"
    );
  });

  it("builds post-auth redirects from the configured public URL", () => {
    expect(googleOAuthAppUrl("/profile?auth=google_error", "https://localhost:4302/api/auth/google/callback").href).toBe(
      "https://basecamp.example/profile?auth=google_error"
    );
  });
});
