import { describe, expect, it } from "vitest";
import { recommendResources } from "@/lib/recommendations";
import type { FounderProfile, Resource } from "@/lib/types";

const resources: Resource[] = [
  {
    id: "1",
    slug: "salt-lake-funding",
    title: "Salt Lake Funding Lab",
    description: "Capital and pitch support for software startups.",
    communities: ["Any"],
    industries: ["Software and Information Technology"],
    locations: ["Salt Lake"],
    topics: ["Funding"],
    stages: ["fund"],
    link: "https://example.com",
    freshness: { status: "seeded" }
  },
  {
    id: "2",
    slug: "generic",
    title: "Generic Business Help",
    description: "General statewide help.",
    communities: ["Any"],
    industries: ["Other"],
    locations: ["Utah"],
    topics: ["Start a Business"],
    stages: ["start"],
    link: "https://example.com",
    freshness: { status: "seeded" }
  }
];

describe("recommendResources", () => {
  it("prioritizes deterministic stage, county, and industry matches", () => {
    const profile: FounderProfile = {
      stage: "fund",
      county: "Salt Lake",
      industry: "Software and Information Technology",
      community: "Any",
      goal: "Need capital",
      mode: "guided"
    };
    const [top] = recommendResources(profile, resources);
    expect(top.resource.slug).toBe("salt-lake-funding");
    expect(top.citations).toEqual(["resource:1"]);
  });
});
