import { describe, expect, it } from "vitest";
import {
  normalizeCodexAccount,
  normalizeCodexModelList,
  validateCodexCallbackUrl
} from "@/lib/codex/appServer";

describe("validateCodexCallbackUrl", () => {
  it("accepts local Codex callbacks with an auth token", () => {
    const callback = validateCodexCallbackUrl("http://localhost:1455/success?id_token=test");

    expect(callback.hostname).toBe("localhost");
    expect(callback.searchParams.get("id_token")).toBe("test");
  });

  it("rejects non-local callback URLs", () => {
    expect(() => validateCodexCallbackUrl("https://example.com/success?id_token=test")).toThrow(
      /localhost/
    );
  });

  it("rejects callbacks without the login token", () => {
    expect(() => validateCodexCallbackUrl("http://127.0.0.1:1455/success")).toThrow(
      /login token/
    );
  });
});

describe("normalizeCodexAccount", () => {
  it("treats current Codex nested account responses as authenticated", () => {
    expect(
      normalizeCodexAccount({
        account: {
          type: "chatgpt",
          email: "founder@example.com",
          planType: "team"
        },
        requiresOpenaiAuth: true
      })
    ).toEqual({
      authenticated: true,
      requiresOpenaiAuth: true,
      accountEmail: "founder@example.com",
      planType: "team",
      accountType: "chatgpt"
    });
  });

  it("keeps legacy authenticated responses working", () => {
    expect(
      normalizeCodexAccount({
        authenticated: true,
        accountEmail: "founder@example.com",
        planType: "pro"
      }).authenticated
    ).toBe(true);
  });
});

describe("normalizeCodexModelList", () => {
  it("reads the current Codex data response shape", () => {
    expect(
      normalizeCodexModelList({
        data: [
          { id: "gpt-5.5", model: "gpt-5.5", hidden: false },
          { id: "hidden-model", hidden: true },
          { model: "gpt-5.4", hidden: false }
        ]
      })
    ).toEqual(["gpt-5.5", "gpt-5.4"]);
  });

  it("keeps legacy model list responses working", () => {
    expect(normalizeCodexModelList({ models: ["gpt-5.3-codex"] })).toEqual(["gpt-5.3-codex"]);
  });
});
