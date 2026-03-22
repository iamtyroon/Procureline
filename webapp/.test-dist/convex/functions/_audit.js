"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendAuditLogRequired = exports.appendAuditLogBestEffort = exports.appendAuditLogEntry = exports.deserializeAuditEvent = void 0;
const values_1 = require("convex/values");
function assertAuthenticatedActor(actor) {
    if (actor.state === "authenticated" && !actor.userId) {
        throw new Error("Authenticated audit entries require an actor user ID");
    }
}
function deserializeAuditEvent(entry) {
    return {
        action: entry.action,
        actor: {
            role: entry.actorRole,
            state: entry.actorState,
            userId: entry.actorUserId,
        },
        entityType: entry.entityType,
        event: entry.event,
        metadata: entry.metadata,
        outcome: entry.outcome,
        recordId: entry.recordId,
        sourceTenantId: entry.sourceTenantId,
        tableName: entry.tableName,
        targetTenantId: entry.targetTenantId,
        timestamp: entry.timestamp,
    };
}
exports.deserializeAuditEvent = deserializeAuditEvent;
async function appendAuditLogEntry(ctx, entry) {
    assertAuthenticatedActor(entry.actor);
    await ctx.db.insert("auditLogs", {
        action: entry.action,
        actorRole: entry.actor.role,
        actorState: entry.actor.state,
        actorUserId: entry.actor.userId,
        entityType: entry.entityType,
        event: entry.event,
        metadata: entry.metadata ?? {},
        outcome: entry.outcome,
        recordId: entry.recordId,
        sourceTenantId: entry.sourceTenantId,
        tableName: entry.tableName,
        targetTenantId: entry.targetTenantId,
        timestamp: entry.timestamp,
    });
}
exports.appendAuditLogEntry = appendAuditLogEntry;
async function appendAuditLogBestEffort(ctx, entry) {
    try {
        await appendAuditLogEntry(ctx, entry);
    }
    catch {
        // Deny-path audit logging remains best effort as long as the caller
        // still fails closed.
    }
}
exports.appendAuditLogBestEffort = appendAuditLogBestEffort;
async function appendAuditLogRequired(ctx, entry) {
    try {
        await appendAuditLogEntry(ctx, entry);
    }
    catch {
        throw new values_1.ConvexError({
            code: "AUDIT_LOG_FAILED",
            message: "The requested operation could not complete because the audit log could not be written",
        });
    }
}
exports.appendAuditLogRequired = appendAuditLogRequired;
