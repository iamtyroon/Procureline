"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.undoProcurementOfficerPlanApproval = exports.approveProcurementOfficerPlanReview = exports.rejectProcurementOfficerPlanReview = exports.addProcurementOfficerPlanReviewComment = exports.startProcurementOfficerPlanReview = exports.getProcurementOfficerPlanReviewWorkspace = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const blockly_serialization_1 = require("../../lib/shared/blockly/blockly-serialization");
const departments_1 = require("../../lib/procurement-officer/departments");
const deadlines_1 = require("../../lib/procurement-officer/deadlines");
const review_decision_1 = require("../../lib/procurement-officer/review-decision");
const review_1 = require("../../lib/procurement-officer/review");
const submissions_1 = require("../../lib/procurement-officer/submissions");
const plans_1 = require("./plans");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const audit_1 = require("../../lib/shared/security/audit");
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
const reviewDecisionTypeValidator = values_1.v.union(values_1.v.literal("rejected"), values_1.v.literal("revision_requested"));
const reviewFlaggedTargetInputValidator = values_1.v.object({
    id: values_1.v.string(),
    label: values_1.v.string(),
    type: values_1.v.union(values_1.v.literal("category"), values_1.v.literal("item")),
});
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
function buildPlanReviewAuditEntry(args) {
    return {
        action: args.action,
        actor: (0, audit_1.createAuthenticatedAuditActor)({
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
    };
}
async function getLatestActivePlanReviewDecision(ctx, planId) {
    return ctx.db
        .query("planReviewDecisions")
        .withIndex("by_planId_lifecycleStatus_decidedAt", (q) => q.eq("planId", planId).eq("lifecycleStatus", "active"))
        .order("desc")
        .first();
}
async function supersedeActivePlanReviewDecisions(ctx, planId, supersededAt) {
    const activeDecisions = await ctx.db
        .query("planReviewDecisions")
        .withIndex("by_planId_lifecycleStatus_decidedAt", (q) => q.eq("planId", planId).eq("lifecycleStatus", "active"))
        .collect();
    await Promise.all(activeDecisions.map((decision) => ctx.db.patch(decision._id, {
        lifecycleStatus: "superseded",
        supersededAt,
    })));
}
function mapPlanReviewDecision(decision, timeZone) {
    if (!decision) {
        return null;
    }
    return {
        comment: decision.comment,
        decidedAt: decision.decidedAt,
        decidedAtLabel: (0, deadlines_1.formatDeadlineDateTime)(decision.decidedAt, timeZone),
        decisionType: decision.decisionType,
        flaggedTargets: decision.flaggedTargets,
        id: String(decision._id),
        notificationErrorMessage: decision.notificationErrorMessage ?? null,
        notificationQueuedAt: decision.notificationQueuedAt ?? null,
        notificationStatus: decision.notificationStatus ?? null,
        revisionDeadlineAt: decision.revisionDeadlineAt ?? null,
        revisionDeadlineLabel: typeof decision.revisionDeadlineAt === "number"
            ? (0, deadlines_1.formatDeadlineDateTime)(decision.revisionDeadlineAt, timeZone)
            : null,
        statusLabel: (0, review_decision_1.getProcurementOfficerPlanDecisionStatusLabel)(decision.decisionType),
    };
}
function getReviewableSelectionIds(plan) {
    const selectionIds = new Set();
    for (const category of plan.categorySummaries) {
        const categoryId = String(category.categoryId);
        selectionIds.add(`category:${categoryId}`);
    }
    const workspaceBlocks = plan.workspaceState &&
        typeof plan.workspaceState === "object" &&
        "workspaceJson" in plan.workspaceState
        ? (plan.workspaceState.workspaceJson.blocks?.blocks ?? [])
        : [];
    const stack = Array.isArray(workspaceBlocks)
        ? workspaceBlocks.map((block) => ({ block, categoryId: null }))
        : [];
    while (stack.length > 0) {
        const currentEntry = stack.pop();
        const block = currentEntry?.block;
        if (!block || typeof block !== "object") {
            continue;
        }
        const currentCategoryId = typeof block.fields?.CATEGORY_ID === "string" &&
            block.fields.CATEGORY_ID.trim().length > 0
            ? block.fields.CATEGORY_ID.trim()
            : currentEntry.categoryId ?? null;
        if (block.type === "item_block") {
            const fields = block.fields ?? {};
            const itemId = typeof fields.ITEM_ID === "string" && fields.ITEM_ID.trim().length > 0
                ? fields.ITEM_ID.trim()
                : "";
            if (itemId.length > 0 && currentCategoryId) {
                selectionIds.add(`item:${currentCategoryId}:${itemId}`);
            }
        }
        for (const value of Object.values(block.inputs ?? {})) {
            if (value && typeof value === "object" && "block" in value) {
                stack.push({
                    block: value.block,
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
        const [catalog, department, comments, planSnapshots, departmentPlans, pendingRedraftRequest, activeDecision,] = await Promise.all([
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
            getLatestActivePlanReviewDecision(ctx, reviewPlan._id),
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
        const latestDecision = mapPlanReviewDecision(activeDecision, resolvedTimeZone);
        const undoApproval = (0, review_decision_1.getProcurementOfficerUndoApprovalEligibility)({
            approvedAt: reviewPlan.approvedAt ?? null,
            consolidatedAt: reviewPlan.consolidatedAt ?? null,
            now: Date.now(),
            status: reviewPlan.status,
        });
        const planStatusLabel = reviewPlan.status === "rejected" && activeDecision
            ? (0, review_decision_1.getProcurementOfficerPlanDecisionStatusLabel)(activeDecision.decisionType)
            : (0, submissions_1.getProcurementOfficerSubmissionStatusLabel)(getReviewablePlanStatus(reviewPlan.status));
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
                    latestDecision,
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
                    statusLabel: planStatusLabel,
                    submittedAt: reviewPlan.submittedAt ?? null,
                    totalAmountLabel: (0, departments_1.formatDepartmentBudget)(reviewPlan.estimatedBudgetUsed),
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
async function resolveDepartmentUserNotificationEmail(ctx, args) {
    const profiles = await ctx.db
        .query("departmentUserProfiles")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .collect();
    const profile = profiles.find((candidate) => candidate.departmentId === args.departmentId && candidate.isActive);
    if (!profile) {
        return null;
    }
    const tenantUser = await ctx.db.get(profile.tenantUserId);
    if (!tenantUser?.isActive || tenantUser.role !== "department_user") {
        return null;
    }
    const authUser = await ctx.db.get(tenantUser.userId);
    const email = typeof authUser?.email === "string" ? authUser.email.trim().toLowerCase() : "";
    return email.length > 0 ? email : null;
}
async function queuePlanReviewDecisionNotification(ctx, args) {
    if (!args.recipientEmail) {
        await ctx.db.patch(args.decisionId, {
            notificationErrorCode: "RECIPIENT_UNAVAILABLE",
            notificationErrorMessage: "Decision saved but no Department User email is available for notification.",
            notificationStatus: "failed",
        });
        return {
            idempotencyKey: null,
            notificationStatus: "failed",
        };
    }
    const idempotencyKey = (0, review_decision_1.buildProcurementOfficerDecisionNotificationIdempotencyKey)({
        decisionId: String(args.decisionId),
        decisionType: args.decisionType,
        planId: String(args.planId),
        recipientEmail: args.recipientEmail,
        tenantId: String(args.tenantId),
    });
    const nextStepHref = args.decisionType === "approved"
        ? `/du/plans/${String(args.planId)}?mode=view`
        : `/du/plans/${String(args.planId)}?mode=edit`;
    const nextStepLabel = args.decisionType === "approved"
        ? "View approved plan"
        : "Review comments and update the plan";
    await ctx.scheduler.runAfter(0, "actions/email:queueTransactionalEmail", {
        idempotencyKey,
        subject: `${args.tenantName} plan ${(0, review_decision_1.getProcurementOfficerPlanDecisionStatusLabel)(args.decisionType).toLowerCase()}`,
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
            revisionDeadlineLabel: typeof args.revisionDeadlineAt === "number"
                ? (0, deadlines_1.formatDeadlineDateTime)(args.revisionDeadlineAt, args.timeZone)
                : null,
            summary: (0, review_decision_1.buildProcurementOfficerDecisionSummary)({
                comment: args.comment,
                decidedAt: args.decidedAt,
                decisionType: args.decisionType,
                flaggedTargets: [...args.flaggedTargets],
                revisionDeadlineAt: args.revisionDeadlineAt,
            }, args.timeZone),
            status: (0, review_decision_1.getProcurementOfficerPlanDecisionStatusLabel)(args.decisionType),
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
        notificationStatus: "queued",
    };
}
exports.rejectProcurementOfficerPlanReview = (0, server_1.mutation)({
    args: {
        body: values_1.v.string(),
        decisionType: reviewDecisionTypeValidator,
        flaggedTargets: values_1.v.optional(values_1.v.array(reviewFlaggedTargetInputValidator)),
        nextDepartmentBudgetAllocation: values_1.v.optional(values_1.v.union(values_1.v.number(), values_1.v.null())),
        planId: values_1.v.string(),
        revisionDeadlineInput: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.object({
        departmentBudgetChanged: values_1.v.boolean(),
        notificationStatus: values_1.v.union(values_1.v.literal("failed"), values_1.v.literal("queued")),
        rejectedAt: values_1.v.number(),
        status: values_1.v.union(values_1.v.literal("rejected"), values_1.v.literal("revision_requested")),
        statusLabel: values_1.v.string(),
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
        const [plan, tenantUser, authUser, tenant] = await Promise.all([
            ctx.db.get(normalizedPlanId),
            loadProcurementOfficerTenantUser(ctx, authContext),
            ctx.db.get(authContext.userId),
            ctx.db.get(authContext.tenantId),
        ]);
        if (!tenant || !plan || plan.tenantId !== authContext.tenantId) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        if (plan.status !== "submitted") {
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildPlanReviewAuditEntry({
                action: args.decisionType === "revision_requested"
                    ? "request_revision"
                    : "reject",
                actorUserId: authContext.userId,
                departmentId: plan.departmentId,
                event: args.decisionType === "revision_requested"
                    ? audit_1.AUDIT_EVENT_NAMES.planReviewRevisionRequested
                    : audit_1.AUDIT_EVENT_NAMES.planReviewRejected,
                metadata: {
                    attemptedDecisionType: args.decisionType,
                    nextStatus: plan.status,
                    previousStatus: plan.status,
                    reason: "Only submitted plans can be rejected or sent back for revision.",
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
                planId: plan._id,
                tenantId: authContext.tenantId,
            }));
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "Only submitted plans can be rejected or sent back for revision.",
            });
        }
        const rawComment = args.body.trim();
        let normalizedOptionalComment = "";
        if (rawComment.length > 0) {
            const normalizedComment = (0, review_decision_1.normalizeProcurementOfficerDecisionComment)(rawComment);
            if (!normalizedComment.ok || !normalizedComment.value) {
                throw new values_1.ConvexError({
                    code: "VALIDATION_FAILED",
                    message: normalizedComment.message ?? "Decision comments cannot be blank.",
                });
            }
            normalizedOptionalComment = normalizedComment.value;
        }
        const decisionComment = normalizedOptionalComment ||
            (args.decisionType === "revision_requested"
                ? "Revision requested."
                : "Plan rejected.");
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
        const revisionDeadline = (0, review_decision_1.validateProcurementOfficerRevisionDeadline)({
            input: args.revisionDeadlineInput ?? null,
            now: rejectedAt,
            timeZone: (0, deadlines_1.resolveDeadlineTimeZone)({
                tenantTimeZone: tenant.timeZone,
            }).timeZone,
        });
        if (!revisionDeadline.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: revisionDeadline.message ?? "Enter a valid revision deadline.",
            });
        }
        const flaggedTargets = (0, review_decision_1.normalizeProcurementOfficerFlaggedTargets)({
            descriptors: args.flaggedTargets ?? [],
            validSelectionIds: getReviewableSelectionIds(plan),
        });
        if (flaggedTargets.invalidIds.length > 0) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "One or more selected revision targets are stale. Refresh the review view and select them again.",
            });
        }
        await supersedeActivePlanReviewDecisions(ctx, plan._id, rejectedAt);
        await ctx.db.patch(plan._id, {
            approvedAt: undefined,
            rejectedAt,
            rejectionComment: decisionComment,
            status: "rejected",
            updatedAt: rejectedAt,
        });
        if (normalizedOptionalComment.length > 0) {
            await ctx.db.insert("planReviewComments", {
                authorNameSnapshot: readAuthUserSummary(authUser, "Procurement Officer").name,
                authorTenantUserId: tenantUser._id,
                authorUserId: authContext.userId,
                body: normalizedOptionalComment,
                createdAt: rejectedAt,
                planId: plan._id,
                tenantId: authContext.tenantId,
            });
        }
        const decisionId = await ctx.db.insert("planReviewDecisions", {
            comment: decisionComment,
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
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildPlanReviewAuditEntry({
            action: args.decisionType === "revision_requested"
                ? "request_revision"
                : "reject",
            actorUserId: authContext.userId,
            departmentId: plan.departmentId,
            event: args.decisionType === "revision_requested"
                ? audit_1.AUDIT_EVENT_NAMES.planReviewRevisionRequested
                : audit_1.AUDIT_EVENT_NAMES.planReviewRejected,
            metadata: {
                comment: normalizedOptionalComment || null,
                decisionId: String(decisionId),
                flaggedTargetCount: flaggedTargets.targets.length,
                nextStatus: "rejected",
                previousStatus: "submitted",
                revisionDeadlineAt: revisionDeadline.value ?? null,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            planId: plan._id,
            tenantId: authContext.tenantId,
        }));
        const notification = await queuePlanReviewDecisionNotification(ctx, {
            comment: decisionComment,
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
            timeZone: (0, deadlines_1.resolveDeadlineTimeZone)({
                tenantTimeZone: tenant.timeZone,
            }).timeZone,
        });
        return {
            departmentBudgetChanged,
            notificationStatus: notification.notificationStatus,
            rejectedAt,
            status: args.decisionType,
            statusLabel: (0, review_decision_1.getProcurementOfficerPlanDecisionStatusLabel)(args.decisionType),
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
        notificationStatus: values_1.v.union(values_1.v.literal("failed"), values_1.v.literal("queued")),
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
        const [plan, tenantUser, authUser, tenant] = await Promise.all([
            ctx.db.get(normalizedPlanId),
            loadProcurementOfficerTenantUser(ctx, authContext),
            ctx.db.get(authContext.userId),
            ctx.db.get(authContext.tenantId),
        ]);
        if (!tenant || !plan || plan.tenantId !== authContext.tenantId) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        if (plan.status !== "submitted") {
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildPlanReviewAuditEntry({
                action: "approve",
                actorUserId: authContext.userId,
                departmentId: plan.departmentId,
                event: audit_1.AUDIT_EVENT_NAMES.planReviewApproved,
                metadata: {
                    nextStatus: plan.status,
                    previousStatus: plan.status,
                    reason: "Only submitted plans can be approved.",
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
                planId: plan._id,
                tenantId: authContext.tenantId,
            }));
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "Only submitted plans can be approved.",
            });
        }
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
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildPlanReviewAuditEntry({
            action: "approve",
            actorUserId: authContext.userId,
            departmentId: plan.departmentId,
            event: audit_1.AUDIT_EVENT_NAMES.planReviewApproved,
            metadata: {
                comment: normalizedOptionalComment || null,
                decisionId: String(decisionId),
                nextStatus: "approved",
                previousStatus: "submitted",
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            planId: plan._id,
            tenantId: authContext.tenantId,
        }));
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
            timeZone: (0, deadlines_1.resolveDeadlineTimeZone)({
                tenantTimeZone: tenant.timeZone,
            }).timeZone,
        });
        return {
            approvedAt,
            notificationStatus: notification.notificationStatus,
            status: "approved",
        };
    },
});
exports.undoProcurementOfficerPlanApproval = (0, server_1.mutation)({
    args: {
        planId: values_1.v.string(),
    },
    returns: values_1.v.object({
        reviewStartedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        status: values_1.v.literal("submitted"),
        undoneAt: values_1.v.number(),
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
        const plan = await ctx.db.get(normalizedPlanId);
        if (!plan || plan.tenantId !== authContext.tenantId) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            });
        }
        const eligibility = (0, review_decision_1.getProcurementOfficerUndoApprovalEligibility)({
            approvedAt: plan.approvedAt ?? null,
            consolidatedAt: plan.consolidatedAt ?? null,
            now: Date.now(),
            status: plan.status,
        });
        if (!eligibility.canUndo) {
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildPlanReviewAuditEntry({
                action: "undo_approval",
                actorUserId: authContext.userId,
                departmentId: plan.departmentId,
                event: audit_1.AUDIT_EVENT_NAMES.planReviewApprovalUndone,
                metadata: {
                    nextStatus: plan.status,
                    previousStatus: plan.status,
                    reason: eligibility.blockedReason,
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
                planId: plan._id,
                tenantId: authContext.tenantId,
            }));
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: eligibility.blockedReason ??
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
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildPlanReviewAuditEntry({
            action: "undo_approval",
            actorUserId: authContext.userId,
            departmentId: plan.departmentId,
            event: audit_1.AUDIT_EVENT_NAMES.planReviewApprovalUndone,
            metadata: {
                nextStatus: "submitted",
                previousStatus: "approved",
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            planId: plan._id,
            tenantId: authContext.tenantId,
        }));
        return {
            reviewStartedAt: plan.reviewStartedAt ?? null,
            status: "submitted",
            undoneAt,
        };
    },
});
