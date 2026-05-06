"use node";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueTenantAdminInstitutionalExport = exports.exportSubmissionMonitoringReport = exports.exportCatalogItems = exports.createPdf = exports.importWorkbook = exports.queueExcelExport = exports.createExcelExport = void 0;
const values_1 = require("convex/values");
const api_1 = require("../_generated/api");
const server_1 = require("../_generated/server");
const _helpers_1 = require("./_helpers");
const audit_1 = require("../../lib/shared/security/audit");
const catalog_filters_1 = require("../../lib/procurement-officer/catalog-filters");
const items_1 = require("../../lib/procurement-officer/items");
const submission_monitoring_1 = require("../../lib/procurement-officer/submission-monitoring");
const institutional_visibility_1 = require("../../lib/shared/tenant-admin/institutional-visibility");
exports.createExcelExport = (0, server_1.action)({
    args: {
        idempotencyKey: values_1.v.optional(values_1.v.string()),
        reportName: values_1.v.string(),
        rows: values_1.v.array(values_1.v.any()),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/files/exports/excel",
        });
    },
});
exports.queueExcelExport = (0, server_1.action)({
    args: {
        idempotencyKey: values_1.v.optional(values_1.v.string()),
        reportName: values_1.v.string(),
        rows: values_1.v.array(values_1.v.any()),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/files/exports/excel/queue",
        });
    },
});
exports.importWorkbook = (0, server_1.action)({
    args: {
        workbookBase64: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/files/imports/excel",
        });
    },
});
exports.createPdf = (0, server_1.action)({
    args: {
        body: values_1.v.string(),
        title: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/files/exports/pdf",
        });
    },
});
exports.exportCatalogItems = (0, server_1.action)({
    args: {
        categoryIds: values_1.v.array(values_1.v.string()),
        complianceFlags: values_1.v.array(values_1.v.string()),
        maxPrice: values_1.v.optional(values_1.v.number()),
        minPrice: values_1.v.optional(values_1.v.number()),
        searchText: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        const firstPage = (await ctx.runQuery(api_1.api.functions.items.browseItemsCatalog, {
            ...args,
            page: 1,
            pageSize: 1,
        }));
        const exportGuard = (0, catalog_filters_1.getProcurementCatalogExportGuardState)({
            filteredCount: firstPage.meta.filteredCount,
            tier: firstPage.meta.tier,
        });
        if (exportGuard.kind !== "allowed") {
            await appendCatalogExportAudit(ctx, actor, {
                filteredCount: firstPage.meta.filteredCount,
                filters: firstPage.meta.normalizedFilters,
                outcome: audit_1.AUDIT_OUTCOMES.failed,
                summary: exportGuard.description,
                tier: firstPage.meta.tier,
            });
            throw new values_1.ConvexError({
                code: exportGuard.kind === "empty" ? "VALIDATION_FAILED" : "QUOTA_EXCEEDED",
                message: exportGuard.description,
            });
        }
        const exportSnapshot = (await ctx.runQuery(api_1.api.functions.items.browseItemsCatalog, {
            categoryIds: firstPage.meta.normalizedFilters.categoryIds,
            complianceFlags: firstPage.meta.normalizedFilters.complianceFlags,
            maxPrice: firstPage.meta.normalizedFilters.maxPrice ?? undefined,
            minPrice: firstPage.meta.normalizedFilters.minPrice ?? undefined,
            page: 1,
            pageSize: firstPage.meta.filteredCount,
            searchText: firstPage.meta.normalizedFilters.searchText,
        }));
        const finalGuard = (0, catalog_filters_1.getProcurementCatalogExportGuardState)({
            filteredCount: exportSnapshot.meta.filteredCount,
            tier: exportSnapshot.meta.tier,
        });
        if (finalGuard.kind !== "allowed") {
            await appendCatalogExportAudit(ctx, actor, {
                filteredCount: exportSnapshot.meta.filteredCount,
                filters: exportSnapshot.meta.normalizedFilters,
                outcome: audit_1.AUDIT_OUTCOMES.failed,
                summary: finalGuard.description,
                tier: exportSnapshot.meta.tier,
            });
            throw new values_1.ConvexError({
                code: finalGuard.kind === "empty" ? "VALIDATION_FAILED" : "QUOTA_EXCEEDED",
                message: finalGuard.description,
            });
        }
        try {
            const workbook = await (0, _helpers_1.callNestService)(ctx, {
                actor,
                body: {
                    reportName: "Catalog Export",
                    rows: (0, items_1.buildProcurementCatalogExportRows)(exportSnapshot.rows),
                },
                path: "/api/services/files/exports/excel",
            });
            await appendCatalogExportAudit(ctx, actor, {
                filteredCount: exportSnapshot.meta.filteredCount,
                filters: exportSnapshot.meta.normalizedFilters,
                outcome: audit_1.AUDIT_OUTCOMES.allowed,
                summary: `Exported ${exportSnapshot.meta.filteredCount} catalog rows.`,
                tier: exportSnapshot.meta.tier,
            });
            return {
                ...workbook,
                filteredCount: exportSnapshot.meta.filteredCount,
            };
        }
        catch (error) {
            await appendCatalogExportAudit(ctx, actor, {
                filteredCount: exportSnapshot.meta.filteredCount,
                filters: exportSnapshot.meta.normalizedFilters,
                outcome: audit_1.AUDIT_OUTCOMES.failed,
                summary: error instanceof Error && error.message.trim().length > 0
                    ? error.message.trim()
                    : "Catalog export failed.",
                tier: exportSnapshot.meta.tier,
            });
            throw error;
        }
    },
});
exports.exportSubmissionMonitoringReport = (0, server_1.action)({
    args: {
        departmentIds: values_1.v.optional(values_1.v.array(values_1.v.string())),
        selectedFiscalYear: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        if (actor.role !== "procurement_officer" || !actor.tenantId) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Procurement Officer access is required for this resource.",
            });
        }
        const monitoringWorkspace = (await ctx.runQuery(api_1.api.functions.procurementOfficerSubmissions
            .getProcurementOfficerSubmissionMonitoringWorkspace, {
            selectedFiscalYear: args.selectedFiscalYear,
        }));
        const allowedDepartmentIds = new Set(args.departmentIds ?? []);
        const exportRows = allowedDepartmentIds.size > 0
            ? monitoringWorkspace.rows.filter((row) => allowedDepartmentIds.has(row.departmentId))
            : monitoringWorkspace.rows;
        if (exportRows.length === 0) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "No monitoring rows are available for export.",
            });
        }
        const workbook = await (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: {
                reportName: `Submission Monitoring ${monitoringWorkspace.meta.selectedFiscalYearLabel}`,
                rows: (0, submission_monitoring_1.buildProcurementOfficerMonitoringExportRows)(exportRows),
            },
            path: "/api/services/files/exports/excel",
        });
        await ctx.runMutation(api_1.internal.functions.auditLogs.appendAuditLogFromAction, {
            action: "export",
            actorRole: actor.role,
            actorState: (0, audit_1.createAuthenticatedAuditActor)({
                role: actor.role,
                userId: actor.userId,
            }).state,
            actorUserId: actor.userId,
            entityType: "submission_monitoring",
            event: "submission_monitoring.exported",
            metadata: {
                fiscalYear: args.selectedFiscalYear,
                rowCount: exportRows.length,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            sourceTenantId: actor.tenantId,
            tableName: "plans",
            targetTenantId: actor.tenantId,
            timestamp: Date.now(),
        });
        return {
            ...workbook,
            filteredCount: exportRows.length,
        };
    },
});
exports.queueTenantAdminInstitutionalExport = (0, server_1.action)({
    args: {
        fiscalYear: values_1.v.string(),
        procurementOfficerId: values_1.v.optional(values_1.v.string()),
        query: values_1.v.optional(values_1.v.string()),
        status: values_1.v.optional(values_1.v.union(values_1.v.literal("all"), values_1.v.literal("approved"), values_1.v.literal("draft"), values_1.v.literal("not_started"), values_1.v.literal("rejected"), values_1.v.literal("submitted"))),
    },
    returns: values_1.v.object({
        asOf: values_1.v.number(),
        fileName: values_1.v.optional(values_1.v.string()),
        fiscalYear: values_1.v.string(),
        requestId: values_1.v.string(),
        schemaVersion: values_1.v.string(),
        state: values_1.v.union(values_1.v.literal("queued"), values_1.v.literal("export_ready")),
        tenantId: values_1.v.string(),
    }),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        if (actor.role !== "tenant_admin" || !actor.tenantId) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Tenant Admin access is required for this export.",
            });
        }
        const asOf = Date.now();
        const requestId = [
            "tenant-admin-institutional-export",
            actor.tenantId,
            args.fiscalYear,
            actor.userId,
            String(asOf),
        ].join(":");
        const snapshot = (await ctx.runQuery(api_1.api.functions.tenantAdminDashboard.getTenantAdminDashboardSnapshot, { selectedFiscalYear: args.fiscalYear }));
        const filteredRows = (0, institutional_visibility_1.filterInstitutionalOverviewRows)(snapshot.institutionalOverview.rows, {
            procurementOfficerId: args.procurementOfficerId ?? "all",
            query: args.query ?? "",
            status: args.status ?? "all",
        });
        const filteredDepartmentIds = new Set(filteredRows.map((row) => row.departmentId));
        const filteredAnomalies = snapshot.institutionalOverview.anomalies.filter((anomaly) => filteredDepartmentIds.has(anomaly.departmentId));
        const filteredOverview = {
            ...snapshot.institutionalOverview,
            anomalies: filteredAnomalies,
            rows: filteredRows,
            summary: (0, institutional_visibility_1.summarizeInstitutionalOverview)(filteredRows, filteredAnomalies),
        };
        const exportPreview = (0, institutional_visibility_1.buildInstitutionalExportPreview)({
            actorTenantUserId: actor.userId,
            asOf,
            fiscalYear: args.fiscalYear,
            overview: filteredOverview,
            requestId,
            tenantId: String(actor.tenantId),
        });
        await appendTenantAdminInstitutionalExportAudit(ctx, actor, {
            asOf,
            fiscalYear: args.fiscalYear,
            outcome: "queued",
            requestId,
            rowCount: exportPreview.departments.length,
            summary: "Institutional export request queued for server-side generation.",
        });
        try {
            const queued = await (0, _helpers_1.callNestService)(ctx, {
                actor,
                body: {
                    idempotencyKey: requestId,
                    reportName: `Institutional Overview ${args.fiscalYear}`,
                    rows: exportPreview.departments,
                    metadata: exportPreview.metadata,
                },
                path: "/api/services/files/exports/excel/queue",
            });
            const state = queued.state ?? "queued";
            await appendTenantAdminInstitutionalExportAudit(ctx, actor, {
                asOf,
                fiscalYear: args.fiscalYear,
                outcome: state,
                requestId,
                rowCount: exportPreview.departments.length,
                summary: state === "export_ready"
                    ? "Institutional export package is ready for secure delivery."
                    : "Institutional export package is being generated server-side.",
            });
            return {
                asOf,
                fiscalYear: args.fiscalYear,
                requestId,
                schemaVersion: exportPreview.metadata.schemaVersion,
                state,
                tenantId: String(actor.tenantId),
                ...(queued.fileName ? { fileName: queued.fileName } : {}),
            };
        }
        catch (error) {
            await appendTenantAdminInstitutionalExportAudit(ctx, actor, {
                asOf,
                fiscalYear: args.fiscalYear,
                outcome: "failed",
                requestId,
                rowCount: exportPreview.departments.length,
                summary: error instanceof Error && error.message.trim().length > 0
                    ? error.message.trim()
                    : "Institutional export generation failed.",
            });
            throw error;
        }
    },
});
async function appendTenantAdminInstitutionalExportAudit(ctx, actor, args) {
    await ctx.runMutation(api_1.internal.functions.auditLogs.appendAuditLogFromAction, {
        action: "export",
        actorRole: actor.role,
        actorState: (0, audit_1.createAuthenticatedAuditActor)({
            role: actor.role,
            userId: actor.userId,
        }).state,
        actorUserId: actor.userId,
        entityType: "tenant_admin_institutional_export",
        event: "tenant_admin.institutional_export.requested",
        metadata: {
            asOf: args.asOf,
            fiscalYear: args.fiscalYear,
            requestId: args.requestId,
            rowCount: args.rowCount,
            schemaVersion: "tenant-admin-institutional-export.v1",
            summary: args.summary,
        },
        outcome: args.outcome,
        recordId: args.requestId,
        sourceTenantId: actor.tenantId,
        tableName: "auditLogs",
        targetTenantId: actor.tenantId,
        timestamp: Date.now(),
    });
}
async function appendCatalogExportAudit(ctx, actor, args) {
    await ctx.runMutation(api_1.internal.functions.auditLogs.appendAuditLogFromAction, {
        action: "export",
        actorRole: actor.role,
        actorState: (0, audit_1.createAuthenticatedAuditActor)({
            role: actor.role,
            userId: actor.userId,
        }).state,
        actorUserId: actor.userId,
        entityType: "catalog",
        event: audit_1.AUDIT_EVENT_NAMES.catalogExported,
        metadata: {
            filters: args.filters,
            rowCount: args.filteredCount,
            summary: args.summary,
            tier: args.tier,
        },
        outcome: args.outcome,
        sourceTenantId: actor.tenantId,
        tableName: "procurementItems",
        targetTenantId: actor.tenantId,
        timestamp: Date.now(),
    });
}
