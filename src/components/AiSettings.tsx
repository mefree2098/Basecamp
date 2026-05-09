"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Bot, CheckCircle2, KeyRound, MapPinned, RefreshCw, Shield, Zap } from "lucide-react";
import type {
  AdminIntegrationSettings,
  AiProvider,
  AiSettings as AiSettingsType,
  ModelOption,
  ThinkingLevel
} from "@/lib/types";
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

const bakedGoogleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
const GOOGLE_MAPS_SETTINGS_EVENT = "basecamp-google-maps-settings";
const GOOGLE_MAPS_ADMIN_CALLBACK = "__basecampAdminGoogleMapsReady";
let googleMapsAdminScriptPromise: Promise<void> | null = null;

type AdminGeocoderLocation = {
  lat: () => number;
  lng: () => number;
};
type AdminGeocoder = {
  geocode: (request: {
    address: string;
    componentRestrictions?: { administrativeArea?: string; country?: string };
    region?: string;
  }) => Promise<{ results: Array<{ geometry: { location: AdminGeocoderLocation } }> }>;
};
type AdminStreetViewService = {
  getPanorama: (request: {
    location: { lat: number; lng: number };
    radius: number;
    source?: "outdoor" | "default";
  }) => Promise<unknown>;
};
type AdminGoogleMapsWindow = Window & {
  google?: {
    maps: {
      importLibrary: (name: "geocoding" | "streetView") => Promise<
        | {
            Geocoder: new () => AdminGeocoder;
          }
        | {
            StreetViewService: new () => AdminStreetViewService;
          }
      >;
    };
  };
  gm_authFailure?: () => void;
  __basecampAdminGoogleMapsReady?: () => void;
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
  const [integrationSettings, setIntegrationSettings] = useState<AdminIntegrationSettings | null>(null);
  const [mapsKey, setMapsKey] = useState("");
  const [mapsMapId, setMapsMapId] = useState("");
  const [mapsTechMapId, setMapsTechMapId] = useState("");
  const [mapsStatus, setMapsStatus] = useState("Loading saved Google Maps settings...");

  const providerModels = useMemo(
    () => models.filter((model) => model.provider === settings.provider || model.provider === "mock"),
    [models, settings.provider]
  );
  const savedMapsKey = integrationSettings?.googleMaps.browserApiKey ?? "";
  const effectiveMapsKey = mapsKey.trim() || savedMapsKey || bakedGoogleMapsApiKey;

  useEffect(() => {
    void loadIntegrationSettings();
  }, []);

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

  async function loadIntegrationSettings() {
    try {
      const response = await fetch("/api/admin/integrations", { cache: "no-store" });
      const result = (await response.json()) as AdminIntegrationSettings;
      setIntegrationSettings(result);
      setMapsMapId(result.googleMaps.mapId);
      setMapsTechMapId(result.googleMaps.techMapId);
      setMapsStatus(
        result.googleMaps.hasBrowserApiKey
          ? `Server Google Maps key is saved (${result.googleMaps.browserApiKeyPreview}).`
          : bakedGoogleMapsApiKey
            ? "Using the build-time Google Maps key until a server key is saved."
            : "No Google Maps key is saved yet."
      );
    } catch {
      setMapsStatus("Could not load saved Google Maps settings.");
    }
  }

  async function saveMapsSettings(options: { clearBrowserApiKey?: boolean } = {}) {
    setMapsStatus("Saving Google Maps settings...");
    const googleMaps: {
      browserApiKey?: string;
      mapId: string;
      techMapId: string;
      clearBrowserApiKey?: boolean;
    } = {
      mapId: mapsMapId,
      techMapId: mapsTechMapId
    };
    if (options.clearBrowserApiKey) {
      googleMaps.clearBrowserApiKey = true;
    } else if (mapsKey.trim()) {
      googleMaps.browserApiKey = mapsKey.trim();
    }

    try {
      const response = await fetch("/api/admin/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleMaps })
      });
      const result = (await response.json()) as AdminIntegrationSettings & { error?: unknown };
      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : "Unable to save integration settings.");
      }
      setIntegrationSettings(result);
      setMapsKey("");
      setMapsMapId(result.googleMaps.mapId);
      setMapsTechMapId(result.googleMaps.techMapId);
      window.localStorage.removeItem("basecamp.googleMapsApiKey");
      window.dispatchEvent(new Event(GOOGLE_MAPS_SETTINGS_EVENT));
      setMapsStatus(
        result.googleMaps.hasBrowserApiKey
          ? `Server Google Maps settings saved (${result.googleMaps.browserApiKeyPreview}). Reload the map if it is already open.`
          : "Server Google Maps key cleared. The startup map will use the build-time key or fallback view."
      );
    } catch (error) {
      setMapsStatus(error instanceof Error ? error.message : "Unable to save Google Maps settings.");
    }
  }

  async function checkMapsKey() {
    const key = effectiveMapsKey.trim();
    if (!key) {
      setMapsStatus("Add a Google Maps API key before checking permissions.");
      return;
    }
    setMapsStatus("Checking Maps JavaScript, Geocoding, and Street View...");
    try {
      (window as AdminGoogleMapsWindow).gm_authFailure = () => {
        setMapsStatus(
          "Google Maps authorization failed. Check billing, API activation, and HTTP referrer restrictions for this key."
        );
      };
      await loadGoogleMapsForAdmin(key);
      const mapsWindow = window as AdminGoogleMapsWindow;
      const geocodingLibrary = (await mapsWindow.google?.maps.importLibrary("geocoding")) as
        | { Geocoder: new () => AdminGeocoder }
        | undefined;
      const streetViewLibrary = (await mapsWindow.google?.maps.importLibrary("streetView")) as
        | { StreetViewService: new () => AdminStreetViewService }
        | undefined;
      if (!geocodingLibrary?.Geocoder || !streetViewLibrary?.StreetViewService) {
        setMapsStatus("Maps JavaScript loaded, but Google did not return Geocoding or Street View libraries.");
        return;
      }
      const geocoder = new geocodingLibrary.Geocoder();
      const geocoded = await geocoder.geocode({
        address: "Salt Lake City, UT",
        componentRestrictions: { administrativeArea: "UT", country: "US" },
        region: "us"
      });
      const location = geocoded.results[0]?.geometry.location;
      if (!location) {
        setMapsStatus("Geocoding responded but did not return a Utah test location.");
        return;
      }
      const streetView = new streetViewLibrary.StreetViewService();
      await streetView.getPanorama({
        location: { lat: location.lat(), lng: location.lng() },
        radius: 500,
        source: "outdoor"
      });
      setMapsStatus(
        "Maps JavaScript, Geocoding, and Street View all responded for this browser key."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setMapsStatus(
        /geocod|ApiNotActivated|REQUEST_DENIED/i.test(message)
          ? "Maps JavaScript works, but this exact key cannot use Geocoding API. If Geocoding is enabled, verify the key belongs to that project and key API restrictions include Geocoding API."
          : "Google Maps permission check failed. Verify Maps JavaScript API, Geocoding API, billing, Street View support, and HTTP referrer restrictions."
      );
    }
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

        <div className="admin-panel">
          <h2>Google Maps</h2>
          <p className="muted">
            The Startup Map uses Maps JavaScript, browser geocoding, and Street View. Saved settings
            are stored on the server so production can update without a rebuild.
          </p>
          <p className="result-meta">
            Active key: <strong>{maskMapsKey(effectiveMapsKey)}</strong>
          </p>
          <label className="input-field">
            <span>
              <MapPinned size={15} aria-hidden="true" />
              Google Maps API key
            </span>
            <input
              type="password"
              value={mapsKey}
              onChange={(event) => setMapsKey(event.target.value)}
              placeholder={
                integrationSettings?.googleMaps.hasBrowserApiKey
                  ? `${integrationSettings.googleMaps.browserApiKeyPreview} saved on server`
                  : "Paste Maps browser key"
              }
            />
          </label>
          <label className="input-field">
            <span>Default map ID</span>
            <input
              value={mapsMapId}
              onChange={(event) => setMapsMapId(event.target.value)}
              placeholder="Optional Google Cloud map ID"
            />
          </label>
          <label className="input-field">
            <span>Tech theme map ID</span>
            <input
              value={mapsTechMapId}
              onChange={(event) => setMapsTechMapId(event.target.value)}
              placeholder="Optional Google Cloud map ID"
            />
          </label>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={() => void saveMapsSettings()}>
              <CheckCircle2 size={16} aria-hidden="true" />
              Save maps settings
            </button>
            <button className="ghost-button" type="button" onClick={checkMapsKey}>
              <Shield size={16} aria-hidden="true" />
              Check permissions
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setMapsKey("");
                void saveMapsSettings({ clearBrowserApiKey: true });
              }}
            >
              Clear saved key
            </button>
          </div>
          <p className="muted">
            Restrict this browser key to trusted HTTP referrers in Google Cloud. Server-side
            geocoding uses the same saved key unless a dedicated geocoding key is configured in the
            environment.
          </p>
          <p className="status-line">{mapsStatus}</p>
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskMapsKey(key: string) {
  if (!key) return "none";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

function loadGoogleMapsForAdmin(apiKey: string) {
  const mapsWindow = window as AdminGoogleMapsWindow;
  if (mapsWindow.google?.maps.importLibrary) return Promise.resolve();
  if (googleMapsAdminScriptPromise) return googleMapsAdminScriptPromise;

  googleMapsAdminScriptPromise = new Promise<void>((resolve, reject) => {
    mapsWindow.__basecampAdminGoogleMapsReady = () => {
      delete mapsWindow.__basecampAdminGoogleMapsReady;
      resolve();
    };
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      loading: "async",
      callback: GOOGLE_MAPS_ADMIN_CALLBACK
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => reject(new Error("Maps JavaScript API failed to load."));
    document.head.appendChild(script);
  });

  return googleMapsAdminScriptPromise;
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
