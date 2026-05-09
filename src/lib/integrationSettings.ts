import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { AdminIntegrationSettings, ClientIntegrationSettings } from "./types";

type StoredIntegrationSettings = {
  updatedAt?: string;
  googleMaps?: {
    browserApiKey?: string;
    geocodingApiKey?: string;
    mapId?: string;
    techMapId?: string;
  };
};

export type IntegrationSettingsUpdate = {
  googleMaps?: {
    browserApiKey?: string;
    geocodingApiKey?: string;
    mapId?: string;
    techMapId?: string;
    clearBrowserApiKey?: boolean;
    clearGeocodingApiKey?: boolean;
  };
};

const SETTINGS_FILENAME = "integration-settings.json";

export function readIntegrationSettings() {
  return mergeSettings(readEnvSettings(), readStoredSettings());
}

export function readClientIntegrationSettings(): ClientIntegrationSettings {
  const settings = readIntegrationSettings();
  const googleMaps = settings.googleMaps ?? {};
  return {
    googleMaps: {
      browserApiKey: googleMaps.browserApiKey ?? "",
      mapId: googleMaps.mapId ?? "",
      techMapId: googleMaps.techMapId ?? "",
      hasServerGeocodingKey: Boolean(googleMaps.geocodingApiKey || googleMaps.browserApiKey)
    }
  };
}

export function readAdminIntegrationSettings(): AdminIntegrationSettings {
  const settings = readIntegrationSettings();
  const googleMaps = settings.googleMaps ?? {};
  return {
    updatedAt: settings.updatedAt,
    googleMaps: {
      browserApiKey: googleMaps.browserApiKey ?? "",
      browserApiKeyPreview: maskKey(googleMaps.browserApiKey),
      hasBrowserApiKey: Boolean(googleMaps.browserApiKey),
      mapId: googleMaps.mapId ?? "",
      techMapId: googleMaps.techMapId ?? "",
      serverGeocodingKeyPreview: maskKey(googleMaps.geocodingApiKey),
      hasServerGeocodingKey: Boolean(googleMaps.geocodingApiKey || googleMaps.browserApiKey)
    }
  };
}

export function updateIntegrationSettings(update: IntegrationSettingsUpdate) {
  const currentStored = readStoredSettings();
  const next: StoredIntegrationSettings = {
    ...currentStored,
    googleMaps: {
      ...(currentStored.googleMaps ?? {})
    },
    updatedAt: new Date().toISOString()
  };

  if (update.googleMaps) {
    const googleMaps = next.googleMaps ?? {};
    applySecretUpdate(googleMaps, "browserApiKey", update.googleMaps.browserApiKey, update.googleMaps.clearBrowserApiKey);
    applySecretUpdate(googleMaps, "geocodingApiKey", update.googleMaps.geocodingApiKey, update.googleMaps.clearGeocodingApiKey);

    if (update.googleMaps.mapId !== undefined) {
      googleMaps.mapId = cleanSetting(update.googleMaps.mapId);
    }
    if (update.googleMaps.techMapId !== undefined) {
      googleMaps.techMapId = cleanSetting(update.googleMaps.techMapId);
    }

    next.googleMaps = removeEmptyValues(googleMaps);
  }

  writeStoredSettings(removeEmptyValues(next));
  return readAdminIntegrationSettings();
}

export function googleMapsGeocodingKey() {
  const googleMaps = readIntegrationSettings().googleMaps ?? {};
  return googleMaps.geocodingApiKey || googleMaps.browserApiKey || "";
}

function readEnvSettings(): StoredIntegrationSettings {
  return {
    googleMaps: removeEmptyValues({
      browserApiKey:
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
        process.env.GOOGLE_MAPS_API_KEY?.trim() ||
        "",
      geocodingApiKey: process.env.GOOGLE_MAPS_GEOCODING_API_KEY?.trim() || "",
      mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || "",
      techMapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_TECH_MAP_ID?.trim() || ""
    })
  };
}

function readStoredSettings(): StoredIntegrationSettings {
  const filePath = settingsPath();
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as StoredIntegrationSettings;
  } catch {
    return {};
  }
}

function writeStoredSettings(settings: StoredIntegrationSettings) {
  const filePath = settingsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(settings, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

function mergeSettings(envSettings: StoredIntegrationSettings, storedSettings: StoredIntegrationSettings) {
  return {
    ...envSettings,
    ...storedSettings,
    googleMaps: {
      ...(envSettings.googleMaps ?? {}),
      ...(storedSettings.googleMaps ?? {})
    }
  };
}

function applySecretUpdate(
  target: Record<string, string | undefined>,
  key: string,
  value: string | undefined,
  shouldClear = false
) {
  if (shouldClear) {
    delete target[key];
    return;
  }
  const cleaned = cleanSetting(value);
  if (cleaned) target[key] = cleaned;
}

function cleanSetting(value: string | undefined) {
  return value?.trim() ?? "";
}

function removeEmptyValues<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null || entry === "") return false;
      if (typeof entry === "object" && !Array.isArray(entry)) {
        return Object.keys(entry).length > 0;
      }
      return true;
    })
  ) as T;
}

function maskKey(key: string | undefined) {
  if (!key) return "";
  if (key.length <= 10) return "saved";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

function settingsPath() {
  return path.join(storageDir(), SETTINGS_FILENAME);
}

function storageDir() {
  return path.resolve(process.cwd(), process.env.BASECAMP_STORAGE_DIR ?? ".basecamp-data");
}
