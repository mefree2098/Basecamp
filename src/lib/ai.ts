import { modelFallbacks } from "./site-context";
import { makePlanCards, recommendResources } from "./recommendations";
import type {
  AiProvider,
  AiSettings,
  FounderProfile,
  ModelOption,
  Resource,
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
  "Your job is to reduce overwhelm. Give the founder a clear first stop, then a short plan they can act on today.",
  "Use only the supplied Startup State resource candidates. Do not invent programs, eligibility, deadlines, funding amounts, contacts, or guarantees.",
  "Write like a calm human advisor, not a search engine and not a generic chatbot.",
  "Response contract:",
  "- Start with one direct sentence naming the best first stop and why it fits.",
  "- Then give 3 numbered steps at most. Each step should have a concrete action and cite every named resource as [resource:id].",
  "- Keep the answer under 180 words unless the user explicitly asks for more.",
  "- If the user asks for permits or legal compliance, tell them what to verify with the city/county instead of pretending the app can determine final requirements.",
  "- If the supplied resources do not fully answer part of the request, say that this guide cannot determine the final answer and use the closest cited resource as a next contact.",
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
  resources
}: {
  settings: AiSettings;
  profile: FounderProfile;
  message: string;
  resources: Resource[];
}): Promise<WizardResponse> {
  const recommendations = recommendResources(
    {
      ...profile,
      goal: message || profile.goal
    },
    resources,
    5
  );
  const planCards = makePlanCards(profile, recommendations);
  const context = buildGroundedContext(profile, message, recommendations);

  if (settings.provider === "mock" || !settings.provider) {
    return localResponse(settings, profile, message, recommendations, planCards);
  }

  try {
    const assistantMessage = await callProvider(settings, context);
    const orderedRecommendations = orderRecommendationsByCitations(assistantMessage, recommendations);
    return {
      assistantMessage,
      recommendations: orderedRecommendations,
      planCards: makePlanCards(profile, orderedRecommendations),
      usedProvider: settings.provider,
      guardrails: {
        deterministicFilters: true,
        citationsRequired: true,
        externalBrowsingUsed: false
      }
    };
  } catch {
    return {
      ...localResponse(settings, profile, message, recommendations, planCards),
      assistantMessage:
        "I used the local grounded guide for this path. The live AI provider could not complete the turn, but these matches still come from the Startup State resource data.",
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
  recommendations: ReturnType<typeof recommendResources>
) {
  return [
    BASECAMP_SYSTEM_PROMPT,
    `Founder profile: stage=${profile.stage}, industry=${profile.industry}, county=${profile.county}, community=${profile.community}.`,
    `Founder message: ${message || profile.goal}`,
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
  planCards: ReturnType<typeof makePlanCards>
): WizardResponse {
  const lead = recommendations[0];
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
