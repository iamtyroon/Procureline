import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  action,
  internalMutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import {
  AUDIT_EVENT_NAMES,
  AUDIT_OUTCOMES,
  createAuthenticatedAuditActor,
} from "../../lib/security/audit";
import {
  buildCatalogRequestSummary,
  buildCatalogRequestStatusMeta,
  formatCatalogRequestDecisionReason,
  shouldExpireCatalogRequest,
  type CatalogRequestStatus,
  type CatalogRequestType,
} from "../../lib/procurement/catalog-requests";
import { normalizeCategoryName } from "../../lib/procurement-officer/categories";
import {
  buildProcurementItemCatalogSearchText,
  createProcurementItemPriceHistoryEntry,
  normalizeProcurementItemName,
} from "../../lib/procurement-officer/items";
import {
  isDenialUndoEligible,
  resolveProcurementRequestDenialUndoDeadline,
} from "../../lib/procurement-officer/requests";
import { categoryFormSchema } from "../../lib/validators/category";
import { itemFormSchema } from "../../lib/validators/item";
import { appendAuditLogRequired } from "./_audit";
import { requireTenantRole } from "./_roleGuard";
import { getCurrentTenantUserMembership } from "./_tenantGuard";
import {
  assertProcurementItemAssignmentAllowed,
  assertProcurementItemTierCapacity,
  assertProcurementItemUnique,
  resolveNextProcurementItemSortOrder,
} from "../../lib/procurement-officer/item-backend";

type RequestQueryCtx = QueryCtx;
type RequestMutationCtx = MutationCtx;

const requestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("denied"),
  v.literal("expired"),
  v.literal("cancelled"),
);

const requestTypeValidator = v.union(
  v.literal("item"),
  v.literal("category"),
);

const requestFiltersValidator = v.object({
  departmentId: v.optional(v.string()),
  endDate: v.optional(v.number()),
  requestType: v.optional(requestTypeValidator),
  startDate: v.optional(v.number()),
  status: v.optional(requestStatusValidator),
  view: v.optional(v.union(v.literal("history"), v.literal("inbox"))),
});

const decisionReasonValidator = v.string();
const DECISION_REASON_MIN_LENGTH = 3;
const DECISION_REASON_MAX_LENGTH = 280;

type CategoryRequestRecord = Doc<"categoryRequests">;
type ItemRequestRecord = Doc<"itemRequests">;

type RequestRow = {
  canApprove: boolean;
  canDeny: boolean;
  canUndo: boolean;
  categoryName?: string | null;
  createdAt: number;
  description: string;
  departmentId: string;
  departmentName: string;
  id: string;
  justification: string;
  name: string;
  requestorId: string;
  requestorLabel: string;
  status: CatalogRequestStatus;
  submittedAt: number;
  type: CatalogRequestType;
  updatedAt: number;
  decisionReason: string | null;
  decisionStatusLabel: string;
  estimatedUnitPrice?: number | null;
  categoryId?: string | null;
  linkedCategoryRequestId?: string | null;
};

type RequestCluster = {
  id: string;
  name: string;
  requestType: CatalogRequestType;
  requestCount: number;
  requestorCount: number;
  departmentCount: number;
  statusCounts: Record<CatalogRequestStatus, number>;
  requests: RequestRow[];
};

async function loadProcurementOfficerContext(
  ctx: RequestQueryCtx | RequestMutationCtx,
) {
  const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
  const [tenant, tenantUser] = await Promise.all([
    ctx.db.get(authContext.tenantId),
    getCurrentTenantUserMembership(ctx),
  ]);

  if (!tenant) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Tenant record not found",
    });
  }

  if (
    !tenantUser ||
    tenantUser.role !== "procurement_officer" ||
    !tenantUser.isActive
  ) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Procurement Officer access is required for this resource.",
    });
  }

  return {
    authContext,
    tenant,
    tenantUser,
  };
}

function buildDecisionReasonLabel(args: {
  reason: string | null | undefined;
  status: CatalogRequestStatus;
}) {
  return (
    formatCatalogRequestDecisionReason({
      reason: args.reason ?? null,
      status: args.status,
    }) ?? null
  );
}

function resolveCatalogRequestStatus(args: {
  department: Doc<"departments">;
  request: CategoryRequestRecord | ItemRequestRecord;
}): CatalogRequestStatus {
  const shouldExpire = shouldExpireCatalogRequest({
    status: args.request.status,
    submissionEndsAt: args.department.submissionEndsAt,
    submissionStartsAt: args.department.submissionStartsAt,
  });
  return shouldExpire ? "expired" : args.request.status;
}

function buildRequestRow(args: {
  department: Doc<"departments">;
  request: CategoryRequestRecord | ItemRequestRecord;
  requestorLabel: string;
  statusOverride?: CatalogRequestStatus;
  type: CatalogRequestType;
}): RequestRow {
  const status =
    args.statusOverride ??
    resolveCatalogRequestStatus({
      department: args.department,
      request: args.request,
    });
  const decisionReason = buildDecisionReasonLabel({
    reason: args.request.decisionReason,
    status,
  });

  return {
    canApprove: status === "pending",
    canDeny: status === "pending",
    canUndo:
      isDenialUndoEligible({
        decisionNotificationStatus: args.request.decisionNotificationStatus,
        denialUndoDeadlineAt: args.request.denialUndoDeadlineAt,
        status,
      }),
    categoryName:
      args.type === "item"
        ? (args.request as ItemRequestRecord).categoryNameSnapshot
        : null,
    createdAt: args.request.createdAt,
    description: args.request.description,
    departmentId: String(args.request.departmentId),
    departmentName: args.department.name,
    decisionReason,
    decisionStatusLabel: buildCatalogRequestStatusMeta(status).label,
    id: String(args.request._id),
    justification: args.request.justification,
    name: args.request.name,
    requestorId: String(args.request.requestorUserId),
    requestorLabel: args.requestorLabel,
    status,
    submittedAt: args.request.submittedAt,
    type: args.type,
    updatedAt: args.request.updatedAt,
    estimatedUnitPrice:
      args.type === "item"
        ? (args.request as ItemRequestRecord).estimatedUnitPrice
        : null,
    categoryId:
      args.type === "item"
        ? ((args.request as ItemRequestRecord).categoryId
            ? String((args.request as ItemRequestRecord).categoryId)
            : null)
        : null,
    linkedCategoryRequestId:
      args.type === "item"
        ? ((args.request as ItemRequestRecord).linkedCategoryRequestId
            ? String((args.request as ItemRequestRecord).linkedCategoryRequestId)
            : null)
        : null,
  };
}

function createRequestCluster(
  rows: RequestRow[],
  clusterId: string,
): RequestCluster {
  const statusCounts: Record<CatalogRequestStatus, number> = {
    pending: 0,
    approved: 0,
    denied: 0,
    expired: 0,
    cancelled: 0,
  };
  const requestorIds = new Set<string>();
  const departmentIds = new Set<string>();

  for (const row of rows) {
    statusCounts[row.status] += 1;
    requestorIds.add(row.requestorId);
    departmentIds.add(row.departmentId);
  }

  return {
    id: clusterId,
    name: rows[0]?.name ?? "Request",
    requestType: rows[0]?.type ?? "item",
    requestCount: rows.length,
    requestorCount: requestorIds.size,
    departmentCount: departmentIds.size,
    statusCounts,
    requests: rows,
  };
}

export const getProcurementOfficerCatalogRequests = query({
  args: requestFiltersValidator,
  returns: v.any(),
  handler: async (ctx, args) => {
    const { authContext } = await loadProcurementOfficerContext(ctx);
    const resolvedView = args.view ?? "inbox";
    const resolvedStatus =
      args.status ?? (resolvedView === "inbox" ? "pending" : undefined);
    const departments = await ctx.db
      .query("departments")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
      .collect();
    const departmentMap = new Map(
      departments.map((department) => [String(department._id), department] as const),
    );

    const [categoryRequests, itemRequests] = await Promise.all([
      ctx.db
        .query("categoryRequests")
        .withIndex("by_tenantId_createdAt", (q) =>
          q.eq("tenantId", authContext.tenantId),
        )
        .collect(),
      ctx.db
        .query("itemRequests")
        .withIndex("by_tenantId_createdAt", (q) =>
          q.eq("tenantId", authContext.tenantId),
        )
        .collect(),
    ]);

    const filteredCategoryRequests: Array<{
      department: Doc<"departments">;
      request: CategoryRequestRecord;
      status: CatalogRequestStatus;
    }> = [];
    const filteredItemRequests: Array<{
      department: Doc<"departments">;
      request: ItemRequestRecord;
      status: CatalogRequestStatus;
    }> = [];

    if (!args.requestType || args.requestType === "category") {
      for (const request of categoryRequests) {
        const department = departmentMap.get(String(request.departmentId));
        if (!department) {
          continue;
        }
        const status = resolveCatalogRequestStatus({ department, request });
        if (resolvedStatus && status !== resolvedStatus) {
          continue;
        }
        if (args.departmentId && String(request.departmentId) !== args.departmentId) {
          continue;
        }
        if (typeof args.startDate === "number" && request.createdAt < args.startDate) {
          continue;
        }
        if (typeof args.endDate === "number" && request.createdAt > args.endDate) {
          continue;
        }
        filteredCategoryRequests.push({ department, request, status });
      }
    }

    if (!args.requestType || args.requestType === "item") {
      for (const request of itemRequests) {
        const department = departmentMap.get(String(request.departmentId));
        if (!department) {
          continue;
        }
        const status = resolveCatalogRequestStatus({ department, request });
        if (resolvedStatus && status !== resolvedStatus) {
          continue;
        }
        if (args.departmentId && String(request.departmentId) !== args.departmentId) {
          continue;
        }
        if (typeof args.startDate === "number" && request.createdAt < args.startDate) {
          continue;
        }
        if (typeof args.endDate === "number" && request.createdAt > args.endDate) {
          continue;
        }
        filteredItemRequests.push({ department, request, status });
      }
    }

    const requestorIds = new Set<string>();
    for (const entry of filteredCategoryRequests) {
      requestorIds.add(String(entry.request.requestorUserId));
    }
    for (const entry of filteredItemRequests) {
      requestorIds.add(String(entry.request.requestorUserId));
    }

    const requestorEntries = await Promise.all(
      Array.from(requestorIds).map(async (requestorId) => {
        const user = await ctx.db.get(requestorId as Id<"users">);
        return [requestorId, user?.email ? user.email : requestorId] as const;
      }),
    );
    const requestorMap = new Map(requestorEntries);

    const rows: RequestRow[] = [];
    for (const entry of filteredCategoryRequests) {
      rows.push(
        buildRequestRow({
          department: entry.department,
          request: entry.request,
          requestorLabel:
            requestorMap.get(String(entry.request.requestorUserId)) ?? "Unknown",
          statusOverride: entry.status,
          type: "category",
        }),
      );
    }
    for (const entry of filteredItemRequests) {
      rows.push(
        buildRequestRow({
          department: entry.department,
          request: entry.request,
          requestorLabel:
            requestorMap.get(String(entry.request.requestorUserId)) ?? "Unknown",
          statusOverride: entry.status,
          type: "item",
        }),
      );
    }

    const categoryGroupingKeyById = new Map(
      filteredCategoryRequests.map((entry) => [
        String(entry.request._id),
        entry.request.sharedGroupingKey,
      ]),
    );
    const itemGroupingKeyById = new Map(
      filteredItemRequests.map((entry) => [
        String(entry.request._id),
        entry.request.sharedGroupingKey,
      ]),
    );

    const rowsByCluster = new Map<string, RequestRow[]>();
    for (const row of rows) {
      const clusterId =
        row.type === "item"
          ? itemGroupingKeyById.get(row.id)
          : categoryGroupingKeyById.get(row.id);
      const resolvedClusterId = clusterId ?? row.id;
      const existing = rowsByCluster.get(resolvedClusterId) ?? [];
      existing.push(row);
      rowsByCluster.set(resolvedClusterId, existing);
    }

    const clusters = Array.from(rowsByCluster.entries()).map(
      ([clusterId, groupRows]) =>
        createRequestCluster(
          groupRows.sort((left, right) => right.updatedAt - left.updatedAt),
          clusterId,
        ),
    );

    return {
      clusters: clusters.sort((left, right) => {
        const leftUpdated = left.requests[0]?.updatedAt ?? 0;
        const rightUpdated = right.requests[0]?.updatedAt ?? 0;
        return rightUpdated - leftUpdated;
      }),
      departments: departments.map((department) => ({
        id: String(department._id),
        name: department.name,
      })),
      summary: buildCatalogRequestSummary({
        requests: rows.map((row) => ({ status: row.status, type: row.type })),
      }),
    };
  },
});

export const getRequestorEmail = query({
  args: {
    userId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    await loadProcurementOfficerContext(ctx);
    const user = await ctx.db.get(args.userId as Id<"users">);
    return user?.email ?? null;
  },
});

export const approveCategoryRequestInternal = internalMutation({
  args: {
    category: v.any(),
    requestId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { authContext, tenantUser, tenant } = await loadProcurementOfficerContext(ctx);
    const request = await ctx.db.get(args.requestId as Id<"categoryRequests">);
    if (!request || request.tenantId !== authContext.tenantId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Request not found." });
    }

    if (request.status !== "pending") {
      throw new ConvexError({
        code: "ALREADY_PROCESSED",
        message: "Request already processed.",
      });
    }

    const department = await ctx.db.get(request.departmentId);
    if (!department) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Department not found.",
      });
    }

    if (
      shouldExpireCatalogRequest({
        status: request.status,
        submissionEndsAt: department.submissionEndsAt,
        submissionStartsAt: department.submissionStartsAt,
      })
    ) {
      await ctx.db.patch(request._id, {
        decisionReason: "Submission window ended before review.",
        decisionSource: "deadline",
        revision: request.revision + 1,
        status: "expired",
        updatedAt: Date.now(),
      });
      await appendAuditLogRequired(
        ctx,
        buildRequestAuditEntry({
          action: "expire",
          event: AUDIT_EVENT_NAMES.categoryRequestExpired,
          recordId: String(request._id),
          tableName: "categoryRequests",
          tenantId: String(authContext.tenantId),
          userId: String(request.requestorUserId),
        }),
      );
      throw new ConvexError({
        code: "DEADLINE_PASSED",
        message: "Submission window ended before review.",
      });
    }

    const parsed = categoryFormSchema.safeParse(args.category);
    if (!parsed.success) {
      const issue = parsed.error.issues.at(0);
      throw new ConvexError({
        code: "VALIDATION_FAILED",
        field: issue?.path[0] ?? "category",
        message: issue?.message ?? "Category data is invalid.",
      });
    }

    await assertCategoryUnique(ctx, {
      normalizedName: normalizeCategoryName(parsed.data.name),
      tenantId: authContext.tenantId,
    });
    await assertCategoryTierCapacity(ctx, {
      tenantId: authContext.tenantId,
      tier: tenant.tier,
    });

    const existingCategories = await ctx.db
      .query("procurementCategories")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
      .collect();
    const nextSortOrder =
      Math.max(
        0,
        ...existingCategories.map((category) => category.sortOrder),
      ) + 1;
    const now = Date.now();
    const categoryId = await ctx.db.insert("procurementCategories", {
      archivedAt: undefined,
      archivedByTenantUserId: undefined,
      color: parsed.data.color,
      createdAt: now,
      description: parsed.data.description,
      icon: parsed.data.icon,
      isActive: true,
      name: parsed.data.name,
      normalizedName: normalizeCategoryName(parsed.data.name),
      revision: 1,
      sortOrder: nextSortOrder,
      tenantId: authContext.tenantId,
      updatedAt: now,
    });

    await appendAuditLogRequired(
      ctx,
      buildRequestAuditEntry({
        action: "approve",
        event: AUDIT_EVENT_NAMES.categoryRequestApproved,
        recordId: String(request._id),
        tableName: "categoryRequests",
        tenantId: String(authContext.tenantId),
        userId: String(authContext.userId),
      }),
    );

    await ctx.db.patch(request._id, {
      decisionReason: undefined,
      decisionSnapshot: {
        approvedCategoryId: String(categoryId),
        description: parsed.data.description ?? null,
        name: parsed.data.name,
      },
      decisionSource: "po",
      linkedCatalogCategoryId: categoryId,
      reviewedAt: now,
      reviewedByTenantUserId: tenantUser._id,
      revision: request.revision + 1,
      status: "approved",
      updatedAt: now,
    });

    return {
      requestId: String(request._id),
      requestType: "category",
      requestSummary: parsed.data.name,
      tenantName: tenant.name,
      tenantId: String(authContext.tenantId),
      userId: String(request.requestorUserId),
    };
  },
});

export const approveItemRequestInternal = internalMutation({
  args: {
    item: v.any(),
    requestId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { authContext, tenantUser, tenant } = await loadProcurementOfficerContext(ctx);
    const request = await ctx.db.get(args.requestId as Id<"itemRequests">);
    if (!request || request.tenantId !== authContext.tenantId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Request not found." });
    }

    if (request.status !== "pending") {
      throw new ConvexError({
        code: "ALREADY_PROCESSED",
        message: "Request already processed.",
      });
    }

    const department = await ctx.db.get(request.departmentId);
    if (!department) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Department not found.",
      });
    }

    if (
      shouldExpireCatalogRequest({
        status: request.status,
        submissionEndsAt: department.submissionEndsAt,
        submissionStartsAt: department.submissionStartsAt,
      })
    ) {
      await ctx.db.patch(request._id, {
        decisionReason: "Submission window ended before review.",
        decisionSource: "deadline",
        revision: request.revision + 1,
        status: "expired",
        updatedAt: Date.now(),
      });
      await appendAuditLogRequired(
        ctx,
        buildRequestAuditEntry({
          action: "expire",
          event: AUDIT_EVENT_NAMES.itemRequestExpired,
          recordId: String(request._id),
          tableName: "itemRequests",
          tenantId: String(authContext.tenantId),
          userId: String(request.requestorUserId),
        }),
      );
      throw new ConvexError({
        code: "DEADLINE_PASSED",
        message: "Submission window ended before review.",
      });
    }

    const parsed = itemFormSchema.safeParse(args.item);
    if (!parsed.success) {
      const issue = parsed.error.issues.at(0);
      throw new ConvexError({
        code: "VALIDATION_FAILED",
        field: issue?.path[0] ?? "item",
        message: issue?.message ?? "Item data is invalid.",
      });
    }

    const category = await ctx.db.get(parsed.data.categoryId as Id<"procurementCategories">);
    if (!category || category.tenantId !== authContext.tenantId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Category not found.",
      });
    }

    assertProcurementItemAssignmentAllowed({
      categoryIsActive: category.isActive,
      nextCategoryId: String(category._id),
    });
    await assertProcurementItemTierCapacity(ctx, {
      categoryId: String(category._id),
      tenantId: String(authContext.tenantId),
      tier: tenant.tier,
    });
    await assertProcurementItemUnique(ctx, {
      categoryId: String(category._id),
      normalizedName: normalizeProcurementItemName(parsed.data.name),
      tenantId: String(authContext.tenantId),
    });

    const nextSortOrder = await resolveNextProcurementItemSortOrder({
      categoryId: String(category._id),
      ctx,
      tenantId: String(authContext.tenantId),
    });
    const now = Date.now();
    const itemDescription = parsed.data.description ?? parsed.data.name;
    const itemId = await ctx.db.insert("procurementItems", {
      archivedAt: undefined,
      archivedByTenantUserId: undefined,
      catalogSearchText: buildProcurementItemCatalogSearchText({
        categoryName: category.name,
        description: itemDescription,
        name: parsed.data.name,
      }),
      categoryId: category._id,
      categoryNameSnapshot: category.name,
      complianceFlags: parsed.data.complianceFlags,
      createdAt: now,
      description: itemDescription,
      isActive: true,
      lastPriceChangedAt: now,
      lastPriceChangedByTenantUserId: tenantUser._id,
      maxQuantity: parsed.data.maxQuantity,
      minQuantity: parsed.data.minQuantity,
      name: parsed.data.name,
      normalizedName: normalizeProcurementItemName(parsed.data.name),
      procurementMethod: parsed.data.procurementMethod,
      revision: 1,
      sortOrder: nextSortOrder,
      sourceOfFunds: parsed.data.sourceOfFunds,
      tenantId: authContext.tenantId,
      unitOfMeasurement: parsed.data.unit,
      unitPrice: parsed.data.unitPrice,
      updatedAt: now,
    });

    await ctx.db.insert("procurementItemPriceHistory", {
      ...createProcurementItemPriceHistoryEntry({
        changedAt: now,
        itemId: String(itemId),
        nextUnitPrice: parsed.data.unitPrice,
        previousUnitPrice: null,
      }),
      changedByTenantUserId: tenantUser._id,
      itemId,
      tenantId: authContext.tenantId,
    });

    await appendAuditLogRequired(
      ctx,
      buildRequestAuditEntry({
        action: "approve",
        event: AUDIT_EVENT_NAMES.itemRequestApproved,
        recordId: String(request._id),
        tableName: "itemRequests",
        tenantId: String(authContext.tenantId),
        userId: String(authContext.userId),
      }),
    );

    await ctx.db.patch(request._id, {
      decisionReason: undefined,
      decisionSnapshot: {
        approvedItemId: String(itemId),
        description: itemDescription,
        name: parsed.data.name,
        unitPrice: parsed.data.unitPrice,
        categoryId: String(category._id),
      },
      decisionSource: "po",
      linkedCatalogItemId: itemId,
      reviewedAt: now,
      reviewedByTenantUserId: tenantUser._id,
      revision: request.revision + 1,
      status: "approved",
      updatedAt: now,
    });

    return {
      requestId: String(request._id),
      requestType: "item",
      requestSummary: `${parsed.data.name} in ${category.name}`,
      tenantName: tenant.name,
      tenantId: String(authContext.tenantId),
      userId: String(request.requestorUserId),
    };
  },
});

export const denyCatalogRequestInternal = internalMutation({
  args: {
    reason: decisionReasonValidator,
    requestId: v.string(),
    requestType: requestTypeValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { authContext, tenantUser, tenant } = await loadProcurementOfficerContext(ctx);
    const request =
      args.requestType === "item"
        ? await ctx.db.get(args.requestId as Id<"itemRequests">)
        : await ctx.db.get(args.requestId as Id<"categoryRequests">);
    if (!request || request.tenantId !== authContext.tenantId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Request not found." });
    }
    if (request.status !== "pending") {
      throw new ConvexError({
        code: "ALREADY_PROCESSED",
        message: "Request already processed.",
      });
    }

    const now = Date.now();
    const reason = args.reason.trim();
    if (
      reason.length < DECISION_REASON_MIN_LENGTH ||
      reason.length > DECISION_REASON_MAX_LENGTH
    ) {
      throw new ConvexError({
        code: "VALIDATION_FAILED",
        field: "reason",
        message: "Denial reason must be between 3 and 280 characters.",
      });
    }
    const undoDeadlineAt = resolveProcurementRequestDenialUndoDeadline({ now });
    await ctx.db.patch(request._id, {
      decisionReason: reason,
      decisionSource: "po",
      denialUndoDeadlineAt: undoDeadlineAt,
      reviewedAt: now,
      reviewedByTenantUserId: tenantUser._id,
      revision: request.revision + 1,
      status: "denied",
      updatedAt: now,
    });

    await appendAuditLogRequired(
      ctx,
      buildRequestAuditEntry({
        action: "deny",
        event:
          args.requestType === "item"
            ? AUDIT_EVENT_NAMES.itemRequestDenied
            : AUDIT_EVENT_NAMES.categoryRequestDenied,
        recordId: String(request._id),
        tableName: args.requestType === "item" ? "itemRequests" : "categoryRequests",
        tenantId: String(authContext.tenantId),
        userId: String(authContext.userId),
      }),
    );

    return {
      requestId: String(request._id),
      requestType: args.requestType,
      requestSummary:
        args.requestType === "item"
          ? `${request.name} (${(request as ItemRequestRecord).categoryNameSnapshot})`
          : request.name,
      tenantName: tenant.name,
      tenantId: String(authContext.tenantId),
      userId: String(request.requestorUserId),
      deliverAt: undoDeadlineAt,
    };
  },
});

export const markDecisionNotificationQueued = internalMutation({
  args: {
    deliverAt: v.optional(v.number()),
    idempotencyKey: v.string(),
    requestId: v.string(),
    requestType: requestTypeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.requestType === "item") {
      const request = await ctx.db.get(args.requestId as Id<"itemRequests">);
      if (!request) return null;
      await ctx.db.patch(request._id, {
        decisionNotificationIdempotencyKey: args.idempotencyKey,
        decisionNotificationDeliverAt: args.deliverAt,
        decisionNotificationQueuedAt: now,
        decisionNotificationStatus: "queued",
        updatedAt: now,
      });
      return null;
    }

    const request = await ctx.db.get(args.requestId as Id<"categoryRequests">);
    if (!request) return null;
    await ctx.db.patch(request._id, {
      decisionNotificationIdempotencyKey: args.idempotencyKey,
      decisionNotificationDeliverAt: args.deliverAt,
      decisionNotificationQueuedAt: now,
      decisionNotificationStatus: "queued",
      updatedAt: now,
    });
    return null;
  },
});

export const markDecisionNotificationFailed = internalMutation({
  args: {
    errorCode: v.string(),
    errorMessage: v.string(),
    idempotencyKey: v.string(),
    requestId: v.string(),
    requestType: requestTypeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.requestType === "item") {
      const request = await ctx.db.get(args.requestId as Id<"itemRequests">);
      if (!request) return null;
      await ctx.db.patch(request._id, {
        decisionNotificationErrorCode: args.errorCode,
        decisionNotificationErrorMessage: args.errorMessage,
        decisionNotificationIdempotencyKey: args.idempotencyKey,
        decisionNotificationStatus: "failed",
        updatedAt: now,
      });
      return null;
    }

    const request = await ctx.db.get(args.requestId as Id<"categoryRequests">);
    if (!request) return null;
    await ctx.db.patch(request._id, {
      decisionNotificationErrorCode: args.errorCode,
      decisionNotificationErrorMessage: args.errorMessage,
      decisionNotificationIdempotencyKey: args.idempotencyKey,
      decisionNotificationStatus: "failed",
      updatedAt: now,
    });
    return null;
  },
});

export const prepareDenialUndo = internalMutation({
  args: {
    requestId: v.string(),
    requestType: requestTypeValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { authContext } = await loadProcurementOfficerContext(ctx);
    const request =
      args.requestType === "item"
        ? await ctx.db.get(args.requestId as Id<"itemRequests">)
        : await ctx.db.get(args.requestId as Id<"categoryRequests">);
    if (!request || request.tenantId !== authContext.tenantId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Request not found." });
    }
    if (request.status !== "denied") {
      throw new ConvexError({
        code: "ALREADY_PROCESSED",
        message: "Only denied requests can be undone.",
      });
    }
    if (
      typeof request.denialUndoDeadlineAt !== "number" ||
      Date.now() > request.denialUndoDeadlineAt
    ) {
      throw new ConvexError({
        code: "UNDO_WINDOW_CLOSED",
        message: "Undo window has closed.",
      });
    }

    return {
      idempotencyKey: request.decisionNotificationIdempotencyKey ?? null,
      requestId: String(request._id),
      requestType: args.requestType,
      notificationStatus: request.decisionNotificationStatus ?? null,
    };
  },
});

export const applyDenialUndo = internalMutation({
  args: {
    requestId: v.string(),
    requestType: requestTypeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { authContext } = await loadProcurementOfficerContext(ctx);
    const request =
      args.requestType === "item"
        ? await ctx.db.get(args.requestId as Id<"itemRequests">)
        : await ctx.db.get(args.requestId as Id<"categoryRequests">);
    if (!request || request.tenantId !== authContext.tenantId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Request not found." });
    }

    await ctx.db.patch(request._id, {
      decisionReason: undefined,
      decisionNotificationErrorCode: undefined,
      decisionNotificationErrorMessage: undefined,
      decisionNotificationIdempotencyKey: undefined,
      decisionSource: undefined,
      decisionSnapshot: undefined,
      decisionNotificationStatus: "cancelled",
      denialUndoDeadlineAt: undefined,
      reviewedAt: undefined,
      reviewedByTenantUserId: undefined,
      revision: request.revision + 1,
      status: "pending",
      updatedAt: Date.now(),
    });

    await appendAuditLogRequired(
      ctx,
      buildRequestAuditEntry({
        action: "undo",
        event:
          args.requestType === "item"
            ? AUDIT_EVENT_NAMES.itemRequestDenialUndone
            : AUDIT_EVENT_NAMES.categoryRequestDenialUndone,
        recordId: String(request._id),
        tableName: args.requestType === "item" ? "itemRequests" : "categoryRequests",
        tenantId: String(authContext.tenantId),
        userId: String(authContext.userId),
      }),
    );

    return null;
  },
});

export const approveCategoryRequest = action({
  args: {
    category: v.any(),
    requestId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(
      "functions/requests:approveCategoryRequestInternal" as any,
      args,
    );

    const notification = await buildDecisionNotification({
      ctx,
      requestId: result.requestId,
      requestSummary: result.requestSummary,
      requestType: result.requestType,
      tenantId: result.tenantId,
      tenantName: result.tenantName,
      userId: result.userId,
      status: "approved",
    });
    if (notification) {
      await queueDecisionNotification(ctx, notification);
    }

    return result;
  },
});

export const approveItemRequest = action({
  args: {
    item: v.any(),
    requestId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(
      "functions/requests:approveItemRequestInternal" as any,
      args,
    );

    const notification = await buildDecisionNotification({
      ctx,
      requestId: result.requestId,
      requestSummary: result.requestSummary,
      requestType: result.requestType,
      tenantId: result.tenantId,
      tenantName: result.tenantName,
      userId: result.userId,
      status: "approved",
    });
    if (notification) {
      await queueDecisionNotification(ctx, notification);
    }

    return result;
  },
});

export const denyCatalogRequest = action({
  args: {
    reason: decisionReasonValidator,
    requestId: v.string(),
    requestType: requestTypeValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(
      "functions/requests:denyCatalogRequestInternal" as any,
      args,
    );
    const notification = await buildDecisionNotification({
      ctx,
      deliverAt: result.deliverAt,
      requestId: result.requestId,
      requestSummary: result.requestSummary,
      requestType: result.requestType,
      tenantId: result.tenantId,
      tenantName: result.tenantName,
      userId: result.userId,
      status: "denied",
      reason: args.reason,
    });
    if (notification) {
      await queueDecisionNotification(ctx, notification);
    }

    return result;
  },
});

export const bulkApproveCatalogRequestsInternal = internalMutation({
  args: {
    requestIds: v.array(v.string()),
    requestType: requestTypeValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { authContext, tenantUser, tenant } = await loadProcurementOfficerContext(ctx);
    const processed: Array<{
      requestId: string;
      requestSummary: string;
      requestType: CatalogRequestType;
      tenantId: string;
      tenantName: string;
      userId: string;
    }> = [];
    const skipped: Array<{ requestId: string; reason: string }> = [];

    for (const requestId of args.requestIds) {
      const request =
        args.requestType === "item"
          ? await ctx.db.get(requestId as Id<"itemRequests">)
          : await ctx.db.get(requestId as Id<"categoryRequests">);
      if (!request || request.tenantId !== authContext.tenantId) {
        skipped.push({ requestId, reason: "Request not found." });
        continue;
      }
      if (request.status !== "pending") {
        skipped.push({ requestId, reason: "Request already processed." });
        continue;
      }
      const department = await ctx.db.get(request.departmentId);
      if (!department) {
        skipped.push({ requestId, reason: "Department not found." });
        continue;
      }
      if (
        shouldExpireCatalogRequest({
          status: request.status,
          submissionEndsAt: department.submissionEndsAt,
          submissionStartsAt: department.submissionStartsAt,
        })
      ) {
        await ctx.db.patch(request._id, {
          decisionReason: "Submission window ended before review.",
          decisionSource: "deadline",
          revision: request.revision + 1,
          status: "expired",
          updatedAt: Date.now(),
        });
        await appendAuditLogRequired(
          ctx,
          buildRequestAuditEntry({
            action: "expire",
            event:
              args.requestType === "item"
                ? AUDIT_EVENT_NAMES.itemRequestExpired
                : AUDIT_EVENT_NAMES.categoryRequestExpired,
            recordId: String(request._id),
            tableName: args.requestType === "item" ? "itemRequests" : "categoryRequests",
            tenantId: String(authContext.tenantId),
            userId: String(request.requestorUserId),
          }),
        );
        skipped.push({ requestId, reason: "Request expired before review." });
        continue;
      }

      if (args.requestType === "category") {
        const categoryInput = {
          name: request.name,
          description: request.description,
        };
        const parsed = categoryFormSchema.safeParse(categoryInput);
        if (!parsed.success) {
          skipped.push({ requestId, reason: "Category data invalid." });
          continue;
        }

        try {
          await assertCategoryUnique(ctx, {
            normalizedName: normalizeCategoryName(parsed.data.name),
            tenantId: authContext.tenantId,
          });
          await assertCategoryTierCapacity(ctx, {
            tenantId: authContext.tenantId,
            tier: tenant.tier,
          });
        } catch (error) {
          skipped.push({
            requestId,
            reason:
              error instanceof Error ? error.message : "Category validation failed.",
          });
          continue;
        }

        const existingCategories = await ctx.db
          .query("procurementCategories")
          .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
          .collect();
        const nextSortOrder =
          Math.max(
            0,
            ...existingCategories.map((category) => category.sortOrder),
          ) + 1;
        const now = Date.now();
        const categoryId = await ctx.db.insert("procurementCategories", {
          archivedAt: undefined,
          archivedByTenantUserId: undefined,
          color: undefined,
          createdAt: now,
          description: parsed.data.description,
          icon: undefined,
          isActive: true,
          name: parsed.data.name,
          normalizedName: normalizeCategoryName(parsed.data.name),
          revision: 1,
          sortOrder: nextSortOrder,
          tenantId: authContext.tenantId,
          updatedAt: now,
        });

        await appendAuditLogRequired(
          ctx,
          buildRequestAuditEntry({
            action: "approve",
            event: AUDIT_EVENT_NAMES.categoryRequestBulkApproved,
            recordId: String(request._id),
            tableName: "categoryRequests",
            tenantId: String(authContext.tenantId),
            userId: String(authContext.userId),
          }),
        );

        await ctx.db.patch(request._id, {
          decisionReason: undefined,
          decisionSnapshot: {
            approvedCategoryId: String(categoryId),
            description: parsed.data.description ?? null,
            name: parsed.data.name,
          },
          decisionSource: "po",
          linkedCatalogCategoryId: categoryId,
          reviewedAt: now,
          reviewedByTenantUserId: tenantUser._id,
          revision: request.revision + 1,
          status: "approved",
          updatedAt: now,
        });

        processed.push({
          requestId: String(request._id),
          requestSummary: parsed.data.name,
          requestType: "category",
          tenantId: String(authContext.tenantId),
          tenantName: tenant.name,
          userId: String(request.requestorUserId),
        });
        continue;
      }

      const itemRequest = request as ItemRequestRecord;
      let categoryId =
        itemRequest.categoryId ? String(itemRequest.categoryId) : null;
      if (!categoryId && itemRequest.linkedCategoryRequestId) {
        const linkedCategoryRequest = await ctx.db.get(
          itemRequest.linkedCategoryRequestId,
        );
        if (linkedCategoryRequest?.linkedCatalogCategoryId) {
          categoryId = String(linkedCategoryRequest.linkedCatalogCategoryId);
        } else {
          skipped.push({
            requestId,
            reason: "Linked category request not approved yet.",
          });
          continue;
        }
      }
      if (!categoryId) {
        skipped.push({ requestId, reason: "Request missing category." });
        continue;
      }

      const itemInput = {
        categoryId,
        complianceFlags: [],
        customUnit: undefined,
        description: itemRequest.description,
        maxQuantity: undefined,
        minQuantity: undefined,
        name: itemRequest.name,
        procurementMethod: "RFQ",
        sourceOfFunds: "GOK",
        unit: "each",
        unitPrice: itemRequest.estimatedUnitPrice,
      };
      const parsed = itemFormSchema.safeParse(itemInput);
      if (!parsed.success) {
        skipped.push({ requestId, reason: "Item data invalid." });
        continue;
      }

      const category = await ctx.db.get(parsed.data.categoryId as Id<"procurementCategories">);
      if (!category || category.tenantId !== authContext.tenantId) {
        skipped.push({ requestId, reason: "Category not found." });
        continue;
      }

      try {
        assertProcurementItemAssignmentAllowed({
          categoryIsActive: category.isActive,
          nextCategoryId: String(category._id),
        });
        await assertProcurementItemTierCapacity(ctx, {
          categoryId: String(category._id),
          tenantId: String(authContext.tenantId),
          tier: tenant.tier,
        });
        await assertProcurementItemUnique(ctx, {
          categoryId: String(category._id),
          normalizedName: normalizeProcurementItemName(parsed.data.name),
          tenantId: String(authContext.tenantId),
        });
      } catch (error) {
        skipped.push({
          requestId,
          reason:
            error instanceof Error ? error.message : "Item validation failed.",
        });
        continue;
      }

      const nextSortOrder = await resolveNextProcurementItemSortOrder({
        categoryId: String(category._id),
        ctx,
        tenantId: String(authContext.tenantId),
      });
      const now = Date.now();
      const itemDescription = parsed.data.description ?? parsed.data.name;
      const itemId = await ctx.db.insert("procurementItems", {
        archivedAt: undefined,
        archivedByTenantUserId: undefined,
        catalogSearchText: buildProcurementItemCatalogSearchText({
          categoryName: category.name,
          description: itemDescription,
          name: parsed.data.name,
        }),
        categoryId: category._id,
        categoryNameSnapshot: category.name,
        complianceFlags: parsed.data.complianceFlags,
        createdAt: now,
        description: itemDescription,
        isActive: true,
        lastPriceChangedAt: now,
        lastPriceChangedByTenantUserId: tenantUser._id,
        maxQuantity: parsed.data.maxQuantity,
        minQuantity: parsed.data.minQuantity,
        name: parsed.data.name,
        normalizedName: normalizeProcurementItemName(parsed.data.name),
        procurementMethod: parsed.data.procurementMethod,
        revision: 1,
        sortOrder: nextSortOrder,
        sourceOfFunds: parsed.data.sourceOfFunds,
        tenantId: authContext.tenantId,
        unitOfMeasurement: parsed.data.unit,
        unitPrice: parsed.data.unitPrice,
        updatedAt: now,
      });

      await ctx.db.insert("procurementItemPriceHistory", {
        ...createProcurementItemPriceHistoryEntry({
          changedAt: now,
          itemId: String(itemId),
          nextUnitPrice: parsed.data.unitPrice,
          previousUnitPrice: null,
        }),
        changedByTenantUserId: tenantUser._id,
        itemId,
        tenantId: authContext.tenantId,
      });

      await appendAuditLogRequired(
        ctx,
        buildRequestAuditEntry({
          action: "approve",
          event: AUDIT_EVENT_NAMES.itemRequestBulkApproved,
          recordId: String(request._id),
          tableName: "itemRequests",
          tenantId: String(authContext.tenantId),
          userId: String(authContext.userId),
        }),
      );

      await ctx.db.patch(request._id, {
        decisionReason: undefined,
        decisionSnapshot: {
          approvedItemId: String(itemId),
          description: itemDescription,
          name: parsed.data.name,
          unitPrice: parsed.data.unitPrice,
          categoryId: String(category._id),
        },
        decisionSource: "po",
        linkedCatalogItemId: itemId,
        reviewedAt: now,
        reviewedByTenantUserId: tenantUser._id,
        revision: request.revision + 1,
        status: "approved",
        updatedAt: now,
      });

      processed.push({
        requestId: String(request._id),
        requestSummary: `${parsed.data.name} in ${category.name}`,
        requestType: "item",
        tenantId: String(authContext.tenantId),
        tenantName: tenant.name,
        userId: String(request.requestorUserId),
      });
    }

    return {
      processed,
      skipped,
    };
  },
});

export const bulkDenyCatalogRequestsInternal = internalMutation({
  args: {
    reason: decisionReasonValidator,
    requestIds: v.array(v.string()),
    requestType: requestTypeValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { authContext, tenantUser, tenant } = await loadProcurementOfficerContext(ctx);
    const processed: Array<{
      requestId: string;
      requestSummary: string;
      requestType: CatalogRequestType;
      tenantId: string;
      tenantName: string;
      userId: string;
      deliverAt: number;
    }> = [];
    const skipped: Array<{ requestId: string; reason: string }> = [];
    const now = Date.now();
    const reason = args.reason.trim();
    if (
      reason.length < DECISION_REASON_MIN_LENGTH ||
      reason.length > DECISION_REASON_MAX_LENGTH
    ) {
      throw new ConvexError({
        code: "VALIDATION_FAILED",
        field: "reason",
        message: "Denial reason must be between 3 and 280 characters.",
      });
    }
    const undoDeadlineAt = resolveProcurementRequestDenialUndoDeadline({ now });

    for (const requestId of args.requestIds) {
      const request =
        args.requestType === "item"
          ? await ctx.db.get(requestId as Id<"itemRequests">)
          : await ctx.db.get(requestId as Id<"categoryRequests">);
      if (!request || request.tenantId !== authContext.tenantId) {
        skipped.push({ requestId, reason: "Request not found." });
        continue;
      }
      if (request.status !== "pending") {
        skipped.push({ requestId, reason: "Request already processed." });
        continue;
      }

      await ctx.db.patch(request._id, {
        decisionReason: reason,
        decisionSource: "po",
        denialUndoDeadlineAt: undoDeadlineAt,
        reviewedAt: now,
        reviewedByTenantUserId: tenantUser._id,
        revision: request.revision + 1,
        status: "denied",
        updatedAt: now,
      });

      await appendAuditLogRequired(
        ctx,
        buildRequestAuditEntry({
          action: "deny",
          event:
            args.requestType === "item"
              ? AUDIT_EVENT_NAMES.itemRequestBulkDenied
              : AUDIT_EVENT_NAMES.categoryRequestBulkDenied,
          recordId: String(request._id),
          tableName: args.requestType === "item" ? "itemRequests" : "categoryRequests",
          tenantId: String(authContext.tenantId),
          userId: String(authContext.userId),
        }),
      );

      processed.push({
        requestId: String(request._id),
        requestSummary:
          args.requestType === "item"
            ? `${request.name} (${(request as ItemRequestRecord).categoryNameSnapshot})`
            : request.name,
        requestType: args.requestType,
        tenantId: String(authContext.tenantId),
        tenantName: tenant.name,
        userId: String(request.requestorUserId),
        deliverAt: undoDeadlineAt,
      });
    }

    return {
      processed,
      skipped,
    };
  },
});

export const bulkApproveCatalogRequests = action({
  args: {
    requestIds: v.array(v.string()),
    requestType: requestTypeValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(
      "functions/requests:bulkApproveCatalogRequestsInternal" as any,
      args,
    );

    for (const entry of result.processed as Array<{
      requestId: string;
      requestSummary: string;
      requestType: CatalogRequestType;
      tenantId: string;
      tenantName: string;
      userId: string;
    }>) {
      const notification = await buildDecisionNotification({
        ctx,
        requestId: entry.requestId,
        requestSummary: entry.requestSummary,
        requestType: entry.requestType,
        tenantId: entry.tenantId,
        tenantName: entry.tenantName,
        userId: entry.userId,
        status: "approved",
      });
      if (notification) {
        await queueDecisionNotification(ctx, notification);
      }
    }

    return result;
  },
});

export const bulkDenyCatalogRequests = action({
  args: {
    reason: decisionReasonValidator,
    requestIds: v.array(v.string()),
    requestType: requestTypeValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(
      "functions/requests:bulkDenyCatalogRequestsInternal" as any,
      args,
    );

    for (const entry of result.processed as Array<{
      requestId: string;
      requestSummary: string;
      requestType: CatalogRequestType;
      tenantId: string;
      tenantName: string;
      userId: string;
      deliverAt: number;
    }>) {
      const notification = await buildDecisionNotification({
        ctx,
        deliverAt: entry.deliverAt,
        requestId: entry.requestId,
        requestSummary: entry.requestSummary,
        requestType: entry.requestType,
        tenantId: entry.tenantId,
        tenantName: entry.tenantName,
        userId: entry.userId,
        status: "denied",
        reason: args.reason,
      });
      if (notification) {
        await queueDecisionNotification(ctx, notification);
      }
    }

    return result;
  },
});

export const undoCatalogRequestDenial = action({
  args: {
    requestId: v.string(),
    requestType: requestTypeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const prep = await ctx.runMutation(
      "functions/requests:prepareDenialUndo" as any,
      args,
    );
    if (!prep.idempotencyKey || prep.notificationStatus === "failed") {
      await ctx.runMutation(
        "functions/requests:applyDenialUndo" as any,
        args,
      );
      return null;
    }

    const cancelled = await ctx.runAction(
      "actions/email:cancelTransactionalEmail" as any,
      {
        idempotencyKey: prep.idempotencyKey,
      },
    );
    if (!cancelled?.cancelled) {
      throw new ConvexError({
        code: "UNDO_WINDOW_CLOSED",
        message: "Undo is unavailable once the notification is delivered.",
      });
    }

    await ctx.runMutation(
      "functions/requests:applyDenialUndo" as any,
      args,
    );
    return null;
  },
});

async function buildDecisionNotification(args: {
  ctx: ActionCtx;
  deliverAt?: number | null;
  reason?: string | null;
  requestId: string;
  requestSummary: string;
  requestType: CatalogRequestType;
  status: "approved" | "denied";
  tenantId: string;
  tenantName: string;
  userId: string;
}) {
  const emailValue = await args.ctx.runQuery(
    "functions/requests:getRequestorEmail" as any,
    {
      userId: args.userId,
    },
  );
  const email = emailValue?.trim?.()?.toLowerCase?.() ?? "";
  if (!email) {
    return null;
  }

  return {
    deliverAt: args.deliverAt ?? undefined,
    idempotencyKey: `catalog-request-status:${args.tenantId}:${args.requestType}:${args.requestId}:${args.status}:${email}`,
    reason: args.reason ?? undefined,
    requestId: args.requestId,
    requestSummary: args.requestSummary,
    requestType: args.requestType,
    status: args.status,
    tenantName: args.tenantName,
    to: email,
  };
}

async function queueDecisionNotification(
  ctx: ActionCtx,
  notification: {
    deliverAt?: number;
    idempotencyKey: string;
    reason?: string;
    requestId: string;
    requestSummary: string;
    requestType: CatalogRequestType;
    status: "approved" | "denied";
    tenantName: string;
    to: string;
  },
) {
  try {
    await ctx.runAction("actions/email:queueTransactionalEmail" as any, {
      deliverAt: notification.deliverAt,
      idempotencyKey: notification.idempotencyKey,
      subject: `${notification.tenantName} catalog request ${notification.status}`,
      template: "catalog-request-status",
      templateProps: {
        reason: notification.reason ?? null,
        requestId: notification.requestId,
        requestSummary: notification.requestSummary,
        status: notification.status,
        tenantName: notification.tenantName,
      },
      to: notification.to,
    });
  } catch (error) {
    await ctx.runMutation(
      "functions/requests:markDecisionNotificationFailed" as any,
      {
        errorCode: "EMAIL_FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Email queue failed.",
        idempotencyKey: notification.idempotencyKey,
        requestId: notification.requestId,
        requestType: notification.requestType,
      },
    );
    throw error;
  }

  await ctx.runMutation(
    "functions/requests:markDecisionNotificationQueued" as any,
    {
      deliverAt: notification.deliverAt,
      idempotencyKey: notification.idempotencyKey,
      requestId: notification.requestId,
      requestType: notification.requestType,
    },
  );
}

function buildRequestAuditEntry(args: {
  action: "approve" | "deny" | "expire" | "undo";
  event: string;
  recordId: string;
  tableName: "categoryRequests" | "itemRequests";
  tenantId: string;
  userId: string;
}) {
  return {
    action: args.action,
    actor: createAuthenticatedAuditActor({
      role: "procurement_officer",
      userId: args.userId,
    }),
    entityType: "catalog_request",
    event: args.event as any,
    metadata: {},
    outcome: AUDIT_OUTCOMES.allowed,
    recordId: args.recordId,
    sourceTenantId: args.tenantId,
    tableName: args.tableName,
    targetTenantId: args.tenantId,
    timestamp: Date.now(),
  };
}

async function assertCategoryUnique(
  ctx: RequestMutationCtx,
  args: {
    normalizedName: string;
    tenantId: Id<"tenants">;
  },
) {
  const categories = await ctx.db
    .query("procurementCategories")
    .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
    .collect();
  const conflict = categories.some((category) => {
    if (!category.isActive) {
      return false;
    }

    return (
      (category.normalizedName ?? normalizeCategoryName(category.name)) ===
      args.normalizedName
    );
  });

  if (conflict) {
    throw new ConvexError({
      code: "ALREADY_EXISTS",
      message: "This category already exists.",
    });
  }
}

async function assertCategoryTierCapacity(
  ctx: RequestMutationCtx,
  args: {
    tenantId: Id<"tenants">;
    tier: Doc<"tenants">["tier"];
  },
) {
  const activeCategoryCount = (
    await ctx.db
      .query("procurementCategories")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .collect()
  ).filter((category) => category.isActive).length;
  const limits: Record<
    Exclude<Doc<"tenants">["tier"], "enterprise">,
    number
  > = {
    free: 20,
    professional: 200,
    starter: 60,
  };
  const limit = args.tier === "enterprise" ? null : limits[args.tier];

  if (limit !== null && activeCategoryCount >= limit) {
    throw new ConvexError({
      code: "QUOTA_EXCEEDED",
      limit,
      message: "Category limit reached for this plan tier.",
      tier: args.tier,
      upgradeHref: "/pricing",
    });
  }
}
