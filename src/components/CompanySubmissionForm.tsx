"use client";

import { useState } from "react";
import { Building2, Send, ShieldCheck } from "lucide-react";

export function CompanySubmissionForm() {
  const [form, setForm] = useState({
    name: "",
    website: "",
    workEmail: "",
    sector: "",
    stage: "",
    employees: "",
    address: "",
    description: "",
    hiringStatus: "unknown"
  });
  const [status, setStatus] = useState("");

  async function submit() {
    setStatus("Submitting draft...");
    const response = await fetch("/api/company-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const result = (await response.json()) as { id?: string; error?: string };
    setStatus(result.error ?? `Draft ${result.id} queued for verification and review.`);
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
            ["address", "Full address"]
          ].map(([key, label]) => (
            <label className="input-field" key={key}>
              <span>{label}</span>
              <input
                value={form[key as keyof typeof form]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
            </label>
          ))}
          <label className="message-box">
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
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
            The prototype queues drafts locally. Production can swap in email tokens, domain DNS
            checks, or reviewer assignment without changing the public flow.
          </p>
          <ol>
            <li>Submit profile draft.</li>
            <li>Verify work email or domain.</li>
            <li>Reviewer approves changes.</li>
            <li>Profile publishes to the map.</li>
          </ol>
        </aside>
      </div>
    </section>
  );
}
