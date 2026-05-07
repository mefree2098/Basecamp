import { NextResponse } from "next/server";
import { z } from "zod";
import { completeCodexLogin } from "@/lib/codex/appServer";

const schema = z.object({
  loginId: z.string().optional(),
  callbackUrl: z.string().trim().url(),
  codexPath: z.string().optional(),
  codexHome: z.string().optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid callback payload." }, { status: 400 });
  }
  try {
    return NextResponse.json(await completeCodexLogin(parsed.data));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to complete Codex login." },
      { status: 400 }
    );
  }
}
