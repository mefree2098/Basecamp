import { NextResponse } from "next/server";
import { z } from "zod";
import { importPublicCompanies, previewPublicCompanyImport } from "@/lib/publicBusinessSources";

const importSchema = z.object({
  limit: z.number().int().positive().max(5000).optional()
});

export async function GET() {
  try {
    return NextResponse.json(await previewPublicCompanyImport());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to inspect public business source." },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Import limit must be a positive integer no larger than 5000." }, { status: 400 });
  }

  try {
    return NextResponse.json(await importPublicCompanies(parsed.data.limit));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import public business data." },
      { status: 502 }
    );
  }
}
