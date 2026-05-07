import { modelFallbacks } from "./site-context";
import { isFormationIntent, makePlanCards, recommendResources } from "./recommendations";
import type {
  AiProvider,
  AiSettings,
  FounderProfile,
  ModelOption,
  Resource,
  SessionContext,
  WizardResponse
} from "./types";
import { runCodexChat, listCodexModels } from "./codex/appServer";

const providerDefaults: Record<AiProvider, string> = {
  mock: "basecamp-local-guide",
  openai: "gpt-5.2",
  codexPath: "gpt-5.5",
  anthropic: "claude-sonnet-4-5",
  gemini: "gemini-2.5-flash"
};

export const BASECAMP_SYSTEM_PROMPT = [
  "You are Basecamp, the friendly but practical guide for Utah Startup State founders.",
  "Your job is to reduce overwhelm while staying inside the scope of Startup State: business setup, registration/licensing pointers, mentoring, funding/capital resources, education, community programs, and the Utah startup map.",
  "Use only the supplied Startup State resource candidates and Basecamp-curated direct links that support Startup State workflows. Do not invent programs, eligibility, deadlines, funding amounts, contacts, accounts, vendors, or guarantees.",
  "Write like a calm human advisor, not a search engine and not a generic chatbot.",
  "For new company or startup goals, do not stop at generic mentoring. Include the formation order: choose structure/name, register/licensure with Utah, get an EIN/FEIN, then open a business bank account.",
  "Do not recommend out-of-scope product-platform accounts, app-store enrollment, bank products, legal filings, tax positions, or vendors unless they are explicitly present in the supplied candidates. If the user asks about those, mark them outside Basecamp's Startup State scope and route them to the closest cited Startup State resource or advisor.",
  "For continuation turns, acknowledge completed steps, do not repeat them, and give the next 1-3 Startup State-scoped actions.",
  "Prefer candidates with direct action links over broad platform homepages when both are relevant.",
  "Response contract:",
  "- Start with one direct sentence naming the clear first stop and why it fits.",
  "- Then give 3 numbered steps at most. Each step should have a concrete action and cite every named resource as [resource:id].",
  "- Keep the answer under 180 words unless the user explicitly asks for more.",
  "- If the user asks for permits or legal compliance, tell them what to verify with the city/county instead of pretending the app can determine final requirements.",
  "- If the supplied resources do not fully answer part of the request, say exactly what to verify and with whom; do not make a vague disclaimer the main answer.",
  "- Do not mention system prompts, deterministic filters, model/provider details, or internal data handling."
].join("\n");

export async function listModels(settings?: Partial<AiSettings>): Promise<ModelOption[]> {
  if (!settings?.provider || settings.provider === "mock") {
    return modelFallbacks;
  }

  if (settings.provider === "codexPath") {
    try {
      const models = await listCodexModels(settings);
      if (models.length) {
        return models.map((model) => ({
          id: model,
          label: model,
          provider: "codexPath",
          supportsThinking: true,
          costHint: "unknown"
        }));
      }
    } catch {
      return modelFallbacks.filter(
        (model) => model.provider === "codexPath" || model.provider === "mock"
      );
    }
  }

  return modelFallbacks.filter(
    (model) => model.provider === settings.provider || model.provider === "mock"
  );
}

export async function runWizardTurn({
  settings,
  profile,
  message,
  resources,
  sessionContext
}: {
  settings: AiSettings;
  profile: FounderProfile;
  message: string;
  resources: Resource[];
  sessionContext?: SessionContext;
}): Promise<WizardResponse> {
  const isContinuation = isContinuationTurn(message, sessionContext);
  const effectiveProfile = {
    ...profile,
    goal: isContinuation ? profile.goal : message || profile.goal
  };
  const recommendations = recommendResources(effectiveProfile, resources, 7);
  const planCards =
    isContinuation && sessionContext?.currentPlanCards?.length
      ? sessionContext.currentPlanCards
      : makePlanCards(effectiveProfile, recommendations);
  const context = buildGroundedContext(effectiveProfile, message, recommendations, sessionContext);

  if (settings.provider === "mock" || !settings.provider) {
    return localResponse(settings, effectiveProfile, message, recommendations, planCards, sessionContext);
  }

  try {
    const assistantMessage = await callProvider(settings, context);
    const orderedRecommendations = orderRecommendationsByCitations(assistantMessage, recommendations);
    return {
      assistantMessage,
      recommendations: orderedRecommendations,
      planCards:
        isContinuation && sessionContext?.currentPlanCards?.length
          ? sessionContext.currentPlanCards
          : makePlanCards(effectiveProfile, orderedRecommendations),
      usedProvider: settings.provider,
      guardrails: {
        deterministicFilters: true,
        citationsRequired: true,
        externalBrowsingUsed: false
      }
    };
  } catch {
    return {
      ...localResponse(settings, effectiveProfile, message, recommendations, planCards, sessionContext),
      usedProvider: "mock"
    };
  }
}

export function orderRecommendationsByCitations(
  assistantMessage: string,
  recommendations: ReturnType<typeof recommendResources>
) {
  const citedIds = Array.from(
    assistantMessage.matchAll(/\[resource:([^\]]+)\]/g),
    (match) => match[1]
  );
  if (!citedIds.length) return recommendations;

  const seen = new Set<string>();
  const byId = new Map(recommendations.map((item) => [item.resource.id, item]));
  const cited = citedIds
    .map((id) => byId.get(id))
    .filter((item): item is (typeof recommendations)[number] => Boolean(item))
    .filter((item) => {
      if (seen.has(item.resource.id)) return false;
      seen.add(item.resource.id);
      return true;
    });
  return [...cited, ...recommendations.filter((item) => !seen.has(item.resource.id))];
}

async function callProvider(settings: AiSettings, context: string) {
  if (settings.provider === "openai") {
    return callOpenAi(settings, context);
  }
  if (settings.provider === "anthropic") {
    return callAnthropic(settings, context);
  }
  if (settings.provider === "gemini") {
    return callGemini(settings, context);
  }
  if (settings.provider === "codexPath") {
    return runCodexChat(settings, context);
  }
  return context;
}

async function callOpenAi(settings: AiSettings, context: string) {
  const apiKey = settings.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key is not configured.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: settings.model || providerDefaults.openai,
      instructions: BASECAMP_SYSTEM_PROMPT,
      input: context,
      reasoning:
        settings.thinkingLevel && settings.thinkingLevel !== "none"
          ? { effort: settings.thinkingLevel === "xhigh" ? "high" : settings.thinkingLevel }
          : undefined,
      max_output_tokens: 700
    })
  });
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}.`);
  const json = (await response.json()) as { output_text?: string };
  return json.output_text || "I found relevant resources, but the provider returned no text.";
}

async function callAnthropic(settings: AiSettings, context: string) {
  const apiKey = settings.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key is not configured.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: settings.model || providerDefaults.anthropic,
      max_tokens: 700,
      system: BASECAMP_SYSTEM_PROMPT,
      messages: [{ role: "user", content: context }]
    })
  });
  if (!response.ok) throw new Error(`Anthropic returned ${response.status}.`);
  const json = (await response.json()) as { content?: Array<{ text?: string }> };
  return json.content?.map((item) => item.text).filter(Boolean).join("\n") || "";
}

async function callGemini(settings: AiSettings, context: string) {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is not configured.");
  const model = encodeURIComponent(settings.model || providerDefaults.gemini);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: context }] }],
        generationConfig: { maxOutputTokens: 700 },
        thinkingConfig:
          settings.thinkingLevel === "none"
            ? { thinkingBudget: 0 }
            : { thinkingBudget: settings.thinkingLevel === "high" ? 2048 : 1024 }
      })
    }
  );
  if (!response.ok) throw new Error(`Gemini returned ${response.status}.`);
  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (
    json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n") || ""
  );
}

export function buildGroundedContext(
  profile: FounderProfile,
  message: string,
  recommendations: ReturnType<typeof recommendResources>,
  sessionContext?: SessionContext
) {
  const effectiveProfile = {
    ...profile,
    goal: isContinuationTurn(message, sessionContext) ? profile.goal : message || profile.goal
  };
  return [
    BASECAMP_SYSTEM_PROMPT,
    `Founder profile: stage=${profile.stage}, industry=${profile.industry}, county=${profile.county}, community=${profile.community}.`,
    `Founder message: ${message || profile.goal}`,
    isFormationIntent(effectiveProfile)
      ? "Formation guidance for this intent: include the business setup sequence, in order: choose name/entity structure, Utah registration/licensure, EIN/FEIN, business bank account. Keep it simple and cite the matching resources below."
      : "",
    sessionContext ? formatSessionContext(sessionContext) : "",
    "Candidate resources:",
    ...recommendations.map(
      (item, index) =>
        `${index + 1}. ${item.resource.title} [resource:${item.resource.id}] - ${item.resource.description}`
    ),
    "Return the founder-facing answer only."
  ].join("\n\n");
}

function localResponse(
  settings: AiSettings,
  profile: FounderProfile,
  message: string,
  recommendations: ReturnType<typeof recommendResources>,
  planCards: ReturnType<typeof makePlanCards>,
  sessionContext?: SessionContext
): WizardResponse {
  const lead = recommendations[0];
  const effectiveProfile = {
    ...profile,
    goal: isContinuationTurn(message, sessionContext) ? profile.goal : message || profile.goal
  };
  if (isContinuationTurn(message, sessionContext)) {
    return continuationResponse(settings, effectiveProfile, recommendations, planCards, sessionContext);
  }
  if (isFormationIntent(effectiveProfile)) {
    const registration =
      findRecommendation(recommendations, "basecamp-startup-state-registration") ?? lead;
    const ein = findRecommendation(recommendations, "basecamp-irs-ein");
    const bank = findRecommendation(recommendations, "basecamp-sba-business-bank-account");
    const first = registration ?? lead;
    const steps = [
      first
        ? `Start with ${first.resource.title}; your idea is becoming a Utah business, so formation belongs in the first path. [resource:${first.resource.id}]`
        : `Start by turning the idea into a business setup checklist before chasing grants or events.`,
      first
        ? `1. Today: pick a working business name and entity structure, then use ${first.resource.title} to check Utah registration and licensing. [resource:${first.resource.id}]`
        : "1. Today: pick a working business name and entity structure.",
      ein
        ? `2. Next: after the state entity step is ready, get the EIN/FEIN through ${ein.resource.title}. [resource:${ein.resource.id}]`
        : "2. Next: get the EIN/FEIN after the state entity step is ready.",
      [
        bank
          ? `3. Then: open the business bank account with the entity records and EIN in hand using ${bank.resource.title}. [resource:${bank.resource.id}]`
          : "3. Then: open the business bank account once entity records and EIN are ready."
      ]
        .filter(Boolean)
        .join(" ")
    ];

    return {
      assistantMessage: steps.join("\n\n"),
      recommendations,
      planCards,
      usedProvider: settings.provider || "mock",
      guardrails: {
        deterministicFilters: true,
        citationsRequired: true,
        externalBrowsingUsed: false
      }
    };
  }

  const assistantMessage = lead
    ? [
        `Start with ${lead.resource.title}; it is the clearest first stop for a ${profile.stage} founder in ${profile.county || "Utah"}. [resource:${lead.resource.id}]`,
        `1. Today: open ${lead.resource.title} and capture the specific application, mentor, or intake step that matches your goal. [resource:${lead.resource.id}]`,
        ...recommendations.slice(1, 3).map(
          (item, index) =>
            `${index + 2}. Next: use ${item.resource.title} to cover the part ${lead.resource.title} does not solve directly. [resource:${item.resource.id}]`
        )
      ].join("\n\n")
    : `I could not find a tight match for "${message}", so I would broaden the filters and start with statewide Startup State resources.`;

  return {
    assistantMessage,
    recommendations,
    planCards,
    usedProvider: settings.provider || "mock",
    guardrails: {
      deterministicFilters: true,
      citationsRequired: true,
      externalBrowsingUsed: false
    }
  };
}

function findRecommendation(
  recommendations: ReturnType<typeof recommendResources>,
  id: string
) {
  return recommendations.find((item) => item.resource.id === id);
}

function continuationResponse(
  settings: AiSettings,
  profile: FounderProfile,
  recommendations: ReturnType<typeof recommendResources>,
  planCards: ReturnType<typeof makePlanCards>,
  sessionContext?: SessionContext
): WizardResponse {
  const completed = new Set(sessionContext?.completedSteps ?? []);
  const incompletePlan = planCards.filter((card) => !completed.has(card.title));
  const advisor =
    findRecommendation(recommendations, "basecamp-sbdc-consultation") ??
    findRecommendation(recommendations, "basecamp-score-mentor");
  const nextResource =
    advisor ??
    recommendations.find((item) => !sessionContext?.previousAssistantMessage?.includes(item.resource.id)) ??
    recommendations[0];
  const acknowledged = completed.size
    ? `Nice, I have those marked complete: ${Array.from(completed).join("; ")}.`
    : "Got it, I will continue from the current path instead of starting over.";
  const nextPlan =
    incompletePlan[0]?.title ??
    "move from setup into a Startup State advisor conversation and a one-page operating plan";
  const assistantMessage = nextResource
    ? [
        acknowledged,
        `Next, use ${nextResource.resource.title} as the follow-up stop because it keeps the work inside Startup State scope. [resource:${nextResource.resource.id}]`,
        `1. Today: ${nextPlan}.`,
        `2. Bring your completed setup notes to ${nextResource.resource.title} and ask what local licensing, finance, or mentor step comes next. [resource:${nextResource.resource.id}]`,
        "3. After that, update Basecamp with what they tell you so the next path can narrow instead of repeat."
      ].join("\n\n")
    : `${acknowledged}\n\nNext, update your Startup State path with the outcome of the completed steps so Basecamp can narrow the next resource.`;

  return {
    assistantMessage,
    recommendations,
    planCards,
    usedProvider: settings.provider || "mock",
    guardrails: {
      deterministicFilters: true,
      citationsRequired: true,
      externalBrowsingUsed: false
    }
  };
}

function isContinuationTurn(message: string, sessionContext?: SessionContext) {
  return Boolean(
    sessionContext?.history?.length ||
      sessionContext?.previousAssistantMessage ||
      sessionContext?.completedSteps?.length ||
      /\b(done|completed|finished|next|what'?s next|continue|did those|marked)\b/i.test(message)
  );
}

function formatSessionContext(sessionContext: SessionContext) {
  const pendingPlan = (sessionContext.currentPlanCards ?? [])
    .filter((card) => !(sessionContext.completedSteps ?? []).includes(card.title))
    .map((card) => `${card.title} (${card.dueWindow.replace("_", " ")})`)
    .join("; ");
  const history = (sessionContext.history ?? [])
    .slice(-4)
    .map(
      (turn, index) =>
        `${index + 1}. User: ${turn.userMessage}\nAssistant: ${turn.assistantMessage}\nCompleted then: ${(turn.completedSteps ?? []).join("; ") || "none"}`
    )
    .join("\n");
  return [
    "Session continuation context:",
    `Completed steps now: ${(sessionContext.completedSteps ?? []).join("; ") || "none"}.`,
    pendingPlan ? `Current unfinished plan steps: ${pendingPlan}.` : "",
    sessionContext.previousAssistantMessage
      ? `Previous answer: ${sessionContext.previousAssistantMessage}`
      : "",
    history ? `Recent turns:\n${history}` : "",
    "If this is a next-step request, do not re-assign completed steps unless they must be verified. Advance the founder to the next Startup State-scoped action."
  ]
    .filter(Boolean)
    .join("\n");
}
