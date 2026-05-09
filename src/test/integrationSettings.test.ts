import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  googleMapsGeocodingKey,
  readAdminIntegrationSettings,
  readClientIntegrationSettings,
  updateIntegrationSettings
} from "@/lib/integrationSettings";

describe("integrationSettings", () => {
  const previousEnv = {
    BASECAMP_STORAGE_DIR: process.env.BASECAMP_STORAGE_DIR,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
    NEXT_PUBLIC_GOOGLE_MAPS_TECH_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_TECH_MAP_ID,
    GOOGLE_MAPS_GEOCODING_API_KEY: process.env.GOOGLE_MAPS_GEOCODING_API_KEY
  };
  let tempDir = "";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "basecamp-integrations-"));
    process.env.BASECAMP_STORAGE_DIR = tempDir;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_TECH_MAP_ID;
    delete process.env.GOOGLE_MAPS_GEOCODING_API_KEY;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { force: true, recursive: true });
    restoreEnv("BASECAMP_STORAGE_DIR", previousEnv.BASECAMP_STORAGE_DIR);
    restoreEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", previousEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
    restoreEnv("NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID", previousEnv.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID);
    restoreEnv("NEXT_PUBLIC_GOOGLE_MAPS_TECH_MAP_ID", previousEnv.NEXT_PUBLIC_GOOGLE_MAPS_TECH_MAP_ID);
    restoreEnv("GOOGLE_MAPS_GEOCODING_API_KEY", previousEnv.GOOGLE_MAPS_GEOCODING_API_KEY);
  });

  it("uses environment defaults when no runtime settings are saved", () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "env-browser-key";
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID = "env-map";
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_TECH_MAP_ID = "env-tech-map";
    process.env.GOOGLE_MAPS_GEOCODING_API_KEY = "env-geocoding-key";

    expect(readClientIntegrationSettings()).toEqual({
      googleMaps: {
        browserApiKey: "env-browser-key",
        mapId: "env-map",
        techMapId: "env-tech-map",
        hasServerGeocodingKey: true
      }
    });
    expect(googleMapsGeocodingKey()).toBe("env-geocoding-key");
  });

  it("persists runtime Google Maps settings for admin and map bootstrap reads", () => {
    const admin = updateIntegrationSettings({
      googleMaps: {
        browserApiKey: "runtime-browser-key",
        mapId: "runtime-map",
        techMapId: "runtime-tech-map"
      }
    });

    expect(admin.googleMaps.hasBrowserApiKey).toBe(true);
    expect(admin.googleMaps.browserApiKeyPreview).toBe("runtim...-key");
    expect(readClientIntegrationSettings().googleMaps).toMatchObject({
      browserApiKey: "runtime-browser-key",
      mapId: "runtime-map",
      techMapId: "runtime-tech-map",
      hasServerGeocodingKey: true
    });
    expect(googleMapsGeocodingKey()).toBe("runtime-browser-key");
  });

  it("clears the saved browser key without clearing map IDs", () => {
    updateIntegrationSettings({
      googleMaps: {
        browserApiKey: "runtime-browser-key",
        mapId: "runtime-map",
        techMapId: "runtime-tech-map"
      }
    });

    updateIntegrationSettings({ googleMaps: { clearBrowserApiKey: true } });

    expect(readAdminIntegrationSettings().googleMaps).toMatchObject({
      hasBrowserApiKey: false,
      mapId: "runtime-map",
      techMapId: "runtime-tech-map"
    });
    expect(readClientIntegrationSettings().googleMaps.browserApiKey).toBe("");
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
