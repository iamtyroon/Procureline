"use node";

import { ConvexError } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
  createAuthenticatedAuditActor,
} from "../../lib/shared/security/audit";
import {
  createNestServiceRequest,
} from "../../lib/services/external-service-client";
import {
  createProcurelineServiceToken,
  type ProcurelineServiceRole,
} from "../../lib/services/procureline-service-auth";

export interface ServiceActorContext {
  role: ProcurelineServiceRole;
  tenantId?: string;
  userId: string;
}

async function appendServiceBridgeFailureAudit(
  ctx: ActionCtx,
  actor: ServiceActorContext,
  message: string,
  path: string,
): Promise<void> {
  await ctx.runMutation(internal.functions.auditLogs.appendAuditLogFromAction, {
    action: "service_call",
    actorRole: actor.role,
    actorState: createAuthenticatedAuditActor({
      role: actor.role,
      userId: actor.userId,
    }).state,
    actorUserId: actor.userId as Id<"users">,
    entityType: "external_service",
    event: "external_service.call_failed",
    metadata: {
      message,
      path,
      tenantId: actor.tenantId,
    },
    outcome: "failed",
    timestamp: Date.now(),
  });
}

export async function getServiceActorContext(ctx: ActionCtx): Promise<ServiceActorContext> {
  const authContext = await ctx.runQuery(api.functions.users.getAuthContext, {});

  if (!authContext || !authContext.isSessionValid) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to call the external services bridge",
    });
  }

  if (authContext.accessState !== "allowed" || !authContext.isRoleResolved) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "You do not have an active application role",
    });
  }

  return {
    role: authContext.role,
    tenantId: authContext.tenantId ? String(authContext.tenantId) : undefined,
    userId: String(authContext.userId),
  };
}

export async function callNestService<TResponse>(
  ctx: ActionCtx,
  args: {
    actor: ServiceActorContext;
    body?: unknown;
    path: string;
  },
): Promise<TResponse> {
  const token = await createProcurelineServiceToken({
    role: args.actor.role,
    tenantId: args.actor.tenantId,
    userId: args.actor.userId,
  });
  const request = createNestServiceRequest({
    body: args.body,
    path: args.path,
    token,
  });

  let response: Response;
  try {
    response = await fetch(request.url, request.init);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "NestJS service is unreachable";
    await appendServiceBridgeFailureAudit(ctx, args.actor, message, args.path).catch(
      () => undefined,
    );

    throw new ConvexError({
      code: "SERVICE_UNAVAILABLE",
      message,
    });
  }

  let result: { success: true; data: TResponse } | { success: false; error: { code: string; message: string } };

  try {
    result = (await response.json()) as typeof result;
  } catch {
    result = {
      success: false,
      error: {
        code: "SERVICE_PARSING_FAILED",
        message: `Failed to parse response from NestJS service at ${args.path}. HTTP Status: ${response.status}`,
      },
    };
  }

  if (!response.ok || !result.success) {
    const code = result.success ? "SERVICE_CALL_FAILED" : result.error.code;
    const message = result.success ? "NestJS service call failed" : result.error.message;
    await appendServiceBridgeFailureAudit(ctx, args.actor, message, args.path).catch(
      () => undefined,
    );

    throw new ConvexError({
      code,
      message,
    });
  }

  return result.data;
}
