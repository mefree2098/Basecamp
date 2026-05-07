import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import type { AiSettings } from "../types";
import {
  deriveCodexHome,
  enforceFileCredentialStore,
  resolveWritableCodexHome
} from "./homeProfile";

type JsonRpcMessage = {
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string; code?: number };
};

type CodexAccountReadResult = {
  authenticated?: boolean;
  requiresOpenaiAuth?: boolean;
  email?: string;
  accountEmail?: string;
  planType?: string;
  account?: {
    type?: string;
    authenticated?: boolean;
    email?: string;
    accountEmail?: string;
    planType?: string;
  } | null;
};

type CodexAccountState = {
  authenticated: boolean;
  requiresOpenaiAuth: boolean;
  accountEmail?: string;
  planType?: string;
  accountType?: string;
};

type CodexModelListResult = {
  models?: Array<string | { id?: string; name?: string; model?: string; hidden?: boolean }>;
  data?: Array<string | { id?: string; name?: string; model?: string; hidden?: boolean }>;
};

type CodexThreadStartResult = {
  thread?: { id?: string };
  threadId?: string;
  id?: string;
};

type CodexTurnStartResult = {
  turn?: { id?: string };
  outputText?: string;
  finalAnswer?: string;
  message?: string;
};

type CodexNotificationHandler = (message: JsonRpcMessage) => void;

type CodexLoginOptions = {
  openBrowser?: boolean;
};

let nextId = 1;
const pendingCodexLogins = new Map<
  string,
  { session: CodexAppServerSession; createdAt: number; settings?: Partial<AiSettings> }
>();

export async function listCodexModels(settings?: Partial<AiSettings>) {
  const session = await CodexAppServerSession.create(settings);
  try {
    const result = (await session.request("model/list", {
      includeHidden: false
    })) as CodexModelListResult;
    return normalizeCodexModelList(result);
  } finally {
    session.close();
  }
}

export async function readCodexAuthHealth(settings?: Partial<AiSettings>) {
  const session = await CodexAppServerSession.create(settings);
  try {
    const accountResult = (await session.request("account/read", {
      refreshToken: true
    })) as CodexAccountReadResult;
    const account = normalizeCodexAccount(accountResult);
    let models: string[] = [];
    if (account.authenticated) {
      models = await listCodexModels(settings);
    }
    return {
      effectiveCodexPath: session.codexPath,
      effectiveCodexHome: session.codexHome,
      authenticated: account.authenticated,
      requiresOpenaiAuth: account.requiresOpenaiAuth,
      loginRequired: !account.authenticated,
      accountEmail: account.accountEmail,
      planType: account.planType,
      accountType: account.accountType,
      modelCount: models.length,
      sampleModels: models.slice(0, 8),
      worker: {
        siteName: process.env.WEBSITE_SITE_NAME,
        instanceId: process.env.WEBSITE_INSTANCE_ID,
        hostname: process.env.WEBSITE_HOSTNAME,
        pid: process.pid
      }
    };
  } finally {
    session.close();
  }
}

export async function runCodexChat(settings: AiSettings, prompt: string) {
  const session = await CodexAppServerSession.create(settings);
  try {
    const thread = (await session.request("thread/start", {
      model: settings.model,
      approvalPolicy: "never",
      sandbox: "read-only",
      developerInstructions:
        "You are Basecamp, a chat-only Startup State assistant. Do not ask to run tools. Answer concisely from the supplied context and cite only supplied resource ids.",
      ephemeral: true
    })) as CodexThreadStartResult;

    const threadId = extractCodexThreadId(thread);
    if (!threadId) {
      throw new Error("Codex did not return a usable thread id.");
    }
    const turn = (await session.request("turn/start", {
      threadId,
      approvalPolicy: "never",
      sandboxPolicy: { type: "readOnly", networkAccess: false },
      effort: settings.thinkingLevel || "medium",
      input: [{ type: "text", text: prompt, text_elements: [] }],
      model: settings.model
    })) as CodexTurnStartResult;

    const turnId = turn.turn?.id;
    const immediateText = turn.outputText || turn.finalAnswer || turn.message;
    if (!turnId) {
      return immediateText || "Codex returned no final text.";
    }

    return await session.waitForTurnFinalText(threadId, turnId, immediateText);
  } finally {
    session.close();
  }
}

export async function startCodexLogin(settings?: Partial<AiSettings>, options?: CodexLoginOptions) {
  const session = await CodexAppServerSession.create(settings);
  try {
    const account = normalizeCodexAccount((await session.request("account/read", {
      refreshToken: true
    })) as CodexAccountReadResult);
    if (account.authenticated) {
      session.close();
      return {
        loginRequired: false,
        authenticated: true,
        accountEmail: account.accountEmail,
        planType: account.planType,
        effectiveCodexPath: session.codexPath,
        effectiveCodexHome: session.codexHome
      };
    }

    const login = (await session.request("account/login/start", {
      type: "chatgpt"
    })) as { authUrl?: string; url?: string };
    const authUrl = login.authUrl || login.url;
    const browserOpen = options?.openBrowser && authUrl ? openCodexLoginInBrowser(authUrl) : null;
    const pendingLoginId = randomUUID();
    pendingCodexLogins.set(pendingLoginId, {
      session,
      createdAt: Date.now(),
      settings
    });
    pruneExpiredLogins();
    return {
      loginRequired: true,
      authenticated: false,
      authUrl,
      pendingLoginId,
      browserOpenAttempted: Boolean(browserOpen),
      browserOpened: Boolean(browserOpen?.opened),
      browserOpenMessage: browserOpen?.message,
      callbackHint:
        "Complete the login in the opened browser window. Basecamp will detect the Codex auth state automatically.",
      effectiveCodexPath: session.codexPath,
      effectiveCodexHome: session.codexHome
    };
  } catch (error) {
    session.close();
    throw error;
  }
}

export async function completeCodexLogin({
  loginId,
  callbackUrl
}: {
  loginId?: string;
  callbackUrl: string;
}) {
  if (!loginId) {
    throw new Error("A pending login id is required for hosted Codex login completion.");
  }
  const pending = pendingCodexLogins.get(loginId);
  if (!pending) {
    throw new Error("Pending Codex login session was not found or has expired.");
  }

  const localCallbackUrl = validateCodexCallbackUrl(callbackUrl);
  const finish = (mode: string, extra?: Record<string, unknown>) => {
    pendingCodexLogins.delete(loginId);
    pending.session.close();
    return {
      mode,
      authenticated: true,
      message: "Codex login completed.",
      effectiveCodexPath: pending.session.codexPath,
      effectiveCodexHome: pending.session.codexHome,
      ...extra
    };
  };

  let relayStatus: number | undefined;
  let relayFailed = false;
  try {
    relayStatus = await forwardCodexLoginCallback(localCallbackUrl);
  } catch {
    relayFailed = true;
  }

  const account = await waitForCodexAuth(pending.session);
  if (account.authenticated) {
    return finish(relayFailed ? "relay-timeout-authenticated" : "relay", {
      relayStatus,
      accountEmail: account.accountEmail,
      planType: account.planType
    });
  }

  if (relayFailed) {
    return {
      mode: "relay-timeout-pending",
      authenticated: false,
      message:
        "The callback could not be forwarded to the pending local Codex listener. Click Sign in again, then paste the fresh localhost callback URL while the pending login is still active."
    };
  }

  return {
    mode: "relay-timeout-pending",
    authenticated: false,
    relayStatus,
    message:
      "The callback was forwarded to Codex, but auth has not appeared yet. Try Check auth; if it still needs login, start a fresh sign-in."
  };
}

export function validateCodexCallbackUrl(callbackUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(callbackUrl.trim());
  } catch {
    throw new Error("Paste the full localhost callback URL from the Codex login tab.");
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";

  if (parsed.protocol !== "http:" || !isLocalhost) {
    throw new Error("For safety, Codex login completion only accepts http://localhost callback URLs.");
  }

  if (!parsed.searchParams.has("code") && !parsed.searchParams.has("id_token")) {
    throw new Error("The Codex login callback URL is missing its login token.");
  }

  return parsed;
}

export function normalizeCodexAccount(result: CodexAccountReadResult): CodexAccountState {
  const nested = result.account ?? undefined;
  const accountEmail = nested?.accountEmail || nested?.email || result.accountEmail || result.email;
  const planType = nested?.planType || result.planType;
  const accountType = nested?.type;
  return {
    authenticated: Boolean(result.authenticated || nested),
    requiresOpenaiAuth: Boolean(result.requiresOpenaiAuth),
    accountEmail,
    planType,
    accountType
  };
}

export function normalizeCodexModelList(result: CodexModelListResult) {
  const rawModels = result.models ?? result.data ?? [];
  return rawModels
    .filter((model) => typeof model === "string" || !model.hidden)
    .map((model) => (typeof model === "string" ? model : model.id || model.model || model.name || ""))
    .filter(Boolean);
}

export function extractCodexThreadId(result: CodexThreadStartResult) {
  return result.thread?.id || result.threadId || result.id || "";
}

export function isOpenAiCodexAuthUrl(authUrl: string) {
  try {
    const parsed = new URL(authUrl);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "auth.openai.com" &&
      parsed.pathname === "/oauth/authorize" &&
      parsed.searchParams.get("client_id") === "app_EMoamEEZ73f0CkXaXp7hrann"
    );
  } catch {
    return false;
  }
}

class CodexAppServerSession {
  private process: ChildProcessWithoutNullStreams;
  private notificationHandlers = new Set<CodexNotificationHandler>();
  private pending = new Map<
    number | string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private buffer = "";

  private constructor(
    process: ChildProcessWithoutNullStreams,
    public codexPath: string,
    public codexHome: string
  ) {
    this.process = process;
    this.process.stdout.setEncoding("utf8");
    this.process.stdout.on("data", (chunk: string) => this.onData(chunk));
    this.process.stderr.setEncoding("utf8");
    this.process.stderr.on("data", () => undefined);
    this.process.on("exit", () => {
      for (const item of this.pending.values()) {
        clearTimeout(item.timeout);
        item.reject(new Error("Codex app-server exited before responding."));
      }
      this.pending.clear();
    });
  }

  static async create(settings?: Partial<AiSettings>, initialize = true) {
    const codexPath = settings?.codexPath || process.env.CODEX_PATH || "codex";
    const derivedHome = deriveCodexHome({
      profile: settings?.codexHomeProfile,
      explicitHome: settings?.codexHome,
      awsVolumeRoot: settings?.codexAwsVolumeRoot
    });
    const codexHome = resolveWritableCodexHome([
      derivedHome,
      path.join(/* turbopackIgnore: true */ process.cwd(), ".basecamp-data", "codex-home")
    ]);
    enforceFileCredentialStore(codexHome);
    const command = resolveCodexCommand(codexPath);
    const child = spawn(command.bin, command.args, {
      env: {
        ...process.env,
        CODEX_HOME: codexHome
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const session = new CodexAppServerSession(child, codexPath, codexHome);
    await once(child, "spawn");
    if (initialize) {
      await session.request("initialize", {
        clientInfo: { name: "basecamp-api", title: "Basecamp API", version: "0.1.0" },
        capabilities: { experimentalApi: true }
      });
      await session.notify("initialized");
    }
    return session;
  }

  request(method: string, params: unknown) {
    const id = nextId++;
    const timeoutMs = Number(process.env.CODEX_RPC_TIMEOUT_MS || 45_000);
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
    });
    this.process.stdin.write(`${payload}\n`);
    return promise;
  }

  notify(method: string, params?: unknown) {
    this.process.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  waitForTurnFinalText(threadId: string, turnId: string, starterText = "") {
    return new Promise<string>((resolve, reject) => {
      let text = starterText;
      let completedText = "";
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Codex turn timed out before returning a final answer."));
      }, Number(process.env.CODEX_TURN_TIMEOUT_MS || 60_000));

      const cleanup = () => {
        clearTimeout(timeout);
        this.notificationHandlers.delete(handle);
      };

      const finish = () => {
        cleanup();
        resolve((completedText || text).trim() || "Codex returned no final text.");
      };

      const handle: CodexNotificationHandler = (message) => {
        const params = message.params as
          | {
              threadId?: string;
              turnId?: string;
              delta?: string;
              item?: { type?: string; text?: string; phase?: string | null };
              turn?: { status?: string; error?: { message?: string } | null };
            }
          | undefined;
        if (!params || params.threadId !== threadId) return;
        if (params.turnId && params.turnId !== turnId) return;

        if (message.method === "item/agentMessage/delta" && typeof params.delta === "string") {
          text += params.delta;
          return;
        }

        if (message.method === "item/completed" && params.item?.type === "agentMessage") {
          completedText = params.item.text || completedText;
          return;
        }

        if (message.method === "turn/completed") {
          if (params.turn?.status === "failed") {
            cleanup();
            reject(new Error(params.turn.error?.message || "Codex turn failed."));
            return;
          }
          finish();
        }
      };

      this.notificationHandlers.add(handle);
    });
  }

  close() {
    this.process.kill("SIGTERM");
    setTimeout(() => {
      if (!this.process.killed) this.process.kill("SIGKILL");
    }, 750);
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    let newline = this.buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (line) this.onMessage(line);
      newline = this.buffer.indexOf("\n");
    }
  }

  private onMessage(line: string) {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      return;
    }

    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || "Codex error"));
      else pending.resolve(message.result);
      return;
    }

    if (message.id !== undefined && message.method) {
      this.respondToServerRequest(message);
      return;
    }

    if (message.method) {
      for (const handler of this.notificationHandlers) {
        handler(message);
      }
    }
  }

  private respondToServerRequest(message: JsonRpcMessage) {
    const method = message.method;
    const id = message.id;
    const result =
      method === "item/commandExecution/requestApproval"
        ? { decision: "cancel" }
        : method === "item/fileChange/requestApproval"
          ? { decision: "cancel" }
          : method === "execCommandApproval"
            ? { decision: "abort" }
            : method === "applyPatchApproval"
              ? { decision: "abort" }
              : method === "item/tool/requestUserInput"
                ? { answers: {} }
                : method === "item/tool/call"
                  ? { success: false, message: "Tool calls are disabled in this integration." }
                  : null;

    const response =
      result === null
        ? { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }
        : { jsonrpc: "2.0", id, result };
    this.process.stdin.write(`${JSON.stringify(response)}\n`);
  }
}

function pruneExpiredLogins() {
  const ttl = Number(process.env.CODEX_LOGIN_TTL_MS || 600_000);
  const now = Date.now();
  for (const [id, pending] of pendingCodexLogins.entries()) {
    if (now - pending.createdAt > ttl) {
      pending.session.close();
      pendingCodexLogins.delete(id);
    }
  }
}

async function forwardCodexLoginCallback(callbackUrl: URL) {
  const response = await fetch(callbackUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(Number(process.env.CODEX_LOGIN_RELAY_TIMEOUT_MS || 10_000))
  });
  return response.status;
}

async function waitForCodexAuth(session: CodexAppServerSession) {
  const deadline = Date.now() + Number(process.env.CODEX_LOGIN_AUTH_WAIT_MS || 12_000);
  let lastAccount: CodexAccountState = {
    authenticated: false,
    requiresOpenaiAuth: false
  };

  while (Date.now() < deadline) {
    try {
      lastAccount = normalizeCodexAccount((await session.request("account/read", {
        refreshToken: true
      })) as CodexAccountReadResult);
      if (lastAccount.authenticated) return lastAccount;
    } catch {
      // The listener may still be writing auth state; keep the pending login alive.
    }
    await sleep(300);
  }

  return lastAccount;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openCodexLoginInBrowser(authUrl: string) {
  if (!isOpenAiCodexAuthUrl(authUrl)) {
    return {
      opened: false,
      message: "Codex returned an unexpected login URL, so Basecamp did not open it automatically."
    };
  }

  if (isHostedRuntime()) {
    return {
      opened: false,
      message: "Automatic browser launch is only available when Basecamp is running locally."
    };
  }

  try {
    const opener =
      process.platform === "darwin"
        ? { command: "open", args: [authUrl] }
        : process.platform === "win32"
          ? { command: "cmd", args: ["/c", "start", "", authUrl] }
          : { command: "xdg-open", args: [authUrl] };
    const child = spawn(opener.command, opener.args, {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    return {
      opened: true,
      message: "Opened the Codex login in your system browser."
    };
  } catch (error) {
    return {
      opened: false,
      message: error instanceof Error ? error.message : "Unable to open the system browser."
    };
  }
}

function isHostedRuntime() {
  return Boolean(
    process.env.WEBSITE_SITE_NAME ||
      process.env.WEBSITE_INSTANCE_ID ||
      process.env.K_SERVICE ||
      process.env.AWS_EXECUTION_ENV ||
      process.env.CODESPACES
  );
}

function resolveCodexCommand(codexPath: string) {
  const candidate = codexPath.trim();
  if (candidate.endsWith(".js") || candidate.endsWith(".mjs") || candidate.endsWith(".cjs")) {
    return { bin: process.execPath, args: [candidate, "app-server", "--listen", "stdio://"] };
  }
  if (!candidate || candidate === "codex" || candidate === "@openai/codex") {
    const bundled = path.join(
      /* turbopackIgnore: true */ process.cwd(),
      "node_modules",
      "@openai",
      "codex",
      "bin",
      "codex.js"
    );
    if (fs.existsSync(bundled)) {
      return { bin: process.execPath, args: [bundled, "app-server", "--listen", "stdio://"] };
    }
    return { bin: "codex", args: ["app-server", "--listen", "stdio://"] };
  }
  return { bin: candidate, args: ["app-server", "--listen", "stdio://"] };
}
