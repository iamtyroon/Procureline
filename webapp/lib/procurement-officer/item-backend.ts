import { ConvexError } from "convex/values";
import {
  buildProcurementItemTierLimitState,
  createProcurementItemDuplicateKey,
  getNextProcurementItemSortOrder,
  hasProcurementItemDuplicateConflict,
  PROCUREMENT_ITEM_CATEGORY_INACTIVE_MESSAGE,
  PROCUREMENT_ITEM_DUPLICATE_MESSAGE,
  PROCUREMENT_ITEM_LIMIT_MESSAGE,
} from "./items";

export interface ProcurementItemBackendRecord {
  _id: string;
  isActive: boolean;
  name: string;
  normalizedName?: string | null;
  sortOrder?: number | null;
}

export interface ProcurementItemBackendQueryCtx {
  db: any;
}

export function assertProcurementItemAssignmentAllowed(args: {
  categoryIsActive: boolean;
  currentCategoryId?: string | null;
  nextCategoryId: string;
}): void {
  if (args.categoryIsActive) {
    return;
  }

  const normalizedCurrentCategoryId = args.currentCategoryId?.trim() ?? "";
  const normalizedNextCategoryId = args.nextCategoryId.trim();
  if (
    normalizedCurrentCategoryId.length > 0 &&
    normalizedCurrentCategoryId === normalizedNextCategoryId
  ) {
    return;
  }

  throw new ConvexError({
    code: "FORBIDDEN",
    message: PROCUREMENT_ITEM_CATEGORY_INACTIVE_MESSAGE,
  });
}

export async function assertProcurementItemUnique(
  ctx: ProcurementItemBackendQueryCtx,
  args: {
    categoryId: string;
    excludeItemId?: string | null;
    normalizedName: string;
    tenantId: string;
  },
): Promise<void> {
  const items = await ctx.db
    .query("procurementItems")
    .withIndex("by_tenantId_categoryId", (q: any) =>
      q.eq("tenantId", args.tenantId).eq("categoryId", args.categoryId),
    )
    .collect();

  const conflict = hasProcurementItemDuplicateConflict({
    excludeItemId: args.excludeItemId ?? null,
    items,
    normalizedName: args.normalizedName,
  });

  if (!conflict) {
    return;
  }

  throw new ConvexError({
    code: "ALREADY_EXISTS",
    field: "name",
    message: PROCUREMENT_ITEM_DUPLICATE_MESSAGE,
  });
}

export async function assertProcurementItemTierCapacity(
  ctx: ProcurementItemBackendQueryCtx,
  args: {
    categoryId: string;
    tenantId: string;
    tier: "enterprise" | "free" | "professional" | "starter";
  },
): Promise<void> {
  const limit = buildProcurementItemTierLimitState({
    activeItemCount: 0,
    tier: args.tier,
  }).limit;
  if (limit === null) {
    return;
  }

  const activeItemCount = (
    await ctx.db
      .query("procurementItems")
      .withIndex("by_tenantId_categoryId", (q: any) =>
        q.eq("tenantId", args.tenantId).eq("categoryId", args.categoryId),
      )
      .collect()
  ).filter((item: ProcurementItemBackendRecord) => item.isActive).length;

  if (activeItemCount < limit) {
    return;
  }

  throw new ConvexError({
    code: "QUOTA_EXCEEDED",
    limit,
    message: PROCUREMENT_ITEM_LIMIT_MESSAGE,
    tier: args.tier,
    upgradeHref: "/pricing",
  });
}

export async function resolveNextProcurementItemSortOrder(args: {
  categoryId: string;
  ctx: ProcurementItemBackendQueryCtx;
  tenantId: string;
}): Promise<number> {
  const items = await args.ctx.db
    .query("procurementItems")
    .withIndex("by_tenantId_categoryId", (q: any) =>
      q.eq("tenantId", args.tenantId).eq("categoryId", args.categoryId),
    )
    .collect();

  return getNextProcurementItemSortOrder(items);
}

export function createProcurementItemImportDuplicateKey(args: {
  categoryId: string;
  normalizedName: string;
}): string {
  return createProcurementItemDuplicateKey(args);
}
