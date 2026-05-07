import { ResourceExplorer } from "@/components/ResourceExplorer";
import { getFacets, loadCompanies, loadResources } from "@/lib/data";

export default function ResourcesPage() {
  const resources = loadResources();
  return (
    <div className="page-stack">
      <ResourceExplorer resources={resources} facets={getFacets(resources, loadCompanies())} />
    </div>
  );
}
