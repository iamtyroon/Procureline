import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import {
    createPersistedBlocklyWorkspaceRecord,
    normalizeBlocklyWorkspaceRecord,
} from "../../lib/blockly/blockly-serialization";
import { formatDepartmentBudget } from "../../lib/procurement-officer/departments";
import { formatDeadlineDateTime, resolveDeadlineTimeZone } from "../../lib/procurement-officer/deadlines";
import {
    buildProcurementOfficerDecisionSummary,
    buildProcurementOfficerDecisionNotificationIdempotencyKey,
    getProcurementOfficerPlanDecisionStatusLabel,
    getProcurementOfficerUndoApprovalEligibility,
    normalizeProcurementOfficerDecisionComment,
    normalizeProcurementOfficerFlaggedTargets,
    validateProcurementOfficerRevisionDeadline,
    type ProcurementOfficerPlanDecisionType,
} from "../../lib/procurement-officer/review-decision";
import {
    buildProcurementOfficerReviewSnapshotSequenceKey,
    derivePreviousFiscalYearKey,
    normalizeProcurementOfficerReviewBudgetAdjustment,
    normalizeProcurementOfficerReviewComment,
    prepareProcurementOfficerPlanReviewStart,
    PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
    resolveProcurementOfficerReviewDepartmentContext,
    resolveProcurementOfficerReviewTargetState,
    shouldStartProcurementOfficerReviewTracking,
    selectPreviousSubmissionBaseline,
    selectPriorFiscalYearBaseline,
    type ProcurementOfficerReviewPlanLike,
    type ProcurementOfficerReviewSnapshotLike,
} from "../../lib/procurement-officer/review";
import { getProcurementOfficerSubmissionStatusLabel } from "../../lib/procurement-officer/submissions";
import {
    loadTenantCatalog,
    mapDepartmentDepartmentRecord,
} from "./plans";
import { appendAuditLogRequired } from "./_audit";
import { requireTenantRole } from "./_roleGuard";
import {
    AUDIT_EVENT_NAMES,
    AUDIT_OUTCOMES,
    createAuthenticatedAuditActor,
} from "../../lib/security/audit";

function readAuthUserSummary(
    userDocument: unknown,
    fallbackName: string,
): { email: string; initials: string; name: string } {
    const record =
        userDocument && typeof userDocument === "object" && !Array.isArray(userDocument)
            ? (userDocument as Record<string, unknown>)
            : {};
    const email =
        typeof record.email === "string" && record.email.trim().length > 0
            ? record.email.trim()
            : "No email available";
    const name =
        typeof record.name === "string" && record.name.trim().length > 0
            ? record.name.trim()
            : email !== "No email available"
              ? email.split("@")[0] || fallbackName
              : fallbackName;

    return {
        email,
        initials: name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0))
            .join("")
            .toUpperCase(),
        name,
    };
}

type DataCtx = MutationCtx | QueryCtx;

const reviewDecisionTypeValidator = v.union(
    v.literal("rejected"),
    v.literal("revision_requested"),
);

const reviewFlaggedTargetInputValidator = v.object({
    id: v.string(),
    label: v.string(),
    type: v.union(v.literal("category"), v.literal("item")),
});

function toPersistedPlanSummary(plan: Doc<"plans">) {
    return {
        categorySummaries: plan.categorySummaries.map((summary: Doc<"plans">["categorySummaries"][number]) => ({
            amount: summary.amount,
            categoryId: String(summary.categoryId),
            categoryName: summary.categoryName,
            itemCount: summary.itemCount,
        })),
        estimatedBudgetUsed: plan.estimatedBudgetUsed,
        itemCount: plan.itemCount,
    };
}

function toReviewPlanLike(plan: Doc<"plans">): ProcurementOfficerReviewPlanLike {
    return {
        fiscalYear: plan.fiscalYear,
        submissionSequence: plan.submissionSequence ?? null,
        submittedAt: plan.submittedAt ?? null,
        summary: toPersistedPlanSummary(plan),
        updatedAt: plan.updatedAt,
        workspaceState: plan.workspaceState
            ? normalizeBlocklyWorkspaceRecord(plan.workspaceState, {
                  lastSavedAt: plan.updatedAt,
                  lastSavedByUserId:
                      plan.reviewStartedByUserId
                          ? String(plan.reviewStartedByUserId)
                          : "procurement-officer-review",
              })
            : null,
    };
}

function toReviewSnapshotLike(
    snapshot: Doc<"planSubmissionSnapshots">,
): ProcurementOfficerReviewSnapshotLike {
    return {
        capturedAt: snapshot.capturedAt,
        fiscalYear: snapshot.fiscalYear,
        lifecycleStatus: snapshot.lifecycleStatus ?? null,
        planId: String(snapshot.planId),
        submissionSequence: snapshot.submissionSequence ?? null,
        submittedAt: snapshot.submittedAt ?? null,
        summary: {
            categorySummaries: snapshot.categorySummaries,
            estimatedBudgetUsed: snapshot.estimatedBudgetUsed,
            itemCount: snapshot.itemCount,
        },
        workspaceState: snapshot.workspaceState
            ? normalizeBlocklyWorkspaceRecord(snapshot.workspaceState, {
                  lastSavedAt: snapshot.capturedAt,
                  lastSavedByUserId: String(snapshot.capturedByUserId),
              })
            : null,
    };
}

async function loadProcurementOfficerTenantUser(
    ctx: DataCtx,
    authContext: Awaited<ReturnType<typeof requireTenantRole>>,
) {
    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) =>
            q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId),
        )
        .first();

    if (!tenantUser || !tenantUser.isActive || tenantUser.role !== "procurement_officer") {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for plan review.",
        });
    }

    return tenantUser;
}

function buildRedirectResult(message: string) {
    return {
        comments: [],
        message,
        state: "redirect" as const,
        workspace: null,
    };
}

function getReviewablePlanStatus(
    status: Doc<"plans">["status"],
): "approved" | "rejected" | "submitted" {
    if (status === "draft") {
        throw new ConvexError({
            code: "PLAN_NOT_FOUND",
            message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
        });
    }

    return status;
}

function assertPlanIsPendingReview(plan: Doc<"plans">): void {
    if (!shouldStartProcurementOfficerReviewTracking(plan.status)) {
        throw new ConvexError({
            code: "VALIDATION_FAILED",
            message: "Only submitted plans can be reviewed from this workspace.",
        });
    }
}

function buildPlanReviewAuditEntry(args: {
    action: "approve" | "reject" | "request_revision" | "undo_approval";
    actorUserId: Id<"users">;
    departmentId: Id<"departments">;
    event:
        | typeof AUDIT_EVENT_NAMES.planReviewApproved
        | typeof AUDIT_EVENT_NAMES.planReviewApprovalUndone
        | typeof AUDIT_EVENT_NAMES.planReviewRejected
        | typeof AUDIT_EVENT_NAMES.planReviewRevisionRequested;
    metadata: Record<string, unknown>;
    outcome: typeof AUDIT_OUTCOMES.allowed | typeof AUDIT_OUTCOMES.blockedStateTransition;
    planId: Id<"plans">;
    tenantId: Id<"tenants">;
}) {
    return {
        action: args.action,
        actor: createAuthenticatedAuditActor({
            role: "procurement_officer",
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

async function getLatestActivePlanReviewDecision(
    ctx: DataCtx,
    planId: Id<"plans">,
) {
    return ctx.db
        .query("planReviewDecisions")
        .withIndex("by_planId_lifecycleStatus_decidedAt", (q) =>
            q.eq("planId", planId).eq("lifecycleStatus", "active"),
        )
        .order("desc")
        .first();
}

async function supersedeActivePlanReviewDecisions(
    ctx: MutationCtx,
    planId: Id<"plans">,
    supersededAt: number,
) {
    const activeDecisions = await ctx.db
        .query("planReviewDecisions")
        .withIndex("by_planId_lifecycleStatus_decidedAt", (q) =>
            q.eq("planId", planId).eq("lifecycleStatus", "active"),
        )
        .collect();

    await Promise.all(
        activeDecisions.map((decision) =>
            ctx.db.patch(decision._id, {
                lifecycleStatus: "superseded",
                supersededAt,
            }),
        ),
    );
}

function mapPlanReviewDecision(
    decision: Doc<"planReviewDecisions"> | null,
    timeZone: string,
) {
    if (!decision) {
        return null;
    }

    return {
        comment: decision.comment,
        decidedAt: decision.decidedAt,
        decidedAtLabel: formatDeadlineDateTime(decision.decidedAt, timeZone),
        decisionType: decision.decisionType,
        flaggedTargets: decision.flaggedTargets,
        id: String(decision._id),
        notificationErrorMessage: decision.notificationErrorMessage ?? null,
        notificationQueuedAt: decision.notificationQueuedAt ?? null,
        notificationStatus: decision.notificationStatus ?? null,
        revisionDeadlineAt: decision.revisionDeadlineAt ?? null,
        revisionDeadlineLabel:
            typeof decision.revisionDeadlineAt === "number"
                ? formatDeadlineDateTime(decision.revisionDeadlineAt, timeZone)
                : null,
        statusLabel: getProcurementOfficerPlanDecisionStatusLabel(decision.decisionType),
    };
}

function getReviewableSelectionIds(plan: Doc<"plans">): string[] {
    const selectionIds = new Set<string>();

    for (const category of plan.categorySummaries) {
        const categoryId = String(category.categoryId);
        selectionIds.add(`category:${categoryId}`);
    }

    const workspaceBlocks =
        plan.workspaceState &&
        typeof plan.workspaceState === "object" &&
        "workspaceJson" in plan.workspaceState
            ? (plan.workspaceState.workspaceJson.blocks?.blocks ?? [])
            : [];

    const stack: Array<{ block: any; categoryId: string | null }> = Array.isArray(workspaceBlocks)
        ? workspaceBlocks.map((block) => ({ block, categoryId: null }))
        : [];
    while (stack.length > 0) {
        const currentEntry = stack.pop();
        const block = currentEntry?.block;
        if (!block || typeof block !== "object") {
            continue;
        }

        const currentCategoryId =
            typeof block.fields?.CATEGORY_ID === "string" &&
            block.fields.CATEGORY_ID.trim().length > 0
                ? block.fields.CATEGORY_ID.trim()
                : currentEntry.categoryId ?? null;

        if (block.type === "item_block") {
            const fields = block.fields ?? {};
            const itemId =
                typeof fields.ITEM_ID === "string" && fields.ITEM_ID.trim().length > 0
                    ? fields.ITEM_ID.trim()
                    : "";
            if (itemId.length > 0 && currentCategoryId) {
                selectionIds.add(`item:${currentCategoryId}:${itemId}`);
            }
        }

        for (const value of Object.values(block.inputs ?? {})) {
            if (value && typeof value === "object" && "block" in value) {
                stack.push({
                    block: (value as any).block,
                    categoryId: currentCategoryId,
                });
            }
        }
        if (block.next?.block) {
            stack.push({
                block: block.next.block,
                categoryId: currentCategoryId,
            });
        }
    }

    return [...selectionIds];
}

export const getProcurementOfficerPlanReviewWorkspace = query({
    args: {
        planId: v.string(),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);

        if (!normalizedPlanId) {
            return buildRedirectResult(
                PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            );
        }

        const [tenant, plan, tenantUser, authUser] = await Promise.all([
            ctx.db.get(authContext.tenantId),
            ctx.db.get(normalizedPlanId),
            loadProcurementOfficerTenantUser(ctx, authContext),
            ctx.db.get(authContext.userId),
        ]);

        if (!tenant) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }

        const targetState = resolveProcurementOfficerReviewTargetState({
            planExists: Boolean(plan),
            planStatus: plan?.status ?? null,
            requestPlanIdIsValid: true,
            tenantMatches: plan?.tenantId === authContext.tenantId,
        });
        if (targetState.state === "redirect") {
            return buildRedirectResult(
                targetState.message ?? PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            );
        }
        if (!plan) {
            return buildRedirectResult(
                PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            );
        }
        const reviewPlan = plan;

        const [
            catalog,
            department,
            comments,
            planSnapshots,
            departmentPlans,
            pendingRedraftRequest,
            activeDecision,
        ] = await Promise.all([
            loadTenantCatalog(ctx, authContext.tenantId),
            ctx.db.get(reviewPlan.departmentId),
            ctx.db
                .query("planReviewComments")
                .withIndex("by_planId_createdAt", (q) => q.eq("planId", reviewPlan._id))
                .collect(),
            ctx.db
                .query("planSubmissionSnapshots")
                .withIndex("by_planId_submittedAt", (q) => q.eq("planId", reviewPlan._id))
                .collect(),
            ctx.db
                .query("plans")
                .withIndex("by_departmentId", (q) => q.eq("departmentId", reviewPlan.departmentId))
                .collect(),
            ctx.db
                .query("planRedraftRequests")
                .withIndex("by_planId_status", (q) =>
                    q.eq("planId", reviewPlan._id).eq("status", "pending"),
                )
                .first(),
            getLatestActivePlanReviewDecision(ctx, reviewPlan._id),
        ]);
        const previousFiscalYear = derivePreviousFiscalYearKey(reviewPlan.fiscalYear);
        const priorFiscalYearSnapshots =
            previousFiscalYear
                ? await ctx.db
                      .query("planSubmissionSnapshots")
                      .withIndex("by_tenantId_departmentId_fiscalYear_capturedAt", (q) =>
                          q.eq("tenantId", authContext.tenantId)
                              .eq("departmentId", reviewPlan.departmentId)
                              .eq("fiscalYear", previousFiscalYear),
                      )
                      .collect()
                : [];

        const departmentContext = resolveProcurementOfficerReviewDepartmentContext({
            joinedDepartmentCode: department?.code ?? null,
            joinedDepartmentIsActive: department?.isActive ?? null,
            joinedDepartmentName: department?.name ?? null,
            planDepartmentCodeSnapshot: reviewPlan.departmentCodeSnapshot ?? null,
            planDepartmentNameSnapshot: reviewPlan.departmentNameSnapshot ?? null,
        });
        const planLike = toReviewPlanLike(reviewPlan);
        const reviewSnapshots = planSnapshots.map(toReviewSnapshotLike);
        const previousSubmissionBaseline = selectPreviousSubmissionBaseline({
            currentSubmissionSequence: reviewPlan.submissionSequence ?? null,
            currentSubmittedAt: reviewPlan.submittedAt ?? null,
            snapshots: reviewSnapshots,
        });
        const previousFiscalYearBaseline = selectPriorFiscalYearBaseline({
            currentFiscalYear: reviewPlan.fiscalYear,
            priorFiscalYearPlans: departmentPlans
                .filter((candidate) => candidate.status !== "draft" && candidate._id !== reviewPlan._id)
                .map(toReviewPlanLike),
            priorFiscalYearSnapshots: priorFiscalYearSnapshots.map(toReviewSnapshotLike),
        });
        const reviewStartedBy =
            reviewPlan.reviewStartedByUserId
                ? await ctx.db.get(reviewPlan.reviewStartedByUserId)
                : null;
        const currentUser = readAuthUserSummary(authUser, "Procurement Officer");
        const reviewStartedByUser = reviewStartedBy
            ? readAuthUserSummary(reviewStartedBy, "Procurement Officer")
            : null;
        const resolvedTimeZone = resolveDeadlineTimeZone({
            tenantTimeZone: tenant.timeZone,
        }).timeZone;
        const latestDecision = mapPlanReviewDecision(activeDecision, resolvedTimeZone);
        const undoApproval = getProcurementOfficerUndoApprovalEligibility({
            approvedAt: reviewPlan.approvedAt ?? null,
            consolidatedAt: reviewPlan.consolidatedAt ?? null,
            now: Date.now(),
            status: reviewPlan.status,
        });
        const planStatusLabel =
            reviewPlan.status === "rejected" && activeDecision
                ? getProcurementOfficerPlanDecisionStatusLabel(activeDecision.decisionType)
                : getProcurementOfficerSubmissionStatusLabel(
                      getReviewablePlanStatus(reviewPlan.status),
                  );

        return {
            comments: comments.map((comment) => ({
                authorName: comment.authorNameSnapshot,
                body: comment.body,
                createdAt: comment.createdAt,
                id: String(comment._id),
            })),
            message: null,
            state: "ready" as const,
            workspace: {
                baselines: {
                    previousFiscalYear: previousFiscalYearBaseline,
                    previousSubmission: previousSubmissionBaseline,
                },
                catalog,
                department: department
                    ? {
                          ...mapDepartmentDepartmentRecord(department),
                          code: departmentContext.code ?? "--",
                          name: departmentContext.name,
                          voteNumber: department.voteNumber ?? department.code,
                      }
                    : {
                          budgetAllocation: null,
                          code: departmentContext.code ?? "--",
                          id: String(reviewPlan.departmentId),
                          name: departmentContext.name,
                          voteNumber: departmentContext.code ?? "--",
                      },
                meta: {
                    currentUser,
                    currentUserId: String(authContext.userId),
                    fiscalYear: reviewPlan.fiscalYear,
                    latestDecision,
                    reviewStartedAt: reviewPlan.reviewStartedAt ?? null,
                    reviewStartedBy: reviewStartedByUser,
                    reviewerTenantUserId: String(tenantUser._id),
                    submittedAt: reviewPlan.submittedAt ?? null,
                    submittedAtLabel:
                        typeof reviewPlan.submittedAt === "number"
                            ? formatDeadlineDateTime(reviewPlan.submittedAt, resolvedTimeZone)
                            : "Not submitted",
                    tenantTimeZone: resolvedTimeZone,
                },
                plan: {
                    categorySummaries: planLike.summary.categorySummaries,
                    departmentCodeSnapshot: reviewPlan.departmentCodeSnapshot ?? null,
                    departmentNameSnapshot: reviewPlan.departmentNameSnapshot ?? null,
                    estimatedBudgetUsed: reviewPlan.estimatedBudgetUsed,
                    id: String(reviewPlan._id),
                    itemCount: reviewPlan.itemCount,
                    selectedCategoryIds: reviewPlan.selectedCategoryIds.map((categoryId: Doc<"plans">["selectedCategoryIds"][number]) =>
                        String(categoryId),
                    ),
                    status: reviewPlan.status,
                    statusLabel: planStatusLabel,
                    submittedAt: reviewPlan.submittedAt ?? null,
                    totalAmountLabel: formatDepartmentBudget(reviewPlan.estimatedBudgetUsed),
                    undoApproval,
                    workspaceState: planLike.workspaceState,
                },
                redraftRequest: pendingRedraftRequest
                    ? {
                          id: String(pendingRedraftRequest._id),
                          reason: pendingRedraftRequest.reason,
                          requestedAt: pendingRedraftRequest.createdAt,
                          status: pendingRedraftRequest.status,
                      }
                    : null,
            },
        };
    },
});

export const startProcurementOfficerPlanReview = mutation({
    args: {
        planId: v.string(),
    },
    returns: v.object({
        reviewStartedAt: v.union(v.number(), v.null()),
        snapshotCaptured: v.boolean(),
    }),
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!normalizedPlanId) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }

        const [plan, tenantUser] = await Promise.all([
            ctx.db.get(normalizedPlanId),
            loadProcurementOfficerTenantUser(ctx, authContext),
        ]);
        const targetState = resolveProcurementOfficerReviewTargetState({
            planExists: Boolean(plan),
            planStatus: plan?.status ?? null,
            requestPlanIdIsValid: true,
            tenantMatches: plan?.tenantId === authContext.tenantId,
        });
        if (targetState.state === "redirect") {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message:
                    targetState.message ?? PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        if (!plan) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        const reviewPlan = plan;
        assertPlanIsPendingReview(reviewPlan);

        const department = await ctx.db.get(reviewPlan.departmentId);
        const now = Date.now();
        const submissionSequenceKey = buildProcurementOfficerReviewSnapshotSequenceKey({
            planId: String(reviewPlan._id),
            submissionSequence: reviewPlan.submissionSequence ?? null,
            submittedAt: reviewPlan.submittedAt ?? null,
            tenantId: String(authContext.tenantId),
        });
        const existingSnapshot = await ctx.db
            .query("planSubmissionSnapshots")
            .withIndex("by_submissionSequenceKey", (q) =>
                q.eq("submissionSequenceKey", submissionSequenceKey),
            )
            .first();
        const reviewStart = prepareProcurementOfficerPlanReviewStart({
            currentDepartmentCode: department?.code ?? null,
            currentDepartmentName: department?.name ?? null,
            existingDepartmentCodeSnapshot: reviewPlan.departmentCodeSnapshot ?? null,
            existingDepartmentNameSnapshot: reviewPlan.departmentNameSnapshot ?? null,
            existingReviewStartedAt: reviewPlan.reviewStartedAt ?? null,
            existingReviewStartedByTenantUserId: reviewPlan.reviewStartedByTenantUserId
                ? String(reviewPlan.reviewStartedByTenantUserId)
                : null,
            existingReviewStartedByUserId: reviewPlan.reviewStartedByUserId
                ? String(reviewPlan.reviewStartedByUserId)
                : null,
            now,
            planId: String(reviewPlan._id),
            reviewerTenantUserId: String(tenantUser._id),
            reviewerUserId: String(authContext.userId),
            snapshotAlreadyExists: existingSnapshot !== null,
            submissionSequence: reviewPlan.submissionSequence ?? null,
            submittedAt: reviewPlan.submittedAt ?? null,
            tenantId: String(authContext.tenantId),
        });
        const planPatch: Partial<Doc<"plans">> = {};
        if (typeof reviewStart.planPatch.reviewStartedAt === "number") {
            planPatch.reviewStartedAt = reviewStart.planPatch.reviewStartedAt;
        }
        if (reviewStart.planPatch.reviewStartedByUserId) {
            planPatch.reviewStartedByUserId = authContext.userId;
        }
        if (reviewStart.planPatch.reviewStartedByTenantUserId) {
            planPatch.reviewStartedByTenantUserId = tenantUser._id;
        }
        if (typeof reviewStart.planPatch.departmentNameSnapshot === "string") {
            planPatch.departmentNameSnapshot = reviewStart.planPatch.departmentNameSnapshot;
        }
        if (typeof reviewStart.planPatch.departmentCodeSnapshot === "string") {
            planPatch.departmentCodeSnapshot = reviewStart.planPatch.departmentCodeSnapshot;
        }

        if (Object.keys(planPatch).length > 0) {
            await ctx.db.patch(reviewPlan._id, planPatch);
        }

        if (reviewStart.shouldCaptureSnapshot) {
            await ctx.db.insert("planSubmissionSnapshots", {
                capturedAt: now,
                capturedByTenantUserId: tenantUser._id,
                capturedByUserId: authContext.userId,
                categorySummaries: reviewPlan.categorySummaries.map((summary: Doc<"plans">["categorySummaries"][number]) => ({
                    amount: summary.amount,
                    categoryId: String(summary.categoryId),
                    categoryName: summary.categoryName,
                    itemCount: summary.itemCount,
                })),
                departmentCodeSnapshot:
                    reviewStart.departmentCodeSnapshot ?? undefined,
                departmentId: reviewPlan.departmentId,
                departmentNameSnapshot:
                    reviewStart.departmentNameSnapshot ?? undefined,
                estimatedBudgetUsed: reviewPlan.estimatedBudgetUsed,
                fiscalYear: reviewPlan.fiscalYear,
                itemCount: reviewPlan.itemCount,
                lifecycleStatus: "active",
                planId: reviewPlan._id,
                selectedCategoryIds: reviewPlan.selectedCategoryIds.map((categoryId: Doc<"plans">["selectedCategoryIds"][number]) =>
                    String(categoryId),
                ),
                submissionReference: reviewPlan.submissionReference ?? undefined,
                submissionSequence: reviewPlan.submissionSequence ?? undefined,
                submissionSequenceKey,
                submittedAt: reviewPlan.submittedAt ?? null,
                tenantId: reviewPlan.tenantId,
                workspaceState: reviewPlan.workspaceState
                    ? createPersistedBlocklyWorkspaceRecord(
                          normalizeBlocklyWorkspaceRecord(reviewPlan.workspaceState, {
                              lastSavedAt: reviewPlan.updatedAt,
                              lastSavedByUserId: String(authContext.userId),
                          }),
                      )
                    : undefined,
            });
        }

        return {
            reviewStartedAt: reviewStart.reviewStartedAt,
            snapshotCaptured: reviewStart.shouldCaptureSnapshot,
        };
    },
});

export const addProcurementOfficerPlanReviewComment = mutation({
    args: {
        body: v.string(),
        planId: v.string(),
    },
    returns: v.object({
        commentId: v.string(),
        createdAt: v.number(),
    }),
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!normalizedPlanId) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }

        const [plan, tenantUser, authUser] = await Promise.all([
            ctx.db.get(normalizedPlanId),
            loadProcurementOfficerTenantUser(ctx, authContext),
            ctx.db.get(authContext.userId),
        ]);
        const targetState = resolveProcurementOfficerReviewTargetState({
            planExists: Boolean(plan),
            planStatus: plan?.status ?? null,
            requestPlanIdIsValid: true,
            tenantMatches: plan?.tenantId === authContext.tenantId,
        });
        if (targetState.state === "redirect") {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message:
                    targetState.message ?? PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        if (!plan) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        const reviewPlan = plan;

        const normalizedComment = normalizeProcurementOfficerReviewComment(args.body);
        if (!normalizedComment.ok || !normalizedComment.value) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    normalizedComment.message ??
                    "Internal comments cannot be blank.",
            });
        }

        const createdAt = Date.now();
        const commentId = await ctx.db.insert("planReviewComments", {
            authorNameSnapshot: readAuthUserSummary(authUser, "Procurement Officer").name,
            authorTenantUserId: tenantUser._id,
            authorUserId: authContext.userId,
            body: normalizedComment.value,
            createdAt,
            planId: reviewPlan._id,
            tenantId: authContext.tenantId,
        });

        return {
            commentId: String(commentId),
            createdAt,
        };
    },
});

async function resolveDepartmentUserNotificationEmail(
    ctx: MutationCtx,
    args: {
        departmentId: Id<"departments">;
        tenantId: Id<"tenants">;
    },
) {
    const profiles = await ctx.db
        .query("departmentUserProfiles")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .collect();
    const profile = profiles.find(
        (candidate) =>
            candidate.departmentId === args.departmentId && candidate.isActive,
    );
    if (!profile) {
        return null;
    }

    const tenantUser = await ctx.db.get(profile.tenantUserId);
    if (!tenantUser?.isActive || tenantUser.role !== "department_user") {
        return null;
    }

    const authUser = await ctx.db.get(tenantUser.userId);
    const email =
        typeof authUser?.email === "string" ? authUser.email.trim().toLowerCase() : "";
    return email.length > 0 ? email : null;
}

async function queuePlanReviewDecisionNotification(
    ctx: MutationCtx,
    args: {
        comment: string;
        decisionId: Id<"planReviewDecisions">;
        decidedAt: number;
        decisionType: ProcurementOfficerPlanDecisionType;
        departmentName: string;
        flaggedTargets: ReadonlyArray<{
            categoryId: string;
            id: string;
            itemId: string | null;
            label: string;
            type: "category" | "item";
        }>;
        fiscalYear: string;
        planId: Id<"plans">;
        recipientEmail: string | null;
        revisionDeadlineAt: number | null;
        tenantId: Id<"tenants">;
        tenantName: string;
        timeZone: string;
    },
) {
    if (!args.recipientEmail) {
        await ctx.db.patch(args.decisionId, {
            notificationErrorCode: "RECIPIENT_UNAVAILABLE",
            notificationErrorMessage:
                "Decision saved but no Department User email is available for notification.",
            notificationStatus: "failed",
        });
        return {
            idempotencyKey: null,
            notificationStatus: "failed" as const,
        };
    }

    const idempotencyKey = buildProcurementOfficerDecisionNotificationIdempotencyKey({
        decisionId: String(args.decisionId),
        decisionType: args.decisionType,
        planId: String(args.planId),
        recipientEmail: args.recipientEmail,
        tenantId: String(args.tenantId),
    });
    const nextStepHref =
        args.decisionType === "approved"
            ? `/du/plans/${String(args.planId)}?mode=view`
            : `/du/plans/${String(args.planId)}?mode=edit`;
    const nextStepLabel =
        args.decisionType === "approved"
            ? "View approved plan"
            : "Review comments and update the plan";
    await ctx.scheduler.runAfter(0, "actions/email:queueTransactionalEmail" as any, {
        idempotencyKey,
        subject: `${args.tenantName} plan ${getProcurementOfficerPlanDecisionStatusLabel(args.decisionType).toLowerCase()}`,
        template: "generic-notification",
        templateProps: {
            actionHref: nextStepHref,
            comment: args.comment,
            departmentName: args.departmentName,
            fiscalYear: args.fiscalYear,
            flaggedTargets: args.flaggedTargets.map((target) => ({
                id: target.id,
                label: target.label,
                type: target.type,
            })),
            nextStepHref,
            nextStepLabel,
            planId: String(args.planId),
            revisionDeadlineAt: args.revisionDeadlineAt,
            revisionDeadlineLabel:
                typeof args.revisionDeadlineAt === "number"
                    ? formatDeadlineDateTime(args.revisionDeadlineAt, args.timeZone)
                    : null,
            summary: buildProcurementOfficerDecisionSummary(
                {
                    comment: args.comment,
                    decidedAt: args.decidedAt,
                    decisionType: args.decisionType,
                    flaggedTargets: [...args.flaggedTargets],
                    revisionDeadlineAt: args.revisionDeadlineAt,
                },
                args.timeZone,
            ),
            status: getProcurementOfficerPlanDecisionStatusLabel(args.decisionType),
            tenantName: args.tenantName,
        },
        to: args.recipientEmail,
    });
    const queuedAt = Date.now();
    await ctx.db.patch(args.decisionId, {
        notificationIdempotencyKey: idempotencyKey,
        notificationQueuedAt: queuedAt,
        notificationStatus: "queued",
    });
    return {
        idempotencyKey,
        notificationStatus: "queued" as const,
    };
}

export const rejectProcurementOfficerPlanReview = mutation({
    args: {
        body: v.string(),
        decisionType: reviewDecisionTypeValidator,
        flaggedTargets: v.optional(v.array(reviewFlaggedTargetInputValidator)),
        nextDepartmentBudgetAllocation: v.optional(v.union(v.number(), v.null())),
        planId: v.string(),
        revisionDeadlineInput: v.optional(v.string()),
    },
    returns: v.object({
        departmentBudgetChanged: v.boolean(),
        notificationStatus: v.union(v.literal("failed"), v.literal("queued")),
        rejectedAt: v.number(),
        status: v.union(v.literal("rejected"), v.literal("revision_requested")),
        statusLabel: v.string(),
    }),
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!normalizedPlanId) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }

        const [plan, tenantUser, authUser, tenant] = await Promise.all([
            ctx.db.get(normalizedPlanId),
            loadProcurementOfficerTenantUser(ctx, authContext),
            ctx.db.get(authContext.userId),
            ctx.db.get(authContext.tenantId),
        ]);
        if (!tenant || !plan || plan.tenantId !== authContext.tenantId) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        if (plan.status !== "submitted") {
            await appendAuditLogRequired(
                ctx,
                buildPlanReviewAuditEntry({
                    action:
                        args.decisionType === "revision_requested"
                            ? "request_revision"
                            : "reject",
                    actorUserId: authContext.userId,
                    departmentId: plan.departmentId,
                    event:
                        args.decisionType === "revision_requested"
                            ? AUDIT_EVENT_NAMES.planReviewRevisionRequested
                            : AUDIT_EVENT_NAMES.planReviewRejected,
                    metadata: {
                        attemptedDecisionType: args.decisionType,
                        nextStatus: plan.status,
                        previousStatus: plan.status,
                        reason: "Only submitted plans can be rejected or sent back for revision.",
                    },
                    outcome: AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: authContext.tenantId,
                }),
            );
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: "Only submitted plans can be rejected or sent back for revision.",
            });
        }

        const normalizedComment = normalizeProcurementOfficerDecisionComment(args.body);
        if (!normalizedComment.ok || !normalizedComment.value) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    normalizedComment.message ?? "Decision comments cannot be blank.",
            });
        }

        const normalizedBudget = normalizeProcurementOfficerReviewBudgetAdjustment(
            args.nextDepartmentBudgetAllocation ?? null,
        );
        if (!normalizedBudget.ok) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    normalizedBudget.message ??
                    "Updated department budget must be greater than zero.",
            });
        }

        const department = await ctx.db.get(plan.departmentId);
        if (
            normalizedBudget.value !== null &&
            (!department ||
                department.tenantId !== authContext.tenantId ||
                !department.isActive)
        ) {
            throw new ConvexError({
                code: "DEPARTMENT_NOT_FOUND",
                message:
                    "The department budget cannot be updated because the active department record is unavailable.",
            });
        }

        const rejectedAt = Date.now();
        const revisionDeadline = validateProcurementOfficerRevisionDeadline({
            input: args.revisionDeadlineInput ?? null,
            now: rejectedAt,
            timeZone: resolveDeadlineTimeZone({
                tenantTimeZone: tenant.timeZone,
            }).timeZone,
        });
        if (!revisionDeadline.ok) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: revisionDeadline.message ?? "Enter a valid revision deadline.",
            });
        }

        const flaggedTargets = normalizeProcurementOfficerFlaggedTargets({
            descriptors: args.flaggedTargets ?? [],
            validSelectionIds: getReviewableSelectionIds(plan),
        });
        if (flaggedTargets.invalidIds.length > 0) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: "One or more selected revision targets are stale. Refresh the review view and select them again.",
            });
        }

        await supersedeActivePlanReviewDecisions(ctx, plan._id, rejectedAt);
        await ctx.db.patch(plan._id, {
            approvedAt: undefined,
            rejectedAt,
            rejectionComment: normalizedComment.value,
            status: "rejected",
            updatedAt: rejectedAt,
        });

        await ctx.db.insert("planReviewComments", {
            authorNameSnapshot: readAuthUserSummary(authUser, "Procurement Officer").name,
            authorTenantUserId: tenantUser._id,
            authorUserId: authContext.userId,
            body: normalizedComment.value,
            createdAt: rejectedAt,
            planId: plan._id,
            tenantId: authContext.tenantId,
        });
        const decisionId = await ctx.db.insert("planReviewDecisions", {
            comment: normalizedComment.value,
            decidedAt: rejectedAt,
            decidedByTenantUserId: tenantUser._id,
            decidedByUserId: authContext.userId,
            decisionType: args.decisionType,
            departmentId: plan.departmentId,
            fiscalYear: plan.fiscalYear,
            flaggedTargets: flaggedTargets.targets,
            lifecycleStatus: "active",
            planId: plan._id,
            revisionDeadlineAt: revisionDeadline.value ?? null,
            tenantId: authContext.tenantId,
        });

        let departmentBudgetChanged = false;
        if (
            normalizedBudget.value !== null &&
            department &&
            department.budgetAllocation !== normalizedBudget.value
        ) {
            departmentBudgetChanged = true;
            await ctx.db.patch(department._id, {
                budgetAllocation: normalizedBudget.value,
                lastBudgetChangedAt: rejectedAt,
                lastBudgetChangedByTenantUserId: tenantUser._id,
                updatedAt: rejectedAt,
            });

            await appendAuditLogRequired(ctx, {
                action: "update_budget",
                actor: createAuthenticatedAuditActor({
                    role: "procurement_officer",
                    userId: String(authContext.userId),
                }),
                entityType: "department",
                event: AUDIT_EVENT_NAMES.departmentBudgetChanged,
                metadata: {
                    budgetAllocation: normalizedBudget.value,
                    previousBudgetAllocation: department.budgetAllocation ?? null,
                    reviewPlanId: String(plan._id),
                    summary: `Updated the budget allocation for ${department.name} during plan review.`,
                },
                outcome: AUDIT_OUTCOMES.allowed,
                recordId: String(department._id),
                sourceTenantId: String(authContext.tenantId),
                tableName: "departments",
                targetTenantId: String(authContext.tenantId),
                timestamp: rejectedAt,
            });
        }

        await appendAuditLogRequired(
            ctx,
            buildPlanReviewAuditEntry({
                action:
                    args.decisionType === "revision_requested"
                        ? "request_revision"
                        : "reject",
                actorUserId: authContext.userId,
                departmentId: plan.departmentId,
                event:
                    args.decisionType === "revision_requested"
                        ? AUDIT_EVENT_NAMES.planReviewRevisionRequested
                        : AUDIT_EVENT_NAMES.planReviewRejected,
                metadata: {
                    comment: normalizedComment.value,
                    decisionId: String(decisionId),
                    flaggedTargetCount: flaggedTargets.targets.length,
                    nextStatus: "rejected",
                    previousStatus: "submitted",
                    revisionDeadlineAt: revisionDeadline.value ?? null,
                },
                outcome: AUDIT_OUTCOMES.allowed,
                planId: plan._id,
                tenantId: authContext.tenantId,
            }),
        );

        const notification = await queuePlanReviewDecisionNotification(ctx, {
            comment: normalizedComment.value,
            decisionId,
            decidedAt: rejectedAt,
            decisionType: args.decisionType,
            departmentName: department?.name ?? plan.departmentNameSnapshot ?? "Department",
            flaggedTargets: flaggedTargets.targets,
            fiscalYear: plan.fiscalYear,
            planId: plan._id,
            recipientEmail: await resolveDepartmentUserNotificationEmail(ctx, {
                departmentId: plan.departmentId,
                tenantId: authContext.tenantId,
            }),
            revisionDeadlineAt: revisionDeadline.value ?? null,
            tenantId: authContext.tenantId,
            tenantName: tenant.name,
            timeZone: resolveDeadlineTimeZone({
                tenantTimeZone: tenant.timeZone,
            }).timeZone,
        });

        return {
            departmentBudgetChanged,
            notificationStatus: notification.notificationStatus,
            rejectedAt,
            status: args.decisionType,
            statusLabel: getProcurementOfficerPlanDecisionStatusLabel(args.decisionType),
        };
    },
});

export const approveProcurementOfficerPlanReview = mutation({
    args: {
        body: v.optional(v.string()),
        planId: v.string(),
    },
    returns: v.object({
        approvedAt: v.number(),
        notificationStatus: v.union(v.literal("failed"), v.literal("queued")),
        status: v.literal("approved"),
    }),
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!normalizedPlanId) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }

        const [plan, tenantUser, authUser, tenant] = await Promise.all([
            ctx.db.get(normalizedPlanId),
            loadProcurementOfficerTenantUser(ctx, authContext),
            ctx.db.get(authContext.userId),
            ctx.db.get(authContext.tenantId),
        ]);
        if (!tenant || !plan || plan.tenantId !== authContext.tenantId) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }

        if (plan.status !== "submitted") {
            await appendAuditLogRequired(
                ctx,
                buildPlanReviewAuditEntry({
                    action: "approve",
                    actorUserId: authContext.userId,
                    departmentId: plan.departmentId,
                    event: AUDIT_EVENT_NAMES.planReviewApproved,
                    metadata: {
                        nextStatus: plan.status,
                        previousStatus: plan.status,
                        reason: "Only submitted plans can be approved.",
                    },
                    outcome: AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: authContext.tenantId,
                }),
            );
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: "Only submitted plans can be approved.",
            });
        }

        const normalizedOptionalComment = (args.body ?? "").trim();
        if (normalizedOptionalComment.length > 0) {
            const normalizedComment = normalizeProcurementOfficerReviewComment(
                normalizedOptionalComment,
            );
            if (!normalizedComment.ok || !normalizedComment.value) {
                throw new ConvexError({
                    code: "VALIDATION_FAILED",
                    message:
                        normalizedComment.message ??
                        "Internal comments cannot be blank.",
                });
            }
        }

        const approvedAt = Date.now();
        await supersedeActivePlanReviewDecisions(ctx, plan._id, approvedAt);
        await ctx.db.patch(plan._id, {
            approvedAt,
            lastApprovedAt: approvedAt,
            rejectedAt: undefined,
            rejectionComment: undefined,
            redraftApprovedAt: undefined,
            redraftApprovedByTenantUserId: undefined,
            redraftReason: undefined,
            redraftRequestedAt: undefined,
            status: "approved",
            updatedAt: approvedAt,
        });
        const decisionId = await ctx.db.insert("planReviewDecisions", {
            comment: normalizedOptionalComment || "Plan approved.",
            decidedAt: approvedAt,
            decidedByTenantUserId: tenantUser._id,
            decidedByUserId: authContext.userId,
            decisionType: "approved",
            departmentId: plan.departmentId,
            fiscalYear: plan.fiscalYear,
            flaggedTargets: [],
            lifecycleStatus: "active",
            planId: plan._id,
            tenantId: authContext.tenantId,
        });

        if (normalizedOptionalComment.length > 0) {
            await ctx.db.insert("planReviewComments", {
                authorNameSnapshot: readAuthUserSummary(authUser, "Procurement Officer").name,
                authorTenantUserId: tenantUser._id,
                authorUserId: authContext.userId,
                body: normalizedOptionalComment,
                createdAt: approvedAt,
                planId: plan._id,
                tenantId: authContext.tenantId,
            });
        }

        await appendAuditLogRequired(
            ctx,
            buildPlanReviewAuditEntry({
                action: "approve",
                actorUserId: authContext.userId,
                departmentId: plan.departmentId,
                event: AUDIT_EVENT_NAMES.planReviewApproved,
                metadata: {
                    comment: normalizedOptionalComment || null,
                    decisionId: String(decisionId),
                    nextStatus: "approved",
                    previousStatus: "submitted",
                },
                outcome: AUDIT_OUTCOMES.allowed,
                planId: plan._id,
                tenantId: authContext.tenantId,
            }),
        );

        const notification = await queuePlanReviewDecisionNotification(ctx, {
            comment: normalizedOptionalComment || "Plan approved.",
            decisionId,
            decidedAt: approvedAt,
            decisionType: "approved",
            departmentName: plan.departmentNameSnapshot ?? "Department",
            flaggedTargets: [],
            fiscalYear: plan.fiscalYear,
            planId: plan._id,
            recipientEmail: await resolveDepartmentUserNotificationEmail(ctx, {
                departmentId: plan.departmentId,
                tenantId: authContext.tenantId,
            }),
            revisionDeadlineAt: null,
            tenantId: authContext.tenantId,
            tenantName: tenant.name,
            timeZone: resolveDeadlineTimeZone({
                tenantTimeZone: tenant.timeZone,
            }).timeZone,
        });

        return {
            approvedAt,
            notificationStatus: notification.notificationStatus,
            status: "approved" as const,
        };
    },
});

export const undoProcurementOfficerPlanApproval = mutation({
    args: {
        planId: v.string(),
    },
    returns: v.object({
        reviewStartedAt: v.union(v.number(), v.null()),
        status: v.literal("submitted"),
        undoneAt: v.number(),
    }),
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!normalizedPlanId) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }

        const plan = await ctx.db.get(normalizedPlanId);
        if (!plan || plan.tenantId !== authContext.tenantId) {
            throw new ConvexError({
                code: "PLAN_NOT_FOUND",
                message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }

        const eligibility = getProcurementOfficerUndoApprovalEligibility({
            approvedAt: plan.approvedAt ?? null,
            consolidatedAt: plan.consolidatedAt ?? null,
            now: Date.now(),
            status: plan.status,
        });
        if (!eligibility.canUndo) {
            await appendAuditLogRequired(
                ctx,
                buildPlanReviewAuditEntry({
                    action: "undo_approval",
                    actorUserId: authContext.userId,
                    departmentId: plan.departmentId,
                    event: AUDIT_EVENT_NAMES.planReviewApprovalUndone,
                    metadata: {
                        nextStatus: plan.status,
                        previousStatus: plan.status,
                        reason: eligibility.blockedReason,
                    },
                    outcome: AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: authContext.tenantId,
                }),
            );
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    eligibility.blockedReason ??
                    "Approval can no longer be undone.",
            });
        }

        const activeDecision = await getLatestActivePlanReviewDecision(ctx, plan._id);
        const undoneAt = Date.now();
        if (activeDecision && activeDecision.decisionType === "approved") {
            await ctx.db.patch(activeDecision._id, {
                lifecycleStatus: "undone",
                undoneAt,
                undoneByUserId: authContext.userId,
            });
        }

        await ctx.db.patch(plan._id, {
            approvedAt: undefined,
            status: "submitted",
            updatedAt: undoneAt,
        });
        await appendAuditLogRequired(
            ctx,
            buildPlanReviewAuditEntry({
                action: "undo_approval",
                actorUserId: authContext.userId,
                departmentId: plan.departmentId,
                event: AUDIT_EVENT_NAMES.planReviewApprovalUndone,
                metadata: {
                    nextStatus: "submitted",
                    previousStatus: "approved",
                },
                outcome: AUDIT_OUTCOMES.allowed,
                planId: plan._id,
                tenantId: authContext.tenantId,
            }),
        );

        return {
            reviewStartedAt: plan.reviewStartedAt ?? null,
            status: "submitted" as const,
            undoneAt,
        };
    },
});
