"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Compass,
  ListFilter,
  MapPin,
  MessageSquare,
  Send,
  Sparkles
} from "lucide-react";
import { AnimatedAvatar, type GuidePetState } from "./AnimatedAvatar";
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
  const shownRecommendations = (response?.recommendations ?? localRecommendations).slice(
    0,
    compact ? 3 : 4
  );
  const shownPlan = response?.planCards ?? localPlan;
  const hasResults = Boolean(response);
  const petState: GuidePetState = loading ? "thinking" : response ? "ready" : "idle";
  const petStatus = loading
    ? "Checking Startup State"
    : response
      ? response.usedProvider === "mock"
        ? "Local path ready"
        : "Guide response ready"
      : "Ready when you are";
  const assistantText =
    (loading
      ? "I'm checking the Startup State resource data and turning it into a short first-step plan."
      : response?.assistantMessage) ??
    "A short answer will appear here with a recommended first stop and a few grounded matches from the Startup State data.";
  const assistantParagraphs = formatAssistantText(assistantText);

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
      if (!result.ok) {
        throw new Error("Basecamp could not build a path right now.");
      }
      setResponse((await result.json()) as WizardResponse);
    } catch {
      setResponse({
        assistantMessage:
          "I could not reach the live guide, so I kept this local and matched your goal against the Startup State resource data.",
        recommendations: localRecommendations,
        planCards: localPlan,
        usedProvider: "mock",
        guardrails: {
          deterministicFilters: true,
          citationsRequired: true,
          externalBrowsingUsed: false
        }
      });
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
          <h1>{compact ? "Get a path in under two minutes" : "What are you trying to do?"}</h1>
          <p>
            Tell Basecamp the next thing on your plate. It will return a first stop, why it fits,
            and what to do today.
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
            <ListFilter size={16} aria-hidden="true" />
            Manual
          </button>
        </div>

        {profile.mode === "guided" ? (
          <div className="guided-card">
            <div className="guided-card__copy">
              <span>
                <Sparkles size={16} aria-hidden="true" />
                Quick path
              </span>
              <p>Keep it simple: stage, county, and one plain-language goal.</p>
            </div>
            <div className="intake-grid intake-grid--guided">
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
                <span>
                  <MapPin size={15} aria-hidden="true" />
                  County
                </span>
                <select
                  value={profile.county}
                  onChange={(event) => setProfile({ ...profile, county: event.target.value })}
                >
                  {counties.slice(0, 35).map((county) => (
                    <option key={county}>{county}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : (
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
        )}

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
            {loading ? "Finding the first stop..." : "Find my first stop"}
          </button>
        </div>
      </div>

      <aside className={hasResults ? "navigator__results" : "navigator__results navigator__results--empty"}>
        <AnimatedAvatar state={petState} status={petStatus} />
        <div className="assistant-answer">
          <span className="eyebrow">
            <Bot size={15} aria-hidden="true" />
            {formatProviderLabel(response?.usedProvider)}
          </span>
          <div className="assistant-answer__copy">
            {assistantParagraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph}`}>{paragraph}</p>
            ))}
          </div>
        </div>

        {hasResults && (
          <div className="recommendation-list">
            {shownRecommendations.map((item) => (
              <article className="recommendation-card" key={item.resource.slug}>
                <div>
                  <span>{Math.round(item.score)} match</span>
                  <h3>{item.resource.title}</h3>
                  <p>{item.why}</p>
                </div>
                <Link
                  href={item.resource.link}
                  target="_blank"
                  aria-label={`Open ${item.resource.title}`}
                >
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        )}

        {!compact && hasResults && (
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

function formatProviderLabel(provider?: string) {
  if (provider === "codexPath") return "Codex guide";
  if (provider === "openai") return "OpenAI guide";
  if (provider === "anthropic") return "Anthropic guide";
  if (provider === "gemini") return "Gemini guide";
  return "Local guide";
}

function formatAssistantText(text: string) {
  const cleaned = text.replace(/\*\*/g, "").replace(/\[(resource:\d+)\]/g, "[$1]");
  return cleaned
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
