import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getFounderUser,
  listFounderSessions,
  updateFounderSessionProgress,
  upsertFounderSession
} from "@/lib/sessionStore";

const stageSchema = z.enum(["idea", "validate", "start", "grow", "fund", "exit"]);
const planCardSchema = z.object({
  title: z.string(),
  dueWindow: z.enum(["today", "7_days", "30_days", "90_days"]),
  status: z.enum(["suggested", "saved", "done"])
});
const profileSchema = z.object({
  stage: stageSchema,
  industry: z.string(),
  county: z.string(),
  community: z.string(),
  goal: z.string(),
  mode: z.enum(["chat", "guided", "manual"])
});

const saveTurnSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().optional(),
  profile: profileSchema,
  userMessage: z.string(),
  assistantMessage: z.string(),
  usedProvider: z.string(),
  planCards: z.array(planCardSchema),
  completedSteps: z.array(z.string()).default([]),
  recommendationIds: z.array(z.string()).default([])
});

const progressSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  completedSteps: z.array(z.string()).default([])
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "";
  if (!userId || !getFounderUser(userId)) {
    return NextResponse.json({ sessions: [] });
  }
  return NextResponse.json({ sessions: listFounderSessions(userId).slice(0, 8) });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const parsed = saveTurnSchema.safeParse(body);
  if (!parsed.success || !getFounderUser(parsed.data.userId)) {
    return NextResponse.json(
      { error: "A registered user and valid session payload are required." },
      { status: 400 }
    );
  }

  const session = upsertFounderSession(parsed.data);
  return NextResponse.json({ session });
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const parsed = progressSchema.safeParse(body);
  if (!parsed.success || !getFounderUser(parsed.data.userId)) {
    return NextResponse.json({ error: "A registered user and valid session are required." }, { status: 400 });
  }

  const session = updateFounderSessionProgress(parsed.data);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  return NextResponse.json({ session });
}
