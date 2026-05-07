import { NextResponse } from "next/server";
import { filterCompanies, getFacets, loadCompanies, loadResources } from "@/lib/data";

export function GET(request: Request) {
  const url = new URL(request.url);
  const companies = loadCompanies();
  const items = filterCompanies(companies, {
    q: url.searchParams.get("q") ?? undefined,
    sector: url.searchParams.get("sector") ?? undefined,
    stage: url.searchParams.get("stage") ?? undefined,
    employees: url.searchParams.get("employees") ?? undefined,
    hiring: url.searchParams.get("hiring") ?? undefined
  });

  return NextResponse.json({
    items,
    facets: getFacets(loadResources(), companies),
    page: {
      totalApprox: items.length,
      hasNextPage: false,
      cursor: null
    }
  });
}
