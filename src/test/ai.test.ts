import { describe, expect, it } from "vitest";
import { listModels } from "@/lib/ai";

describe("AI model catalog", () => {
  it("returns local and provider fallback options", async () => {
    const models = await listModels({ provider: "mock" });
    expect(models.some((model) => model.id === "basecamp-local-guide")).toBe(true);
    expect(models.some((model) => model.provider === "openai")).toBe(true);
  });
});
