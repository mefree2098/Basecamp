import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  website: z.string().optional(),
  workEmail: z.string().email().or(z.literal("")).optional(),
  sector: z.string().optional(),
  stage: z.string().optional(),
  employees: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  hiringStatus: z.string().optional()
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Company name and valid email are required." }, { status: 400 });
  }

  const id = `draft_${randomUUID()}`;
  const storageDir = path.resolve(
    process.cwd(),
    process.env.BASECAMP_STORAGE_DIR ?? ".basecamp-data",
    "company-drafts"
  );
  fs.mkdirSync(storageDir, { recursive: true });
  fs.writeFileSync(
    path.join(storageDir, `${id}.json`),
    JSON.stringify(
      {
        id,
        status: "queued",
        verificationStatus: parsed.data.workEmail ? "pending_email" : "needs_contact",
        submittedAt: new Date().toISOString(),
        payload: parsed.data
      },
      null,
      2
    )
  );
  return NextResponse.json({ id, reviewStatus: "queued", verificationStatus: "pending_email" });
}
