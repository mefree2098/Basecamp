import { spawn, spawnSync } from "node:child_process";
import { timingSafeEqual, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readRuntimeHealth } from "./runtimeHealth";

type CommandResult = {
  ok: boolean;
  command: string;
  stdout: string;
  stderr: string;
  status: number | null;
  error?: string;
};

const ALLOWED_ENV_UPDATE_KEYS = [
  "BASECAMP_PUBLIC_URL",
  "BASECAMP_AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "BASECAMP_GOOGLE_CLIENT_ID",
  "BASECAMP_GOOGLE_CLIENT_SECRET"
] as const;

export function authorizeBasecampLiveRequest(request: Request) {
  const configuredToken = liveToken();
  if (!configuredToken) {
    return {
      ok: false as const,
      status: 503,
      body: { error: "Basecamp live control token is not configured." }
    };
  }

  const suppliedToken = tokenFromRequest(request);
  if (!suppliedToken || !tokensMatch(suppliedToken, configuredToken)) {
    return {
      ok: false as const,
      status: 401,
      body: { error: "Invalid Basecamp live control token." }
    };
  }

  return { ok: true as const };
}

export function readBasecampLiveOverview() {
  return {
    generatedAt: new Date().toISOString(),
    health: readRuntimeHealth(),
    runtime: {
      cwd: deployCwd(),
      pid: process.pid,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.round(process.uptime()),
      hostname: os.hostname()
    },
    host: {
      uptimeSeconds: Math.round(os.uptime()),
      loadAverage: os.loadavg(),
      totalMemoryBytes: os.totalmem(),
      freeMemoryBytes: os.freemem(),
      cpuCount: os.cpus().length
    },
    process: process.memoryUsage(),
    git: readGitState(),
    deploy: readBasecampDeployStatus()
  };
}

export function readBasecampDeployStatus() {
  return readJsonFile(deployStatusPath()) ?? {
    running: false,
    status: "idle",
    logPath: deployLogPath()
  };
}

export function readBasecampLogs({ lines = 120, unit }: { lines?: number; unit?: string }) {
  const safeLines = Math.max(1, Math.min(1000, Math.round(lines)));
  const service = serviceName();
  const requestedUnit = unit?.trim() || service;
  const allowedUnits = new Set([service, `${service}.service`]);
  if (!allowedUnits.has(requestedUnit)) {
    return {
      ok: false,
      error: `Unsupported log unit "${requestedUnit}".`,
      allowedUnits: Array.from(allowedUnits)
    };
  }

  const journal = runCommand("journalctl", ["-u", requestedUnit, "-n", String(safeLines), "--no-pager"], deployCwd(), 8000);
  return {
    ok: journal.ok,
    unit: requestedUnit,
    lines: safeLines,
    journal,
    deployLog: tailFile(deployLogPath(), safeLines)
  };
}

export function startBasecampDeploy(confirm?: string) {
  if (confirm !== "deploy") {
    return {
      ok: false,
      status: 400,
      body: { error: "Deploy requires confirm=deploy." }
    };
  }

  const currentStatus = readBasecampDeployStatus() as { running?: boolean };
  if (currentStatus.running) {
    return {
      ok: false,
      status: 409,
      body: { error: "A Basecamp deploy is already running.", job: currentStatus }
    };
  }

  const cwd = deployCwd();
  const runner = process.env.BASECAMP_DEPLOY_RUNNER_PATH || path.join(cwd, "scripts", "basecamp-live-deploy-runner.js");
  if (!fs.existsSync(runner)) {
    return {
      ok: false,
      status: 500,
      body: { error: `Deploy runner not found at ${runner}.` }
    };
  }

  fs.mkdirSync(liveControlDir(), { recursive: true });
  const job = {
    id: randomUUID(),
    running: true,
    status: "starting",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cwd,
    logPath: deployLogPath()
  };
  writeJsonFile(deployStatusPath(), job);
  fs.writeFileSync(deployLogPath(), `[${job.startedAt}] Starting Basecamp deploy ${job.id}\n`, "utf8");

  const child = spawn(process.execPath, [runner], {
    cwd,
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      BASECAMP_DEPLOY_ID: job.id,
      BASECAMP_DEPLOY_CWD: cwd,
      BASECAMP_DEPLOY_STATUS_PATH: deployStatusPath(),
      BASECAMP_DEPLOY_LOG_PATH: deployLogPath(),
      BASECAMP_SERVICE_NAME: serviceName()
    }
  });
  child.unref();

  return {
    ok: true,
    status: 202,
    body: { job }
  };
}

export function restartBasecampService(confirm?: string) {
  if (confirm !== "restart") {
    return {
      ok: false,
      status: 400,
      body: { error: "Service restart requires confirm=restart." }
    };
  }

  const result = scheduleSystemdRestart();
  return {
    ok: result.ok,
    status: result.ok ? 202 : 500,
    body: {
      scheduled: result.ok,
      service: serviceName(),
      result
    }
  };
}

export function updateBasecampRuntimeEnv(confirm?: string, updates?: Record<string, unknown>) {
  if (confirm !== "env-update") {
    return {
      ok: false,
      status: 400,
      body: { error: "Environment update requires confirm=env-update." }
    };
  }

  const normalizedUpdates = normalizeEnvUpdates(updates);
  if (!normalizedUpdates.ok) return normalizedUpdates;

  const envPath = runtimeEnvPath();
  let current = "";
  try {
    current = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  } catch (error) {
    return {
      ok: false,
      status: 500,
      body: { error: error instanceof Error ? error.message : "Could not read the runtime env file." }
    };
  }

  try {
    fs.mkdirSync(path.dirname(envPath), { recursive: true });
    const next = renderEnvFile(current, normalizedUpdates.updates);
    fs.writeFileSync(envPath, next, { encoding: "utf8", mode: 0o600 });
    fs.chmodSync(envPath, 0o600);
  } catch (error) {
    return {
      ok: false,
      status: 500,
      body: { error: error instanceof Error ? error.message : "Could not write the runtime env file." }
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      envFile: envPath,
      updatedKeys: Object.keys(normalizedUpdates.updates),
      values: Object.fromEntries(
        Object.entries(normalizedUpdates.updates).map(([key, value]) => [key, previewEnvValue(key, value)])
      )
    }
  };
}

function readGitState() {
  const cwd = deployCwd();
  const branch = runCommand("git", ["branch", "--show-current"], cwd);
  const commit = runCommand("git", ["rev-parse", "HEAD"], cwd);
  const status = runCommand("git", ["status", "--short"], cwd);
  const remote = runCommand("git", ["remote", "get-url", "origin"], cwd);
  return {
    available: branch.ok && commit.ok,
    branch: branch.stdout.trim(),
    commit: commit.stdout.trim(),
    shortCommit: commit.stdout.trim().slice(0, 7),
    dirty: status.stdout.trim().length > 0,
    changedFiles: status.stdout.trim().split("\n").filter(Boolean),
    origin: remote.stdout.trim(),
    errors: [branch, commit, status, remote].filter((item) => !item.ok).map((item) => item.error || item.stderr)
  };
}

function scheduleSystemdRestart() {
  const unitName = `${serviceName()}-manual-restart-${randomUUID().slice(0, 8)}`;
  return runCommand(
    "sudo",
    [
      "-n",
      "systemd-run",
      "--unit",
      unitName,
      "--description",
      `Restart ${serviceName()} after Basecamp live-control request`,
      "--on-active=2s",
      "--collect",
      "/usr/bin/systemctl",
      "restart",
      serviceName()
    ],
    deployCwd(),
    15000
  );
}

function runCommand(command: string, args: string[], cwd: string, timeoutMs = 5000): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024
  });
  return {
    ok: result.status === 0 && !result.error,
    command: [command, ...args].join(" "),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
    error: result.error?.message
  };
}

function deployCwd() {
  const explicitCwd = process.env.BASECAMP_DEPLOY_CWD?.trim();
  if (explicitCwd) return path.resolve(explicitCwd);
  return findRepoRoot(process.cwd()) ?? path.resolve(process.cwd());
}

function storageDir() {
  return path.resolve(process.env.BASECAMP_STORAGE_DIR || path.join(deployCwd(), ".basecamp-data"));
}

function liveControlDir() {
  return path.join(storageDir(), "live-control");
}

function deployStatusPath() {
  return process.env.BASECAMP_DEPLOY_STATUS_PATH || path.join(liveControlDir(), "deploy-status.json");
}

function deployLogPath() {
  return process.env.BASECAMP_DEPLOY_LOG_PATH || path.join(liveControlDir(), "deploy.log");
}

function runtimeEnvPath() {
  return process.env.BASECAMP_ENV_FILE || path.join(deployCwd(), ".env.production");
}

function serviceName() {
  return process.env.BASECAMP_SERVICE_NAME?.trim() || "basecamp";
}

function normalizeEnvUpdates(updates: Record<string, unknown> | undefined) {
  if (!updates || typeof updates !== "object") {
    return {
      ok: false as const,
      status: 400,
      body: { error: "Environment update requires an updates object." }
    };
  }

  const allowed = new Set<string>(ALLOWED_ENV_UPDATE_KEYS);
  const normalized: Record<string, string> = {};
  const rejected: string[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.has(key)) {
      rejected.push(key);
      continue;
    }
    if (typeof value !== "string") {
      return {
        ok: false as const,
        status: 400,
        body: { error: `Environment value for ${key} must be a string.` }
      };
    }
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return {
        ok: false as const,
        status: 400,
        body: { error: `Environment value for ${key} cannot be empty.` }
      };
    }
    if (trimmedValue.length > 4096 || /[\r\n]/.test(trimmedValue)) {
      return {
        ok: false as const,
        status: 400,
        body: { error: `Environment value for ${key} is not valid.` }
      };
    }
    normalized[key] = trimmedValue;
  }

  if (rejected.length > 0) {
    return {
      ok: false as const,
      status: 400,
      body: {
        error: "One or more environment keys cannot be changed through live control.",
        rejectedKeys: rejected,
        allowedKeys: ALLOWED_ENV_UPDATE_KEYS
      }
    };
  }

  if (Object.keys(normalized).length === 0) {
    return {
      ok: false as const,
      status: 400,
      body: { error: "No environment keys were provided." }
    };
  }

  return {
    ok: true as const,
    updates: normalized
  };
}

function renderEnvFile(current: string, updates: Record<string, string>) {
  const seen = new Set<string>();
  const lines = current ? current.split(/\r?\n/) : [];
  const rendered = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    const key = match?.[1];
    if (!key || !(key in updates)) return line;
    seen.add(key);
    return `${key}=${formatEnvValue(updates[key])}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) rendered.push(`${key}=${formatEnvValue(value)}`);
  }

  return `${rendered.join("\n").replace(/\n+$/, "")}\n`;
}

function formatEnvValue(value: string) {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function previewEnvValue(key: string, value: string) {
  if (/SECRET|TOKEN|PASS|KEY/i.test(key)) {
    return value.length <= 8 ? "configured" : `${value.slice(0, 4)}...${value.slice(-4)}`;
  }
  return value;
}

function liveToken() {
  return process.env.BASECAMP_CODEX_TOKEN?.trim() || process.env.BASECAMP_LIVE_TOKEN?.trim() || "";
}

function findRepoRoot(startDir: string) {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, ".git")) && fs.existsSync(path.join(current, "package.json"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function tokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || request.headers.get("x-basecamp-codex-token")?.trim() || "";
}

function tokensMatch(supplied: string, configured: string) {
  const suppliedBuffer = Buffer.from(supplied);
  const configuredBuffer = Buffer.from(configured);
  return suppliedBuffer.length === configuredBuffer.length && timingSafeEqual(suppliedBuffer, configuredBuffer);
}

function readJsonFile(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function tailFile(filePath: string, lines: number) {
  try {
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf8").split("\n").slice(-lines).join("\n");
  } catch {
    return "";
  }
}
