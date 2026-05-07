import { NextResponse } from "next/server";
import { listCodexModels, startCodexLogin } from "@/lib/codex/appServer";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const settings = {
    provider: "codexPath" as const,
    model: "gpt-5.5",
    thinkingLevel: "medium" as const,
    codexPath: url.searchParams.get("codexPath") || undefined,
    codexHome: url.searchParams.get("codexHome") || undefined
  };

  try {
    if (url.searchParams.get("startLogin") === "1") {
      return NextResponse.json({
        source: "codex",
        includeHidden: false,
        models: [],
        ...(await startCodexLogin(settings))
      });
    }
    const models = await listCodexModels(settings);
    return NextResponse.json({
      source: "codex",
      includeHidden: false,
      loginRequired: false,
      models
    });
  } catch (error) {
    return NextResponse.json(
      {
        source: "codex",
        includeHidden: false,
        loginRequired: true,
        models: [],
        error: error instanceof Error ? error.message : "Unable to list Codex models."
      },
      { status: 200 }
    );
  }
}
