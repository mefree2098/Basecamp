"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Check,
  ClipboardList,
  DatabaseZap,
  MapPinned,
  ShieldCheck,
  Upload,
  X
} from "lucide-react";
import { fetchJson } from "@/lib/apiClient";
import type { AdminSummaryResponse, CompanyDraftSummary } from "@/lib/types";

export function AdminConsole() {
  const [kind, setKind] = useState<"resources" | "companies">("resources");
  const [csv, setCsv] = useState("");
  const [status, setStatus] = useState("");
  const [resourceCount, setResourceCount] = useState(0);
  const [companyCount, setCompanyCount] = useState(0);
  const [needsReview, setNeedsReview] = useState(0);
  const [drafts, setDrafts] = useState<CompanyDraftSummary[]>([]);
  const [draftStatus, setDraftStatus] = useState("");

  const loadSummary = useCallback(async () => {
    const result = await fetchJson<AdminSummaryResponse>("/api/admin/summary");
    setResourceCount(result.resourceCount);
    setCompanyCount(result.companyCount);
    setNeedsReview(result.needsReview);
    setDrafts(result.drafts);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSummary().catch(() =>
        setDraftStatus("Could not load admin summary from the platform API.")
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadSummary]);

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
