import { NextResponse } from "next/server";
import { filterResources, getFacets, loadCompanies, loadResources } from "@/lib/data";

export function GET(request: Request) {
  const url = new URL(request.url);
  const resources = loadResources();
  const items = filterResources(resources, {
    q: url.searchParams.get("q") ?? undefined,
    stage: url.searchParams.get("stage") ?? undefined,
    topic: url.searchParams.get("topic") ?? undefined,
    county: url.searchParams.get("county") ?? undefined,
    industry: url.searchParams.get("industry") ?? undefined,
    community: url.searchParams.get("community") ?? undefined
  });

  return NextResponse.json({
    items,
    facets: getFacets(resources, loadCompanies()),
    page: {
      totalApprox: items.length,
      hasNextPage: false,
      cursor: null
    }
  });
}
