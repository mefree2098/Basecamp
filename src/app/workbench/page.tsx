import Link from "next/link";
import { CheckCircle2, Download, FolderKanban, History, Star } from "lucide-react";

export default function WorkbenchPage() {
  return (
    <div className="page-stack">
      <section className="workbench">
        <div className="section-heading">
          <span className="eyebrow">
            <FolderKanban size={15} aria-hidden="true" />
            Founder workbench
          </span>
          <h1>Saved paths and next actions</h1>
          <p>
            The prototype keeps this local-first. Auth-backed persistence can slot behind the same
            cards when the deployment moves to managed Postgres.
          </p>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <Star size={20} aria-hidden="true" />
            <strong>0</strong>
            <span>Saved resources</span>
          </div>
          <div className="stat-card">
            <CheckCircle2 size={20} aria-hidden="true" />
            <strong>3</strong>
            <span>Suggested next actions</span>
          </div>
          <div className="stat-card">
            <History size={20} aria-hidden="true" />
            <strong>Local</strong>
            <span>Session persistence</span>
          </div>
          <Link className="stat-card stat-card--link" href="/resources">
            <Download size={20} aria-hidden="true" />
            <strong>Export</strong>
            <span>Plan pack ready</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
