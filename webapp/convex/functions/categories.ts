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
  type AuditOutcome,
  createAnonymousAuditActor,
  createAuthenticatedAuditActor,
} from "../../lib/security/audit";
import {
  buildCategoryWorkspaceSummary,
  CATEGORY_DELETE_ITEMS_MESSAGE,
  CATEGORY_DELETE_PLANS_MESSAGE,
  CATEGORY_IMPORT_COLUMNS,
  CATEGORY_IMPORT_LIMIT_MESSAGE,
  CATEGORY_NAME_EXISTS_MESSAGE,
  CATEGORY_NOT_FOUND_MESSAGE,
  CATEGORY_REFRESH_REQUIRED_MESSAGE,
  getCategoryImportRowFailure,
  getComparableCategoryRevision,
  normalizeCategoryColor,
  normalizeCategoryName,
  type CategoryIconName,
  type CategoryPlanStatus,
} from "../../lib/procurement-officer/categories";
import {
  buildProcurementItemCatalogSearchText,
  normalizeProcurementItemDisplayName,
} from "../../lib/procurement-officer/items";
import { categoryFormSchema } from "../../lib/validators/category";
import { appendAuditLogBestEffort, appendAuditLogRequired } from "./_audit";
import { getAuthorizationContext, requireTenantRole } from "./_roleGuard";
import { getCurrentTenantUserMembership } from "./_tenantGuard";

type CategoryMutationCtx = MutationCtx;
type CategoryQueryCtx = QueryCtx;
type CategoryRecord = Doc<"procurementCategories">;

const categoryIdValidator = v.id("procurementCategories");

const reorderRevisionValidator = v.object({
  categoryId: v.string(),
  revision: v.number(),
});

const categoryImportResultValidator = v.object({
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

export const getCategoriesWorkspace = query({
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

    const activeItemCountByCategoryId = new Map<string, number>();
    const assignedItemCountByCategoryId = new Map<string, number>();
    for (const item of items) {
      assignedItemCountByCategoryId.set(
        String(item.categoryId),
        (assignedItemCountByCategoryId.get(String(item.categoryId)) ?? 0) + 1,
      );
      if (!item.isActive) {
        continue;
      }

      activeItemCountByCategoryId.set(
        String(item.categoryId),
        (activeItemCountByCategoryId.get(String(item.categoryId)) ?? 0) + 1,
      );
    }

    const planStatusesByCategoryId = new Map<string, Set<CategoryPlanStatus>>();
    for (const plan of plans) {
      const referencedCategoryIds = new Set<string>([
        ...plan.selectedCategoryIds.map((categoryId) => String(categoryId)),
        ...plan.categorySummaries.map((summary) => String(summary.categoryId)),
      ]);

      for (const categoryId of Array.from(referencedCategoryIds)) {
        const existing =
          planStatusesByCategoryId.get(categoryId) ??
          new Set<CategoryPlanStatus>();
        existing.add(plan.status as CategoryPlanStatus);
        planStatusesByCategoryId.set(categoryId, existing);
      }
    }

    const summary = buildCategoryWorkspaceSummary({
      categories: categories.map((category) => ({
        assignedItemCount:
          assignedItemCountByCategoryId.get(String(category._id)) ?? 0,
        archivedAt: category.archivedAt ?? null,
        color: category.color ?? null,
        description: category.description ?? null,
        icon: (category.icon as CategoryIconName | undefined) ?? null,
        id: String(category._id),
        isActive: category.isActive,
        itemCount: activeItemCountByCategoryId.get(String(category._id)) ?? 0,
        name: category.name,
        planStatuses: Array.from(
          planStatusesByCategoryId.get(String(category._id)) ??
            new Set<CategoryPlanStatus>(),
        ),
        revision: getComparableCategoryRevision(category.revision),
        sortOrder: category.sortOrder,
      })),
      tier: tenant.tier,
    });

    return {
      meta: {
        activeCategoryCount: summary.rows.filter((row) => row.isActive).length,
        limit: summary.limit,
        nextSortOrder:
          Math.max(0, ...summary.rows.map((row) => row.sortOrder)) + 1,
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

export const createCategory = mutation({
  args: {
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    let mutationContext: Awaited<
      ReturnType<typeof loadCategoryMutationContext>
    > | null = null;
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
      const nextSortOrder =
        Math.max(
          0,
          ...existingCategories.map((category) => category.sortOrder),
        ) + 1;
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

      await appendAuditLogRequired(
        ctx,
        buildCategoryAuditEntry({
          action: "create",
          actorUserId: authContext.userId,
          categoryId,
          event: AUDIT_EVENT_NAMES.categoryCreated,
          metadata: {
            categoryColor: parsed.color ?? null,
            categoryIcon: parsed.icon ?? null,
            categoryName: parsed.name,
            summary: `Created category ${parsed.name}.`,
          },
          tenantId: authContext.tenantId,
        }),
      );

      return { categoryId, revision: 1, tenantUserId: tenantUser._id };
    } catch (error) {
      await appendCategoryFailureAudit(ctx, {
        action: "create",
        attemptedCategoryName: normalizePlainTextValue(args.name),
        categoryId: null,
        event: AUDIT_EVENT_NAMES.categoryCreated,
        authContext: mutationContext?.authContext ?? null,
        operation: "create category",
        error,
      });
      throw error;
    }
  },
});

export const updateCategory = mutation({
  args: {
    categoryId: categoryIdValidator,
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    expectedRevision: v.number(),
    icon: v.optional(v.string()),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    let mutationContext: Awaited<
      ReturnType<typeof loadCategoryMutationContext>
    > | null = null;
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

      const nextRevision = getComparableCategoryRevision(category.revision) + 1;
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
          .withIndex("by_categoryId", (q) =>
            q.eq("categoryId", args.categoryId),
          )
          .collect();

        for (const item of assignedItems) {
          await ctx.db.patch(item._id, {
            catalogSearchText: buildProcurementItemCatalogSearchText({
              categoryName: parsed.name,
              description:
                normalizeProcurementItemDisplayName(
                  item.description ?? item.name,
                ) || item.name,
              name: item.name,
            }),
            categoryNameSnapshot: parsed.name,
          });
        }
      }

      await appendAuditLogRequired(
        ctx,
        buildCategoryAuditEntry({
          action: "update",
          actorUserId: authContext.userId,
          categoryId: args.categoryId,
          event: AUDIT_EVENT_NAMES.categoryUpdated,
          metadata: {
            categoryColor: parsed.color ?? null,
            categoryIcon: parsed.icon ?? null,
            categoryName: parsed.name,
            summary: `Updated category ${parsed.name}.`,
          },
          tenantId: authContext.tenantId,
        }),
      );

      return {
        categoryId: args.categoryId,
        revision: nextRevision,
      };
    } catch (error) {
      await appendCategoryFailureAudit(ctx, {
        action: "update",
        attemptedCategoryName: normalizePlainTextValue(args.name),
        categoryId: args.categoryId,
        event: AUDIT_EVENT_NAMES.categoryUpdated,
        authContext: mutationContext?.authContext ?? null,
        operation: "update category",
        error,
      });
      throw error;
    }
  },
});

export const archiveCategory = mutation({
  args: {
    categoryId: categoryIdValidator,
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    let mutationContext: Awaited<
      ReturnType<typeof loadCategoryMutationContext>
    > | null = null;
    try {
      mutationContext = await loadCategoryMutationContext(ctx);
      const { authContext, tenantUser } = mutationContext;
      const category = await getCategoryForTenant(ctx, {
        categoryId: args.categoryId,
        tenantId: authContext.tenantId,
      });
      assertFreshCategoryRevision(category, args.expectedRevision);

      const nextRevision = getComparableCategoryRevision(category.revision) + 1;
      const now = Date.now();
      await ctx.db.patch(args.categoryId, {
        archivedAt: now,
        archivedByTenantUserId: tenantUser._id,
        isActive: false,
        revision: nextRevision,
        updatedAt: now,
      });

      await appendAuditLogRequired(
        ctx,
        buildCategoryAuditEntry({
          action: "archive",
          actorUserId: authContext.userId,
          categoryId: args.categoryId,
          event: AUDIT_EVENT_NAMES.categoryArchived,
          metadata: {
            categoryName: category.name,
            summary: `Archived category ${category.name}.`,
          },
          tenantId: authContext.tenantId,
        }),
      );

      return {
        categoryId: args.categoryId,
        revision: nextRevision,
      };
    } catch (error) {
      await appendCategoryFailureAudit(ctx, {
        action: "archive",
        categoryId: args.categoryId,
        event: AUDIT_EVENT_NAMES.categoryArchived,
        authContext: mutationContext?.authContext ?? null,
        operation: "archive category",
        error,
      });
      throw error;
    }
  },
});

export const deleteCategory = mutation({
  args: {
    categoryId: categoryIdValidator,
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    let mutationContext: Awaited<
      ReturnType<typeof loadCategoryMutationContext>
    > | null = null;
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
        throw new ConvexError({
          code: "FORBIDDEN",
          message: CATEGORY_DELETE_ITEMS_MESSAGE,
        });
      }

      if (blockers.hasProtectedPlans) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: CATEGORY_DELETE_PLANS_MESSAGE,
        });
      }

      await ctx.db.delete(args.categoryId);

      await appendAuditLogRequired(
        ctx,
        buildCategoryAuditEntry({
          action: "delete",
          actorUserId: authContext.userId,
          categoryId: args.categoryId,
          event: AUDIT_EVENT_NAMES.categoryDeleted,
          metadata: {
            categoryName: category.name,
            summary: `Deleted category ${category.name}.`,
          },
          tenantId: authContext.tenantId,
        }),
      );

      return { categoryId: args.categoryId };
    } catch (error) {
      await appendCategoryFailureAudit(ctx, {
        action: "delete",
        categoryId: args.categoryId,
        event: AUDIT_EVENT_NAMES.categoryDeleted,
        authContext: mutationContext?.authContext ?? null,
        operation: "delete category",
        error,
      });
      throw error;
    }
  },
});

export const reorderCategories = mutation({
  args: {
    expectedRevisions: v.array(reorderRevisionValidator),
    orderedCategoryIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    let mutationContext: Awaited<
      ReturnType<typeof loadCategoryMutationContext>
    > | null = null;
    try {
      mutationContext = await loadCategoryMutationContext(ctx);
      const { authContext } = mutationContext;
      const activeCategories = (
        await ctx.db
          .query("procurementCategories")
          .withIndex("by_tenantId", (q) =>
            q.eq("tenantId", authContext.tenantId),
          )
          .collect()
      ).filter((category) => category.isActive);
      const uniqueOrderedIds = Array.from(
        new Set(args.orderedCategoryIds.filter(Boolean)),
      );

      if (uniqueOrderedIds.length !== activeCategories.length) {
        throw new ConvexError({
          code: "VALIDATION_FAILED",
          message: CATEGORY_REFRESH_REQUIRED_MESSAGE,
        });
      }

      const categoriesById = new Map(
        activeCategories.map(
          (category) => [String(category._id), category] as const,
        ),
      );
      const expectedRevisionById = new Map(
        args.expectedRevisions.map(
          (entry) => [entry.categoryId, entry.revision] as const,
        ),
      );

      for (const categoryId of uniqueOrderedIds) {
        const category = categoriesById.get(categoryId);
        if (!category) {
          throw new ConvexError({
            code: "VALIDATION_FAILED",
            message: CATEGORY_REFRESH_REQUIRED_MESSAGE,
          });
        }

        assertFreshCategoryRevision(
          category,
          expectedRevisionById.get(categoryId) ?? -1,
        );
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
          revision: getComparableCategoryRevision(category.revision) + 1,
          sortOrder: index + 1,
          updatedAt: now,
        });
      }

      await appendAuditLogRequired(
        ctx,
        buildCategoryAuditEntry({
          action: "reorder",
          actorUserId: authContext.userId,
          categoryId: null,
          event: AUDIT_EVENT_NAMES.categoryReordered,
          metadata: {
            orderedCategoryIds: uniqueOrderedIds,
            summary: "Reordered active categories.",
          },
          tenantId: authContext.tenantId,
        }),
      );

      return {
        orderedCategoryIds: uniqueOrderedIds,
      };
    } catch (error) {
      await appendCategoryFailureAudit(ctx, {
        action: "reorder",
        categoryId: null,
        event: AUDIT_EVENT_NAMES.categoryReordered,
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

export const importCategories = mutation({
  args: {
    rows: v.array(v.any()),
  },
  returns: categoryImportResultValidator,
  handler: async (ctx, args) => {
    let mutationContext: Awaited<
      ReturnType<typeof loadCategoryMutationContext>
    > | null = null;
    try {
      mutationContext = await loadCategoryMutationContext(ctx);
      const { authContext, tenant } = mutationContext;
      const existingCategories = await ctx.db
        .query("procurementCategories")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
        .collect();
      const activeNameSet = new Set(
        existingCategories
          .filter((category) => category.isActive)
          .map(
            (category) =>
              category.normalizedName ?? normalizeCategoryName(category.name),
          ),
      );
      const activeCount = existingCategories.filter(
        (category) => category.isActive,
      ).length;
      const limit =
        tenant.tier === "enterprise"
          ? null
          : {
              free: 20,
              starter: 60,
              professional: 200,
            }[tenant.tier];
      const failures: Array<{ message: string; rowNumber: number }> = [];
      const seenInFile = new Set<string>();
      let createdCount = 0;
      let nextSortOrder =
        Math.max(
          0,
          ...existingCategories.map((category) => category.sortOrder),
        ) + 1;

      for (let index = 0; index < args.rows.length; index += 1) {
        const row = args.rows[index];
        const rowNumber = index + 2;
        const record =
          row && typeof row === "object" && !Array.isArray(row)
            ? (row as Record<string, unknown>)
            : {};
        const name = normalizePlainTextValue(
          record[CATEGORY_IMPORT_COLUMNS[0]],
        );
        const description = normalizePlainTextValue(
          record[CATEGORY_IMPORT_COLUMNS[1]],
        );
        const colorInput = normalizePlainTextValue(
          record[CATEGORY_IMPORT_COLUMNS[2]],
        );
        const normalizedName = normalizeCategoryName(name);
        const failureMessage = getCategoryImportRowFailure({
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
          color: normalizeCategoryColor(colorInput),
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

      await appendAuditLogRequired(
        ctx,
        buildCategoryAuditEntry({
          action: "import",
          actorUserId: authContext.userId,
          categoryId: null,
          event: AUDIT_EVENT_NAMES.categoryImported,
          metadata: {
            createdCount,
            failureCount: failures.length,
            summary: `Imported ${createdCount} categories with ${failures.length} row-level failures.`,
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
      await appendCategoryFailureAudit(ctx, {
        action: "import",
        categoryId: null,
        event: AUDIT_EVENT_NAMES.categoryImported,
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

async function loadCategoryMutationContext(ctx: CategoryMutationCtx) {
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

function parseCategoryInput(args: {
  color?: string;
  description?: string;
  icon?: string;
  name: string;
}) {
  const result = categoryFormSchema.safeParse(args);
  if (!result.success) {
    const issue = result.error.issues[0] ?? {
      message: CATEGORY_NOT_FOUND_MESSAGE,
      path: ["category"],
    };
    throw new ConvexError({
      code: "VALIDATION_FAILED",
      field: issue.path[0] ?? "category",
      message: issue.message,
    });
  }

  return result.data;
}

async function assertCategoryUnique(
  ctx: CategoryMutationCtx,
  args: {
    excludeCategoryId?: Id<"procurementCategories">;
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

    if (args.excludeCategoryId && category._id === args.excludeCategoryId) {
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
      field: "name",
      message: CATEGORY_NAME_EXISTS_MESSAGE,
    });
  }
}

async function assertCategoryTierCapacity(
  ctx: CategoryMutationCtx,
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
      message: CATEGORY_IMPORT_LIMIT_MESSAGE,
      tier: args.tier,
      upgradeHref: "/pricing",
    });
  }
}

async function getCategoryForTenant(
  ctx: CategoryMutationCtx | CategoryQueryCtx,
  args: {
    categoryId: Id<"procurementCategories">;
    tenantId: Id<"tenants">;
  },
) {
  const category = await ctx.db.get(args.categoryId);

  if (!category || category.tenantId !== args.tenantId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: CATEGORY_NOT_FOUND_MESSAGE,
    });
  }

  return category;
}

function assertFreshCategoryRevision(
  category: Pick<CategoryRecord, "revision">,
  expectedRevision: number,
) {
  if (getComparableCategoryRevision(category.revision) !== expectedRevision) {
    throw new ConvexError({
      code: "CONFLICT",
      message: CATEGORY_REFRESH_REQUIRED_MESSAGE,
    });
  }
}

async function loadCategoryDeletionBlockers(
  ctx: CategoryMutationCtx,
  args: {
    categoryId: Id<"procurementCategories">;
    tenantId: Id<"tenants">;
  },
) {
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
      const selectedCategoryMatch = plan.selectedCategoryIds.some(
        (categoryId) => categoryId === args.categoryId,
      );
      const summaryMatch = plan.categorySummaries.some(
        (summary) => summary.categoryId === args.categoryId,
      );

      return selectedCategoryMatch || summaryMatch;
    }),
  };
}

function buildCategoryAuditEntry(args: {
  action: string;
  actorUserId: Id<"users">;
  categoryId: Id<"procurementCategories"> | null;
  event: string;
  metadata: Record<string, unknown>;
  outcome?: AuditOutcome;
  tenantId: Id<"tenants">;
}) {
  return {
    action: args.action,
    actor: createAuthenticatedAuditActor({
      role: "procurement_officer",
      userId: String(args.actorUserId),
    }),
    entityType: "category",
    event: args.event as AuditEventName,
    metadata: args.metadata,
    outcome: args.outcome ?? AUDIT_OUTCOMES.allowed,
    recordId: args.categoryId ? String(args.categoryId) : undefined,
    sourceTenantId: String(args.tenantId),
    tableName: "procurementCategories",
    targetTenantId: String(args.tenantId),
    timestamp: Date.now(),
  };
}

async function appendCategoryFailureAudit(
  ctx: CategoryMutationCtx,
  args: {
    action: string;
    authContext?: Awaited<ReturnType<typeof getAuthorizationContext>> | null;
    attemptedCategoryName?: string;
    categoryId: Id<"procurementCategories"> | null;
    error: unknown;
    event: string;
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
    action: args.action,
    actor,
    entityType: "category",
    event: args.event as AuditEventName,
    metadata: {
      ...args.metadata,
      attemptedCategoryName: args.attemptedCategoryName,
      failureReason: getCategoryFailureReason(args.error),
      summary: `Failed to ${args.operation}.`,
    },
    outcome: AUDIT_OUTCOMES.failed,
    recordId: args.categoryId ? String(args.categoryId) : undefined,
    sourceTenantId: resolvedTenantId ? String(resolvedTenantId) : undefined,
    tableName: "procurementCategories",
    targetTenantId: resolvedTenantId ? String(resolvedTenantId) : undefined,
    timestamp: Date.now(),
  });
}

function getCategoryFailureReason(error: unknown): string {
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

  return "Unexpected category operation failure.";
}

function normalizePlainTextValue(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}
