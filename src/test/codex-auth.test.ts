import { describe, expect, it } from "vitest";
import { validateCodexCallbackUrl } from "@/lib/codex/appServer";

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
