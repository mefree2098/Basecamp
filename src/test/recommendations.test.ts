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

  it("keeps VC and angel intent ahead of generic mentor and setup resources", () => {
    const profile: FounderProfile = {
      stage: "fund",
      county: "Salt Lake",
      industry: "Software and Information Technology",
      community: "Any",
      goal: "18 months in with paying customers, ready to raise a venture round from angel groups and VCs",
      mode: "chat"
    };
    const vcResource: Resource = {
      id: "vc",
      slug: "vc",
      title: "Seed Venture Partners",
      description: "Early stage venture capital firm investing first checks in B2B SaaS startups.",
      communities: [],
      industries: ["Software and Information Technology"],
      locations: ["Utah"],
      topics: ["Funding"],
      stages: ["fund"],
      link: "https://example.vc",
      freshness: { status: "seeded" }
    };
    const scoreResource: Resource = {
      id: "score",
      slug: "score",
      title: "SCORE find a mentor",
      description: "Mentoring path for first business decisions.",
      communities: ["Any"],
      industries: ["Software and Information Technology"],
      locations: ["Salt Lake"],
      topics: ["Mentoring", "Funding", "Start a Business"],
      stages: ["start", "fund"],
      link: "https://www.score.org/ut/utah/mentors/",
      freshness: { status: "reviewed" }
    };
    const bankResource: Resource = {
      id: "bank",
      slug: "bank",
      title: "Business bank account step",
      description: "Open a business bank account after entity setup.",
      communities: ["Any"],
      industries: ["Software and Information Technology"],
      locations: ["Salt Lake"],
      topics: ["Start a Business", "Bank Account"],
      stages: ["start"],
      link: "https://startup.utah.gov/business-operations/",
      freshness: { status: "reviewed" }
    };

    const [top] = recommendResources(profile, [scoreResource, bankResource, vcResource]);

    expect(top.resource.id).toBe("vc");
  });
});
