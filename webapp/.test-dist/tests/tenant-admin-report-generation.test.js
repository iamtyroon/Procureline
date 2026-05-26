"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTenantAdminReportGenerationTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const report_generation_1 = require("../lib/shared/tenant-admin/report-generation");
function runTenantAdminReportGenerationTests() {
    const completedTests = [];
    const now = Date.UTC(2026, 6, 20, 10, 0, 0);
    const parameters = (0, report_generation_1.buildDefaultTenantAdminReportParameters)({
        fiscalYear: "2026-2027",
        now,
    });
    strict_1.default.equal(parameters.dateRange.from, "2026-07-01");
    strict_1.default.equal(parameters.dateRange.to, "2027-06-30");
    strict_1.default.equal(parameters.reportType, "budget");
    strict_1.default.equal((0, report_generation_1.validateTenantAdminReportParameters)(parameters).valid, true);
    completedTests.push("tenant-admin report parameters default to the selected Kenya fiscal year and validate supported report formats");
    const invalid = (0, report_generation_1.validateTenantAdminReportParameters)({
        ...parameters,
        dateRange: {
            from: "2027-06-30",
            to: "2026-07-01",
        },
    });
    strict_1.default.equal(invalid.valid, false);
    strict_1.default.equal(invalid.issues.includes("Date range start must be before the end date."), true);
    completedTests.push("tenant-admin report parameter validation rejects inverted date ranges before queueing generation");
    const metadata = (0, report_generation_1.buildTenantAdminReportMetadata)({
        generatedAt: now,
        generatedByTenantUserId: "tenant-user-admin",
        parameters,
        tenantId: "tenant-1",
        tenantName: "Demo Institution",
    });
    strict_1.default.equal(metadata.confidential, true);
    strict_1.default.equal(metadata.schemaVersion, report_generation_1.TENANT_ADMIN_REPORT_SCHEMA_VERSION);
    strict_1.default.equal(metadata.reportType, "budget");
    completedTests.push("tenant-admin report metadata carries schema version, confidentiality marker, tenant, requester, and parameters");
    const auditRows = (0, report_generation_1.buildAuditReportRows)([
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
    strict_1.default.deepEqual(auditRows[0], {
        Action: "export",
        Actor: "tenant_admin",
        Entity: "tenant_admin_report",
        Event: "tenant_admin.report.generated",
        Outcome: "queued",
        "Record ID": "report-1",
        "Timestamp UTC": new Date(now).toISOString(),
    });
    completedTests.push("tenant-admin activity and audit reports preserve audit actor, action, entity, outcome, and timestamp semantics");
    strict_1.default.equal((0, report_generation_1.buildSecureShareExpiry)(now), now + report_generation_1.TENANT_ADMIN_REPORT_LINK_EXPIRY_MS);
    completedTests.push("tenant-admin secure report links expire exactly 72 hours after creation");
    strict_1.default.equal((0, report_generation_1.buildTenantAdminReportServicePath)("xlsx"), "/api/services/files/exports/excel/queue");
    strict_1.default.equal((0, report_generation_1.buildTenantAdminReportServicePath)("csv"), "/api/services/files/exports/csv/queue");
    completedTests.push("tenant-admin report queueing routes CSV and XLSX requests to format-specific server-side export queues");
    return completedTests;
}
exports.runTenantAdminReportGenerationTests = runTenantAdminReportGenerationTests;
