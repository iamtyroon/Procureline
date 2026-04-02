"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveDepartmentUserWorkspaceDraft = exports.getDepartmentUserPlanWorkspace = exports.ensureDepartmentUserDraftPlan = exports.getDepartmentUserNewPlanWorkspaceContext = exports.buildPersistedDepartmentUserWorkspaceState = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const blockly_serialization_1 = require("../../lib/blockly/blockly-serialization");
const du_plan_routes_1 = require("../../lib/blockly/du-plan-routes");
const du_toolbox_1 = require("../../lib/blockly/du-toolbox");
const _roleGuard_1 = require("./_roleGuard");
const departmentUserWorkspaceStateValidator = values_1.v.union(values_1.v.literal("blocked"), values_1.v.literal("not_found"), values_1.v.literal("ready"), values_1.v.literal("redirect"));
const workspaceRecordValidator = values_1.v.object({
    editorMetadata: values_1.v.object({
        lastSavedAt: values_1.v.number(),
        lastSavedByUserId: values_1.v.string(),
        recoveredAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        revision: values_1.v.number(),
        saveSource: values_1.v.union(values_1.v.literal("workspace_seed"), values_1.v.literal("workspace_sync")),
    }),
    format: values_1.v.literal("blockly_json"),
    schemaVersion: values_1.v.number(),
    workspaceJson: values_1.v.any(),
});
const workspaceCategorySummaryValidator = values_1.v.object({
    amount: values_1.v.number(),
    categoryId: values_1.v.string(),
    categoryName: values_1.v.string(),
    itemCount: values_1.v.number(),
});
const workspaceItemValidator = values_1.v.object({
    categoryId: values_1.v.string(),
    description: values_1.v.union(values_1.v.string(), values_1.v.null()),
    id: values_1.v.string(),
    isActive: values_1.v.boolean(),
    name: values_1.v.string(),
    procurementMethod: values_1.v.union(values_1.v.string(), values_1.v.null()),
    sortOrder: values_1.v.number(),
    sourceOfFunds: values_1.v.union(values_1.v.string(), values_1.v.null()),
    unitOfMeasurement: values_1.v.union(values_1.v.string(), values_1.v.null()),
    unitPrice: values_1.v.union(values_1.v.number(), values_1.v.null()),
});
const workspaceCategoryValidator = values_1.v.object({
    id: values_1.v.string(),
    isActive: values_1.v.boolean(),
    name: values_1.v.string(),
    sortOrder: values_1.v.number(),
});
const workspaceDepartmentValidator = values_1.v.object({
    budgetAllocation: values_1.v.union(values_1.v.number(), values_1.v.null()),
    code: values_1.v.string(),
    id: values_1.v.string(),
    name: values_1.v.string(),
    voteNumber: values_1.v.string(),
});
const planWorkspaceContextValidator = values_1.v.object({
    catalog: values_1.v.object({
        categories: values_1.v.array(workspaceCategoryValidator),
        items: values_1.v.array(workspaceItemValidator),
    }),
    department: workspaceDepartmentValidator,
    meta: values_1.v.object({
        accessMode: values_1.v.union(values_1.v.literal("editable"), values_1.v.literal("read_only_grace"), values_1.v.null()),
        actor: values_1.v.union(values_1.v.literal("department_user"), values_1.v.literal("procurement_officer")),
        actorLabel: values_1.v.string(),
        availableToolbarActions: values_1.v.array(values_1.v.string()),
        currentUserId: values_1.v.string(),
        fiscalYear: values_1.v.string(),
        mode: values_1.v.union(values_1.v.literal("edit"), values_1.v.literal("view")),
        modeIndicatorLabel: values_1.v.union(values_1.v.string(), values_1.v.null()),
        selectedCategoryIds: values_1.v.array(values_1.v.string()),
        state: departmentUserWorkspaceStateValidator,
        subtitle: values_1.v.string(),
        title: values_1.v.string(),
        unavailableCategories: values_1.v.array(values_1.v.object({
            id: values_1.v.string(),
            name: values_1.v.string(),
            reason: values_1.v.string(),
        })),
    }),
    plan: values_1.v.union(values_1.v.object({
        categorySummaries: values_1.v.array(workspaceCategorySummaryValidator),
        estimatedBudgetUsed: values_1.v.number(),
        id: values_1.v.string(),
        itemCount: values_1.v.number(),
        selectedCategoryIds: values_1.v.array(values_1.v.string()),
        status: values_1.v.union(values_1.v.literal("approved"), values_1.v.literal("draft"), values_1.v.literal("rejected"), values_1.v.literal("submitted")),
        workspaceState: workspaceRecordValidator,
    }), values_1.v.null()),
    redirectHref: values_1.v.union(values_1.v.string(), values_1.v.null()),
    statusMessage: values_1.v.union(values_1.v.string(), values_1.v.null()),
});
const createPlanResultValidator = values_1.v.object({
    planId: values_1.v.string(),
    redirectedToExistingPlan: values_1.v.boolean(),
});
function unexpectedAccessError() {
    throw new values_1.ConvexError({
        code: "UNAUTHORIZED",
        message: "Department User plan access is unavailable.",
    });
}
function mapDepartmentDepartmentRecord(department) {
    return {
        budgetAllocation: department.budgetAllocation ?? null,
        code: department.code,
        id: String(department._id),
        name: department.name,
        voteNumber: department.code,
    };
}
function buildPersistedDepartmentUserWorkspaceState(args) {
    const normalizedWorkspaceState = (0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(args.workspaceState, {
        lastSavedAt: args.savedAt,
        lastSavedByUserId: args.currentUserId,
        saveSource: "workspace_sync",
    });
    return {
        ...normalizedWorkspaceState,
        editorMetadata: {
            ...normalizedWorkspaceState.editorMetadata,
            lastSavedAt: args.savedAt,
            lastSavedByUserId: args.currentUserId,
            saveSource: "workspace_sync",
        },
    };
}
exports.buildPersistedDepartmentUserWorkspaceState = buildPersistedDepartmentUserWorkspaceState;
async function loadDepartmentUserPlanBase(ctx) {
    const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["department_user"]);
    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) => q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId))
        .first();
    if (!tenantUser || tenantUser.role !== "department_user" || !tenantUser.isActive) {
        unexpectedAccessError();
    }
    const profile = await ctx.db
        .query("departmentUserProfiles")
        .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", tenantUser._id))
        .first();
    if (!profile || !profile.isActive) {
        return {
            authContext,
            blockedReason: "Department setup is incomplete. Contact your Procurement Officer to finish linking your account.",
            department: null,
        };
    }
    const department = await ctx.db.get(profile.departmentId);
    if (!department || department.tenantId !== authContext.tenantId || !department.isActive) {
        return {
            authContext,
            blockedReason: "Department setup is incomplete. Contact your Procurement Officer to finish linking your account.",
            department: null,
        };
    }
    return {
        authContext,
        blockedReason: null,
        department,
    };
}
async function loadTenantCatalog(ctx, tenantId) {
    const [categories, items] = await Promise.all([
        ctx.db
            .query("procurementCategories")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", tenantId))
            .collect(),
        ctx.db
            .query("procurementItems")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", tenantId))
            .collect(),
    ]);
    return {
        categories: categories.map((category) => ({
            id: String(category._id),
            isActive: category.isActive,
            name: category.name,
            sortOrder: category.sortOrder,
        })),
        items: items.map((item) => ({
            categoryId: String(item.categoryId),
            description: item.description ?? null,
            id: String(item._id),
            isActive: item.isActive,
            name: item.name,
            procurementMethod: item.procurementMethod ?? null,
            sortOrder: item.sortOrder ?? Number.MAX_SAFE_INTEGER,
            sourceOfFunds: item.sourceOfFunds ?? null,
            unitOfMeasurement: item.unitOfMeasurement ?? null,
            unitPrice: item.unitPrice ?? null,
        })),
    };
}
async function loadCanonicalDepartmentPlans(ctx, departmentId) {
    const plans = await ctx.db
        .query("plans")
        .withIndex("by_departmentId", (q) => q.eq("departmentId", departmentId))
        .collect();
    return plans.sort((left, right) => right.updatedAt - left.updatedAt);
}
function createBlockedContext(args) {
    return {
        catalog: {
            categories: [],
            items: [],
        },
        department: {
            budgetAllocation: null,
            code: "--",
            id: "",
            name: "Planning unavailable",
            voteNumber: "--",
        },
        meta: {
            accessMode: args.accessMode ?? null,
            actor: "department_user",
            actorLabel: "Department User",
            availableToolbarActions: ["exit"],
            currentUserId: args.currentUserId,
            fiscalYear: args.fiscalYear,
            mode: "view",
            modeIndicatorLabel: null,
            selectedCategoryIds: [],
            state: "blocked",
            subtitle: args.message,
            title: "Planning workspace unavailable",
            unavailableCategories: [],
        },
        plan: null,
        redirectHref: null,
        statusMessage: args.message,
    };
}
exports.getDepartmentUserNewPlanWorkspaceContext = (0, server_1.query)({
    args: {
        categoryIds: values_1.v.array(values_1.v.string()),
        fiscalYear: values_1.v.string(),
    },
    returns: planWorkspaceContextValidator,
    handler: async (ctx, args) => {
        const base = await loadDepartmentUserPlanBase(ctx);
        if (!base.department) {
            return createBlockedContext({
                accessMode: base.authContext.departmentAccessMode ?? null,
                currentUserId: String(base.authContext.userId),
                fiscalYear: args.fiscalYear,
                message: base.blockedReason ?? "Planning workspace unavailable.",
            });
        }
        const catalog = await loadTenantCatalog(ctx, base.authContext.tenantId);
        const sanitizedSelection = (0, du_toolbox_1.sanitizeDepartmentUserWorkspaceCategorySelection)({
            categories: catalog.categories,
            items: catalog.items,
            requestedCategoryIds: args.categoryIds,
        });
        if (sanitizedSelection.sanitizedCategoryIds.length === 0) {
            return {
                ...createBlockedContext({
                    accessMode: base.authContext.departmentAccessMode ?? null,
                    currentUserId: String(base.authContext.userId),
                    fiscalYear: args.fiscalYear,
                    message: "None of the selected categories are currently available for planning. Return to the dashboard launchpad and choose active categories.",
                }),
                department: mapDepartmentDepartmentRecord(base.department),
                meta: {
                    ...createBlockedContext({
                        accessMode: base.authContext.departmentAccessMode ?? null,
                        currentUserId: String(base.authContext.userId),
                        fiscalYear: args.fiscalYear,
                        message: "None of the selected categories are currently available for planning. Return to the dashboard launchpad and choose active categories.",
                    }).meta,
                    unavailableCategories: sanitizedSelection.unavailableCategories,
                },
            };
        }
        const canonicalPlans = await loadCanonicalDepartmentPlans(ctx, base.department._id);
        const existingPlan = canonicalPlans.find((plan) => plan.fiscalYear === args.fiscalYear);
        if (existingPlan) {
            const workspaceMode = (0, du_plan_routes_1.resolveDepartmentUserWorkspaceMode)({
                accessMode: base.authContext.departmentAccessMode,
                requestedMode: existingPlan.status === "draft" || existingPlan.status === "rejected"
                    ? "edit"
                    : "view",
                status: existingPlan.status,
            });
            return {
                catalog,
                department: mapDepartmentDepartmentRecord(base.department),
                meta: {
                    accessMode: base.authContext.departmentAccessMode ?? null,
                    actor: "department_user",
                    actorLabel: "Department User",
                    availableToolbarActions: ["exit", "request_item", "export", "submit"],
                    currentUserId: String(base.authContext.userId),
                    fiscalYear: args.fiscalYear,
                    mode: workspaceMode,
                    modeIndicatorLabel: null,
                    selectedCategoryIds: existingPlan.selectedCategoryIds.map((categoryId) => String(categoryId)),
                    state: "redirect",
                    subtitle: "A current fiscal-year plan already exists. Opening the canonical workspace instead.",
                    title: "Redirecting to your existing plan",
                    unavailableCategories: sanitizedSelection.unavailableCategories,
                },
                plan: null,
                redirectHref: `/du/plans/${String(existingPlan._id)}?mode=${workspaceMode}`,
                statusMessage: "A current fiscal-year plan already exists for this department.",
            };
        }
        return {
            catalog,
            department: mapDepartmentDepartmentRecord(base.department),
            meta: {
                accessMode: base.authContext.departmentAccessMode ?? null,
                actor: "department_user",
                actorLabel: "Department User",
                availableToolbarActions: ["exit", "request_item", "export", "submit"],
                currentUserId: String(base.authContext.userId),
                fiscalYear: args.fiscalYear,
                mode: "edit",
                modeIndicatorLabel: null,
                selectedCategoryIds: sanitizedSelection.sanitizedCategoryIds,
                state: "ready",
                subtitle: "Preparing the Blockly workspace for your selected categories.",
                title: `${base.department.name} procurement plan`,
                unavailableCategories: sanitizedSelection.unavailableCategories,
            },
            plan: null,
            redirectHref: null,
            statusMessage: null,
        };
    },
});
exports.ensureDepartmentUserDraftPlan = (0, server_1.mutation)({
    args: {
        categoryIds: values_1.v.array(values_1.v.string()),
        fiscalYear: values_1.v.string(),
    },
    returns: createPlanResultValidator,
    handler: async (ctx, args) => {
        const base = await loadDepartmentUserPlanBase(ctx);
        if (!base.department) {
            unexpectedAccessError();
        }
        const catalog = await loadTenantCatalog(ctx, base.authContext.tenantId);
        const categoryDocs = await ctx.db
            .query("procurementCategories")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", base.authContext.tenantId))
            .collect();
        const sanitizedSelection = (0, du_toolbox_1.sanitizeDepartmentUserWorkspaceCategorySelection)({
            categories: catalog.categories,
            items: catalog.items,
            requestedCategoryIds: args.categoryIds,
        });
        if (sanitizedSelection.sanitizedCategoryIds.length === 0) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "No active categories were provided for this planning workspace.",
            });
        }
        const plans = await loadCanonicalDepartmentPlans(ctx, base.department._id);
        const existingPlan = plans.find((plan) => plan.fiscalYear === args.fiscalYear);
        if (existingPlan) {
            return {
                planId: String(existingPlan._id),
                redirectedToExistingPlan: true,
            };
        }
        const categoryDocIdsByString = new Map(categoryDocs.map((category) => [String(category._id), category._id]));
        const selectedCategoryIds = sanitizedSelection.sanitizedCategoryIds
            .map((categoryId) => {
            return categoryDocIdsByString.get(categoryId) ?? null;
        })
            .filter((value) => value !== null);
        const now = Date.now();
        const planId = await ctx.db.insert("plans", {
            tenantId: base.authContext.tenantId,
            departmentId: base.department._id,
            fiscalYear: args.fiscalYear,
            status: "draft",
            itemCount: 0,
            estimatedBudgetUsed: 0,
            selectedCategoryIds,
            categorySummaries: [],
            workspaceState: (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
                lastSavedAt: now,
                lastSavedByUserId: String(base.authContext.userId),
                saveSource: "workspace_seed",
            }),
            createdAt: now,
            updatedAt: now,
        });
        return {
            planId: String(planId),
            redirectedToExistingPlan: false,
        };
    },
});
exports.getDepartmentUserPlanWorkspace = (0, server_1.query)({
    args: {
        planId: values_1.v.string(),
        requestedMode: values_1.v.optional(values_1.v.union(values_1.v.literal("edit"), values_1.v.literal("view"))),
    },
    returns: planWorkspaceContextValidator,
    handler: async (ctx, args) => {
        const base = await loadDepartmentUserPlanBase(ctx);
        if (!base.department) {
            return createBlockedContext({
                accessMode: base.authContext.departmentAccessMode ?? null,
                currentUserId: String(base.authContext.userId),
                fiscalYear: "Unknown",
                message: base.blockedReason ?? "Planning workspace unavailable.",
            });
        }
        const [catalog, plans] = await Promise.all([
            loadTenantCatalog(ctx, base.authContext.tenantId),
            loadCanonicalDepartmentPlans(ctx, base.department._id),
        ]);
        const plan = plans.find((candidate) => String(candidate._id) === args.planId);
        if (!plan) {
            return {
                catalog,
                department: mapDepartmentDepartmentRecord(base.department),
                meta: {
                    accessMode: base.authContext.departmentAccessMode ?? null,
                    actor: "department_user",
                    actorLabel: "Department User",
                    availableToolbarActions: ["exit"],
                    currentUserId: String(base.authContext.userId),
                    fiscalYear: "Unknown",
                    mode: "view",
                    modeIndicatorLabel: null,
                    selectedCategoryIds: [],
                    state: "not_found",
                    subtitle: "This plan could not be opened. It may have been removed, belong to a different department, or fall outside supported planning states.",
                    title: "Plan not found",
                    unavailableCategories: [],
                },
                plan: null,
                redirectHref: null,
                statusMessage: "The requested plan could not be found for this department.",
            };
        }
        const sanitizedSelection = (0, du_toolbox_1.sanitizeDepartmentUserWorkspaceCategorySelection)({
            categories: catalog.categories,
            items: catalog.items,
            requestedCategoryIds: plan.selectedCategoryIds.map((categoryId) => String(categoryId)),
        });
        const mode = (0, du_plan_routes_1.resolveDepartmentUserWorkspaceMode)({
            accessMode: base.authContext.departmentAccessMode,
            requestedMode: args.requestedMode ?? null,
            status: plan.status,
        });
        return {
            catalog,
            department: mapDepartmentDepartmentRecord(base.department),
            meta: {
                accessMode: base.authContext.departmentAccessMode ?? null,
                actor: "department_user",
                actorLabel: "Department User",
                availableToolbarActions: ["exit", "request_item", "export", "submit"],
                currentUserId: String(base.authContext.userId),
                fiscalYear: plan.fiscalYear,
                mode: mode,
                modeIndicatorLabel: null,
                selectedCategoryIds: sanitizedSelection.sanitizedCategoryIds,
                state: "ready",
                subtitle: mode === "edit"
                    ? "Drag categories and items into the Blockly canvas to shape your quarterly procurement plan."
                    : "This plan is open in read-only mode because it is no longer editable from this department session.",
                title: `${base.department.name} procurement plan`,
                unavailableCategories: sanitizedSelection.unavailableCategories,
            },
            plan: {
                categorySummaries: plan.categorySummaries.map((summary) => ({
                    amount: summary.amount,
                    categoryId: String(summary.categoryId),
                    categoryName: summary.categoryName,
                    itemCount: summary.itemCount,
                })),
                estimatedBudgetUsed: plan.estimatedBudgetUsed,
                id: String(plan._id),
                itemCount: plan.itemCount,
                selectedCategoryIds: sanitizedSelection.sanitizedCategoryIds,
                status: plan.status,
                workspaceState: (0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(plan.workspaceState, {
                    lastSavedAt: plan.updatedAt,
                    lastSavedByUserId: String(base.authContext.userId),
                }),
            },
            redirectHref: null,
            statusMessage: null,
        };
    },
});
exports.saveDepartmentUserWorkspaceDraft = (0, server_1.mutation)({
    args: {
        categorySummaries: values_1.v.array(workspaceCategorySummaryValidator),
        estimatedBudgetUsed: values_1.v.number(),
        itemCount: values_1.v.number(),
        planId: values_1.v.string(),
        selectedCategoryIds: values_1.v.array(values_1.v.string()),
        workspaceState: workspaceRecordValidator,
    },
    returns: values_1.v.object({
        savedAt: values_1.v.number(),
    }),
    handler: async (ctx, args) => {
        const base = await loadDepartmentUserPlanBase(ctx);
        if (!base.department) {
            unexpectedAccessError();
        }
        const [catalog, plans] = await Promise.all([
            loadTenantCatalog(ctx, base.authContext.tenantId),
            loadCanonicalDepartmentPlans(ctx, base.department._id),
        ]);
        const categoryDocs = await ctx.db
            .query("procurementCategories")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", base.authContext.tenantId))
            .collect();
        const plan = plans.find((candidate) => String(candidate._id) === args.planId);
        if (!plan) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: "Plan not found for this department.",
            });
        }
        if (!(0, du_plan_routes_1.canDepartmentUserEditWorkspace)({
            accessMode: base.authContext.departmentAccessMode,
            status: plan.status,
        })) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: (0, du_plan_routes_1.getDepartmentUserWorkspaceEditBlockedMessage)({
                    accessMode: base.authContext.departmentAccessMode,
                    status: plan.status,
                }),
            });
        }
        const sanitizedSelection = (0, du_toolbox_1.sanitizeDepartmentUserWorkspaceCategorySelection)({
            categories: catalog.categories,
            items: catalog.items,
            requestedCategoryIds: args.selectedCategoryIds,
        });
        const categoryDocIdsByString = new Map(categoryDocs.map((category) => [String(category._id), category._id]));
        const categoryNamesById = new Map(catalog.categories.map((category) => [category.id, category.name]));
        const categoryIdByName = new Map(catalog.categories.map((category) => [category.name, category.id]));
        const selectedCategoryIds = sanitizedSelection.sanitizedCategoryIds
            .map((categoryId) => {
            return categoryDocIdsByString.get(categoryId) ?? null;
        })
            .filter((value) => value !== null);
        const categorySummaries = args.categorySummaries
            .map((summary) => {
            const resolvedCategoryId = categoryDocIdsByString.get(summary.categoryId) ??
                categoryDocIdsByString.get(categoryIdByName.get(summary.categoryName) ?? "") ??
                null;
            if (!resolvedCategoryId) {
                return null;
            }
            return {
                amount: summary.amount,
                categoryId: resolvedCategoryId,
                categoryName: categoryNamesById.get(String(resolvedCategoryId)) ??
                    summary.categoryName,
                itemCount: summary.itemCount,
            };
        })
            .filter((summary) => Boolean(summary));
        const savedAt = Date.now();
        const workspaceState = buildPersistedDepartmentUserWorkspaceState({
            currentUserId: String(base.authContext.userId),
            savedAt,
            workspaceState: args.workspaceState,
        });
        await ctx.db.patch(plan._id, {
            categorySummaries,
            estimatedBudgetUsed: Math.max(0, args.estimatedBudgetUsed),
            itemCount: Math.max(0, args.itemCount),
            selectedCategoryIds,
            workspaceState,
            updatedAt: savedAt,
        });
        return { savedAt };
    },
});
