"use client";

import { useMemo, useState } from "react";
import { Bot, CheckCircle2, KeyRound, RefreshCw, Shield, Zap } from "lucide-react";
import type { AiProvider, AiSettings as AiSettingsType, ModelOption, ThinkingLevel } from "@/lib/types";
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
  const [settings, setSettings] = useState<AiSettingsType>(() => {
    if (typeof window === "undefined") return defaultSettings;
    const stored = window.localStorage.getItem("basecamp.aiSettings");
    return stored ? { ...defaultSettings, ...(JSON.parse(stored) as AiSettingsType) } : defaultSettings;
  });
  const [models, setModels] = useState<ModelOption[]>(modelFallbacks);
  const [status, setStatus] = useState("Settings are saved in this browser and sent live per request.");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [pendingLoginId, setPendingLoginId] = useState("");

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
    setSettings(next);
    window.localStorage.setItem("basecamp.aiSettings", JSON.stringify(redactForStorage(next)));
  }

  async function refreshModels() {
    setStatus("Refreshing model list...");
    const response = await fetch("/api/ai/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(redactForTransport(settings))
    });
    const result = (await response.json()) as { models: ModelOption[]; error?: string };
    setModels(result.models?.length ? result.models : modelFallbacks);
    setStatus(result.error ?? `Loaded ${result.models?.length ?? 0} model options.`);
  }

  async function checkCodexHealth() {
    setStatus("Checking Codex auth...");
    const params = new URLSearchParams({
      codexPath: settings.codexPath ?? "",
      codexHome: settings.codexHome ?? ""
    });
    const response = await fetch(`/api/ai/codex-auth-health?${params.toString()}`);
    const result = (await response.json()) as {
      authenticated?: boolean;
      loginRequired?: boolean;
      effectiveCodexHome?: string;
      modelCount?: number;
      error?: string;
    };
    setStatus(
      result.error ??
        `Codex ${result.authenticated ? "authenticated" : "needs login"} at ${result.effectiveCodexHome}. ${result.modelCount ?? 0} models visible.`
    );
  }

  async function startCodexLogin() {
    setStatus("Starting Codex login...");
    const params = new URLSearchParams({
      startLogin: "1",
      codexPath: settings.codexPath ?? "",
      codexHome: settings.codexHome ?? ""
    });
    const response = await fetch(`/api/ai/codex-models?${params.toString()}`);
    const result = (await response.json()) as {
      authUrl?: string;
      pendingLoginId?: string;
      error?: string;
    };
    if (result.pendingLoginId) setPendingLoginId(result.pendingLoginId);
    if (result.authUrl) window.open(result.authUrl, "_blank", "noopener,noreferrer");
    setStatus(result.error ?? "Login opened. Paste the localhost callback URL here if the tab cannot complete.");
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
              Sign in
            </button>
          </div>
          <label className="message-box">
            <span>Complete login callback</span>
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
            disabled={!callbackUrl.trim() || !pendingLoginId}
          >
            Complete login
          </button>
        </div>
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
