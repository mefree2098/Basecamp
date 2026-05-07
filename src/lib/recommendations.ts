import { stageLabels } from "./site-context";
import type { FounderProfile, Recommendation, Resource } from "./types";

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
    .sort((a, b) => b.score - a.score || a.resource.title.localeCompare(b.resource.title))
    .slice(0, limit);
}

export function makePlanCards(profile: FounderProfile, recommendations: Recommendation[]) {
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
