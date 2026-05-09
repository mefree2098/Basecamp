"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import Link from "next/link";
import {
  Bookmark,
  BriefcaseBusiness,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  Expand,
  ExternalLink,
  Flame,
  Layers,
  Linkedin,
  LocateFixed,
  MapPin,
  Minimize2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Satellite,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { projectUtahPoint } from "@/lib/geo";
import type { ClientIntegrationSettings, Company } from "@/lib/types";

type Facet = { label: string; count: number };
type AppTheme = "classic" | "tech";
type MapPosition = { lat: number; lng: number };
type FallbackMapPan = { x: number; y: number };
type CompanyMapLocation = MapPosition & {
  confidence: Company["coordinates"]["confidence"] | "google";
  formattedAddress?: string;
};
type GoogleLatLng = unknown;
type GoogleMapOptions = Record<string, unknown>;
type GoogleMap = {
  fitBounds: (bounds: GoogleLatLngBounds) => void;
  getStreetView: () => GoogleStreetViewPanorama;
  getZoom: () => number | undefined;
  panBy: (x: number, y: number) => void;
  panTo: (position: MapPosition) => void;
  setCenter: (position: MapPosition) => void;
  setMapTypeId: (type: "roadmap" | "satellite") => void;
  setOptions: (options: GoogleMapOptions) => void;
  setZoom: (zoom: number) => void;
};
type GoogleLatLngBounds = {
  extend: (position: GoogleLatLng | MapPosition) => void;
  isEmpty: () => boolean;
};
type GoogleMapsEventListener = {
  remove: () => void;
};
type GoogleMarkerLabel = {
  text: string;
  color: string;
  fontSize: string;
  fontWeight: string;
};
type GoogleMarkerIcon = {
  path: string | number;
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWeight: number;
  scale: number;
};
type GoogleMarkerOptions = {
  clickable?: boolean;
  icon?: GoogleMarkerIcon;
  label?: GoogleMarkerLabel;
  map?: GoogleMap;
  optimized?: boolean;
  position: MapPosition;
  title: string;
  zIndex?: number;
};
type GoogleMarker = {
  addListener: (name: "click", handler: () => void) => GoogleMapsEventListener;
  setMap: (map: GoogleMap | null) => void;
  setOptions: (options: GoogleMarkerOptions) => void;
};
type GoogleMarkerConstructor = new (options: GoogleMarkerOptions) => GoogleMarker;
type GoogleLatLngConstructor = new (lat: number, lng: number) => GoogleLatLng;
type CoreLibrary = {
  LatLng: GoogleLatLngConstructor;
  LatLngBounds: new () => GoogleLatLngBounds;
};
type MapsLibrary = {
  Map: new (element: HTMLElement, options: GoogleMapOptions) => GoogleMap;
};
type GeocoderLocation = {
  lat: () => number;
  lng: () => number;
};
type GeocoderResult = {
  formatted_address: string;
  geometry: {
    location: GeocoderLocation;
  };
  partial_match?: boolean;
};
type Geocoder = {
  geocode: (request: {
    address: string;
    componentRestrictions?: { administrativeArea?: string; country?: string };
    region?: string;
  }) => Promise<{ results: GeocoderResult[] }>;
};
type GeocodingLibrary = {
  Geocoder: new () => Geocoder;
};
type GoogleStreetViewPanorama = {
  setPano: (pano: string) => void;
  setPosition: (position: MapPosition | GoogleLatLng) => void;
  setPov: (pov: { heading: number; pitch: number }) => void;
  setVisible: (visible: boolean) => void;
};
type StreetViewService = {
  getPanorama: (request: {
    location: MapPosition | GoogleLatLng;
    radius: number;
    source?: "outdoor" | "default";
  }) => Promise<{
    data: {
      location?: {
        latLng?: GoogleLatLng;
        pano?: string;
      };
    };
  }>;
};
type StreetViewLibrary = {
  StreetViewService: new () => StreetViewService;
};
type GoogleMapsNamespace = {
  maps: {
    Marker?: GoogleMarkerConstructor;
    SymbolPath?: {
      CIRCLE: string | number;
    };
    importLibrary: (
      name: "core" | "maps" | "geocoding" | "streetView"
    ) => Promise<CoreLibrary | MapsLibrary | GeocodingLibrary | StreetViewLibrary>;
  };
};
type GoogleMapsWindow = Window & {
  google?: GoogleMapsNamespace;
  gm_authFailure?: () => void;
  __basecampGoogleMapsReady?: () => void;
};
type StartupMarkerEntry = {
  item: MapOverlayItem;
  listener: GoogleMapsEventListener;
  marker: GoogleMarker;
};
type MapOverlayItem = {
  id: string;
  company: Company;
  position: CompanyMapLocation;
  count: number;
  slugs: string[];
  iconUrl?: string;
};
type CompanyIconView = {
  url: string;
  source?: string;
  fetchedAt?: string;
};
type GoogleMapStyle = {
  featureType?: string;
  elementType?: string;
  stylers: Array<Record<string, string | number | boolean>>;
};

const bakedGoogleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
const bakedGoogleMapsMapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() ?? "";
const bakedGoogleMapsTechMapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_TECH_MAP_ID?.trim() ?? "";
const GEOCODE_CACHE_KEY = "basecamp.googleGeocodes.v1";
const GOOGLE_MAPS_CALLBACK = "__basecampGoogleMapsReady";
const UTAH_CENTER = { lat: 40.35, lng: -111.84 };
// Keep Utah centered while leaving enough buffer for drag exploration at statewide zoom.
const UTAH_BOUNDS = {
  north: 44.4,
  south: 34.5,
  west: -117.5,
  east: -106.0
};
const TECH_GOOGLE_MAP_STYLES: GoogleMapStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#06101f" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7fdcff" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#020712" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#265cc9" }, { lightness: -25 }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#a6c9ff" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d9efff" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#07162a" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#081b35" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#04172c" }] },
  { featureType: "landscape.natural.terrain", elementType: "geometry", stylers: [{ color: "#0a2341" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#05271f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#172b68" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#34c9ff" }, { lightness: -35 }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9fc7ff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#1b438d" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2446b0" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#ff8b2c" }, { lightness: -10 }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f9d59a" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#0d2553" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#021936" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#40dbff" }] }
];

let googleMapsScriptPromise: Promise<void> | null = null;

export function StartupMap({
  companies,
  initialGeocodedLocations = {},
  initialCompanyIcons = {},
  integrations,
  compact = false
}: {
  companies: Company[];
  facets: {
    sectors: Facet[];
    companyStages: Facet[];
    employeeBands: Facet[];
    companyLocations: Facet[];
  };
  initialGeocodedLocations?: Record<string, CompanyMapLocation>;
  initialCompanyIcons?: Record<string, CompanyIconView>;
  integrations?: ClientIntegrationSettings;
  compact?: boolean;
}) {
  const initialFilters = readInitialMapFilters();
  const [q, setQ] = useState(initialFilters.q);
  const [sector, setSector] = useState(initialFilters.sector);
  const [stage, setStage] = useState(initialFilters.stage);
  const [employees, setEmployees] = useState(initialFilters.employees);
  const [location, setLocation] = useState(initialFilters.location);
  const [hiring, setHiring] = useState(initialFilters.hiring);
  const [selectedSlug, setSelectedSlug] = useState("");
  const configuredGoogleMapsApiKey = integrations?.googleMaps.browserApiKey?.trim() ?? "";
  const configuredGoogleMapsMapId = integrations?.googleMaps.mapId?.trim() || bakedGoogleMapsMapId;
  const configuredGoogleMapsTechMapId =
    integrations?.googleMaps.techMapId?.trim() || bakedGoogleMapsTechMapId;
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState(
    configuredGoogleMapsApiKey || bakedGoogleMapsApiKey
  );
  const [mapStatus, setMapStatus] = useState(
    configuredGoogleMapsApiKey || bakedGoogleMapsApiKey
      ? "Loading Google Maps and resolving startup addresses..."
      : "Add a Google Maps API key in Admin to enable Google Maps, geocoding, and Street View."
  );
  const [streetViewStatus, setStreetViewStatus] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [mapMode, setMapMode] = useState<"roadmap" | "satellite">("roadmap");
  const [heatmap, setHeatmap] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [activeClusterId, setActiveClusterId] = useState("");
  const [showExtraContent, setShowExtraContent] = useState(() =>
    readStoredBoolean("basecamp.map.showExtraContent", true)
  );
  const [theme, setTheme] = useState<AppTheme>(() => readStoredTheme());
  const [savedSlugs, setSavedSlugs] = useState<string[]>(() =>
    readStoredStringArray("basecamp.savedCompanies")
  );
  const [fallbackZoom, setFallbackZoom] = useState(1);
  const [fallbackPan, setFallbackPan] = useState<FallbackMapPan>({ x: 0, y: 0 });
  const [companyIcons, setCompanyIcons] = useState(initialCompanyIcons);
  const [geocodedLocations, setGeocodedLocations] = useState<
    Record<string, CompanyMapLocation>
  >(initialGeocodedLocations);

  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const geocoderRef = useRef<Geocoder | null>(null);
  const streetViewServiceRef = useRef<StreetViewService | null>(null);
  const latLngRef = useRef<GoogleLatLngConstructor | null>(null);
  const boundsRef = useRef<CoreLibrary["LatLngBounds"] | null>(null);
  const markerConstructorRef = useRef<GoogleMarkerConstructor | null>(null);
  const markerCirclePathRef = useRef<string | number>(
    "M 0,0 m -10,0 a 10,10 0 1,0 20,0 a 10,10 0 1,0 -20,0"
  );
  const markersRef = useRef<Map<string, StartupMarkerEntry>>(new Map());
  const googleDragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const geocodedLocationsRef = useRef<Record<string, CompanyMapLocation>>({});
  const mapItemsRef = useRef<MapOverlayItem[]>([]);
  const selectMapItemRef = useRef<(item: MapOverlayItem) => void>(() => undefined);

  const visibleCompanies = useMemo(
    () => (showExtraContent ? companies : companies.filter((company) => !isExtraMapCompany(company))),
    [companies, showExtraContent]
  );
  const visibleFacets = useMemo(
    () => ({
      sectors: companyFacet(visibleCompanies, (company) => company.sector ?? "Uncategorized"),
      companyStages: companyFacet(visibleCompanies, (company) => company.stage ?? "Unknown"),
      employeeBands: companyFacet(visibleCompanies, (company) => company.employees ?? "Unknown"),
      companyLocations: companyFacet(visibleCompanies, (company) => company.location || "Utah", "alpha")
    }),
    [visibleCompanies]
  );
  const extraCompanyCount = useMemo(
    () => companies.filter((company) => isExtraMapCompany(company)).length,
    [companies]
  );
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return visibleCompanies.filter((company) => {
      const searchable = [
        company.name,
        company.description,
        company.sector,
        company.stage,
        company.employees,
        company.location,
        company.address,
        company.hiringStatus
      ]
        .join(" ")
        .toLowerCase();
      return (
        (!needle || searchable.includes(needle)) &&
        (!sector || company.sector === sector) &&
        (!stage || company.stage === stage) &&
        (!employees || company.employees === employees) &&
        (!location || company.location === location) &&
        (!hiring || hiring === "any" || company.hiringStatus === hiring)
      );
    });
  }, [employees, hiring, location, q, sector, stage, visibleCompanies]);

  const selected = selectedSlug ? filtered.find((company) => company.slug === selectedSlug) ?? null : null;
  const selectedLocation = selected ? mapLocationForCompany(selected, geocodedLocations) : null;
  const filterKey = `${q}|${sector}|${stage}|${employees}|${location}|${hiring}`;
  const mapItems = useMemo(
    () => buildMapOverlayItems(filtered, geocodedLocations, companyIcons),
    [filtered, geocodedLocations, companyIcons]
  );
  const selectedCluster = activeClusterId
    ? mapItems.find((item) => item.id === activeClusterId && item.count > 1)
    : undefined;
  const clusterCompanies = useMemo(
    () =>
      selectedCluster
        ? filtered.filter((company) => selectedCluster.slugs.includes(company.slug))
        : [],
    [filtered, selectedCluster]
  );
  const resultCompanies = selectedCluster ? clusterCompanies : filtered;
  const geocodeCandidates = useMemo(
    () =>
      filtered
        .filter((company) => isGeocodableCompany(company))
        .filter((company) => !initialGeocodedLocations[company.slug])
        .slice(0, compact ? 30 : 60),
    [compact, filtered, initialGeocodedLocations]
  );
  const hiringNowCount = visibleCompanies.filter((company) => company.hiringStatus === "hiring").length;
  const hiringOptions = [
    { label: "hiring", count: hiringNowCount },
    {
      label: "not_hiring",
      count: visibleCompanies.filter((company) => company.hiringStatus === "not_hiring").length
    },
    {
      label: "unknown",
      count: visibleCompanies.filter((company) => company.hiringStatus === "unknown").length
    }
  ];
  const activeFilters = [
    showExtraContent
      ? null
      : { id: "extra-content", label: "Seed data only", clear: () => setShowExtraContent(true) },
    q.trim() ? { id: "q", label: q.trim(), clear: () => setQ("") } : null,
    sector ? { id: "sector", label: sector, clear: () => setSector("") } : null,
    stage ? { id: "stage", label: stage, clear: () => setStage("") } : null,
    employees ? { id: "employees", label: employees, clear: () => setEmployees("") } : null,
    location ? { id: "location", label: location, clear: () => setLocation("") } : null,
    hiring ? { id: "hiring", label: formatFacetLabel(hiring), clear: () => setHiring("") } : null
  ].filter((filter): filter is { id: string; label: string; clear: () => void } =>
    Boolean(filter)
  );
  const selectedVerified = Boolean(
    selected && (selected.verificationStatus === "claimed" || selectedLocation?.confidence === "google")
  );
  const topSectorChips = visibleFacets.sectors.slice(0, 5);
  const visibleHiringCount = filtered.filter((company) => company.hiringStatus === "hiring").length;
  const investorSummary = activeFilters.length
    ? `${activeFilters.length} filter${activeFilters.length === 1 ? "" : "s"} active`
    : `${(sector ? 1 : visibleFacets.sectors.length).toLocaleString()} sectors to explore`;

  const selectCompany = useCallback((slug: string, options: { preserveCluster?: boolean } = {}) => {
    if (!options.preserveCluster) setActiveClusterId("");
    setSelectedSlug(slug);
    setProfileDrawerOpen(true);
  }, []);

  const selectMapItem = useCallback((item: MapOverlayItem) => {
    if (item.count > 1) {
      setActiveClusterId(item.id);
      setSelectedSlug(item.company.slug);
      setProfileDrawerOpen(true);
      setMapStatus(
        `${item.count.toLocaleString()} startups grouped near ${item.company.location || "this area"}. Opened the first profile in this cluster.`
      );
      return;
    }
    setActiveClusterId("");
    setSelectedSlug(item.company.slug);
    setProfileDrawerOpen(true);
  }, []);

  useEffect(() => {
    mapItemsRef.current = mapItems;
  }, [mapItems]);

  useEffect(() => {
    selectMapItemRef.current = selectMapItem;
  }, [selectMapItem]);

  useEffect(() => {
    window.localStorage.setItem("basecamp.map.showExtraContent", showExtraContent ? "true" : "false");
  }, [showExtraContent]);

  useEffect(() => {
    if (!mapReady) return;
    const selectMarkerFromEvent = (event: MouseEvent | PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const marker = target?.closest<HTMLElement>("[title]");
      if (!marker || !mapElementRef.current?.contains(marker)) return;
      const item = mapItemsRef.current.find((candidate) => marker.title === markerLabel(candidate));
      if (!item) return;
      event.preventDefault();
      event.stopPropagation();
      selectMapItemRef.current(item);
    };
    document.addEventListener("click", selectMarkerFromEvent, true);
    document.addEventListener("pointerup", selectMarkerFromEvent, true);
    return () => {
      document.removeEventListener("click", selectMarkerFromEvent, true);
      document.removeEventListener("pointerup", selectMarkerFromEvent, true);
    };
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapElementRef.current) return;
    const map = mapRef.current;
    const element = mapElementRef.current;

    const endDrag = (event: PointerEvent) => {
      const drag = googleDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      googleDragRef.current = null;
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
    };

    const startDrag = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("a, button, [role='button'], [title^='Select '], [title^='Open cluster']")) {
        return;
      }
      googleDragRef.current = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY
      };
      element.setPointerCapture(event.pointerId);
    };

    const moveDrag = (event: PointerEvent) => {
      const drag = googleDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - drag.lastX;
      const deltaY = event.clientY - drag.lastY;
      if (Math.abs(deltaX) + Math.abs(deltaY) < 1) return;
      map.panBy(-deltaX, -deltaY);
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      event.preventDefault();
      event.stopPropagation();
    };

    element.addEventListener("pointerdown", startDrag, true);
    element.addEventListener("pointermove", moveDrag, true);
    element.addEventListener("pointerup", endDrag, true);
    element.addEventListener("pointercancel", endDrag, true);
    return () => {
      element.removeEventListener("pointerdown", startDrag, true);
      element.removeEventListener("pointermove", moveDrag, true);
      element.removeEventListener("pointerup", endDrag, true);
      element.removeEventListener("pointercancel", endDrag, true);
      googleDragRef.current = null;
    };
  }, [mapReady]);

  function resetFilters() {
    setQ("");
    setSector("");
    setStage("");
    setEmployees("");
    setLocation("");
    setHiring("");
    setActiveClusterId("");
    setShowExtraContent(true);
    setFallbackPan({ x: 0, y: 0 });
  }

  function saveCurrentCompany() {
    if (!selected) return;
    setSavedSlugs((current) => {
      const next = current.includes(selected.slug) ? current : [...current, selected.slug];
      window.localStorage.setItem("basecamp.savedCompanies", JSON.stringify(next));
      return next;
    });
    setMapStatus(`${selected.name} saved to your investor list.`);
  }

  function exportFilteredCsv() {
    const csv = [
      ["Name", "Website", "Employees", "Sector", "Stage", "Location", "Address", "Hiring"],
      ...filtered.map((company) => [
        company.name,
        company.website ?? "",
        company.employees ?? "",
        company.sector ?? "",
        company.stage ?? "",
        company.location ?? "",
        company.address ?? "",
        company.hiringStatus
      ])
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "utah-startup-map.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    const readMapsKey = () => {
      const override = window.localStorage.getItem("basecamp.googleMapsApiKey")?.trim();
      setGoogleMapsApiKey(override || configuredGoogleMapsApiKey || bakedGoogleMapsApiKey);
    };
    readMapsKey();
    window.addEventListener("storage", readMapsKey);
    window.addEventListener("basecamp-google-maps-settings", readMapsKey);
    return () => {
      window.removeEventListener("storage", readMapsKey);
      window.removeEventListener("basecamp-google-maps-settings", readMapsKey);
    };
  }, [configuredGoogleMapsApiKey]);

  useEffect(() => {
    const syncTheme = () => setTheme(readStoredTheme());
    const handleThemeChange = (event: Event) => {
      const nextTheme = (event as CustomEvent<{ theme?: string }>).detail?.theme;
      setTheme(nextTheme === "tech" ? "tech" : "classic");
    };
    syncTheme();
    window.addEventListener("basecamp-theme-change", handleThemeChange);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener("basecamp-theme-change", handleThemeChange);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (sector) params.set("sector", sector);
    if (stage) params.set("stage", stage);
    if (employees) params.set("employees", employees);
    if (location) params.set("location", location);
    if (hiring) params.set("hiring", hiring);
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [employees, hiring, location, q, sector, stage]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/company-icons")
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { icons?: Record<string, CompanyIconView>; count?: number } | null) => {
        if (cancelled || !result?.icons) return;
        setCompanyIcons((current) => ({ ...current, ...result.icons }));
        const count = result.count ?? 0;
        if (count) {
          setMapStatus((current) =>
            current.includes("Resolving")
              ? current
              : `${count.toLocaleString()} company logos cached from startup websites.`
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    geocodedLocationsRef.current = geocodedLocations;
  }, [geocodedLocations]);

  useEffect(() => {
    if (!googleMapsApiKey || !mapElementRef.current || mapRef.current) return;
    let cancelled = false;

    async function startGoogleMap() {
      const mapsWindow = window as GoogleMapsWindow;
      mapsWindow.gm_authFailure = () => {
        if (!cancelled) {
          setMapStatus(
            "Google Maps authorization failed. Check billing, Maps JavaScript API, Geocoding API, and HTTP referrer restrictions for this key."
          );
        }
      };
      try {
        await loadGoogleMaps(googleMapsApiKey);
        if (!mapsWindow.google) throw new Error("Google Maps did not initialize.");

        const [coreLibrary, mapsLibrary, geocodingLibrary, streetViewLibrary] =
          await Promise.all([
            mapsWindow.google.maps.importLibrary("core") as Promise<CoreLibrary>,
            mapsWindow.google.maps.importLibrary("maps") as Promise<MapsLibrary>,
            mapsWindow.google.maps.importLibrary("geocoding") as Promise<GeocodingLibrary>,
            mapsWindow.google.maps.importLibrary("streetView") as Promise<StreetViewLibrary>
          ]);

        if (cancelled || !mapElementRef.current) return;

        latLngRef.current = coreLibrary.LatLng;
        boundsRef.current = coreLibrary.LatLngBounds;
        if (!mapsWindow.google.maps.Marker) {
          throw new Error("Google Maps Marker library did not initialize.");
        }
        markerConstructorRef.current = mapsWindow.google.maps.Marker;
        markerCirclePathRef.current =
          mapsWindow.google.maps.SymbolPath?.CIRCLE ?? markerCirclePathRef.current;
        geocoderRef.current = new geocodingLibrary.Geocoder();
        streetViewServiceRef.current = new streetViewLibrary.StreetViewService();

        const activeMapId = mapIdForTheme(
          theme,
          configuredGoogleMapsMapId,
          configuredGoogleMapsTechMapId
        );
        mapRef.current = new mapsLibrary.Map(mapElementRef.current, {
          backgroundColor: theme === "tech" ? "#020814" : "#e6edf4",
          center: UTAH_CENTER,
          clickableIcons: false,
          disableDefaultUI: true,
          fullscreenControl: false,
          gestureHandling: "greedy",
          mapId: activeMapId || undefined,
          mapTypeControl: false,
          mapTypeId: "roadmap",
          restriction: {
            latLngBounds: UTAH_BOUNDS,
            strictBounds: false
          },
          scaleControl: true,
          streetViewControl: false,
          styles: embeddedStylesForTheme(theme, activeMapId),
          zoom: compact ? 6 : 7,
          zoomControl: false
        });

        setMapReady(true);
        setMapStatus("Google map ready. Pins upgrade to exact address coordinates as geocoding completes.");
      } catch (error) {
        setMapStatus(error instanceof Error ? error.message : "Google Maps could not load.");
      }
    }

    void startGoogleMap();

    return () => {
      cancelled = true;
    };
  }, [compact, configuredGoogleMapsMapId, configuredGoogleMapsTechMapId, googleMapsApiKey, theme]);

  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      markers.forEach(({ listener, marker }) => {
        listener.remove();
        marker.setMap(null);
      });
      markers.clear();
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !markerConstructorRef.current) return;
    const map = mapRef.current;
    const Marker = markerConstructorRef.current;
    const visibleIds = new Set(mapItems.map((item) => item.id));

    markersRef.current.forEach((entry, id) => {
      if (!visibleIds.has(id)) {
        entry.listener.remove();
        entry.marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    mapItems.forEach((item) => {
      const active = Boolean(
        (selected && item.slugs.includes(selected.slug)) ||
          (selectedCluster && item.id === selectedCluster.id)
      );
      const options = googleMarkerOptions(item, active, map, markerCirclePathRef.current);
      const existing = markersRef.current.get(item.id);
      if (existing) {
        existing.item = item;
        existing.marker.setOptions(options);
        return;
      }
      const marker = new Marker(options);
      const listener = marker.addListener("click", () => {
        const current = markersRef.current.get(item.id)?.item ?? item;
        selectMapItemRef.current(current);
      });
      markersRef.current.set(item.id, { item, listener, marker });
    });
  }, [mapItems, mapReady, selected, selectedCluster]);

  useEffect(() => {
    if (!activeClusterId || selectedCluster) return;
    const timeout = window.setTimeout(() => setActiveClusterId(""), 0);
    return () => window.clearTimeout(timeout);
  }, [activeClusterId, selectedCluster]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const activeMapId = mapIdForTheme(
      theme,
      configuredGoogleMapsMapId,
      configuredGoogleMapsTechMapId
    );
    mapRef.current.setOptions({
      backgroundColor: theme === "tech" ? "#020814" : "#e6edf4",
      mapId: activeMapId || undefined,
      styles: embeddedStylesForTheme(theme, activeMapId)
    });
  }, [configuredGoogleMapsMapId, configuredGoogleMapsTechMapId, mapReady, theme]);

  useEffect(() => {
    const Bounds = boundsRef.current;
    const LatLng = latLngRef.current;
    if (!mapReady || !mapRef.current || !Bounds || !LatLng) return;
    if (filtered.length === 1) {
      const position = mapLocationForCompany(filtered[0], geocodedLocations);
      mapRef.current.setZoom(13);
      mapRef.current.setCenter(position);
      return;
    }
    const bounds = new Bounds();
    filtered.forEach((company) => {
      const position = mapLocationForCompany(company, geocodedLocations);
      bounds.extend(new LatLng(position.lat, position.lng));
    });
    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds);
  }, [filterKey, filtered, geocodedLocations, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selected || !selectedLocation) return;
    mapRef.current.panTo(selectedLocation);
  }, [mapReady, selected, selectedLocation]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    mapRef.current.setMapTypeId(mapMode);
  }, [mapMode, mapReady]);

  useEffect(() => {
    if (!mapReady || !geocoderRef.current || geocodeCandidates.length === 0) return;
    let cancelled = false;

    async function geocodeAddresses() {
      const geocoder = geocoderRef.current;
      if (!geocoder) return;

      const cache = loadGeocodeCache();
      const cachedMatches: Record<string, CompanyMapLocation> = {};
      const pending = geocodeCandidates.filter((company) => {
        const cached = cache[geocodeCacheKey(company)];
        if (cached) {
          cachedMatches[company.slug] = cached;
          return false;
        }
        return !geocodedLocationsRef.current[company.slug];
      });

      if (Object.keys(cachedMatches).length > 0) {
        setGeocodedLocations((current) => ({ ...current, ...cachedMatches }));
      }

      if (pending.length === 0) {
        setMapStatus("Exact Google locations are cached for this view.");
        return;
      }

      let resolved = 0;
      setMapStatus(`Resolving ${pending.length} exact Utah addresses with Google geocoding...`);
      for (const company of pending) {
        if (cancelled) return;
        await delay(110);
        try {
          const response = await geocoder.geocode({
            address: company.address,
            componentRestrictions: { administrativeArea: "UT", country: "US" },
            region: "us"
          });
          const result = response.results[0];
          if (!result || result.partial_match) continue;
          const exactLocation: CompanyMapLocation = {
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng(),
            confidence: "google",
            formattedAddress: result.formatted_address
          };
          cache[geocodeCacheKey(company)] = exactLocation;
          saveGeocodeCache(cache);
          resolved += 1;
          setGeocodedLocations((current) => ({ ...current, [company.slug]: exactLocation }));
          setMapStatus(`${resolved}/${pending.length} exact Google addresses resolved for this view.`);
        } catch {
          setMapStatus(
            "Google Maps is loaded, but this key cannot use Geocoding API yet. Check that this exact key belongs to the enabled project and that key API restrictions include Geocoding."
          );
          return;
        }
      }
    }

    void geocodeAddresses();

    return () => {
      cancelled = true;
    };
  }, [geocodeCandidates, mapReady]);

  function zoomBy(delta: number) {
    if (!mapRef.current) {
      setFallbackZoom((value) => clamp(Number((value + delta * 0.18).toFixed(2)), 0.8, 1.8));
      return;
    }
    mapRef.current.setZoom((mapRef.current.getZoom() ?? 7) + delta);
  }

  function fitVisibleCompanies() {
    const Bounds = boundsRef.current;
    const LatLng = latLngRef.current;
    if (!mapRef.current || !Bounds || !LatLng) {
      setFallbackZoom(1);
      setFallbackPan({ x: 0, y: 0 });
      return;
    }
    const bounds = new Bounds();
    filtered.forEach((company) => {
      const position = mapLocationForCompany(company, geocodedLocations);
      bounds.extend(new LatLng(position.lat, position.lng));
    });
    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds);
  }

  async function openStreetView() {
    if (!selected || !selectedLocation || !streetViewServiceRef.current || !mapRef.current) return;
    if (selectedLocation.confidence !== "google") {
      setStreetViewStatus(
        "Street View opens after this company has an exact Google-geocoded address. Enable Geocoding API for the key first."
      );
      return;
    }
    setStreetViewStatus(`Finding Street View near ${selected.name}...`);
    try {
      const response = await streetViewServiceRef.current.getPanorama({
        location: selectedLocation,
        radius: 250,
        source: "outdoor"
      });
      const panorama = mapRef.current.getStreetView();
      if (response.data.location?.pano) {
        panorama.setPano(response.data.location.pano);
      } else if (response.data.location?.latLng) {
        panorama.setPosition(response.data.location.latLng);
      } else {
        panorama.setPosition(selectedLocation);
      }
      panorama.setPov({ heading: 34, pitch: 0 });
      panorama.setVisible(true);
      setStreetViewStatus(`Street View opened near ${selected.name}.`);
    } catch {
      setStreetViewStatus(`No Street View panorama was found near ${selected.name}.`);
    }
  }

  const consoleClassName = [
    "map-section",
    "startup-map-console",
    compact ? "startup-map-console--compact" : "",
    focusMode ? "startup-map-console--focus" : "",
    selected && profileDrawerOpen ? "startup-map-console--drawer-open" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const showMapStatus = Boolean(
    streetViewStatus ||
      !googleMapsApiKey ||
      /saved|unable|failed|error|no street|add next_public/i.test(mapStatus)
  );

  return (
    <section className={consoleClassName}>
      <aside className="map-filter-card" aria-label="Startup map filters">
        <div className="map-filter-card__header">
          <div>
            <p>Investor Map</p>
            <h1>Where Utah is building</h1>
          </div>
          {activeFilters.length > 0 && (
            <button type="button" onClick={resetFilters}>
              <RefreshCw size={14} aria-hidden="true" />
              Reset
            </button>
          )}
        </div>

        <label className="search-field map-filter-search">
          <Search size={17} aria-hidden="true" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search startups or cities"
          />
        </label>

        <div className="map-source-toggle-row">
          <button
            type="button"
            className={
              showExtraContent
                ? "map-toggle-control map-source-toggle active"
                : "map-toggle-control map-source-toggle"
            }
            onClick={() => setShowExtraContent((value) => !value)}
            aria-pressed={showExtraContent}
          >
            <Layers size={17} aria-hidden="true" />
            Extra data
            <span aria-hidden="true" />
          </button>
          <small>
            {showExtraContent
              ? `${extraCompanyCount.toLocaleString()} public records on`
              : "Initial seed document only"}
          </small>
        </div>

        <div className="sector-chip-row" aria-label="Quick sector filters">
          <button
            type="button"
            className={hiring === "hiring" ? "active" : undefined}
            onClick={() => setHiring((value) => (value === "hiring" ? "" : "hiring"))}
          >
            Hiring now
          </button>
          {topSectorChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className={sector === chip.label ? "active" : undefined}
              onClick={() => setSector((value) => (value === chip.label ? "" : chip.label))}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <details className="map-advanced-filters">
          <summary>
            <span>More filters</span>
            <ChevronRight size={14} aria-hidden="true" />
          </summary>
          <div className="map-filter-stack">
            <MapSelect label="Sector" value={sector} onChange={setSector} options={visibleFacets.sectors} />
            <MapSelect
              label="Size"
              value={employees}
              onChange={setEmployees}
              options={visibleFacets.employeeBands}
            />
            <MapSelect
              label="Stage"
              value={stage}
              onChange={setStage}
              options={visibleFacets.companyStages}
            />
            <MapSelect
              label="Hiring Status"
              value={hiring}
              onChange={setHiring}
              options={hiringOptions}
            />
            <MapSelect
              label="Location"
              value={location}
              onChange={setLocation}
              options={visibleFacets.companyLocations}
            />
          </div>
        </details>

        {activeFilters.length > 0 && (
          <div className="active-filter-panel">
            <span>Active filters</span>
            <div className="active-filter-chips">
              {activeFilters.map((filter) => (
                <button key={filter.id} type="button" onClick={filter.clear}>
                  {filter.label}
                  <X size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="map-investor-snapshot" aria-label="Current opportunity view">
          <strong>{filtered.length.toLocaleString()}</strong>
          <span>startups in view</span>
          <small>
            {visibleHiringCount.toLocaleString()} hiring · {investorSummary}
          </small>
        </div>

        <div className="map-results-drawer" aria-label="Search results">
          <div className="drawer-section__heading">
            <div>
              <h3>{selectedCluster ? "Cluster" : "Explore"}</h3>
              <span className="map-results-meta">
                {selectedCluster
                  ? `${resultCompanies.length.toLocaleString()} startups near ${selectedCluster.company.location || "this area"}`
                  : `${resultCompanies.length.toLocaleString()} startups in this view`}
              </span>
            </div>
            <div className="map-drawer-actions">
              {selectedCluster && (
                <button type="button" onClick={() => setActiveClusterId("")}>
                  All results
                </button>
              )}
              <button type="button" onClick={exportFilteredCsv}>CSV</button>
              <button
                type="button"
                onClick={() => {
                  const next = Array.from(
                    new Set([...savedSlugs, ...resultCompanies.map((company) => company.slug)])
                  );
                  setSavedSlugs(next);
                  window.localStorage.setItem("basecamp.savedCompanies", JSON.stringify(next));
                  setMapStatus(`${next.length} companies saved in this browser.`);
                }}
              >
                <Bookmark size={13} aria-hidden="true" />
                Save
              </button>
            </div>
          </div>
          <div className="map-results-list">
            {resultCompanies.length > 0 ? (
              resultCompanies.map((company) => (
                <button
                  key={company.slug}
                  type="button"
                  className={company.slug === selectedSlug ? "map-result active" : "map-result"}
                  onClick={() =>
                    selectCompany(company.slug, { preserveCluster: Boolean(selectedCluster) })
                  }
                >
                  <span>{company.name}</span>
                  <small>
                    {[company.location || "Utah", company.sector || "Uncategorized", company.employees]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </button>
              ))
            ) : (
              <p className="map-results-empty">No companies match these filters.</p>
            )}
          </div>
        </div>
      </aside>

      <div className="map-main-panel">
        <div
          className={heatmap ? "map-stage map-stage--console heatmap-on" : "map-stage map-stage--console"}
          aria-label="Utah startup ecosystem map"
        >
          {googleMapsApiKey ? (
            <div ref={mapElementRef} className="google-map-canvas" />
          ) : (
            <FallbackStartupMap
              items={mapItems}
              selectedSlug={selected?.slug ?? ""}
              selectedClusterId={selectedCluster?.id ?? ""}
              zoom={fallbackZoom}
              pan={fallbackPan}
              onPan={setFallbackPan}
              onSelect={selectMapItem}
            />
          )}

          <div className="map-investor-pill" aria-label="Visible startup count">
            <strong>{filtered.length.toLocaleString()}</strong>
            <span>Utah startups</span>
            <small>{visibleHiringCount.toLocaleString()} hiring now</small>
          </div>

          <div className="map-control-stack" aria-label="Map zoom controls">
            <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in">
              <Plus size={19} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out">
              <Minus size={19} aria-hidden="true" />
            </button>
            <button type="button" onClick={fitVisibleCompanies} aria-label="Fit visible companies">
              <LocateFixed size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setFocusMode((value) => !value)}
              aria-label={focusMode ? "Exit full screen map mode" : "Open full screen map mode"}
            >
              {focusMode ? <Minimize2 size={18} aria-hidden="true" /> : <Expand size={18} aria-hidden="true" />}
            </button>
          </div>

          <details className="map-view-menu">
            <summary>
              <Layers size={16} aria-hidden="true" />
              View
            </summary>
            <div>
              <button
                type="button"
                className={heatmap ? "map-toggle-control active" : "map-toggle-control"}
                onClick={() => setHeatmap((value) => !value)}
              >
                <Flame size={17} aria-hidden="true" />
                Heatmap
                <span aria-hidden="true" />
              </button>
              <button
                type="button"
                className="map-icon-control"
                onClick={() => setMapMode((mode) => (mode === "roadmap" ? "satellite" : "roadmap"))}
                aria-label={mapMode === "roadmap" ? "Switch to satellite map" : "Switch to road map"}
              >
                <Satellite size={17} aria-hidden="true" />
                {mapMode === "roadmap" ? "Satellite" : "Roadmap"}
              </button>
              <button
                type="button"
                className="map-icon-control"
                onClick={openStreetView}
                disabled={!mapReady || !selected || selectedLocation?.confidence !== "google"}
              >
                <Camera size={17} aria-hidden="true" />
                Street View
              </button>
            </div>
          </details>

          {selected && (
            <button
              type="button"
              className="map-company-popover"
              onClick={() => setProfileDrawerOpen(true)}
            >
              <CompanyLogo company={selected} iconUrl={companyIcons[selected.slug]?.url} small />
              <span>
                <strong>{selected.name}</strong>
                <small>
                  {selected.location || "Utah"} · {selected.employees || "Employees unknown"}
                </small>
              </span>
              {selectedVerified && (
                <em>
                  <CheckCircle2 size={12} aria-hidden="true" />
                  Verified
                </em>
              )}
            </button>
          )}

          {showMapStatus && (
            <div className="map-status-badge">
              <LocateFixed size={15} aria-hidden="true" />
              {streetViewStatus || mapStatus}
            </div>
          )}
        </div>
      </div>

      {selected && profileDrawerOpen && (
        <aside className="map-company-drawer" aria-label="Selected company profile">
          <article>
            <div className="company-drawer__header">
              <CompanyLogo company={selected} iconUrl={companyIcons[selected.slug]?.url} />
              <div>
                <div className="company-title-row">
                  <h2>{selected.name}</h2>
                  {selectedVerified && (
                    <span className="verified-pill">
                      <CheckCircle2 size={14} aria-hidden="true" />
                      Verified
                    </span>
                  )}
                </div>
                {selected.website && (
                  <Link className="company-website-link" href={selected.website} target="_blank">
                    <ExternalLink size={15} aria-hidden="true" />
                    {selected.website.replace(/^https?:\/\//, "")}
                  </Link>
                )}
              </div>
              <button
                type="button"
                className="drawer-close-button"
                onClick={() => setProfileDrawerOpen(false)}
                aria-label="Close company preview"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <dl className="company-quick-facts company-quick-facts--compact">
              <div>
                <dt>
                  <BriefcaseBusiness size={15} aria-hidden="true" />
                  Sector
                </dt>
                <dd>{selected.sector || "Uncategorized"}</dd>
              </div>
              <div>
                <dt>
                  <Users size={15} aria-hidden="true" />
                  Employees
                </dt>
                <dd>{selected.employees || "Unknown"}</dd>
              </div>
              <div>
                <dt>
                  <Calendar size={15} aria-hidden="true" />
                  Founded
                </dt>
                <dd>{selected.foundedYear || "Unknown"}</dd>
              </div>
            </dl>

            <section className="drawer-section drawer-section--summary">
              <h3>Investor Snapshot</h3>
              <p>{selected.description}</p>
            </section>

            <dl className="company-profile-strip company-profile-strip--simple">
              <div>
                <dt>
                  <MapPin size={15} aria-hidden="true" />
                  Location
                </dt>
                <dd>{selected.location || selectedLocation?.formattedAddress || "Utah"}</dd>
              </div>
              <div>
                <dt>Hiring</dt>
                <dd>
                  <span className={selected.hiringStatus === "hiring" ? "status-pill hiring" : "status-pill"}>
                    {formatHiringStatus(selected.hiringStatus)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>
                  <Linkedin size={15} aria-hidden="true" />
                  LinkedIn
                </dt>
                <dd>
                  {selected.linkedin ? (
                    <Link href={selected.linkedin} target="_blank">
                      {formatLinkedInPath(selected.linkedin)}
                    </Link>
                  ) : (
                    "Add during claim"
                  )}
                </dd>
              </div>
            </dl>

            <div className="company-drawer-actions">
              <button type="button" className="ghost-button" onClick={saveCurrentCompany}>
                <Bookmark size={16} aria-hidden="true" />
                Save
              </button>
              <Link className="ghost-button" href={`/submit-company?company=${selected.slug}`}>
                <ShieldCheck size={16} aria-hidden="true" />
                Claim Profile
              </Link>
              <Link className="primary-button" href={`/companies/${selected.slug}`}>
                View Full Profile
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </article>
        </aside>
      )}
    </section>
  );
}

function FallbackStartupMap({
  items,
  selectedSlug,
  selectedClusterId,
  zoom,
  pan,
  onPan,
  onSelect
}: {
  items: MapOverlayItem[];
  selectedSlug: string;
  selectedClusterId: string;
  zoom: number;
  pan: FallbackMapPan;
  onPan: (pan: FallbackMapPan) => void;
  onSelect: (item: MapOverlayItem) => void;
}) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: FallbackMapPan;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: pan
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    onPan({
      x: drag.origin.x + event.clientX - drag.startX,
      y: drag.origin.y + event.clientY - drag.startY
    });
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }

  return (
    <div
      className={dragging ? "fallback-map dragging" : "fallback-map"}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="fallback-map__plane"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <div className="utah-map-shape" />
        {items.map((item) => {
          const position = item.position;
          const point = projectUtahPoint(position.lat, position.lng);
          const active =
            item.slugs.includes(selectedSlug) || Boolean(selectedClusterId && item.id === selectedClusterId);
          return (
            <button
              key={item.id}
              className={fallbackMarkerClassName(item, active)}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              type="button"
              aria-label={markerLabel(item)}
              title={markerLabel(item)}
              onClick={() => onSelect(item)}
            >
              {item.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.iconUrl} alt="" />
              ) : (
                <span>{item.count > 1 ? item.count.toLocaleString() : initialsForCompany(item.company.name)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompanyLogo({
  company,
  iconUrl,
  small = false
}: {
  company: Company;
  iconUrl?: string;
  small?: boolean;
}) {
  const [iconFailed, setIconFailed] = useState(false);
  return (
    <span className={small ? "company-logo-gem company-logo-gem--small" : "company-logo-gem"} aria-hidden="true">
      {iconUrl && !iconFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl} alt="" onError={() => setIconFailed(true)} />
      ) : (
        initialsForCompany(company.name)
      )}
    </span>
  );
}

function MapSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Facet[];
}) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Any</option>
        {options
          .filter((option) => option.count > 0)
          .slice(0, 45)
          .map((option) => (
            <option key={option.label} value={option.label}>
              {formatFacetLabel(option.label)} ({option.count})
            </option>
          ))}
      </select>
    </label>
  );
}

function fallbackMarkerClassName(item: MapOverlayItem, active: boolean) {
  return [
    "map-pin",
    active ? "active" : "",
    item.count > 1 ? "cluster" : "",
    item.company.hiringStatus === "hiring" ? "hiring" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function googleMarkerOptions(
  item: MapOverlayItem,
  active: boolean,
  map: GoogleMap,
  circlePath: string | number
): GoogleMarkerOptions {
  const clustered = item.count > 1;
  const fillColor = active
    ? "#16211f"
    : clustered
      ? "#f08a1f"
      : item.company.hiringStatus === "hiring"
        ? "#c79532"
        : item.position.confidence === "google" || item.position.confidence === "source"
          ? "#0d8f8c"
          : "#eb4d42";
  return {
    clickable: true,
    icon: {
      path: circlePath,
      fillColor,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: active ? 3 : 2,
      scale: active ? 12 : clustered ? 10 : 8
    },
    label: {
      text: clustered ? String(item.count) : initialsForCompany(item.company.name),
      color: "#ffffff",
      fontSize: clustered ? "11px" : "9px",
      fontWeight: "900"
    },
    map,
    optimized: true,
    position: item.position,
    title: markerLabel(item),
    zIndex: markerZIndex(item, active)
  };
}

function markerLabel(item: MapOverlayItem) {
  if (item.count > 1) return `Open cluster of ${item.count} startups near ${item.company.location || "Utah"}`;
  return `Select ${item.company.name}`;
}

function markerZIndex(item: MapOverlayItem, active: boolean) {
  if (active) return 90;
  if (item.count > 1) return 20 + Math.min(item.count, 60);
  return item.position.confidence === "google" || item.position.confidence === "source" ? 8 : 4;
}

function initialsForCompany(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function mapLocationForCompany(
  company: Company,
  geocodedLocations: Record<string, CompanyMapLocation>
): CompanyMapLocation {
  return (
    geocodedLocations[company.slug] ?? {
      lat: company.coordinates.lat,
      lng: company.coordinates.lng,
      confidence: company.coordinates.confidence
    }
  );
}

function isExtraMapCompany(company: Company) {
  return company.displayType === "public-business" || Boolean(company.source?.id);
}

function companyFacet(
  companies: Company[],
  select: (company: Company) => string | undefined,
  sort: "count" | "alpha" = "count"
) {
  const counts = new Map<string, number>();
  for (const company of companies) {
    const label = select(company)?.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) =>
      sort === "alpha" ? a.label.localeCompare(b.label) : b.count - a.count || a.label.localeCompare(b.label)
    );
}

function buildMapOverlayItems(
  companies: Company[],
  geocodedLocations: Record<string, CompanyMapLocation>,
  companyIcons: Record<string, CompanyIconView>
) {
  const buckets = new Map<string, MapOverlayItem>();
  for (const company of companies) {
    const position = mapLocationForCompany(company, geocodedLocations);
    const cellSize = position.confidence === "google" || position.confidence === "source" ? 0.08 : 0.22;
    const key = `${Math.round(position.lat / cellSize)}:${Math.round(position.lng / cellSize)}`;
    const current = buckets.get(key);
    if (!current) {
      buckets.set(key, {
        id: key,
        company,
        position,
        count: 1,
        slugs: [company.slug],
        iconUrl: companyIcons[company.slug]?.url
      });
      continue;
    }
    const nextCount = current.count + 1;
    current.position = {
      ...current.position,
      lat: (current.position.lat * current.count + position.lat) / nextCount,
      lng: (current.position.lng * current.count + position.lng) / nextCount,
      confidence:
        current.position.confidence === "google" || position.confidence === "google"
          ? "google"
          : current.position.confidence === "source" || position.confidence === "source"
            ? "source"
          : current.position.confidence
    };
    current.count = nextCount;
    current.slugs.push(company.slug);
  }
  return Array.from(buckets.values());
}

function isGeocodableCompany(company: Company) {
  return Boolean(
    company.coordinates.confidence !== "source" &&
      company.address &&
      /\but\b|\butah\b/i.test(company.address)
  );
}

function geocodeCacheKey(company: Company) {
  return `${company.name}|${company.address}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function loadGoogleMaps(apiKey: string) {
  const mapsWindow = window as GoogleMapsWindow;
  if (mapsWindow.google?.maps.importLibrary) return Promise.resolve();
  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    mapsWindow.__basecampGoogleMapsReady = () => {
      delete mapsWindow.__basecampGoogleMapsReady;
      resolve();
    };
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      loading: "async",
      callback: GOOGLE_MAPS_CALLBACK
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps could not load. Check the API key and referrer restrictions."));
    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}

function loadGeocodeCache() {
  try {
    const stored = window.localStorage.getItem(GEOCODE_CACHE_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as Record<string, CompanyMapLocation>;
  } catch {
    return {};
  }
}

function saveGeocodeCache(cache: Record<string, CompanyMapLocation>) {
  try {
    window.localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Local storage is a cache only; the map can continue without it.
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatHiringStatus(value: Company["hiringStatus"]) {
  return formatFacetLabel(value);
}

function formatFacetLabel(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function formatLinkedInPath(value: string) {
  try {
    const url = new URL(value);
    return url.pathname.replace(/^\/+/, "") || url.hostname;
  } catch {
    return value.replace(/^https?:\/\//, "");
  }
}

function mapIdForTheme(theme: AppTheme, mapId: string, techMapId: string) {
  return theme === "tech" ? techMapId : mapId;
}

function embeddedStylesForTheme(theme: AppTheme, mapId: string) {
  return theme === "tech" && !mapId ? TECH_GOOGLE_MAP_STYLES : undefined;
}

function readStoredTheme(): AppTheme {
  if (typeof window === "undefined") {
    return "classic";
  }
  return window.localStorage.getItem("basecamp.theme") === "tech" ||
    document.documentElement.dataset.theme === "tech"
    ? "tech"
    : "classic";
}

function readInitialMapFilters() {
  if (typeof window === "undefined") {
    return { q: "", sector: "", stage: "", employees: "", location: "", hiring: "" };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") ?? "",
    sector: params.get("sector") ?? "",
    stage: params.get("stage") ?? "",
    employees: params.get("employees") ?? "",
    location: params.get("location") ?? "",
    hiring: params.get("hiring") ?? ""
  };
}

function readStoredBoolean(key: string, fallback: boolean) {
  if (typeof window === "undefined") {
    return fallback;
  }
  const value = window.localStorage.getItem(key);
  return value === null ? fallback : value === "true";
}

function readStoredStringArray(key: string) {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
