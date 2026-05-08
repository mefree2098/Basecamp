import fs from "node:fs";
import path from "node:path";

export type RuntimeHealth = {
  ok: boolean;
  service: "basecamp";
  status: "ok" | "degraded";
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    storage: {
      status: "ok" | "fail";
      configured: boolean;
      writable: boolean;
      message: string;
    };
  };
};

export function readRuntimeHealth(): RuntimeHealth {
  const storage = checkWritableStorage();
  const ok = storage.writable;

  return {
    ok,
    service: "basecamp",
    status: ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      storage: {
        status: storage.writable ? "ok" : "fail",
        configured: Boolean(process.env.BASECAMP_STORAGE_DIR?.trim()),
        writable: storage.writable,
        message: storage.message
      }
    }
  };
}

export function checkWritableStorage(storageDir = resolveStorageDir()) {
  try {
    fs.mkdirSync(storageDir, { recursive: true });
    const probeDir = fs.mkdtempSync(path.join(storageDir, ".healthcheck-"));
    const probePath = path.join(probeDir, "probe");
    fs.writeFileSync(probePath, `${Date.now()}\n`, "utf8");
    fs.rmSync(probeDir, { recursive: true, force: true });
    return {
      writable: true,
      message: "Runtime storage is writable."
    };
  } catch (error) {
    return {
      writable: false,
      message: error instanceof Error ? error.message : "Runtime storage is not writable."
    };
  }
}

function resolveStorageDir() {
  return path.resolve(process.cwd(), process.env.BASECAMP_STORAGE_DIR ?? ".basecamp-data");
}
