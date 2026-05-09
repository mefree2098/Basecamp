import { afterEach, describe, expect, it } from "vitest";
import { authorizeBasecampLiveRequest } from "@/lib/liveControl";

const previousToken = process.env.BASECAMP_CODEX_TOKEN;

afterEach(() => {
  if (previousToken === undefined) {
    delete process.env.BASECAMP_CODEX_TOKEN;
  } else {
    process.env.BASECAMP_CODEX_TOKEN = previousToken;
  }
  delete process.env.BASECAMP_LIVE_TOKEN;
});

describe("Basecamp live control auth", () => {
  it("requires a configured live token", () => {
    delete process.env.BASECAMP_CODEX_TOKEN;
    const result = authorizeBasecampLiveRequest(new Request("https://basecamp.example/api/codex/live/overview"));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });

  it("accepts the configured bearer token", () => {
    process.env.BASECAMP_CODEX_TOKEN = "test-token";
    const result = authorizeBasecampLiveRequest(
      new Request("https://basecamp.example/api/codex/live/overview", {
        headers: { Authorization: "Bearer test-token" }
      })
    );

    expect(result.ok).toBe(true);
  });

  it("rejects an incorrect bearer token", () => {
    process.env.BASECAMP_CODEX_TOKEN = "test-token";
    const result = authorizeBasecampLiveRequest(
      new Request("https://basecamp.example/api/codex/live/overview", {
        headers: { Authorization: "Bearer wrong-token" }
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});
