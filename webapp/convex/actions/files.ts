"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action, internalAction } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { callNestService, getServiceActorContext } from "./_helpers";
import {
  AUDIT_EVENT_NAMES,
  AUDIT_OUTCOMES,
  createAuthenticatedAuditActor,
} from "../../lib/shared/security/audit";
import { getProcurementCatalogExportGuardState } from "../../lib/procurement-officer/catalog-filters";
import {
  buildProcurementCatalogExportRows,
  type ProcurementItemWorkspaceRow,
} from "../../lib/procurement-officer/items";
import { buildProcurementOfficerMonitoringExportRows } from "../../lib/procurement-officer/submission-monitoring";
import {
  buildInstitutionalExportPreview,
  filterInstitutionalOverviewRows,
  summarizeInstitutionalOverview,
  type TenantAdminInstitutionalOverview,
} from "../../lib/shared/tenant-admin/institutional-visibility";
import {
  buildAuditReportRows,
  buildBudgetReportRows,
  buildTenantAdminReportMetadata,
  buildTenantAdminReportServicePath,
  validateTenantAdminReportParameters,
  type TenantAdminReportParameters,
} from "../../lib/shared/tenant-admin/report-generation";

interface CatalogBrowseResult {
  meta: {
    filteredCount: number;
    normalizedFilters: {
      categoryIds: string[];
      complianceFlags: string[];
      maxPrice: number | null;
      minPrice: number | null;
      page: number;
      searchText: string;
    };
    tier: "enterprise" | "free" | "professional" | "starter";
  };
  rows: ProcurementItemWorkspaceRow[];
}

export const createExcelExport = action({
  args: {
    idempotencyKey: v.optional(v.string()),
    reportName: v.string(),
    rows: v.array(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    return callNestService(ctx, {
      actor,
      body: args,
      path: "/api/services/files/exports/excel",
    });
  },
});

export const queueExcelExport = action({
  args: {
    idempotencyKey: v.optional(v.string()),
    reportName: v.string(),
    rows: v.array(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    return callNestService(ctx, {
      actor,
      body: args,
      path: "/api/services/files/exports/excel/queue",
    });
  },
});

export const importWorkbook = action({
  args: {
    workbookBase64: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    return callNestService(ctx, {
      actor,
      body: args,
      path: "/api/services/files/imports/excel",
    });
  },
});

export const createPdf = action({
  args: {
    body: v.string(),
    title: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    return callNestService(ctx, {
      actor,
      body: args,
      path: "/api/services/files/exports/pdf",
    });
  },
});

export const exportCatalogItems = action({
  args: {
    categoryIds: v.array(v.string()),
    complianceFlags: v.array(v.string()),
    maxPrice: v.optional(v.number()),
    minPrice: v.optional(v.number()),
    searchText: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    const firstPage = (await ctx.runQuery(
      api.functions.items.browseItemsCatalog,
      {
        ...args,
        page: 1,
        pageSize: 1,
      },
    )) as CatalogBrowseResult;
    const exportGuard = getProcurementCatalogExportGuardState({
      filteredCount: firstPage.meta.filteredCount,
      tier: firstPage.meta.tier,
    });

    if (exportGuard.kind !== "allowed") {
      await appendCatalogExportAudit(ctx, actor, {
        filteredCount: firstPage.meta.filteredCount,
        filters: firstPage.meta.normalizedFilters,
        outcome: AUDIT_OUTCOMES.failed,
        summary: exportGuard.description,
        tier: firstPage.meta.tier,
      });
      throw new ConvexError({
        code:
          exportGuard.kind === "empty" ? "VALIDATION_FAILED" : "QUOTA_EXCEEDED",
        message: exportGuard.description,
      });
    }

    const exportSnapshot = (await ctx.runQuery(
      api.functions.items.browseItemsCatalog,
      {
        categoryIds: firstPage.meta.normalizedFilters.categoryIds,
        complianceFlags: firstPage.meta.normalizedFilters.complianceFlags,
        maxPrice: firstPage.meta.normalizedFilters.maxPrice ?? undefined,
        minPrice: firstPage.meta.normalizedFilters.minPrice ?? undefined,
        page: 1,
        pageSize: firstPage.meta.filteredCount,
        searchText: firstPage.meta.normalizedFilters.searchText,
      },
    )) as CatalogBrowseResult;
    const finalGuard = getProcurementCatalogExportGuardState({
      filteredCount: exportSnapshot.meta.filteredCount,
      tier: exportSnapshot.meta.tier,
    });

    if (finalGuard.kind !== "allowed") {
      await appendCatalogExportAudit(ctx, actor, {
        filteredCount: exportSnapshot.meta.filteredCount,
        filters: exportSnapshot.meta.normalizedFilters,
        outcome: AUDIT_OUTCOMES.failed,
        summary: finalGuard.description,
        tier: exportSnapshot.meta.tier,
      });
      throw new ConvexError({
        code:
          finalGuard.kind === "empty" ? "VALIDATION_FAILED" : "QUOTA_EXCEEDED",
        message: finalGuard.description,
      });
    }

    try {
      const workbook = await callNestService<{
        fileName: string;
        workbookBase64: string;
      }>(ctx, {
        actor,
        body: {
          reportName: "Catalog Export",
          rows: buildProcurementCatalogExportRows(exportSnapshot.rows),
        },
        path: "/api/services/files/exports/excel",
      });

      await appendCatalogExportAudit(ctx, actor, {
        filteredCount: exportSnapshot.meta.filteredCount,
        filters: exportSnapshot.meta.normalizedFilters,
        outcome: AUDIT_OUTCOMES.allowed,
        summary: `Exported ${exportSnapshot.meta.filteredCount} catalog rows.`,
        tier: exportSnapshot.meta.tier,
      });

      return {
        ...workbook,
        filteredCount: exportSnapshot.meta.filteredCount,
      };
    } catch (error) {
      await appendCatalogExportAudit(ctx, actor, {
        filteredCount: exportSnapshot.meta.filteredCount,
        filters: exportSnapshot.meta.normalizedFilters,
        outcome: AUDIT_OUTCOMES.failed,
        summary:
          error instanceof Error && error.message.trim().length > 0
            ? error.message.trim()
            : "Catalog export failed.",
        tier: exportSnapshot.meta.tier,
      });
      throw error;
    }
  },
});

export const exportSubmissionMonitoringReport = action({
  args: {
    departmentIds: v.optional(v.array(v.string())),
    selectedFiscalYear: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    if (actor.role !== "procurement_officer" || !actor.tenantId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Procurement Officer access is required for this resource.",
      });
    }

    const monitoringWorkspace = (await ctx.runQuery(
      api.functions.procurementOfficerSubmissions
        .getProcurementOfficerSubmissionMonitoringWorkspace,
      {
        selectedFiscalYear: args.selectedFiscalYear,
      },
    )) as {
      meta: { selectedFiscalYearLabel: string };
      rows: Array<{
        departmentId: string;
        departmentName: string;
        duContactLabel: string;
        lastUpdatedLabel: string;
        statusLabel: string;
      }>;
    };
    const allowedDepartmentIds = new Set(args.departmentIds ?? []);
    const exportRows =
      allowedDepartmentIds.size > 0
        ? monitoringWorkspace.rows.filter((row) =>
            allowedDepartmentIds.has(row.departmentId),
          )
        : monitoringWorkspace.rows;

    if (exportRows.length === 0) {
      throw new ConvexError({
        code: "VALIDATION_FAILED",
        message: "No monitoring rows are available for export.",
      });
    }

    const workbook = await callNestService<{
      fileName: string;
      workbookBase64: string;
    }>(ctx, {
      actor,
      body: {
        reportName: `Submission Monitoring ${monitoringWorkspace.meta.selectedFiscalYearLabel}`,
        rows: buildProcurementOfficerMonitoringExportRows(exportRows),
      },
      path: "/api/services/files/exports/excel",
    });

    await ctx.runMutation(internal.functions.auditLogs.appendAuditLogFromAction, {
      action: "export",
      actorRole: actor.role,
      actorState: createAuthenticatedAuditActor({
        role: actor.role,
        userId: actor.userId,
      }).state,
      actorUserId: actor.userId as Id<"users">,
      entityType: "submission_monitoring",
      event: "submission_monitoring.exported" as any,
      metadata: {
        fiscalYear: args.selectedFiscalYear,
        rowCount: exportRows.length,
      },
      outcome: AUDIT_OUTCOMES.allowed,
      sourceTenantId: actor.tenantId as Id<"tenants"> | undefined,
      tableName: "plans",
      targetTenantId: actor.tenantId as Id<"tenants"> | undefined,
      timestamp: Date.now(),
    });

    return {
      ...workbook,
      filteredCount: exportRows.length,
    };
  },
});

export const queueTenantAdminInstitutionalExport = action({
  args: {
    fiscalYear: v.string(),
    procurementOfficerId: v.optional(v.string()),
    query: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("all"),
        v.literal("approved"),
        v.literal("draft"),
        v.literal("not_started"),
        v.literal("rejected"),
        v.literal("submitted"),
      ),
    ),
  },
  returns: v.object({
    asOf: v.number(),
    fileName: v.optional(v.string()),
    fiscalYear: v.string(),
    requestId: v.string(),
    schemaVersion: v.string(),
    state: v.union(v.literal("queued"), v.literal("export_ready")),
    tenantId: v.string(),
  }),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    if (actor.role !== "tenant_admin" || !actor.tenantId) {
      throw new ConvexError({
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
    const snapshot = (await ctx.runQuery(
      api.functions.tenantAdminDashboard.getTenantAdminDashboardSnapshot,
      { selectedFiscalYear: args.fiscalYear },
    )) as { institutionalOverview: TenantAdminInstitutionalOverview };
    const filteredRows = filterInstitutionalOverviewRows(
      snapshot.institutionalOverview.rows,
      {
        procurementOfficerId: args.procurementOfficerId ?? "all",
        query: args.query ?? "",
        status: args.status ?? "all",
      },
    );
    const filteredDepartmentIds = new Set(
      filteredRows.map((row) => row.departmentId),
    );
    const filteredAnomalies = snapshot.institutionalOverview.anomalies.filter(
      (anomaly) => filteredDepartmentIds.has(anomaly.departmentId),
    );
    const filteredOverview: TenantAdminInstitutionalOverview = {
      ...snapshot.institutionalOverview,
      anomalies: filteredAnomalies,
      rows: filteredRows,
      summary: summarizeInstitutionalOverview(filteredRows, filteredAnomalies),
    };
    const exportPreview = buildInstitutionalExportPreview({
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
      const queued = await callNestService<{
        fileName?: string;
        state?: "queued" | "export_ready";
      }>(ctx, {
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
        summary:
          state === "export_ready"
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
    } catch (error) {
      await appendTenantAdminInstitutionalExportAudit(ctx, actor, {
        asOf,
        fiscalYear: args.fiscalYear,
        outcome: "failed",
        requestId,
        rowCount: exportPreview.departments.length,
        summary:
          error instanceof Error && error.message.trim().length > 0
            ? error.message.trim()
            : "Institutional export generation failed.",
      });
      throw error;
    }
  },
});

export const queueTenantAdminReportGeneration = action({
  args: {
    parameters: v.object({
      dateRange: v.object({
        from: v.string(),
        to: v.string(),
      }),
      departmentId: v.union(v.string(), v.literal("all")),
      fiscalYear: v.string(),
      format: v.union(v.literal("csv"), v.literal("xlsx")),
      procurementOfficerId: v.union(v.string(), v.literal("all")),
      reportType: v.union(
        v.literal("activity"),
        v.literal("audit"),
        v.literal("budget"),
      ),
      status: v.union(
        v.literal("all"),
        v.literal("approved"),
        v.literal("draft"),
        v.literal("not_started"),
        v.literal("rejected"),
        v.literal("submitted"),
      ),
    }),
  },
  returns: v.object({
    fileName: v.optional(v.string()),
    jobId: v.string(),
    requestId: v.string(),
    schemaVersion: v.string(),
    state: v.union(v.literal("queued"), v.literal("ready")),
  }),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    if (actor.role !== "tenant_admin" || !actor.tenantId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Tenant Admin access is required for report generation.",
      });
    }

    const validation = validateTenantAdminReportParameters(
      args.parameters as TenantAdminReportParameters,
    );
    if (!validation.valid) {
      throw new ConvexError({
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
    const snapshot = (await ctx.runQuery(
      api.functions.tenantAdminDashboard.getTenantAdminDashboardSnapshot,
      { selectedFiscalYear: args.parameters.fiscalYear },
    )) as { institutionalOverview: TenantAdminInstitutionalOverview; meta: { tenantName: string } };
    const source = (await ctx.runQuery(
      api.functions.tenantAdminReports.getTenantAdminReportSource,
      { fiscalYear: args.parameters.fiscalYear },
    )) as {
      auditLogs: Parameters<typeof buildAuditReportRows>[0];
      tenantName: string;
    };
    const metadata = buildTenantAdminReportMetadata({
      generatedAt,
      generatedByTenantUserId: actor.userId,
      parameters: args.parameters as TenantAdminReportParameters,
      tenantId: String(actor.tenantId),
      tenantName: snapshot.meta.tenantName || source.tenantName,
    });
    const rows =
      args.parameters.reportType === "budget"
        ? buildBudgetReportRows({
            overview: snapshot.institutionalOverview,
            parameters: args.parameters as TenantAdminReportParameters,
          })
        : buildAuditReportRows(source.auditLogs);
    const reportName = `${humanizeTenantAdminReportType(args.parameters.reportType)} Report ${args.parameters.fiscalYear}`;

    await appendTenantAdminReportAudit(ctx, actor, {
      outcome: "queued",
      reportType: args.parameters.reportType,
      requestId,
      rowCount: rows.length,
      summary: "Tenant Admin report request queued for server-side generation.",
    });

    try {
      const jobId = (await ctx.runMutation(
        internal.functions.tenantAdminReports.createTenantAdminReportJobFromAction,
        {
          idempotencyKey: requestId,
          metadata,
          parameters: args.parameters,
          reportName,
          status: "queued",
        },
      )) as string;
      const queued = await callNestService<{
        downloadUrl?: string;
        fileName?: string;
        jobId?: string;
        state?: "queued" | "export_ready" | "ready";
      }>(ctx, {
        actor,
        body: {
          idempotencyKey: requestId,
          metadata,
          reportName,
          rows,
        },
        path: buildTenantAdminReportServicePath(args.parameters.format),
      });
      const state: "queued" | "ready" =
        queued.state === "export_ready" || queued.state === "ready"
          ? "ready"
          : "queued";
      if (state === "ready") {
        await ctx.runMutation(
          internal.functions.tenantAdminReports.completeTenantAdminReportJobFromService,
          {
            downloadUrl: queued.downloadUrl,
            fileName: queued.fileName,
            reportJobId: jobId as Id<"tenantAdminReportJobs">,
            serviceJobId: queued.jobId,
          },
        );
      } else {
        await ctx.runMutation(
          internal.functions.tenantAdminReports.attachTenantAdminReportServiceJob,
          {
            reportJobId: jobId as Id<"tenantAdminReportJobs">,
            serviceJobId: queued.jobId,
          },
        );
      }
      await appendTenantAdminReportAudit(ctx, actor, {
        outcome: state,
        reportType: args.parameters.reportType,
        requestId,
        rowCount: rows.length,
        summary:
          state === "ready"
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
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : "Tenant Admin report generation failed.";
      await appendTenantAdminReportAudit(ctx, actor, {
        outcome: "failed",
        reportType: args.parameters.reportType,
        requestId,
        rowCount: rows.length,
        summary: message,
      });
      await ctx.runMutation(
        internal.functions.tenantAdminReports.markTenantAdminReportJobFailedFromAction,
        {
          errorMessage: message.slice(0, 240),
          idempotencyKey: requestId,
        },
      );
      throw error;
    }
  },
});

export const runDueTenantAdminReportSchedules = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const schedules = (await ctx.runMutation(
      internal.functions.tenantAdminReports.listDueTenantAdminReportSchedules,
      { now, limit: 20 },
    )) as Array<{
      _id: Id<"tenantAdminReportSchedules">;
      createdByTenantUserId: Id<"tenantUsers">;
      parameters: TenantAdminReportParameters;
      reportType: "activity" | "budget";
      tenantId: Id<"tenants">;
    }>;

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
        await ctx.runMutation(
          internal.functions.tenantAdminReports.markTenantAdminReportScheduleSuccess,
          { scheduleId: schedule._id },
        );
      } catch (error) {
        await ctx.runMutation(
          internal.functions.tenantAdminReports.markTenantAdminReportScheduleFailure,
          {
            errorMessage:
              error instanceof Error && error.message.trim().length > 0
                ? error.message
                : "Scheduled report generation failed.",
            scheduleId: schedule._id,
          },
        );
      }
    }

    return null;
  },
});

export const queueConsolidatedPlanExcelExport = action({
  args: {
    consolidationId: v.id("consolidations"),
    fiscalYear: v.string(),
    format: v.optional(v.union(v.literal("xlsx"), v.literal("audit_xlsx"))),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    if (actor.role !== "procurement_officer" || !actor.tenantId) {
      throw new ConvexError({
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
    const prepared = (await ctx.runMutation(
      internal.functions.consolidationExports.prepareConsolidatedPlanExcelExport,
      {
        consolidationId: args.consolidationId,
        fiscalYear: args.fiscalYear,
        format: args.format ?? "xlsx",
        idempotencyKey,
        tenantId: actor.tenantId as Id<"tenants">,
        userId: actor.userId as Id<"users">,
      },
    )) as {
      export: { exportId: string };
      formatterPayload: Record<string, unknown> | null;
      status: "created" | "duplicate";
    };

    if (prepared.status === "duplicate" || !prepared.formatterPayload) {
      return prepared.export;
    }

    try {
      const queued = await callNestService<{
        eventKey: string;
        fileName?: string;
        jobId?: string;
        queued: boolean;
        workbookBase64?: string;
      }>(ctx, {
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
      await ctx.runMutation(
        internal.functions.consolidationExports.attachQueuedConsolidatedPlanExportJob,
        {
          eventKey: queued.eventKey,
          exportId: prepared.export.exportId as Id<"consolidationExports">,
          jobId: queued.jobId,
        },
      );
      return {
        ...prepared.export,
        eventKey: queued.eventKey,
        jobId: queued.jobId ?? null,
        status: "processing",
      };
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message.trim().slice(0, 240)
          : "Export generation failed.";
      await ctx.runMutation(
        internal.functions.consolidationExports.failConsolidatedPlanExport,
        {
          errorMessage: message,
          exportId: prepared.export.exportId as Id<"consolidationExports">,
        },
      );
      throw error;
    }
  },
});

async function appendTenantAdminInstitutionalExportAudit(
  ctx: ActionCtx,
  actor: Awaited<ReturnType<typeof getServiceActorContext>>,
  args: {
    asOf: number;
    fiscalYear: string;
    outcome: string;
    requestId: string;
    rowCount: number;
    summary: string;
  },
) {
  await ctx.runMutation(internal.functions.auditLogs.appendAuditLogFromAction, {
    action: "export",
    actorRole: actor.role,
    actorState: createAuthenticatedAuditActor({
      role: actor.role,
      userId: actor.userId,
    }).state,
    actorUserId: actor.userId as Id<"users">,
    entityType: "tenant_admin_institutional_export",
    event: "tenant_admin.institutional_export.requested" as any,
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
    sourceTenantId: actor.tenantId as Id<"tenants"> | undefined,
    tableName: "auditLogs",
    targetTenantId: actor.tenantId as Id<"tenants"> | undefined,
    timestamp: Date.now(),
  });
}

async function appendTenantAdminReportAudit(
  ctx: ActionCtx,
  actor: Awaited<ReturnType<typeof getServiceActorContext>>,
  args: {
    outcome: string;
    reportType: string;
    requestId: string;
    rowCount: number;
    summary: string;
  },
) {
  await ctx.runMutation(internal.functions.auditLogs.appendAuditLogFromAction, {
    action: "export",
    actorRole: actor.role,
    actorState: createAuthenticatedAuditActor({
      role: actor.role,
      userId: actor.userId,
    }).state,
    actorUserId: actor.userId as Id<"users">,
    entityType: "tenant_admin_report",
    event: "tenant_admin.report.generated" as any,
    metadata: {
      reportType: args.reportType,
      requestId: args.requestId,
      rowCount: args.rowCount,
      schemaVersion: "tenant-admin-report.v1",
      summary: args.summary,
    },
    outcome: args.outcome,
    recordId: args.requestId,
    sourceTenantId: actor.tenantId as Id<"tenants"> | undefined,
    tableName: "tenantAdminReportJobs",
    targetTenantId: actor.tenantId as Id<"tenants"> | undefined,
    timestamp: Date.now(),
  });
}

async function queueTenantAdminReportForActor(
  ctx: ActionCtx,
  args: {
    actor: {
      role: "tenant_admin";
      tenantId: string;
      userId: string;
    };
    parameters: TenantAdminReportParameters;
    scheduleId: Id<"tenantAdminReportSchedules">;
  },
): Promise<void> {
  const generatedAt = Date.now();
  const requestId = [
    "tenant-admin-scheduled-report",
    args.actor.tenantId,
    args.parameters.reportType,
    args.parameters.fiscalYear,
    args.scheduleId,
    String(generatedAt),
  ].join(":");
  const metadata = buildTenantAdminReportMetadata({
    generatedAt,
    generatedByTenantUserId: args.actor.userId,
    parameters: args.parameters,
    tenantId: args.actor.tenantId,
    tenantName: "Tenant",
  });
  const reportName = `${humanizeTenantAdminReportType(args.parameters.reportType)} Report ${args.parameters.fiscalYear}`;
  const jobId = (await ctx.runMutation(
    internal.functions.tenantAdminReports.createTenantAdminReportJobForSchedule,
    {
      idempotencyKey: requestId,
      metadata: {
        ...metadata,
        scheduleId: String(args.scheduleId),
      },
      parameters: args.parameters,
      reportName,
      tenantId: args.actor.tenantId as Id<"tenants">,
      tenantUserId: args.actor.userId as Id<"tenantUsers">,
    },
  )) as Id<"tenantAdminReportJobs">;
  const queued = await callNestService<{
    downloadUrl?: string;
    fileName?: string;
    jobId?: string;
    state?: "queued" | "export_ready" | "ready";
  }>(ctx, {
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
    path: buildTenantAdminReportServicePath(args.parameters.format),
  });

  if (queued.state === "export_ready" || queued.state === "ready") {
    await ctx.runMutation(
      internal.functions.tenantAdminReports.completeTenantAdminReportJobFromService,
      {
        downloadUrl: queued.downloadUrl,
        fileName: queued.fileName,
        reportJobId: jobId,
        serviceJobId: queued.jobId,
      },
    );
  } else {
    await ctx.runMutation(
      internal.functions.tenantAdminReports.attachTenantAdminReportServiceJob,
      {
        reportJobId: jobId,
        serviceJobId: queued.jobId,
      },
    );
  }
}

function humanizeTenantAdminReportType(reportType: string): string {
  return reportType.charAt(0).toUpperCase() + reportType.slice(1);
}

async function appendCatalogExportAudit(
  ctx: ActionCtx,
  actor: Awaited<ReturnType<typeof getServiceActorContext>>,
  args: {
    filteredCount: number;
    filters: CatalogBrowseResult["meta"]["normalizedFilters"];
    outcome: typeof AUDIT_OUTCOMES.allowed | typeof AUDIT_OUTCOMES.failed;
    summary: string;
    tier: CatalogBrowseResult["meta"]["tier"];
  },
) {
  await ctx.runMutation(internal.functions.auditLogs.appendAuditLogFromAction, {
    action: "export",
    actorRole: actor.role,
    actorState: createAuthenticatedAuditActor({
      role: actor.role,
      userId: actor.userId,
    }).state,
    actorUserId: actor.userId as Id<"users">,
    entityType: "catalog",
    event: AUDIT_EVENT_NAMES.catalogExported,
    metadata: {
      filters: args.filters,
      rowCount: args.filteredCount,
      summary: args.summary,
      tier: args.tier,
    },
    outcome: args.outcome,
    sourceTenantId: actor.tenantId as Id<"tenants"> | undefined,
    tableName: "procurementItems",
    targetTenantId: actor.tenantId as Id<"tenants"> | undefined,
    timestamp: Date.now(),
  });
}
