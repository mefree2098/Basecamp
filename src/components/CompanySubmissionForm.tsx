"use client";

import { useState } from "react";
import { Building2, FileUp, RefreshCw, Send, ShieldCheck } from "lucide-react";

const emptySubmissionForm = {
  companySlug: "",
  name: "",
  website: "",
  workEmail: "",
  sector: "",
  stage: "",
  employees: "",
  address: "",
  description: "",
  linkedin: "",
  foundedYear: "",
  hiringStatus: "unknown",
  jobsUrl: "",
  atsUrl: "",
  jobPostings: "",
  gallery: ""
};

export function CompanySubmissionForm() {
  const initialRouteState = readInitialSubmissionRouteState();
  const [form, setForm] = useState({ ...emptySubmissionForm, companySlug: initialRouteState.companySlug });
  const [status, setStatus] = useState(initialRouteState.status);
  const [uploadStatus, setUploadStatus] = useState("");
  const [ingestStatus, setIngestStatus] = useState("");

  async function uploadGalleryPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploadStatus("Uploading photos...");
    const body = new FormData();
    Array.from(files).forEach((file) => body.append("files", file));
    const response = await fetch("/api/uploads/gallery", {
      method: "POST",
      body
    });
    const result = (await response.json()) as { urls?: string[]; error?: string };
    if (result.error) {
      setUploadStatus(result.error);
      return;
    }
    const urls = result.urls ?? [];
    setForm((current) => ({
      ...current,
      gallery: [current.gallery.trim(), ...urls].filter(Boolean).join("\n")
    }));
    setUploadStatus(`Uploaded ${urls.length} photo${urls.length === 1 ? "" : "s"}.`);
  }

  async function importJobsFromAts() {
    if (!form.atsUrl.trim()) return;
    setIngestStatus("Importing jobs...");
    const response = await fetch("/api/ats/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: form.atsUrl })
    });
    const result = (await response.json()) as {
      jobs?: Array<{ title: string; location?: string; url?: string; type?: string }>;
      error?: string;
    };
    if (result.error) {
      setIngestStatus(result.error);
      return;
    }
    const rows = (result.jobs ?? []).map((job) =>
      [job.title, job.location ?? "", job.url ?? "", job.type ?? ""].join(" | ")
    );
    if (!rows.length) {
      setIngestStatus("No jobs found at that URL.");
      return;
    }
    setForm((current) => ({
      ...current,
      jobPostings: [current.jobPostings.trim(), ...rows].filter(Boolean).join("\n")
    }));
    setIngestStatus(`Imported ${rows.length} job${rows.length === 1 ? "" : "s"}.`);
  }

  async function submit() {
    setStatus("Submitting draft...");
    const response = await fetch("/api/company-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const result = (await response.json()) as {
      id?: string;
      error?: string;
      magicLinkSent?: boolean;
      verificationStatus?: string;
      domainMatch?: { ok: boolean; reason: string };
      emailDeliveryStatus?: string;
    };
    if (result.error) {
      setStatus(result.error);
      return;
    }
    if (result.magicLinkSent) {
      setStatus(`Draft ${result.id} queued. Check ${form.workEmail} for the verification link.`);
      return;
    }
    setStatus(
      `Draft ${result.id} queued for review. ${result.domainMatch?.reason ?? "Manual verification is required."}`
    );
  }

  return (
    <section className="submission-flow">
      <div className="section-heading">
        <span className="eyebrow">
          <Building2 size={15} aria-hidden="true" />
          Self-service profile
        </span>
        <h1>Claim or create a company profile</h1>
        <p>
          Rich startup map profiles are drafted by companies, verified by lightweight work-email
          checks, and published through review.
        </p>
      </div>
      <div className="submission-grid">
        <div className="admin-panel">
          <h2>Company details</h2>
          {[
            ["name", "Company name"],
            ["website", "Website"],
            ["workEmail", "Work email"],
            ["sector", "Sector"],
            ["stage", "Stage"],
            ["employees", "Employees"],
            ["address", "Full address"],
            ["linkedin", "LinkedIn"],
            ["foundedYear", "Year founded"],
            ["jobsUrl", "Job postings URL"],
            ["atsUrl", "ATS or careers feed URL"]
          ].map(([key, label]) => (
            <label className="input-field" key={key}>
              <span>{label}</span>
              <input
                value={form[key as keyof typeof form]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
            </label>
          ))}
          <button
            className="ghost-button"
            type="button"
            onClick={() => void importJobsFromAts()}
            disabled={!form.atsUrl.trim()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Import jobs
          </button>
          {ingestStatus && <p className="status-line">{ingestStatus}</p>}
          <label className="message-box">
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
          <label className="message-box">
            <span>Job postings</span>
            <textarea
              value={form.jobPostings}
              onChange={(event) => setForm({ ...form, jobPostings: event.target.value })}
              placeholder="One role per line. Use Title | Location | URL | Type"
            />
          </label>
          <label className="message-box">
            <span>Photo gallery URLs</span>
            <textarea
              value={form.gallery}
              onChange={(event) => setForm({ ...form, gallery: event.target.value })}
              placeholder="One image URL per line"
            />
          </label>
          <label className="input-field">
            <span>Upload gallery photos</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              onChange={(event) => void uploadGalleryPhotos(event.target.files)}
            />
          </label>
          {uploadStatus && (
            <p className="status-line">
              <FileUp size={14} aria-hidden="true" />
              {uploadStatus}
            </p>
          )}
          <label className="select-field">
            <span>Hiring status</span>
            <select
              value={form.hiringStatus}
              onChange={(event) => setForm({ ...form, hiringStatus: event.target.value })}
            >
              <option value="unknown">Unknown</option>
              <option value="hiring">Hiring</option>
              <option value="not_hiring">Not hiring</option>
            </select>
          </label>
          <button className="primary-button" type="button" onClick={submit} disabled={!form.name}>
            <Send size={16} aria-hidden="true" />
            Submit for review
          </button>
          {status && <p className="status-line">{status}</p>}
        </div>
        <aside className="verification-panel">
          <ShieldCheck size={28} aria-hidden="true" />
          <h2>Verification path</h2>
          <p>
            Basecamp sends a magic link to a work email and checks that the email domain matches
            the company website domain. Verified drafts still wait for an admin approve/reject pass.
          </p>
          <ol>
            <li>Submit profile draft.</li>
            <li>Verify the work-email magic link.</li>
            <li>Admin reviews the pending-change diff.</li>
            <li>Profile publishes to the map.</li>
          </ol>
        </aside>
      </div>
    </section>
  );
}

function readInitialSubmissionRouteState() {
  if (typeof window === "undefined") {
    return { companySlug: "", status: "" };
  }
  const params = new URLSearchParams(window.location.search);
  const companySlug = params.get("company") ?? "";
  const verification = params.get("verification");
  const message = params.get("message");
  if (verification === "success") {
    return {
      companySlug,
      status: "Work email verified. Your profile update is now waiting for admin review."
    };
  }
  if (verification === "error") {
    return { companySlug, status: message || "That verification link could not be used." };
  }
  return { companySlug, status: "" };
}
