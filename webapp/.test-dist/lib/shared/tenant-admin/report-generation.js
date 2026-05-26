"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTenantAdminReportServicePath = exports.buildSecureShareExpiry = exports.buildAuditReportRows = exports.buildBudgetReportRows = exports.buildTenantAdminReportMetadata = exports.validateTenantAdminReportParameters = exports.buildDefaultTenantAdminReportParameters = exports.TENANT_ADMIN_REPORT_STALE_TIMEOUT_MS = exports.TENANT_ADMIN_REPORT_LINK_EXPIRY_MS = exports.TENANT_ADMIN_REPORT_SCHEMA_VERSION = void 0;
const institutional_visibility_1 = require("./institutional-visibility");
exports.TENANT_ADMIN_REPORT_SCHEMA_VERSION = "tenant-admin-report.v1";
exports.TENANT_ADMIN_REPORT_LINK_EXPIRY_MS = 72 * 60 * 60 * 1000;
exports.TENANT_ADMIN_REPORT_STALE_TIMEOUT_MS = 15 * 60 * 1000;
function buildDefaultTenantAdminReportParameters(args) {
    return {
        dateRange: getFiscalYearDateRange(args.fiscalYear),
        departmentId: "all",
        fiscalYear: args.fiscalYear,
        format: "xlsx",
        procurementOfficerId: "all",
        reportType: "budget",
        status: "all",
    };
}
exports.buildDefaultTenantAdminReportParameters = buildDefaultTenantAdminReportParameters;
function validateTenantAdminReportParameters(parameters) {
    const issues = [];
    const from = Date.parse(parameters.dateRange.from);
    const to = Date.parse(parameters.dateRange.to);
    if (!["activity", "audit", "budget"].includes(parameters.reportType)) {
        issues.push("Unsupported report type.");
    }
    if (!["csv", "xlsx"].includes(parameters.format)) {
        issues.push("Unsupported output format.");
    }
    if (!/^\d{4}-\d{4}$/.test(parameters.fiscalYear)) {
        issues.push("Fiscal year must use YYYY-YYYY format.");
    }
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
        issues.push("Date range must include valid ISO dates.");
    }
    if (Number.isFinite(from) && Number.isFinite(to) && from > to) {
        issues.push("Date range start must be before the end date.");
    }
    return {
        issues,
        valid: issues.length === 0,
    };
}
exports.validateTenantAdminReportParameters = validateTenantAdminReportParameters;
function buildTenantAdminReportMetadata(args) {
    return {
        confidential: true,
        generatedAt: args.generatedAt,
        generatedByTenantUserId: args.generatedByTenantUserId,
        parameters: args.parameters,
        reportType: args.parameters.reportType,
        schemaVersion: exports.TENANT_ADMIN_REPORT_SCHEMA_VERSION,
        tenantId: args.tenantId,
        tenantName: args.tenantName,
    };
}
exports.buildTenantAdminReportMetadata = buildTenantAdminReportMetadata;
function buildBudgetReportRows(args) {
    const scopedRows = (0, institutional_visibility_1.filterInstitutionalOverviewRows)(args.overview.rows, {
        procurementOfficerId: args.parameters.procurementOfficerId,
        status: args.parameters.status,
    }).filter((row) => args.parameters.departmentId === "all"
        ? true
        : row.departmentId === args.parameters.departmentId);
    const scopedDepartmentIds = new Set(scopedRows.map((row) => row.departmentId));
    const summary = (0, institutional_visibility_1.summarizeInstitutionalOverview)(scopedRows, args.overview.anomalies.filter((anomaly) => scopedDepartmentIds.has(anomaly.departmentId)));
    return scopedRows.map((row) => ({
        "Anomaly Count": row.anomalyCount,
        "Budget Allocation": row.budget.allocation,
        "Budget Utilized": row.budget.used,
        "Compliance Summary": `${row.anomalyCount} issue${row.anomalyCount === 1 ? "" : "s"}`,
        Department: row.departmentName,
        "Department Code": row.departmentCode,
        "Fiscal Year": args.parameters.fiscalYear,
        "Institution Total Allocation": summary.totalAllocated,
        "Institution Total Utilized": summary.totalUtilized,
        "Procurement Officer": row.procurementOfficer.name,
        Status: row.statusLabel,
        "Utilization %": row.budget.utilizationPercent,
    }));
}
exports.buildBudgetReportRows = buildBudgetReportRows;
function buildAuditReportRows(auditLogs) {
    return auditLogs.map((log) => ({
        Action: log.action,
        Actor: log.actorRole,
        Entity: log.entityType,
        Event: log.event,
        Outcome: log.outcome,
        "Record ID": log.recordId ?? null,
        "Timestamp UTC": new Date(log.timestamp).toISOString(),
    }));
}
exports.buildAuditReportRows = buildAuditReportRows;
function buildSecureShareExpiry(createdAt) {
    return createdAt + exports.TENANT_ADMIN_REPORT_LINK_EXPIRY_MS;
}
exports.buildSecureShareExpiry = buildSecureShareExpiry;
function buildTenantAdminReportServicePath(format) {
    return format === "csv"
        ? "/api/services/files/exports/csv/queue"
        : "/api/services/files/exports/excel/queue";
}
exports.buildTenantAdminReportServicePath = buildTenantAdminReportServicePath;
function getFiscalYearDateRange(fiscalYear) {
    const [startYearText, endYearText] = fiscalYear.split("-");
    const startYear = Number(startYearText);
    const endYear = Number(endYearText);
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
        return {
            from: new Date().toISOString().slice(0, 10),
            to: new Date().toISOString().slice(0, 10),
        };
    }
    return {
        from: `${startYear}-07-01`,
        to: `${endYear}-06-30`,
    };
}
