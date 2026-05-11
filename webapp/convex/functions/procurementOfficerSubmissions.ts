import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import {
  buildAvailableProcurementFiscalYears,
  deriveSharedSubmissionDeadline,
  formatProcurementFiscalYearLabel,
  getDepartmentFiscalYearKey,
  getProcurementFiscalYearForDate,
} from "../../lib/procurement-officer/dashboard";
import {
  buildProcurementOfficerMonitoringRow,
  selectCanonicalMonitoringPlan,
  summarizeProcurementOfficerMonitoringRows,
  type ProcurementOfficerMonitoringContact,
  type ProcurementOfficerMonitoringPlanLike,
} from "../../lib/procurement-officer/submission-monitoring";
import {
  shapeProcurementOfficerSubmissionRow,
  sortProcurementOfficerSubmissionRows,
  type ProcurementOfficerSubmissionSourceRow,
} from "../../lib/procurement-officer/submissions";
import { deriveDepartmentUserEffectiveRevisionDeadline } from "../../lib/plans/revision-deadline";
import { requireTenantRole } from "./_roleGuard";

const reviewTargetStateValidator = v.union(
  v.literal("ready"),
  v.literal("redirect"),
);

const submissionReviewTargetValidator = v.object({
  message: v.union(v.string(), v.null()),
  row: v.union(
    v.object({
      approvedAt: v.union(v.number(), v.null()),
      departmentCode: v.union(v.string(), v.null()),
      departmentId: v.union(v.string(), v.null()),
      departmentName: v.string(),
      estimatedBudgetUsed: v.number(),
      fiscalYear: v.string(),
      itemCount: v.number(),
      pendingRedraftRequestedAt: v.union(v.number(), v.null()),
      pendingRedraftRequestId: v.union(v.string(), v.null()),
      planId: v.string(),
      rejectedAt: v.union(v.number(), v.null()),
      reviewHref: v.string(),
      sortSubmittedAt: v.number(),
      status: v.union(
        v.literal("submitted"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      statusLabel: v.string(),
      submittedAt: v.union(v.number(), v.null()),
      submittedAtLabel: v.string(),
      totalAmountLabel: v.string(),
      updatedAt: v.number(),
      urgencyLabel: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  state: reviewTargetStateValidator,
});

function buildSubmissionSourceRow(args: {
  department: {
    code: string | null;
    id: string | null;
    isActive: boolean;
    name: string;
  } | null;
  plan: {
    _id: Id<"plans">;
    approvedAt?: number | null;
    estimatedBudgetUsed: number;
    fiscalYear: string;
    itemCount: number;
    rejectedAt?: number | null;
    status: "approved" | "draft" | "rejected" | "submitted";
    submittedAt?: number | null;
    updatedAt: number;
  };
  pendingRedraftRequest?: {
    _id: Id<"planRedraftRequests">;
    createdAt: number;
  } | null;
}): ProcurementOfficerSubmissionSourceRow | null {
  if (args.plan.status === "draft") {
    return null;
  }

  return {
    approvedAt: args.plan.approvedAt ?? null,
    departmentCode: args.department?.code ?? null,
    departmentId: args.department?.id ?? null,
    departmentName: args.department
      ? args.department.isActive
        ? args.department.name
        : `${args.department.name} (archived)`
      : "Archived department",
    estimatedBudgetUsed: args.plan.estimatedBudgetUsed,
    fiscalYear: args.plan.fiscalYear,
    itemCount: args.plan.itemCount,
    pendingRedraftRequestedAt: args.pendingRedraftRequest?.createdAt ?? null,
    pendingRedraftRequestId: args.pendingRedraftRequest
      ? String(args.pendingRedraftRequest._id)
      : null,
    planId: String(args.plan._id),
    rejectedAt: args.plan.rejectedAt ?? null,
    status: args.plan.status,
    submittedAt: args.plan.submittedAt ?? null,
    updatedAt: args.plan.updatedAt,
  };
}

export const getProcurementOfficerSubmissionQueue = query({
  args: {
    selectedFiscalYear: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    const tenant = await ctx.db.get(authContext.tenantId);

    if (!tenant) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tenant record not found",
      });
    }

    const now = Date.now();
    const [departments, plans, pendingRedraftRequests] = await Promise.all([
      ctx.db
        .query("departments")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
        .collect(),
      ctx.db
        .query("plans")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
        .collect(),
      ctx.db
        .query("planRedraftRequests")
        .withIndex("by_tenantId_status", (q) =>
          q.eq("tenantId", authContext.tenantId).eq("status", "pending"),
        )
        .collect(),
    ]);
    const selectedFiscalYear =
      args.selectedFiscalYear ??
      getProcurementFiscalYearForDate(now, {
        fiscalYearStartMonth: tenant.fiscalYearStartMonth,
        timeZone: tenant.timeZone,
      }).key;

    const departmentMap = new Map(
      departments.map((department) => [String(department._id), department] as const),
    );
    const pendingRedraftRequestByPlanId = new Map(
      pendingRedraftRequests.map(
        (request) => [String(request.planId), request] as const,
      ),
    );

    const queueSourceRows = plans
      .map((plan) =>
        buildSubmissionSourceRow({
          department: (() => {
            const department = departmentMap.get(String(plan.departmentId));
            if (!department) {
              return null;
            }

            return {
              code: department.code,
              id: String(department._id),
              isActive: department.isActive,
              name: department.name,
            };
          })(),
          plan,
          pendingRedraftRequest: pendingRedraftRequestByPlanId.get(String(plan._id)) ?? null,
        }),
      )
      .filter(
        (row): row is ProcurementOfficerSubmissionSourceRow => row !== null,
      );

    const scopedRows = queueSourceRows
      .filter((row) => row.fiscalYear === selectedFiscalYear)
      .map((row) =>
        shapeProcurementOfficerSubmissionRow({
          now,
          row,
          tenantTimeZone: tenant.timeZone,
        }),
      );

    const departmentsInScope = Array.from(
      new Map(
        scopedRows
          .filter((row) => row.departmentId)
          .map((row) => [
            row.departmentId as string,
            {
              id: row.departmentId as string,
              name: row.departmentName,
            },
          ]),
      ).values(),
    ).sort((left, right) => left.name.localeCompare(right.name));

    return {
      departments: departmentsInScope,
      meta: {
        currentFiscalYear: getProcurementFiscalYearForDate(now, {
          fiscalYearStartMonth: tenant.fiscalYearStartMonth,
          timeZone: tenant.timeZone,
        }).key,
        selectedFiscalYear,
        selectedFiscalYearCount: scopedRows.length,
        selectedFiscalYearLabel: formatProcurementFiscalYearLabel(
          selectedFiscalYear,
        ),
        tenantTimeZone: tenant.timeZone ?? null,
        totalCount: queueSourceRows.length,
      },
      rows: sortProcurementOfficerSubmissionRows(scopedRows),
    };
  },
});

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

export const getProcurementOfficerSubmissionMonitoringWorkspace = query({
  args: {
    selectedFiscalYear: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    const tenant = await ctx.db.get(authContext.tenantId);

    if (!tenant) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tenant record not found",
      });
    }

    const now = Date.now();
    const [
      departments,
      plans,
      submissionDeadlines,
      planReviewDecisions,
      planSubmissionSnapshots,
      departmentUserProfiles,
      tenantUsers,
    ] = await Promise.all([
      ctx.db
        .query("departments")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
        .collect(),
      ctx.db
        .query("plans")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
        .collect(),
      ctx.db
        .query("submissionDeadlines")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
        .collect(),
      ctx.db
        .query("planReviewDecisions")
        .withIndex("by_tenantId_lifecycleStatus_decidedAt", (q) =>
          q.eq("tenantId", authContext.tenantId).eq("lifecycleStatus", "active"),
        )
        .collect(),
      ctx.db
        .query("planSubmissionSnapshots")
        .withIndex("by_tenantId_departmentId_fiscalYear_capturedAt", (q) =>
          q.eq("tenantId", authContext.tenantId),
        )
        .collect(),
      ctx.db
        .query("departmentUserProfiles")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
        .collect(),
      ctx.db
        .query("tenantUsers")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
        .collect(),
    ]);
    const userDocs = await Promise.all(
      Array.from(new Set(tenantUsers.map((tenantUser) => String(tenantUser.userId)))).map(
        async (userId) => {
          const normalized = ctx.db.normalizeId("users", userId);
          return normalized ? await ctx.db.get(normalized) : null;
        },
      ),
    );

    const activeDepartments = departments.filter(
      (department) => department.isActive && department.deletedAt === undefined,
    );
    const requestedFiscalYear = args.selectedFiscalYear ?? null;
    const selectedFiscalYear =
      buildAvailableProcurementFiscalYears({
        departments: activeDepartments.map((department) => ({
          id: String(department._id),
          isActive: department.isActive,
          submissionEndsAt: department.submissionEndsAt,
          submissionStartsAt: department.submissionStartsAt,
        })),
        existingFiscalYearKeys: submissionDeadlines.map((deadline) => deadline.fiscalYearKey),
        fiscalYearStartMonth: tenant.fiscalYearStartMonth,
        now,
        requestedFiscalYear,
        timeZone: tenant.timeZone,
      })[0] ??
      getProcurementFiscalYearForDate(now, {
        fiscalYearStartMonth: tenant.fiscalYearStartMonth,
        timeZone: tenant.timeZone,
      }).key;

    const departmentsInScope = activeDepartments.filter(
      (department) =>
        getDepartmentFiscalYearKey(
          {
            id: String(department._id),
            isActive: department.isActive,
            submissionEndsAt: department.submissionEndsAt,
            submissionStartsAt: department.submissionStartsAt,
          },
          {
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            timeZone: tenant.timeZone,
          },
        ) === selectedFiscalYear,
    );
    const scopedDepartments =
      departmentsInScope.length > 0 ? departmentsInScope : activeDepartments;
    const departmentById = new Map(
      scopedDepartments.map((department) => [String(department._id), department] as const),
    );

    const sharedDeadline = deriveSharedSubmissionDeadline({
      deadlineRecord:
        submissionDeadlines.find((deadline) => deadline.fiscalYearKey === selectedFiscalYear) ?? null,
      departments: scopedDepartments.map((department) => ({
        id: String(department._id),
        isActive: department.isActive,
        submissionEndsAt: department.submissionEndsAt,
        submissionStartsAt: department.submissionStartsAt,
      })),
      fiscalYearKey: selectedFiscalYear,
      fiscalYearStartMonth: tenant.fiscalYearStartMonth,
      now,
      tenantTimeZone: tenant.timeZone,
    });

    const snapshotsByPlanId = new Map<string, typeof planSubmissionSnapshots>();
    for (const snapshot of planSubmissionSnapshots) {
      const key = String(snapshot.planId);
      const existing = snapshotsByPlanId.get(key) ?? [];
      existing.push(snapshot);
      snapshotsByPlanId.set(key, existing);
    }

    const activeDecisionByPlanId = new Map<string, (typeof planReviewDecisions)[number]>();
    for (const decision of planReviewDecisions) {
      const key = String(decision.planId);
      const existing = activeDecisionByPlanId.get(key);
      if (!existing || decision.decidedAt >= existing.decidedAt) {
        activeDecisionByPlanId.set(key, decision);
      }
    }

    const decisionsByPlanId = new Map<string, (typeof planReviewDecisions)>();
    for (const decision of planReviewDecisions) {
      const key = String(decision.planId);
      const existing = decisionsByPlanId.get(key) ?? [];
      existing.push(decision);
      decisionsByPlanId.set(key, existing);
    }

    const tenantUserById = new Map(
      tenantUsers.map((tenantUser) => [String(tenantUser._id), tenantUser] as const),
    );
    const userById = new Map(
      userDocs
        .filter((user): user is NonNullable<typeof user> => Boolean(user))
        .map((user) => [String(user._id), user] as const),
    );

    const contactsByDepartmentId = new Map<string, ProcurementOfficerMonitoringContact[]>();
    for (const profile of departmentUserProfiles) {
      const tenantUser = tenantUserById.get(String(profile.tenantUserId));
      if (
        !tenantUser ||
        !tenantUser.isActive ||
        tenantUser.role !== "department_user" ||
        !profile.isActive ||
        profile.deactivatedAt != null
      ) {
        continue;
      }

      const user = userById.get(String(tenantUser.userId));
      const key = String(profile.departmentId);
      const existing = contactsByDepartmentId.get(key) ?? [];
      existing.push({
        email: typeof user?.email === "string" ? user.email : null,
        isActive: true,
        name: typeof user?.name === "string" ? user.name : null,
      });
      contactsByDepartmentId.set(key, existing);
    }

    const plansByDepartmentId = new Map<string, ProcurementOfficerMonitoringPlanLike[]>();
    for (const plan of plans) {
      const key = String(plan.departmentId);
      const existing = plansByDepartmentId.get(key) ?? [];
      const submissionDeadlineAt = resolveDepartmentEffectiveSubmissionDeadlineAt({
        departmentSubmissionEndsAt: departmentById.get(key)?.submissionEndsAt,
        sharedSubmissionEndsAt: sharedDeadline.deadlineAt,
      });
      const mapReviewDecision = (decision: (typeof planReviewDecisions)[number]) => ({
        comment: decision.comment,
        decidedAt: decision.decidedAt,
        decisionType: decision.decisionType,
        effectiveRevisionDeadlineAt: deriveDepartmentUserEffectiveRevisionDeadline({
          decidedAt: decision.decidedAt,
          decisionType: decision.decisionType,
          revisionDeadlineAt: decision.revisionDeadlineAt ?? null,
          submissionDeadlineAt,
        }).effectiveDeadlineAt,
        revisionDeadlineAt: decision.revisionDeadlineAt ?? null,
      });
      existing.push({
        ...plan,
        departmentId: key,
        id: String(plan._id),
        latestDecision: (() => {
          const decision = activeDecisionByPlanId.get(String(plan._id));
          if (!decision) {
            return null;
          }
          return mapReviewDecision(decision);
        })(),
        reviewDecisions: (decisionsByPlanId.get(String(plan._id)) ?? []).map((decision) => ({
          ...mapReviewDecision(decision),
          id: String(decision._id),
          lifecycleStatus: decision.lifecycleStatus,
        })),
        submissionSnapshots: (snapshotsByPlanId.get(String(plan._id)) ?? []).map((snapshot) => ({
          capturedAt: snapshot.capturedAt,
          lifecycleStatus: snapshot.lifecycleStatus ?? null,
          submissionReference: snapshot.submissionReference ?? null,
          submissionSequence: snapshot.submissionSequence ?? null,
          submittedAt: snapshot.submittedAt,
          withdrawnAt: snapshot.withdrawnAt ?? null,
        })),
      });
      plansByDepartmentId.set(key, existing);
    }

    const rows = scopedDepartments
      .map((department) => {
        const canonicalPlan = selectCanonicalMonitoringPlan(
          plansByDepartmentId.get(String(department._id)) ?? [],
          selectedFiscalYear,
        );
        return buildProcurementOfficerMonitoringRow({
          contacts: contactsByDepartmentId.get(String(department._id)) ?? [],
          department: {
            code: department.code,
            id: String(department._id),
            isActive: department.isActive,
            name: department.name,
          },
          plan: canonicalPlan,
          tenantTimeZone: tenant.timeZone,
        });
      })
      .sort((left, right) => left.departmentName.localeCompare(right.departmentName));

    return {
      meta: {
        currentFiscalYear: getProcurementFiscalYearForDate(now, {
          fiscalYearStartMonth: tenant.fiscalYearStartMonth,
          timeZone: tenant.timeZone,
        }).key,
        selectedFiscalYear,
        selectedFiscalYearLabel: formatProcurementFiscalYearLabel(selectedFiscalYear),
        tenantTimeZone: tenant.timeZone ?? null,
      },
      rows,
      summary: summarizeProcurementOfficerMonitoringRows(rows),
    };
  },
});

export const getProcurementOfficerSubmissionReviewTarget = query({
  args: {
    planId: v.string(),
  },
  returns: submissionReviewTargetValidator,
  handler: async (ctx, args) => {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
    const tenant = await ctx.db.get(authContext.tenantId);

    if (!tenant) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tenant record not found",
      });
    }

    if (!normalizedPlanId) {
      return {
        message:
          "That plan is no longer available in the submission queue. It may have been withdrawn or moved out of scope.",
        row: null,
        state: "redirect" as const,
      };
    }

    const plan = await ctx.db.get(normalizedPlanId);

    if (!plan || plan.tenantId !== authContext.tenantId || plan.status === "draft") {
      return {
        message:
          "That plan is no longer available in the submission queue. It may have been withdrawn or moved out of scope.",
        row: null,
        state: "redirect" as const,
      };
    }

    const department = await ctx.db.get(plan.departmentId);
    const pendingRedraftRequest = await ctx.db
      .query("planRedraftRequests")
      .withIndex("by_planId_status", (q) =>
        q.eq("planId", plan._id).eq("status", "pending"),
      )
      .first();
    const sourceRow = buildSubmissionSourceRow({
      department: department
        ? {
            code: department.code,
            id: String(department._id),
            isActive: department.isActive,
            name: department.name,
          }
        : null,
      plan,
      pendingRedraftRequest,
    });

    if (!sourceRow) {
      return {
        message:
          "That plan is no longer available in the submission queue. It may have been withdrawn or moved out of scope.",
        row: null,
        state: "redirect" as const,
      };
    }

    return {
      message: null,
      row: shapeProcurementOfficerSubmissionRow({
        row: sourceRow,
        tenantTimeZone: tenant.timeZone,
      }),
      state: "ready" as const,
    };
  },
});
