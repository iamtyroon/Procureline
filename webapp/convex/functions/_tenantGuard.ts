import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
    classifyTenantIsolationTable,
    countAccessibleTenantOwnedRecords,
    getCanonicalTenantIndex,
    hasAccessibleTenantOwnedRecord,
    resolveTenantRecordAccess,
    sanitizeTenantOwnedRecordsForActor,
    TENANT_ISOLATION_EVENT_NAMES,
    type TenantIsolationAuditEvent,
    type TenantScopedTableName,
    type VerifiedTenantRecordId,
} from "../../lib/auth/tenant-isolation";
import { getAuthorizationContext, requireTenantRole } from "./_roleGuard";

export {
    classifyTenantIsolationTable,
    countAccessibleTenantOwnedRecords,
    getCanonicalTenantIndex,
    hasAccessibleTenantOwnedRecord,
    resolveTenantRecordAccess,
    sanitizeTenantOwnedRecordsForActor,
    TENANT_ISOLATION_EVENT_NAMES,
};
export type { TenantScopedTableName, VerifiedTenantRecordId };

type TenantIsolationReadCtx = QueryCtx | MutationCtx;

function createUnauthorizedError(message: string): never {
    throw new ConvexError({
        code: "UNAUTHORIZED",
        message,
    });
}

function createAuditFailureError(): never {
    throw new ConvexError({
        code: "AUDIT_LOG_FAILED",
        message:
            "Platform-admin cross-tenant reads are blocked because the audit trail could not be written",
    });
}

async function appendTenantIsolationEvent(
    ctx: MutationCtx,
    event: TenantIsolationAuditEvent,
): Promise<void> {
    if (!event.actorUserId) {
        throw new Error("Tenant-isolation audit events require an actorUserId");
    }

    await ctx.db.insert("tenantIsolationEvents", {
        action: event.action,
        actorRole: event.actorRole,
        actorUserId: event.actorUserId as Id<"users">,
        entityType: event.entityType,
        event: event.event,
        outcome: event.outcome,
        recordId: event.recordId,
        sourceTenantId: event.sourceTenantId as Id<"tenants"> | undefined,
        tableName: event.tableName,
        targetTenantId: event.targetTenantId as Id<"tenants"> | undefined,
        timestamp: event.timestamp,
    });
}

async function persistDecisionAudit(
    ctx: MutationCtx,
    decision: ReturnType<typeof resolveTenantRecordAccess>,
): Promise<void> {
    if (decision.kind !== "not_found" || !decision.auditEvent) {
        return;
    }

    try {
        await appendTenantIsolationEvent(ctx, decision.auditEvent);
    } catch (_error: unknown) {
        // Blocked cross-tenant probes must still fail closed even if audit
        // persistence is temporarily unavailable.
    }
}

async function persistPlatformBypassAudit(
    ctx: MutationCtx,
    decision: ReturnType<typeof resolveTenantRecordAccess>,
): Promise<void> {
    if (decision.kind !== "allow_with_audit") {
        return;
    }

    try {
        await appendTenantIsolationEvent(ctx, decision.auditEvent);
    } catch (error: unknown) {
        // Platform-admin bypass reads must not proceed without the audit
        // trail. Re-throw a deterministic error so the caller never silently
        // receives data without an audit record.
        void error;
        createAuditFailureError();
    }
}

/**
 * Query-safe tenant read: enforces same-tenant isolation without writing
 * audit events. Suitable for `query` endpoints where `MutationCtx` is
 * unavailable. Cross-tenant probes return `null` (safe not-found semantics)
 * but are not persisted to the audit trail. Use
 * `readTenantByIdForCurrentTenantWithAudit` from mutations when audit
 * logging is required for denied probes.
 */
export async function readTenantByIdForCurrentTenant(
    ctx: TenantIsolationReadCtx,
    tenantId: Id<"tenants">,
): Promise<Doc<"tenants"> | null> {
    const authContext = await requireTenantRole(ctx);
    const tenant = await ctx.db.get(tenantId);
    const decision = resolveTenantRecordAccess({
        action: "read",
        actorRole: authContext.role,
        actorScope: authContext.scope,
        actorTenantId: authContext.tenantId,
        actorUserId: authContext.userId,
        entityType: "tenant",
        recordExists: tenant !== null,
        recordId: tenantId,
        tableName: "tenants",
        targetTenantId: tenant?._id ?? tenantId,
        timestamp: Date.now(),
    });

    if (decision.kind === "allow") {
        return tenant;
    }

    if (decision.kind === "unauthorized") {
        createUnauthorizedError(decision.message);
    }

    // Cross-tenant probe: return null without audit (query-safe path).
    return null;
}

/**
 * Mutation-aware tenant read: enforces same-tenant isolation **and** writes
 * audit events for blocked cross-tenant probes. Requires `MutationCtx`.
 */
export async function readTenantByIdForCurrentTenantWithAudit(
    ctx: MutationCtx,
    tenantId: Id<"tenants">,
): Promise<Doc<"tenants"> | null> {
    const authContext = await requireTenantRole(ctx);
    const tenant = await ctx.db.get(tenantId);
    const decision = resolveTenantRecordAccess({
        action: "read",
        actorRole: authContext.role,
        actorScope: authContext.scope,
        actorTenantId: authContext.tenantId,
        actorUserId: authContext.userId,
        entityType: "tenant",
        recordExists: tenant !== null,
        recordId: tenantId,
        tableName: "tenants",
        targetTenantId: tenant?._id ?? tenantId,
        timestamp: Date.now(),
    });

    if (decision.kind === "allow") {
        return tenant;
    }

    if (decision.kind === "unauthorized") {
        createUnauthorizedError(decision.message);
    }

    await persistDecisionAudit(ctx, decision);
    return null;
}

export async function readTenantByIdWithPlatformAdminBypass(
    ctx: MutationCtx,
    tenantId: Id<"tenants">,
): Promise<Doc<"tenants"> | null> {
    const authContext = await getAuthorizationContext(ctx);
    if (!authContext || !authContext.isSessionValid) {
        createUnauthorizedError("You must be signed in to access this resource");
    }

    if (!authContext.isRoleResolved || authContext.accessState !== "allowed") {
        createUnauthorizedError("You do not have an active application role");
    }

    const tenant = await ctx.db.get(tenantId);
    const decision = resolveTenantRecordAccess({
        action: "read",
        actorRole: authContext.role,
        actorScope: authContext.scope,
        actorTenantId: authContext.tenantId,
        actorUserId: authContext.userId,
        allowPlatformAdminBypass: true,
        entityType: "tenant",
        recordExists: tenant !== null,
        recordId: tenantId,
        tableName: "tenants",
        targetTenantId: tenant?._id ?? tenantId,
        timestamp: Date.now(),
    });

    if (decision.kind === "allow_with_audit") {
        await persistPlatformBypassAudit(ctx, decision);
        return tenant;
    }

    if (decision.kind === "allow") {
        return tenant;
    }

    if (decision.kind === "unauthorized") {
        createUnauthorizedError(decision.message);
    }

    await persistDecisionAudit(ctx, decision);
    return null;
}

export async function getCurrentTenantUserMembership(
    ctx: TenantIsolationReadCtx,
): Promise<Doc<"tenantUsers"> | null> {
    const authContext = await requireTenantRole(ctx);
    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex(getCanonicalTenantIndex("tenantUsers", "byUserTenant"), (q) =>
            q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId),
        )
        .first();

    if (!tenantUser) {
        return null;
    }

    return tenantUser;
}

export async function listTenantUsersForCurrentTenant(
    ctx: TenantIsolationReadCtx,
): Promise<Array<Doc<"tenantUsers">>> {
    const authContext = await requireTenantRole(ctx);
    return await ctx.db
        .query("tenantUsers")
        .withIndex(getCanonicalTenantIndex("tenantUsers", "byTenant"), (q) =>
            q.eq("tenantId", authContext.tenantId),
        )
        .collect();
}

export async function countTenantUsersForCurrentTenant(
    ctx: TenantIsolationReadCtx,
): Promise<number> {
    const tenantUsers = await listTenantUsersForCurrentTenant(ctx);
    return tenantUsers.length;
}

/**
 * Check whether a specific tenant user record exists and belongs to the
 * current tenant. Works with both `QueryCtx` and `MutationCtx`.
 *
 * When called from a query context, cross-tenant probes are denied but not
 * persisted to the audit trail. Use
 * `loadTenantUsersByIdsForCurrentTenantWithAudit` from mutations when audit
 * logging for denied batch probes is required.
 */
export async function tenantUserExistsForCurrentTenant(
    ctx: TenantIsolationReadCtx,
    tenantUserId: Id<"tenantUsers">,
): Promise<boolean> {
    const authContext = await requireTenantRole(ctx);
    const tenantUser = await ctx.db.get(tenantUserId);
    if (!tenantUser) {
        return false;
    }

    const decision = resolveTenantRecordAccess({
        action: "existence_check",
        actorRole: authContext.role,
        actorScope: authContext.scope,
        actorTenantId: authContext.tenantId,
        actorUserId: authContext.userId,
        entityType: "tenantUser",
        recordExists: true,
        recordId: tenantUserId,
        tableName: "tenantUsers",
        targetTenantId: tenantUser.tenantId,
        timestamp: Date.now(),
    });

    return decision.kind === "allow";
}

/**
 * Batch-load tenant user records for the current tenant with audit logging
 * for denied cross-tenant probes. Requires `MutationCtx`.
 *
 * Each document is fetched exactly once and cached to avoid redundant
 * database reads during ownership validation.
 */
export async function loadTenantUsersByIdsForCurrentTenantWithAudit(
    ctx: MutationCtx,
    tenantUserIds: readonly Id<"tenantUsers">[],
): Promise<Array<Doc<"tenantUsers">>> {
    const authContext = await requireTenantRole(ctx);

    // Fetch every document once and cache the full record for later return.
    const documentCache = new Map<string, Doc<"tenantUsers"> | null>();
    await Promise.all(
        tenantUserIds.map(async (tenantUserId) => {
            const tenantUser = await ctx.db.get(tenantUserId);
            documentCache.set(String(tenantUserId), tenantUser);
        }),
    );

    const records = tenantUserIds.map((tenantUserId) => {
        const tenantUser = documentCache.get(String(tenantUserId));
        return tenantUser
            ? { _id: tenantUser._id as unknown as string, tenantId: tenantUser.tenantId as unknown as string }
            : { _id: tenantUserId as unknown as string, tenantId: null };
    });

    const sanitized = sanitizeTenantOwnedRecordsForActor({
        action: "batch_read",
        actorRole: authContext.role,
        actorTenantId: authContext.tenantId as unknown as string,
        actorUserId: authContext.userId as unknown as string,
        entityType: "tenantUser",
        records,
        tableName: "tenantUsers",
        timestamp: Date.now(),
    });

    await Promise.all(
        sanitized.auditEvents.map(async (event) => {
            try {
                await appendTenantIsolationEvent(ctx, event);
            } catch (_error: unknown) {
                // Batch validation still fails closed even if audit persistence is unavailable.
            }
        }),
    );

    const accessibleIds = new Set(
        sanitized.records.map((record) => String(record._id)),
    );

    // Return documents from the cache with no second fetch.
    const accessibleDocuments: Array<Doc<"tenantUsers">> = [];
    for (const tenantUserId of tenantUserIds) {
        if (!accessibleIds.has(String(tenantUserId))) {
            continue;
        }

        const tenantUser = documentCache.get(String(tenantUserId));
        if (tenantUser) {
            accessibleDocuments.push(tenantUser);
        }
    }

    return accessibleDocuments;
}
