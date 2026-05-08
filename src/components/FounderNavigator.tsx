"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Circle,
  Compass,
  ExternalLink,
  History,
  Link2,
  LoaderCircle,
  LogIn,
  LogOut,
  MessageSquare,
  PanelRightOpen,
  RotateCcw,
  Save,
  Send,
  UserRound
} from "lucide-react";
import { fetchJson } from "@/lib/apiClient";
import type {
  AiSettings,
  FounderSession,
  FounderProfile,
  FounderStage,
  FounderUser,
  PlanCard,
  Recommendation,
  RecommendationResponse,
  Resource,
  SessionContext,
  SessionTurn,
  WizardResponse
} from "@/lib/types";

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

const starterPrompts = [
  "I'm starting a landscaping business in St. George. What do I do first?",
  "I'm a pre-revenue software founder in Lehi and need the right state resources.",
  "I have customers and need help finding funding and local mentors."
];

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
  const [profile, setProfile] = useState<FounderProfile>(() =>
    makeDefaultProfile(industries, counties, communities)
  );
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<WizardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [pendingTurn, setPendingTurn] = useState<SessionTurn | null>(null);
  const [draftTurns, setDraftTurns] = useState<SessionTurn[]>([]);
  const [registeredUser, setRegisteredUser] = useState<FounderUser | null>(null);
  const [activeSession, setActiveSession] = useState<FounderSession | null>(null);
  const [savedSessions, setSavedSessions] = useState<FounderSession[]>([]);
  const [registerForm, setRegisterForm] = useState(defaultRegisterForm);
  const [sessionStatus, setSessionStatus] = useState("");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [activeResourceId, setActiveResourceId] = useState<string | null>(null);

  const sortedCounties = useMemo(() => sortCountyOptions(counties), [counties]);
  const resourcesById = useMemo(
    () => new Map(resources.map((resource) => [resource.id, resource])),
    [resources]
  );
  const activeRecommendations = useMemo(
    () => response?.recommendations ?? [],
    [response]
  );
  const activeResource = useMemo(() => {
    const recommended = activeRecommendations.find((item) => item.resource.id === activeResourceId);
    return recommended?.resource ?? (response ? activeRecommendations[0]?.resource : null) ?? null;
  }, [activeRecommendations, activeResourceId, response]);
  const shownPlan = response?.planCards ?? [];
  const displayedTurns = useMemo(
    () => buildDisplayedTurns(activeSession, draftTurns, pendingTurn),
    [activeSession, draftTurns, pendingTurn]
  );
  const activePageSteps = useMemo(
    () => (activeResource ? makePageGuide(activeResource, profile) : []),
    [activeResource, profile]
  );

  const restoreSession = useCallback(
    async (session: FounderSession) => {
      const lastTurn = session.turns.at(-1);
      const restoredProfile = normalizeProfile(session.profile, industries, counties, communities);

      setActiveSession(session);
      setDraftTurns([]);
      setPendingTurn(null);
      setProfile(restoredProfile);
      setCompletedSteps(session.completedSteps);
      setMessage("");
      if (lastTurn) {
        const recommendationResult = await loadRecommendations(
          restoredProfile,
          compact ? 4 : 6,
          lastTurn.recommendationIds
        ).catch(() => ({
          recommendations: recommendationsFromIds(resources, lastTurn.recommendationIds),
          planCards: session.planCards
        }));
        const recommendations = recommendationResult.recommendations;
        setResponse({
          assistantMessage: lastTurn.assistantMessage,
          recommendations,
          planCards: session.planCards.length ? session.planCards : recommendationResult.planCards,
          usedProvider: lastTurn.usedProvider,
          guardrails: {
            deterministicFilters: true,
            citationsRequired: true,
            externalBrowsingUsed: false
          }
        });
        setActiveResourceId(lastTurn.recommendationIds[0] ?? recommendations[0]?.resource.id ?? null);
      } else {
        setResponse(null);
        setActiveResourceId(null);
      }
    },
    [communities, compact, counties, industries, resources]
  );

  const loadSessionsForUser = useCallback(
    async (userId: string, restoreLatest = false) => {
      try {
        const result = await fetch(`/api/founder-sessions?userId=${encodeURIComponent(userId)}`);
        const data = (await result.json()) as { sessions?: FounderSession[] };
        const sessions = data.sessions ?? [];
        setSavedSessions(sessions);
        if (restoreLatest && sessions[0]) {
          await restoreSession(sessions[0]);
          setSessionStatus("Loaded your last navigator conversation.");
        }
      } catch {
        setSessionStatus("Could not load saved conversations yet.");
      }
    },
    [restoreSession]
  );

  useEffect(() => {
    const stored = window.localStorage.getItem("basecamp.founderUser");
    if (!stored) return;
    try {
      const user = JSON.parse(stored) as FounderUser;
      window.queueMicrotask(() => {
        setRegisteredUser(user);
        setRegisterForm({ name: user.name, email: user.email });
        void loadSessionsForUser(user.id, true);
      });
    } catch {
      window.localStorage.removeItem("basecamp.founderUser");
    }
  }, [loadSessionsForUser]);

  async function registerFounder() {
    if (!registerForm.name.trim() || !registerForm.email.trim()) {
      setSessionStatus("Add your name and email to save this conversation.");
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
      setSavedSessions(data.sessions ?? []);

      const latestDraft = draftTurns.at(-1) ?? pendingTurn;
      if (latestDraft && response) {
        await persistTurn(
          response,
          data.user,
          latestDraft.userMessage,
          latestDraft.profile,
          latestDraft.completedSteps
        );
      } else if (data.sessions?.[0]) {
        void restoreSession(data.sessions[0]);
      }
      setSessionStatus("Profile ready. New turns will be saved.");
    } catch {
      setSessionStatus("Could not create the profile. Try again in a moment.");
    }
  }

  async function submitConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runNavigator(message);
  }

  async function runNavigator(inputMessage: string, sessionContext?: SessionContext) {
    const trimmed = inputMessage.trim();
    if (!trimmed || loading) return;

    const nextProfile = inferProfileFromMessage(
      { ...profile, goal: trimmed, mode: "chat" },
      trimmed,
      sortedCounties,
      industries,
      communities
    );
    const context =
      sessionContext ??
      buildSessionContext(activeSession, draftTurns, response, completedSteps, pendingTurn);

    setLoading(true);
    setLoadingMessage(trimmed);
    setMessage("");
    setProfile(nextProfile);

    try {
      const stored =
        typeof window === "undefined" ? null : window.localStorage.getItem("basecamp.aiSettings");
      const settings = stored ? (JSON.parse(stored) as AiSettings) : defaultSettings;
      const nextResponse = await fetchJson<WizardResponse>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          settings,
          profile: nextProfile,
          message: trimmed,
          sessionContext: hasMeaningfulContext(context) ? context : undefined
        })
      });
      const nextTurn = makeDraftTurn(trimmed, nextProfile, nextResponse, completedSteps);
      setResponse(nextResponse);
      setActiveResourceId(nextResponse.recommendations[0]?.resource.id ?? null);
      setPendingTurn(nextTurn);
      if (registeredUser) {
        await persistTurn(nextResponse, registeredUser, trimmed, nextProfile);
      } else {
        setDraftTurns((turns) => [...turns, nextTurn].slice(-12));
        setSessionStatus("Create a profile to save and resume this conversation.");
        setPendingTurn(null);
      }
    } catch {
      const fallback = await loadRecommendations(nextProfile, compact ? 4 : 6).catch(() => null);
      if (!fallback) {
        setSessionStatus("Basecamp could not reach the platform API yet. Try again in a moment.");
        return;
      }
      const fallbackResponse: WizardResponse = {
        assistantMessage:
          "I could not reach the live guide, so I used the Basecamp recommendations API to match your request against the Startup State resource data.\n\nStart with the first exact page in the side panel, then tell me what the page asks for and I will help you work through it.",
        recommendations: fallback.recommendations,
        planCards: fallback.planCards,
        usedProvider: "mock",
        guardrails: {
          deterministicFilters: true,
          citationsRequired: true,
          externalBrowsingUsed: false
        }
      };
      const nextTurn = makeDraftTurn(trimmed, nextProfile, fallbackResponse, completedSteps);
      setResponse(fallbackResponse);
      setActiveResourceId(fallback.recommendations[0]?.resource.id ?? null);
      if (registeredUser) {
        setPendingTurn(nextTurn);
        await persistTurn(fallbackResponse, registeredUser, trimmed, nextProfile);
      } else {
        setDraftTurns((turns) => [...turns, nextTurn].slice(-12));
        setSessionStatus("Create a profile to save and resume this conversation.");
      }
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  async function persistTurn(
    nextResponse: WizardResponse,
    user = registeredUser,
    inputMessage = message,
    profileForTurn: FounderProfile = { ...profile, goal: inputMessage, mode: "chat" },
    completedForTurn = completedSteps
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
          completedSteps: completedForTurn,
          recommendationIds: nextResponse.recommendations.map((item) => item.resource.id)
        })
      });
      if (!result.ok) throw new Error("Session save failed.");
      const data = (await result.json()) as { session: FounderSession };
      setActiveSession(data.session);
      setSavedSessions((sessions) => [
        data.session,
        ...sessions.filter((session) => session.id !== data.session.id)
      ]);
      setDraftTurns([]);
      setPendingTurn(null);
      setSessionStatus("Conversation saved.");
    } catch {
      setSessionStatus("The guide answered, but this turn was not saved.");
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
      setSavedSessions((sessions) => [
        data.session,
        ...sessions.filter((session) => session.id !== data.session.id)
      ]);
      setSessionStatus("Progress saved.");
    } catch {
      setSessionStatus("Progress is local right now; it did not save.");
    }
  }

  function startNewPath() {
    setActiveSession(null);
    setResponse(null);
    setCompletedSteps([]);
    setDraftTurns([]);
    setPendingTurn(null);
    setActiveResourceId(null);
    setProfile(makeDefaultProfile(industries, counties, communities));
    setMessage("");
    setSessionStatus("Started a new conversation.");
  }

  function signOutFounder() {
    window.localStorage.removeItem("basecamp.founderUser");
    setRegisteredUser(null);
    setActiveSession(null);
    setSavedSessions([]);
    setResponse(null);
    setCompletedSteps([]);
    setDraftTurns([]);
    setPendingTurn(null);
    setActiveResourceId(null);
    setRegisterForm(defaultRegisterForm);
    setProfile(makeDefaultProfile(industries, counties, communities));
    setMessage("");
    setSessionStatus("Signed out on this browser.");
  }

  return (
    <section className={compact ? "navigator navigator--assistant compact" : "navigator navigator--assistant"}>
      <div className="navigator__workbench founder-chat">
        <div className="founder-chat__header">
          <div className="section-heading">
            <span className="eyebrow">
              <Compass size={15} aria-hidden="true" />
              Founder navigator
            </span>
            <h1>{compact ? "Ask for your next step" : "Founder’s Navigator"}</h1>
            <p>Chat with a Utah startup assistant that stays grounded in the state resource data.</p>
          </div>

          {registeredUser ? (
            <div className="founder-chat__identity">
              <span>
                <UserRound size={15} aria-hidden="true" />
                {registeredUser.name}
              </span>
              <button className="ghost-button" type="button" onClick={signOutFounder}>
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>

        <div className="founder-chat__savebar">
          {registeredUser ? (
            <>
              <div>
                <span className="eyebrow">
                  <History size={15} aria-hidden="true" />
                  Saved conversations
                </span>
                <p className="status-line">
                  {activeSession
                    ? activeSession.title
                    : savedSessions.length
                      ? "Choose a saved path or start fresh."
                      : "Your next turn will create a saved path."}
                </p>
              </div>
              <div className="button-row">
                {savedSessions.slice(0, 3).map((session) => (
                  <button
                    className={session.id === activeSession?.id ? "ghost-button active" : "ghost-button"}
                    type="button"
                    key={session.id}
                    onClick={() => void restoreSession(session)}
                  >
                    {session.title}
                  </button>
                ))}
                <button className="ghost-button" type="button" onClick={startNewPath}>
                  <RotateCcw size={16} aria-hidden="true" />
                  New
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="eyebrow">
                  <Save size={15} aria-hidden="true" />
                  Save and resume
                </span>
                <p className="status-line">Create a lightweight profile when you want this path to follow you.</p>
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

        <div className="chat-thread" aria-live="polite">
          {displayedTurns.length === 0 && !loading ? (
            <div className="chat-message chat-message--assistant">
              <span>
                <Bot size={16} aria-hidden="true" />
                Startup State assistant
              </span>
              <div className="chat-message__body">
                <p>
                  Tell me where you are, what you are trying to do, and what feels stuck. I will
                  point you to the exact page and stay with you step by step.
                </p>
              </div>
              <div className="starter-prompts">
                {starterPrompts.map((prompt) => (
                  <button
                    type="button"
                    key={prompt}
                    onClick={() => void runNavigator(prompt)}
                    disabled={loading}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {displayedTurns.map((turn) => (
            <ConversationTurn
              key={turn.id}
              turn={turn}
              resourcesById={resourcesById}
              activeResourceId={activeResourceId}
              onSelectResource={setActiveResourceId}
            />
          ))}

          {loading ? (
            <>
              <div className="chat-message chat-message--user">
                <span>You</span>
                <div className="chat-message__body">
                  <p>{loadingMessage}</p>
                </div>
              </div>
              <div className="chat-message chat-message--assistant chat-message--loading">
                <span>
                  <LoaderCircle size={16} aria-hidden="true" />
                  Checking exact pages
                </span>
                <div className="chat-message__body">
                  <p>Matching your situation to the resource data and choosing the next page.</p>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <form className="chat-composer" onSubmit={submitConversation}>
          <label className="message-box">
            <span>
              <MessageSquare size={16} aria-hidden="true" />
              Ask the navigator
            </span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Example: I run a food truck in Ogden and need to know permits, licensing, and who to call next."
            />
          </label>
          <div className="navigator-actions">
            <button className="primary-button" type="submit" disabled={loading || !message.trim()}>
              <Send size={16} aria-hidden="true" />
              Send
            </button>
          </div>
        </form>
      </div>

      <aside className="navigator__results side-browser">
        <div className="side-browser__heading">
          <span className="eyebrow">
            <PanelRightOpen size={15} aria-hidden="true" />
            Exact page
          </span>
          <h2>{activeResource?.title ?? "Recommended pages open here"}</h2>
          {activeResource ? (
            <a className="side-browser__url" href={activeResource.link} target="_blank">
              <Link2 size={14} aria-hidden="true" />
              {formatResourceUrl(activeResource.link)}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ) : (
            <p className="status-line">Ask a question and the best exact page will load in this panel.</p>
          )}
        </div>

        {activeResource ? (
          <>
            <div className="side-browser__frame" key={activeResource.link}>
              <iframe src={activeResource.link} title={`${activeResource.title} page`} />
            </div>

            <div className="side-browser__guide">
              <span className="eyebrow">
                <Bot size={15} aria-hidden="true" />
                Page guide
              </span>
              <ol>
                {activePageSteps.map((step) => (
                  <li key={step.title}>
                    <strong>{step.title}</strong>
                    <span>{step.detail}</span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <div className="side-browser__empty">
            <Compass size={28} aria-hidden="true" />
            <p>Exact links from the state resource data will appear here as the conversation narrows.</p>
          </div>
        )}

        {activeRecommendations.length > 0 ? (
          <div className="recommendation-list recommendation-list--compact">
            {activeRecommendations.slice(0, compact ? 3 : 5).map((item) => (
              <button
                className={
                  item.resource.id === activeResource?.id
                    ? "recommendation-card recommendation-card--active"
                    : "recommendation-card"
                }
                type="button"
                key={item.resource.slug}
                onClick={() => setActiveResourceId(item.resource.id)}
              >
                <div>
                  <span>{Math.round(item.score)} match</span>
                  <h3>{item.resource.title}</h3>
                  <p>{formatResourceUrl(item.resource.link)}</p>
                </div>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}

        {response && !compact ? (
          <div className="plan-list">
            {shownPlan.map((card) => {
              const checked = completedSteps.includes(card.title);
              const firstIncomplete = shownPlan.find((item) => !completedSteps.includes(item.title));
              return (
              <PlanStep
                card={card}
                checked={checked}
                statusLabel={checked ? "Done" : card.title === firstIncomplete?.title ? "Active" : "Queued"}
                key={card.title}
                onToggle={() => toggleCompletedStep(card.title)}
              />
              );
            })}
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function ConversationTurn({
  turn,
  resourcesById,
  activeResourceId,
  onSelectResource
}: {
  turn: SessionTurn;
  resourcesById: Map<string, Resource>;
  activeResourceId: string | null;
  onSelectResource: (resourceId: string) => void;
}) {
  const linkedResources = turn.recommendationIds
    .map((id) => resourcesById.get(id))
    .filter((resource): resource is Resource => Boolean(resource))
    .slice(0, 3);

  return (
    <>
      <div className="chat-message chat-message--user">
        <span>You</span>
        <div className="chat-message__body">
          <p>{turn.userMessage}</p>
        </div>
      </div>
      <div className="chat-message chat-message--assistant">
        <span>
          <Bot size={16} aria-hidden="true" />
          {formatProviderLabel(turn.usedProvider)}
        </span>
        <div className="chat-message__body">
          {formatAssistantText(turn.assistantMessage).map((paragraph, index) => (
            <p key={`${turn.id}-${index}`}>{paragraph}</p>
          ))}
        </div>
        {linkedResources.length > 0 ? (
          <div className="chat-resource-strip">
            {linkedResources.map((resource) => (
              <button
                type="button"
                key={`${turn.id}-${resource.id}`}
                className={resource.id === activeResourceId ? "active" : ""}
                onClick={() => onSelectResource(resource.id)}
              >
                <ExternalLink size={14} aria-hidden="true" />
                {resource.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

function PlanStep({
  card,
  checked,
  statusLabel,
  onToggle
}: {
  card: PlanCard;
  checked: boolean;
  statusLabel: "Done" | "Active" | "Queued";
  onToggle: () => void;
}) {
  return (
    <label className={checked ? "plan-item plan-item--done" : "plan-item"}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {checked ? <CheckCircle2 size={17} aria-hidden="true" /> : <Circle size={17} aria-hidden="true" />}
      <span>{card.title}</span>
      <small>{statusLabel} · {card.dueWindow.replace("_", " ")}</small>
    </label>
  );
}

function makeDefaultProfile(
  industries: string[],
  counties: string[],
  communities: string[]
): FounderProfile {
  return {
    stage: "start",
    industry: industries.includes("Software and Information Technology")
      ? "Software and Information Technology"
      : industries[0] ?? "Other",
    county: counties.includes("Salt Lake") ? "Salt Lake" : counties[0] ?? "Utah",
    community: communities.includes("Any") ? "Any" : communities[0] ?? "Any",
    goal: defaultGoal,
    mode: "chat"
  };
}

function normalizeProfile(
  profile: FounderProfile,
  industries: string[],
  counties: string[],
  communities: string[]
) {
  const fallback = makeDefaultProfile(industries, counties, communities);
  return {
    ...fallback,
    ...profile,
    mode: profile.mode ?? "chat"
  } satisfies FounderProfile;
}

function inferProfileFromMessage(
  current: FounderProfile,
  input: string,
  counties: string[],
  industries: string[],
  communities: string[]
): FounderProfile {
  const text = input.toLowerCase();
  return {
    ...current,
    stage: inferStage(text, current.stage),
    industry: inferIndustry(text, current.industry, industries),
    county: inferCounty(text, current.county, counties),
    community: inferCommunity(text, current.community, communities),
    goal: input,
    mode: "chat"
  };
}

function inferStage(text: string, fallback: FounderStage): FounderStage {
  if (/\b(exit|sell|succession|close|closing)\b/.test(text)) return "exit";
  if (/\b(fund|funding|grant|loan|capital|investor|pitch)\b/.test(text)) return "fund";
  if (/\b(grow|growth|hire|hiring|export|scale|workforce)\b/.test(text)) return "grow";
  if (/\b(validate|pre[-\s]?revenue|mvp|prototype|test customers?|market research)\b/.test(text)) {
    return "validate";
  }
  if (/\b(idea|brainstorm|thinking about|exploring)\b/.test(text)) return "idea";
  if (/\b(start|launch|register|license|licence|llc|ein|permit|open)\b/.test(text)) return "start";
  return fallback;
}

function inferIndustry(text: string, fallback: string, industries: string[]) {
  const candidates: Array<[RegExp, string]> = [
    [/\b(software|saas|app|ai|tech|platform|developer)\b/, "Software and Information Technology"],
    [/\b(landscap|lawn|yard|farm|agricultur|ranch|garden)\b/, "Agriculture"],
    [/\b(food|restaurant|cafe|catering|truck|hotel|tourism|hospitality)\b/, "Hospitality and Food Services"],
    [/\b(health|clinic|medical|device|biotech|life science)\b/, "Life Sciences and Healthcare"],
    [/\b(manufactur|factory|industrial|hardware|machining)\b/, "Manufacturing"],
    [/\b(film|music|artist|studio|game|entertainment|recreation)\b/, "Arts and Entertainment and Recreation"],
    [/\b(finance|bank|insurance|fintech)\b/, "Financial Services"],
    [/\b(retail|ecommerce|consumer product|packaged|cpg)\b/, "Consumer Packaged Goods"]
  ];
  return candidates.find(([pattern, industry]) => pattern.test(text) && industries.includes(industry))?.[1] ?? fallback;
}

function inferCounty(text: string, fallback: string, counties: string[]) {
  const exactCounty = counties.find((county) => text.includes(county.toLowerCase()));
  if (exactCounty) return exactCounty;
  const cityToCounty: Record<string, string> = {
    "st. george": "Washington",
    "saint george": "Washington",
    washington: "Washington",
    lehi: "Utah",
    provo: "Utah",
    orem: "Utah",
    "salt lake": "Salt Lake",
    sandy: "Salt Lake",
    ogden: "Weber",
    logan: "Cache",
    "cedar city": "Iron",
    "park city": "Summit",
    moab: "Grand"
  };
  const match = Object.entries(cityToCounty).find(([city, county]) => text.includes(city) && counties.includes(county));
  return match?.[1] ?? fallback;
}

function inferCommunity(text: string, fallback: string, communities: string[]) {
  const candidates: Array<[RegExp, string]> = [
    [/\b(woman|women|female)\b/, "Women"],
    [/\b(veteran|military)\b/, "Veteran"],
    [/\b(student|college|university)\b/, "Student"],
    [/\b(rural|small town)\b/, "Rural"],
    [/\b(immigrant|refugee|new american)\b/, "New American"],
    [/\b(multicultural|minority|asian|latino|hispanic|pacific islander|black)\b/, "Multicultural"]
  ];
  return candidates.find(([pattern, community]) => pattern.test(text) && communities.includes(community))?.[1] ?? fallback;
}

function makeDraftTurn(
  userMessage: string,
  profile: FounderProfile,
  nextResponse: WizardResponse,
  completedSteps: string[]
): SessionTurn {
  return {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    profile,
    userMessage,
    assistantMessage: nextResponse.assistantMessage,
    usedProvider: nextResponse.usedProvider,
    planCards: nextResponse.planCards,
    completedSteps,
    recommendationIds: nextResponse.recommendations.map((item) => item.resource.id)
  };
}

function buildDisplayedTurns(
  session: FounderSession | null,
  draftTurns: SessionTurn[],
  pendingTurn: SessionTurn | null
) {
  const base = session?.turns.length ? session.turns : draftTurns;
  if (!pendingTurn) return base;
  if (base.some((turn) => turn.id === pendingTurn.id)) return base;
  return [...base, pendingTurn];
}

function buildSessionContext(
  session: FounderSession | null,
  draftTurns: SessionTurn[],
  response: WizardResponse | null,
  completedSteps: string[],
  pendingTurn: SessionTurn | null
): SessionContext {
  const turns = session?.turns.length ? session.turns : draftTurns;
  const lastTurn = pendingTurn ?? turns.at(-1);
  const currentPlanCards = response?.planCards ?? session?.planCards ?? lastTurn?.planCards;
  return {
    sessionId: session?.id,
    completedSteps,
    currentPlanCards,
    previousAssistantMessage:
      response?.assistantMessage ?? lastTurn?.assistantMessage ?? undefined,
    history: turns.slice(-4).map((turn) => ({
      userMessage: turn.userMessage,
      assistantMessage: turn.assistantMessage,
      completedSteps: turn.completedSteps
    }))
  };
}

function hasMeaningfulContext(context: SessionContext) {
  return Boolean(
    context.sessionId ||
      context.completedSteps?.length ||
      context.currentPlanCards?.length ||
      context.previousAssistantMessage ||
      context.history?.length
  );
}

function loadRecommendations(
  profile: FounderProfile,
  limit: number,
  orderedIds: string[] = []
) {
  return fetchJson<RecommendationResponse>("/api/recommendations", {
    method: "POST",
    body: JSON.stringify({ profile, limit, orderedIds })
  });
}

function recommendationsFromIds(resources: Resource[], orderedIds: string[]): Recommendation[] {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  return orderedIds
    .map((id, index) => {
      const resource = byId.get(id);
      if (!resource) return null;
      return {
        resource,
        score: Math.max(1, 100 - index),
        why: "Saved from the previous navigator response.",
        citations: [`resource:${resource.id}`]
      };
    })
    .filter((item): item is Recommendation => Boolean(item));
}

function makePageGuide(resource: Resource, profile: FounderProfile) {
  const title = resource.title.toLowerCase();
  const text = `${resource.title} ${resource.description} ${resource.topics.join(" ")}`.toLowerCase();
  if (/registration|licensure|form a new business|business entities|legal formation/.test(title)) {
    return [
      {
        title: "Start with the business identity",
        detail: "Decide on the working name, owner details, address, and entity structure before submitting anything."
      },
      {
        title: "Follow the state registration prompts",
        detail: "Use this exact page for Utah registration or licensing, then note any city or county follow-up it names."
      },
      {
        title: "Save proof and return",
        detail: "Keep confirmation numbers, receipts, and next-step notices so the assistant can guide the next page."
      }
    ];
  }
  if (/ein|employer identification|fein/.test(text)) {
    return [
      {
        title: "Confirm the entity is ready",
        detail: "Have the legal business name, entity type, responsible party, and mailing address nearby."
      },
      {
        title: "Use the online EIN path",
        detail: "Choose the option that matches the Utah entity you formed, then save the confirmation letter."
      },
      {
        title: "Come back with the EIN",
        detail: "Tell the navigator it is complete so the next step can move to banking, taxes, or local licensing."
      }
    ];
  }
  if (/mentor|consultation|sbdc|score|advisor/.test(text)) {
    return [
      {
        title: "Request the advisor match",
        detail: `Use the intake or contact option and say you are a ${profile.stage} founder in ${profile.county || "Utah"}.`
      },
      {
        title: "Bring one specific question",
        detail: "Ask about the next required registration, permit, funding, or market-validation step for your business."
      },
      {
        title: "Report the answer here",
        detail: "Share what the advisor tells you, and the conversation will continue from that point."
      }
    ];
  }
  if (/fund|grant|loan|capital|pitch|venture/.test(text)) {
    return [
      {
        title: "Check fit before applying",
        detail: "Look for stage, location, industry, and deadline requirements before spending time on the form."
      },
      {
        title: "Gather the basics",
        detail: "Have a one-paragraph business summary, use of funds, budget, and founder contact details ready."
      },
      {
        title: "Ask for help on hard fields",
        detail: "Paste any confusing application question into the chat and the assistant will help draft a grounded answer."
      }
    ];
  }
  return [
    {
      title: "Open the action path",
      detail: "Use the page shown here rather than searching from a homepage."
    },
    {
      title: "Look for intake, services, or contact",
      detail: "Choose the path that matches your location, stage, and business type."
    },
    {
      title: "Keep the conversation moving",
      detail: "Tell the assistant what the page asks for, what you completed, or where you got stuck."
    }
  ];
}

function formatProviderLabel(provider?: string) {
  if (provider === "codexPath") return "Codex guide";
  if (provider === "openai") return "OpenAI guide";
  if (provider === "anthropic") return "Anthropic guide";
  if (provider === "gemini") return "Gemini guide";
  return "Startup State assistant";
}

function sortCountyOptions(counties: string[]) {
  return Array.from(new Set(counties.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

function formatAssistantText(text: string) {
  const cleaned = text.replace(/\*\*/g, "").replace(/\s*\[resource:[^\]]+\]/g, "");
  return cleaned
    .split(/\n{2,}|\n(?=\d+\.)/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function formatResourceUrl(link: string) {
  try {
    const url = new URL(link);
    return `${url.hostname}${url.pathname}${url.search}`.replace(/\/$/, "");
  } catch {
    return link;
  }
}
