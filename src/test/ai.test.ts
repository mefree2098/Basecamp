import { describe, expect, it } from "vitest";
import {
  BASECAMP_SYSTEM_PROMPT,
  buildGroundedContext,
  listModels,
  orderRecommendationsByCitations
} from "@/lib/ai";
import type { FounderProfile, Recommendation } from "@/lib/types";

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
});
