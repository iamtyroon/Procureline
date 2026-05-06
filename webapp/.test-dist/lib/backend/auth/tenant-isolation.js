"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasAccessibleTenantOwnedRecord = exports.countAccessibleTenantOwnedRecords = exports.sanitizeTenantOwnedRecordsForActor = exports.resolveTenantRecordAccess = exports.toVerifiedTenantRecordId = exports.getCanonicalTenantIndex = exports.classifyTenantIsolationTable = exports.TENANT_ISOLATION_EVENT_NAMES = exports.GLOBAL_ONLY_TABLES = exports.PLATFORM_SCOPED_TABLES = exports.TENANT_ROOT_TABLES = exports.TENANT_SCOPED_TABLES = void 0;
const audit_1 = require("@/lib/shared/security/audit");
exports.TENANT_SCOPED_TABLES = [
    "departmentAccessCodes",
    "departmentUserAuthChallenges",
    "departmentUserProfiles",
    "departments",
    "tenantUsers",
];
exports.TENANT_ROOT_TABLES = ["tenants"];
exports.PLATFORM_SCOPED_TABLES = ["platformUsers"];
exports.GLOBAL_ONLY_TABLES = ["sessionMetadata", "subscriptionTiers"];
exports.TENANT_ISOLATION_EVENT_NAMES = {
    blockedProbe: audit_1.AUDIT_EVENT_NAMES.tenantProbeBlocked,
    platformBypassRead: audit_1.AUDIT_EVENT_NAMES.tenantPlatformReadAllowed,
};
const CURRENT_TABLE_CLASSIFICATIONS = {
    departmentAccessCodes: "tenant_scoped",
    departmentUserAuthChallenges: "tenant_scoped",
    departmentUserProfiles: "tenant_scoped",
    departments: "tenant_scoped",
    platformUsers: "platform_scoped",
    sessionMetadata: "global",
    subscriptionTiers: "global",
    tenantUsers: "tenant_scoped",
    tenants: "tenant_root",
};
const CANONICAL_TENANT_INDEXES = {
    departmentAccessCodes: {
        byTenant: "by_tenantId",
    },
    departmentUserProfiles: {
        byTenant: "by_tenantId",
    },
    departments: {
        byTenant: "by_tenantId",
    },
    tenantUsers: {
        byTenant: "by_tenantId",
        byUserTenant: "by_userId_tenantId",
    },
};
function classifyTenantIsolationTable(tableName) {
    return CURRENT_TABLE_CLASSIFICATIONS[tableName];
}
exports.classifyTenantIsolationTable = classifyTenantIsolationTable;
function getCanonicalTenantIndex(tableName, indexName) {
    return CANONICAL_TENANT_INDEXES[tableName][indexName];
}
exports.getCanonicalTenantIndex = getCanonicalTenantIndex;
function toVerifiedTenantRecordId(recordId) {
    return recordId;
}
exports.toVerifiedTenantRecordId = toVerifiedTenantRecordId;
function buildAuditEvent(args, event, outcome) {
    if (args.actorRole === "anonymous" ||
        args.actorRole === "unassigned") {
        return undefined;
    }
    return {
        action: args.action,
        actorRole: args.actorRole,
        actorUserId: args.actorUserId,
        entityType: args.entityType,
        event,
        outcome,
        recordId: args.recordId,
        sourceTenantId: args.actorTenantId,
        tableName: args.tableName,
        targetTenantId: args.targetTenantId ?? undefined,
        timestamp: args.timestamp,
    };
}
function resolveTenantRecordAccess(args) {
    if (args.actorRole === "anonymous" || args.actorScope === "none") {
        return {
            kind: "unauthorized",
            message: "You must be signed in to access this resource",
        };
    }
    if (args.actorRole === "unassigned") {
        return {
            kind: "unauthorized",
            message: "You do not have an active application role",
        };
    }
    if (args.actorScope === "platform") {
        if (!args.allowPlatformAdminBypass) {
            return {
                kind: "unauthorized",
                message: "Platform administrator access requires an explicit read bypass helper",
            };
        }
        if (!args.recordExists) {
            return { kind: "not_found" };
        }
        return {
            kind: "allow_with_audit",
            auditEvent: buildAuditEvent(args, exports.TENANT_ISOLATION_EVENT_NAMES.platformBypassRead, "allowed_platform_bypass"),
        };
    }
    if (!args.actorTenantId) {
        return {
            kind: "unauthorized",
            message: "Tenant-scoped access is required for this resource",
        };
    }
    if (!args.recordExists) {
        return { kind: "not_found" };
    }
    if (!args.targetTenantId) {
        return {
            kind: "not_found",
            auditEvent: buildAuditEvent(args, exports.TENANT_ISOLATION_EVENT_NAMES.blockedProbe, "blocked_missing_metadata"),
        };
    }
    if (args.targetTenantId !== args.actorTenantId) {
        return {
            kind: "not_found",
            auditEvent: buildAuditEvent(args, exports.TENANT_ISOLATION_EVENT_NAMES.blockedProbe, "blocked_not_found"),
        };
    }
    return { kind: "allow" };
}
exports.resolveTenantRecordAccess = resolveTenantRecordAccess;
function sanitizeTenantOwnedRecordsForActor(args) {
    const auditEvents = [];
    const records = [];
    for (const record of args.records) {
        const decision = resolveTenantRecordAccess({
            action: args.action,
            actorRole: args.actorRole,
            actorScope: "tenant",
            actorTenantId: args.actorTenantId,
            actorUserId: args.actorUserId,
            entityType: args.entityType,
            recordExists: true,
            recordId: record._id,
            tableName: args.tableName,
            targetTenantId: record.tenantId,
            timestamp: args.timestamp,
        });
        if (decision.kind === "allow") {
            records.push({
                ...record,
                _id: toVerifiedTenantRecordId(record._id),
                tenantId: record.tenantId,
            });
            continue;
        }
        if (decision.kind === "not_found" && decision.auditEvent) {
            auditEvents.push(decision.auditEvent);
        }
    }
    return { auditEvents, records };
}
exports.sanitizeTenantOwnedRecordsForActor = sanitizeTenantOwnedRecordsForActor;
/**
 * Count records that have already been proven accessible for the current
 * tenant actor.
 *
 * The type signature intentionally rejects raw tenant-owned records so the
 * caller must sanitize them first.
 */
function countAccessibleTenantOwnedRecords(records) {
    return records.length;
}
exports.countAccessibleTenantOwnedRecords = countAccessibleTenantOwnedRecords;
function hasAccessibleTenantOwnedRecord(records, recordId) {
    return records.some((record) => record._id === recordId);
}
exports.hasAccessibleTenantOwnedRecord = hasAccessibleTenantOwnedRecord;
