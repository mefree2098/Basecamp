import "server-only";

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { coordinatesForAddress, locationForAddress } from "./geo";
import type { Company, FounderStage, Resource } from "./types";

type ResourceCsvRow = {
  id: string;
  Title: string;
  description: string;
  Communities: string;
  Industries: string;
  Locations: string;
  Topics: string;
  link: string;
  email: string;
};

type CompanyCsvRow = {
  "Display Type": string;
  "LinkedIn Link (map it to Links to get the logo)": string;
  "Startup Name ": string;
  "Startup Name"?: string;
  "Full Address": string;
  "Description of startup": string;
  Website: string;
  Stage: string;
  "# of Employees ": string;
  "# of Employees"?: string;
  Section: string;
};

const DATA_DIR = path.resolve(process.cwd(), process.env.BASECAMP_DATA_DIR ?? "data");
const STORAGE_DIR = path.resolve(
  process.cwd(),
  process.env.BASECAMP_STORAGE_DIR ?? ".basecamp-data"
);

let resourceCache: Resource[] | null = null;
let companyCache: Company[] | null = null;

const UTAH_COUNTIES = [
  "Beaver",
  "Box Elder",
  "Cache",
  "Carbon",
  "Daggett",
  "Davis",
  "Duchesne",
  "Emery",
  "Garfield",
  "Grand",
  "Iron",
  "Juab",
  "Kane",
  "Millard",
  "Morgan",
  "Piute",
  "Rich",
  "Salt Lake",
  "San Juan",
  "Sanpete",
  "Sevier",
  "Summit",
  "Tooele",
  "Uintah",
  "Utah",
  "Wasatch",
  "Washington",
  "Wayne",
  "Weber"
];

const STARTUP_INDUSTRIES = [
  "Aerospace and Defense",
  "Agriculture",
  "Arts and Entertainment and Recreation",
  "Consumer Packaged Goods",
  "Financial Services",
  "Hospitality and Food Services",
  "Life Sciences and Healthcare",
  "Manufacturing",
  "Other",
  "Software and Information Technology"
];

const FOUNDER_COMMUNITIES = [
  "Any",
  "Multicultural",
  "New American",
  "Rural",
  "Student",
  "Veteran",
  "Women"
];

export function loadResources() {
  if (resourceCache) {
    return resourceCache;
  }

  const csvPath = path.join(DATA_DIR, "resources.csv");
  const rows = parseCsv<ResourceCsvRow>(csvPath);
  const resources = rows
    .filter((row) => row.id && row.Title)
    .map((row) => {
      const topics = splitMulti(row.Topics);
      return {
        id: row.id.trim(),
        slug: slugify(`${row.Title}-${row.id}`),
        title: clean(row.Title),
        description: clean(row.description),
        communities: splitMulti(row.Communities),
        industries: splitMulti(row.Industries),
        locations: splitMulti(row.Locations),
        topics,
        stages: deriveStages(topics, row.description),
        link: directSeedLink(row),
        email: clean(row.email) || undefined,
        freshness: {
          status: needsReview(row) ? "needs_review" : "seeded",
          note: needsReview(row)
            ? "Imported from seed data and contains time-sensitive language."
            : "Imported from source spreadsheet."
        }
      } satisfies Resource;
    });

  resourceCache = mergeResourceOverrides([...foundationalStartupResources(), ...resources]);
  return resourceCache;
}

export function loadCompanies() {
  if (companyCache) {
    return companyCache;
  }

  const csvPath = path.join(DATA_DIR, "companies.csv");
  const rows = parseCsv<CompanyCsvRow>(csvPath);
  const companies = rows
    .filter((row) => clean(companyName(row)))
    .map((row) => {
      const name = clean(companyName(row));
      const address = clean(row["Full Address"]);
      const description = clean(row["Description of startup"]);
      const website = normalizeUrl(clean(row.Website));
      return {
        slug: slugify(name),
        name,
        displayType: clean(row["Display Type"]) || "profile",
        linkedin: clean(row["LinkedIn Link (map it to Links to get the logo)"]) || undefined,
        address,
        location: locationForAddress(address) || "Utah",
        description:
          description || `${name} is part of Utah's startup ecosystem and can enrich this profile through the self-service claim flow.`,
        website,
        stage: clean(row.Stage) || undefined,
        employees: clean(employeeBand(row)) || undefined,
        sector: clean(row.Section) || "Uncategorized",
        hiringStatus: inferHiringStatus(description),
        foundedYear: undefined,
        jobsUrl: website ? `${website.replace(/\/$/, "")}/careers` : undefined,
        atsUrl: undefined,
        jobPostings: [],
        gallery: [],
        coordinates: coordinatesForAddress(address, name),
        verificationStatus: "seeded"
      } satisfies Company;
    });

  companyCache = uniqueCompanySlugs(mergeCompanyOverrides(companies));
  return companyCache;
}

export function clearDataCaches() {
  resourceCache = null;
  companyCache = null;
}

export function resetDataCachesForTests() {
  clearDataCaches();
}

export function getFacets(resources = loadResources(), companies = loadCompanies()) {
  return {
    stages: facet(resources.flatMap((resource) => resource.stages)),
    topics: facet(resources.flatMap((resource) => resource.topics)),
    counties: facet(resources.flatMap((resource) => resource.locations), "alpha"),
    industries: facet(resources.flatMap((resource) => resource.industries)),
    communities: facet(resources.flatMap((resource) => resource.communities)),
    sectors: facet(companies.map((company) => company.sector ?? "Uncategorized")),
    companyStages: facet(companies.map((company) => company.stage ?? "Unknown")),
    employeeBands: facet(companies.map((company) => company.employees ?? "Unknown")),
    companyLocations: facet(companies.map((company) => company.location || "Utah"), "alpha")
  };
}

export function filterResources(
  resources: Resource[],
  filters: {
    q?: string;
    stage?: string;
    topic?: string;
    county?: string;
    industry?: string;
    community?: string;
  }
) {
  const q = filters.q?.trim().toLowerCase();
  return resources.filter((resource) => {
    const searchable = [
      resource.title,
      resource.description,
      ...resource.topics,
      ...resource.locations,
      ...resource.industries,
      ...resource.communities
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!q || searchable.includes(q)) &&
      (!filters.stage || resource.stages.includes(filters.stage as FounderStage)) &&
      (!filters.topic || includesFacet(resource.topics, filters.topic)) &&
      (!filters.county || includesFacet(resource.locations, filters.county)) &&
      (!filters.industry || includesFacet(resource.industries, filters.industry)) &&
      (!filters.community || includesFacet(resource.communities, filters.community))
    );
  });
}

export function filterCompanies(
  companies: Company[],
  filters: {
    q?: string;
    sector?: string;
    stage?: string;
    employees?: string;
    hiring?: string;
    location?: string;
  }
) {
  const q = filters.q?.trim().toLowerCase();
  return companies.filter((company) => {
    const searchable = [
      company.name,
      company.description,
      company.sector,
      company.stage,
      company.location,
      company.address
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!q || searchable.includes(q)) &&
      (!filters.sector || company.sector === filters.sector) &&
      (!filters.stage || company.stage === filters.stage) &&
      (!filters.employees || company.employees === filters.employees) &&
      (!filters.location || company.location === filters.location) &&
      (!filters.hiring || filters.hiring === "any" || company.hiringStatus === filters.hiring)
    );
  });
}

export function writeImportedCsv(kind: "resources" | "companies", csv: string) {
  ensureStorageDir();
  const parsed =
    kind === "resources"
      ? parseCsvText<ResourceCsvRow>(csv).map((row) => ({
          id: row.id || cryptoRandomId(),
          title: clean(row.Title),
          description: clean(row.description),
          communities: splitMulti(row.Communities),
          industries: splitMulti(row.Industries),
          locations: splitMulti(row.Locations),
          topics: splitMulti(row.Topics),
          link: clean(row.link),
          email: clean(row.email) || undefined
        }))
      : parseCsvText<CompanyCsvRow>(csv).map((row) => ({
          name: clean(companyName(row)),
          address: clean(row["Full Address"]),
          description: clean(row["Description of startup"]),
          website: clean(row.Website),
          stage: clean(row.Stage),
          employees: clean(employeeBand(row)),
          sector: clean(row.Section),
          linkedin: clean(row["LinkedIn Link (map it to Links to get the logo)"])
        }));

  const outputPath = path.join(STORAGE_DIR, `${kind}.override.json`);
  fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
  resourceCache = null;
  companyCache = null;
  return {
    count: parsed.length,
    path: outputPath
  };
}

function parseCsv<T>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, "utf8");
  return parseCsvText<T>(content);
}

function parseCsvText<T>(content: string): T[] {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_quotes: true,
    trim: true
  }) as T[];
}

function mergeResourceOverrides(resources: Resource[]) {
  const overrides = uniqueOverrideRows(
    readOverrideRows<Partial<Resource>>("resources.override.json"),
    (row) => row.id ?? row.slug ?? row.title ?? ""
  );
  if (overrides.length === 0) return resources;
  const imported = overrides
    .filter((row) => row.title)
    .map((row) => {
      const topics = row.topics ?? [];
      return {
        id: row.id ?? cryptoRandomId(),
        slug: slugify(`${row.title}-${row.id ?? cryptoRandomId()}`),
        title: row.title ?? "Untitled resource",
        description: row.description ?? "",
        communities: row.communities ?? [],
        industries: row.industries ?? [],
        locations: row.locations ?? [],
        topics,
        stages: row.stages ?? deriveStages(topics, row.description ?? ""),
        link: row.link ?? "",
        email: row.email,
        freshness: {
          status: "reviewed",
          reviewedAt: new Date().toISOString(),
          note: "Imported through Basecamp admin."
        }
      } satisfies Resource;
    });
  return [...imported, ...resources];
}

function mergeCompanyOverrides(companies: Company[]) {
  const overrides = uniqueOverrideRows(
    readOverrideRows<Partial<Company>>("companies.override.json"),
    (row) => row.slug ?? row.name ?? ""
  );
  if (overrides.length === 0) return companies;
  const imported = overrides
    .filter((row) => row.name)
    .map((row) => {
      const name = row.name ?? "Untitled company";
      const address = row.address ?? "Utah";
      return {
        slug: row.slug ?? slugify(name),
        name,
        displayType: row.displayType ?? "profile",
        linkedin: row.linkedin,
        address,
        location: normalizeLocationLabel(row.location) || locationForAddress(address) || "Utah",
        description: row.description ?? "",
        website: row.website,
        stage: row.stage,
        employees: row.employees,
        sector: row.sector ?? "Uncategorized",
        hiringStatus: row.hiringStatus ?? "unknown",
        foundedYear: row.foundedYear,
        jobsUrl: row.jobsUrl,
        atsUrl: row.atsUrl,
        jobPostings: row.jobPostings ?? [],
        gallery: row.gallery ?? [],
        coordinates: row.coordinates ?? coordinatesForAddress(address, name),
        verificationStatus: row.verificationStatus ?? "pending",
        source: row.source
      } satisfies Company;
    });
  return [...imported, ...companies];
}

function readOverrideRows<T>(filename: string) {
  return [
    ...readJsonArray<T>(path.join(STORAGE_DIR, filename)),
    ...readJsonArray<T>(path.join(DATA_DIR, filename))
  ];
}

function readJsonArray<T>(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return [] as T[];
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [] as T[];
  }
}

function uniqueOverrideRows<T>(rows: T[], keyFor: (row: T) => string) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = keyFor(row).toLowerCase().trim();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function foundationalStartupResources(): Resource[] {
  const seeded = {
    communities: FOUNDER_COMMUNITIES,
    industries: STARTUP_INDUSTRIES,
    locations: UTAH_COUNTIES,
    freshness: {
      status: "reviewed" as const,
      note: "Basecamp curated first-stop resource with a direct action link."
    }
  };

  return [
    {
      ...seeded,
      id: "basecamp-startup-state-registration",
      slug: "startup-state-registration-and-licensure",
      title: "Startup State registration and licensure",
      description:
        "Direct Startup State step for choosing a legal formation, getting an FEIN/EIN, registering with Utah, and checking state/local licensing before operating.",
      topics: ["Start a Business", "Registration", "Licensure", "Legal Formation", "EIN"],
      stages: ["start"],
      link: "https://startup.utah.gov/registration/"
    },
    {
      ...seeded,
      id: "basecamp-utah-form-new-business",
      slug: "utah-form-a-new-business",
      title: "Utah form a new business",
      description:
        "Direct Utah Division of Corporations path to form a Corporation, LLC, Partnership, Business Trust, DBA, or other business entity.",
      topics: ["Start a Business", "Registration", "Legal Formation", "LLC", "Corporation"],
      stages: ["start"],
      link: "https://commerce.utah.gov/corporations/business-entities/"
    },
    {
      ...seeded,
      id: "basecamp-irs-ein",
      slug: "irs-employer-identification-number",
      title: "IRS employer identification number",
      description:
        "Direct IRS EIN page for getting a federal employer identification number after forming a legal entity with the state.",
      topics: ["Start a Business", "Taxes and Finance", "EIN", "FEIN", "Registration"],
      stages: ["start"],
      link: "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number"
    },
    {
      ...seeded,
      id: "basecamp-sba-business-bank-account",
      slug: "startup-state-business-bank-account",
      title: "Startup State business bank account step",
      description:
        "Direct Startup State operations step for opening a business bank account once the founder has a legal business name, entity records, and tax ID.",
      topics: ["Start a Business", "Taxes and Finance", "Business Operations", "Bank Account"],
      stages: ["start"],
      link: "https://startup.utah.gov/business-operations/"
    },
    {
      ...seeded,
      id: "basecamp-sbdc-consultation",
      slug: "utah-sbdc-free-consultation",
      title: "Utah SBDC free consultation",
      description:
        "Direct Utah SBDC services page for free consultation on business setup, planning, finance, marketing, and startup operations.",
      topics: ["Start a Business", "Mentoring", "Business Plan", "Taxes and Finance"],
      stages: ["idea", "validate", "start"],
      link: "https://utahsbdc.org/services/"
    },
    {
      ...seeded,
      id: "basecamp-score-mentor",
      slug: "score-find-a-mentor",
      title: "SCORE find a mentor",
      description:
        "Direct SCORE mentoring path for matching with an experienced volunteer mentor to review a startup idea, launch plan, and first business decisions.",
      topics: ["Mentoring", "Start a Business", "Business Plan", "Marketing and Sales"],
      stages: ["idea", "validate", "start"],
      link: "https://www.score.org/ut/utah/mentors/"
    }
  ];
}

function directSeedLink(row: ResourceCsvRow) {
  const title = clean(row.Title).toLowerCase();
  if (title === "startup state") return "https://startup.utah.gov/registration/";
  if (title === "small business administration (sba)") {
    return "https://www.sba.gov/business-guide/launch-your-business";
  }
  if (title === "small business development center (sbdc)") return "https://utahsbdc.org/services/";
  if (title === "score") return "https://www.score.org/how-mentoring-works/";
  return clean(row.link);
}

function uniqueCompanySlugs(companies: Company[]) {
  const seen = new Map<string, number>();
  return companies.map((company) => {
    const count = seen.get(company.slug) ?? 0;
    seen.set(company.slug, count + 1);
    if (count === 0) return company;
    return {
      ...company,
      slug: `${company.slug}-${count + 1}`
    };
  });
}

function deriveStages(topics: string[], description: string): FounderStage[] {
  const text = `${topics.join(" ")} ${description}`.toLowerCase();
  const stages = new Set<FounderStage>();
  if (/(idea|mentor|community|education|skill|student)/.test(text)) stages.add("idea");
  if (/(validat|market|customer|prototype|product)/.test(text)) stages.add("validate");
  if (/(start|register|license|tax|business plan|operation)/.test(text)) stages.add("start");
  if (/(fund|grant|capital|loan|pitch|venture)/.test(text)) stages.add("fund");
  if (/(grow|growth|workforce|talent|export|contract|late stage)/.test(text)) stages.add("grow");
  if (/(exit|sell|close|succession)/.test(text)) stages.add("exit");
  if (stages.size === 0) stages.add("start");
  return Array.from(stages);
}

function splitMulti(value?: string) {
  if (!value) return [];
  return value
    .split(/[|,]/)
    .map(clean)
    .filter(Boolean);
}

function clean(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeLocationLabel(value?: string) {
  const cleaned = clean(value);
  if (/^st\.?\s*george$/i.test(cleaned) || /^saint george$/i.test(cleaned)) {
    return "St. George";
  }
  return cleaned;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100);
}

function normalizeUrl(value?: string) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function inferHiringStatus(description: string): Company["hiringStatus"] {
  return /hiring|careers|talent|join our team/i.test(description) ? "hiring" : "unknown";
}

function facet(values: Array<string | FounderStage | undefined>, sort: "count" | "alpha" = "count") {
  const counts = new Map<string, number>();
  values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) =>
      sort === "alpha" ? a.label.localeCompare(b.label) : b.count - a.count || a.label.localeCompare(b.label)
    );
}

function includesFacet(values: string[], filter: string) {
  return values.some((value) => value.toLowerCase() === filter.toLowerCase());
}

function needsReview(row: ResourceCsvRow) {
  return /202[0-9]|upcoming|deadline|summit|event|application/i.test(
    `${row.Title} ${row.description}`
  );
}

function companyName(row: CompanyCsvRow) {
  return row["Startup Name "] ?? row["Startup Name"] ?? "";
}

function employeeBand(row: CompanyCsvRow) {
  return row["# of Employees "] ?? row["# of Employees"] ?? "";
}

function ensureStorageDir() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function cryptoRandomId() {
  return `local_${Math.random().toString(36).slice(2, 10)}`;
}
