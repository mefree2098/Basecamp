import { FounderNavigator } from "@/components/FounderNavigator";
import { getFacets, loadCompanies, loadResources } from "@/lib/data";

export default function HomePage() {
  const resources = loadResources();
  const companies = loadCompanies();
  const facets = getFacets(resources, companies);

  return (
    <div className="page-stack">
      <FounderNavigator
        resources={resources}
        industries={facets.industries.map((facet) => facet.label)}
        counties={facets.counties.map((facet) => facet.label)}
        communities={facets.communities.map((facet) => facet.label)}
      />
    </div>
  );
}
