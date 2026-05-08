import { redirectAfterVerification, verifyCompanyDraft } from "@/lib/companyDrafts";

export function GET(request: Request) {
  const url = new URL(request.url);
  const draftId = url.searchParams.get("draftId") ?? "";
  const token = url.searchParams.get("token") ?? "";
  try {
    verifyCompanyDraft(draftId, token);
    return redirectAfterVerification(request.url, "success");
  } catch (error) {
    return redirectAfterVerification(
      request.url,
      "error",
      error instanceof Error ? error.message : "Unable to verify this claim."
    );
  }
}
