import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkWritableStorage, readRuntimeHealth } from "@/lib/runtimeHealth";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("runtime health", () => {
  it("reports writable storage as ready", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "basecamp-health-"));
    tempDirs.push(dir);

    expect(checkWritableStorage(dir)).toEqual({
      writable: true,
      message: "Runtime storage is writable."
    });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it("reports storage failures without throwing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "basecamp-health-"));
    tempDirs.push(dir);
    const blockingFile = path.join(dir, "not-a-directory");
    fs.writeFileSync(blockingFile, "blocked", "utf8");

    const result = checkWritableStorage(path.join(blockingFile, "child"));

    expect(result.writable).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("keeps the public health payload small and non-secret", () => {
    const previousStorageDir = process.env.BASECAMP_STORAGE_DIR;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "basecamp-health-"));
    tempDirs.push(dir);
    process.env.BASECAMP_STORAGE_DIR = dir;

    try {
      const health = readRuntimeHealth();
      expect(health.ok).toBe(true);
      expect(health.service).toBe("basecamp");
      expect(health.checks.storage).toEqual({
        status: "ok",
        configured: true,
        writable: true,
        message: "Runtime storage is writable."
      });
      expect(JSON.stringify(health)).not.toContain(dir);
    } finally {
      if (previousStorageDir === undefined) {
        delete process.env.BASECAMP_STORAGE_DIR;
      } else {
        process.env.BASECAMP_STORAGE_DIR = previousStorageDir;
      }
    }
  });
});
