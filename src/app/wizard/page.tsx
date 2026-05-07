import { FounderNavigator } from "@/components/FounderNavigator";
import { getFacets, loadCompanies, loadResources } from "@/lib/data";

export default function WizardPage() {
  const resources = loadResources();
  const facets = getFacets(resources, loadCompanies());
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
