import "server-only";

import fs from "node:fs";
import path from "node:path";
import { clearDataCaches, loadCompanies, slugify } from "./data";
import type {
  Company,
  PublicCompanyImportPreview,
  PublicCompanyImportResult,
  PublicCompanyImportSource
} from "./types";

type OpenSourcePlaceAttributes = {
  osm_id?: string | number;
  name?: string;
  category?: string;
  county?: string;
  city?: string;
  zip?: string | number;
  osm_addr?: string;
  ugrc_addr?: string;
  lon?: number;
  lat?: number;
  amenity?: string;
  cuisine?: string;
  tourism?: string;
  shop?: string;
  website?: string;
  phone?: string;
  open_hours?: string;
};

type ArcGisQueryResponse = {
  count?: number;
  exceededTransferLimit?: boolean;
  features?: Array<{ attributes: OpenSourcePlaceAttributes }>;
  error?: {
    message?: string;
    details?: string[];
  };
};

const STORAGE_DIR = path.resolve(
  process.cwd(),
  process.env.BASECAMP_STORAGE_DIR ?? ".basecamp-data"
);
const COMPANY_OVERRIDE_PATH = path.join(STORAGE_DIR, "companies.override.json");
const FEATURE_SERVICE_URL =
  "https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/OpenSourcePlaces/FeatureServer/0";
const SOURCE: PublicCompanyImportSource = {
  id: "utah-open-source-places",
  name: "UGRC Utah Open Source Places",
  description:
    "Point representation of Utah places of interest, including businesses, restaurants, hotels, car dealers, shops, and other cross-industry local businesses.",
  url: "https://gis.utah.gov/products/sgid/society/open-source-places/",
  steward: "OpenStreetMap and Utah Geospatial Resource Center",
  license: "Open Database License via OpenStreetMap contributors",
  updateCadence: "Updated approximately monthly by UGRC",
  reliabilityNote:
    "State GIS-maintained SGID layer derived from OpenStreetMap, deduplicated, city/county enriched, and published through UGRC's ArcGIS FeatureServer."
};
const DEFAULT_IMPORT_LIMIT = 1000;
const MAX_IMPORT_LIMIT = 5000;
const PAGE_SIZE = 2000;
const BUSINESS_CATEGORIES = [
  "arts_centre",
  "bakery",
  "bank",
  "bar",
  "beauty_shop",
  "beverages",
  "bicycle_shop",
  "bookshop",
  "butcher",
  "cafe",
  "car_dealership",
  "car_rental",
  "car_wash",
  "chemist",
  "cinema",
  "clothes",
  "computer_shop",
  "convenience",
  "dentist",
  "department_store",
  "doctors",
  "doityourself",
  "fast_food",
  "florist",
  "food_court",
  "furniture_shop",
  "garden_centre",
  "general",
  "gift_shop",
  "golf_course",
  "greengrocer",
  "guesthouse",
  "hairdresser",
  "hotel",
  "jeweller",
  "laundry",
  "mall",
  "market_place",
  "mobile_phone_shop",
  "motel",
  "nightclub",
  "optician",
  "outdoor_shop",
  "pharmacy",
  "pub",
  "restaurant",
  "shoe_shop",
  "sports_centre",
  "sports_shop",
  "supermarket",
  "theatre",
  "toy_shop",
  "travel_agent",
  "veterinary",
  "video_shop"
];

const SOURCE_WHERE = [
  `category IN (${BUSINESS_CATEGORIES.map((category) => `'${category}'`).join(",")})`,
  "name IS NOT NULL",
  "lat IS NOT NULL",
  "lon IS NOT NULL"
].join(" AND ");

export async function previewPublicCompanyImport(): Promise<PublicCompanyImportPreview> {
  return {
    source: SOURCE,
    availableCount: await fetchAvailableCount(),
    defaultLimit: defaultImportLimit(),
    maxLimit: MAX_IMPORT_LIMIT,
    categories: BUSINESS_CATEGORIES
  };
}

export async function importPublicCompanies(limit = defaultImportLimit()): Promise<PublicCompanyImportResult> {
  const preview = await previewPublicCompanyImport();
  const normalizedLimit = clampLimit(limit);
  const fetchedPlaces = await fetchPlaces(normalizedLimit);
  const importedAt = new Date().toISOString();
  const candidates = fetchedPlaces
    .map((place) => companyFromPlace(place, importedAt))
    .filter((company): company is Company => Boolean(company));
  const existingOverrides = readCompanyOverrides();
  const retainedOverrides = existingOverrides.filter((company) => company.source?.id !== SOURCE.id);
  const existingCompanies = loadCompanies().filter((company) => company.source?.id !== SOURCE.id);
  const seen = new Set(existingCompanies.map(companyDedupeKey));
  const imported: Company[] = [];
  let skippedDuplicateCount = 0;

  for (const company of candidates) {
    const key = companyDedupeKey(company);
    if (seen.has(key)) {
      skippedDuplicateCount += 1;
      continue;
    }
    seen.add(key);
    imported.push(company);
  }

  writeCompanyOverrides([...imported, ...retainedOverrides]);
  clearDataCaches();

  return {
    ...preview,
    fetchedCount: fetchedPlaces.length,
    importedCount: imported.length,
    skippedDuplicateCount,
    storedPath: COMPANY_OVERRIDE_PATH
  };
}

async function fetchAvailableCount() {
  const payload = await queryArcGis({ returnCountOnly: "true" });
  return payload.count ?? 0;
}

async function fetchPlaces(limit: number) {
  const places: OpenSourcePlaceAttributes[] = [];
  let offset = 0;
  while (places.length < limit) {
    const payload = await queryArcGis({
      outFields:
        "osm_id,name,category,county,city,zip,osm_addr,ugrc_addr,lon,lat,amenity,cuisine,tourism,shop,website,phone,open_hours",
      returnGeometry: "false",
      resultRecordCount: String(Math.min(PAGE_SIZE, limit - places.length)),
      resultOffset: String(offset),
      orderByFields: "name ASC"
    });
    const page = payload.features?.map((feature) => feature.attributes) ?? [];
    if (page.length === 0) break;
    places.push(...page);
    offset += page.length;
    if (!payload.exceededTransferLimit && page.length < PAGE_SIZE) break;
  }
  return places.slice(0, limit);
}

async function queryArcGis(params: Record<string, string>) {
  const query = new URLSearchParams({
    f: "json",
    where: SOURCE_WHERE,
    ...params
  });
  const response = await fetch(`${FEATURE_SERVICE_URL}/query?${query.toString()}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`UGRC public business source returned HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as ArcGisQueryResponse;
  if (payload.error) {
    throw new Error(
      [payload.error.message, ...(payload.error.details ?? [])].filter(Boolean).join(" ")
    );
  }
  return payload;
}

function companyFromPlace(place: OpenSourcePlaceAttributes, importedAt: string): Company | null {
  const name = clean(place.name);
  const category = clean(place.category);
  const lat = Number(place.lat);
  const lng = Number(place.lon);
  if (!name || !category || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (/^\(?closed\)?\b/i.test(name) || /\bclosed\b/i.test(name)) return null;

  const location = titleCase(clean(place.city)) || titleCase(clean(place.county)) || "Utah";
  const address = buildAddress(place, location);
  const formattedCategory = formatCategory(category);
  const website = normalizeUrl(clean(place.website));
  const details = [
    formattedCategory,
    clean(place.cuisine) ? `${formatCategory(clean(place.cuisine))} cuisine` : "",
    clean(place.phone) ? `Phone: ${clean(place.phone)}` : "",
    clean(place.open_hours) ? `Hours: ${clean(place.open_hours)}` : ""
  ].filter(Boolean);

  return {
    slug: slugify(`${name}-${location}`),
    name,
    displayType: "public-business",
    address,
    location,
    description:
      `${name} is a Utah ${formattedCategory.toLowerCase()} listed in UGRC's Utah Open Source Places public dataset.` +
      (details.length > 0 ? ` ${details.join(" | ")}.` : ""),
    website,
    stage: undefined,
    employees: undefined,
    sector: sectorForCategory(category),
    hiringStatus: "unknown",
    foundedYear: undefined,
    jobsUrl: website ? `${website.replace(/\/$/, "")}/careers` : undefined,
    atsUrl: undefined,
    jobPostings: [],
    gallery: [],
    coordinates: {
      lat,
      lng,
      confidence: "source"
    },
    verificationStatus: "seeded",
    source: {
      id: SOURCE.id,
      name: SOURCE.name,
      url: SOURCE.url,
      sourceRecordId: place.osm_id ? String(place.osm_id) : undefined,
      fetchedAt: importedAt,
      license: SOURCE.license,
      note: SOURCE.reliabilityNote
    }
  };
}

function sectorForCategory(category: string) {
  if (["bank"].includes(category)) return "Financial Services";
  if (["dentist", "doctors", "chemist", "optician", "pharmacy", "veterinary"].includes(category)) {
    return "Life Sciences and Healthcare";
  }
  if (["arts_centre", "cinema", "golf_course", "nightclub", "sports_centre", "theatre"].includes(category)) {
    return "Arts, Entertainment, and Recreation";
  }
  if (["bar", "cafe", "fast_food", "food_court", "guesthouse", "hotel", "motel", "pub", "restaurant"].includes(category)) {
    return "Hospitality and Food Services";
  }
  if (category.includes("car_")) return "Automotive";
  if (category.includes("shop") || ["bakery", "beverages", "butcher", "clothes", "convenience", "department_store", "doityourself", "florist", "general", "greengrocer", "jeweller", "mall", "market_place", "supermarket", "toy_shop", "video_shop"].includes(category)) {
    return "Retail and Consumer Services";
  }
  return "Local Services";
}

function buildAddress(place: OpenSourcePlaceAttributes, location: string) {
  const rawAddress = clean(place.osm_addr) || clean(place.ugrc_addr);
  const zip = clean(String(place.zip ?? ""));
  if (!rawAddress) return [location, "UT", zip].filter(Boolean).join(", ");
  const hasUtah = /\bUT\b|\bUtah\b/i.test(rawAddress);
  const hasLocation = location && new RegExp(`\\b${escapeRegExp(location)}\\b`, "i").test(rawAddress);
  return [
    rawAddress,
    hasLocation ? "" : location,
    hasUtah ? "" : "UT",
    zip && !rawAddress.includes(zip) ? zip : ""
  ]
    .filter(Boolean)
    .join(", ");
}

function readCompanyOverrides() {
  try {
    if (!fs.existsSync(COMPANY_OVERRIDE_PATH)) return [] as Company[];
    return JSON.parse(fs.readFileSync(COMPANY_OVERRIDE_PATH, "utf8")) as Company[];
  } catch {
    return [];
  }
}

function writeCompanyOverrides(companies: Array<Partial<Company>>) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  fs.writeFileSync(COMPANY_OVERRIDE_PATH, `${JSON.stringify(companies, null, 2)}\n`, "utf8");
}

function companyDedupeKey(company: Pick<Company, "name" | "location">) {
  return `${slugify(company.name)}|${slugify(company.location || "utah")}`;
}

function defaultImportLimit() {
  return clampLimit(Number(process.env.BASECAMP_PUBLIC_BUSINESS_IMPORT_LIMIT ?? DEFAULT_IMPORT_LIMIT));
}

function clampLimit(limit: number) {
  if (!Number.isFinite(limit)) return DEFAULT_IMPORT_LIMIT;
  return Math.min(MAX_IMPORT_LIMIT, Math.max(1, Math.round(limit)));
}

function normalizeUrl(value?: string) {
  const trimmed = clean(value);
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function formatCategory(value: string) {
  return value
    .split(/[_;,\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function clean(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
