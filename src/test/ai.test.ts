import { describe, expect, it } from "vitest";
import {
  BASECAMP_SYSTEM_PROMPT,
  buildGroundedContext,
  listModels,
  orderRecommendationsByCitations,
  runWizardTurn
} from "@/lib/ai";
import type { FounderProfile, Recommendation, Resource } from "@/lib/types";

describe("AI model catalog", () => {
  it("returns local and provider fallback options", async () => {
    const models = await listModels({ provider: "mock" });
    expect(models.some((model) => model.id === "basecamp-local-guide")).toBe(true);
    expect(models.some((model) => model.provider === "openai")).toBe(true);
  });
});

describe("Basecamp guide prompt", () => {
  it("keeps the founder response grounded, concise, and action-oriented", () => {
    expect(BASECAMP_SYSTEM_PROMPT).toContain("reduce overwhelm");
    expect(BASECAMP_SYSTEM_PROMPT).toContain("clear first stop");
    expect(BASECAMP_SYSTEM_PROMPT).toContain("formation order");
    expect(BASECAMP_SYSTEM_PROMPT).toContain("direct action links");
    expect(BASECAMP_SYSTEM_PROMPT).toContain("Do not invent");
    expect(BASECAMP_SYSTEM_PROMPT).toContain("under 180 words");
  });

  it("injects cited candidate resources into the grounded context", () => {
    const profile: FounderProfile = {
      stage: "start",
      industry: "Software and Information Technology",
      county: "Salt Lake",
      community: "Any",
      goal: "Find a mentor",
      mode: "guided"
    };
    const recommendations: Recommendation[] = [
      {
        score: 98,
        why: "Recommended because it matches.",
        citations: ["resource:mentor"],
        resource: {
          id: "mentor",
          slug: "mentor",
          title: "Founder Mentor Desk",
          description: "Mentor intake for Utah founders.",
          communities: ["Any"],
          industries: ["Software and Information Technology"],
          locations: ["Salt Lake"],
          topics: ["Mentoring"],
          stages: ["start"],
          link: "https://example.com",
          freshness: { status: "seeded" }
        }
      }
    ];

    const context = buildGroundedContext(profile, profile.goal, recommendations);

    expect(context).toContain("Founder Mentor Desk [resource:mentor]");
    expect(context).toContain("Return the founder-facing answer only.");
  });

  it("orders displayed matches around the resources cited by the answer", () => {
    const recommendations: Recommendation[] = [
      {
        score: 99,
        why: "Top score",
        citations: ["resource:a"],
        resource: {
          id: "a",
          slug: "a",
          title: "High Score Resource",
          description: "Broad help.",
          communities: ["Any"],
          industries: ["Other"],
          locations: ["Utah"],
          topics: ["General"],
          stages: ["start"],
          link: "https://example.com",
          freshness: { status: "seeded" }
        }
      },
      {
        score: 80,
        why: "Cited answer",
        citations: ["resource:b"],
        resource: {
          id: "b",
          slug: "b",
          title: "Cited First Stop",
          description: "Specific help.",
          communities: ["Any"],
          industries: ["Other"],
          locations: ["Utah"],
          topics: ["Mentoring"],
          stages: ["start"],
          link: "https://example.com",
          freshness: { status: "seeded" }
        }
      }
    ];

    const [first] = orderRecommendationsByCitations("Start here [resource:b].", recommendations);

    expect(first.resource.id).toBe("b");
  });

  it("treats a new iOS app company as a formation path, not a generic resource search", async () => {
    const profile: FounderProfile = {
      stage: "start",
      industry: "Software and Information Technology",
      county: "Salt Lake",
      community: "Any",
      goal: "I want to create a tech startup where I make iOS apps and publish them.",
      mode: "guided"
    };
    const resources: Resource[] = [
      formationResource(
        "basecamp-startup-state-registration",
        "Startup State registration and licensure",
        "Utah registration, legal formation, EIN, and licensing path.",
        "https://startup.utah.gov/registration/"
      ),
      formationResource(
        "basecamp-irs-ein",
        "IRS employer identification number",
        "Federal EIN after forming a legal entity.",
        "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number"
      ),
      formationResource(
        "basecamp-sba-business-bank-account",
        "SBA open a business bank account",
        "Open a business bank account after entity records and tax ID.",
        "https://www.sba.gov/business-guide/launch-your-business/open-business-bank-account"
      ),
      formationResource(
        "basecamp-apple-developer-enrollment",
        "Apple Developer Program enrollment",
        "Publish iOS apps as an individual or organization.",
        "https://developer.apple.com/programs/enroll/"
      )
    ];

    const response = await runWizardTurn({
      settings: { provider: "mock", model: "basecamp-local-guide", thinkingLevel: "medium" },
      profile,
      message: profile.goal,
      resources
    });

    expect(response.assistantMessage).toContain("formation belongs in the first path");
    expect(response.assistantMessage).toContain("EIN");
    expect(response.assistantMessage).toContain("business bank account");
    expect(response.assistantMessage).toContain("Apple Developer Program enrollment");
  });
});

function formationResource(id: string, title: string, description: string, link: string): Resource {
  return {
    id,
    slug: id,
    title,
    description,
    communities: ["Any"],
    industries: ["Software and Information Technology"],
    locations: ["Salt Lake", "Utah"],
    topics: ["Start a Business", "Registration", "EIN", "Bank Account", "Apple Developer"],
    stages: ["start"],
    link,
    freshness: { status: "reviewed" }
  };
}
