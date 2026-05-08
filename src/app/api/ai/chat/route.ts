import { NextResponse } from "next/server";
import { z } from "zod";
import { runWizardTurn } from "@/lib/ai";
import { loadResources } from "@/lib/data";

const requestSchema = z.object({
  settings: z.object({
    provider: z.enum(["mock", "openai", "codexPath", "anthropic", "gemini"]).default("mock"),
    apiKey: z.string().optional(),
    model: z.string().default("basecamp-local-guide"),
    thinkingLevel: z.enum(["none", "low", "medium", "high", "xhigh"]).default("medium"),
    codexPath: z.string().optional(),
    codexHome: z.string().optional(),
    codexHomeProfile: z.enum(["auto", "azure", "aws", "local", "custom"]).optional(),
    codexAwsVolumeRoot: z.string().optional()
  }),
  profile: z.object({
    stage: z.enum(["idea", "validate", "start", "grow", "fund", "exit"]),
    industry: z.string(),
    county: z.string(),
    community: z.string(),
    goal: z.string(),
    mode: z.enum(["chat", "guided", "manual"])
  }),
  message: z.string().default(""),
  sessionContext: z
    .object({
      sessionId: z.string().optional(),
      completedSteps: z.array(z.string()).optional(),
      currentPlanCards: z
        .array(
          z.object({
            title: z.string(),
            dueWindow: z.enum(["today", "7_days", "30_days", "90_days"]),
            status: z.enum(["suggested", "saved", "done"])
          })
        )
        .optional(),
      previousAssistantMessage: z.string().optional(),
      history: z
        .array(
          z.object({
            userMessage: z.string(),
            assistantMessage: z.string(),
            completedSteps: z.array(z.string()).optional()
          })
        )
        .optional()
    })
    .optional()
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const result = await runWizardTurn({
    ...parsed.data,
    resources: loadResources()
  });
  return NextResponse.json(redactSecrets(result));
}

function redactSecrets<T>(value: T) {
  return value;
}
