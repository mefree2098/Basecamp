import { NextResponse } from "next/server";
import { z } from "zod";
import {
  readAdminIntegrationSettings,
  updateIntegrationSettings
} from "@/lib/integrationSettings";

export const dynamic = "force-dynamic";

const schema = z.object({
  googleMaps: z
    .object({
      browserApiKey: z.string().optional(),
      geocodingApiKey: z.string().optional(),
      mapId: z.string().optional(),
      techMapId: z.string().optional(),
      clearBrowserApiKey: z.boolean().optional(),
      clearGeocodingApiKey: z.boolean().optional()
    })
    .optional()
});

export function GET() {
  return NextResponse.json(readAdminIntegrationSettings());
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(updateIntegrationSettings(parsed.data));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save integration settings." },
      { status: 500 }
    );
  }
}
