import { stageLabels } from "./site-context";
import {
  detectedFounderCommunities,
  hasAngelGroupIntent,
  hasFundingIntent,
  hasIdeaFirstStepIntent,
  hasInternationalExpansionIntent,
  hasOperatingCompanySignals,
  hasTechnologyCommercializationIntent,
  hasVentureCapitalIntent
} from "./founderInference";
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
        const specialtyOrder =
          specialtyFormationPriority(profile, a.resource) -
          specialtyFormationPriority(profile, b.resource);
        if (specialtyOrder !== 0) return specialtyOrder;
        const formationOrder =
          formationResourcePriority(a.resource) - formationResourcePriority(b.resource);
        if (formationOrder !== 0) return formationOrder;
      }
      return b.score - a.score || a.resource.title.localeCompare(b.resource.title);
    })
    .slice(0, limit);
}

export function makePlanCards(profile: FounderProfile, recommendations: Recommendation[]): PlanCard[] {
  if (isCommercializationIntent(profile)) {
    return [
      {
        title: "Map the invention, IP ownership, and university commercialization path",
        dueWindow: "today" as const,
        status: "suggested" as const
      },
      {
        title: "Meet with a University of Utah startup or commercialization resource",
        dueWindow: "7_days" as const,
        status: "suggested" as const
      },
      {
        title: "Validate customers, regulatory needs, and first product milestone",
        dueWindow: "30_days" as const,
        status: "suggested" as const
      },
      {
        title: "Choose the formation, funding, and advisor path after the IP check",
        dueWindow: "30_days" as const,
        status: "suggested" as const
      }
    ];
  }

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
    if (hasInternationalExpansionIntent(profile.goal)) {
      return [
        {
          title: "Confirm export readiness and target international markets",
          dueWindow: "today" as const,
          status: "suggested" as const
        },
        {
          title: "Meet with Utah international trade and life-science support",
          dueWindow: "7_days" as const,
          status: "suggested" as const
        },
        {
          title: "Prepare regulatory, partner, and market-entry questions",
          dueWindow: "30_days" as const,
          status: "suggested" as const
        },
        {
          title: "Track introductions, follow-ups, and expansion milestones",
          dueWindow: "30_days" as const,
          status: "suggested" as const
        }
      ];
    }

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

  const goal = profile.goal.toLowerCase();
  const detectedCommunities = detectedFounderCommunities(goal);
  let score = 0;
  if (resource.stages.includes(profile.stage)) score += 35;
  if (resource.locations.some((location) => same(location, profile.county))) score += 20;
  if (resource.locations.some((location) => same(location, "Utah"))) score += 8;
  if (resource.industries.some((industry) => same(industry, profile.industry))) score += 18;
  if (resource.communities.some((community) => same(community, profile.community))) score += 14;
  for (const community of detectedCommunities) {
    if (resource.communities.some((resourceCommunity) => same(resourceCommunity, community))) {
      score += community === profile.community ? 6 : 16;
    }
  }
  if (profile.goal && text.includes(profile.goal.toLowerCase())) score += 12;

  const goalTokens = profile.goal
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 3);
  for (const token of goalTokens) {
    if (text.includes(token)) score += 3;
  }

  const fundingIntent = hasFundingIntent(profile.goal);
  const ventureIntent = hasVentureCapitalIntent(profile.goal);
  const operatingCompanyIntent = hasOperatingCompanySignals(profile.goal);
  const ideaFirstStepIntent = hasIdeaFirstStepIntent(profile.goal);
  const internationalIntent = hasInternationalExpansionIntent(profile.goal);
  const commercializationIntent = hasTechnologyCommercializationIntent(profile.goal);
  const angelIntent = hasAngelGroupIntent(profile.goal);
  if (fundingIntent && resource.stages.includes("fund")) score += 24;
  if (ventureIntent && isVentureCapitalResource(resource)) score += 38;
  if (angelIntent && isAngelResource(resource)) score += 90;
  if (angelIntent && isVentureCapitalResource(resource) && !isAngelResource(resource)) score -= 10;
  if (ventureIntent && isLoanOrGrantResource(resource)) score -= 18;
  if (ventureIntent && isMentorFirstResource(resource)) score -= 32;
  if (ideaFirstStepIntent && isIdeaFirstStepResource(resource)) score += 76;
  if (ideaFirstStepIntent && isVentureCapitalResource(resource) && !/challenge|competition|microfund/i.test(text)) {
    score -= 92;
  }
  if (internationalIntent && isInternationalTradeResource(resource)) score += 90;
  if (internationalIntent && isLifeScienceResource(resource)) score += 32;
  if (commercializationIntent && isUniversityCommercializationResource(resource)) score += 105;
  if (commercializationIntent && isLifeScienceResource(resource)) score += 24;
  if (commercializationIntent && isVentureCapitalResource(resource)) score -= 26;
  if (hasRuralAgricultureGrowthIntent(profile) && isAgricultureResource(resource)) score += 70;
  if (hasRuralAgricultureGrowthIntent(profile) && isSouthernUtahResource(resource)) score += 44;
  if (hasRuralAgricultureGrowthIntent(profile) && isWomenResource(resource)) score += 24;
  if (hasVeteranManufacturingIntent(profile) && isVeteranResource(resource)) score += 82;
  if (hasVeteranManufacturingIntent(profile) && isWeberOgdenResource(resource)) score += 34;
  if (hasVeteranManufacturingIntent(profile) && isManufacturingWorkforceResource(resource)) score += 28;
  if (hasVeteranManufacturingIntent(profile) && isFocusedElsewhere(profile, resource)) score -= 999;
  if (profile.stage === "fund" && operatingCompanyIntent && isFormationResource(resource)) score -= 72;
  if (profile.stage === "fund" && isFormationResource(resource)) score -= 28;
  if (profile.stage === "fund" && isStartupBasicsResource(resource)) score -= 20;
  if (commercializationIntent && isStartupBasicsResource(resource)) score -= 34;
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
  if (isCommercializationIntent(profile) || hasIdeaFirstStepIntent(profile.goal)) {
    return false;
  }
  if (profile.stage !== "start" && profile.stage !== "idea" && profile.stage !== "validate") {
    return false;
  }
  return /start(?:up)?|company|business|llc|corporation|incorporat|register|license|ein|fein|bank account|ios|app store|publish|apps?/i.test(
    profile.goal
  );
}

export function isCommercializationIntent(profile: Pick<FounderProfile, "goal">) {
  return hasTechnologyCommercializationIntent(profile.goal);
}

function isFormationResource(resource: Resource) {
  const text = [resource.title, resource.description, ...resource.topics].join(" ").toLowerCase();
  return /registration|licensure|legal formation|form a new business|ein|fein|business bank|sbdc|score/.test(
    text
  );
}

function isIdeaFirstStepResource(resource: Resource) {
  const text = [resource.title, resource.description, resource.link, ...resource.topics]
    .join(" ")
    .toLowerCase();
  return /get started|idea explorer|first step|sbdc|score|mentor|business idea challenge|lassonde|entrepreneurship institute|startup state/.test(
    text
  );
}

function isVentureCapitalResource(resource: Resource) {
  const text = [
    resource.title,
    resource.description,
    resource.link,
    ...resource.topics
  ]
    .join(" ")
    .toLowerCase();
  return /venture capital|venture partners?|ventures?\b|\.vc\b|\bvc\b|angel|capital firm|investment fund|seed fund|seed-stage|pre-seed|first checks?|startup fund|investing first checks|early-stage investments?/.test(
    text
  );
}

function isAngelResource(resource: Resource) {
  const text = [resource.title, resource.description, resource.link, ...resource.topics]
    .join(" ")
    .toLowerCase();
  return /\bangel|angels\b/.test(text);
}

function isLoanOrGrantResource(resource: Resource) {
  const text = [resource.title, resource.description, resource.link, ...resource.topics]
    .join(" ")
    .toLowerCase();
  return /loan|microloan|revolving loan|grant|non-dilutive|sbir|sttr|credit initiative/.test(text);
}

function isInternationalTradeResource(resource: Resource) {
  const text = [resource.title, resource.description, resource.link]
    .join(" ")
    .toLowerCase();
  return /international trade|export|commercial service|world trade center|trade\.gov|foreign markets?|global/i.test(
    text
  );
}

function isLifeScienceResource(resource: Resource) {
  const text = [resource.title, resource.description, ...resource.topics]
    .join(" ")
    .toLowerCase();
  return /life sciences?|healthcare|medical|device|biohive|bio utah|biotech|altitude lab/.test(text);
}

function isUniversityCommercializationResource(resource: Resource) {
  const text = [resource.title, resource.description, resource.link, ...resource.topics]
    .join(" ")
    .toLowerCase();
  return /university of utah|lassonde|commerciali[sz]|technology transfer|innovation fund|altitude lab|student innovation|entrepreneurship institute/.test(
    text
  );
}

function isAgricultureResource(resource: Resource) {
  const text = [resource.title, resource.description, ...resource.topics]
    .join(" ")
    .toLowerCase();
  return /agriculture|agricultural|farm|rural|utah's own|department of agriculture|food production|farmers market/.test(
    text
  );
}

function isSouthernUtahResource(resource: Resource) {
  const focusedLocations = resource.locations.length <= 8 ? resource.locations : [];
  const text = [resource.title, resource.description, resource.link, ...focusedLocations]
    .join(" ")
    .toLowerCase();
  return /washington|st\.?\s*george|utah tech|atwood|tech ridge|five county|southern utah|iron county|cedar city/.test(
    text
  );
}

function isWomenResource(resource: Resource) {
  const text = [resource.title, resource.description, ...resource.communities]
    .join(" ")
    .toLowerCase();
  return /women|woman|female|maven|women tech|bolder way|lialaunch/.test(text);
}

function isVeteranResource(resource: Resource) {
  const text = [resource.title, resource.description, resource.link]
    .join(" ")
    .toLowerCase();
  return /veteran|vbrc|strive/.test(text);
}

function isWeberOgdenResource(resource: Resource) {
  const text = [resource.title, resource.description, resource.link, ...resource.locations]
    .join(" ")
    .toLowerCase();
  return /weber|ogden|wildcat/.test(text);
}

function isManufacturingWorkforceResource(resource: Resource) {
  const text = [resource.title, resource.description, ...resource.topics]
    .join(" ")
    .toLowerCase();
  return /manufactur|fabrication|custom fit|apex|workforce|talent|apprenticeship|supplier|contract/.test(
    text
  );
}

function isFocusedElsewhere(profile: FounderProfile, resource: Resource) {
  if (resource.locations.some((location) => same(location, profile.county) || same(location, "Utah"))) {
    return false;
  }
  return resource.locations.length > 0 && resource.locations.length <= 8;
}

function isMentorFirstResource(resource: Resource) {
  const text = [resource.title, resource.description, ...resource.topics].join(" ").toLowerCase();
  return /score|mentor|mentoring|consultation|advisor|idea explorer|first step entrepreneur/.test(text);
}

function isStartupBasicsResource(resource: Resource) {
  const text = [resource.title, resource.description, ...resource.topics].join(" ").toLowerCase();
  return /start a business|registration|licensure|business plan|bank account|ein|fein|idea explorer/.test(
    text
  );
}

function mentionsBusinessBanking(goal: string) {
  return /bank|finance|money|account|startup costs/i.test(goal);
}

function directLinkScore(link: string) {
  if (!link.trim()) return -40;
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

function hasRuralAgricultureGrowthIntent(profile: FounderProfile) {
  const text = profile.goal.toLowerCase();
  return (
    (profile.stage === "grow" || /\b(scale|scaling|grow|growth)\b/.test(text)) &&
    (same(profile.industry, "Agriculture") || /agricultur|farm|rural|st\.?\s*george|washington county/.test(text))
  );
}

function hasVeteranManufacturingIntent(profile: FounderProfile) {
  const text = profile.goal.toLowerCase();
  return (
    (/veteran|military/.test(text) || same(profile.community, "Veteran")) &&
    (same(profile.industry, "Manufacturing") || /manufactur|fabrication|custom fab|machining|industrial/.test(text))
  );
}

function specialtyFormationPriority(profile: FounderProfile, resource: Resource) {
  if (resource.id === "basecamp-startup-state-registration") return 1;
  if (hasVeteranManufacturingIntent(profile) && isVeteranResource(resource)) return 2;
  if (hasVeteranManufacturingIntent(profile) && isWeberOgdenResource(resource)) return 3;
  const baseFormationPriority = formationResourcePriority(resource);
  if (baseFormationPriority < 99) return 10 + baseFormationPriority;
  return 50;
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
