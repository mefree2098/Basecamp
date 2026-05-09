"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, MapPinned, Shield } from "lucide-react";
import type { AdminIntegrationSettings } from "@/lib/types";

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

export function MapsIntegrationSettings() {
  const [integrationSettings, setIntegrationSettings] = useState<AdminIntegrationSettings | null>(null);
  const [mapsKey, setMapsKey] = useState("");
  const [mapsMapId, setMapsMapId] = useState("");
  const [mapsTechMapId, setMapsTechMapId] = useState("");
  const [mapsStatus, setMapsStatus] = useState("Loading saved Google Maps settings...");

  const savedMapsKey = integrationSettings?.googleMaps.browserApiKey ?? "";
  const effectiveMapsKey = mapsKey.trim() || savedMapsKey || bakedGoogleMapsApiKey;

  const loadIntegrationSettings = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadIntegrationSettings();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadIntegrationSettings]);

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
      setMapsStatus("Maps JavaScript, Geocoding, and Street View all responded for this browser key.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setMapsStatus(
        /geocod|ApiNotActivated|REQUEST_DENIED/i.test(message)
          ? "Maps JavaScript works, but this exact key cannot use Geocoding API. If Geocoding is enabled, verify the key belongs to that project and key API restrictions include Geocoding API."
          : "Google Maps permission check failed. Verify Maps JavaScript API, Geocoding API, billing, Street View support, and HTTP referrer restrictions."
      );
    }
  }

  return (
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
        Restrict this browser key to trusted HTTP referrers in Google Cloud. Server-side geocoding
        uses the same saved key unless a dedicated geocoding key is configured in the environment.
      </p>
      <p className="status-line">{mapsStatus}</p>
    </div>
  );
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
