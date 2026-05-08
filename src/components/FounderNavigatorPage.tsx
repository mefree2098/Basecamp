"use client";

import { useEffect, useState } from "react";
import { FounderNavigator } from "@/components/FounderNavigator";
import { fetchJson } from "@/lib/apiClient";
import type { PlatformBootstrapResponse } from "@/lib/types";

export function FounderNavigatorPage({ compact = false }: { compact?: boolean }) {
  const [bootstrap, setBootstrap] = useState<PlatformBootstrapResponse | null>(null);
  const [status, setStatus] = useState("Loading Startup State resource data...");

  useEffect(() => {
    let active = true;
    fetchJson<PlatformBootstrapResponse>("/api/platform/bootstrap")
      .then((data) => {
        if (!active) return;
        setBootstrap(data);
        setStatus("");
      })
      .catch(() => {
        if (active) setStatus("Basecamp could not load the platform API yet.");
      });
    return () => {
      active = false;
    };
  }, []);

  if (!bootstrap) {
    return (
      <section className="navigator navigator--assistant compact">
        <div className="side-browser__empty">
          <p>{status}</p>
        </div>
      </section>
    );
  }

  return (
    <FounderNavigator
      compact={compact}
      resources={bootstrap.resources}
      industries={bootstrap.founderOptions.industries}
      counties={bootstrap.founderOptions.counties}
      communities={bootstrap.founderOptions.communities}
    />
  );
}
