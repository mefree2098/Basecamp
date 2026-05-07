import { AdminConsole } from "@/components/AdminConsole";
import { loadCompanies, loadResources } from "@/lib/data";

export default function AdminPage() {
  const resources = loadResources();
  const companies = loadCompanies();
  return (
    <div className="page-stack">
      <AdminConsole
        resourceCount={resources.length}
        companyCount={companies.length}
        needsReview={resources.filter((resource) => resource.freshness.status === "needs_review").length}
      />
    </div>
  );
}
