import type { FounderProfile, FounderStage } from "./types";

type ProfileInferenceOptions = {
  counties?: string[];
  industries?: string[];
  communities?: string[];
};

export function inferFounderProfileFromText(
  current: FounderProfile,
  input: string,
  options: ProfileInferenceOptions = {}
): FounderProfile {
  const text = input.toLowerCase();
  return {
    ...current,
    stage: inferStageFromText(text, current.stage),
    industry: inferIndustryFromText(text, current.industry, options.industries ?? []),
    county: inferCountyFromText(text, current.county, options.counties ?? []),
    community: inferCommunityFromText(text, current.community, options.communities ?? []),
    goal: input,
    mode: "chat"
  };
}

export function inferStageFromText(input: string, fallback: FounderStage): FounderStage {
  const text = input.toLowerCase();
  if (/\b(exit|sell|succession|close|closing)\b/.test(text)) return "exit";
  if (hasTechnologyCommercializationIntent(text)) return "validate";
  if (hasIdeaFirstStepIntent(text)) return "idea";
  if (hasFundingIntent(text)) return "fund";
  if (
    hasInternationalExpansionIntent(text) ||
    /\b(grow|growth|hire|hiring|export|scale|scaling|workforce)\b/.test(text)
  ) {
    return "grow";
  }
  if (/\b(validate|pre[-\s]?revenue|mvp|prototype|test customers?|market research)\b/.test(text)) {
    return "validate";
  }
  if (/\b(idea|brainstorm|thinking about|exploring)\b/.test(text)) return "idea";
  if (/\b(start|launch|register|license|licence|llc|ein|permit|open)\b/.test(text)) return "start";
  return fallback;
}

export function hasIdeaFirstStepIntent(input: string) {
  return /\b(pre[-\s]?revenue|no business|not.*business|first steps|take (?:his|her|my|our|their) first steps|never started|has never started|exploring options?)\b/i.test(
    input
  );
}

export function hasFundingIntent(input: string) {
  const text = input.toLowerCase();
  if (
    /\b(fund|funding|grant|loan|capital|investors?|investment|pitch|raise|raising|raised|round|venture|vcs?|angels?|series\s+[abc]|term sheet|runway)\b/i.test(
      text
    )
  ) {
    return true;
  }
  return (
    /\b(seed|pre[-\s]?seed)\b/i.test(text) &&
    /\b(raise|raising|round|investors?|investment|capital|funding|venture|vcs?|angels?|term sheet|runway)\b/i.test(
      text
    )
  );
}

export function hasVentureCapitalIntent(input: string) {
  const text = input.toLowerCase();
  if (
    /\b(venture|vcs?|angels?|investors?|investment|raise|raising|raised|round|series\s+[abc]|term sheet|equity)\b/i.test(
      text
    )
  ) {
    return true;
  }
  return (
    /\b(seed|pre[-\s]?seed)\b/i.test(text) &&
    /\b(raise|raising|round|investors?|investment|capital|funding|venture|vcs?|angels?|term sheet|equity)\b/i.test(
      text
    )
  );
}

export function hasAngelGroupIntent(input: string) {
  return /\b(angel|angels|angel groups?|angel investors?)\b/i.test(input);
}

export function hasInternationalExpansionIntent(input: string) {
  return /\b(international|export|exports|exporting|global markets?|foreign markets?|overseas|worldwide|trade)\b/i.test(
    input
  );
}

export function hasTechnologyCommercializationIntent(input: string) {
  return /\b(phd|doctoral|research|researcher|university|commerciali[sz]e|commerciali[sz]ation|technology transfer|tech transfer|novel technology|lab|ip|intellectual property|patent)\b/i.test(
    input
  );
}

export function hasOperatingCompanySignals(input: string) {
  return /\b(paying customers?|customers?|revenue|arr|mrr|traction|launched|operating|existing|active business|cash flow|in market|\d+\s*(?:months?|years?)\s+in)\b/i.test(
    input
  );
}

export function detectedFounderCommunities(input: string, allowed: string[] = []) {
  const text = input.toLowerCase();
  const candidates: Array<[RegExp, string]> = [
    [/\b(woman|women|female|woman-owned|her first|she\/her)\b/, "Women"],
    [/\b(veteran|military)\b/, "Veteran"],
    [/\b(student|college|university|phd|doctoral)\b/, "Student"],
    [/\b(rural|small town)\b/, "Rural"],
    [/\b(immigrant|refugee|new american)\b/, "New American"],
    [/\b(multicultural|minority|asian|latino|hispanic|pacific islander|black)\b/, "Multicultural"]
  ];
  const allowedSet = new Set(allowed);
  return candidates
    .filter(([pattern, community]) => pattern.test(text) && (!allowed.length || allowedSet.has(community)))
    .map(([, community]) => community);
}

function inferIndustryFromText(text: string, fallback: string, industries: string[]) {
  const candidates: Array<[RegExp, string]> = [
    [/\b(software|saas|app|ai|tech|platform|developer)\b/, "Software and Information Technology"],
    [/\b(landscap|lawn|yard|farm|agricultur|ranch|garden)\b/, "Agriculture"],
    [/\b(food|restaurant|cafe|catering|truck|hotel|tourism|hospitality)\b/, "Hospitality and Food Services"],
    [/\b(health|clinic|medical|device|biotech|life science)\b/, "Life Sciences and Healthcare"],
    [/\b(manufactur|factory|industrial|hardware|machining|fabrication|fabricator|metalwork)\b/, "Manufacturing"],
    [/\b(film|music|artist|studio|game|entertainment|recreation)\b/, "Arts and Entertainment and Recreation"],
    [/\b(finance|bank|insurance|fintech)\b/, "Financial Services"],
    [/\b(retail|ecommerce|consumer product|packaged|cpg)\b/, "Consumer Packaged Goods"]
  ];
  return candidates.find(([pattern, industry]) => pattern.test(text) && industries.includes(industry))?.[1] ?? fallback;
}

function inferCountyFromText(text: string, fallback: string, counties: string[]) {
  const exactCounty = counties.find((county) => text.includes(county.toLowerCase()));
  if (exactCounty) return exactCounty;
  const cityToCounty: Record<string, string> = {
    "st. george": "Washington",
    "saint george": "Washington",
    washington: "Washington",
    lehi: "Utah",
    provo: "Utah",
    orem: "Utah",
    "salt lake": "Salt Lake",
    sandy: "Salt Lake",
    ogden: "Weber",
    logan: "Cache",
    "cedar city": "Iron",
    "park city": "Summit",
    moab: "Grand"
  };
  const match = Object.entries(cityToCounty).find(
    ([city, county]) => text.includes(city) && counties.includes(county)
  );
  return match?.[1] ?? fallback;
}

function inferCommunityFromText(text: string, fallback: string, communities: string[]) {
  return detectedFounderCommunities(text, communities)[0] ?? fallback;
}
