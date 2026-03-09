import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type {
    AuditActor,
    AuditEventEntry,
    SerializedAuditEventEntry,
} from "../../lib/security/audit";

function assertAuthenticatedActor(actor: AuditActor): void {
    if (actor.state === "authenticated" && !actor.userId) {
        throw new Error("Authenticated audit entries require an actor user ID");
    }
}

export function deserializeAuditEvent(
    entry: SerializedAuditEventEntry,
): AuditEventEntry {
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

export async function appendAuditLogEntry(
    ctx: MutationCtx,
    entry: AuditEventEntry,
): Promise<void> {
    assertAuthenticatedActor(entry.actor);

    await ctx.db.insert("auditLogs", {
        action: entry.action,
        actorRole: entry.actor.role,
        actorState: entry.actor.state,
        actorUserId: entry.actor.userId as Id<"users"> | undefined,
        entityType: entry.entityType,
        event: entry.event,
        metadata: entry.metadata ?? {},
        outcome: entry.outcome,
        recordId: entry.recordId,
        sourceTenantId: entry.sourceTenantId as Id<"tenants"> | undefined,
        tableName: entry.tableName,
        targetTenantId: entry.targetTenantId as Id<"tenants"> | undefined,
        timestamp: entry.timestamp,
    });
}

export async function appendAuditLogBestEffort(
    ctx: MutationCtx,
    entry: AuditEventEntry,
): Promise<void> {
    try {
        await appendAuditLogEntry(ctx, entry);
    } catch {
        // Deny-path audit logging remains best effort as long as the caller
        // still fails closed.
    }
}

export async function appendAuditLogRequired(
    ctx: MutationCtx,
    entry: AuditEventEntry,
): Promise<void> {
    try {
        await appendAuditLogEntry(ctx, entry);
    } catch {
        throw new ConvexError({
            code: "AUDIT_LOG_FAILED",
            message:
                "The requested operation could not complete because the audit log could not be written",
        });
    }
}
