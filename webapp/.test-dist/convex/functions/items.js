"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importItems = exports.archiveItem = exports.updateItem = exports.createItem = exports.browseItemsCatalog = exports.getItemsWorkspace = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const audit_1 = require("../../lib/security/audit");
const catalog_filters_1 = require("../../lib/procurement-officer/catalog-filters");
const item_backend_1 = require("../../lib/procurement-officer/item-backend");
const items_1 = require("../../lib/procurement-officer/items");
const item_1 = require("../../lib/validators/item");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const _tenantGuard_1 = require("./_tenantGuard");
const itemIdValidator = values_1.v.id("procurementItems");
const categoryIdValidator = values_1.v.id("procurementCategories");
const itemImportResultValidator = values_1.v.object({
    createdCount: values_1.v.number(),
    failureCount: values_1.v.number(),
    failures: values_1.v.array(values_1.v.object({
        message: values_1.v.string(),
        rowNumber: values_1.v.number(),
    })),
    totalRows: values_1.v.number(),
});
const browseCatalogArgsValidator = {
    categoryIds: values_1.v.array(values_1.v.string()),
    complianceFlags: values_1.v.array(values_1.v.string()),
    maxPrice: values_1.v.optional(values_1.v.number()),
    minPrice: values_1.v.optional(values_1.v.number()),
    page: values_1.v.number(),
    pageSize: values_1.v.optional(values_1.v.number()),
    searchText: values_1.v.string(),
};
exports.getItemsWorkspace = (0, server_1.query)({
    args: {},
    handler: async (ctx) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const tenant = await ctx.db.get(authContext.tenantId);
        if (!tenant) {
            throw new values_1.ConvexError({
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
        const activeItemCountByCategoryId = new Map();
        for (const item of items) {
            if (!item.isActive) {
                continue;
            }
            activeItemCountByCategoryId.set(String(item.categoryId), (activeItemCountByCategoryId.get(String(item.categoryId)) ?? 0) + 1);
        }
        const categoryRows = [...categories]
            .sort((left, right) => left.sortOrder - right.sortOrder ||
            left.name.localeCompare(right.name))
            .map((category) => ({
            activeItemCount: activeItemCountByCategoryId.get(String(category._id)) ?? 0,
            id: String(category._id),
            isActive: category.isActive,
            limit: (0, items_1.buildProcurementItemTierLimitState)({
                activeItemCount: activeItemCountByCategoryId.get(String(category._id)) ?? 0,
                tier: tenant.tier,
            }),
            name: category.name,
            sortOrder: category.sortOrder,
        }));
        return {
            categories: categoryRows,
            meta: {
                activeItemCount: items.filter((item) => item.isActive).length,
                defaultPageSize: catalog_filters_1.PROCUREMENT_CATALOG_PAGE_SIZE,
                importLimit: (0, items_1.buildProcurementItemImportLimitState)({
                    tier: tenant.tier,
                }),
                tier: tenant.tier,
                totalItemCount: items.length,
            },
        };
    },
});
exports.browseItemsCatalog = (0, server_1.query)({
    args: browseCatalogArgsValidator,
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const tenant = await ctx.db.get(authContext.tenantId);
        if (!tenant) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }
        const categories = await ctx.db
            .query("procurementCategories")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
            .collect();
        const normalizedFilters = (0, catalog_filters_1.normalizeProcurementCatalogBrowseState)({
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
        const selectedCategoryIds = normalizedFilters.categoryIds.length > 0
            ? new Set(normalizedFilters.categoryIds)
            : null;
        const sortedCategories = [...categories]
            .sort((left, right) => left.sortOrder - right.sortOrder ||
            left.name.localeCompare(right.name))
            .filter((category) => selectedCategoryIds ? selectedCategoryIds.has(String(category._id)) : true);
        const pageSize = resolveCatalogBrowsePageSize(args.pageSize ?? catalog_filters_1.PROCUREMENT_CATALOG_PAGE_SIZE);
        const requestedPage = normalizedFilters.page;
        const matchesCatalogRow = (0, items_1.createProcurementCatalogRowMatcher)(normalizedFilters);
        const browsePage = await collectProcurementCatalogBrowsePage(ctx, {
            categories: sortedCategories,
            matchesCatalogRow,
            pageSize,
            requestedPage,
            tenantId: authContext.tenantId,
            tier: tenant.tier,
        });
        const firstRowIndex = browsePage.totalCount === 0
            ? 0
            : (browsePage.currentPage - 1) * browsePage.pageSize + 1;
        return {
            meta: {
                currentPage: browsePage.currentPage,
                endRow: firstRowIndex === 0
                    ? 0
                    : firstRowIndex + browsePage.page.length - 1,
                filteredCount: browsePage.totalCount,
                hasNextPage: browsePage.totalPages > 0 &&
                    browsePage.currentPage < browsePage.totalPages,
                hasPreviousPage: browsePage.totalPages > 0 && browsePage.currentPage > 1,
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
exports.createItem = (0, server_1.mutation)({
    args: {
        categoryId: categoryIdValidator,
        complianceFlags: values_1.v.array(values_1.v.string()),
        customUnit: values_1.v.optional(values_1.v.string()),
        maxQuantity: values_1.v.optional(values_1.v.number()),
        minQuantity: values_1.v.optional(values_1.v.number()),
        name: values_1.v.string(),
        procurementMethod: values_1.v.optional(values_1.v.string()),
        sourceOfFunds: values_1.v.optional(values_1.v.string()),
        unit: values_1.v.string(),
        unitPrice: values_1.v.number(),
    },
    handler: async (ctx, args) => {
        let mutationContext = null;
        try {
            mutationContext = await loadItemMutationContext(ctx);
            const { authContext } = mutationContext;
            const parsed = parseItemInput(args);
            const category = await getCategoryForTenant(ctx, {
                categoryId: args.categoryId,
                tenantId: authContext.tenantId,
            });
            (0, item_backend_1.assertProcurementItemAssignmentAllowed)({
                categoryIsActive: category.isActive,
                nextCategoryId: String(args.categoryId),
            });
            await (0, item_backend_1.assertProcurementItemTierCapacity)(ctx, {
                categoryId: String(args.categoryId),
                tenantId: String(authContext.tenantId),
                tier: mutationContext.tenant.tier,
            });
            await (0, item_backend_1.assertProcurementItemUnique)(ctx, {
                categoryId: String(args.categoryId),
                normalizedName: parsed.normalizedName,
                tenantId: String(authContext.tenantId),
            });
            const nextSortOrder = await (0, item_backend_1.resolveNextProcurementItemSortOrder)({
                categoryId: String(args.categoryId),
                ctx,
                tenantId: String(authContext.tenantId),
            });
            const now = Date.now();
            const itemId = await ctx.db.insert("procurementItems", {
                archivedAt: undefined,
                archivedByTenantUserId: undefined,
                catalogSearchText: (0, items_1.buildProcurementItemCatalogSearchText)({
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
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildItemAuditEntry({
                action: "create",
                actorUserId: authContext.userId,
                event: audit_1.AUDIT_EVENT_NAMES.itemCreated,
                itemId,
                metadata: {
                    categoryId: String(args.categoryId),
                    categoryName: category.name,
                    itemName: parsed.name,
                    summary: `Created item ${parsed.name}.`,
                },
                tenantId: authContext.tenantId,
            }));
            return { itemId, revision: 1 };
        }
        catch (error) {
            await appendItemFailureAudit(ctx, {
                attemptedItemName: (0, items_1.normalizeProcurementItemDisplayName)(args.name),
                authContext: mutationContext?.authContext ?? null,
                event: audit_1.AUDIT_EVENT_NAMES.itemCreated,
                itemId: null,
                operation: "create item",
                error,
            });
            throw error;
        }
    },
});
exports.updateItem = (0, server_1.mutation)({
    args: {
        categoryId: categoryIdValidator,
        complianceFlags: values_1.v.array(values_1.v.string()),
        customUnit: values_1.v.optional(values_1.v.string()),
        expectedRevision: values_1.v.number(),
        itemId: itemIdValidator,
        maxQuantity: values_1.v.optional(values_1.v.number()),
        minQuantity: values_1.v.optional(values_1.v.number()),
        name: values_1.v.string(),
        procurementMethod: values_1.v.optional(values_1.v.string()),
        sourceOfFunds: values_1.v.optional(values_1.v.string()),
        unit: values_1.v.string(),
        unitPrice: values_1.v.number(),
    },
    handler: async (ctx, args) => {
        let mutationContext = null;
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
            (0, item_backend_1.assertProcurementItemAssignmentAllowed)({
                categoryIsActive: category.isActive,
                currentCategoryId: String(item.categoryId),
                nextCategoryId: String(args.categoryId),
            });
            if (categoryChanged && item.isActive) {
                await (0, item_backend_1.assertProcurementItemTierCapacity)(ctx, {
                    categoryId: String(args.categoryId),
                    tenantId: String(authContext.tenantId),
                    tier: mutationContext.tenant.tier,
                });
            }
            await (0, item_backend_1.assertProcurementItemUnique)(ctx, {
                categoryId: String(args.categoryId),
                excludeItemId: String(args.itemId),
                normalizedName: parsed.normalizedName,
                tenantId: String(authContext.tenantId),
            });
            const nextRevision = (0, items_1.getComparableProcurementItemRevision)(item.revision) + 1;
            const now = Date.now();
            const priceChanged = (item.unitPrice ?? null) !== parsed.unitPrice;
            await ctx.db.patch(args.itemId, {
                catalogSearchText: (0, items_1.buildProcurementItemCatalogSearchText)({
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
                    ...(0, items_1.createProcurementItemPriceHistoryEntry)({
                        changedAt: now,
                        itemId: String(args.itemId),
                        nextUnitPrice: parsed.unitPrice,
                        previousUnitPrice: item.unitPrice ?? null,
                    }),
                    changedByTenantUserId: mutationContext.tenantUser._id,
                    itemId: args.itemId,
                    tenantId: authContext.tenantId,
                });
                await (0, _audit_1.appendAuditLogRequired)(ctx, buildItemAuditEntry({
                    action: "price_change",
                    actorUserId: authContext.userId,
                    event: audit_1.AUDIT_EVENT_NAMES.itemPriceChanged,
                    itemId: args.itemId,
                    metadata: {
                        categoryId: String(args.categoryId),
                        itemName: parsed.name,
                        nextUnitPrice: parsed.unitPrice,
                        previousUnitPrice: item.unitPrice ?? null,
                        summary: `Changed price for ${parsed.name}.`,
                    },
                    tenantId: authContext.tenantId,
                }));
            }
            if (categoryChanged) {
                await (0, _audit_1.appendAuditLogRequired)(ctx, buildItemAuditEntry({
                    action: "move",
                    actorUserId: authContext.userId,
                    event: audit_1.AUDIT_EVENT_NAMES.itemMoved,
                    itemId: args.itemId,
                    metadata: {
                        fromCategoryId: String(item.categoryId),
                        itemName: parsed.name,
                        toCategoryId: String(args.categoryId),
                        toCategoryName: category.name,
                        summary: `Moved item ${parsed.name} to ${category.name}.`,
                    },
                    tenantId: authContext.tenantId,
                }));
            }
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildItemAuditEntry({
                action: "update",
                actorUserId: authContext.userId,
                event: audit_1.AUDIT_EVENT_NAMES.itemUpdated,
                itemId: args.itemId,
                metadata: {
                    categoryId: String(args.categoryId),
                    itemName: parsed.name,
                    summary: `Updated item ${parsed.name}.`,
                },
                tenantId: authContext.tenantId,
            }));
            return {
                itemId: args.itemId,
                revision: nextRevision,
            };
        }
        catch (error) {
            await appendItemFailureAudit(ctx, {
                attemptedItemName: (0, items_1.normalizeProcurementItemDisplayName)(args.name),
                authContext: mutationContext?.authContext ?? null,
                event: audit_1.AUDIT_EVENT_NAMES.itemUpdated,
                itemId: args.itemId,
                operation: "update item",
                error,
            });
            throw error;
        }
    },
});
exports.archiveItem = (0, server_1.mutation)({
    args: {
        expectedRevision: values_1.v.number(),
        itemId: itemIdValidator,
    },
    handler: async (ctx, args) => {
        let mutationContext = null;
        try {
            mutationContext = await loadItemMutationContext(ctx);
            const item = await getItemForTenant(ctx, {
                itemId: args.itemId,
                tenantId: mutationContext.authContext.tenantId,
            });
            assertFreshItemRevision(item, args.expectedRevision);
            const nextRevision = (0, items_1.getComparableProcurementItemRevision)(item.revision) + 1;
            const now = Date.now();
            await ctx.db.patch(args.itemId, {
                archivedAt: now,
                archivedByTenantUserId: mutationContext.tenantUser._id,
                isActive: false,
                revision: nextRevision,
                updatedAt: now,
            });
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildItemAuditEntry({
                action: "archive",
                actorUserId: mutationContext.authContext.userId,
                event: audit_1.AUDIT_EVENT_NAMES.itemArchived,
                itemId: args.itemId,
                metadata: {
                    itemName: item.name,
                    summary: `Archived item ${item.name}.`,
                },
                tenantId: mutationContext.authContext.tenantId,
            }));
            return { itemId: args.itemId, revision: nextRevision };
        }
        catch (error) {
            await appendItemFailureAudit(ctx, {
                authContext: mutationContext?.authContext ?? null,
                event: audit_1.AUDIT_EVENT_NAMES.itemArchived,
                itemId: args.itemId,
                operation: "archive item",
                error,
            });
            throw error;
        }
    },
});
exports.importItems = (0, server_1.mutation)({
    args: {
        rows: values_1.v.array(values_1.v.any()),
    },
    returns: itemImportResultValidator,
    handler: async (ctx, args) => {
        let mutationContext = null;
        try {
            mutationContext = await loadItemMutationContext(ctx);
            const { authContext, tenant, tenantUser } = mutationContext;
            if (tenant.tier === "free") {
                throw new values_1.ConvexError({
                    code: "QUOTA_EXCEEDED",
                    message: items_1.PROCUREMENT_ITEM_IMPORT_FREE_TIER_MESSAGE,
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
            const categoriesByNormalizedName = new Map(categories
                .filter((category) => category.isActive)
                .map((category) => [(0, items_1.normalizeProcurementItemName)(category.name), category]));
            const activeItemCountByCategoryId = new Map();
            const existingKeys = new Set();
            for (const item of items) {
                if (!item.isActive) {
                    continue;
                }
                const categoryId = String(item.categoryId);
                activeItemCountByCategoryId.set(categoryId, (activeItemCountByCategoryId.get(categoryId) ?? 0) + 1);
                existingKeys.add((0, item_backend_1.createProcurementItemImportDuplicateKey)({
                    categoryId,
                    normalizedName: item.normalizedName ?? (0, items_1.normalizeProcurementItemName)(item.name),
                }));
            }
            const rowLimit = (0, items_1.buildProcurementItemImportLimitState)({
                tier: tenant.tier,
            }).rowLimit;
            const perCategoryLimit = (0, items_1.buildProcurementItemTierLimitState)({
                activeItemCount: 0,
                tier: tenant.tier,
            }).limit;
            const projectedCountByCategoryId = new Map(activeItemCountByCategoryId);
            const seenInFile = new Set();
            const failures = [];
            let createdCount = 0;
            for (let index = 0; index < args.rows.length; index += 1) {
                const row = asRowRecord(args.rows[index]);
                const rowNumber = index + 2;
                const categoryName = (0, items_1.normalizeProcurementItemDisplayName)(pickWorkbookValue(row, ["Category", "Category Name"]));
                const resolvedCategory = categoriesByNormalizedName.get((0, items_1.normalizeProcurementItemName)(categoryName)) ?? null;
                const name = (0, items_1.normalizeProcurementItemDisplayName)(pickWorkbookValue(row, [
                    "Item/Service Description",
                    "Item Description",
                    "Description",
                ]));
                const normalizedName = (0, items_1.normalizeProcurementItemName)(name);
                const duplicateKey = (0, item_backend_1.createProcurementItemImportDuplicateKey)({
                    categoryId: resolvedCategory
                        ? String(resolvedCategory._id)
                        : categoryName,
                    normalizedName,
                });
                const unitValue = (0, items_1.normalizeImportedProcurementItemUnit)(pickWorkbookValue(row, ["Unit Of Measurement", "Unit"]));
                const unit = unitValue.value;
                const price = (0, items_1.normalizeUnitPrice)(pickWorkbookValue(row, ["Unit Price", "Price"])) ??
                    null;
                const minQuantity = (0, items_1.normalizeQuantityLimit)(pickWorkbookValue(row, ["Min Quantity"])) ??
                    null;
                const maxQuantity = (0, items_1.normalizeQuantityLimit)(pickWorkbookValue(row, ["Max Quantity"])) ??
                    null;
                const complianceInput = pickWorkbookValue(row, [
                    "Compliance Flags",
                    "Compliance",
                ]);
                const complianceFlags = (0, items_1.normalizeComplianceFlags)(complianceInput);
                const rawComplianceValues = complianceInput
                    ? complianceInput
                        .split(/[;,]/)
                        .map((value) => (0, items_1.normalizeProcurementItemDisplayName)(value))
                        .filter(Boolean)
                    : [];
                const failureMessage = unitValue.valid === false
                    ? items_1.PROCUREMENT_ITEM_UNIT_INVALID_MESSAGE
                    : rawComplianceValues.length > 0 &&
                        complianceFlags.length !== rawComplianceValues.length
                        ? items_1.PROCUREMENT_ITEM_COMPLIANCE_INVALID_MESSAGE
                        : existingKeys.has(duplicateKey)
                            ? items_1.PROCUREMENT_ITEM_DUPLICATE_MESSAGE
                            : (0, items_1.getProcurementItemImportRowFailure)({
                                activeItemCount: projectedCountByCategoryId.get(String(resolvedCategory?._id ?? "")) ?? 0,
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
                const parsedProcurementMethod = (0, items_1.normalizeProcurementMethod)(pickWorkbookValue(row, ["Proc Method", "Method"])) ?? "RFQ";
                const sourceOfFunds = (0, items_1.normalizeProcurementItemDisplayName)(pickWorkbookValue(row, ["Source Of Funds", "Source"])) || "GOK";
                const nextSortOrder = await (0, item_backend_1.resolveNextProcurementItemSortOrder)({
                    categoryId: String(resolvedCategory._id),
                    ctx,
                    tenantId: String(authContext.tenantId),
                });
                const now = Date.now();
                const itemId = await ctx.db.insert("procurementItems", {
                    archivedAt: undefined,
                    archivedByTenantUserId: undefined,
                    catalogSearchText: (0, items_1.buildProcurementItemCatalogSearchText)({
                        categoryName: resolvedCategory.name,
                        description: name,
                        name,
                    }),
                    categoryId: resolvedCategory._id,
                    categoryNameSnapshot: resolvedCategory.name,
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
                projectedCountByCategoryId.set(String(resolvedCategory._id), (projectedCountByCategoryId.get(String(resolvedCategory._id)) ?? 0) +
                    1);
                createdCount += 1;
            }
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildItemAuditEntry({
                action: "import",
                actorUserId: authContext.userId,
                event: audit_1.AUDIT_EVENT_NAMES.itemImported,
                itemId: null,
                metadata: {
                    createdCount,
                    failureCount: failures.length,
                    summary: `Imported ${createdCount} items with ${failures.length} row-level failures.`,
                },
                tenantId: authContext.tenantId,
            }));
            return {
                createdCount,
                failureCount: failures.length,
                failures,
                totalRows: args.rows.length,
            };
        }
        catch (error) {
            await appendItemFailureAudit(ctx, {
                authContext: mutationContext?.authContext ?? null,
                event: audit_1.AUDIT_EVENT_NAMES.itemImported,
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
async function loadItemMutationContext(ctx) {
    const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
    const [tenant, tenantUser] = await Promise.all([
        ctx.db.get(authContext.tenantId),
        (0, _tenantGuard_1.getCurrentTenantUserMembership)(ctx),
    ]);
    if (!tenant) {
        throw new values_1.ConvexError({
            code: "NOT_FOUND",
            message: "Tenant record not found",
        });
    }
    if (!tenantUser ||
        tenantUser.role !== "procurement_officer" ||
        !tenantUser.isActive) {
        throw new values_1.ConvexError({
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
function resolveCatalogBrowsePageSize(pageSize) {
    return Number.isInteger(pageSize) && pageSize > 0
        ? pageSize
        : catalog_filters_1.PROCUREMENT_CATALOG_PAGE_SIZE;
}
async function collectProcurementCatalogBrowsePage(ctx, args) {
    const requestedStartIndex = (args.requestedPage - 1) * args.pageSize + 1;
    const requestedEndIndex = requestedStartIndex + args.pageSize - 1;
    const requestedPageRows = [];
    const lastPageRows = args.requestedPage > 1 ? [] : requestedPageRows;
    let totalCount = 0;
    for (const category of args.categories) {
        const items = await ctx.db
            .query("procurementItems")
            .withIndex("by_tenantId_categoryId", (q) => q.eq("tenantId", args.tenantId).eq("categoryId", category._id))
            .collect();
        const activeItemCount = items.filter((item) => item.isActive).length;
        const categoryRow = {
            activeItemCount,
            id: String(category._id),
            isActive: category.isActive,
            limit: (0, items_1.buildProcurementItemTierLimitState)({
                activeItemCount,
                tier: args.tier,
            }),
            name: category.name,
            sortOrder: category.sortOrder,
        };
        const sortedItems = [...items].sort((left, right) => Number(right.isActive) - Number(left.isActive) ||
            (left.sortOrder ?? Number.MAX_SAFE_INTEGER) -
                (right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
            left.name.localeCompare(right.name));
        for (const item of sortedItems) {
            const row = (0, items_1.createProcurementItemWorkspaceRow)({
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
                    revision: (0, items_1.getComparableProcurementItemRevision)(item.revision),
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
            if (totalCount >= requestedStartIndex &&
                totalCount <= requestedEndIndex) {
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
    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / args.pageSize);
    const currentPage = totalPages === 0 ? 1 : Math.min(args.requestedPage, totalPages);
    return {
        currentPage,
        page: currentPage === args.requestedPage ? requestedPageRows : lastPageRows,
        pageSize: args.pageSize,
        totalCount,
        totalPages,
    };
}
function parseItemInput(args) {
    const result = item_1.itemFormSchema.safeParse({
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
            message: items_1.PROCUREMENT_ITEM_NOT_FOUND_MESSAGE,
            path: ["item"],
        };
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            field: issue.path[0] ?? "item",
            message: issue.message,
        });
    }
    return result.data;
}
async function getCategoryForTenant(ctx, args) {
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.tenantId !== args.tenantId) {
        throw new values_1.ConvexError({
            code: "NOT_FOUND",
            message: items_1.PROCUREMENT_ITEM_NOT_FOUND_MESSAGE,
        });
    }
    return category;
}
async function getItemForTenant(ctx, args) {
    const item = await ctx.db.get(args.itemId);
    if (!item || item.tenantId !== args.tenantId) {
        throw new values_1.ConvexError({
            code: "NOT_FOUND",
            message: items_1.PROCUREMENT_ITEM_NOT_FOUND_MESSAGE,
        });
    }
    return item;
}
function assertFreshItemRevision(item, expectedRevision) {
    if ((0, items_1.getComparableProcurementItemRevision)(item.revision) !== expectedRevision) {
        throw new values_1.ConvexError({
            code: "CONFLICT",
            message: items_1.PROCUREMENT_ITEM_REFRESH_REQUIRED_MESSAGE,
        });
    }
}
function buildItemAuditEntry(args) {
    return {
        action: args.action,
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "procurement_officer",
            userId: String(args.actorUserId),
        }),
        entityType: "item",
        event: args.event,
        metadata: args.metadata,
        outcome: audit_1.AUDIT_OUTCOMES.allowed,
        recordId: args.itemId ? String(args.itemId) : undefined,
        sourceTenantId: String(args.tenantId),
        tableName: "procurementItems",
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    };
}
async function appendItemFailureAudit(ctx, args) {
    const resolvedAuthContext = args.authContext ?? (await (0, _roleGuard_1.getAuthorizationContext)(ctx));
    const actor = resolvedAuthContext?.userId
        ? (0, audit_1.createAuthenticatedAuditActor)({
            role: resolvedAuthContext.role,
            userId: String(resolvedAuthContext.userId),
        })
        : (0, audit_1.createAnonymousAuditActor)();
    const resolvedTenantId = resolvedAuthContext?.tenantId;
    await (0, _audit_1.appendAuditLogBestEffort)(ctx, {
        action: "error",
        actor,
        entityType: "item",
        event: args.event,
        metadata: {
            ...args.metadata,
            attemptedItemName: args.attemptedItemName,
            failureReason: getItemFailureReason(args.error),
            summary: `Failed to ${args.operation}.`,
        },
        outcome: audit_1.AUDIT_OUTCOMES.failed,
        recordId: args.itemId ? String(args.itemId) : undefined,
        sourceTenantId: resolvedTenantId ? String(resolvedTenantId) : undefined,
        tableName: "procurementItems",
        targetTenantId: resolvedTenantId ? String(resolvedTenantId) : undefined,
        timestamp: Date.now(),
    });
}
function getItemFailureReason(error) {
    if (error instanceof values_1.ConvexError) {
        const message = error.data &&
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
function asRowRecord(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value;
    }
    return {};
}
function pickWorkbookValue(row, keys) {
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
