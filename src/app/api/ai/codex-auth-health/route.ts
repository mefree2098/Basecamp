import { NextResponse } from "next/server";
import { readCodexAuthHealth } from "@/lib/codex/appServer";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    return NextResponse.json(
      await readCodexAuthHealth({
        provider: "codexPath",
        model: "gpt-5.5",
        thinkingLevel: "medium",
        codexPath: url.searchParams.get("codexPath") || undefined,
        codexHome: url.searchParams.get("codexHome") || undefined
      })
    );
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      loginRequired: true,
      error: error instanceof Error ? error.message : "Unable to read Codex auth."
    });
  }
}
