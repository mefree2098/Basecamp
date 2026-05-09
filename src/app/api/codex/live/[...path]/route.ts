import { NextResponse } from "next/server";
import {
  authorizeBasecampLiveRequest,
  readBasecampDeployStatus,
  readBasecampLiveOverview,
  readBasecampLogs,
  restartBasecampService,
  startBasecampDeploy,
  updateBasecampRuntimeEnv
} from "@/lib/liveControl";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

export async function GET(request: Request, context: RouteContext) {
  const authorization = authorizeBasecampLiveRequest(request);
  if (!authorization.ok) {
    return NextResponse.json(authorization.body, { status: authorization.status });
  }

  const action = await actionFromContext(context);
  const url = new URL(request.url);

  if (action === "overview" || action === "status") {
    return NextResponse.json(readBasecampLiveOverview());
  }

  if (action === "deploy-status") {
    return NextResponse.json(readBasecampDeployStatus());
  }

  if (action === "logs") {
    return NextResponse.json(
      readBasecampLogs({
        lines: Number(url.searchParams.get("lines") ?? "120"),
        unit: url.searchParams.get("unit") ?? undefined
      })
    );
  }

  return NextResponse.json({ error: `Unsupported Basecamp live action: ${action}` }, { status: 404 });
}

export async function POST(request: Request, context: RouteContext) {
  const authorization = authorizeBasecampLiveRequest(request);
  if (!authorization.ok) {
    return NextResponse.json(authorization.body, { status: authorization.status });
  }

  const action = await actionFromContext(context);
  const url = new URL(request.url);
  const body = await readJsonBody(request);
  const confirm = url.searchParams.get("confirm") || body?.confirm;

  if (action === "deploy-run") {
    const result = startBasecampDeploy(confirm);
    return NextResponse.json(result.body, { status: result.status });
  }

  if (action === "services-restart") {
    const result = restartBasecampService(confirm);
    return NextResponse.json(result.body, { status: result.status });
  }

  if (action === "env-update") {
    const result = updateBasecampRuntimeEnv(confirm, body?.updates);
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.json({ error: `Unsupported Basecamp live action: ${action}` }, { status: 404 });
}

async function actionFromContext(context: RouteContext) {
  const params = await context.params;
  return params.path?.join("/") || "overview";
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as { confirm?: string; updates?: Record<string, unknown> };
  } catch {
    return null;
  }
}
