"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.denyProcurementOfficerPlanRedraftRequest = exports.approveProcurementOfficerPlanRedraftRequest = exports.getProcurementOfficerPlanRedraftRequests = exports.requestDepartmentUserPlanRedraft = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const blockly_serialization_1 = require("../../lib/shared/blockly/blockly-serialization");
const redraft_1 = require("../../lib/plans/redraft");
const deadlines_1 = require("../../lib/procurement-officer/deadlines");
const audit_1 = require("../../lib/shared/security/audit");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
async function loadTenantUserForRole(ctx, args) {
    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) => q.eq("userId", args.userId).eq("tenantId", args.tenantId))
        .first();
    if (!tenantUser || !tenantUser.isActive || tenantUser.role !== args.role) {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: args.role === "department_user"
                ? "Department User access is required for redraft requests."
                : "Procurement Officer access is required for redraft decisions.",
        });
    }
    return tenantUser;
}
async function loadDepartmentUserDepartment(ctx, args) {
    const profile = await ctx.db
        .query("departmentUserProfiles")
        .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", args.tenantUserId))
        .first();
    if (!profile || !profile.isActive) {
        throw new values_1.ConvexError({
            code: "DEPARTMENT_NOT_FOUND",
            message: "Department setup is incomplete for this Department User.",
        });
    }
    const department = await ctx.db.get(profile.departmentId);
    if (!department || department.tenantId !== args.tenantId || !department.isActive) {
        throw new values_1.ConvexError({
            code: "DEPARTMENT_NOT_FOUND",
            message: "Department setup is incomplete for this Department User.",
        });
    }
    return department;
}
function buildPlanRedraftAuditEntry(args) {
    return {
        action: args.action,
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: args.actorRole,
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
function getCurrentFiscalYear(args) {
    return (0, deadlines_1.getFiscalYearForTimestampInTimeZone)({
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        timestamp: args.now,
        timeZone: args.timeZone ?? "Africa/Nairobi",
    }).key;
}
async function loadPendingRequestForPlan(ctx, planId) {
    return ctx.db
        .query("planRedraftRequests")
        .withIndex("by_planId_status", (q) => q.eq("planId", planId).eq("status", "pending"))
        .first();
}
exports.requestDepartmentUserPlanRedraft = (0, server_1.mutation)({
    args: {
        planId: values_1.v.string(),
        reason: values_1.v.string(),
    },
    returns: values_1.v.object({
        requestId: values_1.v.string(),
        status: values_1.v.literal("pending"),
    }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["department_user"]);
        const tenant = await ctx.db.get(authContext.tenantId);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        if (!tenant || !normalizedPlanId) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: "Approved plan not found.",
            });
        }
        const reason = (0, redraft_1.normalizePlanRedraftReason)(args.reason);
        if (!reason.ok || !reason.value) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: reason.message ?? "Explain why this approved plan needs to be redrafted.",
            });
        }
        const tenantUser = await loadTenantUserForRole(ctx, {
            role: "department_user",
            tenantId: authContext.tenantId,
            userId: authContext.userId,
        });
        const department = await loadDepartmentUserDepartment(ctx, {
            tenantId: authContext.tenantId,
            tenantUserId: tenantUser._id,
        });
        const [plan, pendingRequest] = await Promise.all([
            ctx.db.get(normalizedPlanId),
            loadPendingRequestForPlan(ctx, normalizedPlanId),
        ]);
        const currentFiscalYear = getCurrentFiscalYear({
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            now: Date.now(),
            timeZone: tenant.timeZone,
        });
        const eligibility = (0, redraft_1.getPlanRedraftRequestEligibility)({
            currentFiscalYear,
            departmentId: String(department._id),
            pendingRequestExists: pendingRequest !== null,
            plan: plan
                ? {
                    approvedAt: plan.approvedAt ?? null,
                    departmentId: String(plan.departmentId),
                    fiscalYear: plan.fiscalYear,
                    id: String(plan._id),
                    status: plan.status,
                    tenantId: String(plan.tenantId),
                }
                : null,
            tenantId: String(authContext.tenantId),
        });
        if (!eligibility.canRequest) {
            if (plan) {
                await (0, _audit_1.appendAuditLogRequired)(ctx, buildPlanRedraftAuditEntry({
                    action: "request_redraft",
                    actorRole: "department_user",
                    actorUserId: authContext.userId,
                    departmentId: department._id,
                    event: audit_1.AUDIT_EVENT_NAMES.planRedraftRequested,
                    metadata: {
                        reason: eligibility.message,
                        requestBlocked: true,
                    },
                    outcome: audit_1.AUDIT_OUTCOMES.blockedStateTransition,
                    planId: plan._id,
                    tenantId: authContext.tenantId,
                }));
            }
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: eligibility.message ?? "This plan cannot be requested for redraft.",
            });
        }
        if (!plan) {
            throw new values_1.ConvexError({
                code: "PLAN_NOT_FOUND",
                message: "Approved plan not found.",
            });
        }
        const now = Date.now();
        const requestId = await ctx.db.insert("planRedraftRequests", {
            createdAt: now,
            departmentId: department._id,
            fiscalYear: plan.fiscalYear,
            planId: plan._id,
            reason: reason.value,
            requestorTenantUserId: tenantUser._id,
            requestorUserId: authContext.userId,
            status: "pending",
            tenantId: authContext.tenantId,
            updatedAt: now,
        });
        await ctx.db.patch(plan._id, {
            redraftReason: reason.value,
            redraftRequestedAt: now,
            updatedAt: now,
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildPlanRedraftAuditEntry({
            action: "request_redraft",
            actorRole: "department_user",
            actorUserId: authContext.userId,
            departmentId: department._id,
            event: audit_1.AUDIT_EVENT_NAMES.planRedraftRequested,
            metadata: {
                requestId: String(requestId),
                reason: reason.value,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            planId: plan._id,
            tenantId: authContext.tenantId,
        }));
        return {
            requestId: String(requestId),
            status: "pending",
        };
    },
});
exports.getProcurementOfficerPlanRedraftRequests = (0, server_1.query)({
    args: {},
    returns: values_1.v.any(),
    handler: async (ctx) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const [requests, departments, plans] = await Promise.all([
            ctx.db
                .query("planRedraftRequests")
                .withIndex("by_tenantId_status", (q) => q.eq("tenantId", authContext.tenantId).eq("status", "pending"))
                .collect(),
            ctx.db
                .query("departments")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("plans")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
        ]);
        const departmentById = new Map(departments.map((department) => [String(department._id), department]));
        const planById = new Map(plans.map((plan) => [String(plan._id), plan]));
        return requests
            .map((request) => {
            const department = departmentById.get(String(request.departmentId));
            const plan = planById.get(String(request.planId));
            return {
                createdAt: request.createdAt,
                departmentCode: department?.code ?? null,
                departmentName: department?.name ?? "Department unavailable",
                fiscalYear: request.fiscalYear,
                id: String(request._id),
                planId: String(request.planId),
                planStatus: plan?.status ?? "missing",
                reason: request.reason,
                status: request.status,
                submissionReference: plan?.submissionReference ?? null,
            };
        })
            .sort((left, right) => right.createdAt - left.createdAt);
    },
});
async function loadPendingPlanRedraftDecisionContext(ctx, args) {
    const normalizedRequestId = ctx.db.normalizeId("planRedraftRequests", args.requestId);
    if (!normalizedRequestId) {
        throw new values_1.ConvexError({
            code: "REQUEST_NOT_FOUND",
            message: "Redraft request not found.",
        });
    }
    const request = await ctx.db.get(normalizedRequestId);
    if (!request || request.tenantId !== args.tenantId || request.status !== "pending") {
        throw new values_1.ConvexError({
            code: "REQUEST_NOT_FOUND",
            message: "Pending redraft request not found.",
        });
    }
    const plan = await ctx.db.get(request.planId);
    if (!plan || plan.tenantId !== args.tenantId || plan.departmentId !== request.departmentId) {
        throw new values_1.ConvexError({
            code: "PLAN_NOT_FOUND",
            message: "Approved plan not found for this redraft request.",
        });
    }
    return { plan, request };
}
function normalizeDecisionNote(value) {
    const normalized = (value ?? "").trim().replace(/\s+/g, " ");
    return normalized.length > 0 ? normalized.slice(0, 500) : undefined;
}
async function ensureLastApprovedBaselineSnapshot(ctx, args) {
    const approvedAt = args.plan.approvedAt;
    if (typeof approvedAt !== "number") {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            message: "This approved plan is missing its approval timestamp.",
        });
    }
    const submissionSequenceKey = (0, redraft_1.buildApprovedPlanRedraftSnapshotKey)({
        approvedAt,
        planId: String(args.plan._id),
        tenantId: String(args.plan.tenantId),
    });
    const existingSnapshot = await ctx.db
        .query("planSubmissionSnapshots")
        .withIndex("by_submissionSequenceKey", (q) => q.eq("submissionSequenceKey", submissionSequenceKey))
        .first();
    if (existingSnapshot) {
        return existingSnapshot._id;
    }
    return ctx.db.insert("planSubmissionSnapshots", {
        capturedAt: Date.now(),
        capturedByTenantUserId: args.actorTenantUserId,
        capturedByUserId: args.actorUserId,
        categorySummaries: args.plan.categorySummaries.map((summary) => ({
            amount: summary.amount,
            categoryId: String(summary.categoryId),
            categoryName: summary.categoryName,
            itemCount: summary.itemCount,
        })),
        departmentCodeSnapshot: args.plan.departmentCodeSnapshot,
        departmentId: args.plan.departmentId,
        departmentNameSnapshot: args.plan.departmentNameSnapshot,
        estimatedBudgetUsed: args.plan.estimatedBudgetUsed,
        fiscalYear: args.plan.fiscalYear,
        itemCount: args.plan.itemCount,
        lifecycleStatus: "active",
        planId: args.plan._id,
        selectedCategoryIds: args.plan.selectedCategoryIds.map((categoryId) => String(categoryId)),
        submissionReference: args.plan.submissionReference,
        submissionSequence: args.plan.submissionSequence,
        submissionSequenceKey,
        submittedAt: args.plan.submittedAt ?? null,
        tenantId: args.plan.tenantId,
        workspaceState: args.plan.workspaceState
            ? (0, blockly_serialization_1.createPersistedBlocklyWorkspaceRecord)((0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(args.plan.workspaceState, {
                lastSavedAt: args.plan.updatedAt,
                lastSavedByUserId: String(args.actorUserId),
            }))
            : undefined,
    });
}
exports.approveProcurementOfficerPlanRedraftRequest = (0, server_1.mutation)({
    args: {
        decisionNote: values_1.v.optional(values_1.v.string()),
        requestId: values_1.v.string(),
    },
    returns: values_1.v.object({
        planId: values_1.v.string(),
        status: values_1.v.literal("draft"),
    }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const tenantUser = await loadTenantUserForRole(ctx, {
            role: "procurement_officer",
            tenantId: authContext.tenantId,
            userId: authContext.userId,
        });
        const { plan, request } = await loadPendingPlanRedraftDecisionContext(ctx, {
            requestId: args.requestId,
            tenantId: authContext.tenantId,
        });
        if (plan.status !== "approved") {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "Only approved plans can be rolled back for redraft.",
            });
        }
        const baselineSnapshotId = await ensureLastApprovedBaselineSnapshot(ctx, {
            actorTenantUserId: tenantUser._id,
            actorUserId: authContext.userId,
            plan,
        });
        const now = Date.now();
        const decisionNote = normalizeDecisionNote(args.decisionNote);
        await ctx.db.patch(request._id, {
            decidedAt: now,
            decidedByTenantUserId: tenantUser._id,
            decidedByUserId: authContext.userId,
            decisionNote,
            status: "approved",
            updatedAt: now,
        });
        await ctx.db.patch(plan._id, {
            approvedAt: undefined,
            lastApprovedAt: plan.approvedAt,
            lastApprovedSnapshotId: baselineSnapshotId,
            redraftApprovedAt: now,
            redraftApprovedByTenantUserId: tenantUser._id,
            redraftCycle: (plan.redraftCycle ?? 0) + 1,
            redraftReason: request.reason,
            rejectedAt: undefined,
            rejectionComment: undefined,
            reviewStartedAt: undefined,
            reviewStartedByTenantUserId: undefined,
            reviewStartedByUserId: undefined,
            status: "draft",
            updatedAt: now,
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildPlanRedraftAuditEntry({
            action: "approve_redraft",
            actorRole: "procurement_officer",
            actorUserId: authContext.userId,
            departmentId: request.departmentId,
            event: audit_1.AUDIT_EVENT_NAMES.planRedraftApproved,
            metadata: {
                baselineSnapshotId: String(baselineSnapshotId),
                decisionNote: decisionNote ?? null,
                requestId: String(request._id),
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            planId: plan._id,
            tenantId: authContext.tenantId,
        }));
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildPlanRedraftAuditEntry({
            action: "rollback_redraft",
            actorRole: "procurement_officer",
            actorUserId: authContext.userId,
            departmentId: request.departmentId,
            event: audit_1.AUDIT_EVENT_NAMES.planRedraftRolledBack,
            metadata: {
                baselineSnapshotId: String(baselineSnapshotId),
                previousStatus: "approved",
                requestId: String(request._id),
                redraftCycle: (plan.redraftCycle ?? 0) + 1,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            planId: plan._id,
            tenantId: authContext.tenantId,
        }));
        return {
            planId: String(plan._id),
            status: "draft",
        };
    },
});
exports.denyProcurementOfficerPlanRedraftRequest = (0, server_1.mutation)({
    args: {
        decisionNote: values_1.v.optional(values_1.v.string()),
        requestId: values_1.v.string(),
    },
    returns: values_1.v.object({
        status: values_1.v.literal("denied"),
    }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const tenantUser = await loadTenantUserForRole(ctx, {
            role: "procurement_officer",
            tenantId: authContext.tenantId,
            userId: authContext.userId,
        });
        const { plan, request } = await loadPendingPlanRedraftDecisionContext(ctx, {
            requestId: args.requestId,
            tenantId: authContext.tenantId,
        });
        const now = Date.now();
        const decisionNote = normalizeDecisionNote(args.decisionNote);
        await ctx.db.patch(request._id, {
            decidedAt: now,
            decidedByTenantUserId: tenantUser._id,
            decidedByUserId: authContext.userId,
            decisionNote,
            status: "denied",
            updatedAt: now,
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildPlanRedraftAuditEntry({
            action: "deny_redraft",
            actorRole: "procurement_officer",
            actorUserId: authContext.userId,
            departmentId: request.departmentId,
            event: audit_1.AUDIT_EVENT_NAMES.planRedraftDenied,
            metadata: {
                decisionNote: decisionNote ?? null,
                requestId: String(request._id),
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            planId: plan._id,
            tenantId: authContext.tenantId,
        }));
        return {
            status: "denied",
        };
    },
});
