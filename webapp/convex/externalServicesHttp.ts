import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { resolveProcurelineConvexSyncSecret } from "../lib/services/procureline-service-auth";

interface ClaimCommandBody {
  actor?: {
    role?: string;
    tenantId?: string;
    userId?: string;
  };
  command: "claim";
  eventKey: string;
  eventType: string;
  metadata?: Record<string, unknown>;
  payloadHash: string;
  provider: string;
}

interface CompleteCommandBody {
  command: "complete";
  durableChanges: Record<string, unknown>[];
  eventKey: string;
  result: Record<string, unknown>;
}

interface FailCommandBody {
  command: "fail";
  durableChanges?: Record<string, unknown>[];
  error: {
    code: string;
    message: string;
  };
  eventKey: string;
}

type SyncCommandBody = ClaimCommandBody | CompleteCommandBody | FailCommandBody;

function unauthorizedResponse(): Response {
  return Response.json(
    {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid Procureline sync secret",
      },
    },
    { status: 401 },
  );
}

/**
 * Constant-time string comparison to prevent timing-side-channel attacks.
 * Works in any JS runtime (including Convex) without requiring Node.js crypto.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const handleExternalServiceSync = httpAction(async (ctx, request) => {
  const providedSecret = request.headers.get("x-procureline-sync-secret") ?? "";
  const expectedSecret = resolveProcurelineConvexSyncSecret();

  if (!constantTimeEqual(providedSecret, expectedSecret)) {
    return unauthorizedResponse();
  }

  const body = (await request.json()) as SyncCommandBody;
  if (body.command === "claim") {
    const result = await ctx.runMutation(internal.functions.externalServices.claimSyncEvent, {
      actorRole: body.actor?.role,
      actorTenantId: body.actor?.tenantId as Id<"tenants"> | undefined,
      actorUserId: body.actor?.userId as Id<"users"> | undefined,
      eventKey: body.eventKey,
      eventType: body.eventType,
      metadata: body.metadata ?? {},
      payloadHash: body.payloadHash,
      provider: body.provider,
    });

    return Response.json({
      success: true,
      data: result,
    });
  }

  if (body.command === "complete") {
    const result = await ctx.runMutation(internal.functions.externalServices.completeSyncEvent, {
      durableChanges: body.durableChanges,
      eventKey: body.eventKey,
      result: body.result,
    });

    return Response.json({
      success: true,
      data: result,
    });
  }

  const result = await ctx.runMutation(internal.functions.externalServices.failSyncEvent, {
    durableChanges: body.durableChanges,
    error: body.error,
    eventKey: body.eventKey,
  });

  return Response.json({
    success: true,
    data: result,
  });
});
