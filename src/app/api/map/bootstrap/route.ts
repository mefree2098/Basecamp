import { NextResponse } from "next/server";
import { getCachedCompanyIcons } from "@/lib/companyIcons";
import { getFacets, loadCompanies, loadResources } from "@/lib/data";
import { ensureServerGeocodes } from "@/lib/serverGeocoding";
import type { MapBootstrapResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const companies = loadCompanies();
  const resources = loadResources();
  const response: MapBootstrapResponse = {
    companies,
    facets: getFacets(resources, companies),
    geocodedLocations: await ensureServerGeocodes(companies),
    companyIcons: getCachedCompanyIcons(companies)
  };
  return NextResponse.json(response);
}
