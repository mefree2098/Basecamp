import { NextResponse } from "next/server";
import {
  approveCompanyDraft,
  companyDraftInputSchema,
  createCompanyDraft,
  listCompanyDrafts,
  rejectCompanyDraft
} from "@/lib/companyDrafts";

export function GET() {
  return NextResponse.json({
    drafts: listCompanyDrafts().map((draft) => ({
      ...draft,
      tokenHash: undefined
    }))
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }
  const parsed = companyDraftInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Company name is required. Work email must be valid when provided." },
      { status: 400 }
    );
  }

  const result = await createCompanyDraft(parsed.data, request.url);
  return NextResponse.json({
    id: result.draft.id,
    reviewStatus: result.draft.status,
    verificationStatus: result.draft.verificationStatus,
    domainMatch: result.draft.domainMatch,
    magicLinkSent: result.magicLinkSent,
    emailDeliveryStatus: result.draft.emailDeliveryStatus
  });
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const input = body as { id?: string; action?: string; reviewerNote?: string };
  if (!input.id || !input.action) {
    return NextResponse.json({ error: "Draft id and action are required." }, { status: 400 });
  }

  try {
    if (input.action === "approve") {
      const result = approveCompanyDraft(input.id, input.reviewerNote);
      return NextResponse.json({ draft: { ...result.draft, tokenHash: undefined }, company: result.company });
    }
    if (input.action === "reject") {
      const draft = rejectCompanyDraft(input.id, input.reviewerNote);
      return NextResponse.json({ draft: { ...draft, tokenHash: undefined } });
    }
    return NextResponse.json({ error: "Unsupported draft action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update draft." },
      { status: 400 }
    );
  }
}
