import { describe, expect, it } from "vitest";
import {
  BASECAMP_SYSTEM_PROMPT,
  buildGroundedContext,
  listModels,
  orderRecommendationsByCitations,
  runWizardTurn
} from "@/lib/ai";
import { loadResources, resetDataCachesForTests } from "@/lib/data";
import { inferStageFromText } from "@/lib/founderInference";
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
    expect(BASECAMP_SYSTEM_PROMPT).toContain("state-assigned concierge");
    expect(BASECAMP_SYSTEM_PROMPT).toContain("Plan-first protocol");
    expect(BASECAMP_SYSTEM_PROMPT).toContain("Done, Active, Queued, or Blocked");
    expect(BASECAMP_SYSTEM_PROMPT).toContain("direct action links");
    expect(BASECAMP_SYSTEM_PROMPT).toContain("direct page URL");
    expect(BASECAMP_SYSTEM_PROMPT).toContain("Do not invent");
    expect(BASECAMP_SYSTEM_PROMPT).toContain("initial plan turns");
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
    expect(context).toContain("Direct page: https://example.com");
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

  it("keeps a generic Utah business-starting answer inside Startup State scope", async () => {
    const profile: FounderProfile = {
      stage: "start",
      industry: "Software and Information Technology",
      county: "Salt Lake",
      community: "Any",
      goal: "I want to turn an idea into a real Utah business. What should I do first?",
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
    ];

    const response = await runWizardTurn({
      settings: { provider: "mock", model: "basecamp-local-guide", thinkingLevel: "medium" },
      profile,
      message: profile.goal,
      resources
    });

    expect(response.assistantMessage).toContain("working startup plan");
    expect(response.assistantMessage).toContain("Active:");
    expect(response.assistantMessage).toContain("Queued:");
    expect(response.assistantMessage).toContain("EIN");
    expect(response.assistantMessage).toContain("business bank account");
    expect(response.assistantMessage).not.toContain("Apple Developer");
  });

  it("continues a saved formation path without replacing the original goal", async () => {
    const profile: FounderProfile = {
      stage: "start",
      industry: "Software and Information Technology",
      county: "Salt Lake",
      community: "Any",
      goal: "I want to turn an idea into a real Utah business.",
      mode: "guided"
    };
    const currentPlanCards = [
      {
        title: "Choose a business name and entity structure",
        dueWindow: "today" as const,
        status: "suggested" as const
      },
      {
        title: "Register with Utah, then get the EIN/FEIN",
        dueWindow: "7_days" as const,
        status: "suggested" as const
      },
      {
        title: "Open the business bank account after entity records are ready",
        dueWindow: "30_days" as const,
        status: "suggested" as const
      }
    ];

    const response = await runWizardTurn({
      settings: { provider: "mock", model: "basecamp-local-guide", thinkingLevel: "medium" },
      profile,
      message: "I completed the checked steps. What's next?",
      resources: [
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
        )
      ],
      sessionContext: {
        completedSteps: ["Choose a business name and entity structure"],
        currentPlanCards,
        previousAssistantMessage: "Start with Startup State registration and licensure."
      }
    });

    expect(response.assistantMessage).toContain("marked complete");
    expect(response.planCards).toEqual(currentPlanCards);
    expect(response.planCards.map((card) => card.title)).not.toContain(
      "Draft a one-page plan for i completed the checked steps. what's next?"
    );
  });

  it("routes an operating SaaS founder asking for angel and VC capital away from setup basics", async () => {
    const message =
      "Hi, I am Priya, 31 and live in Salt Lake City. I am a B2B SaaS founder, 18 months in, paying customers, ready to raise her first venture round. Specifically looking for angel groups and VCs.";
    const profile: FounderProfile = {
      stage: "start",
      industry: "Software and Information Technology",
      county: "Salt Lake",
      community: "Any",
      goal: message,
      mode: "chat"
    };

    const response = await runWizardTurn({
      settings: { provider: "mock", model: "basecamp-local-guide", thinkingLevel: "medium" },
      profile,
      message,
      resources: [
        fundingResource(
          "3386",
          "Startup Ignition Ventures",
          "Utah-based early stage pre-seed venture capital firm investing first checks into visionary startups with validated potential. Focuses on technology, software, and SaaS.",
          "https://startupignition.com/ventures"
        ),
        fundingResource(
          "2607",
          "Grix",
          "Utah VC resource for software and information technology founders.",
          "https://www.grix.vc/"
        ),
        formationResource(
          "basecamp-score-mentor",
          "SCORE find a mentor",
          "Direct SCORE mentoring path for matching with an experienced volunteer mentor to review a startup idea, launch plan, and first business decisions.",
          "https://www.score.org/ut/utah/mentors/"
        ),
        formationResource(
          "basecamp-sba-business-bank-account",
          "Startup State business bank account step",
          "Direct Startup State operations step for opening a business bank account once the founder has a legal business name, entity records, and tax ID.",
          "https://startup.utah.gov/business-operations/"
        )
      ]
    });

    const topIds = response.recommendations.slice(0, 3).map((item) => item.resource.id);

    expect(response.planCards[0]?.title).toContain("financials");
    expect(response.assistantMessage).toContain("capital-readiness plan");
    expect(response.assistantMessage).toContain("investor packet");
    expect(response.assistantMessage).not.toContain("business bank account");
    expect(response.assistantMessage).not.toContain("SCORE find a mentor");
    expect(topIds).not.toContain("basecamp-score-mentor");
    expect(topIds).not.toContain("basecamp-sba-business-bank-account");
    expect(topIds).toEqual(expect.arrayContaining(["3386"]));
  });

  it("adds funding guidance to grounded context for venture-round requests", () => {
    const message =
      "I have paying customers and need to raise a first venture round from angels and VCs.";
    const profile: FounderProfile = {
      stage: "start",
      industry: "Software and Information Technology",
      county: "Salt Lake",
      community: "Any",
      goal: message,
      mode: "chat"
    };
    const recommendations: Recommendation[] = [
      {
        score: 110,
        why: "Recommended because it matches funding.",
        citations: ["resource:vc"],
        resource: {
          id: "vc",
          slug: "vc",
          title: "Utah SaaS Venture Fund",
          description: "Venture funding for software companies.",
          communities: ["Any"],
          industries: ["Software and Information Technology"],
          locations: ["Salt Lake"],
          topics: ["Funding"],
          stages: ["fund"],
          link: "https://example.vc",
          freshness: { status: "seeded" }
        }
      }
    ];

    const context = buildGroundedContext(profile, message, recommendations);

    expect(context).toContain("Founder profile: stage=fund");
    expect(context).toContain("Funding guidance for this intent");
    expect(context).not.toContain("Formation guidance for this intent");
  });
});

describe("founder profile inference", () => {
  it("recognizes venture, angel, VC, and raising language as funding intent", () => {
    expect(
      inferStageFromText("ready to raise her first venture round with angel groups and VCs", "start")
    ).toBe("fund");
  });

  it("keeps pre-seed idea/no-business language in first-step mode", () => {
    expect(
      inferStageFromText(
        "Pre-seed founder with an idea but no business yet, looking for resources to take his first steps.",
        "start"
      )
    ).toBe("idea");
  });
});

describe("required Startup State persona routing", () => {
  it("serves all six judging personas with distinct grounded resource paths", async () => {
    resetDataCachesForTests();
    const resources = loadResources();
    const results = await Promise.all(
      requiredPersonas.map(async (persona) => ({
        persona,
        response: await runWizardTurn({
          settings: { provider: "mock", model: "basecamp-local-guide", thinkingLevel: "medium" },
          profile: { ...persona.profile, goal: persona.message },
          message: persona.message,
          resources
        })
      }))
    );

    const byId = new Map(results.map((result) => [result.persona.id, result.response]));

    const jordan = byId.get("Jordan")!;
    expect(jordan.assistantMessage).not.toContain("capital-readiness plan");
    expect(jordan.planCards[0]?.title).toContain("Clarify the problem");
    expect(topTitles(jordan)).toEqual(expect.arrayContaining(["Utah SBDC free consultation"]));
    expect(topTitles(jordan).join(" ")).not.toMatch(/Ventures|Venture|Angels/);

    const maria = byId.get("Maria")!;
    expect(topTitles(maria).join(" ")).toMatch(/Agriculture|Utah's Own|Utah Tech|Atwood|Rural Utah Chamber/);
    expect(topResourceText(maria)).toMatch(/Agriculture|Rural|Washington|Women|St George|Utah Tech/);

    const marcus = byId.get("Marcus")!;
    expect(marcus.assistantMessage).toMatch(/veteran/i);
    expect(topTitles(marcus).join(" ")).toMatch(/Veteran|VBRC|STRIVE/);
    expect(topTitles(marcus).join(" ")).not.toMatch(/Washington Area Chamber/);

    const priya = byId.get("Priya")!;
    expect(priya.assistantMessage).toContain("capital-readiness plan");
    expect(topTitles(priya).join(" ")).toMatch(/Angels|Startup Ignition|Kickstart|Grix|Peterson/);
    expect(topTitles(priya).join(" ")).toMatch(/Angels/);
    expect(priya.assistantMessage).not.toContain("business bank account");

    const david = byId.get("David")!;
    expect(david.planCards[0]?.title).toContain("export readiness");
    expect(topTitles(david).slice(0, 3).join(" ")).toMatch(/World Trade Center/);
    expect(topTitles(david).slice(0, 5).join(" ")).toMatch(/Commercial Service/);

    const amir = byId.get("Amir")!;
    expect(amir.assistantMessage).toContain("commercialization plan");
    expect(topTitles(amir).join(" ")).toMatch(/Lassonde|University of Utah|Innovation Fund|Altitude/);
  });
});

describe("custom Founder Wizard QA scenarios", () => {
  it("routes an Ogden food-truck founder to licensing and local startup setup, not capital", async () => {
    resetDataCachesForTests();
    const response = await runCustomFounderScenario({
      message:
        "I am opening a food truck in Ogden and need permits, licensing, registration, and someone local to call before I start selling.",
      profile: {
        stage: "start",
        industry: "Hospitality and Food Services",
        county: "Weber",
        community: "Any",
        goal: "",
        mode: "chat"
      }
    });

    expect(response.planCards[0]?.title).toContain("Choose a business name");
    expect(topIds(response).slice(0, 3)).toContain("basecamp-startup-state-registration");
    expect(response.assistantMessage).toContain("working startup plan");
    expect(topTitles(response).slice(0, 6).join(" ")).not.toMatch(/Angels|Venture|VC/);
    expect(response.assistantMessage).not.toContain("capital-readiness plan");
  });

  it("routes a growth-stage defense manufacturer toward contracts and workforce help", async () => {
    resetDataCachesForTests();
    const response = await runCustomFounderScenario({
      message:
        "We run an aerospace and defense parts manufacturer in Davis County with 35 employees. We need help winning government contracts and training workers for growth.",
      profile: {
        stage: "grow",
        industry: "Aerospace and Defense",
        county: "Davis",
        community: "Any",
        goal: "",
        mode: "chat"
      }
    });

    const titles = topTitles(response).join(" ");

    expect(response.planCards[0]?.title).toContain("growth bottleneck");
    expect(titles).toMatch(/APEX Accelerator/);
    expect(titles).toMatch(/Custom Fit Training|Talent Ready Utah|Apprenticeship Utah|Workforce/);
    expect(response.assistantMessage).not.toContain("business bank account");
  });

  it("keeps an inclusive Salt Lake childcare founder on formation plus community support", async () => {
    resetDataCachesForTests();
    const response = await runCustomFounderScenario({
      message:
        "I am a New American woman in Salt Lake City opening a childcare service. I need a business plan, licensing help, and mentorship.",
      profile: {
        stage: "start",
        industry: "Hospitality and Food Services",
        county: "Salt Lake",
        community: "New American",
        goal: "",
        mode: "chat"
      }
    });

    const resourceText = topResourceText(response);

    expect(response.planCards[0]?.title).toContain("Choose a business name");
    expect(topIds(response).slice(0, 5)).toContain("basecamp-startup-state-registration");
    expect(topTitles(response).slice(1, 4).join(" ")).toMatch(
      /Women's Business Center|Suazo|Hispanic/
    );
    expect(topTitles(response).slice(0, 5).join(" ")).toMatch(
      /Women's Business Center|Suazo|Hispanic|Asian|Black|Pacific Island|LiaLaunch|Bolder/
    );
    expect(resourceText).toMatch(/Suazo|Hispanic|New American|Multicultural|Women|SBDC|SCORE/);
    expect(response.assistantMessage).not.toContain("capital-readiness plan");
  });

  it("routes a Moab owner closing or selling a business to exit obligations", async () => {
    resetDataCachesForTests();
    const response = await runCustomFounderScenario({
      message:
        "I need to close or sell my small retail business in Moab and understand tax, licensing, and employee obligations.",
      profile: {
        stage: "exit",
        industry: "Consumer Packaged Goods",
        county: "Grand",
        community: "Any",
        goal: "",
        mode: "chat"
      }
    });

    expect(response.planCards[0]?.title).toContain("sale, succession, closure");
    expect(response.assistantMessage).toContain("working founder plan");
    expect(topResourceText(response)).toMatch(/Close or Exit a Business|tax|licens|advisor|agency/i);
    expect(response.assistantMessage).not.toContain("capital-readiness plan");
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
    topics: ["Start a Business", "Registration", "EIN", "Bank Account"],
    stages: ["start"],
    link,
    freshness: { status: "reviewed" }
  };
}

function fundingResource(id: string, title: string, description: string, link: string): Resource {
  return {
    id,
    slug: id,
    title,
    description,
    communities: [],
    industries: ["Software and Information Technology"],
    locations: ["Salt Lake", "Utah"],
    topics: ["Funding"],
    stages: ["fund"],
    link,
    freshness: { status: "reviewed" }
  };
}

const requiredPersonas: Array<{
  id: string;
  message: string;
  profile: FounderProfile;
}> = [
  {
    id: "Jordan",
    message:
      "Jordan is 20 in Salt Lake City. He is a pre-seed founder with an idea but no business yet, looking for resources to take his first steps.",
    profile: {
      stage: "idea",
      industry: "Software and Information Technology",
      county: "Salt Lake",
      community: "Any",
      goal: "",
      mode: "chat"
    }
  },
  {
    id: "Maria",
    message:
      "Maria is 38 in Washington County near St. George. She runs a small agricultural operation, is rural and woman-owned, and is looking to scale.",
    profile: {
      stage: "grow",
      industry: "Agriculture",
      county: "Washington",
      community: "Women",
      goal: "",
      mode: "chat"
    }
  },
  {
    id: "Marcus",
    message:
      "Marcus is 34 in Ogden in Weber County. He left the military and is starting a custom fabrication and manufacturing business. He is a veteran and early-stage.",
    profile: {
      stage: "start",
      industry: "Manufacturing",
      county: "Weber",
      community: "Veteran",
      goal: "",
      mode: "chat"
    }
  },
  {
    id: "Priya",
    message:
      "Priya is 31 in Salt Lake City. She is a B2B SaaS founder, 18 months in with paying customers, ready to raise her first venture round. She is specifically looking for angel groups and VCs.",
    profile: {
      stage: "fund",
      industry: "Software and Information Technology",
      county: "Salt Lake",
      community: "Any",
      goal: "",
      mode: "chat"
    }
  },
  {
    id: "David",
    message:
      "David is 45 in Provo in Utah County. He runs a medical device company with 12 employees and FDA clearance, and he wants to expand into international markets. He is growth stage and established.",
    profile: {
      stage: "grow",
      industry: "Life Sciences and Healthcare",
      county: "Utah",
      community: "Any",
      goal: "",
      mode: "chat"
    }
  },
  {
    id: "Amir",
    message:
      "Dr. Amir is 29 in Salt Lake City. He is a PhD candidate at the University of Utah developing a novel technology. He wants to commercialize his research and found a company, and he has never started a business before.",
    profile: {
      stage: "start",
      industry: "Software and Information Technology",
      county: "Salt Lake",
      community: "Student",
      goal: "",
      mode: "chat"
    }
  }
];

function topTitles(response: Awaited<ReturnType<typeof runWizardTurn>>) {
  return response.recommendations.slice(0, 7).map((item) => item.resource.title);
}

function topIds(response: Awaited<ReturnType<typeof runWizardTurn>>) {
  return response.recommendations.slice(0, 7).map((item) => item.resource.id);
}

function topResourceText(response: Awaited<ReturnType<typeof runWizardTurn>>) {
  return response.recommendations
    .slice(0, 7)
    .map((item) =>
      [
        item.resource.title,
        item.resource.description,
        ...item.resource.topics,
        ...item.resource.communities,
        ...item.resource.locations,
        ...item.resource.industries
      ].join(" ")
    )
    .join(" ");
}

function runCustomFounderScenario({
  message,
  profile
}: {
  message: string;
  profile: FounderProfile;
}) {
  return runWizardTurn({
    settings: { provider: "mock", model: "basecamp-local-guide", thinkingLevel: "medium" },
    profile: { ...profile, goal: message },
    message,
    resources: loadResources()
  });
}
