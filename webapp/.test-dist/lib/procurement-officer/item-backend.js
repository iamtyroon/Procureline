"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProcurementItemImportDuplicateKey = exports.resolveNextProcurementItemSortOrder = exports.assertProcurementItemTierCapacity = exports.assertProcurementItemUnique = exports.assertProcurementItemAssignmentAllowed = void 0;
const values_1 = require("convex/values");
const items_1 = require("./items");
function assertProcurementItemAssignmentAllowed(args) {
    if (args.categoryIsActive) {
        return;
    }
    const normalizedCurrentCategoryId = args.currentCategoryId?.trim() ?? "";
    const normalizedNextCategoryId = args.nextCategoryId.trim();
    if (normalizedCurrentCategoryId.length > 0 &&
        normalizedCurrentCategoryId === normalizedNextCategoryId) {
        return;
    }
    throw new values_1.ConvexError({
        code: "FORBIDDEN",
        message: items_1.PROCUREMENT_ITEM_CATEGORY_INACTIVE_MESSAGE,
    });
}
exports.assertProcurementItemAssignmentAllowed = assertProcurementItemAssignmentAllowed;
async function assertProcurementItemUnique(ctx, args) {
    const items = await ctx.db
        .query("procurementItems")
        .withIndex("by_tenantId_categoryId", (q) => q.eq("tenantId", args.tenantId).eq("categoryId", args.categoryId))
        .collect();
    const conflict = (0, items_1.hasProcurementItemDuplicateConflict)({
        excludeItemId: args.excludeItemId ?? null,
        items,
        normalizedName: args.normalizedName,
    });
    if (!conflict) {
        return;
    }
    throw new values_1.ConvexError({
        code: "ALREADY_EXISTS",
        field: "name",
        message: items_1.PROCUREMENT_ITEM_DUPLICATE_MESSAGE,
    });
}
exports.assertProcurementItemUnique = assertProcurementItemUnique;
async function assertProcurementItemTierCapacity(ctx, args) {
    const limit = (0, items_1.buildProcurementItemTierLimitState)({
        activeItemCount: 0,
        tier: args.tier,
    }).limit;
    if (limit === null) {
        return;
    }
    const activeItemCount = (await ctx.db
        .query("procurementItems")
        .withIndex("by_tenantId_categoryId", (q) => q.eq("tenantId", args.tenantId).eq("categoryId", args.categoryId))
        .collect()).filter((item) => item.isActive).length;
    if (activeItemCount < limit) {
        return;
    }
    throw new values_1.ConvexError({
        code: "QUOTA_EXCEEDED",
        limit,
        message: items_1.PROCUREMENT_ITEM_LIMIT_MESSAGE,
        tier: args.tier,
        upgradeHref: "/pricing",
    });
}
exports.assertProcurementItemTierCapacity = assertProcurementItemTierCapacity;
async function resolveNextProcurementItemSortOrder(args) {
    const items = await args.ctx.db
        .query("procurementItems")
        .withIndex("by_tenantId_categoryId", (q) => q.eq("tenantId", args.tenantId).eq("categoryId", args.categoryId))
        .collect();
    return (0, items_1.getNextProcurementItemSortOrder)(items);
}
exports.resolveNextProcurementItemSortOrder = resolveNextProcurementItemSortOrder;
function createProcurementItemImportDuplicateKey(args) {
    return (0, items_1.createProcurementItemDuplicateKey)(args);
}
exports.createProcurementItemImportDuplicateKey = createProcurementItemImportDuplicateKey;
