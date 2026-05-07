import { FounderNavigator } from "@/components/FounderNavigator";
import { ResourceExplorer } from "@/components/ResourceExplorer";
import { StartupMap } from "@/components/StartupMap";
import { getFacets, loadCompanies, loadResources } from "@/lib/data";
import { sourceLinks } from "@/lib/site-context";

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

      <div className="split-band">
        <ResourceExplorer resources={resources} facets={facets} compact />
        <StartupMap companies={companies} facets={facets} compact />
      </div>

      <section className="source-strip" aria-label="Ingested source context">
        <strong>Ingested source context</strong>
        {sourceLinks.map((source) => (
          <a href={source.href} key={source.href} target="_blank">
            {source.label}
          </a>
        ))}
      </section>
    </div>
  );
}
