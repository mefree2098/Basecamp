"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Check, ClipboardList, DatabaseZap, ShieldCheck, Upload } from "lucide-react";

export function AdminConsole({
  resourceCount,
  companyCount,
  needsReview
}: {
  resourceCount: number;
  companyCount: number;
  needsReview: number;
}) {
  const [kind, setKind] = useState<"resources" | "companies">("resources");
  const [csv, setCsv] = useState("");
  const [status, setStatus] = useState("");

  async function importCsv() {
    setStatus("Importing...");
    const response = await fetch("/api/admin/imports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, csv })
    });
    const result = (await response.json()) as { count?: number; error?: string };
    setStatus(result.error ? result.error : `Imported ${result.count ?? 0} ${kind}.`);
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
          <span>Providers and Codex auth</span>
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
          <div className="queue-item">
            <Check size={17} aria-hidden="true" />
            <div>
              <strong>Company claims</strong>
              <span>Domain and work-email checks are queued before publish.</span>
            </div>
          </div>
          <div className="queue-item">
            <Check size={17} aria-hidden="true" />
            <div>
              <strong>Freshness review</strong>
              <span>Time-sensitive imports are flagged so stale events do not outrank evergreen help.</span>
            </div>
          </div>
          <div className="queue-item">
            <Check size={17} aria-hidden="true" />
            <div>
              <strong>Dedupe review</strong>
              <span>Seed data is preserved, but operators can replace it with corrected profiles.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
