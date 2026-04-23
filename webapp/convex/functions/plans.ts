import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import {
    createPersistedBlocklyWorkspaceRecord,
    createBlocklyWorkspaceRecord,
    normalizeBlocklyWorkspaceRecord,
} from "../../lib/blockly/blockly-serialization";
import { getDepartmentUserPlanSubmitState } from "../../lib/blockly/plan-submission";
import { normalizeCategoryIcon } from "../../lib/procurement-officer/categories";
import {
    prepareDepartmentUserWorkspaceDraftPersistence,
    deriveDepartmentUserWorkspaceDraftPersistenceSummary,
} from "../../lib/blockly/workspace-save";
import {
    canDepartmentUserEditWorkspace,
    resolveDepartmentUserWorkspaceMode,
} from "../../lib/blockly/du-plan-routes";
import { sanitizeDepartmentUserWorkspaceCategorySelection } from "../../lib/blockly/du-toolbox";
import {
    AUDIT_EVENT_NAMES,
    AUDIT_OUTCOMES,
    createAuthenticatedAuditActor,
} from "../../lib/security/audit";
import {
    buildPlanSubmissionEmailIdempotencyKey,
    buildPlanSubmissionPersistenceRecord,
    buildPlanSubmissionSequenceKey,
    formatPlanSubmissionReference,
    getNextPlanSubmissionSequence,
    normalizePlanSubmissionLifecycleStatus,
    resolveLatestActivePlanSubmissionSnapshot,
    shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot,
} from "../../lib/plans/submission";
import { requireTenantRole } from "./_roleGuard";
import { appendAuditLogBestEffort, appendAuditLogRequired } from "./_audit";

type DataCtx = MutationCtx | QueryCtx;

const departmentUserWorkspaceStateValidator = v.union(
    v.literal("blocked"),
    v.literal("not_found"),
    v.literal("ready"),
    v.literal("redirect"),
);

export const workspaceRecordValidator = v.object({
    editorMetadata: v.object({
        lastSavedAt: v.number(),
        lastSavedByUserId: v.string(),
        recoveredAt: v.union(v.number(), v.null()),
        revision: v.number(),
        saveSource: v.union(
            v.literal("workspace_clear"),
            v.literal("workspace_recovery"),
            v.literal("workspace_seed"),
            v.literal("workspace_sync"),
        ),
    }),
    format: v.literal("blockly_json"),
    schemaVersion: v.number(),
    workspaceJson: v.any(),
});

export const workspaceCategorySummaryValidator = v.object({
    amount: v.number(),
    categoryId: v.string(),
    categoryName: v.string(),
    itemCount: v.number(),
});

export const workspaceItemValidator = v.object({
    categoryId: v.string(),
    complianceFlags: v.optional(v.array(v.string())),
    description: v.union(v.string(), v.null()),
    id: v.string(),
    isActive: v.boolean(),
    lastPriceChangedAt: v.union(v.number(), v.null()),
    maxQuantity: v.union(v.number(), v.null()),
    minQuantity: v.union(v.number(), v.null()),
    name: v.string(),
    procurementMethod: v.union(v.string(), v.null()),
    sortOrder: v.number(),
    sourceOfFunds: v.union(v.string(), v.null()),
    unitOfMeasurement: v.union(v.string(), v.null()),
    unitPrice: v.union(v.number(), v.null()),
});

export const workspaceCategoryValidator = v.object({
    color: v.union(v.string(), v.null()),
    id: v.string(),
    icon: v.union(v.string(), v.null()),
    isActive: v.boolean(),
    name: v.string(),
    sortOrder: v.number(),
});

export const workspaceDepartmentValidator = v.object({
    budgetAllocation: v.union(v.number(), v.null()),
    code: v.string(),
    id: v.string(),
    name: v.string(),
    voteNumber: v.string(),
});

const planSubmissionEmailStatusValidator = v.union(
    v.literal("failed"),
    v.literal("queued"),
);

export const planWorkspaceContextValidator = v.object({
    catalog: v.object({
        categories: v.array(workspaceCategoryValidator),
        items: v.array(workspaceItemValidator),
    }),
    department: workspaceDepartmentValidator,
    meta: v.object({
        accessMode: v.union(
            v.literal("editable"),
            v.literal("read_only_grace"),
            v.null(),
        ),
        actor: v.union(v.literal("department_user"), v.literal("procurement_officer")),
        actorLabel: v.string(),
        availableToolbarActions: v.array(v.string()),
        currentUserId: v.string(),
        fiscalYear: v.string(),
        mode: v.union(v.literal("edit"), v.literal("view")),
        modeIndicatorLabel: v.union(v.string(), v.null()),
        selectedCategoryIds: v.array(v.string()),
        state: departmentUserWorkspaceStateValidator,
        subtitle: v.string(),
        title: v.string(),
        unavailableCategories: v.array(
            v.object({
                id: v.string(),
                name: v.string(),
                reason: v.string(),
            }),
        ),
    }),
    plan: v.union(
        v.object({
            canWithdraw: v.boolean(),
            categorySummaries: v.array(workspaceCategorySummaryValidator),
            estimatedBudgetUsed: v.number(),
            id: v.string(),
            itemCount: v.number(),
            reviewStartedAt: v.union(v.number(), v.null()),
            selectedCategoryIds: v.array(v.string()),
            submissionEmailErrorMessage: v.union(v.string(), v.null()),
            submissionEmailStatus: v.union(planSubmissionEmailStatusValidator, v.null()),
            submissionReference: v.union(v.string(), v.null()),
            submittedAt: v.union(v.number(), v.null()),
            status: v.union(
                v.literal("approved"),
                v.literal("draft"),
                v.literal("rejected"),
                v.literal("submitted"),
            ),
            workspaceState: workspaceRecordValidator,
        }),
        v.null(),
    ),
    redirectHref: v.union(v.string(), v.null()),
    statusMessage: v.union(v.string(), v.null()),
});

const createPlanResultValidator = v.object({
    planId: v.string(),
    redirectedToExistingPlan: v.boolean(),
});

const submitDepartmentUserPlanResultValidator = v.object({
    canWithdraw: v.boolean(),
    emailErrorMessage: v.union(v.string(), v.null()),
    emailStatus: v.union(planSubmissionEmailStatusValidator, v.null()),
    status: v.literal("submitted"),
    submissionReference: v.string(),
    submittedAt: v.number(),
});

const withdrawDepartmentUserPlanResultValidator = v.object({
    status: v.literal("draft"),
});

function unexpectedAccessError(): never {
    throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Department User plan access is unavailable.",
    });
}

export function mapDepartmentDepartmentRecord(department: Doc<"departments">) {
    return {
        budgetAllocation: department.budgetAllocation ?? null,
        code: department.code,
        id: String(department._id),
        name: department.name,
        voteNumber: department.voteNumber ?? department.code,
    };
}

async function loadDepartmentUserPlanBase(ctx: DataCtx): Promise<{
    authContext: Awaited<ReturnType<typeof requireTenantRole>>;
    blockedReason: string | null;
    department: Doc<"departments"> | null;
}> {
    const authContext = await requireTenantRole(ctx, ["department_user"]);
    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) =>
            q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId),
        )
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
            blockedReason:
                "Department setup is incomplete. Contact your Procurement Officer to finish linking your account.",
            department: null,
        };
    }

    const department = await ctx.db.get(profile.departmentId);
    if (!department || department.tenantId !== authContext.tenantId || !department.isActive) {
        return {
            authContext,
            blockedReason:
                "Department setup is incomplete. Contact your Procurement Officer to finish linking your account.",
            department: null,
        };
    }

    return {
        authContext,
        blockedReason: null,
        department,
    };
}

export async function loadTenantCatalog(ctx: DataCtx, tenantId: Id<"tenants">) {
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
            color: category.color ?? null,
            id: String(category._id),
            icon: normalizeCategoryIcon(category.icon ?? null) ?? null,
            isActive: category.isActive,
            name: category.name,
            sortOrder: category.sortOrder,
        })),
        items: items.map((item) => ({
            categoryId: String(item.categoryId),
            complianceFlags: item.complianceFlags ?? [],
            description: item.description ?? null,
            id: String(item._id),
            isActive: item.isActive,
            lastPriceChangedAt: item.lastPriceChangedAt ?? null,
            maxQuantity: item.maxQuantity ?? null,
            minQuantity: item.minQuantity ?? null,
            name: item.name,
            procurementMethod: item.procurementMethod ?? null,
            sortOrder: item.sortOrder ?? Number.MAX_SAFE_INTEGER,
            sourceOfFunds: item.sourceOfFunds ?? null,
            unitOfMeasurement: item.unitOfMeasurement ?? null,
            unitPrice: item.unitPrice ?? null,
        })),
    };
}

async function loadCanonicalDepartmentPlans(
    ctx: DataCtx,
    departmentId: Id<"departments">,
) {
    const plans = await ctx.db
        .query("plans")
        .withIndex("by_departmentId", (q) => q.eq("departmentId", departmentId))
        .collect();

    return plans.sort((left, right) => right.updatedAt - left.updatedAt);
}

async function loadDepartmentUserTenantUser(
    ctx: MutationCtx,
    args: {
        tenantId: Id<"tenants">;
        userId: Id<"users">;
    },
) {
    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) =>
            q.eq("userId", args.userId).eq("tenantId", args.tenantId),
        )
        .first();

    if (!tenantUser || tenantUser.role !== "department_user" || !tenantUser.isActive) {
        unexpectedAccessError();
    }

    return tenantUser;
}

function toNormalizedWorkspaceRecord(
    plan: Doc<"plans">,
    userId: Id<"users">,
) {
    return normalizeBlocklyWorkspaceRecord(plan.workspaceState, {
        lastSavedAt: plan.updatedAt,
        lastSavedByUserId: String(userId),
    });
}

function buildDepartmentUserPlanAuditEntry(args: {
    action: "submit" | "withdraw";
    actorUserId: Id<"users">;
    departmentId: Id<"departments">;
    event:
        | typeof AUDIT_EVENT_NAMES.planSubmitted
        | typeof AUDIT_EVENT_NAMES.planSubmissionBlocked
        | typeof AUDIT_EVENT_NAMES.planSubmissionEmailFailed
        | typeof AUDIT_EVENT_NAMES.planSubmissionEmailQueued
        | typeof AUDIT_EVENT_NAMES.planWithdrawn
        | typeof AUDIT_EVENT_NAMES.planWithdrawalBlocked;
    metadata?: Record<string, unknown>;
    outcome:
        | typeof AUDIT_OUTCOMES.allowed
        | typeof AUDIT_OUTCOMES.blockedStateTransition
        | typeof AUDIT_OUTCOMES.failed
        | typeof AUDIT_OUTCOMES.queued;
    planId: Id<"plans">;
    tenantId: Id<"tenants">;
}) {
    return {
        action: args.action,
        actor: createAuthenticatedAuditActor({
            role: "department_user",
            userId: String(args.actorUserId),
        }),
        entityType: "plan",
        event: args.event,
        metadata: {
            departmentId: String(args.departmentId),
            ...args.metadata,
        },
        outcome: args.outcome,
        recordId: String(args.planId),
        sourceTenantId: String(args.tenantId),
        tableName: "plans",
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    } as const;
}

function buildBlockedSubmissionError(message: string): never {
    throw new ConvexError({
        code: "VALIDATION_FAILED",
        message,
    });
}

function createBlockedContext(args: {
    accessMode?: "editable" | "read_only_grace" | null;
    currentUserId: string;
    fiscalYear: string;
    message: string;
}) {
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
            actor: "department_user" as const,
            actorLabel: "Department User",
            availableToolbarActions: ["exit"],
            currentUserId: args.currentUserId,
            fiscalYear: args.fiscalYear,
            mode: "view" as const,
            modeIndicatorLabel: null,
            selectedCategoryIds: [],
            state: "blocked" as const,
            subtitle: args.message,
            title: "Planning workspace unavailable",
            unavailableCategories: [],
        },
        plan: null,
        redirectHref: null,
        statusMessage: args.message,
    };
}

export const getDepartmentUserNewPlanWorkspaceContext = query({
    args: {
        categoryIds: v.array(v.string()),
        fiscalYear: v.string(),
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
        const sanitizedSelection = sanitizeDepartmentUserWorkspaceCategorySelection({
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
                    message:
                        "None of the selected categories are currently available for planning. Return to the dashboard launchpad and choose active categories.",
                }),
                department: mapDepartmentDepartmentRecord(base.department),
                meta: {
                    ...createBlockedContext({
                        accessMode: base.authContext.departmentAccessMode ?? null,
                        currentUserId: String(base.authContext.userId),
                        fiscalYear: args.fiscalYear,
                        message:
                            "None of the selected categories are currently available for planning. Return to the dashboard launchpad and choose active categories.",
                    }).meta,
                    unavailableCategories: sanitizedSelection.unavailableCategories,
                },
            };
        }

        const canonicalPlans = await loadCanonicalDepartmentPlans(ctx, base.department._id);
        const existingPlan = canonicalPlans.find(
            (plan) => plan.fiscalYear === args.fiscalYear,
        );

        if (existingPlan) {
            const workspaceMode = resolveDepartmentUserWorkspaceMode({
                accessMode: base.authContext.departmentAccessMode,
                requestedMode:
                    existingPlan.status === "draft" || existingPlan.status === "rejected"
                        ? "edit"
                        : "view",
                status: existingPlan.status,
            });

            return {
                catalog,
                department: mapDepartmentDepartmentRecord(base.department),
                meta: {
                    accessMode: base.authContext.departmentAccessMode ?? null,
                    actor: "department_user" as const,
                    actorLabel: "Department User",
                    availableToolbarActions: ["exit", "request_item", "export", "submit"],
                    currentUserId: String(base.authContext.userId),
                    fiscalYear: args.fiscalYear,
                    mode: workspaceMode as "edit" | "view",
                    modeIndicatorLabel: null,
                    selectedCategoryIds: existingPlan.selectedCategoryIds.map((categoryId) =>
                        String(categoryId),
                    ),
                    state: "redirect" as const,
                    subtitle: "A current fiscal-year plan already exists. Opening the canonical workspace instead.",
                    title: "Redirecting to your existing plan",
                    unavailableCategories: sanitizedSelection.unavailableCategories,
                },
                plan: null,
                redirectHref: `/du/plans/${String(existingPlan._id)}?mode=${workspaceMode}`,
                statusMessage:
                    "A current fiscal-year plan already exists for this department.",
            };
        }

        return {
            catalog,
            department: mapDepartmentDepartmentRecord(base.department),
            meta: {
                accessMode: base.authContext.departmentAccessMode ?? null,
                actor: "department_user" as const,
                actorLabel: "Department User",
                availableToolbarActions: ["exit", "request_item", "export", "submit"],
                currentUserId: String(base.authContext.userId),
                fiscalYear: args.fiscalYear,
                mode: "edit" as const,
                modeIndicatorLabel: null,
                selectedCategoryIds: sanitizedSelection.sanitizedCategoryIds,
                state: "ready" as const,
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

export const ensureDepartmentUserDraftPlan = mutation({
    args: {
        categoryIds: v.array(v.string()),
        fiscalYear: v.string(),
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
        const sanitizedSelection = sanitizeDepartmentUserWorkspaceCategorySelection({
            categories: catalog.categories,
            items: catalog.items,
            requestedCategoryIds: args.categoryIds,
        });

        if (sanitizedSelection.sanitizedCategoryIds.length === 0) {
            throw new ConvexError({
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

        const categoryDocIdsByString = new Map(
            categoryDocs.map((category) => [String(category._id), category._id] as const),
        );
        const selectedCategoryIds = sanitizedSelection.sanitizedCategoryIds
            .map((categoryId) => {
                return categoryDocIdsByString.get(categoryId) ?? null;
            })
            .filter(
                (value): value is Id<"procurementCategories"> => value !== null,
            );
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
            workspaceState: createBlocklyWorkspaceRecord({
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

export const getDepartmentUserPlanWorkspace = query({
    args: {
        accessRefreshKey: v.optional(v.number()),
        planId: v.string(),
        requestedMode: v.optional(v.union(v.literal("edit"), v.literal("view"))),
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
                    actor: "department_user" as const,
                    actorLabel: "Department User",
                    availableToolbarActions: ["exit"],
                    currentUserId: String(base.authContext.userId),
                    fiscalYear: "Unknown",
                    mode: "view" as const,
                    modeIndicatorLabel: null,
                    selectedCategoryIds: [],
                    state: "not_found" as const,
                    subtitle:
                        "This plan could not be opened. It may have been removed, belong to a different department, or fall outside supported planning states.",
                    title: "Plan not found",
                    unavailableCategories: [],
                },
                plan: null,
                redirectHref: null,
                statusMessage: "The requested plan could not be found for this department.",
            };
        }

        const sanitizedSelection = sanitizeDepartmentUserWorkspaceCategorySelection({
            categories: catalog.categories,
            items: catalog.items,
            requestedCategoryIds: plan.selectedCategoryIds.map((categoryId) =>
                String(categoryId),
            ),
            preserveUnavailableRequestedCategories: true,
        });
        const mode = resolveDepartmentUserWorkspaceMode({
            accessMode: base.authContext.departmentAccessMode,
            requestedMode: args.requestedMode ?? null,
            status: plan.status,
        });

        return {
            catalog,
            department: mapDepartmentDepartmentRecord(base.department),
            meta: {
                accessMode: base.authContext.departmentAccessMode ?? null,
                actor: "department_user" as const,
                actorLabel: "Department User",
                availableToolbarActions: ["exit", "request_item", "export", "submit"],
                currentUserId: String(base.authContext.userId),
                fiscalYear: plan.fiscalYear,
                mode: mode as "edit" | "view",
                modeIndicatorLabel: null,
                selectedCategoryIds: sanitizedSelection.sanitizedCategoryIds,
                state: "ready" as const,
                subtitle:
                    mode === "edit"
                        ? "Drag categories and items into the Blockly canvas to shape your quarterly procurement plan."
                        : "This plan is open in read-only mode because it is no longer editable from this department session.",
                title: `${base.department.name} procurement plan`,
                unavailableCategories: sanitizedSelection.unavailableCategories,
            },
            plan: {
                canWithdraw:
                    plan.status === "submitted" &&
                    typeof plan.reviewStartedAt !== "number",
                categorySummaries: plan.categorySummaries.map((summary) => ({
                    amount: summary.amount,
                    categoryId: String(summary.categoryId),
                    categoryName: summary.categoryName,
                    itemCount: summary.itemCount,
                })),
                estimatedBudgetUsed: plan.estimatedBudgetUsed,
                id: String(plan._id),
                itemCount: plan.itemCount,
                reviewStartedAt: plan.reviewStartedAt ?? null,
                selectedCategoryIds: sanitizedSelection.sanitizedCategoryIds,
                submissionEmailErrorMessage: plan.submissionEmailErrorMessage ?? null,
                submissionEmailStatus: plan.submissionEmailStatus ?? null,
                submissionReference: plan.submissionReference ?? null,
                submittedAt: plan.submittedAt ?? null,
                status: plan.status,
                workspaceState: toNormalizedWorkspaceRecord(plan, base.authContext.userId),
            },
            redirectHref: null,
            statusMessage: null,
        };
    },
});

export const saveDepartmentUserWorkspaceDraft = mutation({
    args: {
        categorySummaries: v.array(workspaceCategorySummaryValidator),
        estimatedBudgetUsed: v.number(),
        itemCount: v.number(),
        planId: v.string(),
        selectedCategoryIds: v.array(v.string()),
        workspaceState: workspaceRecordValidator,
    },
    returns: v.object({
        savedAt: v.number(),
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
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: "Plan not found for this department.",
            });
        }

        const persistenceResult = prepareDepartmentUserWorkspaceDraftPersistence({
            accessMode: base.authContext.departmentAccessMode,
            categories: catalog.categories,
            categoryDocs,
            currentUserId: String(base.authContext.userId),
            existingSelectedCategoryIds: plan.selectedCategoryIds,
            items: catalog.items,
            planStatus: plan.status,
            persistedWorkspaceState: normalizeBlocklyWorkspaceRecord(plan.workspaceState, {
                lastSavedAt: plan.updatedAt,
                lastSavedByUserId: String(base.authContext.userId),
            }),
            totalBudget: base.department.budgetAllocation ?? null,
            workspaceState: args.workspaceState,
        });

        if (!persistenceResult.ok) {
            throw new ConvexError({
                code: persistenceResult.code,
                message: persistenceResult.message,
            });
        }

        await ctx.db.patch(plan._id, persistenceResult.patch);

        return { savedAt: persistenceResult.patch.updatedAt };
    },
});

export const submitDepartmentUserPlan = mutation({
    args: {
        planId: v.string(),
    },
    returns: submitDepartmentUserPlanResultValidator,
    handler: async (ctx, args) => {
        const base = await loadDepartmentUserPlanBase(ctx);
        if (!base.department) {
            unexpectedAccessError();
        }

        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!normalizedPlanId) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: "Plan not found for this department.",
            });
        }

        const [tenantUser, authUser, catalog, planSnapshots] = await Promise.all([
            loadDepartmentUserTenantUser(ctx, {
                tenantId: base.authContext.tenantId,
                userId: base.authContext.userId,
            }),
            ctx.db.get(base.authContext.userId),
            loadTenantCatalog(ctx, base.authContext.tenantId),
            ctx.db
                .query("planSubmissionSnapshots")
                .withIndex("by_planId_submittedAt", (q) => q.eq("planId", normalizedPlanId))
                .collect(),
        ]);
        const plan = await ctx.db.get(normalizedPlanId);

        if (!plan || plan.tenantId !== base.authContext.tenantId || plan.departmentId !== base.department._id) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: "Plan not found for this department.",
            });
        }

        if (!canDepartmentUserEditWorkspace({
            accessMode: base.authContext.departmentAccessMode,
            status: plan.status,
        })) {
            await appendAuditLogRequired(
                ctx,
                buildDepartmentUserPlanAuditEntry({
                    action: "submit",
                    actorUserId: base.authContext.userId,
                    departmentId: base.department._id,
                    event: AUDIT_EVENT_NAMES.planSubmissionBlocked,
                    metadata: {
                        planStatus: plan.status,
                        reason: "plan_not_editable",
                    },
                    outcome: AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: base.authContext.tenantId,
                }),
            );
            buildBlockedSubmissionError(
                "This plan is no longer editable from the current Department User session.",
            );
        }

        if (plan.status === "submitted" && plan.submittedAt && plan.submissionReference) {
            return {
                canWithdraw: typeof plan.reviewStartedAt !== "number",
                emailErrorMessage: plan.submissionEmailErrorMessage ?? null,
                emailStatus: plan.submissionEmailStatus ?? null,
                status: "submitted" as const,
                submissionReference: plan.submissionReference,
                submittedAt: plan.submittedAt,
            };
        }

        if (plan.status !== "draft") {
            await appendAuditLogRequired(
                ctx,
                buildDepartmentUserPlanAuditEntry({
                    action: "submit",
                    actorUserId: base.authContext.userId,
                    departmentId: base.department._id,
                    event: AUDIT_EVENT_NAMES.planSubmissionBlocked,
                    metadata: {
                        planStatus: plan.status,
                        reason: "illegal_plan_status",
                    },
                    outcome: AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: base.authContext.tenantId,
                }),
            );
            buildBlockedSubmissionError("Only draft plans can be submitted to Procurement.");
        }

        const normalizedWorkspaceState = toNormalizedWorkspaceRecord(
            plan,
            base.authContext.userId,
        );
        const submissionDraftSummary = deriveDepartmentUserWorkspaceDraftPersistenceSummary({
            categories: catalog.categories.map((category) => ({
                id: category.id,
                name: category.name,
            })),
            items: catalog.items,
            totalBudget: base.department.budgetAllocation ?? null,
            workspaceState: normalizedWorkspaceState,
        });
        const workspaceSummary = submissionDraftSummary?.workspaceSummary ?? null;
        const submitState = getDepartmentUserPlanSubmitState({
            budgetState:
                workspaceSummary?.budgetState ?? {
                    advisoryText:
                        "Budget allocation is unavailable. Planning totals remain visible, but submission must stay blocked until a usable budget is assigned.",
                    announcementText:
                        "Department budget allocation is unavailable. Submission remains blocked until a budget is assigned.",
                    bannerText: null,
                    canSubmitByBudget: false,
                    overBudgetAmount: 0,
                    remainingBudget: null,
                    state: "unallocated",
                    statusLabel: "Budget not allocated",
                    totalBudget: null,
                    usageLabel: "Unallocated",
                    usedAmount:
                        submissionDraftSummary?.estimatedBudgetUsed ??
                        plan.estimatedBudgetUsed,
                    usedPercent: null,
                },
            hasUnsyncedChanges: false,
            mode: "edit",
            saveState: "saved",
            totalItemCount:
                submissionDraftSummary?.itemCount ?? workspaceSummary?.totalItemCount ?? plan.itemCount,
            validationState: workspaceSummary?.validationState ?? null,
        });

        if (submitState.disabled) {
            await appendAuditLogRequired(
                ctx,
                buildDepartmentUserPlanAuditEntry({
                    action: "submit",
                    actorUserId: base.authContext.userId,
                    departmentId: base.department._id,
                    event: AUDIT_EVENT_NAMES.planSubmissionBlocked,
                    metadata: {
                        planStatus: plan.status,
                        reason: submitState.reason,
                    },
                    outcome: AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: base.authContext.tenantId,
                }),
            );
            buildBlockedSubmissionError(submitState.reason);
        }

        if (!submissionDraftSummary) {
            const reason =
                "Workspace state is malformed and could not be recalculated safely for submission.";
            await appendAuditLogRequired(
                ctx,
                buildDepartmentUserPlanAuditEntry({
                    action: "submit",
                    actorUserId: base.authContext.userId,
                    departmentId: base.department._id,
                    event: AUDIT_EVENT_NAMES.planSubmissionBlocked,
                    metadata: {
                        planStatus: plan.status,
                        reason,
                    },
                    outcome: AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: base.authContext.tenantId,
                }),
            );
            buildBlockedSubmissionError(reason);
        }

        const submissionPersistence = buildPlanSubmissionPersistenceRecord({
            categorySummaries: submissionDraftSummary.categorySummaries,
            estimatedBudgetUsed: submissionDraftSummary.estimatedBudgetUsed,
            existingSelectedCategoryIds: plan.selectedCategoryIds.map((categoryId) =>
                String(categoryId),
            ),
            itemCount: submissionDraftSummary.itemCount,
        });
        const persistedCategorySummaries = submissionPersistence.categorySummaries
            .map((summary) => {
                const categoryId = ctx.db.normalizeId(
                    "procurementCategories",
                    summary.categoryId,
                );
                if (!categoryId) {
                    return null;
                }

                return {
                    amount: summary.amount,
                    categoryId,
                    categoryName: summary.categoryName,
                    itemCount: summary.itemCount,
                };
            })
            .filter(
                (
                    summary,
                ): summary is {
                    amount: number;
                    categoryId: Id<"procurementCategories">;
                    categoryName: string;
                    itemCount: number;
                } => Boolean(summary),
            );
        const persistedSelectedCategoryIds = submissionPersistence.selectedCategoryIds
            .map((categoryId) => ctx.db.normalizeId("procurementCategories", categoryId))
            .filter(
                (categoryId): categoryId is Id<"procurementCategories"> =>
                    categoryId !== null,
            );

        const nextSubmissionSequence = getNextPlanSubmissionSequence(
            planSnapshots.map((snapshot) => ({
                submissionSequence: snapshot.submissionSequence ?? null,
            })),
        );
        const now = Date.now();
        const submissionReference = formatPlanSubmissionReference({
            departmentCode: base.department.code,
            fiscalYear: plan.fiscalYear,
            submissionSequence: nextSubmissionSequence,
        });
        const submissionSequenceKey = buildPlanSubmissionSequenceKey({
            planId: String(plan._id),
            submissionSequence: nextSubmissionSequence,
            submittedAt: now,
            tenantId: String(base.authContext.tenantId),
        });

        await ctx.db.patch(plan._id, {
            departmentCodeSnapshot: base.department.code,
            departmentNameSnapshot: base.department.name,
            status: "submitted",
            categorySummaries: persistedCategorySummaries,
            estimatedBudgetUsed: submissionPersistence.estimatedBudgetUsed,
            itemCount: submissionPersistence.itemCount,
            selectedCategoryIds: persistedSelectedCategoryIds,
            submissionEmailErrorMessage: undefined,
            submissionEmailStatus: undefined,
            submissionReference,
            submissionSequence: nextSubmissionSequence,
            submittedAt: now,
            updatedAt: now,
        });

        await ctx.db.insert("planSubmissionSnapshots", {
            capturedAt: now,
            capturedByTenantUserId: tenantUser._id,
            capturedByUserId: base.authContext.userId,
            categorySummaries: submissionPersistence.categorySummaries.map((summary) => ({
                amount: summary.amount,
                categoryId: summary.categoryId,
                categoryName: summary.categoryName,
                itemCount: summary.itemCount,
            })),
            departmentCodeSnapshot: base.department.code,
            departmentId: plan.departmentId,
            departmentNameSnapshot: base.department.name,
            estimatedBudgetUsed: submissionPersistence.estimatedBudgetUsed,
            fiscalYear: plan.fiscalYear,
            itemCount: submissionPersistence.itemCount,
            lifecycleStatus: "active",
            planId: plan._id,
            selectedCategoryIds: submissionPersistence.selectedCategoryIds,
            submissionReference,
            submissionSequence: nextSubmissionSequence,
            submissionSequenceKey,
            submittedAt: now,
            tenantId: plan.tenantId,
            workspaceState: createPersistedBlocklyWorkspaceRecord(
                normalizedWorkspaceState,
            ),
        });

        await appendAuditLogRequired(
            ctx,
            buildDepartmentUserPlanAuditEntry({
                action: "submit",
                actorUserId: base.authContext.userId,
                departmentId: base.department._id,
                event: AUDIT_EVENT_NAMES.planSubmitted,
                metadata: {
                    itemCount: submissionPersistence.itemCount,
                    estimatedBudgetUsed: submissionPersistence.estimatedBudgetUsed,
                    submissionReference,
                    submissionSequence: nextSubmissionSequence,
                    submittedAt: now,
                },
                outcome: AUDIT_OUTCOMES.allowed,
                planId: plan._id,
                tenantId: base.authContext.tenantId,
            }),
        );

        let emailStatus: "failed" | "queued" | null = null;
        let emailErrorMessage: string | null = null;

        const recipientEmail =
            authUser && typeof authUser.email === "string" && authUser.email.trim().length > 0
                ? authUser.email.trim()
                : null;

        if (!recipientEmail) {
            emailStatus = "failed";
            emailErrorMessage =
                "The confirmation email could not be queued because no Department User email address is available on this account.";
        } else {
            try {
                await ctx.scheduler.runAfter(0, "actions/email:queueTransactionalEmail" as any, {
                    idempotencyKey: buildPlanSubmissionEmailIdempotencyKey({
                        planId: String(plan._id),
                        submissionSequence: nextSubmissionSequence,
                    }),
                    subject: `Plan submitted: ${submissionReference}`,
                    template: "plan-submission-confirmation",
                    templateProps: {
                        departmentName: base.department.name,
                        fiscalYear: plan.fiscalYear,
                        submissionReference,
                        submittedAt: now,
                    },
                    to: recipientEmail,
                });
                emailStatus = "queued";
            } catch (error) {
                emailStatus = "failed";
                emailErrorMessage =
                    error instanceof Error
                        ? error.message
                        : "The confirmation email could not be queued right now.";
            }
        }

        if (emailStatus) {
            await ctx.db.patch(plan._id, {
                submissionEmailErrorMessage: emailErrorMessage ?? undefined,
                submissionEmailStatus: emailStatus,
            });

            await appendAuditLogBestEffort(
                ctx,
                buildDepartmentUserPlanAuditEntry({
                    action: "submit",
                    actorUserId: base.authContext.userId,
                    departmentId: base.department._id,
                    event:
                        emailStatus === "queued"
                            ? AUDIT_EVENT_NAMES.planSubmissionEmailQueued
                            : AUDIT_EVENT_NAMES.planSubmissionEmailFailed,
                    metadata: {
                        emailErrorMessage,
                        recipientEmail,
                        submissionReference,
                        submissionSequence: nextSubmissionSequence,
                    },
                    outcome:
                        emailStatus === "queued"
                            ? AUDIT_OUTCOMES.queued
                            : AUDIT_OUTCOMES.failed,
                    planId: plan._id,
                    tenantId: base.authContext.tenantId,
                }),
            );
        }

        return {
            canWithdraw: true,
            emailErrorMessage,
            emailStatus,
            status: "submitted" as const,
            submissionReference,
            submittedAt: now,
        };
    },
});

export const withdrawDepartmentUserPlanSubmission = mutation({
    args: {
        planId: v.string(),
    },
    returns: withdrawDepartmentUserPlanResultValidator,
    handler: async (ctx, args) => {
        const base = await loadDepartmentUserPlanBase(ctx);
        if (!base.department) {
            unexpectedAccessError();
        }

        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!normalizedPlanId) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: "Plan not found for this department.",
            });
        }

        const [tenantUser, plan, planSnapshots] = await Promise.all([
            loadDepartmentUserTenantUser(ctx, {
                tenantId: base.authContext.tenantId,
                userId: base.authContext.userId,
            }),
            ctx.db.get(normalizedPlanId),
            ctx.db
                .query("planSubmissionSnapshots")
                .withIndex("by_planId_submittedAt", (q) => q.eq("planId", normalizedPlanId))
                .collect(),
        ]);

        if (!plan || plan.tenantId !== base.authContext.tenantId || plan.departmentId !== base.department._id) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: "Plan not found for this department.",
            });
        }

        if (plan.status !== "submitted") {
            await appendAuditLogRequired(
                ctx,
                buildDepartmentUserPlanAuditEntry({
                    action: "withdraw",
                    actorUserId: base.authContext.userId,
                    departmentId: base.department._id,
                    event: AUDIT_EVENT_NAMES.planWithdrawalBlocked,
                    metadata: {
                        planStatus: plan.status,
                        reason: "illegal_plan_status",
                    },
                    outcome: AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: base.authContext.tenantId,
                }),
            );
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: "Only submitted plans can be withdrawn back to draft.",
            });
        }

        if (typeof plan.reviewStartedAt === "number") {
            await appendAuditLogRequired(
                ctx,
                buildDepartmentUserPlanAuditEntry({
                    action: "withdraw",
                    actorUserId: base.authContext.userId,
                    departmentId: base.department._id,
                    event: AUDIT_EVENT_NAMES.planWithdrawalBlocked,
                    metadata: {
                        reason: "review_already_started",
                        reviewStartedAt: plan.reviewStartedAt,
                        submissionReference: plan.submissionReference ?? null,
                    },
                    outcome: AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: base.authContext.tenantId,
                }),
            );
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    "This submission can no longer be withdrawn because Procurement review has already started.",
            });
        }

        const activeSnapshot = resolveLatestActivePlanSubmissionSnapshot(
            planSnapshots.map((snapshot) => ({
                ...snapshot,
                lifecycleStatus: normalizePlanSubmissionLifecycleStatus(
                    snapshot.lifecycleStatus ?? null,
                ),
            })),
        );
        const now = Date.now();

        if (activeSnapshot) {
            await ctx.db.patch(activeSnapshot._id, {
                lifecycleStatus: "withdrawn",
                withdrawnAt: now,
                withdrawnByTenantUserId: tenantUser._id,
                withdrawnByUserId: base.authContext.userId,
            });
        } else if (
            shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot({
                activeSnapshotExists: false,
                planStatus: plan.status,
                submissionReference: plan.submissionReference ?? null,
                submittedAt: plan.submittedAt ?? null,
            })
        ) {
            await ctx.db.insert("planSubmissionSnapshots", {
                capturedAt: now,
                capturedByTenantUserId: tenantUser._id,
                capturedByUserId: base.authContext.userId,
                categorySummaries: plan.categorySummaries.map((summary) => ({
                    amount: summary.amount,
                    categoryId: String(summary.categoryId),
                    categoryName: summary.categoryName,
                    itemCount: summary.itemCount,
                })),
                departmentCodeSnapshot:
                    plan.departmentCodeSnapshot ?? base.department.code,
                departmentId: plan.departmentId,
                departmentNameSnapshot:
                    plan.departmentNameSnapshot ?? base.department.name,
                estimatedBudgetUsed: plan.estimatedBudgetUsed,
                fiscalYear: plan.fiscalYear,
                itemCount: plan.itemCount,
                lifecycleStatus: "withdrawn",
                planId: plan._id,
                selectedCategoryIds: plan.selectedCategoryIds.map((categoryId) =>
                    String(categoryId),
                ),
                submissionReference: plan.submissionReference ?? undefined,
                submissionSequence: plan.submissionSequence ?? undefined,
                submissionSequenceKey: buildPlanSubmissionSequenceKey({
                    planId: String(plan._id),
                    submissionSequence: plan.submissionSequence ?? null,
                    submittedAt: plan.submittedAt ?? null,
                    tenantId: String(base.authContext.tenantId),
                }),
                submittedAt: plan.submittedAt ?? null,
                tenantId: plan.tenantId,
                withdrawnAt: now,
                withdrawnByTenantUserId: tenantUser._id,
                withdrawnByUserId: base.authContext.userId,
                workspaceState: createPersistedBlocklyWorkspaceRecord(
                    toNormalizedWorkspaceRecord(plan, base.authContext.userId),
                ),
            });
        }

        await ctx.db.patch(plan._id, {
            departmentCodeSnapshot: undefined,
            departmentNameSnapshot: undefined,
            status: "draft",
            submissionEmailErrorMessage: undefined,
            submissionEmailStatus: undefined,
            submissionReference: undefined,
            submissionSequence: undefined,
            submittedAt: undefined,
            updatedAt: now,
        });

        await appendAuditLogRequired(
            ctx,
            buildDepartmentUserPlanAuditEntry({
                action: "withdraw",
                actorUserId: base.authContext.userId,
                departmentId: base.department._id,
                event: AUDIT_EVENT_NAMES.planWithdrawn,
                metadata: {
                    submissionReference: plan.submissionReference ?? null,
                    withdrawnAt: now,
                },
                outcome: AUDIT_OUTCOMES.allowed,
                planId: plan._id,
                tenantId: base.authContext.tenantId,
            }),
        );

        return {
            status: "draft" as const,
        };
    },
});
