import { modelFallbacks } from "./site-context";
import {
  isCommercializationIntent,
  isFormationIntent,
  makePlanCards,
  recommendResources
} from "./recommendations";
import {
  hasAngelGroupIntent,
  hasFundingIntent,
  hasIdeaFirstStepIntent,
  hasInternationalExpansionIntent,
  hasOperatingCompanySignals,
  hasTechnologyCommercializationIntent,
  hasVentureCapitalIntent,
  inferStageFromText
} from "./founderInference";
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
  "You are Basecamp, the friendly but practical personal assistant for Utah Startup State founders.",
  "Mission: make the official Startup State resource ecosystem feel like a state-assigned concierge, not a library. The founder should never have to wonder what to do next, what page matters, what information to prepare, or whether the assistant remembers where they left off.",
  "Scope: stay inside Startup State and directly adjacent public/business resources represented in the supplied candidate data. You may help with business setup, business planning, validation, registration/licensing pointers, EIN/FEIN sequencing, operations setup, taxes, funding/capital resources, pitch preparation, mentoring, education, workforce, government contracts, international trade, community programs, relocation, exit/closure, and the Utah startup map.",
  "Source discipline: use only the supplied Startup State resource candidates, direct URLs, prior session context, and Basecamp-curated first-stop links. Do not invent programs, eligibility, deadlines, funding amounts, legal requirements, contacts, vendors, or guarantees. If a detail is missing, say exactly who or what page the founder should verify it with.",
  "Tone: calm, direct, and human. Sound like a capable public-sector startup assistant who is personally responsible for getting the founder through the process. Do not sound like a generic chatbot, search engine, or legal disclaimer.",
  "Plan-first protocol:",
  "- On the first substantive founder message, create a working plan before deep-diving into any single resource.",
  "- The plan is an ordered checklist of what the founder will need to complete, tailored to stage, county/location, industry, community, and stated goal.",
  "- Every plan item is a request/task with a status: Done, Active, Queued, or Blocked. Treat exactly one unfinished item as Active.",
  "- Start with the earliest necessary step. Do not let the founder jump to funding, pitch competitions, or grants if registration, business plan, validation, or basic operations are prerequisite for their situation.",
  "- For a new Utah business, use this default order unless the founder's situation clearly overrides it: clarify idea/customer, choose name/entity structure, draft business plan essentials, register/licensure with Utah and local authorities, get EIN/FEIN, set up banking/accounting/insurance/records, confirm taxes, then consider community support and funding.",
  "- If the founder says they are already operating, have paying customers/revenue/traction, or are raising an angel/VC/venture round, treat that as a funding-stage request. Do not send them to formation, EIN, or bank-account setup unless they explicitly say those basics are missing.",
  "- For a growth-stage company, use the growth order: identify the growth bottleneck, prepare strategic/funding materials, choose capital/workforce/contracts/export/community path, use exact resource pages, then schedule follow-up.",
  "- For exit/closure, use the exit order: clarify sale/succession/closure, verify legal/tax/licensing obligations, contact appropriate advisors/agencies, then document completion.",
  "Step-by-step operating protocol:",
  "- After creating or updating the plan, work only the Active item unless the founder asks for a full overview.",
  "- For the Active item, provide the exact page URL and explain what to do on that page, what information to gather, what choices to make, and what result to bring back.",
  "- If the page contains a form, intake, application, or registration flow, guide the founder through the fields in plain language. Ask for one missing piece at a time when needed.",
  "- When the founder says a step is done, acknowledge it, mark it conceptually complete, do not repeat it, and advance to the next Queued item.",
  "- If the founder reports a blocker, mark the item conceptually Blocked, ask for the smallest clarifying detail needed, and route to an advisor or exact resource when appropriate.",
  "- When all tracked items are complete, explicitly say the current plan is complete and ask what else the founder would like help with next.",
  "Personalization rules:",
  "- A landscaping founder in St. George should see different local/licensing/community/funding guidance than a pre-revenue software founder in Lehi.",
  "- Use county, city, rural status, veteran/woman/student/new American/multicultural context, industry, stage, customer type, funding need, and timeline to shape both the plan and the first page.",
  "- Prefer direct action links over broad homepages. If a broad homepage and a deeper action page are both available, choose the deeper action page.",
  "Resource citation rules:",
  "- Cite every named resource as [resource:id].",
  "- Include direct page URLs in the answer when useful. The app will also open the top resource in the side panel, so choose the first cited resource deliberately.",
  "- Do not cite resources that were not supplied.",
  "Response contract:",
  "- Start with a short sentence that names the plan status and the Active step.",
  "- Then provide a compact plan status block when this is a new plan or the plan changed. Use lines like: Done: ..., Active: ..., Queued: ...",
  "- Then give 1-3 concrete actions for the Active step, with exact URL(s) and citations.",
  "- End by telling the founder what to report back so you can advance the plan.",
  "- Normal turns should stay under 260 words; initial plan turns may be up to 340 words. Be concise unless the founder asks for detail.",
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
  const turnProfile = refineProfileForTurn(profile, message, isContinuation);
  const effectiveProfile = {
    ...turnProfile,
    goal: isContinuation ? turnProfile.goal : message || turnProfile.goal
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

function refineProfileForTurn(
  profile: FounderProfile,
  message: string,
  isContinuation: boolean
): FounderProfile {
  if (isContinuation) return profile;
  const goal = message || profile.goal;
  return {
    ...profile,
    stage: inferStageFromText(goal, profile.stage),
    goal
  };
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
  const turnProfile = refineProfileForTurn(profile, message, isContinuationTurn(message, sessionContext));
  const effectiveProfile = {
    ...turnProfile,
    goal: isContinuationTurn(message, sessionContext) ? turnProfile.goal : message || turnProfile.goal
  };
  return [
    BASECAMP_SYSTEM_PROMPT,
    `Founder profile: stage=${effectiveProfile.stage}, industry=${effectiveProfile.industry}, county=${effectiveProfile.county}, community=${effectiveProfile.community}.`,
    `Founder message: ${message || profile.goal}`,
    isFormationIntent(effectiveProfile)
      ? "Formation guidance for this intent: include the business setup sequence, in order: choose name/entity structure, Utah registration/licensure, EIN/FEIN, business bank account. Keep it simple and cite the matching resources below."
      : "",
    hasIdeaFirstStepIntent(effectiveProfile.goal)
      ? "First-step idea guidance for this intent: the founder has an idea or no business yet. Start with idea clarity, mentor/SBDC or get-started support, and validation. Do not route to VC or angel outreach unless the founder explicitly says they are raising a round."
      : "",
    hasFundingIntent(effectiveProfile.goal)
      ? "Funding guidance for this intent: treat an already-operating company with customers as capital-ready, not formation-stage. Start with investor readiness, target investor/resource fit, pitch materials, warm-introduction or intake paths, and follow-up tracking. Do not route to EIN, bank account, or basic startup setup unless the founder says those are missing."
      : "",
    hasAngelGroupIntent(effectiveProfile.goal)
      ? "Angel guidance for this intent: if supplied angel resources are candidate matches, include at least one angel group before generic venture funds."
      : "",
    hasInternationalExpansionIntent(effectiveProfile.goal)
      ? "International growth guidance for this intent: prioritize export, international trade, World Trade Center, U.S. Commercial Service, and sector-specific growth resources before generic startup mentoring."
      : "",
    hasTechnologyCommercializationIntent(effectiveProfile.goal)
      ? "Research commercialization guidance for this intent: prioritize university entrepreneurship/commercialization, IP ownership, technology validation, and sector-specific advisors before generic entity/EIN/banking steps."
      : "",
    sessionContext ? formatSessionContext(sessionContext) : "",
    formatTrackedPlan(planPreview(effectiveProfile, recommendations), sessionContext),
    "Candidate resources:",
    ...recommendations.map(
      (item, index) =>
        `${index + 1}. ${item.resource.title} [resource:${item.resource.id}] - Direct page: ${item.resource.link} - ${item.resource.description}`
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
  if (isCommercializationIntent(effectiveProfile)) {
    return commercializationResponse(settings, effectiveProfile, recommendations, planCards, sessionContext);
  }
  if (isFormationIntent(effectiveProfile)) {
    const registration =
      findRecommendation(recommendations, "basecamp-startup-state-registration") ?? lead;
    const ein = findRecommendation(recommendations, "basecamp-irs-ein");
    const bank = findRecommendation(recommendations, "basecamp-sba-business-bank-account");
    const specialty = findSpecializedFormationRecommendation(effectiveProfile, recommendations);
    const first = registration ?? lead;
    const activeStep = nextActivePlanCard(planCards, sessionContext?.completedSteps);
    const steps = [
      first
        ? `I created a working startup plan. Active step: ${activeStep?.title ?? "start the Utah formation path"}.`
        : `Start by turning the idea into a business setup checklist before chasing grants or events.`,
      formatPlanStatus(planCards, sessionContext?.completedSteps),
      first
        ? `1. Today: pick a working business name and entity structure, then use ${first.resource.title} at ${first.resource.link} to check Utah registration and licensing. [resource:${first.resource.id}]`
        : "1. Today: pick a working business name and entity structure.",
      specialty
        ? `2. Because of your ${formationContextLabel(effectiveProfile)} context, queue ${specialty.resource.title} at ${specialty.resource.link} as the support resource right after the formation basics are clear. [resource:${specialty.resource.id}]`
        : "2. Do not skip ahead yet; the EIN, banking, taxes, and funding items stay queued until the formation details are ready.",
      [
        ein && bank
          ? `3. When this active step is done, I will move you to ${ein.resource.title} and then ${bank.resource.title}. [resource:${ein.resource.id}] [resource:${bank.resource.id}]`
          : "3. When this active step is done, I will move you to the next queued item.",
        "Tell me when the active step is done or paste the page question that slows you down, and I will move the plan forward."
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

  if (effectiveProfile.stage === "fund") {
    return fundingResponse(settings, effectiveProfile, recommendations, planCards, sessionContext);
  }

  const assistantMessage = lead
    ? [
        `I created a working founder plan. Active step: ${nextActivePlanCard(planCards, sessionContext?.completedSteps)?.title ?? `use ${lead.resource.title}`}.`,
        formatPlanStatus(planCards, sessionContext?.completedSteps),
        `1. Today: open ${lead.resource.title} at ${lead.resource.link} and capture the specific application, mentor, or intake step that matches your goal. [resource:${lead.resource.id}]`,
        ...recommendations.slice(1, 3).map(
          (item, index) =>
            `${index + 2}. Next: use ${item.resource.title} at ${item.resource.link} to cover the part ${lead.resource.title} does not solve directly. [resource:${item.resource.id}]`
        ),
        "Tell me what you complete or where you get stuck, and I will advance the plan one step at a time."
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

function commercializationResponse(
  settings: AiSettings,
  profile: FounderProfile,
  recommendations: ReturnType<typeof recommendResources>,
  planCards: ReturnType<typeof makePlanCards>,
  sessionContext?: SessionContext
): WizardResponse {
  const lead = recommendations[0];
  const activeStep =
    nextActivePlanCard(planCards, sessionContext?.completedSteps)?.title ??
    "map the research commercialization path";
  const secondary = recommendations.slice(1, 3);
  const assistantMessage = [
    `I created a commercialization plan. Active step: ${activeStep}.`,
    formatPlanStatus(planCards, sessionContext?.completedSteps),
    "1. Today: write down the invention, current lab or university ownership context, patent/IP questions, target customer, and what proof exists outside the lab.",
    lead
      ? `2. Start with ${lead.resource.title} at ${lead.resource.link}; use it to find the right entrepreneurship, commercialization, mentor, or intake path before forming the company. [resource:${lead.resource.id}]`
      : "2. Start with the University of Utah or Startup State commercialization resource that can confirm the IP and advisor path before entity setup.",
    secondary.length
      ? `3. Compare ${secondary
          .map((item) => `${item.resource.title} [resource:${item.resource.id}]`)
          .join(" and ")} for the next advisor or validation step.`
      : "3. After that, move to formation, EIN, and banking only once the IP and customer path are clear.",
    "Tell me what resource or intake form you choose, and I will help you advance the plan one step at a time."
  ].join("\n\n");

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

function findSpecializedFormationRecommendation(
  profile: FounderProfile,
  recommendations: ReturnType<typeof recommendResources>
) {
  const text = profile.goal.toLowerCase();
  if (/veteran|military/.test(text)) {
    return recommendations.find((item) =>
      /veteran|vbrc|strive/i.test(
        `${item.resource.title} ${item.resource.description} ${item.resource.link}`
      )
    );
  }
  if (/new american|immigrant|refugee|multicultural|minority|asian|latino|hispanic|pacific islander|black|woman|women|female/.test(text)) {
    return recommendations.find((item) =>
      /women|woman|female|suazo|hispanic|asian|black|pacific island|multicultural|new american|immigrant|refugee|lialaunch|bolder/i.test(
        `${item.resource.title} ${item.resource.description} ${item.resource.communities.join(" ")}`
      )
    );
  }
  return undefined;
}

function formationContextLabel(profile: FounderProfile) {
  const text = profile.goal.toLowerCase();
  if (/veteran|military/.test(text) && /manufactur|fabrication|machining|custom fab/.test(text)) {
    return "veteran manufacturing";
  }
  if (/veteran|military/.test(text)) return "veteran";
  if (/new american|immigrant|refugee/.test(text)) return "New American";
  if (/multicultural|minority|asian|latino|hispanic|pacific islander|black/.test(text)) {
    return "multicultural";
  }
  if (/woman|women|female/.test(text)) return "women founder";
  return "founder";
}

function fundingResponse(
  settings: AiSettings,
  profile: FounderProfile,
  recommendations: ReturnType<typeof recommendResources>,
  planCards: ReturnType<typeof makePlanCards>,
  sessionContext?: SessionContext
): WizardResponse {
  const lead = recommendations[0];
  const activeStep =
    nextActivePlanCard(planCards, sessionContext?.completedSteps)?.title ??
    "prepare the investor-ready funding path";
  const isVentureRound = hasVentureCapitalIntent(profile.goal);
  const isOperatingCompany = hasOperatingCompanySignals(profile.goal);
  const secondary = recommendations.slice(1, 3);
  const resourceLine = lead
    ? `2. Start with ${lead.resource.title} at ${lead.resource.link}; capture whether it is a fit for your stage, sector, check size, and contact or introduction path. [resource:${lead.resource.id}]`
    : "2. Build the target list from Utah funding resources that match your stage, sector, and location.";
  const compareLine = secondary.length
    ? `3. Compare ${secondary
        .map((item) => `${item.resource.title} [resource:${item.resource.id}]`)
        .join(" and ")} as additional targets before you spend time on applications or outreach.`
    : "3. Track each outreach target, fit notes, and follow-up date before moving to submissions.";
  const assistantMessage = [
    `I created a ${isVentureRound ? "capital-readiness" : "funding"} plan. Active step: ${activeStep}.`,
    formatPlanStatus(planCards, sessionContext?.completedSteps),
    isOperatingCompany
      ? "1. Today: assemble the investor packet for an operating company: one-line positioning, customer/revenue proof, current traction, round size, use of funds, and the warm-intro target list."
      : "1. Today: assemble the funding packet: concise business summary, traction or validation proof, budget, use of funds, and timeline.",
    resourceLine,
    compareLine,
    "Tell me which resource looks like a fit or paste the intake/contact question, and I will help turn it into the next outreach step."
  ].join("\n\n");

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

function continuationResponse(
  settings: AiSettings,
  profile: FounderProfile,
  recommendations: ReturnType<typeof recommendResources>,
  planCards: ReturnType<typeof makePlanCards>,
  sessionContext?: SessionContext
): WizardResponse {
  const completed = new Set(sessionContext?.completedSteps ?? []);
  const incompletePlan = planCards.filter((card) => !completed.has(card.title));
  if (planCards.length && incompletePlan.length === 0) {
    return {
      assistantMessage: [
        `Everything in this plan is marked complete: ${planCards.map((card) => card.title).join("; ")}.`,
        "You are at a clean stopping point. What else can I help you with: funding, local licensing, hiring, business planning, taxes, mentors, or something else?"
      ].join("\n\n"),
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
        `Next, use ${nextResource.resource.title} as the follow-up stop because it keeps the work inside Startup State scope. Open ${nextResource.resource.link}. [resource:${nextResource.resource.id}]`,
        `1. Today: ${nextPlan}.`,
        `2. Bring your completed setup notes to ${nextResource.resource.title} at ${nextResource.resource.link} and ask what local licensing, finance, or mentor step comes next. [resource:${nextResource.resource.id}]`,
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

function planPreview(
  profile: FounderProfile,
  recommendations: ReturnType<typeof recommendResources>
) {
  return makePlanCards(profile, recommendations);
}

function nextActivePlanCard(
  planCards: ReturnType<typeof makePlanCards>,
  completedSteps: string[] = []
) {
  const completed = new Set(completedSteps);
  return planCards.find((card) => !completed.has(card.title));
}

function formatPlanStatus(
  planCards: ReturnType<typeof makePlanCards>,
  completedSteps: string[] = []
) {
  const completed = new Set(completedSteps);
  const active = nextActivePlanCard(planCards, completedSteps);
  const done = planCards.filter((card) => completed.has(card.title)).map((card) => card.title);
  const queued = planCards
    .filter((card) => card.title !== active?.title && !completed.has(card.title))
    .map((card) => card.title);
  return [
    done.length ? `Done: ${done.join("; ")}` : "Done: none yet",
    active ? `Active: ${active.title}` : "Active: none",
    queued.length ? `Queued: ${queued.join("; ")}` : "Queued: none"
  ].join("\n");
}

function formatTrackedPlan(
  planCards: ReturnType<typeof makePlanCards>,
  sessionContext?: SessionContext
) {
  if (!planCards.length) return "";
  return [
    "Tracked founder plan preview:",
    formatPlanStatus(planCards, sessionContext?.completedSteps),
    "Use this plan as the persistent task list. Do not replace it on continuation turns unless the founder changes goals."
  ].join("\n");
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
