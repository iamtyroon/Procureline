import { NextResponse } from "next/server";
import {
  buildProcurelineServiceHeaders,
  createProcurelineServiceToken,
  resolveNestjsUrl,
} from "@/lib/services/procureline-service-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: {
          code: "LOCAL_EXPORT_DISABLED",
          message: "Local consolidated export is disabled in production.",
        },
        success: false,
      },
      { status: 404 },
    );
  }

  const body = await request.json();
  const actor = body?.actor;
  const token = await createProcurelineServiceToken({
    role: "procurement_officer",
    tenantId: typeof actor?.tenantId === "string" ? actor.tenantId : undefined,
    userId: typeof actor?.userId === "string" ? actor.userId : "local-dev-user",
  });

  const nestjsUrl = resolveNestjsUrl({
    url: process.env.LOCAL_NESTJS_URL ?? "http://127.0.0.1:4001",
  });
  const response = await fetch(`${nestjsUrl}/api/services/files/exports/consolidated-plan`, {
    body: JSON.stringify(body?.exportRequest ?? body),
    headers: buildProcurelineServiceHeaders(token),
    method: "POST",
  });
  const result = await response.json();

  return NextResponse.json(result, { status: response.status });
}
