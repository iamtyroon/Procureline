"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTenantIsolationTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const tenant_isolation_1 = require("../lib/backend/auth/tenant-isolation");
const BASE_ACTOR = {
    actorRole: "tenant_admin",
    actorScope: "tenant",
    actorTenantId: "tenant-a",
    actorUserId: "user-1",
    entityType: "tenant",
    tableName: "tenants",
    action: "read",
    recordId: "tenant-b",
    timestamp: 123,
};
function runTenantIsolationTests() {
    const completedTests = [];
    strict_1.default.equal((0, tenant_isolation_1.classifyTenantIsolationTable)("tenantUsers"), "tenant_scoped");
    strict_1.default.equal((0, tenant_isolation_1.classifyTenantIsolationTable)("tenants"), "tenant_root");
    strict_1.default.equal((0, tenant_isolation_1.classifyTenantIsolationTable)("platformUsers"), "platform_scoped");
    strict_1.default.equal((0, tenant_isolation_1.classifyTenantIsolationTable)("sessionMetadata"), "global");
    strict_1.default.equal((0, tenant_isolation_1.classifyTenantIsolationTable)("subscriptionTiers"), "global");
    completedTests.push("current table classification distinguishes tenant, platform, and global data correctly");
    strict_1.default.equal((0, tenant_isolation_1.getCanonicalTenantIndex)("tenantUsers", "byTenant"), "by_tenantId");
    strict_1.default.equal((0, tenant_isolation_1.getCanonicalTenantIndex)("tenantUsers", "byUserTenant"), "by_userId_tenantId");
    completedTests.push("canonical tenant index names are stable for tenant-owned helper queries");
    const sameTenantDecision = (0, tenant_isolation_1.resolveTenantRecordAccess)({
        ...BASE_ACTOR,
        recordExists: true,
        targetTenantId: "tenant-a",
    });
    strict_1.default.deepEqual(sameTenantDecision, { kind: "allow" });
    completedTests.push("same-tenant reads are allowed when the server-side tenant context matches");
    const crossTenantDecision = (0, tenant_isolation_1.resolveTenantRecordAccess)({
        ...BASE_ACTOR,
        recordExists: true,
        targetTenantId: "tenant-b",
    });
    strict_1.default.equal(crossTenantDecision.kind, "not_found");
    strict_1.default.deepEqual(crossTenantDecision.auditEvent, {
        action: "read",
        actorRole: "tenant_admin",
        actorUserId: "user-1",
        entityType: "tenant",
        event: tenant_isolation_1.TENANT_ISOLATION_EVENT_NAMES.blockedProbe,
        outcome: "blocked_not_found",
        recordId: "tenant-b",
        sourceTenantId: "tenant-a",
        tableName: "tenants",
        targetTenantId: "tenant-b",
        timestamp: 123,
    });
    completedTests.push("cross-tenant reads resolve to safe not-found semantics and emit a blocked security event");
    const missingMetadataDecision = (0, tenant_isolation_1.resolveTenantRecordAccess)({
        ...BASE_ACTOR,
        entityType: "tenantUser",
        tableName: "tenantUsers",
        recordId: "tenant-user-2",
        recordExists: true,
        targetTenantId: null,
    });
    strict_1.default.equal(missingMetadataDecision.kind, "not_found");
    strict_1.default.equal(missingMetadataDecision.auditEvent?.outcome, "blocked_missing_metadata");
    completedTests.push("tenant-owned records with missing ownership metadata fail closed and remain non-enumerable");
    const unauthenticatedDecision = (0, tenant_isolation_1.resolveTenantRecordAccess)({
        ...BASE_ACTOR,
        actorRole: "anonymous",
        actorScope: "none",
        actorTenantId: undefined,
        actorUserId: undefined,
        recordExists: true,
        targetTenantId: "tenant-a",
    });
    strict_1.default.deepEqual(unauthenticatedDecision, {
        kind: "unauthorized",
        message: "You must be signed in to access this resource",
    });
    completedTests.push("unauthenticated callers still receive authorization failures instead of not-found masking");
    const platformAdminNeedsBypass = (0, tenant_isolation_1.resolveTenantRecordAccess)({
        ...BASE_ACTOR,
        actorRole: "platform_admin",
        actorScope: "platform",
        actorTenantId: undefined,
        allowPlatformAdminBypass: false,
        recordExists: true,
        targetTenantId: "tenant-b",
    });
    strict_1.default.deepEqual(platformAdminNeedsBypass, {
        kind: "unauthorized",
        message: "Platform administrator access requires an explicit read bypass helper",
    });
    completedTests.push("tenant-only helper paths reject platform-admin access unless a bypass helper is used intentionally");
    const platformBypassDecision = (0, tenant_isolation_1.resolveTenantRecordAccess)({
        ...BASE_ACTOR,
        actorRole: "platform_admin",
        actorScope: "platform",
        actorTenantId: undefined,
        allowPlatformAdminBypass: true,
        recordExists: true,
        targetTenantId: "tenant-b",
    });
    strict_1.default.equal(platformBypassDecision.kind, "allow_with_audit");
    strict_1.default.deepEqual(platformBypassDecision.auditEvent, {
        action: "read",
        actorRole: "platform_admin",
        actorUserId: "user-1",
        entityType: "tenant",
        event: tenant_isolation_1.TENANT_ISOLATION_EVENT_NAMES.platformBypassRead,
        outcome: "allowed_platform_bypass",
        recordId: "tenant-b",
        sourceTenantId: undefined,
        tableName: "tenants",
        targetTenantId: "tenant-b",
        timestamp: 123,
    });
    completedTests.push("platform-admin cross-tenant reads require an explicit audited bypass path");
    const firstAccess = (0, tenant_isolation_1.resolveTenantRecordAccess)({
        ...BASE_ACTOR,
        recordExists: true,
        targetTenantId: "tenant-a",
    });
    const revokedMembershipAccess = (0, tenant_isolation_1.resolveTenantRecordAccess)({
        ...BASE_ACTOR,
        actorTenantId: "tenant-b",
        recordExists: true,
        targetTenantId: "tenant-a",
    });
    strict_1.default.equal(firstAccess.kind, "allow");
    strict_1.default.equal(revokedMembershipAccess.kind, "not_found");
    completedTests.push("the helper surface enforces the latest tenant relationship on every request instead of trusting stale session state");
    const sanitizedRecords = (0, tenant_isolation_1.sanitizeTenantOwnedRecordsForActor)({
        actorTenantId: "tenant-a",
        entityType: "tenantUser",
        tableName: "tenantUsers",
        action: "list",
        actorRole: "tenant_admin",
        actorUserId: "user-1",
        records: [
            { _id: "tu-1", tenantId: "tenant-a" },
            { _id: "tu-2", tenantId: "tenant-b" },
            { _id: "tu-3", tenantId: null },
        ],
        timestamp: 500,
    });
    strict_1.default.deepEqual(sanitizedRecords.records.map((record) => record._id), ["tu-1"]);
    strict_1.default.equal(sanitizedRecords.auditEvents.length, 2);
    strict_1.default.equal((0, tenant_isolation_1.countAccessibleTenantOwnedRecords)(sanitizedRecords.records), 1);
    strict_1.default.equal((0, tenant_isolation_1.hasAccessibleTenantOwnedRecord)(sanitizedRecords.records, "tu-1"), true);
    strict_1.default.equal((0, tenant_isolation_1.hasAccessibleTenantOwnedRecord)(sanitizedRecords.records, "tu-2"), false);
    completedTests.push("collection, count, and existence helpers preserve tenant boundaries across mixed record sets");
    return completedTests;
}
exports.runTenantIsolationTests = runTenantIsolationTests;
