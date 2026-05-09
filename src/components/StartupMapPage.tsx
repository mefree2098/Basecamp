"use client";

import { useEffect, useState } from "react";
import { StartupMap } from "@/components/StartupMap";
import { fetchJson } from "@/lib/apiClient";
import type { MapBootstrapResponse } from "@/lib/types";

export function StartupMapPage() {
  const [bootstrap, setBootstrap] = useState<MapBootstrapResponse | null>(null);
  const [status, setStatus] = useState("Loading startup map data...");

  useEffect(() => {
    let active = true;
    fetchJson<MapBootstrapResponse>("/api/map/bootstrap")
      .then((data) => {
        if (!active) return;
        setBootstrap(data);
        setStatus("");
      })
      .catch(() => {
        if (active) setStatus("Basecamp could not load map data from the platform API.");
      });
    return () => {
      active = false;
    };
  }, []);

  if (!bootstrap) {
    return (
      <section className="map-panel">
        <div className="side-browser__empty">
          <p>{status}</p>
        </div>
      </section>
    );
  }

  return (
    <StartupMap
      companies={bootstrap.companies}
      facets={bootstrap.facets}
      initialGeocodedLocations={bootstrap.geocodedLocations}
      initialCompanyIcons={bootstrap.companyIcons}
      integrations={bootstrap.integrations}
    />
  );
}
