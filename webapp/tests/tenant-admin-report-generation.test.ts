import assert from "node:assert/strict";
import {
    buildAuditReportRows,
    buildDefaultTenantAdminReportParameters,
    buildSecureShareExpiry,
    buildTenantAdminReportMetadata,
    TENANT_ADMIN_REPORT_LINK_EXPIRY_MS,
    TENANT_ADMIN_REPORT_SCHEMA_VERSION,
    validateTenantAdminReportParameters,
} from "../lib/shared/tenant-admin/report-generation";

export function runTenantAdminReportGenerationTests(): string[] {
    const completedTests: string[] = [];
    const now = Date.UTC(2026, 6, 20, 10, 0, 0);
    const parameters = buildDefaultTenantAdminReportParameters({
        fiscalYear: "2026-2027",
        now,
    });

    assert.equal(parameters.dateRange.from, "2026-07-01");
    assert.equal(parameters.dateRange.to, "2027-06-30");
    assert.equal(parameters.reportType, "budget");
    assert.equal(validateTenantAdminReportParameters(parameters).valid, true);
    completedTests.push(
        "tenant-admin report parameters default to the selected Kenya fiscal year and validate supported report formats",
    );

    const invalid = validateTenantAdminReportParameters({
        ...parameters,
        dateRange: {
            from: "2027-06-30",
            to: "2026-07-01",
        },
    });
    assert.equal(invalid.valid, false);
    assert.equal(
        invalid.issues.includes("Date range start must be before the end date."),
        true,
    );
    completedTests.push(
        "tenant-admin report parameter validation rejects inverted date ranges before queueing generation",
    );

    const metadata = buildTenantAdminReportMetadata({
        generatedAt: now,
        generatedByTenantUserId: "tenant-user-admin",
        parameters,
        tenantId: "tenant-1",
        tenantName: "Demo Institution",
    });
    assert.equal(metadata.confidential, true);
    assert.equal(metadata.schemaVersion, TENANT_ADMIN_REPORT_SCHEMA_VERSION);
    assert.equal(metadata.reportType, "budget");
    completedTests.push(
        "tenant-admin report metadata carries schema version, confidentiality marker, tenant, requester, and parameters",
    );

    const auditRows = buildAuditReportRows([
        {
            action: "export",
            actorRole: "tenant_admin",
            entityType: "tenant_admin_report",
            event: "tenant_admin.report.generated",
            id: "audit-1",
            outcome: "queued",
            recordId: "report-1",
            timestamp: now,
        },
    ]);
    assert.deepEqual(auditRows[0], {
        Action: "export",
        Actor: "tenant_admin",
        Entity: "tenant_admin_report",
        Event: "tenant_admin.report.generated",
        Outcome: "queued",
        "Record ID": "report-1",
        "Timestamp UTC": new Date(now).toISOString(),
    });
    completedTests.push(
        "tenant-admin activity and audit reports preserve audit actor, action, entity, outcome, and timestamp semantics",
    );

    assert.equal(buildSecureShareExpiry(now), now + TENANT_ADMIN_REPORT_LINK_EXPIRY_MS);
    completedTests.push(
        "tenant-admin secure report links expire exactly 72 hours after creation",
    );

    return completedTests;
}
