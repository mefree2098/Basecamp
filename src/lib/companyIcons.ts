import "server-only";

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import type { Company } from "./types";

export type CompanyIcon = {
  url: string;
  source: "html" | "manifest" | "fallback";
  fetchedAt: string;
};

type CachedCompanyIcon =
  | (CompanyIcon & {
      status: "ok";
      website: string;
    })
  | {
      status: "miss";
      website: string;
      fetchedAt: string;
      reason: string;
    };

const STORAGE_DIR = path.resolve(
  process.cwd(),
  process.env.BASECAMP_STORAGE_DIR ?? ".basecamp-data"
);
const ICON_CACHE_PATH = path.join(STORAGE_DIR, "company-icons.server.json");
const DEFAULT_BATCH_SIZE = 32;
const DEFAULT_CONCURRENCY = 10;
const REQUEST_TIMEOUT_MS = 3500;
const MAX_HTML_BYTES = 320_000;

export async function ensureCompanyIcons(companies: Company[]) {
  const cache = loadCache();
  const pending = companies
    .filter((company) => company.website)
    .filter((company) => !cache[iconCacheKey(company)])
    .slice(0, envNumber("BASECAMP_ICON_BATCH_SIZE", DEFAULT_BATCH_SIZE));

  if (pending.length > 0) {
    await mapWithConcurrency(pending, envNumber("BASECAMP_ICON_CONCURRENCY", DEFAULT_CONCURRENCY), async (company) => {
      const key = iconCacheKey(company);
      try {
        const icon = await discoverCompanyIcon(company.website ?? "");
        cache[key] = icon
          ? {
              ...icon,
              website: normalizeUrl(company.website ?? "") ?? company.website ?? "",
              status: "ok"
            }
          : {
              status: "miss",
              website: normalizeUrl(company.website ?? "") ?? company.website ?? "",
              fetchedAt: new Date().toISOString(),
              reason: "No favicon or touch icon found."
            };
      } catch (error) {
        cache[key] = {
          status: "miss",
          website: normalizeUrl(company.website ?? "") ?? company.website ?? "",
          fetchedAt: new Date().toISOString(),
          reason: error instanceof Error ? error.message : "Unable to resolve company icon."
        };
      }
      saveCache(cache);
    });
  }

  return iconsFromCache(companies, cache);
}

export function getCachedCompanyIcons(companies: Company[]) {
  return iconsFromCache(companies, loadCache());
}

export async function getCompanyIcon(company: Company) {
  const icons = await ensureCompanyIcons([company]);
  return icons[company.slug];
}

function iconsFromCache(companies: Company[], cache: Record<string, CachedCompanyIcon>) {
  const icons: Record<string, CompanyIcon> = {};
  for (const company of companies) {
    const cached = cache[iconCacheKey(company)];
    if (cached?.status === "ok") {
      icons[company.slug] = {
        url: cached.url,
        source: cached.source,
        fetchedAt: cached.fetchedAt
      };
    }
  }
  return icons;
}

async function discoverCompanyIcon(rawWebsite: string): Promise<CompanyIcon | null> {
  const website = normalizeUrl(rawWebsite);
  if (!website) return null;

  const response = await fetchWithTimeout(website, {
    headers: {
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "User-Agent": "BasecampStartupState/1.0"
    },
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(`Website returned HTTP ${response.status}.`);
  }

  const html = await readLimitedText(response, MAX_HTML_BYTES);
  const pageUrl = response.url || website;
  const htmlCandidates = collectHtmlIconCandidates(html, pageUrl);
  const manifestCandidates = await collectManifestCandidates(html, pageUrl);
  const fallbackCandidates = faviconFallbackCandidates(pageUrl);

  for (const candidate of [...htmlCandidates, ...manifestCandidates, ...fallbackCandidates]) {
    if (await looksLikeImage(candidate.url)) {
      return {
        url: candidate.url,
        source: candidate.source,
        fetchedAt: new Date().toISOString()
      };
    }
  }
  return null;
}

function collectHtmlIconCandidates(html: string, pageUrl: string) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => attributesFromTag(match[0] ?? ""))
    .filter((attributes) => {
      const rel = attributes.rel?.toLowerCase() ?? "";
      return attributes.href && (rel.includes("icon") || rel.includes("apple-touch-icon"));
    })
    .map((attributes) => ({
      url: absoluteUrl(attributes.href ?? "", pageUrl),
      source: "html" as const,
      score: scoreIconCandidate(attributes)
    }))
    .filter((candidate): candidate is { url: string; source: "html"; score: number } => Boolean(candidate.url))
    .sort((a, b) => b.score - a.score);
}

async function collectManifestCandidates(html: string, pageUrl: string) {
  const manifestLink = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => attributesFromTag(match[0] ?? ""))
    .find((attributes) => attributes.rel?.toLowerCase().includes("manifest") && attributes.href);
  const manifestUrl = absoluteUrl(manifestLink?.href ?? "", pageUrl);
  if (!manifestUrl) return [];
  try {
    const response = await fetchWithTimeout(manifestUrl, {
      headers: {
        Accept: "application/manifest+json,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": "BasecampStartupState/1.0"
      }
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { icons?: Array<{ src?: string; sizes?: string }> };
    return (payload.icons ?? [])
      .map((icon) => ({
        url: absoluteUrl(icon.src ?? "", manifestUrl),
        source: "manifest" as const,
        score: scoreSizeAttribute(icon.sizes)
      }))
      .filter((candidate): candidate is { url: string; source: "manifest"; score: number } => Boolean(candidate.url))
      .sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

function faviconFallbackCandidates(pageUrl: string) {
  const origin = safeOrigin(pageUrl);
  if (!origin) return [];
  return [
    { url: `${origin}/favicon.ico`, source: "fallback" as const },
    { url: `${origin}/favicon.png`, source: "fallback" as const },
    { url: `${origin}/apple-touch-icon.png`, source: "fallback" as const }
  ];
}

function attributesFromTag(tag: string) {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) {
    attributes[(match[1] ?? "").toLowerCase()] = match[2] ?? "";
  }
  return attributes;
}

function scoreIconCandidate(attributes: Record<string, string>) {
  const rel = attributes.rel?.toLowerCase() ?? "";
  let score = scoreSizeAttribute(attributes.sizes);
  if (rel.includes("apple-touch-icon")) score += 400;
  if (rel === "icon" || rel === "shortcut icon") score += 200;
  if ((attributes.type ?? "").includes("svg")) score -= 100;
  return score;
}

function scoreSizeAttribute(value?: string) {
  if (!value) return 0;
  if (value === "any") return 256;
  return Math.max(
    0,
    ...value
      .split(/\s+/)
      .map((part) => {
        const size = part.match(/(\d+)x(\d+)/i);
        return size ? Number(size[1]) * Number(size[2]) : 0;
      })
  );
}

async function looksLikeImage(url: string) {
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8",
        Range: "bytes=0-4095",
        "User-Agent": "BasecampStartupState/1.0"
      },
      redirect: "follow"
    });
    if (!response.ok && response.status !== 206) return false;
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    return contentType.startsWith("image/") || /\.(ico|png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url);
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  assertPublicHttpUrl(url);
  return fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
}

async function readLimitedText(response: Response, maxBytes: number) {
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const slice = value.slice(0, Math.max(0, maxBytes - total));
    chunks.push(slice);
    total += slice.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  let index = 0;
  const count = Math.max(1, concurrency);
  await Promise.all(
    Array.from({ length: Math.min(count, items.length) }, async () => {
      while (index < items.length) {
        const item = items[index];
        index += 1;
        if (item) await worker(item);
      }
    })
  );
}

function loadCache() {
  try {
    if (!fs.existsSync(ICON_CACHE_PATH)) return {};
    return JSON.parse(fs.readFileSync(ICON_CACHE_PATH, "utf8")) as Record<string, CachedCompanyIcon>;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CachedCompanyIcon>) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  fs.writeFileSync(ICON_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

function iconCacheKey(company: Company) {
  return `${company.slug}|${normalizeUrl(company.website ?? "") ?? company.website ?? ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    assertPublicHttpUrl(url.toString());
    return url.toString();
  } catch {
    return undefined;
  }
}

function absoluteUrl(value: string, baseUrl: string) {
  if (!value || value.startsWith("data:")) return undefined;
  try {
    const url = new URL(value, baseUrl);
    assertPublicHttpUrl(url.toString());
    return url.toString();
  } catch {
    return undefined;
  }
}

function safeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function assertPublicHttpUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP(S) company websites can be scanned.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Localhost websites are not scanned.");
  }
  const ipVersion = net.isIP(host);
  if (!ipVersion) return;
  if (ipVersion === 4 && isPrivateIpv4(host)) {
    throw new Error("Private network websites are not scanned.");
  }
  if (ipVersion === 6 && (host === "::1" || host.startsWith("fc") || host.startsWith("fd"))) {
    throw new Error("Private network websites are not scanned.");
  }
}

function isPrivateIpv4(value: string) {
  const parts = value.split(".").map(Number);
  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name] ?? "");
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
