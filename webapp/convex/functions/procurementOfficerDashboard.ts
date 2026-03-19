import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { buildProcurementOfficerDashboardSnapshot } from "../../lib/procurement-officer/dashboard-snapshot";
import { requireTenantRole } from "./_roleGuard";

export const getProcurementOfficerDashboardSnapshot = query({
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

        const [departments, accessCodes, departmentUserProfiles] = await Promise.all([
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
        ]);

        return buildProcurementOfficerDashboardSnapshot({
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
            now: Date.now(),
            selectedFiscalYear: args.selectedFiscalYear,
            tenant: {
                id: String(tenant._id),
                name: tenant.name,
            },
        });
    },
});
