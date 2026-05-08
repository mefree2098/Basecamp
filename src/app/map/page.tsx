import { StartupMap } from "@/components/StartupMap";
import { getCachedCompanyIcons } from "@/lib/companyIcons";
import { getFacets, loadCompanies, loadResources } from "@/lib/data";
import { ensureServerGeocodes } from "@/lib/serverGeocoding";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const companies = loadCompanies();
  const serverGeocodedLocations = await ensureServerGeocodes(companies);
  const companyIcons = getCachedCompanyIcons(companies);
  return (
    <div className="page-stack page-stack--map">
      <StartupMap
        companies={companies}
        facets={getFacets(loadResources(), companies)}
        initialGeocodedLocations={serverGeocodedLocations}
        initialCompanyIcons={companyIcons}
      />
    </div>
  );
}
