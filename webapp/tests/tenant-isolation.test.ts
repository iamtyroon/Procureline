import assert from "node:assert/strict";
import {
    classifyTenantIsolationTable,
    countAccessibleTenantOwnedRecords,
    getCanonicalTenantIndex,
    hasAccessibleTenantOwnedRecord,
    resolveTenantRecordAccess,
    sanitizeTenantOwnedRecordsForActor,
    TENANT_ISOLATION_EVENT_NAMES,
} from "../lib/auth/tenant-isolation";

const BASE_ACTOR = {
    actorRole: "tenant_admin" as const,
    actorScope: "tenant" as const,
    actorTenantId: "tenant-a",
    actorUserId: "user-1",
    entityType: "tenant",
    tableName: "tenants",
    action: "read",
    recordId: "tenant-b",
    timestamp: 123,
};

export function runTenantIsolationTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(classifyTenantIsolationTable("tenantUsers"), "tenant_scoped");
    assert.equal(classifyTenantIsolationTable("tenants"), "tenant_root");
    assert.equal(classifyTenantIsolationTable("platformUsers"), "platform_scoped");
    assert.equal(classifyTenantIsolationTable("sessionMetadata"), "global");
    assert.equal(classifyTenantIsolationTable("subscriptionTiers"), "global");
    completedTests.push("current table classification distinguishes tenant, platform, and global data correctly");

    assert.equal(getCanonicalTenantIndex("tenantUsers", "byTenant"), "by_tenantId");
    assert.equal(getCanonicalTenantIndex("tenantUsers", "byUserTenant"), "by_userId_tenantId");
    completedTests.push("canonical tenant index names are stable for tenant-owned helper queries");

    const sameTenantDecision = resolveTenantRecordAccess({
        ...BASE_ACTOR,
        recordExists: true,
        targetTenantId: "tenant-a",
    });
    assert.deepEqual(sameTenantDecision, { kind: "allow" });
    completedTests.push("same-tenant reads are allowed when the server-side tenant context matches");

    const crossTenantDecision = resolveTenantRecordAccess({
        ...BASE_ACTOR,
        recordExists: true,
        targetTenantId: "tenant-b",
    });
    assert.equal(crossTenantDecision.kind, "not_found");
    assert.deepEqual(crossTenantDecision.auditEvent, {
        action: "read",
        actorRole: "tenant_admin",
        actorUserId: "user-1",
        entityType: "tenant",
        event: TENANT_ISOLATION_EVENT_NAMES.blockedProbe,
        outcome: "blocked_not_found",
        recordId: "tenant-b",
        sourceTenantId: "tenant-a",
        tableName: "tenants",
        targetTenantId: "tenant-b",
        timestamp: 123,
    });
    completedTests.push("cross-tenant reads resolve to safe not-found semantics and emit a blocked security event");

    const missingMetadataDecision = resolveTenantRecordAccess({
        ...BASE_ACTOR,
        entityType: "tenantUser",
        tableName: "tenantUsers",
        recordId: "tenant-user-2",
        recordExists: true,
        targetTenantId: null,
    });
    assert.equal(missingMetadataDecision.kind, "not_found");
    assert.equal(missingMetadataDecision.auditEvent?.outcome, "blocked_missing_metadata");
    completedTests.push("tenant-owned records with missing ownership metadata fail closed and remain non-enumerable");

    const unauthenticatedDecision = resolveTenantRecordAccess({
        ...BASE_ACTOR,
        actorRole: "anonymous",
        actorScope: "none",
        actorTenantId: undefined,
        actorUserId: undefined,
        recordExists: true,
        targetTenantId: "tenant-a",
    });
    assert.deepEqual(unauthenticatedDecision, {
        kind: "unauthorized",
        message: "You must be signed in to access this resource",
    });
    completedTests.push("unauthenticated callers still receive authorization failures instead of not-found masking");

    const platformAdminNeedsBypass = resolveTenantRecordAccess({
        ...BASE_ACTOR,
        actorRole: "platform_admin",
        actorScope: "platform",
        actorTenantId: undefined,
        allowPlatformAdminBypass: false,
        recordExists: true,
        targetTenantId: "tenant-b",
    });
    assert.deepEqual(platformAdminNeedsBypass, {
        kind: "unauthorized",
        message: "Platform administrator access requires an explicit read bypass helper",
    });
    completedTests.push("tenant-only helper paths reject platform-admin access unless a bypass helper is used intentionally");

    const platformBypassDecision = resolveTenantRecordAccess({
        ...BASE_ACTOR,
        actorRole: "platform_admin",
        actorScope: "platform",
        actorTenantId: undefined,
        allowPlatformAdminBypass: true,
        recordExists: true,
        targetTenantId: "tenant-b",
    });
    assert.equal(platformBypassDecision.kind, "allow_with_audit");
    assert.deepEqual(platformBypassDecision.auditEvent, {
        action: "read",
        actorRole: "platform_admin",
        actorUserId: "user-1",
        entityType: "tenant",
        event: TENANT_ISOLATION_EVENT_NAMES.platformBypassRead,
        outcome: "allowed_platform_bypass",
        recordId: "tenant-b",
        sourceTenantId: undefined,
        tableName: "tenants",
        targetTenantId: "tenant-b",
        timestamp: 123,
    });
    completedTests.push("platform-admin cross-tenant reads require an explicit audited bypass path");

    const firstAccess = resolveTenantRecordAccess({
        ...BASE_ACTOR,
        recordExists: true,
        targetTenantId: "tenant-a",
    });
    const revokedMembershipAccess = resolveTenantRecordAccess({
        ...BASE_ACTOR,
        actorTenantId: "tenant-b",
        recordExists: true,
        targetTenantId: "tenant-a",
    });
    assert.equal(firstAccess.kind, "allow");
    assert.equal(revokedMembershipAccess.kind, "not_found");
    completedTests.push("the helper surface enforces the latest tenant relationship on every request instead of trusting stale session state");

    const sanitizedRecords = sanitizeTenantOwnedRecordsForActor({
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
    assert.deepEqual(
        sanitizedRecords.records.map((record: { _id: string }) => record._id),
        ["tu-1"],
    );
    assert.equal(sanitizedRecords.auditEvents.length, 2);
    assert.equal(countAccessibleTenantOwnedRecords(sanitizedRecords.records), 1);
    assert.equal(
        hasAccessibleTenantOwnedRecord(sanitizedRecords.records, "tu-1"),
        true,
    );
    assert.equal(
        hasAccessibleTenantOwnedRecord(sanitizedRecords.records, "tu-2"),
        false,
    );
    completedTests.push("collection, count, and existence helpers preserve tenant boundaries across mixed record sets");

    return completedTests;
}
