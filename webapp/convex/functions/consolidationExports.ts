import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { appendAuditLogRequired } from "./_audit";
import { requireTenantRole } from "./_roleGuard";
import {
  AUDIT_EVENT_NAMES,
  AUDIT_OUTCOMES,
  createAuthenticatedAuditActor,
} from "../../lib/shared/security/audit";

const EXPORT_STALE_TIMEOUT_MS = 15 * 60 * 1000;
const EXPORT_FILE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const FINALIZED_EXPORT_BLOCKED_MESSAGE =
  "Finalize the consolidation before exporting";

type DataCtx = MutationCtx | QueryCtx;

function safeErrorMessage(value: unknown): string {
  if (!(value instanceof Error) || value.message.trim().length === 0) {
    return "Export generation failed.";
  }
  return value.message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .slice(0, 240);
}

async function loadProcurementOfficerTenantUser(
  ctx: DataCtx,
  args: { tenantId: Id<"tenants">; userId: Id<"users"> },
) {
  const tenantUser = await ctx.db
    .query("tenantUsers")
    .withIndex("by_userId_tenantId", (q) =>
      q.eq("userId", args.userId).eq("tenantId", args.tenantId),
    )
    .first();

  if (!tenantUser || !tenantUser.isActive || tenantUser.role !== "procurement_officer") {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Procurement Officer access is required for consolidation export.",
    });
  }

  return tenantUser;
}

async function loadCurrentFinalizedSnapshot(
  ctx: DataCtx,
  consolidationId: Id<"consolidations">,
) {
  return ctx.db
    .query("consolidationSnapshots")
    .withIndex("by_consolidationId", (q) => q.eq("consolidationId", consolidationId))
    .order("desc")
    .first();
}

function buildAuditEntry(args: {
  action: "download" | "export";
  actorUserId: Id<"users">;
  consolidationId: Id<"consolidations">;
  event:
    | typeof AUDIT_EVENT_NAMES.consolidationExportCompleted
    | typeof AUDIT_EVENT_NAMES.consolidationExportDownloaded
    | typeof AUDIT_EVENT_NAMES.consolidationExportFailed
    | typeof AUDIT_EVENT_NAMES.consolidationExportRequested;
  exportId: Id<"consolidationExports">;
  fiscalYear: string;
  metadata?: Record<string, unknown>;
  outcome: string;
  snapshotId: Id<"consolidationSnapshots">;
  tenantId: Id<"tenants">;
}) {
  return {
    action: args.action,
    actor: createAuthenticatedAuditActor({
      role: "procurement_officer",
      userId: String(args.actorUserId),
    }),
    entityType: "consolidation_export",
    event: args.event,
    metadata: {
      consolidationId: String(args.consolidationId),
      exportId: String(args.exportId),
      fiscalYear: args.fiscalYear,
      snapshotId: String(args.snapshotId),
      ...(args.metadata ?? {}),
    },
    outcome: args.outcome as typeof AUDIT_OUTCOMES.allowed,
    recordId: String(args.exportId),
    sourceTenantId: String(args.tenantId),
    tableName: "consolidationExports",
    targetTenantId: String(args.tenantId),
    timestamp: Date.now(),
  } as const;
}

function mapExport(record: Doc<"consolidationExports">) {
  const now = Date.now();
  const expired =
    record.status === "completed" &&
    typeof record.fileExpiresAt === "number" &&
    record.fileExpiresAt <= now;

  return {
    completedAt: record.completedAt ?? null,
    consolidationId: String(record.consolidationId),
    downloadCount: record.downloadCount,
    downloadUrl: expired ? null : record.downloadUrl ?? null,
    errorMessage: record.errorMessage ?? null,
    expired,
    exportId: String(record._id),
    fileExpiresAt: record.fileExpiresAt ?? null,
    fiscalYear: record.fiscalYear,
    format: record.format,
    generatedAt: record.generatedAt ?? null,
    id: String(record._id),
    lastDownloadedAt: record.lastDownloadedAt ?? null,
    progress: record.progress ?? null,
    safeFileName: record.safeFileName,
    snapshotId: String(record.snapshotId),
    status: expired ? "expired" : record.status,
  };
}

export const getProcurementOfficerConsolidationExportHistory = query({
  args: {
    consolidationId: v.optional(v.id("consolidations")),
    fiscalYear: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    await loadProcurementOfficerTenantUser(ctx, {
      tenantId: authContext.tenantId,
      userId: authContext.userId,
    });

    const rows = await ctx.db
      .query("consolidationExports")
      .withIndex("by_tenantId_fiscalYear", (q) =>
        q.eq("tenantId", authContext.tenantId).eq("fiscalYear", args.fiscalYear),
      )
      .order("desc")
      .take(20);

    return rows
      .filter((row) => !args.consolidationId || row.consolidationId === args.consolidationId)
      .map(mapExport);
  },
});

export const getProcurementOfficerConsolidationExcelPreview = query({
  args: {
    consolidationId: v.id("consolidations"),
    fiscalYear: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    await loadProcurementOfficerTenantUser(ctx, {
      tenantId: authContext.tenantId,
      userId: authContext.userId,
    });
    const consolidation = await ctx.db.get(args.consolidationId);
    if (
      !consolidation ||
      consolidation.tenantId !== authContext.tenantId ||
      consolidation.fiscalYear !== args.fiscalYear ||
      consolidation.status !== "finalized"
    ) {
      throw new ConvexError({
        code: "FINALIZATION_REQUIRED",
        message: FINALIZED_EXPORT_BLOCKED_MESSAGE,
      });
    }
    const snapshot = await loadCurrentFinalizedSnapshot(ctx, consolidation._id);
    if (
      !snapshot ||
      snapshot.tenantId !== authContext.tenantId ||
      snapshot.fiscalYear !== args.fiscalYear
    ) {
      throw new ConvexError({
        code: "FINALIZATION_REQUIRED",
        message: FINALIZED_EXPORT_BLOCKED_MESSAGE,
      });
    }

    return {
      columns: ["Fiscal Year", "Departments", "Items", "Q1", "Q2", "Q3", "Q4", "Total"],
      rows: [
        [
          snapshot.fiscalYear,
          snapshot.selectedSourceDepartmentIds.length,
          snapshot.calculatedTotals?.itemCount ?? 0,
          snapshot.calculatedTotals?.q1Total ?? 0,
          snapshot.calculatedTotals?.q2Total ?? 0,
          snapshot.calculatedTotals?.q3Total ?? 0,
          snapshot.calculatedTotals?.q4Total ?? 0,
          snapshot.calculatedTotals?.totalCost ?? 0,
        ],
      ],
      snapshotId: String(snapshot._id),
      workspaceState: snapshot.workspaceState ?? null,
    };
  },
});

export const prepareConsolidatedPlanExcelExport = internalMutation({
  args: {
    consolidationId: v.id("consolidations"),
    fiscalYear: v.string(),
    format: v.union(v.literal("xlsx"), v.literal("audit_xlsx")),
    idempotencyKey: v.string(),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const tenantUser = await loadProcurementOfficerTenantUser(ctx, {
      tenantId: args.tenantId,
      userId: args.userId,
    });
    const tenant = await ctx.db.get(args.tenantId);
    const consolidation = await ctx.db.get(args.consolidationId);
    if (
      !consolidation ||
      consolidation.tenantId !== args.tenantId ||
      consolidation.fiscalYear !== args.fiscalYear ||
      consolidation.status !== "finalized"
    ) {
      throw new ConvexError({
        code: "FINALIZATION_REQUIRED",
        message: FINALIZED_EXPORT_BLOCKED_MESSAGE,
      });
    }
    const snapshot = await loadCurrentFinalizedSnapshot(ctx, consolidation._id);
    if (
      !snapshot ||
      snapshot.tenantId !== args.tenantId ||
      snapshot.consolidationId !== consolidation._id ||
      snapshot.fiscalYear !== args.fiscalYear
    ) {
      throw new ConvexError({
        code: "FINALIZATION_REQUIRED",
        message: FINALIZED_EXPORT_BLOCKED_MESSAGE,
      });
    }

    const duplicate = await ctx.db
      .query("consolidationExports")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
    if (duplicate) {
      return {
        export: mapExport(duplicate),
        formatterPayload: null,
        status: "duplicate",
      };
    }

    const now = Date.now();
    const safeFileName = `consolidated-plan-${args.fiscalYear}-${String(snapshot._id).slice(-8)}.xlsx`;
    const exportId = await ctx.db.insert("consolidationExports", {
      consolidationId: consolidation._id,
      createdAt: now,
      downloadCount: 0,
      fiscalYear: args.fiscalYear,
      format: args.format,
      generatedByTenantUserId: tenantUser._id,
      generatedByUserId: args.userId,
      idempotencyKey: args.idempotencyKey,
      progress: 0,
      queuedAt: now,
      safeFileName,
      snapshotId: snapshot._id,
      staleTimeoutAt: now + EXPORT_STALE_TIMEOUT_MS,
      status: "queued",
      tenantId: args.tenantId,
      updatedAt: now,
    });
    await appendAuditLogRequired(
      ctx,
      buildAuditEntry({
        action: "export",
        actorUserId: args.userId,
        consolidationId: consolidation._id,
        event: AUDIT_EVENT_NAMES.consolidationExportRequested,
        exportId,
        fiscalYear: args.fiscalYear,
        metadata: { format: args.format },
        outcome: AUDIT_OUTCOMES.queued,
        snapshotId: snapshot._id,
        tenantId: args.tenantId,
      }),
    );

    return {
      export: mapExport((await ctx.db.get(exportId)) as Doc<"consolidationExports">),
      formatterPayload: {
        audit: {
          requestedAt: now,
          requestedByTenantUserId: String(tenantUser._id),
          requestedByUserId: String(args.userId),
        },
        calculatedTotals: snapshot.calculatedTotals,
        complianceSummary: snapshot.complianceSummary,
        consolidationId: String(consolidation._id),
        exportId: String(exportId),
        fiscalYear: args.fiscalYear,
        generatedAt: now,
        generatedBy: {
          tenantUserId: String(tenantUser._id),
          userId: String(args.userId),
        },
        institution: {
          name: tenant?.name ?? "Institution",
          tenantId: String(args.tenantId),
        },
        selectedSourceDepartmentIds: snapshot.selectedSourceDepartmentIds,
        snapshotId: String(snapshot._id),
        sourcePlanIds: snapshot.sourcePlanIds,
        workspaceState: snapshot.workspaceState ?? null,
      },
      status: "created",
    };
  },
});

export const attachQueuedConsolidatedPlanExportJob = internalMutation({
  args: {
    eventKey: v.string(),
    exportId: v.id("consolidationExports"),
    jobId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.exportId, {
      serviceEventKey: args.eventKey,
      serviceJobId: args.jobId,
      status: "processing",
      processingStartedAt: Date.now(),
      progress: 10,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const failConsolidatedPlanExport = internalMutation({
  args: {
    errorMessage: v.string(),
    exportId: v.id("consolidationExports"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const exportRow = await ctx.db.get(args.exportId);
    if (!exportRow) {
      return null;
    }
    await ctx.db.patch(args.exportId, {
      downloadUrl: undefined,
      errorMessage: args.errorMessage,
      failedAt: Date.now(),
      progress: 100,
      status: "failed",
      updatedAt: Date.now(),
    });
    await appendAuditLogRequired(
      ctx,
      buildAuditEntry({
        action: "export",
        actorUserId: exportRow.generatedByUserId,
        consolidationId: exportRow.consolidationId,
        event: AUDIT_EVENT_NAMES.consolidationExportFailed,
        exportId: exportRow._id,
        fiscalYear: exportRow.fiscalYear,
        metadata: { errorMessage: args.errorMessage },
        outcome: AUDIT_OUTCOMES.failed,
        snapshotId: exportRow.snapshotId,
        tenantId: exportRow.tenantId,
      }),
    );
    return null;
  },
});

export const markStaleConsolidatedPlanExportsFailed = mutation({
  args: { fiscalYear: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    const now = Date.now();
    const rows = await ctx.db
      .query("consolidationExports")
      .withIndex("by_tenantId_fiscalYear", (q) =>
        q.eq("tenantId", authContext.tenantId).eq("fiscalYear", args.fiscalYear),
      )
      .collect();
    let failedCount = 0;
    for (const row of rows) {
      if (
        (row.status === "queued" || row.status === "processing") &&
        row.staleTimeoutAt <= now
      ) {
        await ctx.db.patch(row._id, {
          errorMessage: "Export timed out. Retry from export history.",
          failedAt: now,
          progress: 100,
          status: "failed",
          updatedAt: now,
        });
        failedCount += 1;
      }
    }
    return failedCount;
  },
});

export const recordConsolidatedPlanExportDownload = mutation({
  args: { exportId: v.id("consolidationExports") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    const tenantUser = await loadProcurementOfficerTenantUser(ctx, {
      tenantId: authContext.tenantId,
      userId: authContext.userId,
    });
    const exportRow = await ctx.db.get(args.exportId);
    if (
      !exportRow ||
      exportRow.tenantId !== authContext.tenantId ||
      exportRow.status !== "completed" ||
      !exportRow.downloadUrl ||
      (exportRow.fileExpiresAt && exportRow.fileExpiresAt <= Date.now())
    ) {
      throw new ConvexError({
        code: "DOWNLOAD_UNAVAILABLE",
        message: "This export is not available for download.",
      });
    }
    const now = Date.now();
    await ctx.db.patch(exportRow._id, {
      downloadCount: exportRow.downloadCount + 1,
      lastDownloadedAt: now,
      lastDownloadedByTenantUserId: tenantUser._id,
      updatedAt: now,
    });
    await appendAuditLogRequired(
      ctx,
      buildAuditEntry({
        action: "download",
        actorUserId: authContext.userId,
        consolidationId: exportRow.consolidationId,
        event: AUDIT_EVENT_NAMES.consolidationExportDownloaded,
        exportId: exportRow._id,
        fiscalYear: exportRow.fiscalYear,
        outcome: AUDIT_OUTCOMES.allowed,
        snapshotId: exportRow.snapshotId,
        tenantId: exportRow.tenantId,
      }),
    );
    return { downloadUrl: exportRow.downloadUrl };
  },
});

export const completeConsolidatedPlanExportFromService = internalMutation({
  args: {
    checksum: v.optional(v.string()),
    downloadUrl: v.optional(v.string()),
    exportId: v.id("consolidationExports"),
    fileSizeBytes: v.optional(v.number()),
    storageId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const exportRow = await ctx.db.get(args.exportId);
    if (!exportRow) {
      return null;
    }
    const now = Date.now();
    await ctx.db.patch(args.exportId, {
      checksum: args.checksum,
      completedAt: now,
      downloadUrl: args.downloadUrl,
      fileExpiresAt: now + EXPORT_FILE_RETENTION_MS,
      fileSizeBytes: args.fileSizeBytes,
      generatedAt: now,
      progress: 100,
      status: "completed",
      storageId: args.storageId,
      updatedAt: now,
    });
    await appendAuditLogRequired(
      ctx,
      buildAuditEntry({
        action: "export",
        actorUserId: exportRow.generatedByUserId,
        consolidationId: exportRow.consolidationId,
        event: AUDIT_EVENT_NAMES.consolidationExportCompleted,
        exportId: exportRow._id,
        fiscalYear: exportRow.fiscalYear,
        outcome: AUDIT_OUTCOMES.allowed,
        snapshotId: exportRow.snapshotId,
        tenantId: exportRow.tenantId,
      }),
    );
    return null;
  },
});

export { FINALIZED_EXPORT_BLOCKED_MESSAGE, safeErrorMessage };
