"use node";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callNestService = exports.getServiceActorContext = void 0;
const values_1 = require("convex/values");
const api_1 = require("../_generated/api");
const audit_1 = require("../../lib/security/audit");
const external_service_client_1 = require("../../lib/services/external-service-client");
const procureline_service_auth_1 = require("../../lib/services/procureline-service-auth");
async function appendServiceBridgeFailureAudit(ctx, actor, message, path) {
    await ctx.runMutation(api_1.internal.functions.auditLogs.appendAuditLogFromAction, {
        action: "service_call",
        actorRole: actor.role,
        actorState: (0, audit_1.createAuthenticatedAuditActor)({
            role: actor.role,
            userId: actor.userId,
        }).state,
        actorUserId: actor.userId,
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
async function getServiceActorContext(ctx) {
    const authContext = await ctx.runQuery(api_1.api.functions.users.getAuthContext, {});
    if (!authContext || !authContext.isSessionValid) {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "You must be signed in to call the external services bridge",
        });
    }
    if (authContext.accessState !== "allowed" || !authContext.isRoleResolved) {
        throw new values_1.ConvexError({
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
exports.getServiceActorContext = getServiceActorContext;
async function callNestService(ctx, args) {
    const token = await (0, procureline_service_auth_1.createProcurelineServiceToken)({
        role: args.actor.role,
        tenantId: args.actor.tenantId,
        userId: args.actor.userId,
    });
    const request = (0, external_service_client_1.createNestServiceRequest)({
        body: args.body,
        path: args.path,
        token,
    });
    let response;
    try {
        response = await fetch(request.url, request.init);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "NestJS service is unreachable";
        await appendServiceBridgeFailureAudit(ctx, args.actor, message, args.path).catch(() => undefined);
        throw new values_1.ConvexError({
            code: "SERVICE_UNAVAILABLE",
            message,
        });
    }
    let result;
    try {
        result = (await response.json());
    }
    catch {
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
        await appendServiceBridgeFailureAudit(ctx, args.actor, message, args.path).catch(() => undefined);
        throw new values_1.ConvexError({
            code,
            message,
        });
    }
    return result.data;
}
exports.callNestService = callNestService;
