"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bookmark, Filter, Search, SlidersHorizontal } from "lucide-react";
import type { Resource } from "@/lib/types";

type Facet = { label: string; count: number };

export function ResourceExplorer({
  resources,
  facets,
  compact = false
}: {
  resources: Resource[];
  facets: {
    stages: Facet[];
    topics: Facet[];
    counties: Facet[];
    industries: Facet[];
    communities: Facet[];
  };
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [topic, setTopic] = useState("");
  const [county, setCounty] = useState("");
  const [industry, setIndustry] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return resources
      .filter((resource) => {
        const haystack = [
          resource.title,
          resource.description,
          ...resource.topics,
          ...resource.locations,
          ...resource.industries
        ]
          .join(" ")
          .toLowerCase();
        return (
          (!needle || haystack.includes(needle)) &&
          (!stage || resource.stages.includes(stage as Resource["stages"][number])) &&
          (!topic || resource.topics.includes(topic)) &&
          (!county || resource.locations.includes(county)) &&
          (!industry || resource.industries.includes(industry))
        );
      })
      .slice(0, compact ? 6 : 48);
  }, [county, industry, q, resources, stage, topic, compact]);

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
        {filtered.length} matching resources from {resources.length} seeded records
      </div>

      <div className="resource-grid">
        {filtered.map((resource) => (
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
