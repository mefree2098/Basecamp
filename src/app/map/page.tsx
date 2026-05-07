import { StartupMap } from "@/components/StartupMap";
import { getFacets, loadCompanies, loadResources } from "@/lib/data";

export default function MapPage() {
  const companies = loadCompanies();
  return (
    <div className="page-stack">
      <StartupMap companies={companies} facets={getFacets(loadResources(), companies)} />
    </div>
  );
}
