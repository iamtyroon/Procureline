import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../_generated/server";
import {
  createPersistedBlocklyWorkspaceRecord,
  normalizeBlocklyWorkspaceRecord,
} from "../../lib/shared/blockly/blockly-serialization";
import {
  buildApprovedPlanRedraftSnapshotKey,
  getPlanRedraftRequestEligibility,
  normalizePlanRedraftReason,
} from "../../lib/plans/redraft";
import { getFiscalYearForTimestampInTimeZone } from "../../lib/procurement-officer/deadlines";
import {
  AUDIT_EVENT_NAMES,
  AUDIT_OUTCOMES,
  createAuthenticatedAuditActor,
} from "../../lib/shared/security/audit";
import { appendAuditLogRequired } from "./_audit";
import { requireTenantRole } from "./_roleGuard";

async function loadTenantUserForRole(
  ctx: MutationCtx,
  args: {
    role: "department_user" | "procurement_officer";
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

  if (!tenantUser || !tenantUser.isActive || tenantUser.role !== args.role) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message:
        args.role === "department_user"
          ? "Department User access is required for redraft requests."
          : "Procurement Officer access is required for redraft decisions.",
    });
  }

  return tenantUser;
}

async function loadDepartmentUserDepartment(
  ctx: MutationCtx,
  args: {
    tenantId: Id<"tenants">;
    tenantUserId: Id<"tenantUsers">;
  },
) {
  const profile = await ctx.db
    .query("departmentUserProfiles")
    .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", args.tenantUserId))
    .first();

  if (!profile || !profile.isActive) {
    throw new ConvexError({
      code: "DEPARTMENT_NOT_FOUND",
      message: "Department setup is incomplete for this Department User.",
    });
  }

  const department = await ctx.db.get(profile.departmentId);
  if (!department || department.tenantId !== args.tenantId || !department.isActive) {
    throw new ConvexError({
      code: "DEPARTMENT_NOT_FOUND",
      message: "Department setup is incomplete for this Department User.",
    });
  }

  return department;
}

function buildPlanRedraftAuditEntry(args: {
  action: "approve_redraft" | "deny_redraft" | "request_redraft" | "rollback_redraft";
  actorRole: "department_user" | "procurement_officer";
  actorUserId: Id<"users">;
  departmentId: Id<"departments">;
  event:
    | typeof AUDIT_EVENT_NAMES.planRedraftApproved
    | typeof AUDIT_EVENT_NAMES.planRedraftDenied
    | typeof AUDIT_EVENT_NAMES.planRedraftRequested
    | typeof AUDIT_EVENT_NAMES.planRedraftRolledBack;
  metadata?: Record<string, unknown>;
  outcome: typeof AUDIT_OUTCOMES.allowed | typeof AUDIT_OUTCOMES.blockedStateTransition;
  planId: Id<"plans">;
  tenantId: Id<"tenants">;
}) {
  return {
    action: args.action,
    actor: createAuthenticatedAuditActor({
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
  } as const;
}

function getCurrentFiscalYear(args: {
  fiscalYearStartMonth?: number;
  now: number;
  timeZone?: string;
}) {
  return getFiscalYearForTimestampInTimeZone({
    fiscalYearStartMonth: args.fiscalYearStartMonth,
    timestamp: args.now,
    timeZone: args.timeZone ?? "Africa/Nairobi",
  }).key;
}

async function loadPendingRequestForPlan(
  ctx: MutationCtx,
  planId: Id<"plans">,
) {
  return ctx.db
    .query("planRedraftRequests")
    .withIndex("by_planId_status", (q) => q.eq("planId", planId).eq("status", "pending"))
    .first();
}

export const requestDepartmentUserPlanRedraft = mutation({
  args: {
    planId: v.string(),
    reason: v.string(),
  },
  returns: v.object({
    requestId: v.string(),
    status: v.literal("pending"),
  }),
  handler: async (ctx, args) => {
    const authContext = await requireTenantRole(ctx, ["department_user"]);
    const tenant = await ctx.db.get(authContext.tenantId);
    const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);

    if (!tenant || !normalizedPlanId) {
      throw new ConvexError({
        code: "PLAN_NOT_FOUND",
        message: "Approved plan not found.",
      });
    }

    const reason = normalizePlanRedraftReason(args.reason);
    if (!reason.ok || !reason.value) {
      throw new ConvexError({
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
    const eligibility = getPlanRedraftRequestEligibility({
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
        await appendAuditLogRequired(
          ctx,
          buildPlanRedraftAuditEntry({
            action: "request_redraft",
            actorRole: "department_user",
            actorUserId: authContext.userId,
            departmentId: department._id,
            event: AUDIT_EVENT_NAMES.planRedraftRequested,
            metadata: {
              reason: eligibility.message,
              requestBlocked: true,
            },
            outcome: AUDIT_OUTCOMES.blockedStateTransition,
            planId: plan._id,
            tenantId: authContext.tenantId,
          }),
        );
      }
      throw new ConvexError({
        code: "VALIDATION_FAILED",
        message: eligibility.message ?? "This plan cannot be requested for redraft.",
      });
    }

    if (!plan) {
      throw new ConvexError({
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

    await appendAuditLogRequired(
      ctx,
      buildPlanRedraftAuditEntry({
        action: "request_redraft",
        actorRole: "department_user",
        actorUserId: authContext.userId,
        departmentId: department._id,
        event: AUDIT_EVENT_NAMES.planRedraftRequested,
        metadata: {
          requestId: String(requestId),
          reason: reason.value,
        },
        outcome: AUDIT_OUTCOMES.allowed,
        planId: plan._id,
        tenantId: authContext.tenantId,
      }),
    );

    return {
      requestId: String(requestId),
      status: "pending" as const,
    };
  },
});

export const getProcurementOfficerPlanRedraftRequests = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    const [requests, departments, plans] = await Promise.all([
      ctx.db
        .query("planRedraftRequests")
        .withIndex("by_tenantId_status", (q) =>
          q.eq("tenantId", authContext.tenantId).eq("status", "pending"),
        )
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

async function loadPendingPlanRedraftDecisionContext(
  ctx: MutationCtx,
  args: {
    requestId: string;
    tenantId: Id<"tenants">;
  },
) {
  const normalizedRequestId = ctx.db.normalizeId("planRedraftRequests", args.requestId);
  if (!normalizedRequestId) {
    throw new ConvexError({
      code: "REQUEST_NOT_FOUND",
      message: "Redraft request not found.",
    });
  }

  const request = await ctx.db.get(normalizedRequestId);
  if (!request || request.tenantId !== args.tenantId || request.status !== "pending") {
    throw new ConvexError({
      code: "REQUEST_NOT_FOUND",
      message: "Pending redraft request not found.",
    });
  }

  const plan = await ctx.db.get(request.planId);
  if (!plan || plan.tenantId !== args.tenantId || plan.departmentId !== request.departmentId) {
    throw new ConvexError({
      code: "PLAN_NOT_FOUND",
      message: "Approved plan not found for this redraft request.",
    });
  }

  return { plan, request };
}

function normalizeDecisionNote(value: string | undefined): string | undefined {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized.slice(0, 500) : undefined;
}

async function ensureLastApprovedBaselineSnapshot(ctx: MutationCtx, args: {
  actorTenantUserId: Id<"tenantUsers">;
  actorUserId: Id<"users">;
  plan: Doc<"plans">;
}): Promise<Id<"planSubmissionSnapshots">> {
  const approvedAt = args.plan.approvedAt;
  if (typeof approvedAt !== "number") {
    throw new ConvexError({
      code: "VALIDATION_FAILED",
      message: "This approved plan is missing its approval timestamp.",
    });
  }

  const submissionSequenceKey = buildApprovedPlanRedraftSnapshotKey({
    approvedAt,
    planId: String(args.plan._id),
    tenantId: String(args.plan.tenantId),
  });
  const existingSnapshot = await ctx.db
    .query("planSubmissionSnapshots")
    .withIndex("by_submissionSequenceKey", (q) =>
      q.eq("submissionSequenceKey", submissionSequenceKey),
    )
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
    selectedCategoryIds: args.plan.selectedCategoryIds.map((categoryId) =>
      String(categoryId),
    ),
    submissionReference: args.plan.submissionReference,
    submissionSequence: args.plan.submissionSequence,
    submissionSequenceKey,
    submittedAt: args.plan.submittedAt ?? null,
    tenantId: args.plan.tenantId,
    workspaceState: args.plan.workspaceState
      ? createPersistedBlocklyWorkspaceRecord(
          normalizeBlocklyWorkspaceRecord(args.plan.workspaceState, {
            lastSavedAt: args.plan.updatedAt,
            lastSavedByUserId: String(args.actorUserId),
          }),
        )
      : undefined,
  });
}

export const approveProcurementOfficerPlanRedraftRequest = mutation({
  args: {
    decisionNote: v.optional(v.string()),
    requestId: v.string(),
  },
  returns: v.object({
    planId: v.string(),
    status: v.literal("draft"),
  }),
  handler: async (ctx, args) => {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
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
      throw new ConvexError({
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

    await appendAuditLogRequired(
      ctx,
      buildPlanRedraftAuditEntry({
        action: "approve_redraft",
        actorRole: "procurement_officer",
        actorUserId: authContext.userId,
        departmentId: request.departmentId,
        event: AUDIT_EVENT_NAMES.planRedraftApproved,
        metadata: {
          baselineSnapshotId: String(baselineSnapshotId),
          decisionNote: decisionNote ?? null,
          requestId: String(request._id),
        },
        outcome: AUDIT_OUTCOMES.allowed,
        planId: plan._id,
        tenantId: authContext.tenantId,
      }),
    );
    await appendAuditLogRequired(
      ctx,
      buildPlanRedraftAuditEntry({
        action: "rollback_redraft",
        actorRole: "procurement_officer",
        actorUserId: authContext.userId,
        departmentId: request.departmentId,
        event: AUDIT_EVENT_NAMES.planRedraftRolledBack,
        metadata: {
          baselineSnapshotId: String(baselineSnapshotId),
          previousStatus: "approved",
          requestId: String(request._id),
          redraftCycle: (plan.redraftCycle ?? 0) + 1,
        },
        outcome: AUDIT_OUTCOMES.allowed,
        planId: plan._id,
        tenantId: authContext.tenantId,
      }),
    );

    return {
      planId: String(plan._id),
      status: "draft" as const,
    };
  },
});

export const denyProcurementOfficerPlanRedraftRequest = mutation({
  args: {
    decisionNote: v.optional(v.string()),
    requestId: v.string(),
  },
  returns: v.object({
    status: v.literal("denied"),
  }),
  handler: async (ctx, args) => {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
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

    await appendAuditLogRequired(
      ctx,
      buildPlanRedraftAuditEntry({
        action: "deny_redraft",
        actorRole: "procurement_officer",
        actorUserId: authContext.userId,
        departmentId: request.departmentId,
        event: AUDIT_EVENT_NAMES.planRedraftDenied,
        metadata: {
          decisionNote: decisionNote ?? null,
          requestId: String(request._id),
        },
        outcome: AUDIT_OUTCOMES.allowed,
        planId: plan._id,
        tenantId: authContext.tenantId,
      }),
    );

    return {
      status: "denied" as const,
    };
  },
});
