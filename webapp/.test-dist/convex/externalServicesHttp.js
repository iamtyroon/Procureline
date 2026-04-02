"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleReminderDispatchClaim = exports.handleExternalServiceSync = void 0;
const server_1 = require("./_generated/server");
const api_1 = require("./_generated/api");
const procureline_service_auth_1 = require("../lib/services/procureline-service-auth");
function unauthorizedResponse() {
    return Response.json({
        success: false,
        error: {
            code: "UNAUTHORIZED",
            message: "Invalid Procureline sync secret",
        },
    }, { status: 401 });
}
/**
 * Constant-time string comparison to prevent timing-side-channel attacks.
 * Works in any JS runtime (including Convex) without requiring Node.js crypto.
 */
function constantTimeEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}
function isAuthorizedExternalServiceRequest(request) {
    const providedSecret = request.headers.get("x-procureline-sync-secret") ?? "";
    const expectedSecret = (0, procureline_service_auth_1.resolveProcurelineConvexSyncSecret)();
    return constantTimeEqual(providedSecret, expectedSecret);
}
exports.handleExternalServiceSync = (0, server_1.httpAction)(async (ctx, request) => {
    if (!isAuthorizedExternalServiceRequest(request)) {
        return unauthorizedResponse();
    }
    const body = (await request.json());
    if (body.command === "claim") {
        const result = await ctx.runMutation(api_1.internal.functions.externalServices.claimSyncEvent, {
            actorRole: body.actor?.role,
            actorTenantId: body.actor?.tenantId,
            actorUserId: body.actor?.userId,
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
        const result = await ctx.runMutation(api_1.internal.functions.externalServices.completeSyncEvent, {
            durableChanges: body.durableChanges,
            eventKey: body.eventKey,
            result: body.result,
        });
        return Response.json({
            success: true,
            data: result,
        });
    }
    const result = await ctx.runMutation(api_1.internal.functions.externalServices.failSyncEvent, {
        durableChanges: body.durableChanges,
        error: body.error,
        eventKey: body.eventKey,
    });
    return Response.json({
        success: true,
        data: result,
    });
});
exports.handleReminderDispatchClaim = (0, server_1.httpAction)(async (ctx, request) => {
    if (!isAuthorizedExternalServiceRequest(request)) {
        return unauthorizedResponse();
    }
    const body = (await request.json());
    const result = await ctx.runMutation("functions/deadlines:claimReminderJobDispatch", {
        reminderJobId: body.reminderJobId,
    });
    return Response.json({
        success: true,
        data: result,
    });
});
