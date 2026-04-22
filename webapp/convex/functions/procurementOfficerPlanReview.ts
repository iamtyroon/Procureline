import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { normalizeBlocklyWorkspaceRecord } from "../../lib/blockly/blockly-serialization";
import { formatDepartmentBudget } from "../../lib/procurement-officer/departments";
import { formatDeadlineDateTime, resolveDeadlineTimeZone } from "../../lib/procurement-officer/deadlines";
import {
    buildProcurementOfficerReviewSnapshotSequenceKey,
    derivePreviousFiscalYearKey,
    normalizeProcurementOfficerReviewComment,
    prepareProcurementOfficerPlanReviewStart,
    PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
    resolveProcurementOfficerReviewDepartmentContext,
    resolveProcurementOfficerReviewTargetState,
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
import { requireTenantRole } from "./_roleGuard";

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

function toPersistedPlanSummary(plan: Doc<"plans">) {
    return {
        categorySummaries: plan.categorySummaries.map((summary) => ({
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
        planId: String(snapshot.planId),
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

        const [catalog, department, comments, planSnapshots, departmentPlans] = await Promise.all([
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
                    selectedCategoryIds: reviewPlan.selectedCategoryIds.map((categoryId) =>
                        String(categoryId),
                    ),
                    status: reviewPlan.status,
                    statusLabel: getProcurementOfficerSubmissionStatusLabel(
                        getReviewablePlanStatus(reviewPlan.status),
                    ),
                    submittedAt: reviewPlan.submittedAt ?? null,
                    totalAmountLabel: formatDepartmentBudget(reviewPlan.estimatedBudgetUsed),
                    workspaceState: planLike.workspaceState,
                },
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

        const department = await ctx.db.get(reviewPlan.departmentId);
        const now = Date.now();
        const submissionSequenceKey = buildProcurementOfficerReviewSnapshotSequenceKey({
            planId: String(reviewPlan._id),
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
                categorySummaries: reviewPlan.categorySummaries.map((summary) => ({
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
                planId: reviewPlan._id,
                selectedCategoryIds: reviewPlan.selectedCategoryIds.map((categoryId) =>
                    String(categoryId),
                ),
                submissionSequenceKey,
                submittedAt: reviewPlan.submittedAt ?? null,
                tenantId: reviewPlan.tenantId,
                workspaceState: reviewPlan.workspaceState
                    ? normalizeBlocklyWorkspaceRecord(reviewPlan.workspaceState, {
                          lastSavedAt: reviewPlan.updatedAt,
                          lastSavedByUserId: String(authContext.userId),
                      })
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
