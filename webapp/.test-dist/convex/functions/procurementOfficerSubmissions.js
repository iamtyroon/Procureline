"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProcurementOfficerSubmissionReviewTarget = exports.getProcurementOfficerSubmissionQueue = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const dashboard_1 = require("../../lib/procurement-officer/dashboard");
const submissions_1 = require("../../lib/procurement-officer/submissions");
const _roleGuard_1 = require("./_roleGuard");
const reviewTargetStateValidator = values_1.v.union(values_1.v.literal("ready"), values_1.v.literal("redirect"));
const submissionReviewTargetValidator = values_1.v.object({
    message: values_1.v.union(values_1.v.string(), values_1.v.null()),
    row: values_1.v.union(values_1.v.object({
        approvedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        departmentCode: values_1.v.union(values_1.v.string(), values_1.v.null()),
        departmentId: values_1.v.union(values_1.v.string(), values_1.v.null()),
        departmentName: values_1.v.string(),
        estimatedBudgetUsed: values_1.v.number(),
        fiscalYear: values_1.v.string(),
        itemCount: values_1.v.number(),
        pendingRedraftRequestedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        pendingRedraftRequestId: values_1.v.union(values_1.v.string(), values_1.v.null()),
        planId: values_1.v.string(),
        rejectedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        reviewHref: values_1.v.string(),
        sortSubmittedAt: values_1.v.number(),
        status: values_1.v.union(values_1.v.literal("submitted"), values_1.v.literal("approved"), values_1.v.literal("rejected")),
        statusLabel: values_1.v.string(),
        submittedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        submittedAtLabel: values_1.v.string(),
        totalAmountLabel: values_1.v.string(),
        updatedAt: values_1.v.number(),
        urgencyLabel: values_1.v.union(values_1.v.string(), values_1.v.null()),
    }), values_1.v.null()),
    state: reviewTargetStateValidator,
});
function buildSubmissionSourceRow(args) {
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
exports.getProcurementOfficerSubmissionQueue = (0, server_1.query)({
    args: {
        selectedFiscalYear: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const tenant = await ctx.db.get(authContext.tenantId);
        if (!tenant) {
            throw new values_1.ConvexError({
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
                .withIndex("by_tenantId_status", (q) => q.eq("tenantId", authContext.tenantId).eq("status", "pending"))
                .collect(),
        ]);
        const selectedFiscalYear = args.selectedFiscalYear ??
            (0, dashboard_1.getProcurementFiscalYearForDate)(now, {
                fiscalYearStartMonth: tenant.fiscalYearStartMonth,
                timeZone: tenant.timeZone,
            }).key;
        const departmentMap = new Map(departments.map((department) => [String(department._id), department]));
        const pendingRedraftRequestByPlanId = new Map(pendingRedraftRequests.map((request) => [String(request.planId), request]));
        const queueSourceRows = plans
            .map((plan) => buildSubmissionSourceRow({
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
        }))
            .filter((row) => row !== null);
        const scopedRows = queueSourceRows
            .filter((row) => row.fiscalYear === selectedFiscalYear)
            .map((row) => (0, submissions_1.shapeProcurementOfficerSubmissionRow)({
            now,
            row,
            tenantTimeZone: tenant.timeZone,
        }));
        const departmentsInScope = Array.from(new Map(scopedRows
            .filter((row) => row.departmentId)
            .map((row) => [
            row.departmentId,
            {
                id: row.departmentId,
                name: row.departmentName,
            },
        ])).values()).sort((left, right) => left.name.localeCompare(right.name));
        return {
            departments: departmentsInScope,
            meta: {
                currentFiscalYear: (0, dashboard_1.getProcurementFiscalYearForDate)(now, {
                    fiscalYearStartMonth: tenant.fiscalYearStartMonth,
                    timeZone: tenant.timeZone,
                }).key,
                selectedFiscalYear,
                selectedFiscalYearCount: scopedRows.length,
                selectedFiscalYearLabel: (0, dashboard_1.formatProcurementFiscalYearLabel)(selectedFiscalYear),
                tenantTimeZone: tenant.timeZone ?? null,
                totalCount: queueSourceRows.length,
            },
            rows: (0, submissions_1.sortProcurementOfficerSubmissionRows)(scopedRows),
        };
    },
});
exports.getProcurementOfficerSubmissionReviewTarget = (0, server_1.query)({
    args: {
        planId: values_1.v.string(),
    },
    returns: submissionReviewTargetValidator,
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        const tenant = await ctx.db.get(authContext.tenantId);
        if (!tenant) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }
        if (!normalizedPlanId) {
            return {
                message: "That plan is no longer available in the submission queue. It may have been withdrawn or moved out of scope.",
                row: null,
                state: "redirect",
            };
        }
        const plan = await ctx.db.get(normalizedPlanId);
        if (!plan || plan.tenantId !== authContext.tenantId || plan.status === "draft") {
            return {
                message: "That plan is no longer available in the submission queue. It may have been withdrawn or moved out of scope.",
                row: null,
                state: "redirect",
            };
        }
        const department = await ctx.db.get(plan.departmentId);
        const pendingRedraftRequest = await ctx.db
            .query("planRedraftRequests")
            .withIndex("by_planId_status", (q) => q.eq("planId", plan._id).eq("status", "pending"))
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
                message: "That plan is no longer available in the submission queue. It may have been withdrawn or moved out of scope.",
                row: null,
                state: "redirect",
            };
        }
        return {
            message: null,
            row: (0, submissions_1.shapeProcurementOfficerSubmissionRow)({
                row: sourceRow,
                tenantTimeZone: tenant.timeZone,
            }),
            state: "ready",
        };
    },
});
