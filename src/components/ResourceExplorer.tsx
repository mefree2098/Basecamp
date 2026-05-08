"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bookmark, Filter, Search, SlidersHorizontal } from "lucide-react";
import { fetchJson } from "@/lib/apiClient";
import type { Facet, Resource, ResourceListResponse } from "@/lib/types";

export function ResourceExplorer({
  compact = false
}: {
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [topic, setTopic] = useState("");
  const [county, setCounty] = useState("");
  const [industry, setIndustry] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [facets, setFacets] = useState<ResourceListResponse["facets"]>(emptyFacets);
  const [totalApprox, setTotalApprox] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading resources...");

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: String(compact ? 6 : 48) });
      if (q.trim()) params.set("q", q.trim());
      if (stage) params.set("stage", stage);
      if (topic) params.set("topic", topic);
      if (county) params.set("county", county);
      if (industry) params.set("industry", industry);
      setLoading(true);
      fetchJson<ResourceListResponse>(`/api/resources?${params.toString()}`)
        .then((data) => {
          if (!active) return;
          setResources(data.items);
          setFacets(data.facets);
          setTotalApprox(data.page.totalApprox);
          setStatus("");
        })
        .catch(() => {
          if (active) setStatus("Basecamp could not load resources from the platform API.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [compact, county, industry, q, stage, topic]);

  return (
    <section className={compact ? "resource-explorer compact" : "resource-explorer"}>
      <div className="section-heading">
        <span className="eyebrow">
          <Filter size={15} aria-hidden="true" />
          Manual mode
        </span>
        <h2>Resource Explorer</h2>
        <p>
          Filter the Startup State corpus directly when a founder wants control instead of chat.
        </p>
      </div>

      <div className="toolbar" aria-label="Resource filters">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search resources, counties, industries..."
          />
        </label>
        <Select label="Stage" value={stage} onChange={setStage} options={facets.stages} />
        <Select label="Topic" value={topic} onChange={setTopic} options={facets.topics} />
        <Select label="County" value={county} onChange={setCounty} options={facets.counties} />
        {!compact && (
          <Select
            label="Industry"
            value={industry}
            onChange={setIndustry}
            options={facets.industries}
          />
        )}
      </div>

      <div className="result-meta">
        <SlidersHorizontal size={16} aria-hidden="true" />
        {status || (loading ? "Updating results..." : `${resources.length} shown from ${totalApprox} matching records`)}
      </div>

      <div className="resource-grid">
        {resources.map((resource) => (
          <article className="resource-card" key={resource.slug}>
            <div>
              <div className="resource-card__meta">
                {resource.stages.slice(0, 2).join(" / ")}
                {resource.freshness.status === "needs_review" && <span>Needs review</span>}
              </div>
              <h3>{resource.title}</h3>
              <p>{resource.description}</p>
            </div>
            <div className="tag-row">
              {resource.topics.slice(0, 3).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="card-actions">
              <button className="ghost-button" type="button">
                <Bookmark size={16} aria-hidden="true" />
                Save
              </button>
              <Link className="text-link" href={resource.link} target="_blank">
                Open
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const emptyFacets: ResourceListResponse["facets"] = {
  stages: [],
  topics: [],
  counties: [],
  industries: [],
  communities: [],
  sectors: [],
  companyStages: [],
  employeeBands: [],
  companyLocations: []
};

function Select({
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
        {options.slice(0, 40).map((option) => (
          <option key={option.label} value={option.label}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}
