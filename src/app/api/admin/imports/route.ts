import { NextResponse } from "next/server";
import { z } from "zod";
import { writeImportedCsv } from "@/lib/data";

const schema = z.object({
  kind: z.enum(["resources", "companies"]),
  csv: z.string().min(5)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A dataset kind and CSV body are required." }, { status: 400 });
  }
  try {
    return NextResponse.json(writeImportedCsv(parsed.data.kind, parsed.data.csv));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import CSV." },
      { status: 400 }
    );
  }
}
