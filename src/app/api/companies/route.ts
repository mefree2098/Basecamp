import { NextResponse } from "next/server";
import { filterCompanies, getFacets, loadCompanies, loadResources } from "@/lib/data";
import type { CompanyListResponse } from "@/lib/types";

export function GET(request: Request) {
  const url = new URL(request.url);
  const companies = loadCompanies();
  const limit = readLimit(url.searchParams.get("limit"), companies.length);
  const items = filterCompanies(companies, {
    q: url.searchParams.get("q") ?? undefined,
    sector: url.searchParams.get("sector") ?? undefined,
    stage: url.searchParams.get("stage") ?? undefined,
    employees: url.searchParams.get("employees") ?? undefined,
    location: url.searchParams.get("location") ?? undefined,
    hiring: url.searchParams.get("hiring") ?? undefined
  });

  const response: CompanyListResponse = {
    items: items.slice(0, limit),
    facets: getFacets(loadResources(), companies),
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
  return Number.isFinite(numeric) ? Math.max(1, Math.min(500, numeric)) : fallback;
}
