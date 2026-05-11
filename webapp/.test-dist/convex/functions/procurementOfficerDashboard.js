"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProcurementOfficerDashboardSnapshot = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const dashboard_snapshot_1 = require("../../lib/procurement-officer/dashboard-snapshot");
const requests_1 = require("../../lib/procurement-officer/requests");
const _roleGuard_1 = require("./_roleGuard");
exports.getProcurementOfficerDashboardSnapshot = (0, server_1.query)({
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
        const [departments, accessCodes, departmentUserProfiles, submissionDeadlines, categoryRequests, itemRequests, plans, procurementItems] = await Promise.all([
            ctx.db
                .query("departments")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("departmentAccessCodes")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("departmentUserProfiles")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("submissionDeadlines")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("categoryRequests")
                .withIndex("by_tenantId_createdAt", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("itemRequests")
                .withIndex("by_tenantId_createdAt", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("plans")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("procurementItems")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
        ]);
        const redraftBaselineSnapshots = await Promise.all(plans
            .filter((plan) => plan.status === "draft" && plan.lastApprovedSnapshotId !== undefined)
            .map((plan) => ctx.db.get(plan.lastApprovedSnapshotId)));
        const redraftBaselineSnapshotByPlanId = new Map(redraftBaselineSnapshots
            .filter((snapshot) => Boolean(snapshot))
            .map((snapshot) => [String(snapshot.planId), snapshot]));
        return (0, dashboard_snapshot_1.buildProcurementOfficerDashboardSnapshot)({
            accessCodes: accessCodes.map((accessCode) => ({
                departmentId: String(accessCode.departmentId),
                expiresAt: accessCode.expiresAt,
                id: String(accessCode._id),
                isActive: accessCode.isActive,
                lastDeliveryStatus: accessCode.lastDeliveryStatus ?? null,
            })),
            departments: departments.map((department) => ({
                budgetAllocation: department.budgetAllocation,
                code: department.code,
                id: String(department._id),
                isActive: department.isActive,
                name: department.name,
                submissionEndsAt: department.submissionEndsAt,
                submissionStartsAt: department.submissionStartsAt,
                voteNumber: department.voteNumber ?? department.code,
            })),
            departmentUserProfiles: departmentUserProfiles.map((profile) => ({
                deactivatedAt: profile.deactivatedAt,
                departmentId: String(profile.departmentId),
                id: String(profile._id),
                isActive: profile.isActive,
            })),
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            now: Date.now(),
            activeItemCount: procurementItems.filter((item) => item.isActive).length,
            plans: plans
                .filter((plan) => plan.status !== "draft" || plan.lastApprovedSnapshotId !== undefined)
                .map((plan) => ({
                departmentId: String(plan.departmentId),
                estimatedBudgetUsed: redraftBaselineSnapshotByPlanId.get(String(plan._id))
                    ?.estimatedBudgetUsed ?? plan.estimatedBudgetUsed,
                fiscalYear: plan.fiscalYear,
                itemCount: redraftBaselineSnapshotByPlanId.get(String(plan._id))?.itemCount ??
                    plan.itemCount,
                status: plan.status === "draft" && plan.lastApprovedSnapshotId !== undefined
                    ? "approved"
                    : plan.status,
            })),
            requestSummary: (0, requests_1.resolveProcurementCatalogRequestSummary)({
                categoryRequests: categoryRequests.map((request) => ({
                    departmentId: String(request.departmentId),
                    status: request.status,
                })),
                departments: departments.map((department) => ({
                    id: String(department._id),
                    submissionEndsAt: department.submissionEndsAt,
                    submissionStartsAt: department.submissionStartsAt,
                })),
                itemRequests: itemRequests.map((request) => ({
                    departmentId: String(request.departmentId),
                    status: request.status,
                })),
            }),
            selectedFiscalYear: args.selectedFiscalYear,
            submissionDeadlines: submissionDeadlines.map((deadline) => ({
                announcementIssuedAt: deadline.announcementIssuedAt,
                announcementMessage: deadline.announcementMessage,
                announcementTitle: deadline.announcementTitle,
                deadlineVersion: deadline.deadlineVersion,
                fiscalYearKey: deadline.fiscalYearKey,
                reminderOffsets: deadline.reminderOffsets,
                submissionEndsAt: deadline.submissionEndsAt,
                submissionStartsAt: deadline.submissionStartsAt,
                timeZone: deadline.timeZone,
                updatedAt: deadline.updatedAt,
            })),
            tenant: {
                id: String(tenant._id),
                name: tenant.name,
            },
            tenantBudgetCeiling: tenant.procurementBudgetCeiling ?? null,
            tenantTimeZone: tenant.timeZone,
        });
    },
});
