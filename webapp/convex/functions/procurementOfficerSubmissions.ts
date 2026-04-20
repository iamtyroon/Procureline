import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import {
  formatProcurementFiscalYearLabel,
  getProcurementFiscalYearForDate,
} from "../../lib/procurement-officer/dashboard";
import {
  shapeProcurementOfficerSubmissionRow,
  sortProcurementOfficerSubmissionRows,
  type ProcurementOfficerSubmissionSourceRow,
} from "../../lib/procurement-officer/submissions";
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
    const [departments, plans] = await Promise.all([
      ctx.db
        .query("departments")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
        .collect(),
      ctx.db
        .query("plans")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
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
