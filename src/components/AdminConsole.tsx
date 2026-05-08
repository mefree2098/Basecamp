"use client";

import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Check,
  ClipboardList,
  DatabaseZap,
  FileUp,
  MapPinned,
  ShieldCheck,
  Upload,
  X
} from "lucide-react";
import { fetchJson } from "@/lib/apiClient";
import type {
  AdminSummaryResponse,
  CompanyDraftSummary,
  PublicCompanyImportPreview,
  PublicCompanyImportResult
} from "@/lib/types";

export function AdminConsole() {
  const [kind, setKind] = useState<"resources" | "companies">("resources");
  const [csv, setCsv] = useState("");
  const [status, setStatus] = useState("");
  const [resourceCount, setResourceCount] = useState(0);
  const [companyCount, setCompanyCount] = useState(0);
  const [needsReview, setNeedsReview] = useState(0);
  const [drafts, setDrafts] = useState<CompanyDraftSummary[]>([]);
  const [draftStatus, setDraftStatus] = useState("");
  const [publicPreview, setPublicPreview] = useState<PublicCompanyImportPreview | null>(null);
  const [publicLimit, setPublicLimit] = useState(1000);
  const [publicImportStatus, setPublicImportStatus] = useState("");

  const loadSummary = useCallback(async () => {
    const result = await fetchJson<AdminSummaryResponse>("/api/admin/summary");
    setResourceCount(result.resourceCount);
    setCompanyCount(result.companyCount);
    setNeedsReview(result.needsReview);
    setDrafts(result.drafts);
  }, []);

  const loadPublicPreview = useCallback(async () => {
    const preview = await fetchJson<PublicCompanyImportPreview>("/api/admin/public-company-import");
    setPublicPreview(preview);
    setPublicLimit(preview.defaultLimit);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSummary().catch(() =>
        setDraftStatus("Could not load admin summary from the platform API.")
      );
      void loadPublicPreview().catch(() =>
        setPublicImportStatus("Could not reach the UGRC public source preview.")
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadPublicPreview, loadSummary]);

  async function loadCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
    setStatus(`Loaded ${file.name}. Review the CSV below, then import.`);
    event.target.value = "";
  }

  async function importCsv() {
    setStatus("Importing...");
    const result: { count?: number; error?: string } = await fetchJson<{
      count?: number;
      error?: string;
    }>("/api/admin/imports", {
      method: "POST",
      body: JSON.stringify({ kind, csv })
    }).catch((error) => ({ error: error instanceof Error ? error.message : "Import failed." }));
    setStatus(result.error ? result.error : `Imported ${result.count ?? 0} ${kind}.`);
    if (!result.error) void loadSummary();
  }

  async function importPublicSource() {
    setPublicImportStatus("Importing vetted public business records...");
    const result = await fetchJson<PublicCompanyImportResult>("/api/admin/public-company-import", {
      method: "POST",
      body: JSON.stringify({ limit: publicLimit })
    }).catch((error) => ({
      error: error instanceof Error ? error.message : "Public business import failed."
    }));
    if ("error" in result) {
      setPublicImportStatus(result.error);
      return;
    }
    setPublicPreview(result);
    setPublicImportStatus(
      `Imported ${result.importedCount.toLocaleString()} records from ${result.source.name}. ` +
        `${result.skippedDuplicateCount.toLocaleString()} duplicates skipped.`
    );
    await loadSummary();
  }

  async function reviewDraft(id: string, action: "approve" | "reject") {
    setDraftStatus(`${action === "approve" ? "Approving" : "Rejecting"} draft...`);
    const result = await fetchJson<{ error?: string }>("/api/company-drafts", {
      method: "PATCH",
      body: JSON.stringify({ id, action })
    }).catch((error) => ({ error: error instanceof Error ? error.message : "Draft review failed." }));
    if (result.error) {
      setDraftStatus(result.error);
      return;
    }
    setDraftStatus(action === "approve" ? "Draft approved and published." : "Draft rejected.");
    await loadSummary();
  }

  return (
    <section className="admin-console">
      <div className="section-heading">
        <span className="eyebrow">
          <ShieldCheck size={15} aria-hidden="true" />
          Operator console
        </span>
        <h1>Update without redeploying</h1>
        <p>
          Upload resource or company CSVs, review freshness flags, and tune AI providers from one
          state-friendly operating surface.
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <DatabaseZap size={20} aria-hidden="true" />
          <strong>{resourceCount}</strong>
          <span>Resources seeded</span>
        </div>
        <div className="stat-card">
          <ClipboardList size={20} aria-hidden="true" />
          <strong>{companyCount}</strong>
          <span>Company profiles</span>
        </div>
        <div className="stat-card">
          <ShieldCheck size={20} aria-hidden="true" />
          <strong>{needsReview}</strong>
          <span>Freshness flags</span>
        </div>
        <Link className="stat-card stat-card--link" href="/admin/ai">
          <Bot size={20} aria-hidden="true" />
          <strong>AI</strong>
          <span>Providers, Codex auth, and maps key</span>
        </Link>
      </div>

      <div className="admin-grid">
        <div className="admin-panel">
          <h2>CSV import</h2>
          <label className="select-field">
            <span>Dataset</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
              <option value="resources">Resources</option>
              <option value="companies">Companies</option>
            </select>
          </label>
          <label className="file-import-field">
            <span>
              <FileUp size={15} aria-hidden="true" />
              Upload CSV file
            </span>
            <input type="file" accept=".csv,text/csv" onChange={(event) => void loadCsvFile(event)} />
          </label>
          <label className="message-box">
            <span>Paste CSV</span>
            <textarea
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              placeholder="Paste a CSV export here. It will be stored as a local override."
            />
          </label>
          <button className="primary-button" type="button" onClick={importCsv} disabled={!csv.trim()}>
            <Upload size={16} aria-hidden="true" />
            Import dataset
          </button>
          {status && <p className="status-line">{status}</p>}
        </div>

        <div className="admin-panel">
          <h2>Public business source</h2>
          <p>
            Import cross-industry Utah business records from UGRC Utah Open Source Places. This
            source is maintained through Utah&apos;s SGID, updated monthly, and keeps source
            provenance on every imported profile.
          </p>
          <div className="source-import-card">
            <strong>{publicPreview?.source.name ?? "Loading public source..."}</strong>
            <span>
              {publicPreview
                ? `${publicPreview.availableCount.toLocaleString()} eligible business records available`
                : "Checking UGRC ArcGIS source"}
            </span>
            {publicPreview && (
              <Link className="text-link" href={publicPreview.source.url} target="_blank">
                Source details
                <MapPinned size={15} aria-hidden="true" />
              </Link>
            )}
          </div>
          <label className="select-field">
            <span>Import limit</span>
            <select value={publicLimit} onChange={(event) => setPublicLimit(Number(event.target.value))}>
              <option value={500}>500 records</option>
              <option value={1000}>1,000 records</option>
              <option value={2500}>2,500 records</option>
              <option value={5000}>5,000 records</option>
            </select>
          </label>
          <button
            className="primary-button"
            type="button"
            onClick={() => void importPublicSource()}
            disabled={!publicPreview}
          >
            <DatabaseZap size={16} aria-hidden="true" />
            Import public businesses
          </button>
          {publicImportStatus && <p className="status-line">{publicImportStatus}</p>}
        </div>

        <div className="admin-panel">
          <h2>Review queue</h2>
          <div className="draft-review-list">
            {drafts.length > 0 ? (
              drafts.slice(0, 8).map((draft) => {
                const hasDomainMatch = draft.domainMatch?.ok ?? false;
                return (
                  <article className="draft-review-card" key={draft.id}>
                    <div className="draft-review-card__heading">
                      <div>
                        <strong>{draft.payload?.name ?? "Untitled company draft"}</strong>
                        <span>
                          {draft.verificationStatus.replace("_", " ")} · {draft.status.replace("_", " ")}
                        </span>
                      </div>
                      <span className={hasDomainMatch ? "status-pill hiring" : "status-pill"}>
                        {hasDomainMatch ? "Domain match" : "Manual check"}
                      </span>
                    </div>
                    <p>{draft.domainMatch?.reason ?? "This draft was created before domain matching existed."}</p>
                    <div className="draft-change-list">
                      {(draft.changes ?? []).slice(0, 5).map((change) => (
                        <div key={`${draft.id}-${change.field}`}>
                          <span>{change.field}</span>
                          <strong>{change.after}</strong>
                          {change.before && <small>Was: {change.before}</small>}
                        </div>
                      ))}
                    </div>
                    <div className="card-actions">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void reviewDraft(draft.id, "approve")}
                        disabled={draft.status === "approved"}
                      >
                        <Check size={16} aria-hidden="true" />
                        Approve
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void reviewDraft(draft.id, "reject")}
                        disabled={draft.status === "rejected"}
                      >
                        <X size={16} aria-hidden="true" />
                        Reject
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="queue-item">
                <Check size={17} aria-hidden="true" />
                <div>
                  <strong>Company claims</strong>
                  <span>Domain and work-email checks appear here before publish.</span>
                </div>
              </div>
            )}
          </div>
          {draftStatus && <p className="status-line">{draftStatus}</p>}
          <div className="queue-item">
            <Check size={17} aria-hidden="true" />
            <div>
              <strong>Freshness review</strong>
              <span>Time-sensitive imports are flagged so stale events do not outrank evergreen help.</span>
            </div>
          </div>
          <div className="queue-item">
            <MapPinned size={17} aria-hidden="true" />
            <div>
              <strong>Maps readiness</strong>
              <span>Google Maps key checks live beside AI settings under Admin.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
