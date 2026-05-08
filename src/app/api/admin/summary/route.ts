import { NextResponse } from "next/server";
import { listCompanyDrafts } from "@/lib/companyDrafts";
import { loadCompanies, loadResources } from "@/lib/data";
import type { AdminSummaryResponse, CompanyDraftSummary } from "@/lib/types";

export function GET() {
  const resources = loadResources();
  const companies = loadCompanies();
  const response: AdminSummaryResponse = {
    resourceCount: resources.length,
    companyCount: companies.length,
    needsReview: resources.filter((resource) => resource.freshness.status === "needs_review").length,
    drafts: listCompanyDrafts().map(sanitizeDraft)
  };
  return NextResponse.json(response);
}

function sanitizeDraft(draft: ReturnType<typeof listCompanyDrafts>[number]): CompanyDraftSummary {
  const { tokenHash: _tokenHash, tokenExpiresAt: _tokenExpiresAt, ...safeDraft } = draft;
  void _tokenHash;
  void _tokenExpiresAt;
  return safeDraft;
}
