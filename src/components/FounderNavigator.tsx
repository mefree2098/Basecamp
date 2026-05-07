"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Compass,
  History,
  ListFilter,
  LogIn,
  LogOut,
  MapPin,
  MessageSquare,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  UserRound
} from "lucide-react";
import { AnimatedAvatar, type GuideCompanionState } from "./AnimatedAvatar";
import { recommendResources, makePlanCards } from "@/lib/recommendations";
import type {
  AiSettings,
  FounderSession,
  FounderProfile,
  FounderStage,
  FounderUser,
  PlanCard,
  Resource,
  SessionContext,
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

const defaultGoal = "I want to turn an idea into a real Utah business. What should I do first?";

const defaultRegisterForm = {
  name: "",
  email: ""
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
    industry: industries.includes("Software and Information Technology")
      ? "Software and Information Technology"
      : industries[0] ?? "Software and Information Technology",
    county: counties.includes("Salt Lake") ? "Salt Lake" : counties[0] ?? "Utah",
    community: communities[0] ?? "Any",
    goal: defaultGoal,
    mode: "guided"
  });
  const [message, setMessage] = useState(profile.goal);
  const [response, setResponse] = useState<WizardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<FounderUser | null>(null);
  const [activeSession, setActiveSession] = useState<FounderSession | null>(null);
  const [registerForm, setRegisterForm] = useState(defaultRegisterForm);
  const [sessionStatus, setSessionStatus] = useState("");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [continueMessage, setContinueMessage] = useState(
    "I completed the checked steps. What's next?"
  );
  const sortedCounties = useMemo(() => sortCountyOptions(counties), [counties]);
  const activeProfile = useMemo(
    () => ({ ...profile, goal: message || profile.goal }),
    [message, profile]
  );

  const localRecommendations = useMemo(
    () => recommendResources(activeProfile, resources, compact ? 3 : 5),
    [activeProfile, compact, resources]
  );
  const localPlan = useMemo(
    () => makePlanCards(activeProfile, localRecommendations),
    [activeProfile, localRecommendations]
  );
  const shownRecommendations = (response?.recommendations ?? localRecommendations).slice(
    0,
    compact ? 3 : 5
  );
  const shownPlan = response?.planCards ?? localPlan;
  const hasResults = Boolean(response);
  const companionState: GuideCompanionState = loading ? "thinking" : response ? "ready" : "idle";
  const companionStatus = loading
    ? "Reviewing your path"
    : response
      ? response.usedProvider === "mock"
        ? "Local route ready"
        : "Guide route ready"
      : "Basecamp guide ready";
  const assistantText =
    (loading
      ? "I'm checking the Startup State resource data and turning it into a short first-step plan."
      : response?.assistantMessage) ??
    "A short answer will appear here with a recommended first stop and a few grounded matches from the Startup State data.";
  const assistantParagraphs = formatAssistantText(assistantText);

  const restoreSession = useCallback(
    (session: FounderSession) => {
      const lastTurn = session.turns.at(-1);
      setActiveSession(session);
      setProfile(session.profile);
      setMessage(lastTurn?.userMessage ?? session.profile.goal);
      setCompletedSteps(session.completedSteps);
      if (lastTurn) {
        setResponse({
          assistantMessage: lastTurn.assistantMessage,
          recommendations: recommendResources(session.profile, resources, compact ? 3 : 5),
          planCards: session.planCards,
          usedProvider: lastTurn.usedProvider,
          guardrails: {
            deterministicFilters: true,
            citationsRequired: true,
            externalBrowsingUsed: false
          }
        });
      }
    },
    [compact, resources]
  );

  const loadLatestSession = useCallback(async (userId: string) => {
    try {
      const result = await fetch(`/api/founder-sessions?userId=${encodeURIComponent(userId)}`);
      const data = (await result.json()) as { sessions?: FounderSession[] };
      const [latest] = data.sessions ?? [];
      if (!latest) return;
      restoreSession(latest);
      setSessionStatus("Loaded your last path.");
    } catch {
      setSessionStatus("Could not load saved paths yet.");
    }
  }, [restoreSession]);

  useEffect(() => {
    const stored = window.localStorage.getItem("basecamp.founderUser");
    if (!stored) return;
    try {
      const user = JSON.parse(stored) as FounderUser;
      window.queueMicrotask(() => {
        setRegisteredUser(user);
        setRegisterForm({ name: user.name, email: user.email });
        void loadLatestSession(user.id);
      });
    } catch {
      window.localStorage.removeItem("basecamp.founderUser");
    }
  }, [loadLatestSession]);

  async function registerFounder() {
    if (!registerForm.name.trim() || !registerForm.email.trim()) {
      setSessionStatus("Add your name and email to continue this path later.");
      return;
    }
    setSessionStatus("Creating your Basecamp profile...");
    try {
      const result = await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerForm)
      });
      if (!result.ok) throw new Error("Registration failed.");
      const data = (await result.json()) as { user: FounderUser; sessions?: FounderSession[] };
      setRegisteredUser(data.user);
      window.localStorage.setItem("basecamp.founderUser", JSON.stringify(data.user));
      const [latest] = data.sessions ?? [];
      if (latest) {
        restoreSession(latest);
      } else if (response) {
        await persistTurn(response, data.user);
      }
      setSessionStatus("Profile ready. Your next guide turn will be saved.");
    } catch {
      setSessionStatus("Could not create the profile. Try again in a moment.");
    }
  }

  async function runNavigator(inputMessage = message, sessionContext?: SessionContext) {
    setLoading(true);
    setMessage(inputMessage);
    const requestProfile = sessionContext ? profile : { ...profile, goal: inputMessage };
    try {
      const stored =
        typeof window === "undefined" ? null : window.localStorage.getItem("basecamp.aiSettings");
      const settings = stored ? (JSON.parse(stored) as AiSettings) : defaultSettings;
      const result = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          profile: requestProfile,
          message: inputMessage,
          sessionContext
        })
      });
      if (!result.ok) {
        throw new Error("Basecamp could not build a path right now.");
      }
      const nextResponse = (await result.json()) as WizardResponse;
      setResponse(nextResponse);
      await persistTurn(nextResponse, registeredUser, inputMessage, requestProfile);
    } catch {
      const fallbackResponse: WizardResponse = {
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
      };
      setResponse(fallbackResponse);
      await persistTurn(fallbackResponse, registeredUser, inputMessage, requestProfile);
    } finally {
      setLoading(false);
    }
  }

  async function persistTurn(
    nextResponse: WizardResponse,
    user = registeredUser,
    inputMessage = message,
    profileForTurn: FounderProfile = { ...profile, goal: inputMessage }
  ) {
    if (!user) return;
    try {
      const result = await fetch("/api/founder-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          sessionId: activeSession?.id,
          profile: profileForTurn,
          userMessage: inputMessage,
          assistantMessage: nextResponse.assistantMessage,
          usedProvider: nextResponse.usedProvider,
          planCards: nextResponse.planCards,
          completedSteps,
          recommendationIds: nextResponse.recommendations.map((item) => item.resource.id)
        })
      });
      if (!result.ok) throw new Error("Session save failed.");
      const data = (await result.json()) as { session: FounderSession };
      setActiveSession(data.session);
      setSessionStatus("Session saved.");
    } catch {
      setSessionStatus("Guide worked, but the session was not saved.");
    }
  }

  async function toggleCompletedStep(title: string) {
    const next = completedSteps.includes(title)
      ? completedSteps.filter((step) => step !== title)
      : [...completedSteps, title];
    setCompletedSteps(next);
    if (!registeredUser || !activeSession) return;
    try {
      const result = await fetch("/api/founder-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: registeredUser.id,
          sessionId: activeSession.id,
          completedSteps: next
        })
      });
      if (!result.ok) throw new Error("Progress save failed.");
      const data = (await result.json()) as { session: FounderSession };
      setActiveSession(data.session);
      setSessionStatus("Progress saved.");
    } catch {
      setSessionStatus("Progress is local right now; it did not save.");
    }
  }

  function continueSession() {
    const context = buildSessionContext(activeSession, response, completedSteps);
    void runNavigator(continueMessage, context);
  }

  function startNewPath() {
    setActiveSession(null);
    setResponse(null);
    setCompletedSteps([]);
    setProfile({ ...profile, goal: defaultGoal });
    setMessage(defaultGoal);
    setSessionStatus("Started a new unsaved path.");
  }

  function signOutFounder() {
    window.localStorage.removeItem("basecamp.founderUser");
    setRegisteredUser(null);
    setActiveSession(null);
    setResponse(null);
    setCompletedSteps([]);
    setRegisterForm(defaultRegisterForm);
    setProfile({ ...profile, goal: defaultGoal });
    setMessage(defaultGoal);
    setSessionStatus("Signed out on this browser.");
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
              <CountyField
                id="guided-county-options"
                value={profile.county}
                counties={sortedCounties}
                onChange={(county) => setProfile({ ...profile, county })}
              />
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
            <CountyField
              id="manual-county-options"
              value={profile.county}
              counties={sortedCounties}
              onChange={(county) => setProfile({ ...profile, county })}
            />
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
          <button
            className="primary-button"
            type="button"
            onClick={() => runNavigator()}
            disabled={loading}
          >
            <Send size={16} aria-hidden="true" />
            {loading ? "Finding the first stop..." : "Find my first stop"}
          </button>
        </div>

        <div className="session-panel">
          {registeredUser ? (
            <>
              <div>
                <span className="eyebrow">
                  <UserRound size={15} aria-hidden="true" />
                  Founder profile
                </span>
                <strong>{registeredUser.name}</strong>
                <p>
                  {activeSession
                    ? "This path is saved, including completed steps and guide turns."
                    : "Your profile is ready. Run the guide to save a path."}
                </p>
              </div>
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={startNewPath}>
                  <RotateCcw size={16} aria-hidden="true" />
                  New path
                </button>
                <button className="ghost-button" type="button" onClick={signOutFounder}>
                  <LogOut size={16} aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="eyebrow">
                  <Save size={15} aria-hidden="true" />
                  Continue later
                </span>
                <p>Create a lightweight Basecamp profile to save this path and resume later.</p>
              </div>
              <div className="session-panel__fields">
                <input
                  aria-label="Founder name"
                  placeholder="Name"
                  value={registerForm.name}
                  onChange={(event) =>
                    setRegisterForm({ ...registerForm, name: event.target.value })
                  }
                />
                <input
                  aria-label="Founder email"
                  placeholder="Email"
                  inputMode="email"
                  autoComplete="email"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm({ ...registerForm, email: event.target.value })
                  }
                />
                <button className="ghost-button" type="button" onClick={registerFounder}>
                  <LogIn size={16} aria-hidden="true" />
                  Register
                </button>
              </div>
            </>
          )}
          {sessionStatus && <small>{sessionStatus}</small>}
        </div>
      </div>

      <aside className={hasResults ? "navigator__results" : "navigator__results navigator__results--empty"}>
        <AnimatedAvatar state={companionState} status={companionStatus} />
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
              <PlanStep
                card={card}
                checked={completedSteps.includes(card.title)}
                key={card.title}
                onToggle={() => toggleCompletedStep(card.title)}
              />
            ))}
          </div>
        )}

        {!compact && hasResults && (
          <div className="continue-panel">
            <span className="eyebrow">
              <History size={15} aria-hidden="true" />
              Continue this path
            </span>
            <textarea
              value={continueMessage}
              onChange={(event) => setContinueMessage(event.target.value)}
            />
            <button
              className="primary-button"
              type="button"
              onClick={continueSession}
              disabled={loading}
            >
              <Send size={16} aria-hidden="true" />
              Ask what is next
            </button>
          </div>
        )}
      </aside>
    </section>
  );
}

function PlanStep({
  card,
  checked,
  onToggle
}: {
  card: PlanCard;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className={checked ? "plan-item plan-item--done" : "plan-item"}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <CheckCircle2 size={17} aria-hidden="true" />
      <span>{card.title}</span>
      <small>{card.dueWindow.replace("_", " ")}</small>
    </label>
  );
}

function formatProviderLabel(provider?: string) {
  if (provider === "codexPath") return "Codex guide";
  if (provider === "openai") return "OpenAI guide";
  if (provider === "anthropic") return "Anthropic guide";
  if (provider === "gemini") return "Gemini guide";
  return "Local guide";
}

function CountyField({
  id,
  value,
  counties,
  onChange
}: {
  id: string;
  value: string;
  counties: string[];
  onChange: (county: string) => void;
}) {
  return (
    <label className="input-field county-combobox">
      <span>
        <MapPin size={15} aria-hidden="true" />
        County
      </span>
      <input
        list={id}
        value={value}
        placeholder="Search county"
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={id}>
        {counties.map((county) => (
          <option key={county} value={county} />
        ))}
      </datalist>
    </label>
  );
}

function sortCountyOptions(counties: string[]) {
  return Array.from(new Set(counties.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

function buildSessionContext(
  session: FounderSession | null,
  response: WizardResponse | null,
  completedSteps: string[]
): SessionContext {
  const currentPlanCards = response?.planCards ?? session?.planCards;
  return {
    sessionId: session?.id,
    completedSteps,
    currentPlanCards,
    previousAssistantMessage:
      response?.assistantMessage ?? session?.turns.at(-1)?.assistantMessage ?? undefined,
    history: session?.turns.slice(-4).map((turn) => ({
      userMessage: turn.userMessage,
      assistantMessage: turn.assistantMessage,
      completedSteps: turn.completedSteps
    }))
  };
}

function formatAssistantText(text: string) {
  const cleaned = text.replace(/\*\*/g, "").replace(/\s*\[resource:[^\]]+\]/g, "");
  return cleaned
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
