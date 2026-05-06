"use node";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logBlockedOriginFromProxy = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const api_1 = require("../_generated/api");
const audit_1 = require("../../lib/shared/security/audit");
const bridge_1 = require("../../lib/backend/security/bridge");
exports.logBlockedOriginFromProxy = (0, server_1.action)({
    args: {
        allowedOrigins: values_1.v.array(values_1.v.string()),
        method: values_1.v.string(),
        origin: values_1.v.optional(values_1.v.string()),
        path: values_1.v.string(),
        proxyAuditToken: values_1.v.string(),
        requestOrigin: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        if (args.proxyAuditToken !== (0, bridge_1.resolveSecurityAuditProxyToken)()) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Invalid security audit token",
            });
        }
        const entry = (0, audit_1.buildBlockedOriginEvent)({
            allowedOrigins: args.allowedOrigins,
            method: args.method,
            origin: args.origin,
            path: args.path,
            requestOrigin: args.requestOrigin,
        });
        await ctx.runMutation(api_1.internal.functions.auditLogs.appendAuditLogFromAction, {
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
