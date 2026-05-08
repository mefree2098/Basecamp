import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clearDataCaches, loadCompanies, slugify } from "./data";
import { coordinatesForAddress, locationForAddress } from "./geo";
import { emailConfigured, sendTransactionalEmail } from "./email";
import type { Company } from "./types";

const STORAGE_DIR = path.resolve(
  process.cwd(),
  process.env.BASECAMP_STORAGE_DIR ?? ".basecamp-data"
);
const DRAFT_DIR = path.join(STORAGE_DIR, "company-drafts");
const OVERRIDE_PATH = path.join(STORAGE_DIR, "companies.override.json");
const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 3;

export const companyDraftInputSchema = z.object({
  companySlug: z.string().optional(),
  name: z.string().min(1),
  website: z.string().optional(),
  workEmail: z.string().email().or(z.literal("")).optional(),
  sector: z.string().optional(),
  stage: z.string().optional(),
  employees: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  linkedin: z.string().optional(),
  foundedYear: z.string().optional(),
  hiringStatus: z.enum(["unknown", "hiring", "not_hiring"]).optional(),
  jobsUrl: z.string().optional(),
  atsUrl: z.string().optional(),
  jobPostings: z.string().optional(),
  gallery: z.string().optional()
});

export type CompanyDraftInput = z.infer<typeof companyDraftInputSchema>;

export type CompanyDraft = {
  id: string;
  status: "queued" | "awaiting_review" | "approved" | "rejected";
  verificationStatus: "pending_email" | "email_verified" | "domain_mismatch" | "needs_contact";
  submittedAt: string;
  verifiedAt?: string;
  reviewedAt?: string;
  reviewerNote?: string;
  emailDeliveryStatus: "not_configured" | "sent" | "failed" | "skipped";
  emailDeliveryError?: string;
  tokenHash?: string;
  tokenExpiresAt?: string;
  domainMatch: {
    ok: boolean;
    emailDomain?: string;
    websiteDomain?: string;
    reason: string;
  };
  changes: CompanyDraftChange[];
  payload: CompanyDraftInput;
};

export type CompanyDraftChange = {
  field: string;
  before: string;
  after: string;
};

export function listCompanyDrafts() {
  ensureDraftDir();
  return fs
    .readdirSync(DRAFT_DIR)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => readDraft(entry.replace(/\.json$/, "")))
    .filter((draft): draft is CompanyDraft => Boolean(draft))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function createCompanyDraft(input: CompanyDraftInput, requestUrl: string) {
  ensureDraftDir();
  const companies = loadCompanies();
  const existing =
    (input.companySlug && companies.find((company) => company.slug === input.companySlug)) ||
    companies.find((company) => company.slug === slugify(input.name));
  const id = `draft_${crypto.randomUUID()}`;
  const submittedAt = new Date().toISOString();
  const domainMatch = checkDomainMatch(input.workEmail, input.website || existing?.website);
  const token =
    input.workEmail && domainMatch.ok ? crypto.randomBytes(TOKEN_BYTES).toString("base64url") : "";
  const tokenExpiresAt = token ? new Date(Date.now() + TOKEN_TTL_MS).toISOString() : undefined;
  const draft: CompanyDraft = {
    id,
    status: token ? "queued" : "awaiting_review",
    verificationStatus: token ? "pending_email" : input.workEmail ? "domain_mismatch" : "needs_contact",
    submittedAt,
    emailDeliveryStatus: token ? "skipped" : "skipped",
    tokenHash: token ? hashToken(token) : undefined,
    tokenExpiresAt,
    domainMatch,
    changes: buildDraftChanges(input, existing),
    payload: input
  };

  if (token && input.workEmail) {
    const verificationUrl = buildVerificationUrl(requestUrl, id, token);
    try {
      const result = await sendClaimVerificationEmail(input, verificationUrl);
      draft.emailDeliveryStatus = result.delivered ? "sent" : "not_configured";
      draft.emailDeliveryError = result.delivered ? undefined : result.reason;
    } catch (error) {
      draft.emailDeliveryStatus = "failed";
      draft.emailDeliveryError = error instanceof Error ? error.message : "Unable to send email.";
    }
  }

  writeDraft(draft);
  return {
    draft,
    magicLinkSent: draft.emailDeliveryStatus === "sent",
    emailConfigured: emailConfigured()
  };
}

export function verifyCompanyDraft(draftId: string, token: string) {
  const draft = readDraft(draftId);
  if (!draft) {
    throw new Error("Draft not found.");
  }
  if (!draft.tokenHash || !token) {
    throw new Error("This draft does not have an active verification token.");
  }
  if (draft.tokenExpiresAt && Date.parse(draft.tokenExpiresAt) < Date.now()) {
    throw new Error("This verification link has expired.");
  }
  if (hashToken(token) !== draft.tokenHash) {
    throw new Error("Invalid verification token.");
  }
  const verified: CompanyDraft = {
    ...draft,
    status: "awaiting_review",
    verificationStatus: "email_verified",
    verifiedAt: new Date().toISOString(),
    tokenHash: undefined,
    tokenExpiresAt: undefined
  };
  writeDraft(verified);
  return verified;
}

export function approveCompanyDraft(draftId: string, reviewerNote = "") {
  const draft = readDraft(draftId);
  if (!draft) throw new Error("Draft not found.");
  const companies = loadCompanies();
  const existing =
    (draft.payload.companySlug && companies.find((company) => company.slug === draft.payload.companySlug)) ||
    companies.find((company) => company.slug === slugify(draft.payload.name));
  const approvedCompany = companyFromDraft(draft.payload, existing);
  const approvedName = approvedCompany.name ?? draft.payload.name;
  const overrides = readCompanyOverrides();
  const nextOverrides = [
    approvedCompany,
    ...overrides.filter((company) => slugify(company.name ?? "") !== slugify(approvedName))
  ];
  ensureStorageDir();
  fs.writeFileSync(OVERRIDE_PATH, `${JSON.stringify(nextOverrides, null, 2)}\n`, "utf8");
  clearDataCaches();
  const approved: CompanyDraft = {
    ...draft,
    status: "approved",
    reviewerNote,
    reviewedAt: new Date().toISOString()
  };
  writeDraft(approved);
  return { draft: approved, company: approvedCompany };
}

export function rejectCompanyDraft(draftId: string, reviewerNote = "") {
  const draft = readDraft(draftId);
  if (!draft) throw new Error("Draft not found.");
  const rejected: CompanyDraft = {
    ...draft,
    status: "rejected",
    reviewerNote,
    reviewedAt: new Date().toISOString()
  };
  writeDraft(rejected);
  return rejected;
}

export function redirectAfterVerification(requestUrl: string, result: "success" | "error", message = "") {
  const url = new URL("/submit-company", requestUrl);
  url.searchParams.set("verification", result);
  if (message) url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

function sendClaimVerificationEmail(input: CompanyDraftInput, verificationUrl: string) {
  const companyName = input.name.trim();
  return sendTransactionalEmail({
    to: input.workEmail ?? "",
    subject: `Verify your ${companyName} Startup State profile claim`,
    text: [
      `Verify your ${companyName} Startup State profile claim:`,
      "",
      verificationUrl,
      "",
      "This link expires in 3 days. After verification, Startup State will review and publish the profile update."
    ].join("\n"),
    html: `<p>Verify your <strong>${escapeHtml(companyName)}</strong> Startup State profile claim.</p><p><a href="${verificationUrl}">Verify profile claim</a></p><p>This link expires in 3 days. After verification, Startup State will review and publish the profile update.</p>`
  });
}

function buildVerificationUrl(requestUrl: string, draftId: string, token: string) {
  const baseUrl = process.env.BASECAMP_PUBLIC_URL?.trim() || requestUrl;
  const url = new URL("/api/company-drafts/verify", baseUrl);
  url.searchParams.set("draftId", draftId);
  url.searchParams.set("token", token);
  return url.toString();
}

function checkDomainMatch(workEmail?: string, website?: string) {
  const emailDomain = domainFromEmail(workEmail);
  const websiteDomain = domainFromUrl(website);
  if (!emailDomain) {
    return { ok: false, emailDomain, websiteDomain, reason: "Work email is required for automatic verification." };
  }
  if (!websiteDomain) {
    return { ok: false, emailDomain, websiteDomain, reason: "Company website is required for domain matching." };
  }
  const ok = rootDomain(emailDomain) === rootDomain(websiteDomain);
  return {
    ok,
    emailDomain,
    websiteDomain,
    reason: ok
      ? "Work email domain matches the company website domain."
      : "Work email domain does not match the company website domain."
  };
}

function buildDraftChanges(input: CompanyDraftInput, existing?: Company) {
  const fields: Array<[keyof CompanyDraftInput, string, string | undefined]> = [
    ["name", "Name", existing?.name],
    ["website", "Website", existing?.website],
    ["employees", "Employees", existing?.employees],
    ["sector", "Sector", existing?.sector],
    ["stage", "Stage", existing?.stage],
    ["foundedYear", "Year founded", existing?.foundedYear ? String(existing.foundedYear) : undefined],
    ["linkedin", "LinkedIn", existing?.linkedin],
    ["description", "Description", existing?.description],
    ["address", "Address", existing?.address],
    ["hiringStatus", "Hiring status", existing?.hiringStatus],
    ["jobsUrl", "Job postings", existing?.jobsUrl],
    ["atsUrl", "ATS feed", existing?.atsUrl],
    ["gallery", "Photo gallery", existing?.gallery.join("\n")]
  ];
  return fields
    .map(([key, label, before]) => ({
      field: label,
      before: String(before ?? "").trim(),
      after: String(input[key] ?? "").trim()
    }))
    .filter((change) => change.after && change.before !== change.after);
}

function companyFromDraft(input: CompanyDraftInput, existing?: Company): Partial<Company> {
  const name = input.name.trim();
  const address = input.address?.trim() || existing?.address || "Utah";
  const website = normalizeUrl(input.website) || existing?.website;
  const foundedYear = input.foundedYear?.trim() ? Number(input.foundedYear.trim()) : existing?.foundedYear;
  return {
    ...(existing ?? {}),
    slug: slugify(name),
    name,
    displayType: existing?.displayType ?? "profile",
    linkedin: input.linkedin?.trim() || existing?.linkedin,
    address,
    location: locationForAddress(address) || existing?.location || "Utah",
    description: input.description?.trim() || existing?.description || "",
    website,
    stage: input.stage?.trim() || existing?.stage,
    employees: input.employees?.trim() || existing?.employees,
    sector: input.sector?.trim() || existing?.sector || "Uncategorized",
    hiringStatus: input.hiringStatus || existing?.hiringStatus || "unknown",
    foundedYear: Number.isFinite(foundedYear) ? foundedYear : undefined,
    jobsUrl: normalizeUrl(input.jobsUrl) || existing?.jobsUrl,
    atsUrl: normalizeUrl(input.atsUrl) || existing?.atsUrl,
    jobPostings: parseJobPostings(input.jobPostings) || existing?.jobPostings || [],
    gallery: parseLines(input.gallery).map((value) => normalizeUrl(value) || value),
    coordinates: existing?.coordinates ?? coordinatesForAddress(address, name),
    verificationStatus: "claimed"
  };
}

function readCompanyOverrides() {
  if (!fs.existsSync(OVERRIDE_PATH)) return [] as Array<Partial<Company>>;
  return JSON.parse(fs.readFileSync(OVERRIDE_PATH, "utf8")) as Array<Partial<Company>>;
}

function readDraft(id: string) {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(DRAFT_DIR, `${safeId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as CompanyDraft;
}

function writeDraft(draft: CompanyDraft) {
  ensureDraftDir();
  fs.writeFileSync(path.join(DRAFT_DIR, `${draft.id}.json`), `${JSON.stringify(draft, null, 2)}\n`, "utf8");
}

function ensureStorageDir() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function ensureDraftDir() {
  fs.mkdirSync(DRAFT_DIR, { recursive: true });
}

function hashToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function domainFromEmail(value?: string) {
  const domain = value?.split("@")[1]?.trim().toLowerCase();
  return domain || undefined;
}

function domainFromUrl(value?: string) {
  const normalized = normalizeUrl(value);
  if (!normalized) return undefined;
  try {
    return new URL(normalized).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

function rootDomain(value?: string) {
  const parts = value?.split(".").filter(Boolean) ?? [];
  return parts.slice(-2).join(".");
}

function normalizeUrl(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function parseLines(value?: string) {
  return (value ?? "")
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseJobPostings(value?: string) {
  const lines = parseLines(value);
  if (!lines.length) return undefined;
  return lines.map((line) => {
    const [title, location, url, type] = line.split("|").map((part) => part?.trim());
    return {
      title: title || "Open role",
      location,
      url: normalizeUrl(url),
      type
    };
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char] ?? char;
  });
}
