"use node";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueConsolidatedPlanExcelExport = exports.runDueTenantAdminReportSchedules = exports.queueTenantAdminReportGeneration = exports.queueTenantAdminInstitutionalExport = exports.exportSubmissionMonitoringReport = exports.exportCatalogItems = exports.createPdf = exports.importWorkbook = exports.queueExcelExport = exports.createExcelExport = void 0;
const values_1 = require("convex/values");
const api_1 = require("../_generated/api");
const server_1 = require("../_generated/server");
const _helpers_1 = require("./_helpers");
const audit_1 = require("../../lib/shared/security/audit");
const catalog_filters_1 = require("../../lib/procurement-officer/catalog-filters");
const items_1 = require("../../lib/procurement-officer/items");
const submission_monitoring_1 = require("../../lib/procurement-officer/submission-monitoring");
const institutional_visibility_1 = require("../../lib/shared/tenant-admin/institutional-visibility");
const report_generation_1 = require("../../lib/shared/tenant-admin/report-generation");
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
exports.queueTenantAdminReportGeneration = (0, server_1.action)({
    args: {
        parameters: values_1.v.object({
            dateRange: values_1.v.object({
                from: values_1.v.string(),
                to: values_1.v.string(),
            }),
            departmentId: values_1.v.union(values_1.v.string(), values_1.v.literal("all")),
            fiscalYear: values_1.v.string(),
            format: values_1.v.union(values_1.v.literal("csv"), values_1.v.literal("xlsx")),
            procurementOfficerId: values_1.v.union(values_1.v.string(), values_1.v.literal("all")),
            reportType: values_1.v.union(values_1.v.literal("activity"), values_1.v.literal("audit"), values_1.v.literal("budget")),
            status: values_1.v.union(values_1.v.literal("all"), values_1.v.literal("approved"), values_1.v.literal("draft"), values_1.v.literal("not_started"), values_1.v.literal("rejected"), values_1.v.literal("submitted")),
        }),
    },
    returns: values_1.v.object({
        fileName: values_1.v.optional(values_1.v.string()),
        jobId: values_1.v.string(),
        requestId: values_1.v.string(),
        schemaVersion: values_1.v.string(),
        state: values_1.v.union(values_1.v.literal("queued"), values_1.v.literal("ready")),
    }),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        if (actor.role !== "tenant_admin" || !actor.tenantId) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Tenant Admin access is required for report generation.",
            });
        }
        const validation = (0, report_generation_1.validateTenantAdminReportParameters)(args.parameters);
        if (!validation.valid) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: validation.issues.join(" "),
            });
        }
        const generatedAt = Date.now();
        const requestId = [
            "tenant-admin-report",
            actor.tenantId,
            args.parameters.reportType,
            args.parameters.fiscalYear,
            actor.userId,
            String(generatedAt),
        ].join(":");
        const snapshot = (await ctx.runQuery(api_1.api.functions.tenantAdminDashboard.getTenantAdminDashboardSnapshot, { selectedFiscalYear: args.parameters.fiscalYear }));
        const source = (await ctx.runQuery(api_1.api.functions.tenantAdminReports.getTenantAdminReportSource, { fiscalYear: args.parameters.fiscalYear }));
        const metadata = (0, report_generation_1.buildTenantAdminReportMetadata)({
            generatedAt,
            generatedByTenantUserId: actor.userId,
            parameters: args.parameters,
            tenantId: String(actor.tenantId),
            tenantName: snapshot.meta.tenantName || source.tenantName,
        });
        const rows = args.parameters.reportType === "budget"
            ? (0, report_generation_1.buildBudgetReportRows)({
                overview: snapshot.institutionalOverview,
                parameters: args.parameters,
            })
            : (0, report_generation_1.buildAuditReportRows)(source.auditLogs);
        const reportName = `${humanizeTenantAdminReportType(args.parameters.reportType)} Report ${args.parameters.fiscalYear}`;
        await appendTenantAdminReportAudit(ctx, actor, {
            outcome: "queued",
            reportType: args.parameters.reportType,
            requestId,
            rowCount: rows.length,
            summary: "Tenant Admin report request queued for server-side generation.",
        });
        try {
            const jobId = (await ctx.runMutation(api_1.internal.functions.tenantAdminReports.createTenantAdminReportJobFromAction, {
                idempotencyKey: requestId,
                metadata,
                parameters: args.parameters,
                reportName,
                status: "queued",
            }));
            const queued = await (0, _helpers_1.callNestService)(ctx, {
                actor,
                body: {
                    idempotencyKey: requestId,
                    metadata,
                    reportName,
                    rows,
                },
                path: (0, report_generation_1.buildTenantAdminReportServicePath)(args.parameters.format),
            });
            const state = queued.state === "export_ready" || queued.state === "ready"
                ? "ready"
                : "queued";
            if (state === "ready") {
                await ctx.runMutation(api_1.internal.functions.tenantAdminReports.completeTenantAdminReportJobFromService, {
                    downloadUrl: queued.downloadUrl,
                    fileName: queued.fileName,
                    reportJobId: jobId,
                    serviceJobId: queued.jobId,
                });
            }
            else {
                await ctx.runMutation(api_1.internal.functions.tenantAdminReports.attachTenantAdminReportServiceJob, {
                    reportJobId: jobId,
                    serviceJobId: queued.jobId,
                });
            }
            await appendTenantAdminReportAudit(ctx, actor, {
                outcome: state,
                reportType: args.parameters.reportType,
                requestId,
                rowCount: rows.length,
                summary: state === "ready"
                    ? "Tenant Admin report is ready for secure delivery."
                    : "Tenant Admin report is being generated server-side.",
            });
            return {
                jobId,
                requestId,
                schemaVersion: metadata.schemaVersion,
                state,
                ...(queued.fileName ? { fileName: queued.fileName } : {}),
            };
        }
        catch (error) {
            const message = error instanceof Error && error.message.trim().length > 0
                ? error.message.trim()
                : "Tenant Admin report generation failed.";
            await appendTenantAdminReportAudit(ctx, actor, {
                outcome: "failed",
                reportType: args.parameters.reportType,
                requestId,
                rowCount: rows.length,
                summary: message,
            });
            await ctx.runMutation(api_1.internal.functions.tenantAdminReports.markTenantAdminReportJobFailedFromAction, {
                errorMessage: message.slice(0, 240),
                idempotencyKey: requestId,
            });
            throw error;
        }
    },
});
exports.runDueTenantAdminReportSchedules = (0, server_1.internalAction)({
    args: {},
    returns: values_1.v.null(),
    handler: async (ctx) => {
        const now = Date.now();
        const schedules = (await ctx.runMutation(api_1.internal.functions.tenantAdminReports.listDueTenantAdminReportSchedules, { now, limit: 20 }));
        for (const schedule of schedules) {
            try {
                await queueTenantAdminReportForActor(ctx, {
                    actor: {
                        role: "tenant_admin",
                        tenantId: String(schedule.tenantId),
                        userId: String(schedule.createdByTenantUserId),
                    },
                    parameters: {
                        ...schedule.parameters,
                        reportType: schedule.reportType,
                    },
                    scheduleId: schedule._id,
                });
                await ctx.runMutation(api_1.internal.functions.tenantAdminReports.markTenantAdminReportScheduleSuccess, { scheduleId: schedule._id });
            }
            catch (error) {
                await ctx.runMutation(api_1.internal.functions.tenantAdminReports.markTenantAdminReportScheduleFailure, {
                    errorMessage: error instanceof Error && error.message.trim().length > 0
                        ? error.message
                        : "Scheduled report generation failed.",
                    scheduleId: schedule._id,
                });
            }
        }
        return null;
    },
});
exports.queueConsolidatedPlanExcelExport = (0, server_1.action)({
    args: {
        consolidationId: values_1.v.id("consolidations"),
        fiscalYear: values_1.v.string(),
        format: values_1.v.optional(values_1.v.union(values_1.v.literal("xlsx"), values_1.v.literal("audit_xlsx"))),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        if (actor.role !== "procurement_officer" || !actor.tenantId) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Procurement Officer access is required for this export.",
            });
        }
        const idempotencyKey = [
            "consolidated-plan-export",
            actor.tenantId,
            args.fiscalYear,
            args.consolidationId,
            actor.userId,
            String(Date.now()),
        ].join(":");
        const prepared = (await ctx.runMutation(api_1.internal.functions.consolidationExports.prepareConsolidatedPlanExcelExport, {
            consolidationId: args.consolidationId,
            fiscalYear: args.fiscalYear,
            format: args.format ?? "xlsx",
            idempotencyKey,
            tenantId: actor.tenantId,
            userId: actor.userId,
        }));
        if (prepared.status === "duplicate" || !prepared.formatterPayload) {
            return prepared.export;
        }
        try {
            const queued = await (0, _helpers_1.callNestService)(ctx, {
                actor,
                body: {
                    exportId: prepared.export.exportId,
                    formatterPayload: prepared.formatterPayload,
                    idempotencyKey,
                    reportName: `Consolidated Plan ${args.fiscalYear}`,
                },
                path: "/api/services/files/exports/consolidated-plan/queue",
            });
            if (!queued.queued) {
                return {
                    ...prepared.export,
                    eventKey: queued.eventKey,
                    fileName: queued.fileName ?? null,
                    jobId: null,
                    status: "completed",
                    workbookBase64: queued.workbookBase64 ?? null,
                };
            }
            await ctx.runMutation(api_1.internal.functions.consolidationExports.attachQueuedConsolidatedPlanExportJob, {
                eventKey: queued.eventKey,
                exportId: prepared.export.exportId,
                jobId: queued.jobId,
            });
            return {
                ...prepared.export,
                eventKey: queued.eventKey,
                jobId: queued.jobId ?? null,
                status: "processing",
            };
        }
        catch (error) {
            const message = error instanceof Error && error.message.trim().length > 0
                ? error.message.trim().slice(0, 240)
                : "Export generation failed.";
            await ctx.runMutation(api_1.internal.functions.consolidationExports.failConsolidatedPlanExport, {
                errorMessage: message,
                exportId: prepared.export.exportId,
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
async function appendTenantAdminReportAudit(ctx, actor, args) {
    await ctx.runMutation(api_1.internal.functions.auditLogs.appendAuditLogFromAction, {
        action: "export",
        actorRole: actor.role,
        actorState: (0, audit_1.createAuthenticatedAuditActor)({
            role: actor.role,
            userId: actor.userId,
        }).state,
        actorUserId: actor.userId,
        entityType: "tenant_admin_report",
        event: "tenant_admin.report.generated",
        metadata: {
            reportType: args.reportType,
            requestId: args.requestId,
            rowCount: args.rowCount,
            schemaVersion: "tenant-admin-report.v1",
            summary: args.summary,
        },
        outcome: args.outcome,
        recordId: args.requestId,
        sourceTenantId: actor.tenantId,
        tableName: "tenantAdminReportJobs",
        targetTenantId: actor.tenantId,
        timestamp: Date.now(),
    });
}
async function queueTenantAdminReportForActor(ctx, args) {
    const generatedAt = Date.now();
    const requestId = [
        "tenant-admin-scheduled-report",
        args.actor.tenantId,
        args.parameters.reportType,
        args.parameters.fiscalYear,
        args.scheduleId,
        String(generatedAt),
    ].join(":");
    const metadata = (0, report_generation_1.buildTenantAdminReportMetadata)({
        generatedAt,
        generatedByTenantUserId: args.actor.userId,
        parameters: args.parameters,
        tenantId: args.actor.tenantId,
        tenantName: "Tenant",
    });
    const reportName = `${humanizeTenantAdminReportType(args.parameters.reportType)} Report ${args.parameters.fiscalYear}`;
    const jobId = (await ctx.runMutation(api_1.internal.functions.tenantAdminReports.createTenantAdminReportJobForSchedule, {
        idempotencyKey: requestId,
        metadata: {
            ...metadata,
            scheduleId: String(args.scheduleId),
        },
        parameters: args.parameters,
        reportName,
        tenantId: args.actor.tenantId,
        tenantUserId: args.actor.userId,
    }));
    const queued = await (0, _helpers_1.callNestService)(ctx, {
        actor: args.actor,
        body: {
            idempotencyKey: requestId,
            metadata: {
                ...metadata,
                scheduleId: String(args.scheduleId),
            },
            reportName,
            rows: [],
        },
        path: (0, report_generation_1.buildTenantAdminReportServicePath)(args.parameters.format),
    });
    if (queued.state === "export_ready" || queued.state === "ready") {
        await ctx.runMutation(api_1.internal.functions.tenantAdminReports.completeTenantAdminReportJobFromService, {
            downloadUrl: queued.downloadUrl,
            fileName: queued.fileName,
            reportJobId: jobId,
            serviceJobId: queued.jobId,
        });
    }
    else {
        await ctx.runMutation(api_1.internal.functions.tenantAdminReports.attachTenantAdminReportServiceJob, {
            reportJobId: jobId,
            serviceJobId: queued.jobId,
        });
    }
}
function humanizeTenantAdminReportType(reportType) {
    return reportType.charAt(0).toUpperCase() + reportType.slice(1);
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
