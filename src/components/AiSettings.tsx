"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Bot, CheckCircle2, KeyRound, RefreshCw, Shield, Zap } from "lucide-react";
import type {
  AiProvider,
  AiSettings as AiSettingsType,
  ModelOption,
  ThinkingLevel
} from "@/lib/types";
import { MapsIntegrationSettings } from "./MapsIntegrationSettings";
import { modelFallbacks } from "@/lib/site-context";

const providers: Array<{ value: AiProvider; label: string; hint: string }> = [
  { value: "mock", label: "Local guide", hint: "No cost, deterministic fallback" },
  { value: "openai", label: "OpenAI API", hint: "Responses API with reasoning effort" },
  { value: "codexPath", label: "OpenAI Codex path", hint: "Uses ChatGPT subscription auth" },
  { value: "anthropic", label: "Anthropic", hint: "Claude API key path" },
  { value: "gemini", label: "Google Gemini", hint: "Gemini API key path" }
];

const thinkingLevels: Array<{ value: ThinkingLevel; label: string }> = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" }
];

const defaultSettings: AiSettingsType = {
  provider: "mock",
  model: "basecamp-local-guide",
  thinkingLevel: "medium",
  codexHomeProfile: "auto",
  codexPath: "codex"
};

export function AiSettings() {
  const storedSettings = useSyncExternalStore(
    subscribeToStoredSettings,
    readStoredSettings,
    () => null
  );
  const settings = useMemo(() => parseStoredSettings(storedSettings), [storedSettings]);
  const [models, setModels] = useState<ModelOption[]>(modelFallbacks);
  const [status, setStatus] = useState("Settings are saved in this browser and sent live per request.");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [pendingLoginId, setPendingLoginId] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [isLoginPending, setIsLoginPending] = useState(false);

  const providerModels = useMemo(
    () => models.filter((model) => model.provider === settings.provider || model.provider === "mock"),
    [models, settings.provider]
  );

  function update(patch: Partial<AiSettingsType>) {
    const next = { ...settings, ...patch };
    if (patch.provider) {
      const fallback = modelFallbacks.find((model) => model.provider === patch.provider);
      next.model = fallback?.id ?? "basecamp-local-guide";
    }
    saveSettings(next);
  }

  function saveSettings(next: AiSettingsType) {
    window.localStorage.setItem("basecamp.aiSettings", JSON.stringify(redactForStorage(next)));
    window.dispatchEvent(new Event(STORED_SETTINGS_EVENT));
  }


  function applyModelCatalog(nextModels: ModelOption[], settingsSnapshot: AiSettingsType) {
    const providerOptions = nextModels.filter((model) => model.provider === settingsSnapshot.provider);
    const hasSelectedModel = providerOptions.some((model) => model.id === settingsSnapshot.model);
    setModels(nextModels);
    if (!hasSelectedModel && providerOptions[0]) {
      const nextSettings = { ...settingsSnapshot, model: providerOptions[0].id };
      saveSettings(nextSettings);
      return nextSettings;
    }
    return settingsSnapshot;
  }

  async function loadModelCatalog(settingsSnapshot: AiSettingsType) {
    const response = await fetch("/api/ai/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(redactForTransport(settingsSnapshot))
    });
    const result = (await response.json()) as { models: ModelOption[]; error?: string };
    const nextModels = result.models?.length ? result.models : modelFallbacks;
    const nextSettings = applyModelCatalog(nextModels, settingsSnapshot);
    return { result, nextModels, nextSettings };
  }

  async function refreshModels() {
    setStatus("Refreshing model list...");
    const { result, nextModels } = await loadModelCatalog(settings);
    setStatus(result.error ?? `Loaded ${nextModels.length} model options.`);
  }

  async function readCodexHealth(settingsSnapshot: AiSettingsType) {
    const params = new URLSearchParams({
      codexPath: settingsSnapshot.codexPath ?? "",
      codexHome: settingsSnapshot.codexHome ?? ""
    });
    const response = await fetch(`/api/ai/codex-auth-health?${params.toString()}`);
    return (await response.json()) as {
      authenticated?: boolean;
      loginRequired?: boolean;
      effectiveCodexHome?: string;
      modelCount?: number;
      error?: string;
    };
  }

  async function checkCodexHealth() {
    setStatus("Checking Codex auth...");
    const result = await readCodexHealth(settings);
    setStatus(
      result.error ??
        `Codex ${result.authenticated ? "authenticated" : "needs login"} at ${result.effectiveCodexHome}. ${result.modelCount ?? 0} models visible.`
    );
  }

  async function startCodexLogin() {
    const loginSettings: AiSettingsType = {
      ...settings,
      provider: "codexPath",
      model: settings.provider === "codexPath" ? settings.model : "gpt-5.5"
    };
    saveSettings(loginSettings);
    setStatus("Starting Codex login...");
    setLoginUrl("");
    setIsLoginPending(true);
    const params = new URLSearchParams({
      startLogin: "1",
      openBrowser: "1",
      codexPath: loginSettings.codexPath ?? "",
      codexHome: loginSettings.codexHome ?? ""
    });
    try {
      const response = await fetch(`/api/ai/codex-models?${params.toString()}`);
      const result = (await response.json()) as {
        authenticated?: boolean;
        authUrl?: string;
        pendingLoginId?: string;
        browserOpened?: boolean;
        browserOpenMessage?: string;
        error?: string;
      };
      if (result.error) {
        setStatus(result.error);
        setIsLoginPending(false);
        return;
      }
      if (result.pendingLoginId) setPendingLoginId(result.pendingLoginId);
      if (result.authenticated) {
        const { nextModels } = await loadModelCatalog(loginSettings);
        setStatus(`Codex already authenticated. Loaded ${nextModels.length} model options.`);
        setIsLoginPending(false);
        return;
      }
      if (result.authUrl && !result.browserOpened) setLoginUrl(result.authUrl);
      setStatus(
        result.browserOpened
          ? "Codex login window opened. Complete sign-in there; Basecamp will detect it automatically."
          : (result.browserOpenMessage ?? "Use Open login window, then complete sign-in there. Basecamp will detect it automatically.")
      );
      await pollCodexLogin(loginSettings);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start Codex login.");
      setIsLoginPending(false);
    }
  }

  async function pollCodexLogin(settingsSnapshot: AiSettingsType) {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await sleep(2_000);
      const health = await readCodexHealth(settingsSnapshot);
      if (health.authenticated) {
        const { nextModels } = await loadModelCatalog(settingsSnapshot);
        setPendingLoginId("");
        setCallbackUrl("");
        setLoginUrl("");
        setIsLoginPending(false);
        setStatus(
          `Codex authenticated at ${health.effectiveCodexHome}. ${nextModels.length || health.modelCount || 0} models visible.`
        );
        return;
      }
      setStatus("Waiting for Codex login to finish in the browser window...");
    }
    setIsLoginPending(false);
    setStatus("Login window opened, but Basecamp has not detected completion yet. Click Check auth to retry detection.");
  }

  async function completeCodexLogin() {
    setStatus("Completing Codex login...");
    const response = await fetch("/api/ai/codex-login/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loginId: pendingLoginId,
        callbackUrl,
        codexPath: settings.codexPath,
        codexHome: settings.codexHome
      })
    });
    const result = (await response.json()) as { mode?: string; error?: string; message?: string };
    setStatus(result.error ?? result.message ?? `Login completion mode: ${result.mode}`);
  }

  return (
    <section className="ai-settings">
      <div className="section-heading">
        <span className="eyebrow">
          <Bot size={15} aria-hidden="true" />
          AI controls
        </span>
        <h1>Provider, model, and thinking controls</h1>
        <p>
          Pick a provider, refresh available models, set reasoning effort, and keep credentials out
          of server responses.
        </p>
      </div>

      <div className="settings-grid">
        <div className="admin-panel">
          <h2>Runtime</h2>
          <label className="select-field">
            <span>Provider</span>
            <select
              value={settings.provider}
              onChange={(event) => update({ provider: event.target.value as AiProvider })}
            >
              {providers.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            {providers.find((provider) => provider.value === settings.provider)?.hint}
          </p>

          <label className="select-field">
            <span>Model</span>
            <select
              value={settings.model}
              onChange={(event) => update({ model: event.target.value })}
            >
              {providerModels.map((model) => (
                <option key={`${model.provider}-${model.id}`} value={model.id}>
                  {model.label} - {model.costHint}
                </option>
              ))}
            </select>
          </label>

          <label className="select-field">
            <span>Thinking level</span>
            <select
              value={settings.thinkingLevel}
              onChange={(event) => update({ thinkingLevel: event.target.value as ThinkingLevel })}
            >
              {thinkingLevels.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </label>

          {settings.provider !== "mock" && settings.provider !== "codexPath" && (
            <label className="input-field">
              <span>
                <KeyRound size={15} aria-hidden="true" />
                API key
              </span>
              <input
                type="password"
                value={settings.apiKey ?? ""}
                onChange={(event) => update({ apiKey: event.target.value })}
                placeholder="Stored only in this browser"
              />
            </label>
          )}

          <div className="button-row">
            <button className="primary-button" type="button" onClick={refreshModels}>
              <RefreshCw size={16} aria-hidden="true" />
              Refresh models
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                window.localStorage.setItem(
                  "basecamp.aiSettings",
                  JSON.stringify(redactForStorage(settings))
                );
                setStatus("Saved.");
              }}
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              Save
            </button>
          </div>
        </div>

        <div className="admin-panel">
          <h2>Codex path</h2>
          <label className="input-field">
            <span>Codex executable</span>
            <input
              value={settings.codexPath ?? ""}
              onChange={(event) => update({ codexPath: event.target.value })}
              placeholder="codex or /path/to/codex.js"
            />
          </label>
          <label className="select-field">
            <span>Home profile</span>
            <select
              value={settings.codexHomeProfile ?? "auto"}
              onChange={(event) =>
                update({
                  codexHomeProfile: event.target.value as AiSettingsType["codexHomeProfile"]
                })
              }
            >
              <option value="auto">Auto</option>
              <option value="azure">Azure</option>
              <option value="aws">AWS</option>
              <option value="local">Local</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {settings.codexHomeProfile === "aws" && (
            <label className="input-field">
              <span>AWS volume root</span>
              <input
                value={settings.codexAwsVolumeRoot ?? "/mnt/efs"}
                onChange={(event) => update({ codexAwsVolumeRoot: event.target.value })}
              />
            </label>
          )}
          {settings.codexHomeProfile === "custom" && (
            <label className="input-field">
              <span>Codex home</span>
              <input
                value={settings.codexHome ?? ""}
                onChange={(event) => update({ codexHome: event.target.value })}
              />
            </label>
          )}
          <div className="button-row">
            <button className="ghost-button" type="button" onClick={checkCodexHealth}>
              <Shield size={16} aria-hidden="true" />
              Check auth
            </button>
            <button className="primary-button" type="button" onClick={startCodexLogin}>
              <Zap size={16} aria-hidden="true" />
              {isLoginPending ? "Waiting..." : "Sign in"}
            </button>
          </div>
          {loginUrl && (
            <a className="ghost-button" href={loginUrl} target="_blank" rel="noreferrer">
              Open login window
            </a>
          )}
          {pendingLoginId && (
            <>
              <label className="message-box">
                <span>Manual callback fallback</span>
                <textarea
                  value={callbackUrl}
                  onChange={(event) => setCallbackUrl(event.target.value)}
                  placeholder="http://localhost:1455/auth/callback?code=..."
                />
              </label>
              <button
                className="ghost-button"
                type="button"
                onClick={completeCodexLogin}
                disabled={!callbackUrl.trim()}
              >
                Complete login
              </button>
            </>
          )}
        </div>

        <MapsIntegrationSettings />
      </div>

      <p className="status-line">{status}</p>
    </section>
  );
}

function redactForStorage(settings: AiSettingsType) {
  return {
    ...settings,
    apiKey: settings.apiKey
  };
}

function redactForTransport(settings: AiSettingsType) {
  return settings;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STORED_SETTINGS_EVENT = "basecamp-ai-settings";

function subscribeToStoredSettings(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORED_SETTINGS_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORED_SETTINGS_EVENT, onStoreChange);
  };
}

function readStoredSettings() {
  return window.localStorage.getItem("basecamp.aiSettings");
}

function parseStoredSettings(storedSettings: string | null): AiSettingsType {
  if (!storedSettings) return defaultSettings;
  try {
    return { ...defaultSettings, ...(JSON.parse(storedSettings) as AiSettingsType) };
  } catch {
    return defaultSettings;
  }
}
