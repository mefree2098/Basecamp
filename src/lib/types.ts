export type FounderStage =
  | "idea"
  | "validate"
  | "start"
  | "grow"
  | "fund"
  | "exit";

export type FounderProfile = {
  stage: FounderStage;
  industry: string;
  county: string;
  community: string;
  goal: string;
  mode: "chat" | "guided" | "manual";
};

export type Resource = {
  id: string;
  slug: string;
  title: string;
  description: string;
  communities: string[];
  industries: string[];
  locations: string[];
  topics: string[];
  stages: FounderStage[];
  link: string;
  email?: string;
  freshness: {
    status: "seeded" | "reviewed" | "needs_review";
    reviewedAt?: string;
    note?: string;
  };
};

export type Company = {
  slug: string;
  name: string;
  displayType: string;
  linkedin?: string;
  address: string;
  location: string;
  description: string;
  website?: string;
  stage?: string;
  employees?: string;
  sector?: string;
  hiringStatus: "unknown" | "hiring" | "not_hiring";
  foundedYear?: number;
  jobsUrl?: string;
  atsUrl?: string;
  jobPostings?: Array<{
    title: string;
    location?: string;
    url?: string;
    type?: string;
  }>;
  gallery: string[];
  coordinates: {
    lat: number;
    lng: number;
    confidence: "city" | "state" | "synthetic";
  };
  verificationStatus: "seeded" | "claimed" | "pending";
};

export type Recommendation = {
  resource: Resource;
  score: number;
  why: string;
  citations: string[];
};

export type Facet = { label: string; count: number };

export type PlatformFacets = {
  stages: Facet[];
  topics: Facet[];
  counties: Facet[];
  industries: Facet[];
  communities: Facet[];
  sectors: Facet[];
  companyStages: Facet[];
  employeeBands: Facet[];
  companyLocations: Facet[];
};

export type PageInfo = {
  totalApprox: number;
  hasNextPage: boolean;
  cursor: string | null;
};

export type ResourceListResponse = {
  items: Resource[];
  facets: PlatformFacets;
  page: PageInfo;
};

export type CompanyListResponse = {
  items: Company[];
  facets: PlatformFacets;
  page: PageInfo;
};

export type CompanyMapLocation = {
  lat: number;
  lng: number;
  confidence: Company["coordinates"]["confidence"] | "google";
  formattedAddress?: string;
};

export type CompanyIconView = {
  url: string;
  source?: string;
  fetchedAt?: string;
};

export type PlatformBootstrapResponse = {
  resources: Resource[];
  facets: PlatformFacets;
  founderOptions: {
    industries: string[];
    counties: string[];
    communities: string[];
  };
};

export type MapBootstrapResponse = {
  companies: Company[];
  facets: PlatformFacets;
  geocodedLocations: Record<string, CompanyMapLocation>;
  companyIcons: Record<string, CompanyIconView>;
};

export type CompanyProfileResponse = {
  company: Company;
  companyIcon?: CompanyIconView;
};

export type RecommendationResponse = {
  recommendations: Recommendation[];
  planCards: PlanCard[];
};

export type PlanCard = {
  title: string;
  dueWindow: "today" | "7_days" | "30_days" | "90_days";
  status: "suggested" | "saved" | "done";
};

export type WizardResponse = {
  assistantMessage: string;
  recommendations: Recommendation[];
  planCards: PlanCard[];
  usedProvider: string;
  guardrails: {
    deterministicFilters: boolean;
    citationsRequired: boolean;
    externalBrowsingUsed: boolean;
  };
};

export type FounderUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastSeenAt: string;
};

export type SessionTurn = {
  id: string;
  createdAt: string;
  profile: FounderProfile;
  userMessage: string;
  assistantMessage: string;
  usedProvider: string;
  planCards: PlanCard[];
  completedSteps: string[];
  recommendationIds: string[];
};

export type FounderSession = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  profile: FounderProfile;
  completedSteps: string[];
  planCards: PlanCard[];
  turns: SessionTurn[];
};

export type CompanyDraftSummary = {
  id: string;
  status: string;
  verificationStatus: string;
  submittedAt: string;
  emailDeliveryStatus: string;
  domainMatch?: {
    ok: boolean;
    reason: string;
    emailDomain?: string;
    websiteDomain?: string;
  };
  changes?: Array<{
    field: string;
    before: string;
    after: string;
  }>;
  payload?: {
    name: string;
    workEmail?: string;
  };
};

export type AdminSummaryResponse = {
  resourceCount: number;
  companyCount: number;
  needsReview: number;
  drafts: CompanyDraftSummary[];
};

export type SessionContext = {
  sessionId?: string;
  completedSteps?: string[];
  currentPlanCards?: PlanCard[];
  previousAssistantMessage?: string;
  history?: Array<{
    userMessage: string;
    assistantMessage: string;
    completedSteps?: string[];
  }>;
};

export type AiProvider =
  | "mock"
  | "openai"
  | "codexPath"
  | "anthropic"
  | "gemini";

export type ThinkingLevel = "none" | "low" | "medium" | "high" | "xhigh";

export type AiSettings = {
  provider: AiProvider;
  apiKey?: string;
  model: string;
  thinkingLevel: ThinkingLevel;
  codexPath?: string;
  codexHome?: string;
  codexHomeProfile?: "auto" | "azure" | "aws" | "local" | "custom";
  codexAwsVolumeRoot?: string;
};

export type ModelOption = {
  id: string;
  label: string;
  provider: AiProvider;
  supportsThinking: boolean;
  costHint: "local" | "low" | "medium" | "high" | "unknown";
};
