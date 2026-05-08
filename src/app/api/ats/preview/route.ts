import { NextResponse } from "next/server";
import { ingestJobsFromUrl } from "@/lib/jobIngestion";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const url = typeof (body as { url?: unknown }).url === "string" ? (body as { url: string }).url : "";
  try {
    const jobs = await ingestJobsFromUrl(url);
    return NextResponse.json({ jobs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import jobs." },
      { status: 400 }
    );
  }
}
