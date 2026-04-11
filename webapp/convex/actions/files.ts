"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { callNestService, getServiceActorContext } from "./_helpers";
import {
  AUDIT_EVENT_NAMES,
  AUDIT_OUTCOMES,
  createAuthenticatedAuditActor,
} from "../../lib/security/audit";
import { getProcurementCatalogExportGuardState } from "../../lib/procurement-officer/catalog-filters";
import {
  buildProcurementCatalogExportRows,
  type ProcurementItemWorkspaceRow,
} from "../../lib/procurement-officer/items";

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
