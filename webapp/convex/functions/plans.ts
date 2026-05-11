import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import {
    createPersistedBlocklyWorkspaceRecord,
    createBlocklyWorkspaceRecord,
    normalizeBlocklyWorkspaceRecord,
} from "../../lib/shared/blockly/blockly-serialization";
import {
    getDepartmentUserPlanSubmitState,
    shouldReplayDepartmentUserSubmittedPlan,
} from "../../lib/shared/blockly/plan-submission";
import {
    buildDepartmentUserRevisionHistory,
    mapDepartmentUserFlaggedTargetsToIssues,
} from "../../lib/department-user/revision-feedback";
import { normalizeCategoryIcon } from "../../lib/procurement-officer/categories";
import {
    prepareDepartmentUserWorkspaceDraftPersistence,
    deriveDepartmentUserWorkspaceDraftPersistenceSummary,
} from "../../lib/shared/blockly/workspace-save";
import {
    canDepartmentUserEditWorkspace,
    resolveDepartmentUserWorkspaceMode,
} from "../../lib/shared/blockly/du-plan-rules";
import { sanitizeDepartmentUserWorkspaceCategorySelection } from "../../lib/shared/blockly/du-toolbox-selection";
import {
    AUDIT_EVENT_NAMES,
    AUDIT_OUTCOMES,
    createAuthenticatedAuditActor,
} from "../../lib/shared/security/audit";
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
import {
    evaluateSubmissionDeadlineIssue,
    resolveEffectiveSubmissionWindow,
    summarizePendingCatalogRequestBlockers,
} from "../../lib/plans/pre-submission-validation";
import {
    deriveDepartmentUserEffectiveRevisionDeadline,
    hasDepartmentUserRevisionDeadlineExpired,
} from "../../lib/plans/revision-deadline";
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

const revisionFlaggedTargetValidator = v.object({
    categoryId: v.string(),
    id: v.string(),
    itemId: v.union(v.string(), v.null()),
    label: v.string(),
    type: v.union(v.literal("category"), v.literal("item")),
});

const revisionDecisionValidator = v.object({
    comment: v.string(),
    decidedAt: v.number(),
    decisionType: v.union(
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("revision_requested"),
    ),
    effectiveRevisionDeadlineAt: v.union(v.number(), v.null()),
    flaggedTargets: v.array(revisionFlaggedTargetValidator),
    id: v.string(),
    lifecycleStatus: v.union(
        v.literal("active"),
        v.literal("superseded"),
        v.literal("undone"),
        v.null(),
    ),
    revisionDeadlineAt: v.union(v.number(), v.null()),
    submissionReference: v.union(v.string(), v.null()),
});

const revisionHistoryEntryValidator = v.object({
    detail: v.string(),
    id: v.string(),
    kind: v.union(
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("revision_requested"),
        v.literal("submitted"),
        v.literal("withdrawn"),
    ),
    timestamp: v.union(v.number(), v.null()),
    timestampLabel: v.string(),
    title: v.string(),
});

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
        timeZone: v.string(),
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
            revisionContext: v.union(
                v.object({
                    activeDecision: v.union(revisionDecisionValidator, v.null()),
                    effectiveDeadlineExpired: v.boolean(),
                    history: v.array(revisionHistoryEntryValidator),
                    inconsistentStateMessage: v.union(v.string(), v.null()),
                    reviewDecisions: v.array(revisionDecisionValidator),
                }),
                v.null(),
            ),
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
            workspaceVersion: v.number(),
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

async function loadNewestSharedSubmissionDeadline(
    ctx: DataCtx,
    args: {
        fiscalYear: string;
        tenantId: Id<"tenants">;
    },
) {
    const sharedDeadlines = await ctx.db
        .query("submissionDeadlines")
        .withIndex("by_tenantId_fiscalYearKey", (q) =>
            q.eq("tenantId", args.tenantId).eq("fiscalYearKey", args.fiscalYear),
        )
        .collect();

    return (
        sharedDeadlines.sort(
            (left, right) =>
                right.deadlineVersion - left.deadlineVersion ||
                right.updatedAt - left.updatedAt,
        )[0] ?? null
    );
}

function resolveDepartmentEffectiveSubmissionDeadlineAt(args: {
    departmentSubmissionEndsAt?: number | null;
    sharedSubmissionEndsAt?: number | null;
}): number | null {
    if (
        typeof args.departmentSubmissionEndsAt === "number" &&
        typeof args.sharedSubmissionEndsAt === "number"
    ) {
        return Math.max(args.departmentSubmissionEndsAt, args.sharedSubmissionEndsAt);
    }

    return args.sharedSubmissionEndsAt ?? args.departmentSubmissionEndsAt ?? null;
}

function buildDepartmentUserRevisionAuditEntry(args: {
    actorUserId: Id<"users">;
    departmentId: Id<"departments">;
    metadata?: Record<string, unknown>;
    outcome: typeof AUDIT_OUTCOMES.blockedStateTransition;
    planId: Id<"plans">;
    tenantId: Id<"tenants">;
}) {
    return {
        action: "read_revision_context",
        actor: createAuthenticatedAuditActor({
            role: "department_user",
            userId: String(args.actorUserId),
        }),
        entityType: "plan",
        event: AUDIT_EVENT_NAMES.planRevisionContextBlocked,
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

function mapDepartmentUserRevisionDecision(args: {
    decision: Doc<"planReviewDecisions">;
    submissionReference: string | null;
    submissionDeadlineAt: number | null;
}) {
    const effectiveDeadline = deriveDepartmentUserEffectiveRevisionDeadline({
        decisionType: args.decision.decisionType,
        decidedAt: args.decision.decidedAt,
        revisionDeadlineAt: args.decision.revisionDeadlineAt ?? null,
        submissionDeadlineAt: args.submissionDeadlineAt,
    });

    return {
        comment: args.decision.comment,
        decidedAt: args.decision.decidedAt,
        decisionType: args.decision.decisionType,
        effectiveRevisionDeadlineAt: effectiveDeadline.effectiveDeadlineAt,
        flaggedTargets: args.decision.flaggedTargets.map((target) => ({
            categoryId: target.categoryId,
            id: target.id,
            itemId: target.itemId,
            label: target.label,
            type: target.type,
        })),
        id: String(args.decision._id),
        lifecycleStatus: args.decision.lifecycleStatus ?? null,
        revisionDeadlineAt: args.decision.revisionDeadlineAt ?? null,
        submissionReference: args.submissionReference,
    };
}

function resolveRevisionDecisionSubmissionReference(args: {
    decision: Doc<"planReviewDecisions">;
    planSnapshots: readonly Doc<"planSubmissionSnapshots">[];
}): string | null {
    const matchingSnapshot =
        [...args.planSnapshots]
            .filter((snapshot) => {
                const snapshotTimestamp = snapshot.submittedAt ?? snapshot.capturedAt;
                return snapshotTimestamp <= args.decision.decidedAt;
            })
            .sort((left, right) => {
                const leftTimestamp = left.submittedAt ?? left.capturedAt;
                const rightTimestamp = right.submittedAt ?? right.capturedAt;
                if (leftTimestamp !== rightTimestamp) {
                    return rightTimestamp - leftTimestamp;
                }

                return (
                    (right.submissionSequence ?? Number.MIN_SAFE_INTEGER) -
                    (left.submissionSequence ?? Number.MIN_SAFE_INTEGER)
                );
            })[0] ?? null;

    return matchingSnapshot?.submissionReference ?? null;
}

async function loadDepartmentUserRevisionContext(
    ctx: DataCtx,
    args: {
        actorUserId: Id<"users">;
        departmentId: Id<"departments">;
        plan: Doc<"plans">;
        planSnapshots: Doc<"planSubmissionSnapshots">[];
        submissionDeadlineAt: number | null;
        tenantId: Id<"tenants">;
        timeZone: string;
    },
) {
    const decisions = await ctx.db
        .query("planReviewDecisions")
        .withIndex("by_planId_decidedAt", (q) => q.eq("planId", args.plan._id))
        .collect();

    const activeDecisions = decisions.filter(
        (decision) => decision.lifecycleStatus === "active",
    );
    const reviewDecisions = decisions.map((decision) => {
        return mapDepartmentUserRevisionDecision({
            decision,
            submissionDeadlineAt: args.submissionDeadlineAt,
            submissionReference: resolveRevisionDecisionSubmissionReference({
                decision,
                planSnapshots: args.planSnapshots,
            }),
        });
    });

    const requiresAuthoritativeDecision = args.plan.status === "rejected";
    const activeDuVisibleDecisions = activeDecisions.filter(
        (decision) =>
            decision.decisionType === "rejected" ||
            decision.decisionType === "revision_requested",
    );

    let inconsistentStateAuditEntry: ReturnType<
        typeof buildDepartmentUserRevisionAuditEntry
    > | null = null;
    let inconsistentStateMessage: string | null = null;
    if (requiresAuthoritativeDecision && activeDuVisibleDecisions.length !== 1) {
        inconsistentStateMessage =
            activeDuVisibleDecisions.length === 0
                ? "Revision feedback is temporarily unavailable because the active Procurement decision could not be confirmed."
                : "Revision feedback is temporarily unavailable because multiple active Procurement decisions were found for this plan.";
        inconsistentStateAuditEntry = buildDepartmentUserRevisionAuditEntry({
            actorUserId: args.actorUserId,
            departmentId: args.departmentId,
            metadata: {
                activeDecisionCount: activeDuVisibleDecisions.length,
                planStatus: args.plan.status,
                reason:
                    activeDuVisibleDecisions.length === 0
                        ? "missing_active_revision_decision"
                        : "multiple_active_revision_decisions",
            },
            outcome: AUDIT_OUTCOMES.blockedStateTransition,
            planId: args.plan._id,
            tenantId: args.tenantId,
        });
    }

    const activeDecision =
        inconsistentStateMessage === null
            ? activeDuVisibleDecisions
                  .map((decision) =>
                      mapDepartmentUserRevisionDecision({
                          decision,
                          submissionDeadlineAt: args.submissionDeadlineAt,
                          submissionReference: resolveRevisionDecisionSubmissionReference({
                              decision,
                              planSnapshots: args.planSnapshots,
                          }),
                      }),
                  )
                  .sort((left, right) => right.decidedAt - left.decidedAt)[0] ?? null
            : null;

    return {
        activeDecision,
        effectiveDeadlineExpired: hasDepartmentUserRevisionDeadlineExpired({
            deadlineAt: activeDecision?.effectiveRevisionDeadlineAt ?? null,
            now: Date.now(),
        }),
        history: buildDepartmentUserRevisionHistory({
            decisions: reviewDecisions,
            snapshots: args.planSnapshots.map((snapshot) => ({
                capturedAt: snapshot.capturedAt,
                lifecycleStatus: snapshot.lifecycleStatus ?? null,
                submissionReference: snapshot.submissionReference ?? null,
                submissionSequence: snapshot.submissionSequence ?? null,
                submittedAt: snapshot.submittedAt ?? null,
                withdrawnAt: snapshot.withdrawnAt ?? null,
            })),
            timeZone: args.timeZone,
        }),
        inconsistentStateAuditEntry,
        inconsistentStateMessage,
        reviewDecisions: reviewDecisions.sort(
            (left, right) => right.decidedAt - left.decidedAt,
        ),
    };
}

type DepartmentUserRevisionContext = Awaited<
    ReturnType<typeof loadDepartmentUserRevisionContext>
>;

function toDepartmentUserPublicRevisionContext(
    revisionContext: DepartmentUserRevisionContext,
) {
    return {
        activeDecision: revisionContext.activeDecision,
        effectiveDeadlineExpired: revisionContext.effectiveDeadlineExpired,
        history: revisionContext.history,
        inconsistentStateMessage: revisionContext.inconsistentStateMessage,
        reviewDecisions: revisionContext.reviewDecisions,
    };
}

function getPlanWorkspaceVersion(plan: { workspaceVersion?: number }): number {
    return typeof plan.workspaceVersion === "number" && plan.workspaceVersion > 0
        ? plan.workspaceVersion
        : 1;
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

function getPrimaryBlockedSubmissionMessage(args: {
    fallback: string;
    issues: readonly { blocksSubmission: boolean; message: string }[];
}): string {
    return (
        args.issues.find((issue) => issue.blocksSubmission)?.message ??
        args.fallback
    );
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
            timeZone: "Africa/Nairobi",
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
                    timeZone: "Africa/Nairobi",
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
                timeZone: "Africa/Nairobi",
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
            workspaceVersion: 1,
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
                    timeZone: "Africa/Nairobi",
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
        const [tenant, planSnapshots, newestSharedDeadline] = await Promise.all([
            ctx.db.get(base.authContext.tenantId),
            ctx.db
                .query("planSubmissionSnapshots")
                .withIndex("by_planId_submittedAt", (q) => q.eq("planId", plan._id))
                .collect(),
            loadNewestSharedSubmissionDeadline(ctx, {
                fiscalYear: plan.fiscalYear,
                tenantId: base.authContext.tenantId,
            }),
        ]);
        const revisionContext = await loadDepartmentUserRevisionContext(ctx, {
            actorUserId: base.authContext.userId,
            departmentId: base.department._id,
            plan,
            planSnapshots,
            submissionDeadlineAt:
                resolveDepartmentEffectiveSubmissionDeadlineAt({
                    departmentSubmissionEndsAt: base.department.submissionEndsAt,
                    sharedSubmissionEndsAt: newestSharedDeadline?.submissionEndsAt,
                }),
            tenantId: base.authContext.tenantId,
            timeZone: tenant?.timeZone ?? "Africa/Nairobi",
        });
        if (revisionContext.inconsistentStateMessage) {
            return {
                catalog,
                department: mapDepartmentDepartmentRecord(base.department),
                meta: {
                    accessMode: base.authContext.departmentAccessMode ?? null,
                    actor: "department_user" as const,
                    actorLabel: "Department User",
                    availableToolbarActions: ["exit"],
                    currentUserId: String(base.authContext.userId),
                    fiscalYear: plan.fiscalYear,
                    mode: "view" as const,
                    modeIndicatorLabel: null,
                    selectedCategoryIds: sanitizedSelection.sanitizedCategoryIds,
                    state: "blocked" as const,
                    subtitle: revisionContext.inconsistentStateMessage,
                    timeZone: tenant?.timeZone ?? "Africa/Nairobi",
                    title: "Revision feedback unavailable",
                    unavailableCategories: sanitizedSelection.unavailableCategories,
                },
                plan: null,
                redirectHref: null,
                statusMessage: revisionContext.inconsistentStateMessage,
            };
        }
        const mode = resolveDepartmentUserWorkspaceMode({
            accessMode: base.authContext.departmentAccessMode,
            requestedMode:
                plan.status === "rejected" && revisionContext.effectiveDeadlineExpired
                    ? "view"
                    : (args.requestedMode ?? null),
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
                    plan.status === "rejected" &&
                    revisionContext.effectiveDeadlineExpired
                        ? "This revision window has expired. Review the Procurement feedback here, then contact your Procurement Officer if further changes are needed."
                        : plan.status === "rejected" && revisionContext.activeDecision
                        ? "Procurement feedback is active on this plan. Review the flagged issues, update the Blockly draft, and resubmit before the effective revision deadline."
                        : mode === "edit"
                        ? "Drag categories and items into the Blockly canvas to shape your quarterly procurement plan."
                        : "This plan is open in read-only mode because it is no longer editable from this department session.",
                timeZone: tenant?.timeZone ?? "Africa/Nairobi",
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
                revisionContext: toDepartmentUserPublicRevisionContext(revisionContext),
                selectedCategoryIds: sanitizedSelection.sanitizedCategoryIds,
                submissionEmailErrorMessage: plan.submissionEmailErrorMessage ?? null,
                submissionEmailStatus: plan.submissionEmailStatus ?? null,
                submissionReference: plan.submissionReference ?? null,
                submittedAt: plan.submittedAt ?? null,
                status: plan.status,
                workspaceState: toNormalizedWorkspaceRecord(plan, base.authContext.userId),
                workspaceVersion: getPlanWorkspaceVersion(plan),
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
        expectedWorkspaceVersion: v.optional(v.number()),
        itemCount: v.number(),
        planId: v.string(),
        selectedCategoryIds: v.array(v.string()),
        workspaceState: workspaceRecordValidator,
    },
    returns: v.object({
        savedAt: v.number(),
        workspaceState: workspaceRecordValidator,
        workspaceVersion: v.number(),
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

        const currentWorkspaceVersion = getPlanWorkspaceVersion(plan);
        if (
            typeof args.expectedWorkspaceVersion !== "number" ||
            args.expectedWorkspaceVersion !== currentWorkspaceVersion
        ) {
            throw new ConvexError({
                code: "STALE_WORKSPACE_REVISION",
                message:
                    "The cloud draft changed after this browser loaded it. Refresh or recover the local draft before saving again.",
            });
        }

        if (plan.status === "rejected") {
            const tenant = await ctx.db.get(base.authContext.tenantId);
            const newestSharedDeadline = await loadNewestSharedSubmissionDeadline(ctx, {
                fiscalYear: plan.fiscalYear,
                tenantId: base.authContext.tenantId,
            });
            const revisionContext = await loadDepartmentUserRevisionContext(ctx, {
                actorUserId: base.authContext.userId,
                departmentId: base.department._id,
                plan,
                planSnapshots: [],
                submissionDeadlineAt:
                    resolveDepartmentEffectiveSubmissionDeadlineAt({
                        departmentSubmissionEndsAt: base.department.submissionEndsAt,
                        sharedSubmissionEndsAt: newestSharedDeadline?.submissionEndsAt,
                    }),
                tenantId: base.authContext.tenantId,
                timeZone: tenant?.timeZone ?? "Africa/Nairobi",
            });
            if (
                revisionContext.inconsistentStateMessage ||
                revisionContext.effectiveDeadlineExpired
            ) {
                if (revisionContext.inconsistentStateAuditEntry) {
                    await appendAuditLogBestEffort(
                        ctx,
                        revisionContext.inconsistentStateAuditEntry,
                    );
                }
                throw new ConvexError({
                    code: "VALIDATION_FAILED",
                    message:
                        revisionContext.inconsistentStateMessage ??
                        "This revision window has expired, so the plan can no longer be edited from the current Department User session.",
                });
            }
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

        const nextWorkspaceVersion = currentWorkspaceVersion + 1;
        await ctx.db.patch(plan._id, {
            ...persistenceResult.patch,
            workspaceVersion: nextWorkspaceVersion,
        });

        return {
            savedAt: persistenceResult.patch.updatedAt,
            workspaceState: persistenceResult.patch.workspaceState,
            workspaceVersion: nextWorkspaceVersion,
        };
    },
});

export const submitDepartmentUserPlan = mutation({
    args: {
        expectedDecisionDecidedAt: v.optional(v.number()),
        expectedDecisionId: v.optional(v.string()),
        expectedWorkspaceLastSavedAt: v.optional(v.number()),
        expectedWorkspaceRevision: v.optional(v.number()),
        expectedWorkspaceVersion: v.optional(v.number()),
        planId: v.string(),
    },
    returns: submitDepartmentUserPlanResultValidator,
    handler: async (ctx, args) => {
        const base = await loadDepartmentUserPlanBase(ctx);
        if (!base.department) {
            unexpectedAccessError();
        }
        const department = base.department;

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

        if (!plan || plan.tenantId !== base.authContext.tenantId || plan.departmentId !== department._id) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: "Plan not found for this department.",
            });
        }

        if (shouldReplayDepartmentUserSubmittedPlan({
            status: plan.status,
            submittedAt: plan.submittedAt ?? null,
            submissionReference: plan.submissionReference ?? null,
        })) {
            return {
                canWithdraw: typeof plan.reviewStartedAt !== "number",
                emailErrorMessage: plan.submissionEmailErrorMessage ?? null,
                emailStatus: plan.submissionEmailStatus ?? null,
                status: "submitted" as const,
                submissionReference: plan.submissionReference!,
                submittedAt: plan.submittedAt!,
            };
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
                    departmentId: department._id,
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

        const [newestSharedDeadline, tenant] = await Promise.all([
            loadNewestSharedSubmissionDeadline(ctx, {
                fiscalYear: plan.fiscalYear,
                tenantId: base.authContext.tenantId,
            }),
            ctx.db.get(base.authContext.tenantId),
        ]);
        const revisionContext =
            plan.status === "rejected"
                ? await loadDepartmentUserRevisionContext(ctx, {
                      actorUserId: base.authContext.userId,
                      departmentId: department._id,
                      plan,
                      planSnapshots,
                      submissionDeadlineAt:
                          resolveDepartmentEffectiveSubmissionDeadlineAt({
                              departmentSubmissionEndsAt: department.submissionEndsAt,
                              sharedSubmissionEndsAt: newestSharedDeadline?.submissionEndsAt,
                          }),
                      tenantId: base.authContext.tenantId,
                      timeZone: tenant?.timeZone ?? "Africa/Nairobi",
                  })
                : null;
        if (revisionContext?.inconsistentStateAuditEntry) {
            await appendAuditLogBestEffort(
                ctx,
                revisionContext.inconsistentStateAuditEntry,
            );
        }

        if (plan.status !== "draft" && plan.status !== "rejected") {
            await appendAuditLogRequired(
                ctx,
                buildDepartmentUserPlanAuditEntry({
                    action: "submit",
                    actorUserId: base.authContext.userId,
                    departmentId: department._id,
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
            buildBlockedSubmissionError(
                "Only draft plans or active revision plans can be submitted to Procurement.",
            );
        }

        if (plan.status === "rejected") {
            if (!revisionContext || revisionContext.inconsistentStateMessage) {
                await appendAuditLogRequired(
                    ctx,
                    buildDepartmentUserPlanAuditEntry({
                        action: "submit",
                        actorUserId: base.authContext.userId,
                        departmentId: department._id,
                        event: AUDIT_EVENT_NAMES.planSubmissionBlocked,
                        metadata: {
                            planStatus: plan.status,
                            reason: "revision_context_unavailable",
                        },
                        outcome: AUDIT_OUTCOMES.blockedStateTransition,
                        planId: plan._id,
                        tenantId: base.authContext.tenantId,
                    }),
                );
                buildBlockedSubmissionError(
                    revisionContext?.inconsistentStateMessage ??
                        "Revision feedback is temporarily unavailable. Refresh the workspace before trying again.",
                );
            }

            const activeDecision = revisionContext.activeDecision;
            if (
                !activeDecision ||
                !args.expectedDecisionId ||
                typeof args.expectedDecisionDecidedAt !== "number" ||
                activeDecision.id !== args.expectedDecisionId ||
                activeDecision.decidedAt !== args.expectedDecisionDecidedAt
            ) {
                await appendAuditLogRequired(
                    ctx,
                    buildDepartmentUserPlanAuditEntry({
                        action: "submit",
                        actorUserId: base.authContext.userId,
                        departmentId: department._id,
                        event: AUDIT_EVENT_NAMES.planSubmissionBlocked,
                        metadata: {
                            activeDecisionDecidedAt: activeDecision?.decidedAt ?? null,
                            activeDecisionId: activeDecision?.id ?? null,
                            expectedDecisionDecidedAt:
                                args.expectedDecisionDecidedAt ?? null,
                            expectedDecisionId: args.expectedDecisionId ?? null,
                            planStatus: plan.status,
                            reason: "stale_revision_decision",
                        },
                        outcome: AUDIT_OUTCOMES.blockedStateTransition,
                        planId: plan._id,
                        tenantId: base.authContext.tenantId,
                    }),
                );
                buildBlockedSubmissionError(
                    "Procurement feedback changed while you were editing. Refresh this plan before submitting again.",
                );
            }

            if (revisionContext.effectiveDeadlineExpired) {
                await appendAuditLogRequired(
                    ctx,
                    buildDepartmentUserPlanAuditEntry({
                        action: "submit",
                        actorUserId: base.authContext.userId,
                        departmentId: department._id,
                        event: AUDIT_EVENT_NAMES.planSubmissionBlocked,
                        metadata: {
                            effectiveRevisionDeadlineAt:
                                activeDecision.effectiveRevisionDeadlineAt ?? null,
                            planStatus: plan.status,
                            reason: "revision_deadline_expired",
                        },
                        outcome: AUDIT_OUTCOMES.blockedStateTransition,
                        planId: plan._id,
                        tenantId: base.authContext.tenantId,
                    }),
                );
                buildBlockedSubmissionError(
                    "The revision deadline for this plan has expired. Contact your Procurement Officer for guidance.",
                );
            }
        }

        const normalizedWorkspaceState = toNormalizedWorkspaceRecord(
            plan,
            base.authContext.userId,
        );
        if (
            typeof args.expectedWorkspaceVersion !== "number" ||
            args.expectedWorkspaceVersion !== getPlanWorkspaceVersion(plan)
        ) {
            await appendAuditLogRequired(
                ctx,
                buildDepartmentUserPlanAuditEntry({
                    action: "submit",
                    actorUserId: base.authContext.userId,
                    departmentId: department._id,
                    event: AUDIT_EVENT_NAMES.planSubmissionBlocked,
                    metadata: {
                        expectedWorkspaceLastSavedAt:
                            args.expectedWorkspaceLastSavedAt ?? null,
                        expectedWorkspaceRevision:
                            args.expectedWorkspaceRevision ?? null,
                        expectedWorkspaceVersion:
                            args.expectedWorkspaceVersion ?? null,
                        planStatus: plan.status,
                        reason: "stale_workspace_snapshot",
                        savedWorkspaceLastSavedAt:
                            normalizedWorkspaceState.editorMetadata.lastSavedAt,
                        savedWorkspaceRevision:
                            normalizedWorkspaceState.editorMetadata.revision,
                        savedWorkspaceVersion: getPlanWorkspaceVersion(plan),
                    },
                    outcome: AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: base.authContext.tenantId,
                }),
            );
            buildBlockedSubmissionError(
                "The cloud draft changed after this submission review was prepared. Save or refresh the workspace before submitting again.",
            );
        }
        const submissionDraftSummary = deriveDepartmentUserWorkspaceDraftPersistenceSummary({
            categories: catalog.categories.map((category) => ({
                id: category.id,
                name: category.name,
            })),
            items: catalog.items,
            totalBudget: department.budgetAllocation ?? null,
            workspaceState: normalizedWorkspaceState,
        });
        const workspaceSummary = submissionDraftSummary?.workspaceSummary ?? null;
        const [categoryRequests, itemRequests, sharedDeadlines] = await Promise.all([
            ctx.db
                .query("categoryRequests")
                .withIndex("by_planId", (q) => q.eq("planId", plan._id))
                .collect(),
            ctx.db
                .query("itemRequests")
                .withIndex("by_planId", (q) => q.eq("planId", plan._id))
                .collect(),
            ctx.db
                .query("submissionDeadlines")
                .withIndex("by_tenantId_fiscalYearKey", (q) =>
                    q
                        .eq("tenantId", base.authContext.tenantId)
                        .eq("fiscalYearKey", plan.fiscalYear),
                )
                .collect(),
        ]);
        const pendingCategoryRequests = categoryRequests.filter(
            (request) =>
                request.tenantId === base.authContext.tenantId &&
                request.departmentId === department._id &&
                request.fiscalYear === plan.fiscalYear &&
                request.status === "pending",
        );
        const pendingItemRequests = itemRequests.filter(
            (request) =>
                request.tenantId === base.authContext.tenantId &&
                request.departmentId === department._id &&
                request.fiscalYear === plan.fiscalYear &&
                request.status === "pending",
        );
        const pendingLinkedCategoryIds = new Set(
            pendingItemRequests
                .map((request) => request.linkedCategoryRequestId ?? null)
                .filter((requestId): requestId is Id<"categoryRequests"> =>
                    Boolean(requestId),
                )
                .map((requestId) => String(requestId)),
        );
        const countedPendingCategoryRequestIds = new Set(
            pendingCategoryRequests.map((request) => String(request._id)),
        );
        const pendingLinkedCategoryHandoffCount = Array.from(
            pendingLinkedCategoryIds,
        ).filter((requestId) => !countedPendingCategoryRequestIds.has(requestId)).length;
        const pendingRequestValidation = summarizePendingCatalogRequestBlockers({
            pendingCategoryRequestCount: pendingCategoryRequests.length,
            pendingItemRequestCount: pendingItemRequests.length,
            pendingLinkedCategoryHandoffCount,
        });
        const resolvedSharedDeadline =
            sharedDeadlines
                .filter((deadline) => deadline.tenantId === base.authContext.tenantId)
                .sort(
                    (left, right) =>
                        right.deadlineVersion - left.deadlineVersion ||
                        right.updatedAt - left.updatedAt,
                )[0] ?? null;
        const deadlineIssue = evaluateSubmissionDeadlineIssue({
            now: Date.now(),
            window: resolveEffectiveSubmissionWindow({
                departmentSubmissionEndsAt: department.submissionEndsAt ?? null,
                departmentSubmissionStartsAt:
                    department.submissionStartsAt ?? null,
                sharedDeadline: resolvedSharedDeadline
                    ? {
                          deadlineVersion: resolvedSharedDeadline.deadlineVersion,
                          submissionEndsAt: resolvedSharedDeadline.submissionEndsAt,
                          submissionStartsAt: resolvedSharedDeadline.submissionStartsAt,
                          timeZone: resolvedSharedDeadline.timeZone,
                          updatedAt: resolvedSharedDeadline.updatedAt,
                      }
                    : null,
            }),
        });
        const revisionIssues =
            revisionContext?.activeDecision
                ? mapDepartmentUserFlaggedTargetsToIssues({
                      flaggedTargets: revisionContext.activeDecision.flaggedTargets,
                      workspaceSummary,
                  })
                : [];
        const supplementalIssues = [
            pendingRequestValidation.issue,
            deadlineIssue,
            ...revisionIssues,
        ].filter(
            (issue): issue is NonNullable<typeof issue> => Boolean(issue),
        );
        const supplementalBlockerMessages = supplementalIssues.map(
            (issue) => issue.message,
        );
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
            supplementalBlockerMessages,
            totalItemCount:
                submissionDraftSummary?.itemCount ?? workspaceSummary?.totalItemCount ?? plan.itemCount,
            validationState: workspaceSummary?.validationState ?? null,
        });

        if (submitState.disabled) {
            const issueCodes = [
                ...(workspaceSummary?.validationState.issues
                    .filter((issue) => issue.blocksSubmission)
                    .map((issue) => issue.code) ?? []),
                ...supplementalIssues.map((issue) => issue.code),
            ];
            const primaryMessage = getPrimaryBlockedSubmissionMessage({
                fallback: submitState.reason,
                issues: [
                    ...(workspaceSummary?.validationState.issues ?? []),
                    ...supplementalIssues,
                ],
            });
            await appendAuditLogRequired(
                ctx,
                buildDepartmentUserPlanAuditEntry({
                    action: "submit",
                    actorUserId: base.authContext.userId,
                    departmentId: department._id,
                    event: AUDIT_EVENT_NAMES.planSubmissionBlocked,
                    metadata: {
                        issueCodes,
                        planStatus: plan.status,
                        primaryMessage,
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
                    departmentId: department._id,
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
            departmentCode: department.code,
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
            approvedAt: undefined,
            departmentCodeSnapshot: department.code,
            departmentNameSnapshot: department.name,
            categorySummaries: persistedCategorySummaries,
            estimatedBudgetUsed: submissionPersistence.estimatedBudgetUsed,
            itemCount: submissionPersistence.itemCount,
            rejectedAt: undefined,
            rejectionComment: undefined,
            reviewStartedAt: undefined,
            reviewStartedByTenantUserId: undefined,
            reviewStartedByUserId: undefined,
            selectedCategoryIds: persistedSelectedCategoryIds,
            submissionEmailErrorMessage: undefined,
            submissionEmailStatus: undefined,
            submissionReference,
            submissionSequence: nextSubmissionSequence,
            status: "submitted",
            submittedAt: now,
            updatedAt: now,
        });

        if (plan.status === "rejected" && revisionContext?.activeDecision) {
            const activeDecisionId = ctx.db.normalizeId(
                "planReviewDecisions",
                revisionContext.activeDecision.id,
            );
            if (activeDecisionId) {
                await ctx.db.patch(activeDecisionId, {
                    lifecycleStatus: "superseded",
                    supersededAt: now,
                });
            }
        }

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
            departmentCodeSnapshot: department.code,
            departmentId: plan.departmentId,
            departmentNameSnapshot: department.name,
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
                departmentId: department._id,
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
                        departmentName: department.name,
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
                    departmentId: department._id,
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
