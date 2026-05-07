"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Compass,
  MessageSquare,
  Send,
  Settings2
} from "lucide-react";
import { AnimatedAvatar } from "./AnimatedAvatar";
import { recommendResources, makePlanCards } from "@/lib/recommendations";
import type {
  AiSettings,
  FounderProfile,
  FounderStage,
  Resource,
  WizardResponse
} from "@/lib/types";

const stageOptions: Array<{ value: FounderStage; label: string }> = [
  { value: "idea", label: "Idea" },
  { value: "validate", label: "Validate" },
  { value: "start", label: "Start" },
  { value: "fund", label: "Fund" },
  { value: "grow", label: "Grow" },
  { value: "exit", label: "Exit" }
];

const defaultSettings: AiSettings = {
  provider: "mock",
  model: "basecamp-local-guide",
  thinkingLevel: "medium"
};

export function FounderNavigator({
  resources,
  industries,
  counties,
  communities,
  compact = false
}: {
  resources: Resource[];
  industries: string[];
  counties: string[];
  communities: string[];
  compact?: boolean;
}) {
  const [profile, setProfile] = useState<FounderProfile>({
    stage: "start",
    industry: industries[0] ?? "Software and Information Technology",
    county: counties.includes("Salt Lake") ? "Salt Lake" : counties[0] ?? "Utah",
    community: communities[0] ?? "Any",
    goal: "Find permits, capital, and a mentor I can talk to this week.",
    mode: "guided"
  });
  const [message, setMessage] = useState(profile.goal);
  const [response, setResponse] = useState<WizardResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const localRecommendations = useMemo(
    () => recommendResources(profile, resources, compact ? 3 : 5),
    [compact, profile, resources]
  );
  const localPlan = useMemo(
    () => makePlanCards(profile, localRecommendations),
    [localRecommendations, profile]
  );
  const shownRecommendations = response?.recommendations ?? localRecommendations;
  const shownPlan = response?.planCards ?? localPlan;

  async function runNavigator() {
    setLoading(true);
    try {
      const stored =
        typeof window === "undefined" ? null : window.localStorage.getItem("basecamp.aiSettings");
      const settings = stored ? (JSON.parse(stored) as AiSettings) : defaultSettings;
      const result = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings, profile, message })
      });
      setResponse((await result.json()) as WizardResponse);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={compact ? "navigator compact" : "navigator"}>
      <div className="navigator__workbench">
        <div className="section-heading">
          <span className="eyebrow">
            <Compass size={15} aria-hidden="true" />
            Founder navigator
          </span>
          <h1>{compact ? "Get a path in under two minutes" : "Basecamp Command Center"}</h1>
          <p>
            A guided intake, grounded recommendations, and a persistent workbench for founders who
            do not have time to decode a resource library.
          </p>
        </div>

        <div className="segmented-control" aria-label="Navigator mode">
          <button
            type="button"
            className={profile.mode === "guided" ? "active" : ""}
            onClick={() => setProfile({ ...profile, mode: "guided" })}
          >
            <Bot size={16} aria-hidden="true" />
            Guided
          </button>
          <button
            type="button"
            className={profile.mode === "manual" ? "active" : ""}
            onClick={() => setProfile({ ...profile, mode: "manual" })}
          >
            <Settings2 size={16} aria-hidden="true" />
            Manual
          </button>
        </div>

        <div className="intake-grid">
          <label className="select-field">
            <span>Stage</span>
            <select
              value={profile.stage}
              onChange={(event) =>
                setProfile({ ...profile, stage: event.target.value as FounderStage })
              }
            >
              {stageOptions.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </select>
          </label>
          <label className="select-field">
            <span>Industry</span>
            <select
              value={profile.industry}
              onChange={(event) => setProfile({ ...profile, industry: event.target.value })}
            >
              {industries.slice(0, 30).map((industry) => (
                <option key={industry}>{industry}</option>
              ))}
            </select>
          </label>
          <label className="select-field">
            <span>County</span>
            <select
              value={profile.county}
              onChange={(event) => setProfile({ ...profile, county: event.target.value })}
            >
              {counties.slice(0, 35).map((county) => (
                <option key={county}>{county}</option>
              ))}
            </select>
          </label>
          <label className="select-field">
            <span>Community</span>
            <select
              value={profile.community}
              onChange={(event) => setProfile({ ...profile, community: event.target.value })}
            >
              {communities.slice(0, 25).map((community) => (
                <option key={community}>{community}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="message-box">
          <span>
            <MessageSquare size={16} aria-hidden="true" />
            What are you trying to do next?
          </span>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
        </label>

        <div className="navigator-actions">
          <button className="primary-button" type="button" onClick={runNavigator} disabled={loading}>
            <Send size={16} aria-hidden="true" />
            {loading ? "Building path..." : "Build my path"}
          </button>
          <Link className="ghost-button" href="/admin/ai">
            <Settings2 size={16} aria-hidden="true" />
            AI settings
          </Link>
        </div>
      </div>

      <aside className="navigator__results">
        <AnimatedAvatar />
        <div className="assistant-answer">
          <span className="eyebrow">
            <Bot size={15} aria-hidden="true" />
            {response?.usedProvider ?? "local guide"}
          </span>
          <p>
            {response?.assistantMessage ??
              "Set your stage, location, and goal. Basecamp prefilters the corpus before any model sees it, then returns cited resources only."}
          </p>
        </div>

        <div className="recommendation-list">
          {shownRecommendations.map((item) => (
            <article className="recommendation-card" key={item.resource.slug}>
              <div>
                <span>{Math.round(item.score)} match</span>
                <h3>{item.resource.title}</h3>
                <p>{item.why}</p>
              </div>
              <Link href={item.resource.link} target="_blank" aria-label={`Open ${item.resource.title}`}>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>

        {!compact && (
          <div className="plan-list">
            {shownPlan.map((card) => (
              <div className="plan-item" key={card.title}>
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>{card.title}</span>
                <small>{card.dueWindow.replace("_", " ")}</small>
              </div>
            ))}
          </div>
        )}
      </aside>
    </section>
  );
}
