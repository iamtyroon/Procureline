"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCategories = exports.reorderCategories = exports.deleteCategory = exports.archiveCategory = exports.updateCategory = exports.createCategory = exports.getCategoriesWorkspace = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const audit_1 = require("../../lib/security/audit");
const categories_1 = require("../../lib/procurement-officer/categories");
const items_1 = require("../../lib/procurement-officer/items");
const category_1 = require("../../lib/validators/category");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const _tenantGuard_1 = require("./_tenantGuard");
const categoryIdValidator = values_1.v.id("procurementCategories");
const reorderRevisionValidator = values_1.v.object({
    categoryId: values_1.v.string(),
    revision: values_1.v.number(),
});
const categoryImportResultValidator = values_1.v.object({
    createdCount: values_1.v.number(),
    failureCount: values_1.v.number(),
    failures: values_1.v.array(values_1.v.object({
        message: values_1.v.string(),
        rowNumber: values_1.v.number(),
    })),
    totalRows: values_1.v.number(),
});
exports.getCategoriesWorkspace = (0, server_1.query)({
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
        const [categories, items, plans] = await Promise.all([
            ctx.db
                .query("procurementCategories")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("procurementItems")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("plans")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
        ]);
        const activeItemCountByCategoryId = new Map();
        const assignedItemCountByCategoryId = new Map();
        for (const item of items) {
            assignedItemCountByCategoryId.set(String(item.categoryId), (assignedItemCountByCategoryId.get(String(item.categoryId)) ?? 0) + 1);
            if (!item.isActive) {
                continue;
            }
            activeItemCountByCategoryId.set(String(item.categoryId), (activeItemCountByCategoryId.get(String(item.categoryId)) ?? 0) + 1);
        }
        const planStatusesByCategoryId = new Map();
        for (const plan of plans) {
            const referencedCategoryIds = new Set([
                ...plan.selectedCategoryIds.map((categoryId) => String(categoryId)),
                ...plan.categorySummaries.map((summary) => String(summary.categoryId)),
            ]);
            for (const categoryId of Array.from(referencedCategoryIds)) {
                const existing = planStatusesByCategoryId.get(categoryId) ??
                    new Set();
                existing.add(plan.status);
                planStatusesByCategoryId.set(categoryId, existing);
            }
        }
        const summary = (0, categories_1.buildCategoryWorkspaceSummary)({
            categories: categories.map((category) => ({
                assignedItemCount: assignedItemCountByCategoryId.get(String(category._id)) ?? 0,
                archivedAt: category.archivedAt ?? null,
                color: category.color ?? null,
                description: category.description ?? null,
                icon: category.icon ?? null,
                id: String(category._id),
                isActive: category.isActive,
                itemCount: activeItemCountByCategoryId.get(String(category._id)) ?? 0,
                name: category.name,
                planStatuses: Array.from(planStatusesByCategoryId.get(String(category._id)) ??
                    new Set()),
                revision: (0, categories_1.getComparableCategoryRevision)(category.revision),
                sortOrder: category.sortOrder,
            })),
            tier: tenant.tier,
        });
        return {
            meta: {
                activeCategoryCount: summary.rows.filter((row) => row.isActive).length,
                limit: summary.limit,
                nextSortOrder: Math.max(0, ...summary.rows.map((row) => row.sortOrder)) + 1,
                totalCategoryCount: summary.rows.length,
            },
            rows: summary.rows.map((row) => ({
                archivedAt: row.archivedAt,
                archivedLabel: row.archivedLabel,
                canDelete: row.deleteBlockers.canDelete,
                color: row.color,
                deleteBlockerMessages: row.deleteBlockers.messages,
                description: row.description,
                icon: row.icon,
                id: row.id,
                isActive: row.isActive,
                itemCount: row.itemCount,
                name: row.name,
                planningImpactWarning: row.planningImpactWarning,
                planningStateLabel: row.planningStateLabel,
                revision: row.revision,
                sortOrder: row.sortOrder,
            })),
        };
    },
});
exports.createCategory = (0, server_1.mutation)({
    args: {
        color: values_1.v.optional(values_1.v.string()),
        description: values_1.v.optional(values_1.v.string()),
        icon: values_1.v.optional(values_1.v.string()),
        name: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        let mutationContext = null;
        try {
            mutationContext = await loadCategoryMutationContext(ctx);
            const { authContext, tenant, tenantUser } = mutationContext;
            const parsed = parseCategoryInput(args);
            await assertCategoryUnique(ctx, {
                normalizedName: parsed.normalizedName,
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
            const nextSortOrder = Math.max(0, ...existingCategories.map((category) => category.sortOrder)) + 1;
            const now = Date.now();
            const categoryId = await ctx.db.insert("procurementCategories", {
                archivedAt: undefined,
                archivedByTenantUserId: undefined,
                color: parsed.color,
                createdAt: now,
                description: parsed.description,
                icon: parsed.icon,
                isActive: true,
                name: parsed.name,
                normalizedName: parsed.normalizedName,
                revision: 1,
                sortOrder: nextSortOrder,
                tenantId: authContext.tenantId,
                updatedAt: now,
            });
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildCategoryAuditEntry({
                action: "create",
                actorUserId: authContext.userId,
                categoryId,
                event: audit_1.AUDIT_EVENT_NAMES.categoryCreated,
                metadata: {
                    categoryColor: parsed.color ?? null,
                    categoryIcon: parsed.icon ?? null,
                    categoryName: parsed.name,
                    summary: `Created category ${parsed.name}.`,
                },
                tenantId: authContext.tenantId,
            }));
            return { categoryId, revision: 1, tenantUserId: tenantUser._id };
        }
        catch (error) {
            await appendCategoryFailureAudit(ctx, {
                action: "create",
                attemptedCategoryName: normalizePlainTextValue(args.name),
                categoryId: null,
                event: audit_1.AUDIT_EVENT_NAMES.categoryCreated,
                authContext: mutationContext?.authContext ?? null,
                operation: "create category",
                error,
            });
            throw error;
        }
    },
});
exports.updateCategory = (0, server_1.mutation)({
    args: {
        categoryId: categoryIdValidator,
        color: values_1.v.optional(values_1.v.string()),
        description: values_1.v.optional(values_1.v.string()),
        expectedRevision: values_1.v.number(),
        icon: values_1.v.optional(values_1.v.string()),
        name: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        let mutationContext = null;
        try {
            mutationContext = await loadCategoryMutationContext(ctx);
            const { authContext } = mutationContext;
            const category = await getCategoryForTenant(ctx, {
                categoryId: args.categoryId,
                tenantId: authContext.tenantId,
            });
            assertFreshCategoryRevision(category, args.expectedRevision);
            const parsed = parseCategoryInput(args);
            await assertCategoryUnique(ctx, {
                excludeCategoryId: args.categoryId,
                normalizedName: parsed.normalizedName,
                tenantId: authContext.tenantId,
            });
            const nextRevision = (0, categories_1.getComparableCategoryRevision)(category.revision) + 1;
            const now = Date.now();
            await ctx.db.patch(args.categoryId, {
                color: parsed.color,
                description: parsed.description,
                icon: parsed.icon,
                name: parsed.name,
                normalizedName: parsed.normalizedName,
                revision: nextRevision,
                updatedAt: now,
            });
            if (category.name !== parsed.name) {
                const assignedItems = await ctx.db
                    .query("procurementItems")
                    .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
                    .collect();
                for (const item of assignedItems) {
                    await ctx.db.patch(item._id, {
                        catalogSearchText: (0, items_1.buildProcurementItemCatalogSearchText)({
                            categoryName: parsed.name,
                            description: (0, items_1.normalizeProcurementItemDisplayName)(item.description ?? item.name) || item.name,
                            name: item.name,
                        }),
                        categoryNameSnapshot: parsed.name,
                    });
                }
            }
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildCategoryAuditEntry({
                action: "update",
                actorUserId: authContext.userId,
                categoryId: args.categoryId,
                event: audit_1.AUDIT_EVENT_NAMES.categoryUpdated,
                metadata: {
                    categoryColor: parsed.color ?? null,
                    categoryIcon: parsed.icon ?? null,
                    categoryName: parsed.name,
                    summary: `Updated category ${parsed.name}.`,
                },
                tenantId: authContext.tenantId,
            }));
            return {
                categoryId: args.categoryId,
                revision: nextRevision,
            };
        }
        catch (error) {
            await appendCategoryFailureAudit(ctx, {
                action: "update",
                attemptedCategoryName: normalizePlainTextValue(args.name),
                categoryId: args.categoryId,
                event: audit_1.AUDIT_EVENT_NAMES.categoryUpdated,
                authContext: mutationContext?.authContext ?? null,
                operation: "update category",
                error,
            });
            throw error;
        }
    },
});
exports.archiveCategory = (0, server_1.mutation)({
    args: {
        categoryId: categoryIdValidator,
        expectedRevision: values_1.v.number(),
    },
    handler: async (ctx, args) => {
        let mutationContext = null;
        try {
            mutationContext = await loadCategoryMutationContext(ctx);
            const { authContext, tenantUser } = mutationContext;
            const category = await getCategoryForTenant(ctx, {
                categoryId: args.categoryId,
                tenantId: authContext.tenantId,
            });
            assertFreshCategoryRevision(category, args.expectedRevision);
            const nextRevision = (0, categories_1.getComparableCategoryRevision)(category.revision) + 1;
            const now = Date.now();
            await ctx.db.patch(args.categoryId, {
                archivedAt: now,
                archivedByTenantUserId: tenantUser._id,
                isActive: false,
                revision: nextRevision,
                updatedAt: now,
            });
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildCategoryAuditEntry({
                action: "archive",
                actorUserId: authContext.userId,
                categoryId: args.categoryId,
                event: audit_1.AUDIT_EVENT_NAMES.categoryArchived,
                metadata: {
                    categoryName: category.name,
                    summary: `Archived category ${category.name}.`,
                },
                tenantId: authContext.tenantId,
            }));
            return {
                categoryId: args.categoryId,
                revision: nextRevision,
            };
        }
        catch (error) {
            await appendCategoryFailureAudit(ctx, {
                action: "archive",
                categoryId: args.categoryId,
                event: audit_1.AUDIT_EVENT_NAMES.categoryArchived,
                authContext: mutationContext?.authContext ?? null,
                operation: "archive category",
                error,
            });
            throw error;
        }
    },
});
exports.deleteCategory = (0, server_1.mutation)({
    args: {
        categoryId: categoryIdValidator,
        expectedRevision: values_1.v.number(),
    },
    handler: async (ctx, args) => {
        let mutationContext = null;
        try {
            mutationContext = await loadCategoryMutationContext(ctx);
            const { authContext } = mutationContext;
            const category = await getCategoryForTenant(ctx, {
                categoryId: args.categoryId,
                tenantId: authContext.tenantId,
            });
            assertFreshCategoryRevision(category, args.expectedRevision);
            const blockers = await loadCategoryDeletionBlockers(ctx, {
                categoryId: args.categoryId,
                tenantId: authContext.tenantId,
            });
            if (blockers.assignedItemCount > 0) {
                throw new values_1.ConvexError({
                    code: "FORBIDDEN",
                    message: categories_1.CATEGORY_DELETE_ITEMS_MESSAGE,
                });
            }
            if (blockers.hasProtectedPlans) {
                throw new values_1.ConvexError({
                    code: "FORBIDDEN",
                    message: categories_1.CATEGORY_DELETE_PLANS_MESSAGE,
                });
            }
            await ctx.db.delete(args.categoryId);
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildCategoryAuditEntry({
                action: "delete",
                actorUserId: authContext.userId,
                categoryId: args.categoryId,
                event: audit_1.AUDIT_EVENT_NAMES.categoryDeleted,
                metadata: {
                    categoryName: category.name,
                    summary: `Deleted category ${category.name}.`,
                },
                tenantId: authContext.tenantId,
            }));
            return { categoryId: args.categoryId };
        }
        catch (error) {
            await appendCategoryFailureAudit(ctx, {
                action: "delete",
                categoryId: args.categoryId,
                event: audit_1.AUDIT_EVENT_NAMES.categoryDeleted,
                authContext: mutationContext?.authContext ?? null,
                operation: "delete category",
                error,
            });
            throw error;
        }
    },
});
exports.reorderCategories = (0, server_1.mutation)({
    args: {
        expectedRevisions: values_1.v.array(reorderRevisionValidator),
        orderedCategoryIds: values_1.v.array(values_1.v.string()),
    },
    handler: async (ctx, args) => {
        let mutationContext = null;
        try {
            mutationContext = await loadCategoryMutationContext(ctx);
            const { authContext } = mutationContext;
            const activeCategories = (await ctx.db
                .query("procurementCategories")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect()).filter((category) => category.isActive);
            const uniqueOrderedIds = Array.from(new Set(args.orderedCategoryIds.filter(Boolean)));
            if (uniqueOrderedIds.length !== activeCategories.length) {
                throw new values_1.ConvexError({
                    code: "VALIDATION_FAILED",
                    message: categories_1.CATEGORY_REFRESH_REQUIRED_MESSAGE,
                });
            }
            const categoriesById = new Map(activeCategories.map((category) => [String(category._id), category]));
            const expectedRevisionById = new Map(args.expectedRevisions.map((entry) => [entry.categoryId, entry.revision]));
            for (const categoryId of uniqueOrderedIds) {
                const category = categoriesById.get(categoryId);
                if (!category) {
                    throw new values_1.ConvexError({
                        code: "VALIDATION_FAILED",
                        message: categories_1.CATEGORY_REFRESH_REQUIRED_MESSAGE,
                    });
                }
                assertFreshCategoryRevision(category, expectedRevisionById.get(categoryId) ?? -1);
            }
            const now = Date.now();
            for (let index = 0; index < uniqueOrderedIds.length; index += 1) {
                const categoryId = uniqueOrderedIds[index];
                if (!categoryId) {
                    continue;
                }
                const category = categoriesById.get(categoryId);
                if (!category) {
                    continue;
                }
                await ctx.db.patch(category._id, {
                    revision: (0, categories_1.getComparableCategoryRevision)(category.revision) + 1,
                    sortOrder: index + 1,
                    updatedAt: now,
                });
            }
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildCategoryAuditEntry({
                action: "reorder",
                actorUserId: authContext.userId,
                categoryId: null,
                event: audit_1.AUDIT_EVENT_NAMES.categoryReordered,
                metadata: {
                    orderedCategoryIds: uniqueOrderedIds,
                    summary: "Reordered active categories.",
                },
                tenantId: authContext.tenantId,
            }));
            return {
                orderedCategoryIds: uniqueOrderedIds,
            };
        }
        catch (error) {
            await appendCategoryFailureAudit(ctx, {
                action: "reorder",
                categoryId: null,
                event: audit_1.AUDIT_EVENT_NAMES.categoryReordered,
                authContext: mutationContext?.authContext ?? null,
                metadata: {
                    orderedCategoryIds: args.orderedCategoryIds,
                },
                operation: "reorder categories",
                error,
            });
            throw error;
        }
    },
});
exports.importCategories = (0, server_1.mutation)({
    args: {
        rows: values_1.v.array(values_1.v.any()),
    },
    returns: categoryImportResultValidator,
    handler: async (ctx, args) => {
        let mutationContext = null;
        try {
            mutationContext = await loadCategoryMutationContext(ctx);
            const { authContext, tenant } = mutationContext;
            const existingCategories = await ctx.db
                .query("procurementCategories")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect();
            const activeNameSet = new Set(existingCategories
                .filter((category) => category.isActive)
                .map((category) => category.normalizedName ?? (0, categories_1.normalizeCategoryName)(category.name)));
            const activeCount = existingCategories.filter((category) => category.isActive).length;
            const limit = tenant.tier === "enterprise"
                ? null
                : {
                    free: 20,
                    starter: 60,
                    professional: 200,
                }[tenant.tier];
            const failures = [];
            const seenInFile = new Set();
            let createdCount = 0;
            let nextSortOrder = Math.max(0, ...existingCategories.map((category) => category.sortOrder)) + 1;
            for (let index = 0; index < args.rows.length; index += 1) {
                const row = args.rows[index];
                const rowNumber = index + 2;
                const record = row && typeof row === "object" && !Array.isArray(row)
                    ? row
                    : {};
                const name = normalizePlainTextValue(record[categories_1.CATEGORY_IMPORT_COLUMNS[0]]);
                const description = normalizePlainTextValue(record[categories_1.CATEGORY_IMPORT_COLUMNS[1]]);
                const colorInput = normalizePlainTextValue(record[categories_1.CATEGORY_IMPORT_COLUMNS[2]]);
                const normalizedName = (0, categories_1.normalizeCategoryName)(name);
                const failureMessage = (0, categories_1.getCategoryImportRowFailure)({
                    activeCategoryCount: activeCount,
                    activeNameSet,
                    colorInput,
                    createdCount,
                    description,
                    limit,
                    name,
                    normalizedName,
                    seenInFile,
                });
                if (failureMessage) {
                    failures.push({
                        message: failureMessage,
                        rowNumber,
                    });
                    continue;
                }
                seenInFile.add(normalizedName);
                const now = Date.now();
                await ctx.db.insert("procurementCategories", {
                    archivedAt: undefined,
                    archivedByTenantUserId: undefined,
                    color: (0, categories_1.normalizeCategoryColor)(colorInput),
                    createdAt: now,
                    description: description.length > 0 ? description : undefined,
                    icon: undefined,
                    isActive: true,
                    name,
                    normalizedName,
                    revision: 1,
                    sortOrder: nextSortOrder,
                    tenantId: authContext.tenantId,
                    updatedAt: now,
                });
                nextSortOrder += 1;
                createdCount += 1;
                activeNameSet.add(normalizedName);
            }
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildCategoryAuditEntry({
                action: "import",
                actorUserId: authContext.userId,
                categoryId: null,
                event: audit_1.AUDIT_EVENT_NAMES.categoryImported,
                metadata: {
                    createdCount,
                    failureCount: failures.length,
                    summary: `Imported ${createdCount} categories with ${failures.length} row-level failures.`,
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
            await appendCategoryFailureAudit(ctx, {
                action: "import",
                categoryId: null,
                event: audit_1.AUDIT_EVENT_NAMES.categoryImported,
                authContext: mutationContext?.authContext ?? null,
                metadata: {
                    attemptedRowCount: args.rows.length,
                },
                operation: "import categories",
                error,
            });
            throw error;
        }
    },
});
async function loadCategoryMutationContext(ctx) {
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
function parseCategoryInput(args) {
    const result = category_1.categoryFormSchema.safeParse(args);
    if (!result.success) {
        const issue = result.error.issues[0] ?? {
            message: categories_1.CATEGORY_NOT_FOUND_MESSAGE,
            path: ["category"],
        };
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            field: issue.path[0] ?? "category",
            message: issue.message,
        });
    }
    return result.data;
}
async function assertCategoryUnique(ctx, args) {
    const categories = await ctx.db
        .query("procurementCategories")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .collect();
    const conflict = categories.some((category) => {
        if (!category.isActive) {
            return false;
        }
        if (args.excludeCategoryId && category._id === args.excludeCategoryId) {
            return false;
        }
        return ((category.normalizedName ?? (0, categories_1.normalizeCategoryName)(category.name)) ===
            args.normalizedName);
    });
    if (conflict) {
        throw new values_1.ConvexError({
            code: "ALREADY_EXISTS",
            field: "name",
            message: categories_1.CATEGORY_NAME_EXISTS_MESSAGE,
        });
    }
}
async function assertCategoryTierCapacity(ctx, args) {
    const activeCategoryCount = (await ctx.db
        .query("procurementCategories")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .collect()).filter((category) => category.isActive).length;
    const limits = {
        free: 20,
        professional: 200,
        starter: 60,
    };
    const limit = args.tier === "enterprise" ? null : limits[args.tier];
    if (limit !== null && activeCategoryCount >= limit) {
        throw new values_1.ConvexError({
            code: "QUOTA_EXCEEDED",
            limit,
            message: categories_1.CATEGORY_IMPORT_LIMIT_MESSAGE,
            tier: args.tier,
            upgradeHref: "/pricing",
        });
    }
}
async function getCategoryForTenant(ctx, args) {
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.tenantId !== args.tenantId) {
        throw new values_1.ConvexError({
            code: "NOT_FOUND",
            message: categories_1.CATEGORY_NOT_FOUND_MESSAGE,
        });
    }
    return category;
}
function assertFreshCategoryRevision(category, expectedRevision) {
    if ((0, categories_1.getComparableCategoryRevision)(category.revision) !== expectedRevision) {
        throw new values_1.ConvexError({
            code: "CONFLICT",
            message: categories_1.CATEGORY_REFRESH_REQUIRED_MESSAGE,
        });
    }
}
async function loadCategoryDeletionBlockers(ctx, args) {
    const [items, plans] = await Promise.all([
        ctx.db
            .query("procurementItems")
            .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
            .collect(),
        ctx.db
            .query("plans")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
            .collect(),
    ]);
    return {
        assignedItemCount: items.length,
        hasProtectedPlans: plans.some((plan) => {
            const selectedCategoryMatch = plan.selectedCategoryIds.some((categoryId) => categoryId === args.categoryId);
            const summaryMatch = plan.categorySummaries.some((summary) => summary.categoryId === args.categoryId);
            return selectedCategoryMatch || summaryMatch;
        }),
    };
}
function buildCategoryAuditEntry(args) {
    return {
        action: args.action,
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "procurement_officer",
            userId: String(args.actorUserId),
        }),
        entityType: "category",
        event: args.event,
        metadata: args.metadata,
        outcome: args.outcome ?? audit_1.AUDIT_OUTCOMES.allowed,
        recordId: args.categoryId ? String(args.categoryId) : undefined,
        sourceTenantId: String(args.tenantId),
        tableName: "procurementCategories",
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    };
}
async function appendCategoryFailureAudit(ctx, args) {
    const resolvedAuthContext = args.authContext ?? (await (0, _roleGuard_1.getAuthorizationContext)(ctx));
    const actor = resolvedAuthContext?.userId
        ? (0, audit_1.createAuthenticatedAuditActor)({
            role: resolvedAuthContext.role,
            userId: String(resolvedAuthContext.userId),
        })
        : (0, audit_1.createAnonymousAuditActor)();
    const resolvedTenantId = resolvedAuthContext?.tenantId;
    await (0, _audit_1.appendAuditLogBestEffort)(ctx, {
        action: args.action,
        actor,
        entityType: "category",
        event: args.event,
        metadata: {
            ...args.metadata,
            attemptedCategoryName: args.attemptedCategoryName,
            failureReason: getCategoryFailureReason(args.error),
            summary: `Failed to ${args.operation}.`,
        },
        outcome: audit_1.AUDIT_OUTCOMES.failed,
        recordId: args.categoryId ? String(args.categoryId) : undefined,
        sourceTenantId: resolvedTenantId ? String(resolvedTenantId) : undefined,
        tableName: "procurementCategories",
        targetTenantId: resolvedTenantId ? String(resolvedTenantId) : undefined,
        timestamp: Date.now(),
    });
}
function getCategoryFailureReason(error) {
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
    return "Unexpected category operation failure.";
}
function normalizePlainTextValue(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}
