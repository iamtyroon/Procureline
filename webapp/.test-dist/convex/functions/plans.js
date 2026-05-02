"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawDepartmentUserPlanSubmission = exports.submitDepartmentUserPlan = exports.saveDepartmentUserWorkspaceDraft = exports.getDepartmentUserPlanWorkspace = exports.ensureDepartmentUserDraftPlan = exports.getDepartmentUserNewPlanWorkspaceContext = exports.loadTenantCatalog = exports.mapDepartmentDepartmentRecord = exports.planWorkspaceContextValidator = exports.workspaceDepartmentValidator = exports.workspaceCategoryValidator = exports.workspaceItemValidator = exports.workspaceCategorySummaryValidator = exports.workspaceRecordValidator = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const blockly_serialization_1 = require("../../lib/blockly/blockly-serialization");
const plan_submission_1 = require("../../lib/blockly/plan-submission");
const revision_feedback_1 = require("../../lib/department-user/revision-feedback");
const categories_1 = require("../../lib/procurement-officer/categories");
const workspace_save_1 = require("../../lib/blockly/workspace-save");
const du_plan_routes_1 = require("../../lib/blockly/du-plan-routes");
const du_toolbox_1 = require("../../lib/blockly/du-toolbox");
const audit_1 = require("../../lib/security/audit");
const submission_1 = require("../../lib/plans/submission");
const pre_submission_validation_1 = require("../../lib/plans/pre-submission-validation");
const revision_deadline_1 = require("../../lib/plans/revision-deadline");
const _roleGuard_1 = require("./_roleGuard");
const _audit_1 = require("./_audit");
const departmentUserWorkspaceStateValidator = values_1.v.union(values_1.v.literal("blocked"), values_1.v.literal("not_found"), values_1.v.literal("ready"), values_1.v.literal("redirect"));
exports.workspaceRecordValidator = values_1.v.object({
    editorMetadata: values_1.v.object({
        lastSavedAt: values_1.v.number(),
        lastSavedByUserId: values_1.v.string(),
        recoveredAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        revision: values_1.v.number(),
        saveSource: values_1.v.union(values_1.v.literal("workspace_clear"), values_1.v.literal("workspace_recovery"), values_1.v.literal("workspace_seed"), values_1.v.literal("workspace_sync")),
    }),
    format: values_1.v.literal("blockly_json"),
    schemaVersion: values_1.v.number(),
    workspaceJson: values_1.v.any(),
});
exports.workspaceCategorySummaryValidator = values_1.v.object({
    amount: values_1.v.number(),
    categoryId: values_1.v.string(),
    categoryName: values_1.v.string(),
    itemCount: values_1.v.number(),
});
exports.workspaceItemValidator = values_1.v.object({
    categoryId: values_1.v.string(),
    complianceFlags: values_1.v.optional(values_1.v.array(values_1.v.string())),
    description: values_1.v.union(values_1.v.string(), values_1.v.null()),
    id: values_1.v.string(),
    isActive: values_1.v.boolean(),
    lastPriceChangedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
    maxQuantity: values_1.v.union(values_1.v.number(), values_1.v.null()),
    minQuantity: values_1.v.union(values_1.v.number(), values_1.v.null()),
    name: values_1.v.string(),
    procurementMethod: values_1.v.union(values_1.v.string(), values_1.v.null()),
    sortOrder: values_1.v.number(),
    sourceOfFunds: values_1.v.union(values_1.v.string(), values_1.v.null()),
    unitOfMeasurement: values_1.v.union(values_1.v.string(), values_1.v.null()),
    unitPrice: values_1.v.union(values_1.v.number(), values_1.v.null()),
});
exports.workspaceCategoryValidator = values_1.v.object({
    color: values_1.v.union(values_1.v.string(), values_1.v.null()),
    id: values_1.v.string(),
    icon: values_1.v.union(values_1.v.string(), values_1.v.null()),
    isActive: values_1.v.boolean(),
    name: values_1.v.string(),
    sortOrder: values_1.v.number(),
});
exports.workspaceDepartmentValidator = values_1.v.object({
    budgetAllocation: values_1.v.union(values_1.v.number(), values_1.v.null()),
    code: values_1.v.string(),
    id: values_1.v.string(),
    name: values_1.v.string(),
    voteNumber: values_1.v.string(),
});
const planSubmissionEmailStatusValidator = values_1.v.union(values_1.v.literal("failed"), values_1.v.literal("queued"));
const revisionFlaggedTargetValidator = values_1.v.object({
    categoryId: values_1.v.string(),
    id: values_1.v.string(),
    itemId: values_1.v.union(values_1.v.string(), values_1.v.null()),
    label: values_1.v.string(),
    type: values_1.v.union(values_1.v.literal("category"), values_1.v.literal("item")),
});
const revisionDecisionValidator = values_1.v.object({
    comment: values_1.v.string(),
    decidedAt: values_1.v.number(),
    decisionType: values_1.v.union(values_1.v.literal("approved"), values_1.v.literal("rejected"), values_1.v.literal("revision_requested")),
    effectiveRevisionDeadlineAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
    flaggedTargets: values_1.v.array(revisionFlaggedTargetValidator),
    id: values_1.v.string(),
    lifecycleStatus: values_1.v.union(values_1.v.literal("active"), values_1.v.literal("superseded"), values_1.v.literal("undone"), values_1.v.null()),
    revisionDeadlineAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
    submissionReference: values_1.v.union(values_1.v.string(), values_1.v.null()),
});
const revisionHistoryEntryValidator = values_1.v.object({
    detail: values_1.v.string(),
    id: values_1.v.string(),
    kind: values_1.v.union(values_1.v.literal("approved"), values_1.v.literal("rejected"), values_1.v.literal("revision_requested"), values_1.v.literal("submitted"), values_1.v.literal("withdrawn")),
    timestamp: values_1.v.union(values_1.v.number(), values_1.v.null()),
    timestampLabel: values_1.v.string(),
    title: values_1.v.string(),
});
exports.planWorkspaceContextValidator = values_1.v.object({
    catalog: values_1.v.object({
        categories: values_1.v.array(exports.workspaceCategoryValidator),
        items: values_1.v.array(exports.workspaceItemValidator),
    }),
    department: exports.workspaceDepartmentValidator,
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
        timeZone: values_1.v.string(),
        title: values_1.v.string(),
        unavailableCategories: values_1.v.array(values_1.v.object({
            id: values_1.v.string(),
            name: values_1.v.string(),
            reason: values_1.v.string(),
        })),
    }),
    plan: values_1.v.union(values_1.v.object({
        canWithdraw: values_1.v.boolean(),
        categorySummaries: values_1.v.array(exports.workspaceCategorySummaryValidator),
        estimatedBudgetUsed: values_1.v.number(),
        id: values_1.v.string(),
        itemCount: values_1.v.number(),
        reviewStartedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        revisionContext: values_1.v.union(values_1.v.object({
            activeDecision: values_1.v.union(revisionDecisionValidator, values_1.v.null()),
            effectiveDeadlineExpired: values_1.v.boolean(),
            history: values_1.v.array(revisionHistoryEntryValidator),
            inconsistentStateMessage: values_1.v.union(values_1.v.string(), values_1.v.null()),
            reviewDecisions: values_1.v.array(revisionDecisionValidator),
        }), values_1.v.null()),
        selectedCategoryIds: values_1.v.array(values_1.v.string()),
        submissionEmailErrorMessage: values_1.v.union(values_1.v.string(), values_1.v.null()),
        submissionEmailStatus: values_1.v.union(planSubmissionEmailStatusValidator, values_1.v.null()),
        submissionReference: values_1.v.union(values_1.v.string(), values_1.v.null()),
        submittedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        status: values_1.v.union(values_1.v.literal("approved"), values_1.v.literal("draft"), values_1.v.literal("rejected"), values_1.v.literal("submitted")),
        workspaceState: exports.workspaceRecordValidator,
    }), values_1.v.null()),
    redirectHref: values_1.v.union(values_1.v.string(), values_1.v.null()),
    statusMessage: values_1.v.union(values_1.v.string(), values_1.v.null()),
});
const createPlanResultValidator = values_1.v.object({
    planId: values_1.v.string(),
    redirectedToExistingPlan: values_1.v.boolean(),
});
const submitDepartmentUserPlanResultValidator = values_1.v.object({
    canWithdraw: values_1.v.boolean(),
    emailErrorMessage: values_1.v.union(values_1.v.string(), values_1.v.null()),
    emailStatus: values_1.v.union(planSubmissionEmailStatusValidator, values_1.v.null()),
    status: values_1.v.literal("submitted"),
    submissionReference: values_1.v.string(),
    submittedAt: values_1.v.number(),
});
const withdrawDepartmentUserPlanResultValidator = values_1.v.object({
    status: values_1.v.literal("draft"),
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
        voteNumber: department.voteNumber ?? department.code,
    };
}
exports.mapDepartmentDepartmentRecord = mapDepartmentDepartmentRecord;
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
            color: category.color ?? null,
            id: String(category._id),
            icon: (0, categories_1.normalizeCategoryIcon)(category.icon ?? null) ?? null,
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
exports.loadTenantCatalog = loadTenantCatalog;
async function loadCanonicalDepartmentPlans(ctx, departmentId) {
    const plans = await ctx.db
        .query("plans")
        .withIndex("by_departmentId", (q) => q.eq("departmentId", departmentId))
        .collect();
    return plans.sort((left, right) => right.updatedAt - left.updatedAt);
}
async function loadNewestSharedSubmissionDeadline(ctx, args) {
    const sharedDeadlines = await ctx.db
        .query("submissionDeadlines")
        .withIndex("by_tenantId_fiscalYearKey", (q) => q.eq("tenantId", args.tenantId).eq("fiscalYearKey", args.fiscalYear))
        .collect();
    return (sharedDeadlines.sort((left, right) => right.deadlineVersion - left.deadlineVersion ||
        right.updatedAt - left.updatedAt)[0] ?? null);
}
function buildDepartmentUserRevisionAuditEntry(args) {
    return {
        action: "read_revision_context",
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "department_user",
            userId: String(args.actorUserId),
        }),
        entityType: "plan",
        event: audit_1.AUDIT_EVENT_NAMES.planRevisionContextBlocked,
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
function mapDepartmentUserRevisionDecision(args) {
    const effectiveDeadline = (0, revision_deadline_1.deriveDepartmentUserEffectiveRevisionDeadline)({
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
function resolveRevisionDecisionSubmissionReference(args) {
    const matchingSnapshot = [...args.planSnapshots]
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
        return ((right.submissionSequence ?? Number.MIN_SAFE_INTEGER) -
            (left.submissionSequence ?? Number.MIN_SAFE_INTEGER));
    })[0] ?? null;
    return matchingSnapshot?.submissionReference ?? null;
}
async function loadDepartmentUserRevisionContext(ctx, args) {
    const decisions = await ctx.db
        .query("planReviewDecisions")
        .withIndex("by_planId_decidedAt", (q) => q.eq("planId", args.plan._id))
        .collect();
    const activeDecisions = decisions.filter((decision) => decision.lifecycleStatus === "active");
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
    const activeDuVisibleDecisions = activeDecisions.filter((decision) => decision.decisionType === "rejected" ||
        decision.decisionType === "revision_requested");
    let inconsistentStateMessage = null;
    if (requiresAuthoritativeDecision && activeDuVisibleDecisions.length !== 1) {
        inconsistentStateMessage =
            activeDuVisibleDecisions.length === 0
                ? "Revision feedback is temporarily unavailable because the active Procurement decision could not be confirmed."
                : "Revision feedback is temporarily unavailable because multiple active Procurement decisions were found for this plan.";
        await (0, _audit_1.appendAuditLogBestEffort)(ctx, buildDepartmentUserRevisionAuditEntry({
            actorUserId: args.actorUserId,
            departmentId: args.departmentId,
            metadata: {
                activeDecisionCount: activeDuVisibleDecisions.length,
                planStatus: args.plan.status,
                reason: activeDuVisibleDecisions.length === 0
                    ? "missing_active_revision_decision"
                    : "multiple_active_revision_decisions",
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
            planId: args.plan._id,
            tenantId: args.tenantId,
        }));
    }
    const activeDecision = inconsistentStateMessage === null
        ? activeDuVisibleDecisions
            .map((decision) => mapDepartmentUserRevisionDecision({
            decision,
            submissionDeadlineAt: args.submissionDeadlineAt,
            submissionReference: resolveRevisionDecisionSubmissionReference({
                decision,
                planSnapshots: args.planSnapshots,
            }),
        }))
            .sort((left, right) => right.decidedAt - left.decidedAt)[0] ?? null
        : null;
    return {
        activeDecision,
        effectiveDeadlineExpired: (0, revision_deadline_1.hasDepartmentUserRevisionDeadlineExpired)({
            deadlineAt: activeDecision?.effectiveRevisionDeadlineAt ?? null,
            now: Date.now(),
        }),
        history: (0, revision_feedback_1.buildDepartmentUserRevisionHistory)({
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
        inconsistentStateMessage,
        reviewDecisions: reviewDecisions.sort((left, right) => right.decidedAt - left.decidedAt),
    };
}
async function loadDepartmentUserTenantUser(ctx, args) {
    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) => q.eq("userId", args.userId).eq("tenantId", args.tenantId))
        .first();
    if (!tenantUser || tenantUser.role !== "department_user" || !tenantUser.isActive) {
        unexpectedAccessError();
    }
    return tenantUser;
}
function toNormalizedWorkspaceRecord(plan, userId) {
    return (0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(plan.workspaceState, {
        lastSavedAt: plan.updatedAt,
        lastSavedByUserId: String(userId),
    });
}
function buildDepartmentUserPlanAuditEntry(args) {
    return {
        action: args.action,
        actor: (0, audit_1.createAuthenticatedAuditActor)({
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
    };
}
function buildBlockedSubmissionError(message) {
    throw new values_1.ConvexError({
        code: "VALIDATION_FAILED",
        message,
    });
}
function getPrimaryBlockedSubmissionMessage(args) {
    return (args.issues.find((issue) => issue.blocksSubmission)?.message ??
        args.fallback);
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
            timeZone: "Africa/Nairobi",
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
    returns: exports.planWorkspaceContextValidator,
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
                    timeZone: "Africa/Nairobi",
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
        accessRefreshKey: values_1.v.optional(values_1.v.number()),
        planId: values_1.v.string(),
        requestedMode: values_1.v.optional(values_1.v.union(values_1.v.literal("edit"), values_1.v.literal("view"))),
    },
    returns: exports.planWorkspaceContextValidator,
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
                    timeZone: "Africa/Nairobi",
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
            submissionDeadlineAt: newestSharedDeadline?.submissionEndsAt ??
                base.department.submissionEndsAt ??
                null,
            tenantId: base.authContext.tenantId,
            timeZone: tenant?.timeZone ?? "Africa/Nairobi",
        });
        if (revisionContext.inconsistentStateMessage) {
            return {
                catalog,
                department: mapDepartmentDepartmentRecord(base.department),
                meta: {
                    accessMode: base.authContext.departmentAccessMode ?? null,
                    actor: "department_user",
                    actorLabel: "Department User",
                    availableToolbarActions: ["exit"],
                    currentUserId: String(base.authContext.userId),
                    fiscalYear: plan.fiscalYear,
                    mode: "view",
                    modeIndicatorLabel: null,
                    selectedCategoryIds: sanitizedSelection.sanitizedCategoryIds,
                    state: "blocked",
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
        const mode = (0, du_plan_routes_1.resolveDepartmentUserWorkspaceMode)({
            accessMode: base.authContext.departmentAccessMode,
            requestedMode: plan.status === "rejected" && revisionContext.effectiveDeadlineExpired
                ? "view"
                : (args.requestedMode ?? null),
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
                subtitle: plan.status === "rejected" &&
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
                canWithdraw: plan.status === "submitted" &&
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
                revisionContext,
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
exports.saveDepartmentUserWorkspaceDraft = (0, server_1.mutation)({
    args: {
        categorySummaries: values_1.v.array(exports.workspaceCategorySummaryValidator),
        estimatedBudgetUsed: values_1.v.number(),
        itemCount: values_1.v.number(),
        planId: values_1.v.string(),
        selectedCategoryIds: values_1.v.array(values_1.v.string()),
        workspaceState: exports.workspaceRecordValidator,
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
        if (plan.status === "rejected") {
            const tenant = await ctx.db.get(base.authContext.tenantId);
            const revisionContext = await loadDepartmentUserRevisionContext(ctx, {
                actorUserId: base.authContext.userId,
                departmentId: base.department._id,
                plan,
                planSnapshots: [],
                submissionDeadlineAt: (await loadNewestSharedSubmissionDeadline(ctx, {
                    fiscalYear: plan.fiscalYear,
                    tenantId: base.authContext.tenantId,
                }))?.submissionEndsAt ??
                    base.department.submissionEndsAt ??
                    null,
                tenantId: base.authContext.tenantId,
                timeZone: tenant?.timeZone ?? "Africa/Nairobi",
            });
            if (revisionContext.inconsistentStateMessage ||
                revisionContext.effectiveDeadlineExpired) {
                throw new values_1.ConvexError({
                    code: "VALIDATION_FAILED",
                    message: revisionContext.inconsistentStateMessage ??
                        "This revision window has expired, so the plan can no longer be edited from the current Department User session.",
                });
            }
        }
        const persistenceResult = (0, workspace_save_1.prepareDepartmentUserWorkspaceDraftPersistence)({
            accessMode: base.authContext.departmentAccessMode,
            categories: catalog.categories,
            categoryDocs,
            currentUserId: String(base.authContext.userId),
            existingSelectedCategoryIds: plan.selectedCategoryIds,
            items: catalog.items,
            planStatus: plan.status,
            persistedWorkspaceState: (0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(plan.workspaceState, {
                lastSavedAt: plan.updatedAt,
                lastSavedByUserId: String(base.authContext.userId),
            }),
            totalBudget: base.department.budgetAllocation ?? null,
            workspaceState: args.workspaceState,
        });
        if (!persistenceResult.ok) {
            throw new values_1.ConvexError({
                code: persistenceResult.code,
                message: persistenceResult.message,
            });
        }
        await ctx.db.patch(plan._id, persistenceResult.patch);
        return { savedAt: persistenceResult.patch.updatedAt };
    },
});
exports.submitDepartmentUserPlan = (0, server_1.mutation)({
    args: {
        expectedDecisionDecidedAt: values_1.v.optional(values_1.v.number()),
        expectedDecisionId: values_1.v.optional(values_1.v.string()),
        planId: values_1.v.string(),
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
            throw new values_1.ConvexError({
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
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: "Plan not found for this department.",
            });
        }
        if ((0, plan_submission_1.shouldReplayDepartmentUserSubmittedPlan)({
            status: plan.status,
            submittedAt: plan.submittedAt ?? null,
            submissionReference: plan.submissionReference ?? null,
        })) {
            return {
                canWithdraw: typeof plan.reviewStartedAt !== "number",
                emailErrorMessage: plan.submissionEmailErrorMessage ?? null,
                emailStatus: plan.submissionEmailStatus ?? null,
                status: "submitted",
                submissionReference: plan.submissionReference,
                submittedAt: plan.submittedAt,
            };
        }
        if (!(0, du_plan_routes_1.canDepartmentUserEditWorkspace)({
            accessMode: base.authContext.departmentAccessMode,
            status: plan.status,
        })) {
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentUserPlanAuditEntry({
                action: "submit",
                actorUserId: base.authContext.userId,
                departmentId: department._id,
                event: audit_1.AUDIT_EVENT_NAMES.planSubmissionBlocked,
                metadata: {
                    planStatus: plan.status,
                    reason: "plan_not_editable",
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
                planId: plan._id,
                tenantId: base.authContext.tenantId,
            }));
            buildBlockedSubmissionError("This plan is no longer editable from the current Department User session.");
        }
        const [newestSharedDeadline, tenant] = await Promise.all([
            loadNewestSharedSubmissionDeadline(ctx, {
                fiscalYear: plan.fiscalYear,
                tenantId: base.authContext.tenantId,
            }),
            ctx.db.get(base.authContext.tenantId),
        ]);
        const revisionContext = plan.status === "rejected"
            ? await loadDepartmentUserRevisionContext(ctx, {
                actorUserId: base.authContext.userId,
                departmentId: department._id,
                plan,
                planSnapshots,
                submissionDeadlineAt: newestSharedDeadline?.submissionEndsAt ??
                    department.submissionEndsAt ??
                    null,
                tenantId: base.authContext.tenantId,
                timeZone: tenant?.timeZone ?? "Africa/Nairobi",
            })
            : null;
        if (plan.status !== "draft" && plan.status !== "rejected") {
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentUserPlanAuditEntry({
                action: "submit",
                actorUserId: base.authContext.userId,
                departmentId: department._id,
                event: audit_1.AUDIT_EVENT_NAMES.planSubmissionBlocked,
                metadata: {
                    planStatus: plan.status,
                    reason: "illegal_plan_status",
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
                planId: plan._id,
                tenantId: base.authContext.tenantId,
            }));
            buildBlockedSubmissionError("Only draft plans or active revision plans can be submitted to Procurement.");
        }
        if (plan.status === "rejected") {
            if (!revisionContext || revisionContext.inconsistentStateMessage) {
                await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentUserPlanAuditEntry({
                    action: "submit",
                    actorUserId: base.authContext.userId,
                    departmentId: department._id,
                    event: audit_1.AUDIT_EVENT_NAMES.planSubmissionBlocked,
                    metadata: {
                        planStatus: plan.status,
                        reason: "revision_context_unavailable",
                    },
                    outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: base.authContext.tenantId,
                }));
                buildBlockedSubmissionError(revisionContext?.inconsistentStateMessage ??
                    "Revision feedback is temporarily unavailable. Refresh the workspace before trying again.");
            }
            const activeDecision = revisionContext.activeDecision;
            if (!activeDecision ||
                !args.expectedDecisionId ||
                typeof args.expectedDecisionDecidedAt !== "number" ||
                activeDecision.id !== args.expectedDecisionId ||
                activeDecision.decidedAt !== args.expectedDecisionDecidedAt) {
                await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentUserPlanAuditEntry({
                    action: "submit",
                    actorUserId: base.authContext.userId,
                    departmentId: department._id,
                    event: audit_1.AUDIT_EVENT_NAMES.planSubmissionBlocked,
                    metadata: {
                        activeDecisionDecidedAt: activeDecision?.decidedAt ?? null,
                        activeDecisionId: activeDecision?.id ?? null,
                        expectedDecisionDecidedAt: args.expectedDecisionDecidedAt ?? null,
                        expectedDecisionId: args.expectedDecisionId ?? null,
                        planStatus: plan.status,
                        reason: "stale_revision_decision",
                    },
                    outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: base.authContext.tenantId,
                }));
                buildBlockedSubmissionError("Procurement feedback changed while you were editing. Refresh this plan before submitting again.");
            }
            if (revisionContext.effectiveDeadlineExpired) {
                await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentUserPlanAuditEntry({
                    action: "submit",
                    actorUserId: base.authContext.userId,
                    departmentId: department._id,
                    event: audit_1.AUDIT_EVENT_NAMES.planSubmissionBlocked,
                    metadata: {
                        effectiveRevisionDeadlineAt: activeDecision.effectiveRevisionDeadlineAt ?? null,
                        planStatus: plan.status,
                        reason: "revision_deadline_expired",
                    },
                    outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: base.authContext.tenantId,
                }));
                buildBlockedSubmissionError("The revision deadline for this plan has expired. Contact your Procurement Officer for guidance.");
            }
        }
        const normalizedWorkspaceState = toNormalizedWorkspaceRecord(plan, base.authContext.userId);
        const submissionDraftSummary = (0, workspace_save_1.deriveDepartmentUserWorkspaceDraftPersistenceSummary)({
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
                .withIndex("by_tenantId_fiscalYearKey", (q) => q
                .eq("tenantId", base.authContext.tenantId)
                .eq("fiscalYearKey", plan.fiscalYear))
                .collect(),
        ]);
        const pendingCategoryRequests = categoryRequests.filter((request) => request.tenantId === base.authContext.tenantId &&
            request.departmentId === department._id &&
            request.fiscalYear === plan.fiscalYear &&
            request.status === "pending");
        const pendingItemRequests = itemRequests.filter((request) => request.tenantId === base.authContext.tenantId &&
            request.departmentId === department._id &&
            request.fiscalYear === plan.fiscalYear &&
            request.status === "pending");
        const pendingLinkedCategoryIds = new Set(pendingItemRequests
            .map((request) => request.linkedCategoryRequestId ?? null)
            .filter((requestId) => Boolean(requestId))
            .map((requestId) => String(requestId)));
        const countedPendingCategoryRequestIds = new Set(pendingCategoryRequests.map((request) => String(request._id)));
        const pendingLinkedCategoryHandoffCount = Array.from(pendingLinkedCategoryIds).filter((requestId) => !countedPendingCategoryRequestIds.has(requestId)).length;
        const pendingRequestValidation = (0, pre_submission_validation_1.summarizePendingCatalogRequestBlockers)({
            pendingCategoryRequestCount: pendingCategoryRequests.length,
            pendingItemRequestCount: pendingItemRequests.length,
            pendingLinkedCategoryHandoffCount,
        });
        const resolvedSharedDeadline = sharedDeadlines
            .filter((deadline) => deadline.tenantId === base.authContext.tenantId)
            .sort((left, right) => right.deadlineVersion - left.deadlineVersion ||
            right.updatedAt - left.updatedAt)[0] ?? null;
        const deadlineIssue = (0, pre_submission_validation_1.evaluateSubmissionDeadlineIssue)({
            now: Date.now(),
            window: (0, pre_submission_validation_1.resolveEffectiveSubmissionWindow)({
                departmentSubmissionEndsAt: department.submissionEndsAt ?? null,
                departmentSubmissionStartsAt: department.submissionStartsAt ?? null,
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
        const revisionIssues = revisionContext?.activeDecision
            ? (0, revision_feedback_1.mapDepartmentUserFlaggedTargetsToIssues)({
                flaggedTargets: revisionContext.activeDecision.flaggedTargets,
                workspaceSummary,
            })
            : [];
        const supplementalIssues = [
            pendingRequestValidation.issue,
            deadlineIssue,
            ...revisionIssues,
        ].filter((issue) => Boolean(issue));
        const supplementalBlockerMessages = supplementalIssues.map((issue) => issue.message);
        const submitState = (0, plan_submission_1.getDepartmentUserPlanSubmitState)({
            budgetState: workspaceSummary?.budgetState ?? {
                advisoryText: "Budget allocation is unavailable. Planning totals remain visible, but submission must stay blocked until a usable budget is assigned.",
                announcementText: "Department budget allocation is unavailable. Submission remains blocked until a budget is assigned.",
                bannerText: null,
                canSubmitByBudget: false,
                overBudgetAmount: 0,
                remainingBudget: null,
                state: "unallocated",
                statusLabel: "Budget not allocated",
                totalBudget: null,
                usageLabel: "Unallocated",
                usedAmount: submissionDraftSummary?.estimatedBudgetUsed ??
                    plan.estimatedBudgetUsed,
                usedPercent: null,
            },
            hasUnsyncedChanges: false,
            mode: "edit",
            saveState: "saved",
            supplementalBlockerMessages,
            totalItemCount: submissionDraftSummary?.itemCount ?? workspaceSummary?.totalItemCount ?? plan.itemCount,
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
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentUserPlanAuditEntry({
                action: "submit",
                actorUserId: base.authContext.userId,
                departmentId: department._id,
                event: audit_1.AUDIT_EVENT_NAMES.planSubmissionBlocked,
                metadata: {
                    issueCodes,
                    planStatus: plan.status,
                    primaryMessage,
                    reason: submitState.reason,
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
                planId: plan._id,
                tenantId: base.authContext.tenantId,
            }));
            buildBlockedSubmissionError(submitState.reason);
        }
        if (!submissionDraftSummary) {
            const reason = "Workspace state is malformed and could not be recalculated safely for submission.";
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentUserPlanAuditEntry({
                action: "submit",
                actorUserId: base.authContext.userId,
                departmentId: department._id,
                event: audit_1.AUDIT_EVENT_NAMES.planSubmissionBlocked,
                metadata: {
                    planStatus: plan.status,
                    reason,
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
                planId: plan._id,
                tenantId: base.authContext.tenantId,
            }));
            buildBlockedSubmissionError(reason);
        }
        const submissionPersistence = (0, submission_1.buildPlanSubmissionPersistenceRecord)({
            categorySummaries: submissionDraftSummary.categorySummaries,
            estimatedBudgetUsed: submissionDraftSummary.estimatedBudgetUsed,
            existingSelectedCategoryIds: plan.selectedCategoryIds.map((categoryId) => String(categoryId)),
            itemCount: submissionDraftSummary.itemCount,
        });
        const persistedCategorySummaries = submissionPersistence.categorySummaries
            .map((summary) => {
            const categoryId = ctx.db.normalizeId("procurementCategories", summary.categoryId);
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
            .filter((summary) => Boolean(summary));
        const persistedSelectedCategoryIds = submissionPersistence.selectedCategoryIds
            .map((categoryId) => ctx.db.normalizeId("procurementCategories", categoryId))
            .filter((categoryId) => categoryId !== null);
        const nextSubmissionSequence = (0, submission_1.getNextPlanSubmissionSequence)(planSnapshots.map((snapshot) => ({
            submissionSequence: snapshot.submissionSequence ?? null,
        })));
        const now = Date.now();
        const submissionReference = (0, submission_1.formatPlanSubmissionReference)({
            departmentCode: department.code,
            fiscalYear: plan.fiscalYear,
            submissionSequence: nextSubmissionSequence,
        });
        const submissionSequenceKey = (0, submission_1.buildPlanSubmissionSequenceKey)({
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
            const activeDecisionId = ctx.db.normalizeId("planReviewDecisions", revisionContext.activeDecision.id);
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
            workspaceState: (0, blockly_serialization_1.createPersistedBlocklyWorkspaceRecord)(normalizedWorkspaceState),
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentUserPlanAuditEntry({
            action: "submit",
            actorUserId: base.authContext.userId,
            departmentId: department._id,
            event: audit_1.AUDIT_EVENT_NAMES.planSubmitted,
            metadata: {
                itemCount: submissionPersistence.itemCount,
                estimatedBudgetUsed: submissionPersistence.estimatedBudgetUsed,
                submissionReference,
                submissionSequence: nextSubmissionSequence,
                submittedAt: now,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            planId: plan._id,
            tenantId: base.authContext.tenantId,
        }));
        let emailStatus = null;
        let emailErrorMessage = null;
        const recipientEmail = authUser && typeof authUser.email === "string" && authUser.email.trim().length > 0
            ? authUser.email.trim()
            : null;
        if (!recipientEmail) {
            emailStatus = "failed";
            emailErrorMessage =
                "The confirmation email could not be queued because no Department User email address is available on this account.";
        }
        else {
            try {
                await ctx.scheduler.runAfter(0, "actions/email:queueTransactionalEmail", {
                    idempotencyKey: (0, submission_1.buildPlanSubmissionEmailIdempotencyKey)({
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
            }
            catch (error) {
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
            await (0, _audit_1.appendAuditLogBestEffort)(ctx, buildDepartmentUserPlanAuditEntry({
                action: "submit",
                actorUserId: base.authContext.userId,
                departmentId: department._id,
                event: emailStatus === "queued"
                    ? audit_1.AUDIT_EVENT_NAMES.planSubmissionEmailQueued
                    : audit_1.AUDIT_EVENT_NAMES.planSubmissionEmailFailed,
                metadata: {
                    emailErrorMessage,
                    recipientEmail,
                    submissionReference,
                    submissionSequence: nextSubmissionSequence,
                },
                outcome: emailStatus === "queued"
                    ? audit_1.AUDIT_OUTCOMES.queued
                    : audit_1.AUDIT_OUTCOMES.failed,
                planId: plan._id,
                tenantId: base.authContext.tenantId,
            }));
        }
        return {
            canWithdraw: true,
            emailErrorMessage,
            emailStatus,
            status: "submitted",
            submissionReference,
            submittedAt: now,
        };
    },
});
exports.withdrawDepartmentUserPlanSubmission = (0, server_1.mutation)({
    args: {
        planId: values_1.v.string(),
    },
    returns: withdrawDepartmentUserPlanResultValidator,
    handler: async (ctx, args) => {
        const base = await loadDepartmentUserPlanBase(ctx);
        if (!base.department) {
            unexpectedAccessError();
        }
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!normalizedPlanId) {
            throw new values_1.ConvexError({
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
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: "Plan not found for this department.",
            });
        }
        if (plan.status !== "submitted") {
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentUserPlanAuditEntry({
                action: "withdraw",
                actorUserId: base.authContext.userId,
                departmentId: base.department._id,
                event: audit_1.AUDIT_EVENT_NAMES.planWithdrawalBlocked,
                metadata: {
                    planStatus: plan.status,
                    reason: "illegal_plan_status",
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
                planId: plan._id,
                tenantId: base.authContext.tenantId,
            }));
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "Only submitted plans can be withdrawn back to draft.",
            });
        }
        if (typeof plan.reviewStartedAt === "number") {
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentUserPlanAuditEntry({
                action: "withdraw",
                actorUserId: base.authContext.userId,
                departmentId: base.department._id,
                event: audit_1.AUDIT_EVENT_NAMES.planWithdrawalBlocked,
                metadata: {
                    reason: "review_already_started",
                    reviewStartedAt: plan.reviewStartedAt,
                    submissionReference: plan.submissionReference ?? null,
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
                planId: plan._id,
                tenantId: base.authContext.tenantId,
            }));
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "This submission can no longer be withdrawn because Procurement review has already started.",
            });
        }
        const activeSnapshot = (0, submission_1.resolveLatestActivePlanSubmissionSnapshot)(planSnapshots.map((snapshot) => ({
            ...snapshot,
            lifecycleStatus: (0, submission_1.normalizePlanSubmissionLifecycleStatus)(snapshot.lifecycleStatus ?? null),
        })));
        const now = Date.now();
        if (activeSnapshot) {
            await ctx.db.patch(activeSnapshot._id, {
                lifecycleStatus: "withdrawn",
                withdrawnAt: now,
                withdrawnByTenantUserId: tenantUser._id,
                withdrawnByUserId: base.authContext.userId,
            });
        }
        else if ((0, submission_1.shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot)({
            activeSnapshotExists: false,
            planStatus: plan.status,
            submissionReference: plan.submissionReference ?? null,
            submittedAt: plan.submittedAt ?? null,
        })) {
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
                departmentCodeSnapshot: plan.departmentCodeSnapshot ?? base.department.code,
                departmentId: plan.departmentId,
                departmentNameSnapshot: plan.departmentNameSnapshot ?? base.department.name,
                estimatedBudgetUsed: plan.estimatedBudgetUsed,
                fiscalYear: plan.fiscalYear,
                itemCount: plan.itemCount,
                lifecycleStatus: "withdrawn",
                planId: plan._id,
                selectedCategoryIds: plan.selectedCategoryIds.map((categoryId) => String(categoryId)),
                submissionReference: plan.submissionReference ?? undefined,
                submissionSequence: plan.submissionSequence ?? undefined,
                submissionSequenceKey: (0, submission_1.buildPlanSubmissionSequenceKey)({
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
                workspaceState: (0, blockly_serialization_1.createPersistedBlocklyWorkspaceRecord)(toNormalizedWorkspaceRecord(plan, base.authContext.userId)),
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
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentUserPlanAuditEntry({
            action: "withdraw",
            actorUserId: base.authContext.userId,
            departmentId: base.department._id,
            event: audit_1.AUDIT_EVENT_NAMES.planWithdrawn,
            metadata: {
                submissionReference: plan.submissionReference ?? null,
                withdrawnAt: now,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            planId: plan._id,
            tenantId: base.authContext.tenantId,
        }));
        return {
            status: "draft",
        };
    },
});
