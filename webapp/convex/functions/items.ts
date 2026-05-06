import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import {
  AUDIT_EVENT_NAMES,
  AUDIT_OUTCOMES,
  type AuditEventName,
  createAnonymousAuditActor,
  createAuthenticatedAuditActor,
} from "../../lib/shared/security/audit";
import {
  PROCUREMENT_CATALOG_PAGE_SIZE,
  normalizeProcurementCatalogBrowseState,
} from "../../lib/procurement-officer/catalog-filters";
import {
  assertProcurementItemAssignmentAllowed,
  assertProcurementItemTierCapacity,
  assertProcurementItemUnique,
  createProcurementItemImportDuplicateKey,
  resolveNextProcurementItemSortOrder,
} from "../../lib/procurement-officer/item-backend";
import {
  getProcurementItemImportRowFailure,
  buildProcurementItemImportLimitState,
  buildProcurementItemCatalogSearchText,
  createProcurementCatalogRowMatcher,
  createProcurementItemWorkspaceRow,
  buildProcurementItemTierLimitState,
  createProcurementItemPriceHistoryEntry,
  getComparableProcurementItemRevision,
  normalizeComplianceFlags,
  normalizeImportedProcurementItemUnit,
  normalizeProcurementItemDisplayName,
  normalizeProcurementItemName,
  normalizeProcurementMethod,
  normalizeQuantityLimit,
  normalizeUnitPrice,
  type ProcurementItemWorkspaceRow,
  PROCUREMENT_ITEM_DUPLICATE_MESSAGE,
  PROCUREMENT_ITEM_COMPLIANCE_INVALID_MESSAGE,
  PROCUREMENT_ITEM_IMPORT_FREE_TIER_MESSAGE,
  PROCUREMENT_ITEM_NOT_FOUND_MESSAGE,
  PROCUREMENT_ITEM_REFRESH_REQUIRED_MESSAGE,
  PROCUREMENT_ITEM_UNIT_INVALID_MESSAGE,
} from "../../lib/procurement-officer/items";
import { itemFormSchema } from "../../lib/validators/item";
import { appendAuditLogBestEffort, appendAuditLogRequired } from "./_audit";
import { getAuthorizationContext, requireTenantRole } from "./_roleGuard";
import { getCurrentTenantUserMembership } from "./_tenantGuard";

type ItemMutationCtx = MutationCtx;
type ItemQueryCtx = QueryCtx;
type ItemRecord = Doc<"procurementItems">;

const itemIdValidator = v.id("procurementItems");
const categoryIdValidator = v.id("procurementCategories");

const itemImportResultValidator = v.object({
  createdCount: v.number(),
  failureCount: v.number(),
  failures: v.array(
    v.object({
      message: v.string(),
      rowNumber: v.number(),
    }),
  ),
  totalRows: v.number(),
});

const browseCatalogArgsValidator = {
  categoryIds: v.array(v.string()),
  complianceFlags: v.array(v.string()),
  maxPrice: v.optional(v.number()),
  minPrice: v.optional(v.number()),
  page: v.number(),
  pageSize: v.optional(v.number()),
  searchText: v.string(),
};

export const getItemsWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    const tenant = await ctx.db.get(authContext.tenantId);

    if (!tenant) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tenant record not found",
      });
    }

    const [categories, items] = await Promise.all([
      ctx.db
        .query("procurementCategories")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
        .collect(),
      ctx.db
        .query("procurementItems")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
        .collect(),
    ]);

    const activeItemCountByCategoryId = new Map<string, number>();
    for (const item of items) {
      if (!item.isActive) {
        continue;
      }
      activeItemCountByCategoryId.set(
        String(item.categoryId),
        (activeItemCountByCategoryId.get(String(item.categoryId)) ?? 0) + 1,
      );
    }

    const categoryRows = [...categories]
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name),
      )
      .map((category) => ({
        activeItemCount:
          activeItemCountByCategoryId.get(String(category._id)) ?? 0,
        id: String(category._id),
        isActive: category.isActive,
        limit: buildProcurementItemTierLimitState({
          activeItemCount:
            activeItemCountByCategoryId.get(String(category._id)) ?? 0,
          tier: tenant.tier,
        }),
        name: category.name,
        sortOrder: category.sortOrder,
      }));
    return {
      categories: categoryRows,
      meta: {
        activeItemCount: items.filter((item) => item.isActive).length,
        defaultPageSize: PROCUREMENT_CATALOG_PAGE_SIZE,
        importLimit: buildProcurementItemImportLimitState({
          tier: tenant.tier,
        }),
        tier: tenant.tier,
        totalItemCount: items.length,
      },
    };
  },
});

export const browseItemsCatalog = query({
  args: browseCatalogArgsValidator,
  handler: async (ctx, args) => {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    const tenant = await ctx.db.get(authContext.tenantId);

    if (!tenant) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tenant record not found",
      });
    }

    const categories = await ctx.db
      .query("procurementCategories")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
      .collect();

    const normalizedFilters = normalizeProcurementCatalogBrowseState({
      availableCategoryIds: categories.map((category) => String(category._id)),
      state: {
        categoryIds: args.categoryIds,
        complianceFlags: args.complianceFlags,
        maxPrice: args.maxPrice ?? null,
        minPrice: args.minPrice ?? null,
        page: args.page,
        searchText: args.searchText,
      },
    });
    const selectedCategoryIds =
      normalizedFilters.categoryIds.length > 0
        ? new Set(normalizedFilters.categoryIds)
        : null;
    const sortedCategories = [...categories]
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name),
      )
      .filter((category) =>
        selectedCategoryIds ? selectedCategoryIds.has(String(category._id)) : true,
      );
    const pageSize = resolveCatalogBrowsePageSize(
      args.pageSize ?? PROCUREMENT_CATALOG_PAGE_SIZE,
    );
    const requestedPage = normalizedFilters.page;
    const matchesCatalogRow = createProcurementCatalogRowMatcher(
      normalizedFilters,
    );
    const browsePage = await collectProcurementCatalogBrowsePage(ctx, {
      categories: sortedCategories,
      matchesCatalogRow,
      pageSize,
      requestedPage,
      tenantId: authContext.tenantId,
      tier: tenant.tier,
    });
    const firstRowIndex =
      browsePage.totalCount === 0
        ? 0
        : (browsePage.currentPage - 1) * browsePage.pageSize + 1;

    return {
      meta: {
        currentPage: browsePage.currentPage,
        endRow:
          firstRowIndex === 0
            ? 0
            : firstRowIndex + browsePage.page.length - 1,
        filteredCount: browsePage.totalCount,
        hasNextPage:
          browsePage.totalPages > 0 &&
          browsePage.currentPage < browsePage.totalPages,
        hasPreviousPage:
          browsePage.totalPages > 0 && browsePage.currentPage > 1,
        normalizedFilters: normalizedFilters,
        pageSize: browsePage.pageSize,
        requestedPage: normalizedFilters.page,
        startRow: firstRowIndex,
        tier: tenant.tier,
        totalPages: browsePage.totalPages,
      },
      rows: browsePage.page,
    };
  },
});

export const createItem = mutation({
  args: {
    categoryId: categoryIdValidator,
    complianceFlags: v.array(v.string()),
    customUnit: v.optional(v.string()),
    maxQuantity: v.optional(v.number()),
    minQuantity: v.optional(v.number()),
    name: v.string(),
    procurementMethod: v.optional(v.string()),
    sourceOfFunds: v.optional(v.string()),
    unit: v.string(),
    unitPrice: v.number(),
  },
  handler: async (ctx, args) => {
    let mutationContext: Awaited<
      ReturnType<typeof loadItemMutationContext>
    > | null = null;
    try {
      mutationContext = await loadItemMutationContext(ctx);
      const { authContext } = mutationContext;
      const parsed = parseItemInput(args);
      const category = await getCategoryForTenant(ctx, {
        categoryId: args.categoryId,
        tenantId: authContext.tenantId,
      });

      assertProcurementItemAssignmentAllowed({
        categoryIsActive: category.isActive,
        nextCategoryId: String(args.categoryId),
      });
      await assertProcurementItemTierCapacity(ctx, {
        categoryId: String(args.categoryId),
        tenantId: String(authContext.tenantId),
        tier: mutationContext.tenant.tier,
      });
      await assertProcurementItemUnique(ctx, {
        categoryId: String(args.categoryId),
        normalizedName: parsed.normalizedName,
        tenantId: String(authContext.tenantId),
      });

      const nextSortOrder = await resolveNextProcurementItemSortOrder({
        categoryId: String(args.categoryId),
        ctx,
        tenantId: String(authContext.tenantId),
      });
      const now = Date.now();
      const itemId = await ctx.db.insert("procurementItems", {
        archivedAt: undefined,
        archivedByTenantUserId: undefined,
        catalogSearchText: buildProcurementItemCatalogSearchText({
          categoryName: category.name,
          description: parsed.name,
          name: parsed.name,
        }),
        categoryId: args.categoryId,
        categoryNameSnapshot: category.name,
        complianceFlags: parsed.complianceFlags,
        createdAt: now,
        description: parsed.name,
        isActive: true,
        lastPriceChangedAt: now,
        lastPriceChangedByTenantUserId: mutationContext.tenantUser._id,
        maxQuantity: parsed.maxQuantity,
        minQuantity: parsed.minQuantity,
        name: parsed.name,
        normalizedName: parsed.normalizedName,
        procurementMethod: parsed.procurementMethod,
        revision: 1,
        sortOrder: nextSortOrder,
        sourceOfFunds: parsed.sourceOfFunds,
        tenantId: authContext.tenantId,
        unitOfMeasurement: parsed.unit,
        unitPrice: parsed.unitPrice,
        updatedAt: now,
      });

      await ctx.db.insert("procurementItemPriceHistory", {
        changedAt: now,
        changedByTenantUserId: mutationContext.tenantUser._id,
        itemId,
        nextUnitPrice: parsed.unitPrice,
        previousUnitPrice: null,
        tenantId: authContext.tenantId,
      });

      await appendAuditLogRequired(
        ctx,
        buildItemAuditEntry({
          action: "create",
          actorUserId: authContext.userId,
          event: AUDIT_EVENT_NAMES.itemCreated,
          itemId,
          metadata: {
            categoryId: String(args.categoryId),
            categoryName: category.name,
            itemName: parsed.name,
            summary: `Created item ${parsed.name}.`,
          },
          tenantId: authContext.tenantId,
        }),
      );

      return { itemId, revision: 1 };
    } catch (error) {
      await appendItemFailureAudit(ctx, {
        attemptedItemName: normalizeProcurementItemDisplayName(args.name),
        authContext: mutationContext?.authContext ?? null,
        event: AUDIT_EVENT_NAMES.itemCreated,
        itemId: null,
        operation: "create item",
        error,
      });
      throw error;
    }
  },
});

export const updateItem = mutation({
  args: {
    categoryId: categoryIdValidator,
    complianceFlags: v.array(v.string()),
    customUnit: v.optional(v.string()),
    expectedRevision: v.number(),
    itemId: itemIdValidator,
    maxQuantity: v.optional(v.number()),
    minQuantity: v.optional(v.number()),
    name: v.string(),
    procurementMethod: v.optional(v.string()),
    sourceOfFunds: v.optional(v.string()),
    unit: v.string(),
    unitPrice: v.number(),
  },
  handler: async (ctx, args) => {
    let mutationContext: Awaited<
      ReturnType<typeof loadItemMutationContext>
    > | null = null;
    try {
      mutationContext = await loadItemMutationContext(ctx);
      const { authContext } = mutationContext;
      const item = await getItemForTenant(ctx, {
        itemId: args.itemId,
        tenantId: authContext.tenantId,
      });
      assertFreshItemRevision(item, args.expectedRevision);

      const parsed = parseItemInput(args);
      const category = await getCategoryForTenant(ctx, {
        categoryId: args.categoryId,
        tenantId: authContext.tenantId,
      });
      const categoryChanged = item.categoryId !== args.categoryId;
      assertProcurementItemAssignmentAllowed({
        categoryIsActive: category.isActive,
        currentCategoryId: String(item.categoryId),
        nextCategoryId: String(args.categoryId),
      });

      if (categoryChanged && item.isActive) {
        await assertProcurementItemTierCapacity(ctx, {
          categoryId: String(args.categoryId),
          tenantId: String(authContext.tenantId),
          tier: mutationContext.tenant.tier,
        });
      }

      await assertProcurementItemUnique(ctx, {
        categoryId: String(args.categoryId),
        excludeItemId: String(args.itemId),
        normalizedName: parsed.normalizedName,
        tenantId: String(authContext.tenantId),
      });

      const nextRevision =
        getComparableProcurementItemRevision(item.revision) + 1;
      const now = Date.now();
      const priceChanged = (item.unitPrice ?? null) !== parsed.unitPrice;
      await ctx.db.patch(args.itemId, {
        catalogSearchText: buildProcurementItemCatalogSearchText({
          categoryName: category.name,
          description: parsed.name,
          name: parsed.name,
        }),
        categoryId: args.categoryId,
        categoryNameSnapshot: category.name,
        complianceFlags: parsed.complianceFlags,
        description: parsed.name,
        lastPriceChangedAt: priceChanged ? now : item.lastPriceChangedAt,
        lastPriceChangedByTenantUserId: priceChanged
          ? mutationContext.tenantUser._id
          : item.lastPriceChangedByTenantUserId,
        maxQuantity: parsed.maxQuantity,
        minQuantity: parsed.minQuantity,
        name: parsed.name,
        normalizedName: parsed.normalizedName,
        procurementMethod: parsed.procurementMethod,
        revision: nextRevision,
        sourceOfFunds: parsed.sourceOfFunds,
        unitOfMeasurement: parsed.unit,
        unitPrice: parsed.unitPrice,
        updatedAt: now,
      });

      if (priceChanged) {
        await ctx.db.insert("procurementItemPriceHistory", {
          ...createProcurementItemPriceHistoryEntry({
            changedAt: now,
            itemId: String(args.itemId),
            nextUnitPrice: parsed.unitPrice,
            previousUnitPrice: item.unitPrice ?? null,
          }),
          changedByTenantUserId: mutationContext.tenantUser._id,
          itemId: args.itemId,
          tenantId: authContext.tenantId,
        });

        await appendAuditLogRequired(
          ctx,
          buildItemAuditEntry({
            action: "price_change",
            actorUserId: authContext.userId,
            event: AUDIT_EVENT_NAMES.itemPriceChanged,
            itemId: args.itemId,
            metadata: {
              categoryId: String(args.categoryId),
              itemName: parsed.name,
              nextUnitPrice: parsed.unitPrice,
              previousUnitPrice: item.unitPrice ?? null,
              summary: `Changed price for ${parsed.name}.`,
            },
            tenantId: authContext.tenantId,
          }),
        );
      }

      if (categoryChanged) {
        await appendAuditLogRequired(
          ctx,
          buildItemAuditEntry({
            action: "move",
            actorUserId: authContext.userId,
            event: AUDIT_EVENT_NAMES.itemMoved,
            itemId: args.itemId,
            metadata: {
              fromCategoryId: String(item.categoryId),
              itemName: parsed.name,
              toCategoryId: String(args.categoryId),
              toCategoryName: category.name,
              summary: `Moved item ${parsed.name} to ${category.name}.`,
            },
            tenantId: authContext.tenantId,
          }),
        );
      }

      await appendAuditLogRequired(
        ctx,
        buildItemAuditEntry({
          action: "update",
          actorUserId: authContext.userId,
          event: AUDIT_EVENT_NAMES.itemUpdated,
          itemId: args.itemId,
          metadata: {
            categoryId: String(args.categoryId),
            itemName: parsed.name,
            summary: `Updated item ${parsed.name}.`,
          },
          tenantId: authContext.tenantId,
        }),
      );

      return {
        itemId: args.itemId,
        revision: nextRevision,
      };
    } catch (error) {
      await appendItemFailureAudit(ctx, {
        attemptedItemName: normalizeProcurementItemDisplayName(args.name),
        authContext: mutationContext?.authContext ?? null,
        event: AUDIT_EVENT_NAMES.itemUpdated,
        itemId: args.itemId,
        operation: "update item",
        error,
      });
      throw error;
    }
  },
});

export const archiveItem = mutation({
  args: {
    expectedRevision: v.number(),
    itemId: itemIdValidator,
  },
  handler: async (ctx, args) => {
    let mutationContext: Awaited<
      ReturnType<typeof loadItemMutationContext>
    > | null = null;
    try {
      mutationContext = await loadItemMutationContext(ctx);
      const item = await getItemForTenant(ctx, {
        itemId: args.itemId,
        tenantId: mutationContext.authContext.tenantId,
      });
      assertFreshItemRevision(item, args.expectedRevision);

      const nextRevision =
        getComparableProcurementItemRevision(item.revision) + 1;
      const now = Date.now();
      await ctx.db.patch(args.itemId, {
        archivedAt: now,
        archivedByTenantUserId: mutationContext.tenantUser._id,
        isActive: false,
        revision: nextRevision,
        updatedAt: now,
      });

      await appendAuditLogRequired(
        ctx,
        buildItemAuditEntry({
          action: "archive",
          actorUserId: mutationContext.authContext.userId,
          event: AUDIT_EVENT_NAMES.itemArchived,
          itemId: args.itemId,
          metadata: {
            itemName: item.name,
            summary: `Archived item ${item.name}.`,
          },
          tenantId: mutationContext.authContext.tenantId,
        }),
      );

      return { itemId: args.itemId, revision: nextRevision };
    } catch (error) {
      await appendItemFailureAudit(ctx, {
        authContext: mutationContext?.authContext ?? null,
        event: AUDIT_EVENT_NAMES.itemArchived,
        itemId: args.itemId,
        operation: "archive item",
        error,
      });
      throw error;
    }
  },
});

export const importItems = mutation({
  args: {
    rows: v.array(v.any()),
  },
  returns: itemImportResultValidator,
  handler: async (ctx, args) => {
    let mutationContext: Awaited<
      ReturnType<typeof loadItemMutationContext>
    > | null = null;
    try {
      mutationContext = await loadItemMutationContext(ctx);
      const { authContext, tenant, tenantUser } = mutationContext;
      if (tenant.tier === "free") {
        throw new ConvexError({
          code: "QUOTA_EXCEEDED",
          message: PROCUREMENT_ITEM_IMPORT_FREE_TIER_MESSAGE,
        });
      }

      const [categories, items] = await Promise.all([
        ctx.db
          .query("procurementCategories")
          .withIndex("by_tenantId", (q) =>
            q.eq("tenantId", authContext.tenantId),
          )
          .collect(),
        ctx.db
          .query("procurementItems")
          .withIndex("by_tenantId", (q) =>
            q.eq("tenantId", authContext.tenantId),
          )
          .collect(),
      ]);
      const categoriesByNormalizedName = new Map(
        categories
          .filter((category) => category.isActive)
          .map(
            (category) =>
              [normalizeProcurementItemName(category.name), category] as const,
          ),
      );
      const activeItemCountByCategoryId = new Map<string, number>();
      const existingKeys = new Set<string>();
      for (const item of items) {
        if (!item.isActive) {
          continue;
        }

        const categoryId = String(item.categoryId);
        activeItemCountByCategoryId.set(
          categoryId,
          (activeItemCountByCategoryId.get(categoryId) ?? 0) + 1,
        );
        existingKeys.add(
          createProcurementItemImportDuplicateKey({
            categoryId,
            normalizedName:
              item.normalizedName ?? normalizeProcurementItemName(item.name),
          }),
        );
      }

      const rowLimit = buildProcurementItemImportLimitState({
        tier: tenant.tier,
      }).rowLimit;
      const perCategoryLimit = buildProcurementItemTierLimitState({
        activeItemCount: 0,
        tier: tenant.tier,
      }).limit;
      const projectedCountByCategoryId = new Map(activeItemCountByCategoryId);
      const seenInFile = new Set<string>();
      const failures: Array<{ message: string; rowNumber: number }> = [];
      let createdCount = 0;

      for (let index = 0; index < args.rows.length; index += 1) {
        const row = asRowRecord(args.rows[index]);
        const rowNumber = index + 2;
        const categoryName = normalizeProcurementItemDisplayName(
          pickWorkbookValue(row, ["Category", "Category Name"]),
        );
        const resolvedCategory =
          categoriesByNormalizedName.get(
            normalizeProcurementItemName(categoryName),
          ) ?? null;
        const name = normalizeProcurementItemDisplayName(
          pickWorkbookValue(row, [
            "Item/Service Description",
            "Item Description",
            "Description",
          ]),
        );
        const normalizedName = normalizeProcurementItemName(name);
        const duplicateKey = createProcurementItemImportDuplicateKey({
          categoryId: resolvedCategory
            ? String(resolvedCategory._id)
            : categoryName,
          normalizedName,
        });
        const unitValue = normalizeImportedProcurementItemUnit(
          pickWorkbookValue(row, ["Unit Of Measurement", "Unit"]),
        );
        const unit = unitValue.value;
        const price =
          normalizeUnitPrice(pickWorkbookValue(row, ["Unit Price", "Price"])) ??
          null;
        const minQuantity =
          normalizeQuantityLimit(pickWorkbookValue(row, ["Min Quantity"])) ??
          null;
        const maxQuantity =
          normalizeQuantityLimit(pickWorkbookValue(row, ["Max Quantity"])) ??
          null;
        const complianceInput = pickWorkbookValue(row, [
          "Compliance Flags",
          "Compliance",
        ]);
        const complianceFlags = normalizeComplianceFlags(complianceInput);
        const rawComplianceValues = complianceInput
          ? complianceInput
              .split(/[;,]/)
              .map((value) => normalizeProcurementItemDisplayName(value))
              .filter(Boolean)
          : [];
        const failureMessage =
          unitValue.valid === false
            ? PROCUREMENT_ITEM_UNIT_INVALID_MESSAGE
            : rawComplianceValues.length > 0 &&
                complianceFlags.length !== rawComplianceValues.length
              ? PROCUREMENT_ITEM_COMPLIANCE_INVALID_MESSAGE
              : existingKeys.has(duplicateKey)
                ? PROCUREMENT_ITEM_DUPLICATE_MESSAGE
                : getProcurementItemImportRowFailure({
                    activeItemCount:
                      projectedCountByCategoryId.get(
                        String(resolvedCategory?._id ?? ""),
                      ) ?? 0,
                    categoryName,
                    hasActiveCategory: Boolean(resolvedCategory?.isActive),
                    limit: perCategoryLimit,
                    maxQuantity,
                    minQuantity,
                    normalizedName: duplicateKey,
                    price,
                    rowIndexWithinTierCap: index,
                    rowLimit,
                    seenInFile,
                    unit,
                  });

        if (failureMessage) {
          failures.push({ message: failureMessage, rowNumber });
          continue;
        }

        const parsedProcurementMethod =
          normalizeProcurementMethod(
            pickWorkbookValue(row, ["Proc Method", "Method"]),
          ) ?? "RFQ";
        const sourceOfFunds =
          normalizeProcurementItemDisplayName(
            pickWorkbookValue(row, ["Source Of Funds", "Source"]),
          ) || "GOK";
        const nextSortOrder = await resolveNextProcurementItemSortOrder({
          categoryId: String(resolvedCategory!._id),
          ctx,
          tenantId: String(authContext.tenantId),
        });
        const now = Date.now();
        const itemId = await ctx.db.insert("procurementItems", {
          archivedAt: undefined,
          archivedByTenantUserId: undefined,
          catalogSearchText: buildProcurementItemCatalogSearchText({
            categoryName: resolvedCategory!.name,
            description: name,
            name,
          }),
          categoryId: resolvedCategory!._id,
          categoryNameSnapshot: resolvedCategory!.name,
          complianceFlags,
          createdAt: now,
          description: name,
          isActive: true,
          lastPriceChangedAt: now,
          lastPriceChangedByTenantUserId: tenantUser._id,
          maxQuantity: maxQuantity ?? undefined,
          minQuantity: minQuantity ?? undefined,
          name,
          normalizedName,
          procurementMethod: parsedProcurementMethod,
          revision: 1,
          sortOrder: nextSortOrder,
          sourceOfFunds,
          tenantId: authContext.tenantId,
          unitOfMeasurement: unit,
          unitPrice: price ?? 0,
          updatedAt: now,
        });
        await ctx.db.insert("procurementItemPriceHistory", {
          changedAt: now,
          changedByTenantUserId: tenantUser._id,
          itemId,
          nextUnitPrice: price ?? 0,
          previousUnitPrice: null,
          tenantId: authContext.tenantId,
        });
        seenInFile.add(duplicateKey);
        existingKeys.add(duplicateKey);
        projectedCountByCategoryId.set(
          String(resolvedCategory!._id),
          (projectedCountByCategoryId.get(String(resolvedCategory!._id)) ?? 0) +
            1,
        );
        createdCount += 1;
      }

      await appendAuditLogRequired(
        ctx,
        buildItemAuditEntry({
          action: "import",
          actorUserId: authContext.userId,
          event: AUDIT_EVENT_NAMES.itemImported,
          itemId: null,
          metadata: {
            createdCount,
            failureCount: failures.length,
            summary: `Imported ${createdCount} items with ${failures.length} row-level failures.`,
          },
          tenantId: authContext.tenantId,
        }),
      );

      return {
        createdCount,
        failureCount: failures.length,
        failures,
        totalRows: args.rows.length,
      };
    } catch (error) {
      await appendItemFailureAudit(ctx, {
        authContext: mutationContext?.authContext ?? null,
        event: AUDIT_EVENT_NAMES.itemImported,
        itemId: null,
        metadata: {
          attemptedRowCount: args.rows.length,
        },
        operation: "import items",
        error,
      });
      throw error;
    }
  },
});

async function loadItemMutationContext(ctx: ItemMutationCtx) {
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

function resolveCatalogBrowsePageSize(pageSize: number): number {
  return Number.isInteger(pageSize) && pageSize > 0
    ? pageSize
    : PROCUREMENT_CATALOG_PAGE_SIZE;
}

async function collectProcurementCatalogBrowsePage(
  ctx: ItemQueryCtx,
  args: {
    categories: Array<Doc<"procurementCategories">>;
    matchesCatalogRow: ReturnType<typeof createProcurementCatalogRowMatcher>;
    pageSize: number;
    requestedPage: number;
    tenantId: Id<"tenants">;
    tier: Doc<"tenants">["tier"];
  },
) {
  const requestedStartIndex = (args.requestedPage - 1) * args.pageSize + 1;
  const requestedEndIndex = requestedStartIndex + args.pageSize - 1;
  const requestedPageRows: ProcurementItemWorkspaceRow[] = [];
  const lastPageRows: ProcurementItemWorkspaceRow[] =
    args.requestedPage > 1 ? [] : requestedPageRows;
  let totalCount = 0;

  for (const category of args.categories) {
    const items = await ctx.db
      .query("procurementItems")
      .withIndex("by_tenantId_categoryId", (q) =>
        q.eq("tenantId", args.tenantId).eq("categoryId", category._id),
      )
      .collect();
    const activeItemCount = items.filter((item) => item.isActive).length;
    const categoryRow = {
      activeItemCount,
      id: String(category._id),
      isActive: category.isActive,
      limit: buildProcurementItemTierLimitState({
        activeItemCount,
        tier: args.tier,
      }),
      name: category.name,
      sortOrder: category.sortOrder,
    };

    const sortedItems = [...items].sort(
      (left, right) =>
        Number(right.isActive) - Number(left.isActive) ||
        (left.sortOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
        left.name.localeCompare(right.name),
    );

    for (const item of sortedItems) {
      const row = createProcurementItemWorkspaceRow({
        category: categoryRow,
        item: {
          archivedAt: item.archivedAt ?? null,
          categoryId: String(item.categoryId),
          categoryName: category.name,
          complianceFlags: item.complianceFlags ?? [],
          description: item.description ?? item.name,
          id: String(item._id),
          isActive: item.isActive,
          lastPriceChangedAt: item.lastPriceChangedAt ?? null,
          maxQuantity: item.maxQuantity ?? null,
          minQuantity: item.minQuantity ?? null,
          name: item.name,
          procurementMethod: item.procurementMethod ?? null,
          revision: getComparableProcurementItemRevision(item.revision),
          sortOrder: item.sortOrder ?? Number.MAX_SAFE_INTEGER,
          sourceOfFunds: item.sourceOfFunds ?? null,
          unitOfMeasurement: item.unitOfMeasurement ?? null,
          unitPrice: item.unitPrice ?? null,
        },
        tier: args.tier,
      });

      if (!args.matchesCatalogRow(row)) {
        continue;
      }

      totalCount += 1;
      if (
        totalCount >= requestedStartIndex &&
        totalCount <= requestedEndIndex
      ) {
        requestedPageRows.push(row);
      }

      if (args.requestedPage > 1) {
        lastPageRows.push(row);
        if (lastPageRows.length > args.pageSize) {
          lastPageRows.shift();
        }
      }
    }
  }

  const totalPages =
    totalCount === 0 ? 0 : Math.ceil(totalCount / args.pageSize);
  const currentPage =
    totalPages === 0 ? 1 : Math.min(args.requestedPage, totalPages);

  return {
    currentPage,
    page:
      currentPage === args.requestedPage ? requestedPageRows : lastPageRows,
    pageSize: args.pageSize,
    totalCount,
    totalPages,
  };
}

function parseItemInput(args: {
  categoryId: Id<"procurementCategories">;
  complianceFlags: string[];
  customUnit?: string;
  maxQuantity?: number;
  minQuantity?: number;
  name: string;
  procurementMethod?: string;
  sourceOfFunds?: string;
  unit: string;
  unitPrice: number;
}) {
  const result = itemFormSchema.safeParse({
    categoryId: String(args.categoryId),
    complianceFlags: args.complianceFlags,
    customUnit: args.customUnit,
    maxQuantity: args.maxQuantity,
    minQuantity: args.minQuantity,
    name: args.name,
    procurementMethod: args.procurementMethod,
    sourceOfFunds: args.sourceOfFunds,
    unit: args.unit,
    unitPrice: args.unitPrice,
  });

  if (!result.success) {
    const issue = result.error.issues[0] ?? {
      message: PROCUREMENT_ITEM_NOT_FOUND_MESSAGE,
      path: ["item"],
    };
    throw new ConvexError({
      code: "VALIDATION_FAILED",
      field: issue.path[0] ?? "item",
      message: issue.message,
    });
  }

  return result.data;
}

async function getCategoryForTenant(
  ctx: ItemMutationCtx | ItemQueryCtx,
  args: {
    categoryId: Id<"procurementCategories">;
    tenantId: Id<"tenants">;
  },
) {
  const category = await ctx.db.get(args.categoryId);
  if (!category || category.tenantId !== args.tenantId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: PROCUREMENT_ITEM_NOT_FOUND_MESSAGE,
    });
  }
  return category;
}

async function getItemForTenant(
  ctx: ItemMutationCtx | ItemQueryCtx,
  args: {
    itemId: Id<"procurementItems">;
    tenantId: Id<"tenants">;
  },
) {
  const item = await ctx.db.get(args.itemId);
  if (!item || item.tenantId !== args.tenantId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: PROCUREMENT_ITEM_NOT_FOUND_MESSAGE,
    });
  }
  return item;
}

function assertFreshItemRevision(
  item: Pick<ItemRecord, "revision">,
  expectedRevision: number,
) {
  if (
    getComparableProcurementItemRevision(item.revision) !== expectedRevision
  ) {
    throw new ConvexError({
      code: "CONFLICT",
      message: PROCUREMENT_ITEM_REFRESH_REQUIRED_MESSAGE,
    });
  }
}

function buildItemAuditEntry(args: {
  action: string;
  actorUserId: Id<"users">;
  event: string;
  itemId: Id<"procurementItems"> | null;
  metadata: Record<string, unknown>;
  tenantId: Id<"tenants">;
}) {
  return {
    action: args.action,
    actor: createAuthenticatedAuditActor({
      role: "procurement_officer",
      userId: String(args.actorUserId),
    }),
    entityType: "item",
    event: args.event as AuditEventName,
    metadata: args.metadata,
    outcome: AUDIT_OUTCOMES.allowed,
    recordId: args.itemId ? String(args.itemId) : undefined,
    sourceTenantId: String(args.tenantId),
    tableName: "procurementItems",
    targetTenantId: String(args.tenantId),
    timestamp: Date.now(),
  };
}

async function appendItemFailureAudit(
  ctx: ItemMutationCtx,
  args: {
    attemptedItemName?: string;
    authContext?: Awaited<ReturnType<typeof getAuthorizationContext>> | null;
    error: unknown;
    event: string;
    itemId: Id<"procurementItems"> | null;
    metadata?: Record<string, unknown>;
    operation: string;
  },
) {
  const resolvedAuthContext =
    args.authContext ?? (await getAuthorizationContext(ctx));
  const actor = resolvedAuthContext?.userId
    ? createAuthenticatedAuditActor({
        role: resolvedAuthContext.role,
        userId: String(resolvedAuthContext.userId),
      })
    : createAnonymousAuditActor();
  const resolvedTenantId = resolvedAuthContext?.tenantId;

  await appendAuditLogBestEffort(ctx, {
    action: "error",
    actor,
    entityType: "item",
    event: args.event as AuditEventName,
    metadata: {
      ...args.metadata,
      attemptedItemName: args.attemptedItemName,
      failureReason: getItemFailureReason(args.error),
      summary: `Failed to ${args.operation}.`,
    },
    outcome: AUDIT_OUTCOMES.failed,
    recordId: args.itemId ? String(args.itemId) : undefined,
    sourceTenantId: resolvedTenantId ? String(resolvedTenantId) : undefined,
    tableName: "procurementItems",
    targetTenantId: resolvedTenantId ? String(resolvedTenantId) : undefined,
    timestamp: Date.now(),
  });
}

function getItemFailureReason(error: unknown): string {
  if (error instanceof ConvexError) {
    const message =
      error.data &&
      typeof error.data === "object" &&
      "message" in error.data &&
      typeof error.data.message === "string"
        ? error.data.message
        : null;
    if (message) {
      return message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return "Unexpected item operation failure.";
}

function asRowRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function pickWorkbookValue(
  row: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}
