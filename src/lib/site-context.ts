import type { FounderStage, ModelOption } from "./types";

export const sourceLinks = [
  {
    label: "AI Builder Day brief",
    href: "https://startupstate.netlify.app/?utm_source=luma"
  },
  {
    label: "Startup State live site",
    href: "https://startup.utah.gov/"
  },
  {
    label: "Resource spreadsheet",
    href: "https://docs.google.com/spreadsheets/d/1AdfJ9TDWdICQuzoYQn-6cBmUkOVXWD8mTqJNDnuKD-E/edit?usp=sharing"
  },
  {
    label: "Map data spreadsheet",
    href: "https://docs.google.com/spreadsheets/d/1D9CUtXpyPubOkt51wD9SDCpglkQv6W6oa33iTs73cCk/edit?usp=sharing"
  },
  {
    label: "Reference startup map",
    href: "https://www.pampam.city/utah-startup-map-rtqSlvDvpOKV8Y5VrdZN"
  }
];

export const journeySteps: Array<{
  stage: FounderStage;
  label: string;
  description: string;
}> = [
  {
    stage: "idea",
    label: "Find your big idea",
    description: "Clarify the problem, audience, and first useful version."
  },
  {
    stage: "validate",
    label: "Business validation",
    description: "Test demand before committing time and capital."
  },
  {
    stage: "start",
    label: "Registration and licensure",
    description: "Set up the entity, permits, tax basics, and operating rhythm."
  },
  {
    stage: "fund",
    label: "Obtain funding",
    description: "Compare grants, lenders, pitch programs, and early capital."
  },
  {
    stage: "grow",
    label: "Workforce and talent acquisition",
    description: "Find talent, operations support, export help, and growth programs."
  },
  {
    stage: "exit",
    label: "Sell or exit",
    description: "Prepare for transition, closeout, or succession."
  }
];

export const modelFallbacks: ModelOption[] = [
  {
    provider: "mock",
    id: "basecamp-local-guide",
    label: "Basecamp local guide",
    supportsThinking: true,
    costHint: "local"
  },
  {
    provider: "openai",
    id: "gpt-5.2",
    label: "GPT-5.2",
    supportsThinking: true,
    costHint: "medium"
  },
  {
    provider: "openai",
    id: "gpt-5.1-mini",
    label: "GPT-5.1 mini",
    supportsThinking: true,
    costHint: "low"
  },
  {
    provider: "codexPath",
    id: "gpt-5.5",
    label: "GPT-5.5",
    supportsThinking: true,
    costHint: "unknown"
  },
  {
    provider: "codexPath",
    id: "gpt-5.4",
    label: "GPT-5.4",
    supportsThinking: true,
    costHint: "unknown"
  },
  {
    provider: "codexPath",
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    supportsThinking: true,
    costHint: "unknown"
  },
  {
    provider: "anthropic",
    id: "claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    supportsThinking: true,
    costHint: "medium"
  },
  {
    provider: "anthropic",
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    supportsThinking: true,
    costHint: "low"
  },
  {
    provider: "gemini",
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    supportsThinking: true,
    costHint: "medium"
  },
  {
    provider: "gemini",
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    supportsThinking: true,
    costHint: "low"
  }
];

export const stageLabels: Record<FounderStage, string> = {
  idea: "Idea",
  validate: "Validate",
  start: "Start",
  grow: "Grow",
  fund: "Fund",
  exit: "Exit"
};
