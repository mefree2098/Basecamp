"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ExternalLink, MapPin, Search } from "lucide-react";
import { projectUtahPoint } from "@/lib/geo";
import type { Company } from "@/lib/types";

type Facet = { label: string; count: number };

export function StartupMap({
  companies,
  facets,
  compact = false
}: {
  companies: Company[];
  facets: {
    sectors: Facet[];
    companyStages: Facet[];
    employeeBands: Facet[];
  };
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [employees, setEmployees] = useState("");
  const [selectedSlug, setSelectedSlug] = useState(companies[0]?.slug ?? "");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return companies.filter((company) => {
      const searchable = [
        company.name,
        company.description,
        company.sector,
        company.stage,
        company.address
      ]
        .join(" ")
        .toLowerCase();
      return (
        (!needle || searchable.includes(needle)) &&
        (!sector || company.sector === sector) &&
        (!stage || company.stage === stage) &&
        (!employees || company.employees === employees)
      );
    });
  }, [companies, employees, q, sector, stage]);

  const selected = filtered.find((company) => company.slug === selectedSlug) ?? filtered[0];

  return (
    <section className={compact ? "map-section compact" : "map-section"}>
      <div className="section-heading">
        <span className="eyebrow">
          <MapPin size={15} aria-hidden="true" />
          Investor map
        </span>
        <h2>Utah Startup Map</h2>
        <p>
          A keyless, low-cost map mode using seeded addresses now, with optional Azure Maps later.
        </p>
      </div>

      <div className="map-layout">
        <div className="map-panel" aria-label="Projected Utah startup map">
          <div className="utah-map-shape" />
          {filtered.slice(0, compact ? 80 : 180).map((company) => {
            const point = projectUtahPoint(company.coordinates.lat, company.coordinates.lng);
            const active = selected?.slug === company.slug;
            return (
              <button
                key={company.slug}
                className={active ? "map-pin active" : "map-pin"}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                type="button"
                aria-label={`Select ${company.name}`}
                onClick={() => setSelectedSlug(company.slug)}
              />
            );
          })}
          <div className="map-legend">
            <Building2 size={15} aria-hidden="true" />
            {filtered.length} startups
          </div>
        </div>

        <aside className="map-sidebar">
          <label className="search-field">
            <Search size={17} aria-hidden="true" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search companies or sectors"
            />
          </label>
          <div className="filter-row">
            <MapSelect label="Sector" value={sector} onChange={setSector} options={facets.sectors} />
            {!compact && (
              <>
                <MapSelect
                  label="Stage"
                  value={stage}
                  onChange={setStage}
                  options={facets.companyStages}
                />
                <MapSelect
                  label="Size"
                  value={employees}
                  onChange={setEmployees}
                  options={facets.employeeBands}
                />
              </>
            )}
          </div>

          {selected && (
            <article className="company-card featured">
              <div className="company-card__heading">
                <h3>{selected.name}</h3>
                <span>{selected.sector}</span>
              </div>
              <p>{selected.description}</p>
              <dl className="profile-facts">
                <div>
                  <dt>Stage</dt>
                  <dd>{selected.stage || "Unknown"}</dd>
                </div>
                <div>
                  <dt>Employees</dt>
                  <dd>{selected.employees || "Unknown"}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{selected.address || "Utah"}</dd>
                </div>
              </dl>
              <div className="card-actions">
                <Link className="primary-button" href={`/companies/${selected.slug}`}>
                  Profile
                </Link>
                {selected.website && (
                  <Link className="text-link" href={selected.website} target="_blank">
                    Website
                    <ExternalLink size={15} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </article>
          )}
        </aside>
      </div>
    </section>
  );
}

function MapSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Facet[];
}) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Any</option>
        {options.slice(0, 35).map((option) => (
          <option key={option.label} value={option.label}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}
