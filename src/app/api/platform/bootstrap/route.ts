import { NextResponse } from "next/server";
import { getFacets, loadCompanies, loadResources } from "@/lib/data";
import type { PlatformBootstrapResponse } from "@/lib/types";

export function GET() {
  const resources = loadResources();
  const companies = loadCompanies();
  const facets = getFacets(resources, companies);
  const response: PlatformBootstrapResponse = {
    resources,
    facets,
    founderOptions: {
      industries: facets.industries.map((facet) => facet.label),
      counties: facets.counties.map((facet) => facet.label),
      communities: facets.communities.map((facet) => facet.label)
    }
  };
  return NextResponse.json(response);
}
