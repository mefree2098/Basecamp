import { NextResponse } from "next/server";
import { readRuntimeHealth } from "@/lib/runtimeHealth";

export const dynamic = "force-dynamic";

export function GET() {
  const health = readRuntimeHealth();
  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export function HEAD() {
  const health = readRuntimeHealth();
  return new Response(null, {
    status: health.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
