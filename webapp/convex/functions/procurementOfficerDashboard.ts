import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { buildProcurementOfficerDashboardSnapshot } from "../../lib/procurement-officer/dashboard-snapshot";
import { resolveProcurementCatalogRequestSummary } from "../../lib/procurement-officer/requests";
import type { ProcurementOfficerSubmissionStatus } from "../../lib/procurement-officer/submissions";
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

        const [departments, accessCodes, departmentUserProfiles, submissionDeadlines, categoryRequests, itemRequests, plans] = await Promise.all([
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
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            now: Date.now(),
            plans: plans
                .filter(
                    (
                        plan,
                    ): plan is typeof plan & {
                        status: ProcurementOfficerSubmissionStatus;
                    } => plan.status !== "draft",
                )
                .map((plan) => ({
                    fiscalYear: plan.fiscalYear,
                    status: plan.status,
                })),
            requestSummary: resolveProcurementCatalogRequestSummary({
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
            tenantTimeZone: tenant.timeZone,
        });
    },
});
