"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProcurementOfficerDashboardSnapshot = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const dashboard_snapshot_1 = require("../../lib/procurement-officer/dashboard-snapshot");
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
        const [departments, accessCodes, departmentUserProfiles, submissionDeadlines] = await Promise.all([
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
        ]);
        return (0, dashboard_snapshot_1.buildProcurementOfficerDashboardSnapshot)({
            accessCodes: accessCodes.map((accessCode) => ({
                departmentId: String(accessCode.departmentId),
                expiresAt: accessCode.expiresAt,
                id: String(accessCode._id),
                isActive: accessCode.isActive,
            })),
            departments: departments.map((department) => ({
                code: department.code,
                id: String(department._id),
                isActive: department.isActive,
                name: department.name,
                submissionEndsAt: department.submissionEndsAt,
                submissionStartsAt: department.submissionStartsAt,
            })),
            departmentUserProfiles: departmentUserProfiles.map((profile) => ({
                deactivatedAt: profile.deactivatedAt,
                departmentId: String(profile.departmentId),
                id: String(profile._id),
                isActive: profile.isActive,
            })),
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            now: Date.now(),
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
            tenantTimeZone: tenant.timeZone,
        });
    },
});
