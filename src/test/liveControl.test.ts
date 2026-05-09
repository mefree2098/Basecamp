import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { authorizeBasecampLiveRequest, updateBasecampRuntimeEnv } from "@/lib/liveControl";

const previousToken = process.env.BASECAMP_CODEX_TOKEN;
const previousEnvFile = process.env.BASECAMP_ENV_FILE;

afterEach(() => {
  if (previousToken === undefined) {
    delete process.env.BASECAMP_CODEX_TOKEN;
  } else {
    process.env.BASECAMP_CODEX_TOKEN = previousToken;
  }
  delete process.env.BASECAMP_LIVE_TOKEN;
  if (previousEnvFile === undefined) {
    delete process.env.BASECAMP_ENV_FILE;
  } else {
    process.env.BASECAMP_ENV_FILE = previousEnvFile;
  }
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

describe("Basecamp live control runtime env updates", () => {
  it("updates only allowlisted env keys and redacts secret previews", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "basecamp-live-env-"));
    process.env.BASECAMP_ENV_FILE = path.join(dir, ".env.production");
    fs.writeFileSync(
      process.env.BASECAMP_ENV_FILE,
      "BASECAMP_PUBLIC_URL=https://old.example\nUNCHANGED=value\n",
      "utf8"
    );

    const result = updateBasecampRuntimeEnv("env-update", {
      BASECAMP_PUBLIC_URL: "https://basecamp.ntechr.com",
      BASECAMP_AUTH_SECRET: "generated-secret-value"
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    if (result.ok && "values" in result.body && result.body.values) {
      expect(result.body.values.BASECAMP_AUTH_SECRET).toBe("gene...alue");
    }
    const envFile = fs.readFileSync(process.env.BASECAMP_ENV_FILE, "utf8");
    expect(envFile).toContain("BASECAMP_PUBLIC_URL=https://basecamp.ntechr.com");
    expect(envFile).toContain("BASECAMP_AUTH_SECRET=generated-secret-value");
    expect(envFile).toContain("UNCHANGED=value");
  });

  it("rejects unknown env keys", () => {
    const result = updateBasecampRuntimeEnv("env-update", {
      DATABASE_URL: "postgres://example"
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });
});
