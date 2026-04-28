"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveProcurementOfficerPlanReview = exports.rejectProcurementOfficerPlanReview = exports.addProcurementOfficerPlanReviewComment = exports.startProcurementOfficerPlanReview = exports.getProcurementOfficerPlanReviewWorkspace = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const blockly_serialization_1 = require("../../lib/blockly/blockly-serialization");
const departments_1 = require("../../lib/procurement-officer/departments");
const deadlines_1 = require("../../lib/procurement-officer/deadlines");
const review_1 = require("../../lib/procurement-officer/review");
const submissions_1 = require("../../lib/procurement-officer/submissions");
const plans_1 = require("./plans");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const audit_1 = require("../../lib/security/audit");
function readAuthUserSummary(userDocument, fallbackName) {
    const record = userDocument && typeof userDocument === "object" && !Array.isArray(userDocument)
        ? userDocument
        : {};
    const email = typeof record.email === "string" && record.email.trim().length > 0
        ? record.email.trim()
        : "No email available";
    const name = typeof record.name === "string" && record.name.trim().length > 0
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
function toPersistedPlanSummary(plan) {
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
function toReviewPlanLike(plan) {
    return {
        fiscalYear: plan.fiscalYear,
        submissionSequence: plan.submissionSequence ?? null,
        submittedAt: plan.submittedAt ?? null,
        summary: toPersistedPlanSummary(plan),
        updatedAt: plan.updatedAt,
        workspaceState: plan.workspaceState
            ? (0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(plan.workspaceState, {
                lastSavedAt: plan.updatedAt,
                lastSavedByUserId: plan.reviewStartedByUserId
                    ? String(plan.reviewStartedByUserId)
                    : "procurement-officer-review",
            })
            : null,
    };
}
function toReviewSnapshotLike(snapshot) {
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
            ? (0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(snapshot.workspaceState, {
                lastSavedAt: snapshot.capturedAt,
                lastSavedByUserId: String(snapshot.capturedByUserId),
            })
            : null,
    };
}
async function loadProcurementOfficerTenantUser(ctx, authContext) {
    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) => q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId))
        .first();
    if (!tenantUser || !tenantUser.isActive || tenantUser.role !== "procurement_officer") {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for plan review.",
        });
    }
    return tenantUser;
}
function buildRedirectResult(message) {
    return {
        comments: [],
        message,
        state: "redirect",
        workspace: null,
    };
}
function getReviewablePlanStatus(status) {
    if (status === "draft") {
        throw new values_1.ConvexError({
            code: "PLAN_NOT_FOUND",
            message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
        });
    }
    return status;
}
function assertPlanIsPendingReview(plan) {
    if (!(0, review_1.shouldStartProcurementOfficerReviewTracking)(plan.status)) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            message: "Only submitted plans can be reviewed from this workspace.",
        });
    }
}
exports.getProcurementOfficerPlanReviewWorkspace = (0, server_1.query)({
    args: {
        planId: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!normalizedPlanId) {
            return buildRedirectResult(review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE);
        }
        const [tenant, plan, tenantUser, authUser] = await Promise.all([
            ctx.db.get(authContext.tenantId),
            ctx.db.get(normalizedPlanId),
            loadProcurementOfficerTenantUser(ctx, authContext),
            ctx.db.get(authContext.userId),
        ]);
        if (!tenant) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }
        const targetState = (0, review_1.resolveProcurementOfficerReviewTargetState)({
            planExists: Boolean(plan),
            planStatus: plan?.status ?? null,
            requestPlanIdIsValid: true,
            tenantMatches: plan?.tenantId === authContext.tenantId,
        });
        if (targetState.state === "redirect") {
            return buildRedirectResult(targetState.message ?? review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE);
        }
        if (!plan) {
            return buildRedirectResult(review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE);
        }
        const reviewPlan = plan;
        const [catalog, department, comments, planSnapshots, departmentPlans, pendingRedraftRequest,] = await Promise.all([
            (0, plans_1.loadTenantCatalog)(ctx, authContext.tenantId),
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
                .withIndex("by_planId_status", (q) => q.eq("planId", reviewPlan._id).eq("status", "pending"))
                .first(),
        ]);
        const previousFiscalYear = (0, review_1.derivePreviousFiscalYearKey)(reviewPlan.fiscalYear);
        const priorFiscalYearSnapshots = previousFiscalYear
            ? await ctx.db
                .query("planSubmissionSnapshots")
                .withIndex("by_tenantId_departmentId_fiscalYear_capturedAt", (q) => q.eq("tenantId", authContext.tenantId)
                .eq("departmentId", reviewPlan.departmentId)
                .eq("fiscalYear", previousFiscalYear))
                .collect()
            : [];
        const departmentContext = (0, review_1.resolveProcurementOfficerReviewDepartmentContext)({
            joinedDepartmentCode: department?.code ?? null,
            joinedDepartmentIsActive: department?.isActive ?? null,
            joinedDepartmentName: department?.name ?? null,
            planDepartmentCodeSnapshot: reviewPlan.departmentCodeSnapshot ?? null,
            planDepartmentNameSnapshot: reviewPlan.departmentNameSnapshot ?? null,
        });
        const planLike = toReviewPlanLike(reviewPlan);
        const reviewSnapshots = planSnapshots.map(toReviewSnapshotLike);
        const previousSubmissionBaseline = (0, review_1.selectPreviousSubmissionBaseline)({
            currentSubmissionSequence: reviewPlan.submissionSequence ?? null,
            currentSubmittedAt: reviewPlan.submittedAt ?? null,
            snapshots: reviewSnapshots,
        });
        const previousFiscalYearBaseline = (0, review_1.selectPriorFiscalYearBaseline)({
            currentFiscalYear: reviewPlan.fiscalYear,
            priorFiscalYearPlans: departmentPlans
                .filter((candidate) => candidate.status !== "draft" && candidate._id !== reviewPlan._id)
                .map(toReviewPlanLike),
            priorFiscalYearSnapshots: priorFiscalYearSnapshots.map(toReviewSnapshotLike),
        });
        const reviewStartedBy = reviewPlan.reviewStartedByUserId
            ? await ctx.db.get(reviewPlan.reviewStartedByUserId)
            : null;
        const currentUser = readAuthUserSummary(authUser, "Procurement Officer");
        const reviewStartedByUser = reviewStartedBy
            ? readAuthUserSummary(reviewStartedBy, "Procurement Officer")
            : null;
        const resolvedTimeZone = (0, deadlines_1.resolveDeadlineTimeZone)({
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
            state: "ready",
            workspace: {
                baselines: {
                    previousFiscalYear: previousFiscalYearBaseline,
                    previousSubmission: previousSubmissionBaseline,
                },
                catalog,
                department: department
                    ? {
                        ...(0, plans_1.mapDepartmentDepartmentRecord)(department),
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
                    submittedAtLabel: typeof reviewPlan.submittedAt === "number"
                        ? (0, deadlines_1.formatDeadlineDateTime)(reviewPlan.submittedAt, resolvedTimeZone)
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
                    selectedCategoryIds: reviewPlan.selectedCategoryIds.map((categoryId) => String(categoryId)),
                    status: reviewPlan.status,
                    statusLabel: (0, submissions_1.getProcurementOfficerSubmissionStatusLabel)(getReviewablePlanStatus(reviewPlan.status)),
                    submittedAt: reviewPlan.submittedAt ?? null,
                    totalAmountLabel: (0, departments_1.formatDepartmentBudget)(reviewPlan.estimatedBudgetUsed),
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
exports.startProcurementOfficerPlanReview = (0, server_1.mutation)({
    args: {
        planId: values_1.v.string(),
    },
    returns: values_1.v.object({
        reviewStartedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        snapshotCaptured: values_1.v.boolean(),
    }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!normalizedPlanId) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        const [plan, tenantUser] = await Promise.all([
            ctx.db.get(normalizedPlanId),
            loadProcurementOfficerTenantUser(ctx, authContext),
        ]);
        const targetState = (0, review_1.resolveProcurementOfficerReviewTargetState)({
            planExists: Boolean(plan),
            planStatus: plan?.status ?? null,
            requestPlanIdIsValid: true,
            tenantMatches: plan?.tenantId === authContext.tenantId,
        });
        if (targetState.state === "redirect") {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: targetState.message ?? review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        if (!plan) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        const reviewPlan = plan;
        assertPlanIsPendingReview(reviewPlan);
        const department = await ctx.db.get(reviewPlan.departmentId);
        const now = Date.now();
        const submissionSequenceKey = (0, review_1.buildProcurementOfficerReviewSnapshotSequenceKey)({
            planId: String(reviewPlan._id),
            submissionSequence: reviewPlan.submissionSequence ?? null,
            submittedAt: reviewPlan.submittedAt ?? null,
            tenantId: String(authContext.tenantId),
        });
        const existingSnapshot = await ctx.db
            .query("planSubmissionSnapshots")
            .withIndex("by_submissionSequenceKey", (q) => q.eq("submissionSequenceKey", submissionSequenceKey))
            .first();
        const reviewStart = (0, review_1.prepareProcurementOfficerPlanReviewStart)({
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
        const planPatch = {};
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
                departmentCodeSnapshot: reviewStart.departmentCodeSnapshot ?? undefined,
                departmentId: reviewPlan.departmentId,
                departmentNameSnapshot: reviewStart.departmentNameSnapshot ?? undefined,
                estimatedBudgetUsed: reviewPlan.estimatedBudgetUsed,
                fiscalYear: reviewPlan.fiscalYear,
                itemCount: reviewPlan.itemCount,
                lifecycleStatus: "active",
                planId: reviewPlan._id,
                selectedCategoryIds: reviewPlan.selectedCategoryIds.map((categoryId) => String(categoryId)),
                submissionReference: reviewPlan.submissionReference ?? undefined,
                submissionSequence: reviewPlan.submissionSequence ?? undefined,
                submissionSequenceKey,
                submittedAt: reviewPlan.submittedAt ?? null,
                tenantId: reviewPlan.tenantId,
                workspaceState: reviewPlan.workspaceState
                    ? (0, blockly_serialization_1.createPersistedBlocklyWorkspaceRecord)((0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(reviewPlan.workspaceState, {
                        lastSavedAt: reviewPlan.updatedAt,
                        lastSavedByUserId: String(authContext.userId),
                    }))
                    : undefined,
            });
        }
        return {
            reviewStartedAt: reviewStart.reviewStartedAt,
            snapshotCaptured: reviewStart.shouldCaptureSnapshot,
        };
    },
});
exports.addProcurementOfficerPlanReviewComment = (0, server_1.mutation)({
    args: {
        body: values_1.v.string(),
        planId: values_1.v.string(),
    },
    returns: values_1.v.object({
        commentId: values_1.v.string(),
        createdAt: values_1.v.number(),
    }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!normalizedPlanId) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        const [plan, tenantUser, authUser] = await Promise.all([
            ctx.db.get(normalizedPlanId),
            loadProcurementOfficerTenantUser(ctx, authContext),
            ctx.db.get(authContext.userId),
        ]);
        const targetState = (0, review_1.resolveProcurementOfficerReviewTargetState)({
            planExists: Boolean(plan),
            planStatus: plan?.status ?? null,
            requestPlanIdIsValid: true,
            tenantMatches: plan?.tenantId === authContext.tenantId,
        });
        if (targetState.state === "redirect") {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: targetState.message ?? review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        if (!plan) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        const reviewPlan = plan;
        const normalizedComment = (0, review_1.normalizeProcurementOfficerReviewComment)(args.body);
        if (!normalizedComment.ok || !normalizedComment.value) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: normalizedComment.message ??
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
exports.rejectProcurementOfficerPlanReview = (0, server_1.mutation)({
    args: {
        body: values_1.v.string(),
        nextDepartmentBudgetAllocation: values_1.v.optional(values_1.v.union(values_1.v.number(), values_1.v.null())),
        planId: values_1.v.string(),
    },
    returns: values_1.v.object({
        departmentBudgetChanged: values_1.v.boolean(),
        rejectedAt: values_1.v.number(),
        status: values_1.v.literal("rejected"),
    }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!normalizedPlanId) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        const [plan, tenantUser, authUser] = await Promise.all([
            ctx.db.get(normalizedPlanId),
            loadProcurementOfficerTenantUser(ctx, authContext),
            ctx.db.get(authContext.userId),
        ]);
        const targetState = (0, review_1.resolveProcurementOfficerReviewTargetState)({
            planExists: Boolean(plan),
            planStatus: plan?.status ?? null,
            requestPlanIdIsValid: true,
            tenantMatches: plan?.tenantId === authContext.tenantId,
        });
        if (targetState.state === "redirect") {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: targetState.message ?? review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        if (!plan) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        assertPlanIsPendingReview(plan);
        const normalizedComment = (0, review_1.normalizeProcurementOfficerReviewComment)(args.body);
        if (!normalizedComment.ok || !normalizedComment.value) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: normalizedComment.message ??
                    "Internal comments cannot be blank.",
            });
        }
        const normalizedBudget = (0, review_1.normalizeProcurementOfficerReviewBudgetAdjustment)(args.nextDepartmentBudgetAllocation ?? null);
        if (!normalizedBudget.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: normalizedBudget.message ??
                    "Updated department budget must be greater than zero.",
            });
        }
        const department = await ctx.db.get(plan.departmentId);
        if (normalizedBudget.value !== null &&
            (!department ||
                department.tenantId !== authContext.tenantId ||
                !department.isActive)) {
            throw new values_1.ConvexError({
                code: "DEPARTMENT_NOT_FOUND",
                message: "The department budget cannot be updated because the active department record is unavailable.",
            });
        }
        const rejectedAt = Date.now();
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
        let departmentBudgetChanged = false;
        if (normalizedBudget.value !== null &&
            department &&
            department.budgetAllocation !== normalizedBudget.value) {
            departmentBudgetChanged = true;
            await ctx.db.patch(department._id, {
                budgetAllocation: normalizedBudget.value,
                lastBudgetChangedAt: rejectedAt,
                lastBudgetChangedByTenantUserId: tenantUser._id,
                updatedAt: rejectedAt,
            });
            await (0, _audit_1.appendAuditLogRequired)(ctx, {
                action: "update_budget",
                actor: (0, audit_1.createAuthenticatedAuditActor)({
                    role: "procurement_officer",
                    userId: String(authContext.userId),
                }),
                entityType: "department",
                event: audit_1.AUDIT_EVENT_NAMES.departmentBudgetChanged,
                metadata: {
                    budgetAllocation: normalizedBudget.value,
                    previousBudgetAllocation: department.budgetAllocation ?? null,
                    reviewPlanId: String(plan._id),
                    summary: `Updated the budget allocation for ${department.name} during plan review.`,
                },
                outcome: audit_1.AUDIT_OUTCOMES.allowed,
                recordId: String(department._id),
                sourceTenantId: String(authContext.tenantId),
                tableName: "departments",
                targetTenantId: String(authContext.tenantId),
                timestamp: rejectedAt,
            });
        }
        return {
            departmentBudgetChanged,
            rejectedAt,
            status: "rejected",
        };
    },
});
exports.approveProcurementOfficerPlanReview = (0, server_1.mutation)({
    args: {
        body: values_1.v.optional(values_1.v.string()),
        planId: values_1.v.string(),
    },
    returns: values_1.v.object({
        approvedAt: values_1.v.number(),
        status: values_1.v.literal("approved"),
    }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!normalizedPlanId) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        const [plan, tenantUser, authUser] = await Promise.all([
            ctx.db.get(normalizedPlanId),
            loadProcurementOfficerTenantUser(ctx, authContext),
            ctx.db.get(authContext.userId),
        ]);
        const targetState = (0, review_1.resolveProcurementOfficerReviewTargetState)({
            planExists: Boolean(plan),
            planStatus: plan?.status ?? null,
            requestPlanIdIsValid: true,
            tenantMatches: plan?.tenantId === authContext.tenantId,
        });
        if (targetState.state === "redirect") {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: targetState.message ?? review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        if (!plan) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        assertPlanIsPendingReview(plan);
        const normalizedOptionalComment = (args.body ?? "").trim();
        if (normalizedOptionalComment.length > 0) {
            const normalizedComment = (0, review_1.normalizeProcurementOfficerReviewComment)(normalizedOptionalComment);
            if (!normalizedComment.ok || !normalizedComment.value) {
                throw new values_1.ConvexError({
                    code: "VALIDATION_FAILED",
                    message: normalizedComment.message ??
                        "Internal comments cannot be blank.",
                });
            }
        }
        const approvedAt = Date.now();
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
        return {
            approvedAt,
            status: "approved",
        };
    },
});
