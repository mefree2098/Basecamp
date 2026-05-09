"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
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
import { inferFounderProfileFromText } from "@/lib/founderInference";
import { externalResourceHref, formatResourceUrl } from "@/lib/resourceLinks";
import { useAuth } from "@/components/AuthContext";
import type {
  AiSettings,
  AuthProviderId,
  FounderSession,
  FounderProfile,
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

const providerOptions: Array<{ id: Exclude<AuthProviderId, "site">; label: string }> = [
  { id: "microsoft", label: "Microsoft" },
  { id: "google", label: "Google" },
  { id: "meta", label: "Meta" }
];

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
  const { user: registeredUser, loading: authLoading, signIn, signOut } = useAuth();
  const [profile, setProfile] = useState<FounderProfile>(() =>
    makeDefaultProfile(industries, counties, communities)
  );
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<WizardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [pendingTurn, setPendingTurn] = useState<SessionTurn | null>(null);
  const [draftTurns, setDraftTurns] = useState<SessionTurn[]>([]);
  const [activeSession, setActiveSession] = useState<FounderSession | null>(null);
  const [savedSessions, setSavedSessions] = useState<FounderSession[]>([]);
  const [registerForm, setRegisterForm] = useState(defaultRegisterForm);
  const [sessionStatus, setSessionStatus] = useState("");
  const [resumePromptDismissed, setResumePromptDismissed] = useState(false);
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
  const resumeSession =
    registeredUser && savedSessions[0] && !activeSession && !resumePromptDismissed
      ? savedSessions[0]
      : null;

  const restoreSession = useCallback(
    async (session: FounderSession) => {
      const lastTurn = session.turns.at(-1);
      const restoredProfile = normalizeProfile(session.profile, industries, counties, communities);

      setActiveSession(session);
      setResumePromptDismissed(true);
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
        } else if (sessions[0]) {
          setResumePromptDismissed(false);
          setSessionStatus("Welcome back. Resume where you left off or start a fresh path.");
        }
      } catch {
        setSessionStatus("Could not load saved conversations yet.");
      }
    },
    [restoreSession]
  );

  useEffect(() => {
    if (authLoading) return;
    const timer = window.setTimeout(() => {
      if (!registeredUser) {
        setSavedSessions([]);
        setActiveSession(null);
        setResumePromptDismissed(false);
        setRegisterForm(defaultRegisterForm);
        return;
      }
      setRegisterForm({ name: registeredUser.name, email: registeredUser.email });
      setResumePromptDismissed(false);
      void loadSessionsForUser(registeredUser.id, false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, loadSessionsForUser, registeredUser]);

  async function registerFounder() {
    if (!registerForm.name.trim() || !registerForm.email.trim()) {
      setSessionStatus("Add your name and email to save this conversation.");
      return;
    }
    setSessionStatus("Creating your Basecamp profile...");
    try {
      const data = await signIn({
        provider: "site",
        name: registerForm.name,
        email: registerForm.email
      });
      await finishAccountSetup(data.user!, data.sessions ?? []);
    } catch (error) {
      setSessionStatus(error instanceof Error ? error.message : "Could not create the profile. Try again in a moment.");
    }
  }

  async function registerWithProvider(provider: Exclude<AuthProviderId, "site">) {
    setSessionStatus(`Connecting ${providerLabel(provider)}...`);
    try {
      const data = await signIn({
        provider,
        name: registerForm.name || undefined,
        email: registerForm.email || undefined
      });
      await finishAccountSetup(data.user!, data.sessions ?? []);
    } catch (error) {
      setSessionStatus(error instanceof Error ? error.message : `Could not connect ${providerLabel(provider)}.`);
    }
  }

  async function finishAccountSetup(user: FounderUser, sessions: FounderSession[]) {
    setRegisterForm({ name: user.name, email: user.email });
    setSavedSessions(sessions);
    setResumePromptDismissed(false);

    const latestDraft = draftTurns.at(-1) ?? pendingTurn;
    if (latestDraft && response) {
      await persistTurn(
        response,
        user,
        latestDraft.userMessage,
        latestDraft.profile,
        latestDraft.completedSteps
      );
      setSessionStatus("Profile ready. This conversation is saved.");
      return;
    }
    if (sessions[0]) {
      setSessionStatus(`Welcome back, ${firstName(user.name)}. Do you want to resume where you left off?`);
      return;
    }
    setSessionStatus("Profile ready. New turns will be saved.");
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
    setResumePromptDismissed(true);
    setActiveResourceId(null);
    setProfile(makeDefaultProfile(industries, counties, communities));
    setMessage("");
    setSessionStatus("Started a new conversation.");
  }

  async function signOutFounder() {
    await signOut();
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
              <button className="ghost-button" type="button" onClick={() => void signOutFounder()}>
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
                  Welcome back, {firstName(registeredUser.name)}
                </span>
                <p className="status-line">
                  {resumeSession
                    ? "Do you want to resume where you left off?"
                    : activeSession
                      ? activeSession.title
                      : savedSessions.length
                        ? "Choose a saved path or start fresh."
                        : "Your next turn will create a saved path."}
                </p>
              </div>
              <div className="button-row">
                {resumeSession ? (
                  <button className="ghost-button active" type="button" onClick={() => void restoreSession(resumeSession)}>
                    Resume latest
                  </button>
                ) : (
                  savedSessions.slice(0, 3).map((session) => (
                    <button
                      className={session.id === activeSession?.id ? "ghost-button active" : "ghost-button"}
                      type="button"
                      key={session.id}
                      title={session.title}
                      onClick={() => void restoreSession(session)}
                    >
                      {session.title}
                    </button>
                  ))
                )}
                <button className="ghost-button" type="button" onClick={startNewPath}>
                  <RotateCcw size={16} aria-hidden="true" />
                  {resumeSession ? "Start fresh" : "New"}
                </button>
              </div>
            </>
          ) : authLoading ? (
            <div>
              <span className="eyebrow">
                <Save size={15} aria-hidden="true" />
                Checking account
              </span>
              <p className="status-line">Loading your Basecamp profile.</p>
            </div>
          ) : (
            <>
              <div>
                <span className="eyebrow">
                  <Save size={15} aria-hidden="true" />
                  Save and resume
                </span>
                <p className="status-line">Create an account when you want this path to follow you.</p>
              </div>
              <div className="session-panel__providers" aria-label="Provider registration">
                {providerOptions.map((provider) => (
                  <button
                    type="button"
                    className={`provider-button provider-button--${provider.id}`}
                    key={provider.id}
                    onClick={() => void registerWithProvider(provider.id)}
                  >
                    <span aria-hidden="true" />
                    {provider.label}
                  </button>
                ))}
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
            <a
              className="side-browser__url"
              href={externalResourceHref(activeResource.link)}
              target="_blank"
              rel="noreferrer"
            >
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
              <iframe
                src={externalResourceHref(activeResource.link)}
                title={`${activeResource.title} page`}
              />
              <div className="side-browser__frame-fallback">
                <strong>Preview blocked?</strong>
                <span>Some public sites do not allow embedded pages.</span>
                <a
                  className="primary-button"
                  href={externalResourceHref(activeResource.link)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open exact page
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              </div>
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
              <article
                className={
                  item.resource.id === activeResource?.id
                    ? "recommendation-card recommendation-card--active"
                    : "recommendation-card"
                }
                key={item.resource.slug}
              >
                <button
                  className="recommendation-card__select"
                  type="button"
                  onClick={() => setActiveResourceId(item.resource.id)}
                >
                  <span>{Math.round(item.score)} match</span>
                  <h3>{item.resource.title}</h3>
                  <p>{formatResourceUrl(item.resource.link)}</p>
                </button>
                <a
                  className="recommendation-card__open"
                  href={externalResourceHref(item.resource.link)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${item.resource.title}`}
                  onClick={() => setActiveResourceId(item.resource.id)}
                >
                  <ExternalLink size={18} aria-hidden="true" />
                </a>
              </article>
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
              <a
                href={externalResourceHref(resource.link)}
                target="_blank"
                rel="noreferrer"
                key={`${turn.id}-${resource.id}`}
                className={resource.id === activeResourceId ? "active" : ""}
                onClick={() => onSelectResource(resource.id)}
              >
                <ExternalLink size={14} aria-hidden="true" />
                {resource.title}
              </a>
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
  return inferFounderProfileFromText(current, input, { counties, industries, communities });
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

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "founder";
}

function providerLabel(provider: AuthProviderId) {
  const labels: Record<AuthProviderId, string> = {
    site: "Startup State",
    google: "Google",
    microsoft: "Microsoft",
    meta: "Meta"
  };
  return labels[provider];
}

function formatAssistantText(text: string) {
  const cleaned = text
    .replace(/\*\*/g, "")
    .replace(/\s*\[resource:[^\]]+\]/g, "")
    .replace(/\s+(Done:)/g, "\n\n$1")
    .replace(/\s+(Active:)/g, "\n$1")
    .replace(/\s+(Queued:)/g, "\n$1");
  return cleaned
    .split(/\n{2,}|\n(?=(?:Done|Active|Queued):)|\n(?=\d+\.)/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
