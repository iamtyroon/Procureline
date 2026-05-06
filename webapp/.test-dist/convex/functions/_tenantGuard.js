"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTenantUsersByIdsForCurrentTenantWithAudit = exports.tenantUserExistsForCurrentTenant = exports.countTenantUsersForCurrentTenant = exports.listTenantUsersForCurrentTenant = exports.getCurrentTenantUserMembership = exports.auditPlatformAdminBypassRead = exports.readTenantByIdWithPlatformAdminBypass = exports.readTenantByIdForCurrentTenantWithAudit = exports.readTenantByIdForCurrentTenant = exports.TENANT_ISOLATION_EVENT_NAMES = exports.sanitizeTenantOwnedRecordsForActor = exports.resolveTenantRecordAccess = exports.hasAccessibleTenantOwnedRecord = exports.getCanonicalTenantIndex = exports.countAccessibleTenantOwnedRecords = exports.classifyTenantIsolationTable = void 0;
const values_1 = require("convex/values");
const tenant_isolation_1 = require("../../lib/backend/auth/tenant-isolation");
Object.defineProperty(exports, "classifyTenantIsolationTable", { enumerable: true, get: function () { return tenant_isolation_1.classifyTenantIsolationTable; } });
Object.defineProperty(exports, "countAccessibleTenantOwnedRecords", { enumerable: true, get: function () { return tenant_isolation_1.countAccessibleTenantOwnedRecords; } });
Object.defineProperty(exports, "getCanonicalTenantIndex", { enumerable: true, get: function () { return tenant_isolation_1.getCanonicalTenantIndex; } });
Object.defineProperty(exports, "hasAccessibleTenantOwnedRecord", { enumerable: true, get: function () { return tenant_isolation_1.hasAccessibleTenantOwnedRecord; } });
Object.defineProperty(exports, "resolveTenantRecordAccess", { enumerable: true, get: function () { return tenant_isolation_1.resolveTenantRecordAccess; } });
Object.defineProperty(exports, "sanitizeTenantOwnedRecordsForActor", { enumerable: true, get: function () { return tenant_isolation_1.sanitizeTenantOwnedRecordsForActor; } });
Object.defineProperty(exports, "TENANT_ISOLATION_EVENT_NAMES", { enumerable: true, get: function () { return tenant_isolation_1.TENANT_ISOLATION_EVENT_NAMES; } });
const audit_1 = require("../../lib/shared/security/audit");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
function createUnauthorizedError(message) {
    throw new values_1.ConvexError({
        code: "UNAUTHORIZED",
        message,
    });
}
function createAuditFailureError() {
    throw new values_1.ConvexError({
        code: "AUDIT_LOG_FAILED",
        message: "Platform-admin cross-tenant reads are blocked because the audit trail could not be written",
    });
}
async function appendTenantIsolationEvent(ctx, event) {
    if (!event.actorUserId) {
        throw new Error("Tenant-isolation audit events require an actorUserId");
    }
    await ctx.db.insert("tenantIsolationEvents", {
        action: event.action,
        actorRole: event.actorRole,
        actorUserId: event.actorUserId,
        entityType: event.entityType,
        event: event.event,
        outcome: event.outcome,
        recordId: event.recordId,
        sourceTenantId: event.sourceTenantId,
        tableName: event.tableName,
        targetTenantId: event.targetTenantId,
        timestamp: event.timestamp,
    });
}
function toAuditLogEntry(event) {
    return {
        action: event.action,
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: event.actorRole,
            userId: event.actorUserId,
        }),
        entityType: event.entityType,
        event: event.event,
        outcome: event.outcome,
        recordId: event.recordId,
        sourceTenantId: event.sourceTenantId,
        tableName: event.tableName,
        targetTenantId: event.targetTenantId,
        timestamp: event.timestamp,
    };
}
async function persistDecisionAudit(ctx, decision) {
    if (decision.kind !== "not_found" || !decision.auditEvent) {
        return;
    }
    try {
        await appendTenantIsolationEvent(ctx, decision.auditEvent);
        await (0, _audit_1.appendAuditLogBestEffort)(ctx, toAuditLogEntry(decision.auditEvent));
    }
    catch (_error) {
        // Blocked cross-tenant probes must still fail closed even if audit
        // persistence is temporarily unavailable.
    }
}
async function persistPlatformBypassAudit(ctx, decision) {
    if (decision.kind !== "allow_with_audit") {
        return;
    }
    try {
        await appendTenantIsolationEvent(ctx, decision.auditEvent);
        await (0, _audit_1.appendAuditLogRequired)(ctx, toAuditLogEntry(decision.auditEvent));
    }
    catch (error) {
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
async function readTenantByIdForCurrentTenant(ctx, tenantId) {
    const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx);
    const tenant = await ctx.db.get(tenantId);
    const decision = (0, tenant_isolation_1.resolveTenantRecordAccess)({
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
exports.readTenantByIdForCurrentTenant = readTenantByIdForCurrentTenant;
/**
 * Mutation-aware tenant read: enforces same-tenant isolation **and** writes
 * audit events for blocked cross-tenant probes. Requires `MutationCtx`.
 */
async function readTenantByIdForCurrentTenantWithAudit(ctx, tenantId) {
    const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx);
    const tenant = await ctx.db.get(tenantId);
    const decision = (0, tenant_isolation_1.resolveTenantRecordAccess)({
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
exports.readTenantByIdForCurrentTenantWithAudit = readTenantByIdForCurrentTenantWithAudit;
async function readTenantByIdWithPlatformAdminBypass(ctx, tenantId) {
    const authContext = await (0, _roleGuard_1.getAuthorizationContext)(ctx);
    if (!authContext || !authContext.isSessionValid) {
        createUnauthorizedError("You must be signed in to access this resource");
    }
    if (!authContext.isRoleResolved || authContext.accessState !== "allowed") {
        createUnauthorizedError("You do not have an active application role");
    }
    const tenant = await ctx.db.get(tenantId);
    const decision = (0, tenant_isolation_1.resolveTenantRecordAccess)({
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
exports.readTenantByIdWithPlatformAdminBypass = readTenantByIdWithPlatformAdminBypass;
async function auditPlatformAdminBypassRead(ctx, args) {
    const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
    const decision = (0, tenant_isolation_1.resolveTenantRecordAccess)({
        action: args.action,
        actorRole: authContext.role,
        actorScope: authContext.scope,
        actorTenantId: authContext.tenantId,
        actorUserId: authContext.userId,
        allowPlatformAdminBypass: true,
        entityType: args.entityType,
        recordExists: true,
        recordId: args.recordId,
        tableName: args.tableName,
        targetTenantId: args.targetTenantId,
        timestamp: Date.now(),
    });
    if (decision.kind !== "allow_with_audit") {
        createUnauthorizedError("Platform administrator access requires an explicit audited bypass");
    }
    await persistPlatformBypassAudit(ctx, decision);
}
exports.auditPlatformAdminBypassRead = auditPlatformAdminBypassRead;
async function getCurrentTenantUserMembership(ctx) {
    const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx);
    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex((0, tenant_isolation_1.getCanonicalTenantIndex)("tenantUsers", "byUserTenant"), (q) => q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId))
        .first();
    if (!tenantUser) {
        return null;
    }
    return tenantUser;
}
exports.getCurrentTenantUserMembership = getCurrentTenantUserMembership;
async function listTenantUsersForCurrentTenant(ctx) {
    const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx);
    return await ctx.db
        .query("tenantUsers")
        .withIndex((0, tenant_isolation_1.getCanonicalTenantIndex)("tenantUsers", "byTenant"), (q) => q.eq("tenantId", authContext.tenantId))
        .collect();
}
exports.listTenantUsersForCurrentTenant = listTenantUsersForCurrentTenant;
async function countTenantUsersForCurrentTenant(ctx) {
    const tenantUsers = await listTenantUsersForCurrentTenant(ctx);
    return tenantUsers.length;
}
exports.countTenantUsersForCurrentTenant = countTenantUsersForCurrentTenant;
/**
 * Check whether a specific tenant user record exists and belongs to the
 * current tenant. Works with both `QueryCtx` and `MutationCtx`.
 *
 * When called from a query context, cross-tenant probes are denied but not
 * persisted to the audit trail. Use
 * `loadTenantUsersByIdsForCurrentTenantWithAudit` from mutations when audit
 * logging for denied batch probes is required.
 */
async function tenantUserExistsForCurrentTenant(ctx, tenantUserId) {
    const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx);
    const tenantUser = await ctx.db.get(tenantUserId);
    if (!tenantUser) {
        return false;
    }
    const decision = (0, tenant_isolation_1.resolveTenantRecordAccess)({
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
exports.tenantUserExistsForCurrentTenant = tenantUserExistsForCurrentTenant;
/**
 * Batch-load tenant user records for the current tenant with audit logging
 * for denied cross-tenant probes. Requires `MutationCtx`.
 *
 * Each document is fetched exactly once and cached to avoid redundant
 * database reads during ownership validation.
 */
async function loadTenantUsersByIdsForCurrentTenantWithAudit(ctx, tenantUserIds) {
    const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx);
    // Fetch every document once and cache the full record for later return.
    const documentCache = new Map();
    await Promise.all(tenantUserIds.map(async (tenantUserId) => {
        const tenantUser = await ctx.db.get(tenantUserId);
        documentCache.set(String(tenantUserId), tenantUser);
    }));
    const records = tenantUserIds.map((tenantUserId) => {
        const tenantUser = documentCache.get(String(tenantUserId));
        return tenantUser
            ? { _id: tenantUser._id, tenantId: tenantUser.tenantId }
            : { _id: tenantUserId, tenantId: null };
    });
    const sanitized = (0, tenant_isolation_1.sanitizeTenantOwnedRecordsForActor)({
        action: "batch_read",
        actorRole: authContext.role,
        actorTenantId: authContext.tenantId,
        actorUserId: authContext.userId,
        entityType: "tenantUser",
        records,
        tableName: "tenantUsers",
        timestamp: Date.now(),
    });
    await Promise.all(sanitized.auditEvents.map(async (event) => {
        try {
            await appendTenantIsolationEvent(ctx, event);
            await (0, _audit_1.appendAuditLogBestEffort)(ctx, toAuditLogEntry(event));
        }
        catch (_error) {
            // Batch validation still fails closed even if audit persistence is unavailable.
        }
    }));
    const accessibleIds = new Set(sanitized.records.map((record) => String(record._id)));
    // Return documents from the cache with no second fetch.
    const accessibleDocuments = [];
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
exports.loadTenantUsersByIdsForCurrentTenantWithAudit = loadTenantUsersByIdsForCurrentTenantWithAudit;
