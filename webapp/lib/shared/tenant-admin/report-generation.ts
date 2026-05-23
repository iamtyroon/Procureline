import {
    filterInstitutionalOverviewRows,
    summarizeInstitutionalOverview,
    type InstitutionalOverviewStatus,
    type TenantAdminInstitutionalOverview,
} from "./institutional-visibility";

export const TENANT_ADMIN_REPORT_SCHEMA_VERSION = "tenant-admin-report.v1" as const;
export const TENANT_ADMIN_REPORT_LINK_EXPIRY_MS = 72 * 60 * 60 * 1000;

export type TenantAdminReportType = "activity" | "audit" | "budget";
export type TenantAdminReportFormat = "csv" | "xlsx";
export type TenantAdminReportJobStatus = "failed" | "queued" | "ready";
export type TenantAdminReportScheduleCadence = "monthly" | "weekly";

export interface TenantAdminReportParameters {
    dateRange: {
        from: string;
        to: string;
    };
    departmentId: string;
    fiscalYear: string;
    format: TenantAdminReportFormat;
    procurementOfficerId: string;
    reportType: TenantAdminReportType;
    status: InstitutionalOverviewStatus | "all";
}

export interface TenantAdminReportMetadata {
    confidential: true;
    generatedAt: number;
    generatedByTenantUserId: string;
    parameters: TenantAdminReportParameters;
    reportType: TenantAdminReportType;
    schemaVersion: typeof TENANT_ADMIN_REPORT_SCHEMA_VERSION;
    tenantId: string;
    tenantName: string;
}

export interface TenantAdminReportScheduleSettings {
    cadence: TenantAdminReportScheduleCadence;
    enabled: boolean;
    reportType: Extract<TenantAdminReportType, "activity" | "budget">;
}

export interface TenantAdminReportRow {
    [key: string]: string | number | null;
}

export function buildDefaultTenantAdminReportParameters(args: {
    fiscalYear: string;
    now: number;
}): TenantAdminReportParameters {
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

export function validateTenantAdminReportParameters(
    parameters: TenantAdminReportParameters,
): { issues: string[]; valid: boolean } {
    const issues: string[] = [];
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

export function buildTenantAdminReportMetadata(args: {
    generatedAt: number;
    generatedByTenantUserId: string;
    parameters: TenantAdminReportParameters;
    tenantId: string;
    tenantName: string;
}): TenantAdminReportMetadata {
    return {
        confidential: true,
        generatedAt: args.generatedAt,
        generatedByTenantUserId: args.generatedByTenantUserId,
        parameters: args.parameters,
        reportType: args.parameters.reportType,
        schemaVersion: TENANT_ADMIN_REPORT_SCHEMA_VERSION,
        tenantId: args.tenantId,
        tenantName: args.tenantName,
    };
}

export function buildBudgetReportRows(args: {
    overview: TenantAdminInstitutionalOverview;
    parameters: TenantAdminReportParameters;
}): TenantAdminReportRow[] {
    const scopedRows = filterInstitutionalOverviewRows(args.overview.rows, {
        procurementOfficerId: args.parameters.procurementOfficerId,
        status: args.parameters.status,
    }).filter((row) =>
        args.parameters.departmentId === "all"
            ? true
            : row.departmentId === args.parameters.departmentId,
    );
    const scopedDepartmentIds = new Set(scopedRows.map((row) => row.departmentId));
    const summary = summarizeInstitutionalOverview(
        scopedRows,
        args.overview.anomalies.filter((anomaly) =>
            scopedDepartmentIds.has(anomaly.departmentId),
        ),
    );

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

export function buildAuditReportRows(
    auditLogs: readonly {
        action: string;
        actorRole: string;
        entityType: string;
        event: string;
        id: string;
        outcome: string;
        recordId?: string;
        timestamp: number;
    }[],
): TenantAdminReportRow[] {
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

export function buildSecureShareExpiry(createdAt: number): number {
    return createdAt + TENANT_ADMIN_REPORT_LINK_EXPIRY_MS;
}

function getFiscalYearDateRange(fiscalYear: string): TenantAdminReportParameters["dateRange"] {
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
