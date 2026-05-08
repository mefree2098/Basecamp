import { NextResponse } from "next/server";
import { filterResources, getFacets, loadCompanies, loadResources } from "@/lib/data";
import type { ResourceListResponse } from "@/lib/types";

export function GET(request: Request) {
  const url = new URL(request.url);
  const resources = loadResources();
  const limit = readLimit(url.searchParams.get("limit"), 48);
  const items = filterResources(resources, {
    q: url.searchParams.get("q") ?? undefined,
    stage: url.searchParams.get("stage") ?? undefined,
    topic: url.searchParams.get("topic") ?? undefined,
    county: url.searchParams.get("county") ?? undefined,
    industry: url.searchParams.get("industry") ?? undefined,
    community: url.searchParams.get("community") ?? undefined
  });

  const response: ResourceListResponse = {
    items: items.slice(0, limit),
    facets: getFacets(resources, loadCompanies()),
    page: {
      totalApprox: items.length,
      hasNextPage: false,
      cursor: null
    }
  };

  return NextResponse.json(response);
}

function readLimit(value: string | null, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(1, Math.min(200, numeric)) : fallback;
}
