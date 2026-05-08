import { AdminConsole } from "@/components/AdminConsole";
import { listCompanyDrafts } from "@/lib/companyDrafts";
import { loadCompanies, loadResources } from "@/lib/data";

export default function AdminPage() {
  const resources = loadResources();
  const companies = loadCompanies();
  const drafts = listCompanyDrafts().map((draft) => ({
    ...draft,
    tokenHash: undefined
  }));
  return (
    <div className="page-stack">
      <AdminConsole
        resourceCount={resources.length}
        companyCount={companies.length}
        needsReview={resources.filter((resource) => resource.freshness.status === "needs_review").length}
        initialDrafts={drafts}
      />
    </div>
  );
}
