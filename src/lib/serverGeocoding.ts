import "server-only";

import fs from "node:fs";
import path from "node:path";
import { googleMapsGeocodingKey } from "./integrationSettings";
import type { Company } from "./types";

type CachedGeocode =
  | {
      status: "ok";
      lat: number;
      lng: number;
      confidence: "google";
      formattedAddress: string;
      fetchedAt: string;
    }
  | {
      status: "miss";
      fetchedAt: string;
      reason: string;
    };

export type ServerGeocodedLocations = Record<
  string,
  {
    lat: number;
    lng: number;
    confidence: "google";
    formattedAddress?: string;
  }
>;

const STORAGE_DIR = path.resolve(
  process.cwd(),
  process.env.BASECAMP_STORAGE_DIR ?? ".basecamp-data"
);
const DATA_DIR = path.resolve(process.cwd(), process.env.BASECAMP_DATA_DIR ?? "data");
const GEOCODE_CACHE_PATH = path.join(STORAGE_DIR, "google-geocodes.server.json");
const BUNDLED_GEOCODE_CACHE_PATH = path.join(DATA_DIR, "google-geocodes.server.json");

export async function ensureServerGeocodes(companies: Company[]) {
  const cache = loadCache();
  const key = googleGeocodingKey();
  const batchSize = Number(process.env.BASECAMP_GEOCODE_BATCH_SIZE ?? "260");
  const pending = key
    ? companies
        .filter((company) => isGeocodableCompany(company))
        .filter((company) => !cache[geocodeCacheKey(company)])
        .slice(0, Number.isFinite(batchSize) ? Math.max(0, batchSize) : 260)
    : [];

  for (const company of pending) {
    const cacheKey = geocodeCacheKey(company);
    try {
      const result = await geocodeAddress(company.address, key);
      cache[cacheKey] = result
        ? {
            status: "ok",
            lat: result.lat,
            lng: result.lng,
            confidence: "google",
            formattedAddress: result.formattedAddress,
            fetchedAt: new Date().toISOString()
          }
        : {
            status: "miss",
            fetchedAt: new Date().toISOString(),
            reason: "No exact Google geocode result."
          };
      saveCache(cache);
      await delay(70);
    } catch (error) {
      cache[cacheKey] = {
        status: "miss",
        fetchedAt: new Date().toISOString(),
        reason: error instanceof Error ? error.message : "Google geocoding failed."
      };
      saveCache(cache);
      break;
    }
  }

  return locationsFromCache(companies, cache);
}

function locationsFromCache(companies: Company[], cache: Record<string, CachedGeocode>) {
  const locations: ServerGeocodedLocations = {};
  for (const company of companies) {
    const cached = cache[geocodeCacheKey(company)];
    if (cached?.status === "ok") {
      locations[company.slug] = {
        lat: cached.lat,
        lng: cached.lng,
        confidence: "google",
        formattedAddress: cached.formattedAddress
      };
    }
  }
  return locations;
}

async function geocodeAddress(address: string, key: string) {
  const params = new URLSearchParams({
    address,
    components: "administrative_area:UT|country:US",
    region: "us",
    key
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`, {
    cache: "no-store"
  });
  const payload = (await response.json()) as {
    status?: string;
    error_message?: string;
    results?: Array<{
      formatted_address: string;
      partial_match?: boolean;
      geometry: {
        location: {
          lat: number;
          lng: number;
        };
      };
    }>;
  };
  if (payload.status !== "OK") {
    if (payload.status === "ZERO_RESULTS") return null;
    throw new Error(payload.error_message || `Google geocoding returned ${payload.status || "unknown"}.`);
  }
  const result = payload.results?.find((item) => !item.partial_match) ?? payload.results?.[0];
  if (!result || result.partial_match) return null;
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address
  };
}

function loadCache() {
  return {
    ...readCacheFile(BUNDLED_GEOCODE_CACHE_PATH),
    ...readCacheFile(GEOCODE_CACHE_PATH)
  };
}

function saveCache(cache: Record<string, CachedGeocode>) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  fs.writeFileSync(GEOCODE_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

function googleGeocodingKey() {
  return (
    googleMapsGeocodingKey() ||
    process.env.GOOGLE_MAPS_GEOCODING_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  );
}

function isGeocodableCompany(company: Company) {
  return Boolean(
    company.coordinates.confidence !== "source" &&
      company.address &&
      /\but\b|\butah\b/i.test(company.address)
  );
}

function geocodeCacheKey(company: Company) {
  return `${company.name}|${company.address}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readCacheFile(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return {} as Record<string, CachedGeocode>;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, CachedGeocode>;
  } catch {
    return {} as Record<string, CachedGeocode>;
  }
}
