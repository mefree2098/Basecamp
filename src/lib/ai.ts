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
    return {
      assistantMessage,
      recommendations,
      planCards,
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

function buildGroundedContext(
  profile: FounderProfile,
  message: string,
  recommendations: ReturnType<typeof recommendResources>
) {
  return [
    "You are Basecamp, a grounded Startup State founder guide.",
    "Only recommend resources from the supplied citations. Do not invent eligibility.",
    `Founder profile: stage=${profile.stage}, industry=${profile.industry}, county=${profile.county}, community=${profile.community}.`,
    `Founder message: ${message || profile.goal}`,
    "Candidate resources:",
    ...recommendations.map(
      (item, index) =>
        `${index + 1}. ${item.resource.title} [resource:${item.resource.id}] - ${item.resource.description}`
    ),
    "Write a concise answer with next steps and cite resource ids inline."
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
    ? `Start with ${lead.resource.title}. It is the strongest match for a ${profile.stage} founder in ${profile.county || "Utah"} because ${lead.why.toLowerCase()} I would pair it with ${recommendations
        .slice(1, 3)
        .map((item) => item.resource.title)
        .join(" and ")}.`
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
