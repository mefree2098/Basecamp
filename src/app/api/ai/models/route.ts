import { NextResponse } from "next/server";
import { z } from "zod";
import { listModels } from "@/lib/ai";
import { modelFallbacks } from "@/lib/site-context";

const schema = z.object({
  provider: z.enum(["mock", "openai", "codexPath", "anthropic", "gemini"]).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  thinkingLevel: z.enum(["none", "low", "medium", "high", "xhigh"]).optional(),
  codexPath: z.string().optional(),
  codexHome: z.string().optional(),
  codexHomeProfile: z.enum(["auto", "azure", "aws", "local", "custom"]).optional(),
  codexAwsVolumeRoot: z.string().optional()
});

export function GET() {
  return NextResponse.json({ models: modelFallbacks });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ models: modelFallbacks, error: "Invalid settings." }, { status: 400 });
  }

  try {
    return NextResponse.json({ models: await listModels(parsed.data) });
  } catch (error) {
    return NextResponse.json({
      models: modelFallbacks,
      error: error instanceof Error ? error.message : "Unable to list models."
    });
  }
}
