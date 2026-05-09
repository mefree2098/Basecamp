#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  const [command = "overview", ...args] = process.argv.slice(2);
  const config = readConfig();

  if (!config.url || !config.token) {
    throw new Error("Configure BASECAMP_CODEX_URL and BASECAMP_CODEX_TOKEN, or write ~/.codex/basecamp-live.json.");
  }

  if (command === "overview" || command === "status") {
    return printJson(await liveFetch(config, "/api/codex/live/overview"));
  }

  if (command === "deploy-status") {
    return printJson(await liveFetch(config, "/api/codex/live/deploy-status"));
  }

  if (command === "logs") {
    const lines = flagValue(args, "--lines") || "120";
    const unit = flagValue(args, "--unit");
    const params = new URLSearchParams({ lines });
    if (unit) params.set("unit", unit);
    return printJson(await liveFetch(config, `/api/codex/live/logs?${params.toString()}`));
  }

  if (command === "deploy-run") {
    const confirm = flagValue(args, "--confirm");
    return printJson(
      await liveFetch(config, `/api/codex/live/deploy-run?confirm=${encodeURIComponent(confirm || "")}`, {
        method: "POST",
        body: JSON.stringify({ confirm })
      })
    );
  }

  if (command === "services-restart") {
    const confirm = flagValue(args, "--confirm");
    return printJson(
      await liveFetch(config, `/api/codex/live/services-restart?confirm=${encodeURIComponent(confirm || "")}`, {
        method: "POST",
        body: JSON.stringify({ confirm })
      })
    );
  }

  if (command === "request") {
    const requestPath = args[0];
    if (!requestPath?.startsWith("/")) {
      throw new Error("request requires a path starting with /");
    }
    return printJson(await liveFetch(config, requestPath));
  }

  throw new Error(`Unknown Basecamp live command: ${command}`);
}

async function liveFetch(config, requestPath, init = {}) {
  const url = new URL(requestPath, ensureTrailingSlash(config.url));
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  const payload = parseJson(text) ?? { status: response.status, body: text };
  if (!response.ok) {
    const error = new Error(`Basecamp live request failed (${response.status})`);
    error.payload = payload;
    throw errorWithPayload(error);
  }
  return payload;
}

function readConfig() {
  const fileConfig = readConfigFile();
  return {
    url: process.env.BASECAMP_CODEX_URL || fileConfig.url || fileConfig.baseUrl || "",
    token: process.env.BASECAMP_CODEX_TOKEN || fileConfig.token || ""
  };
}

function readConfigFile() {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const candidates = [
    path.join(codexHome, "basecamp-live.json"),
    path.join(os.homedir(), ".codex", "basecamp-live.json")
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return JSON.parse(fs.readFileSync(candidate, "utf8"));
      }
    } catch {
      return {};
    }
  }
  return {};
}

function flagValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function errorWithPayload(error) {
  if (error.payload) {
    error.message = `${error.message}: ${JSON.stringify(error.payload, null, 2)}`;
  }
  return error;
}
