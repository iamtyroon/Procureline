"use node";

import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { buildBlockedOriginEvent } from "../../lib/shared/security/audit";
import { resolveSecurityAuditProxyToken } from "../../lib/backend/security/bridge";

export const logBlockedOriginFromProxy = action({
    args: {
        allowedOrigins: v.array(v.string()),
        method: v.string(),
        origin: v.optional(v.string()),
        path: v.string(),
        proxyAuditToken: v.string(),
        requestOrigin: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        if (args.proxyAuditToken !== resolveSecurityAuditProxyToken()) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Invalid security audit token",
            });
        }

        const entry = buildBlockedOriginEvent({
            allowedOrigins: args.allowedOrigins,
            method: args.method,
            origin: args.origin,
            path: args.path,
            requestOrigin: args.requestOrigin,
        });

        await ctx.runMutation(internal.functions.auditLogs.appendAuditLogFromAction, {
            action: entry.action,
            actorRole: entry.actor.role,
            actorState: entry.actor.state,
            entityType: entry.entityType,
            event: entry.event,
            metadata: entry.metadata,
            outcome: entry.outcome,
            timestamp: entry.timestamp,
        });

        return null;
    },
});
