#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const jobId = process.env.BASECAMP_DEPLOY_ID || `${Date.now()}`;
const requestedCwd = path.resolve(process.env.BASECAMP_DEPLOY_CWD || process.cwd());
const cwd = resolveDeployCwd(requestedCwd);
const statusPath = path.resolve(
  process.env.BASECAMP_DEPLOY_STATUS_PATH || path.join(cwd, ".basecamp-data", "live-control", "deploy-status.json")
);
const logPath = path.resolve(
  process.env.BASECAMP_DEPLOY_LOG_PATH || path.join(cwd, ".basecamp-data", "live-control", "deploy.log")
);
const serviceName = process.env.BASECAMP_SERVICE_NAME || "basecamp";

const steps = [
  ["Fetch latest refs", "git", ["fetch", "origin", "main"]],
  ["Pull latest main", "git", ["pull", "--ff-only", "origin", "main"]],
  ["Install dependencies", "npm", ["ci", "--include=dev"]],
  ["Build production app", "npm", ["run", "build"]],
  ["Restart Basecamp service", "sudo", ["-n", "systemctl", "restart", serviceName]]
];

main();

function main() {
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  const startedAt = new Date().toISOString();
  writeStatus({ running: true, status: "running", currentStep: "starting", startedAt, updatedAt: startedAt });
  log(`[${startedAt}] Deploy ${jobId} running in ${cwd}`);

  try {
    for (const [label, command, args] of steps) {
      const stepStartedAt = new Date().toISOString();
      writeStatus({ running: true, status: "running", currentStep: label, updatedAt: stepStartedAt });
      log(`\n[${stepStartedAt}] ${label}`);
      run(command, args);
    }

    const completedAt = new Date().toISOString();
    writeStatus({ running: false, status: "completed", currentStep: "completed", completedAt, updatedAt: completedAt });
    log(`\n[${completedAt}] Deploy ${jobId} completed successfully.`);
  } catch (error) {
    const failedAt = new Date().toISOString();
    writeStatus({
      running: false,
      status: "failed",
      currentStep: "failed",
      error: error instanceof Error ? error.message : String(error),
      failedAt,
      updatedAt: failedAt
    });
    log(`\n[${failedAt}] Deploy ${jobId} failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function run(command, args) {
  log(`$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      npm_config_production: "false"
    },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });

  if (result.stdout) log(result.stdout.trimEnd());
  if (result.stderr) log(result.stderr.trimEnd());
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

function writeStatus(partial) {
  const previous = readStatus();
  const next = {
    id: jobId,
    cwd,
    serviceName,
    logPath,
    ...previous,
    ...partial
  };
  fs.writeFileSync(statusPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function readStatus() {
  try {
    if (!fs.existsSync(statusPath)) return {};
    return JSON.parse(fs.readFileSync(statusPath, "utf8"));
  } catch {
    return {};
  }
}

function log(message) {
  fs.appendFileSync(logPath, `${message}\n`, "utf8");
}

function resolveDeployCwd(startDir) {
  const explicitRoot = process.env.BASECAMP_REPO_CWD || process.env.BASECAMP_PROJECT_ROOT;
  if (explicitRoot && fs.existsSync(path.join(explicitRoot, "package.json"))) {
    return path.resolve(explicitRoot);
  }

  const standaloneRoot = rootBeforeStandalone(startDir);
  if (standaloneRoot && isUsableSourceRoot(standaloneRoot)) {
    return standaloneRoot;
  }

  return startDir;
}

function rootBeforeStandalone(startDir) {
  const segments = path.resolve(startDir).split(path.sep);
  for (let index = segments.length - 2; index >= 0; index -= 1) {
    if (segments[index] === ".next" && segments[index + 1] === "standalone") {
      return segments.slice(0, index).join(path.sep) || path.sep;
    }
  }
  return null;
}

function isUsableSourceRoot(candidate) {
  return (
    fs.existsSync(path.join(candidate, ".git")) &&
    fs.existsSync(path.join(candidate, "package.json")) &&
    fs.existsSync(path.join(candidate, "src"))
  );
}
