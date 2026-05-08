import "server-only";

export type IngestedJob = {
  title: string;
  location?: string;
  url?: string;
  type?: string;
};

const MAX_JOBS = 25;

export async function ingestJobsFromUrl(rawUrl: string) {
  const url = normalizeUrl(rawUrl);
  if (!url) throw new Error("A valid ATS or careers URL is required.");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      "User-Agent": "BasecampStartupState/1.0"
    },
    signal: AbortSignal.timeout(9000)
  });
  if (!response.ok) {
    throw new Error(`Careers URL returned HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const baseUrl = response.url || url;
  const jobs = contentType.includes("json") || looksLikeJson(text)
    ? collectJobsFromJson(safeJson(text), baseUrl)
    : collectJobsFromHtml(text, baseUrl);

  return dedupeJobs(jobs).slice(0, MAX_JOBS);
}

function collectJobsFromJson(value: unknown, baseUrl: string): IngestedJob[] {
  const jobs: IngestedJob[] = [];
  visitJson(value, (item) => {
    const title = stringValue(item.title) || stringValue(item.name) || stringValue(item.jobTitle);
    if (!title || !looksLikeRole(title, stringValue(item.url))) return;
    jobs.push({
      title: cleanText(title),
      location: locationFromJson(item.location),
      url: absoluteUrl(
        stringValue(item.url) ||
          stringValue(item.absoluteUrl) ||
          stringValue(item.hostedUrl) ||
          stringValue(item.applyUrl),
        baseUrl
      ),
      type: stringValue(item.employmentType) || stringValue(item.commitment)
    });
  });
  return jobs;
}

function collectJobsFromHtml(html: string, baseUrl: string): IngestedJob[] {
  const jobs: IngestedJob[] = [];
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    jobs.push(...collectJobsFromJson(safeJson(decodeEntities(match[1] ?? "")), baseUrl));
  }

  for (const match of html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1] ?? "";
    const title = cleanText(stripTags(decodeEntities(match[2] ?? "")));
    if (!looksLikeRole(title, href)) continue;
    jobs.push({
      title,
      url: absoluteUrl(href, baseUrl)
    });
  }

  return jobs;
}

function visitJson(value: unknown, callback: (item: Record<string, unknown>) => void) {
  if (Array.isArray(value)) {
    value.forEach((item) => visitJson(item, callback));
    return;
  }
  if (!value || typeof value !== "object") return;
  const item = value as Record<string, unknown>;
  callback(item);
  Object.values(item).forEach((child) => visitJson(child, callback));
}

function locationFromJson(value: unknown): string | undefined {
  if (typeof value === "string") return cleanText(value);
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  const address = item.address && typeof item.address === "object" ? (item.address as Record<string, unknown>) : item;
  return [address.addressLocality, address.addressRegion, address.addressCountry]
    .map(stringValue)
    .filter((part): part is string => Boolean(part))
    .map((part) => cleanText(part))
    .join(", ") || undefined;
}

function dedupeJobs(jobs: IngestedJob[]) {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = `${job.title}|${job.url ?? ""}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function looksLikeRole(title: string, href?: string) {
  const cleanTitle = cleanText(title);
  if (cleanTitle.length < 4 || cleanTitle.length > 110) return false;
  const combined = `${cleanTitle} ${href ?? ""}`.toLowerCase();
  return /engineer|developer|designer|manager|sales|marketing|product|analyst|scientist|operator|director|specialist|intern|role|job|career|position|greenhouse|lever|ashby|workable/.test(
    combined
  );
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).toString();
  } catch {
    return undefined;
  }
}

function absoluteUrl(value: string | undefined, baseUrl: string) {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, " ");
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function looksLikeJson(value: string) {
  return /^[\s\r\n]*[\[{]/.test(value);
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}
