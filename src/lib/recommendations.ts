import { stageLabels } from "./site-context";
import type { FounderProfile, PlanCard, Recommendation, Resource } from "./types";

export function recommendResources(
  profile: FounderProfile,
  resources: Resource[],
  limit = 6
): Recommendation[] {
  return resources
    .map((resource) => {
      const score = scoreResource(profile, resource);
      return {
        resource,
        score,
        why: explainMatch(profile, resource, score),
        citations: [`resource:${resource.id}`]
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (isFormationIntent(profile)) {
        const formationOrder =
          formationResourcePriority(a.resource) - formationResourcePriority(b.resource);
        if (formationOrder !== 0) return formationOrder;
      }
      return b.score - a.score || a.resource.title.localeCompare(b.resource.title);
    })
    .slice(0, limit);
}

export function makePlanCards(profile: FounderProfile, recommendations: Recommendation[]): PlanCard[] {
  if (isFormationIntent(profile)) {
    return [
      {
        title: "Choose a business name and entity structure",
        dueWindow: "today" as const,
        status: "suggested" as const
      },
      {
        title: "Draft the core business plan answers",
        dueWindow: "7_days" as const,
        status: "suggested" as const
      },
      {
        title: "Register with Utah and verify local licensure",
        dueWindow: "7_days" as const,
        status: "suggested" as const
      },
      {
        title: "Get the EIN/FEIN after state registration is ready",
        dueWindow: "7_days" as const,
        status: "suggested" as const
      },
      {
        title: "Set up business operations, banking, insurance, and records",
        dueWindow: "30_days" as const,
        status: "suggested" as const
      },
      {
        title: "Confirm taxes, community support, and funding next steps",
        dueWindow: "30_days" as const,
        status: "suggested" as const
      }
    ];
  }

  if (profile.stage === "idea") {
    return [
      {
        title: "Clarify the problem, customer, and first business idea",
        dueWindow: "today" as const,
        status: "suggested" as const
      },
      {
        title: "Build basic business skills and talk with a mentor",
        dueWindow: "7_days" as const,
        status: "suggested" as const
      },
      {
        title: "Validate the idea with real potential customers",
        dueWindow: "30_days" as const,
        status: "suggested" as const
      },
      {
        title: "Turn the validated idea into a simple business plan",
        dueWindow: "30_days" as const,
        status: "suggested" as const
      }
    ];
  }

  if (profile.stage === "validate") {
    return [
      {
        title: "Validate customer demand and the problem worth solving",
        dueWindow: "today" as const,
        status: "suggested" as const
      },
      {
        title: "Build or refine the first product or service offer",
        dueWindow: "7_days" as const,
        status: "suggested" as const
      },
      {
        title: "Define brand, marketing, and first sales channel",
        dueWindow: "30_days" as const,
        status: "suggested" as const
      },
      {
        title: "Prepare the registration and operations path",
        dueWindow: "30_days" as const,
        status: "suggested" as const
      }
    ];
  }

  if (profile.stage === "fund") {
    return [
      {
        title: "Prepare business plan, financials, and use-of-funds story",
        dueWindow: "today" as const,
        status: "suggested" as const
      },
      {
        title: "Choose the right funding path: grant, loan, competition, angel, or VC",
        dueWindow: "7_days" as const,
        status: "suggested" as const
      },
      {
        title: "Prepare the pitch, application, or lender packet",
        dueWindow: "7_days" as const,
        status: "suggested" as const
      },
      {
        title: "Submit or request introductions through the matched resources",
        dueWindow: "30_days" as const,
        status: "suggested" as const
      }
    ];
  }

  if (profile.stage === "grow") {
    return [
      {
        title: "Pick the growth bottleneck: capital, talent, contracts, exports, or operations",
        dueWindow: "today" as const,
        status: "suggested" as const
      },
      {
        title: "Use growth-stage funding or strategic planning resources",
        dueWindow: "7_days" as const,
        status: "suggested" as const
      },
      {
        title: "Build the workforce, community, or government-contracting path",
        dueWindow: "30_days" as const,
        status: "suggested" as const
      },
      {
        title: "Document follow-ups and schedule the next expansion milestone",
        dueWindow: "30_days" as const,
        status: "suggested" as const
      }
    ];
  }

  if (profile.stage === "exit") {
    return [
      {
        title: "Clarify whether the goal is sale, succession, closure, or relocation",
        dueWindow: "today" as const,
        status: "suggested" as const
      },
      {
        title: "Review legal, tax, licensing, and workforce obligations",
        dueWindow: "7_days" as const,
        status: "suggested" as const
      },
      {
        title: "Contact the most relevant advisor or agency before filing changes",
        dueWindow: "30_days" as const,
        status: "suggested" as const
      }
    ];
  }

  const primary = recommendations[0]?.resource.title ?? "your top Startup State resource";
  return [
    {
      title: `Use ${primary} as your first stop`,
      dueWindow: "today" as const,
      status: "suggested" as const
    },
    {
      title: `Save three ${stageLabels[profile.stage].toLowerCase()} resources to your workbench`,
      dueWindow: "7_days" as const,
      status: "suggested" as const
    },
    {
      title: `Draft a one-page plan for ${profile.goal.toLowerCase() || "your next milestone"}`,
      dueWindow: "30_days" as const,
      status: "suggested" as const
    }
  ];
}

function scoreResource(profile: FounderProfile, resource: Resource) {
  const text = [
    resource.title,
    resource.description,
    ...resource.topics,
    ...resource.industries,
    ...resource.locations,
    ...resource.communities
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  if (resource.stages.includes(profile.stage)) score += 35;
  if (resource.locations.some((location) => same(location, profile.county))) score += 20;
  if (resource.locations.some((location) => same(location, "Utah"))) score += 8;
  if (resource.industries.some((industry) => same(industry, profile.industry))) score += 18;
  if (resource.communities.some((community) => same(community, profile.community))) score += 14;
  if (profile.goal && text.includes(profile.goal.toLowerCase())) score += 12;

  const goalTokens = profile.goal
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 3);
  for (const token of goalTokens) {
    if (text.includes(token)) score += 3;
  }

  if (isFormationIntent(profile) && isFormationResource(resource)) score += 22;
  if (mentionsBusinessBanking(profile.goal) && /bank account|business bank/.test(text)) score += 18;
  score += directLinkScore(resource.link);

  if (resource.freshness.status === "needs_review") score -= 6;
  return Math.max(0, score);
}

function explainMatch(profile: FounderProfile, resource: Resource, score: number) {
  const reasons = [];
  if (resource.stages.includes(profile.stage)) {
    reasons.push(`matches the ${stageLabels[profile.stage].toLowerCase()} stage`);
  }
  if (resource.locations.some((location) => same(location, profile.county))) {
    reasons.push(`covers ${profile.county}`);
  }
  if (resource.industries.some((industry) => same(industry, profile.industry))) {
    reasons.push(`fits ${profile.industry}`);
  }
  if (resource.communities.some((community) => same(community, profile.community))) {
    reasons.push(`supports ${profile.community} founders`);
  }

  if (reasons.length === 0 && score > 0) {
    return "A broad Startup State resource that can help with your next step.";
  }
  return `Recommended because it ${reasons.join(", ")}.`;
}

function same(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function isFormationIntent(profile: Pick<FounderProfile, "goal" | "stage">) {
  if (profile.stage !== "start" && profile.stage !== "idea" && profile.stage !== "validate") {
    return false;
  }
  return /start(?:up)?|company|business|llc|corporation|incorporat|register|license|ein|fein|bank account|ios|app store|publish|apps?/i.test(
    profile.goal
  );
}

function isFormationResource(resource: Resource) {
  const text = [resource.title, resource.description, ...resource.topics].join(" ").toLowerCase();
  return /registration|licensure|legal formation|form a new business|ein|fein|business bank|sbdc|score/.test(
    text
  );
}

function mentionsBusinessBanking(goal: string) {
  return /bank|finance|money|account|startup costs/i.test(goal);
}

function directLinkScore(link: string) {
  try {
    const url = new URL(link);
    const path = url.pathname.replace(/\/+$/, "");
    if (path && path !== "") return 8;
    if (url.search) return 4;
    return -10;
  } catch {
    return -4;
  }
}

function formationResourcePriority(resource: Resource) {
  const priorities = new Map<string, number>([
    ["basecamp-startup-state-registration", 1],
    ["basecamp-irs-ein", 2],
    ["basecamp-sba-business-bank-account", 3],
    ["basecamp-utah-form-new-business", 5],
    ["basecamp-sbdc-consultation", 6],
    ["basecamp-score-mentor", 7]
  ]);
  return priorities.get(resource.id) ?? 99;
}
