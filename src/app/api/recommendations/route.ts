import { NextResponse } from "next/server";
import { z } from "zod";
import { loadResources } from "@/lib/data";
import { makePlanCards, recommendResources } from "@/lib/recommendations";
import type { RecommendationResponse } from "@/lib/types";

const requestSchema = z.object({
  profile: z.object({
    stage: z.enum(["idea", "validate", "start", "grow", "fund", "exit"]),
    industry: z.string(),
    county: z.string(),
    community: z.string(),
    goal: z.string(),
    mode: z.enum(["chat", "guided", "manual"])
  }),
  limit: z.number().int().min(1).max(24).default(6),
  orderedIds: z.array(z.string()).default([])
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const recommendations = orderRecommendationsByIds(
    recommendResources(parsed.data.profile, loadResources(), parsed.data.limit),
    parsed.data.orderedIds
  );
  const response: RecommendationResponse = {
    recommendations,
    planCards: makePlanCards(parsed.data.profile, recommendations)
  };
  return NextResponse.json(response);
}

function orderRecommendationsByIds(
  recommendations: ReturnType<typeof recommendResources>,
  orderedIds: string[]
) {
  if (!orderedIds.length) return recommendations;
  const seen = new Set<string>();
  const byId = new Map(recommendations.map((item) => [item.resource.id, item]));
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((item): item is (typeof recommendations)[number] => Boolean(item))
    .filter((item) => {
      if (seen.has(item.resource.id)) return false;
      seen.add(item.resource.id);
      return true;
    });
  return [...ordered, ...recommendations.filter((item) => !seen.has(item.resource.id))];
}
