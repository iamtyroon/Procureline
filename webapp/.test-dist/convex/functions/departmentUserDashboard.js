"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartmentUserDashboardSnapshot = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const _roleGuard_1 = require("./_roleGuard");
const dashboard_1 = require("../../lib/department-user/dashboard");
const dashboard_snapshot_1 = require("../../lib/department-user/dashboard-snapshot");
const department_user_access_1 = require("../../lib/auth/department-user-access");
const deadlines_1 = require("../../lib/procurement-officer/deadlines");
const dashboardStateValidator = values_1.v.union(values_1.v.literal("available"), values_1.v.literal("coming_soon"), values_1.v.literal("empty"), values_1.v.literal("read_only"), values_1.v.literal("setup_required"), values_1.v.literal("unavailable"));
const planActionValidator = values_1.v.object({
    disabled: values_1.v.boolean(),
    href: values_1.v.string(),
    kind: values_1.v.union(values_1.v.literal("create"), values_1.v.literal("edit"), values_1.v.literal("resume"), values_1.v.literal("view"), values_1.v.literal("view_rejection")),
    label: values_1.v.string(),
});
const planStatusValidator = values_1.v.union(values_1.v.literal("Approved"), values_1.v.literal("Draft"), values_1.v.literal("No Plan"), values_1.v.literal("Rejected"), values_1.v.literal("Submitted"));
const dashboardSnapshotValidator = values_1.v.object({
    announcements: values_1.v.object({
        emptyMessage: values_1.v.string(),
        items: values_1.v.array(values_1.v.object({
            id: values_1.v.string(),
            message: values_1.v.string(),
            title: values_1.v.string(),
        })),
        state: dashboardStateValidator,
        title: values_1.v.string(),
    }),
    heroSupport: values_1.v.object({
        departmentCode: values_1.v.string(),
        departmentName: values_1.v.string(),
        support: values_1.v.object({
            email: values_1.v.string(),
            helperText: values_1.v.string(),
            initials: values_1.v.string(),
            name: values_1.v.string(),
            pillLabel: values_1.v.string(),
            state: dashboardStateValidator,
        }),
        tenantName: values_1.v.string(),
    }),
    launchpad: values_1.v.object({
        categories: values_1.v.array(values_1.v.object({
            id: values_1.v.string(),
            isSelected: values_1.v.boolean(),
            itemCount: values_1.v.number(),
            itemCountLabel: values_1.v.string(),
            name: values_1.v.string(),
        })),
        canSelectCategories: values_1.v.boolean(),
        disabledReason: values_1.v.union(values_1.v.string(), values_1.v.null()),
        primaryAction: planActionValidator,
        selectedCategoryIds: values_1.v.array(values_1.v.string()),
        selectedCount: values_1.v.number(),
        state: dashboardStateValidator,
        subtitle: values_1.v.string(),
        title: values_1.v.string(),
    }),
    leaderboard: values_1.v.object({
        emptyMessage: values_1.v.string(),
        items: values_1.v.array(values_1.v.object({
            id: values_1.v.string(),
            label: values_1.v.string(),
            rank: values_1.v.number(),
            score: values_1.v.string(),
        })),
        state: dashboardStateValidator,
        title: values_1.v.string(),
    }),
    meta: values_1.v.object({
        blockedMessage: values_1.v.union(values_1.v.string(), values_1.v.null()),
        blockedTitle: values_1.v.union(values_1.v.string(), values_1.v.null()),
        currentUser: values_1.v.object({
            email: values_1.v.string(),
            initials: values_1.v.string(),
            name: values_1.v.string(),
        }),
        departmentAccessMode: values_1.v.optional(values_1.v.union(values_1.v.literal("editable"), values_1.v.literal("read_only_grace"), values_1.v.null())),
        departmentId: values_1.v.union(values_1.v.string(), values_1.v.null()),
        fiscalYearKey: values_1.v.string(),
        generatedAt: values_1.v.number(),
        tenantId: values_1.v.string(),
        tenantName: values_1.v.string(),
        viewState: values_1.v.union(values_1.v.literal("blocked"), values_1.v.literal("dashboard")),
    }),
    plans: values_1.v.object({
        emptyMessage: values_1.v.string(),
        rows: values_1.v.array(values_1.v.object({
            action: planActionValidator,
            fiscalYear: values_1.v.string(),
            id: values_1.v.string(),
            isCurrentFiscalYear: values_1.v.boolean(),
            itemCount: values_1.v.number(),
            itemCountLabel: values_1.v.string(),
            rejectionComment: values_1.v.union(values_1.v.string(), values_1.v.null()),
            statusLabel: planStatusValidator,
            viewHref: values_1.v.string(),
        })),
        state: dashboardStateValidator,
        title: values_1.v.string(),
    }),
    quickStats: values_1.v.object({
        budget: values_1.v.object({
            breakdown: values_1.v.object({
                emptyMessage: values_1.v.string(),
                items: values_1.v.array(values_1.v.object({
                    amountLabel: values_1.v.string(),
                    categoryName: values_1.v.string(),
                    id: values_1.v.string(),
                    itemCountLabel: values_1.v.string(),
                })),
            }),
            helperText: values_1.v.string(),
            state: dashboardStateValidator,
            totalBudget: values_1.v.number(),
            totalBudgetLabel: values_1.v.string(),
            usedBudget: values_1.v.number(),
            usedBudgetLabel: values_1.v.string(),
            utilizationPercent: values_1.v.number(),
        }),
        deadline: values_1.v.object({
            deadlineDateLabel: values_1.v.string(),
            daysRemaining: values_1.v.union(values_1.v.number(), values_1.v.null()),
            fiscalYearKey: values_1.v.string(),
            fiscalYearLabel: values_1.v.string(),
            gaugeLabel: values_1.v.string(),
            gaugePercent: values_1.v.number(),
            helperText: values_1.v.string(),
            isUrgent: values_1.v.boolean(),
            label: values_1.v.string(),
            note: values_1.v.string(),
            state: dashboardStateValidator,
            targetAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
            timeZone: values_1.v.string(),
        }),
        plan: values_1.v.object({
            helperText: values_1.v.string(),
            itemCount: values_1.v.number(),
            primaryActionHref: values_1.v.string(),
            primaryActionLabel: values_1.v.string(),
            state: dashboardStateValidator,
            statusLabel: planStatusValidator,
        }),
    }),
    rejectionNotice: values_1.v.union(values_1.v.object({
        action: planActionValidator,
        message: values_1.v.string(),
        title: values_1.v.string(),
    }), values_1.v.null()),
});
exports.getDepartmentUserDashboardSnapshot = (0, server_1.query)({
    args: {},
    returns: dashboardSnapshotValidator,
    handler: async (ctx) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["department_user"]);
        const tenant = await ctx.db.get(authContext.tenantId);
        if (!tenant) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }
        const tenantUser = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId_tenantId", (q) => q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId))
            .first();
        const authUser = await ctx.db.get(authContext.userId);
        const currentUser = readAuthUserSummary(authUser, "Department User");
        if (!tenantUser || tenantUser.role !== "department_user" || !tenantUser.isActive) {
            return (0, dashboard_snapshot_1.buildDepartmentUserDashboardSnapshot)({
                announcements: [],
                auth: {
                    departmentAccessMode: authContext.departmentAccessMode,
                    departmentId: authContext.departmentId ? String(authContext.departmentId) : undefined,
                    tenantId: String(authContext.tenantId),
                },
                categories: [],
                currentUser,
                department: null,
                fiscalYearStartMonth: tenant.fiscalYearStartMonth,
                items: [],
                leaderboardEntries: [],
                now: Date.now(),
                plans: [],
                procurementOfficer: null,
                tenant: {
                    id: String(tenant._id),
                    name: tenant.name,
                },
                tenantTimeZone: tenant.timeZone,
            });
        }
        const profile = await ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", tenantUser._id))
            .first();
        const departmentId = authContext.departmentId ?? profile?.departmentId;
        const department = departmentId ? await ctx.db.get(departmentId) : null;
        if (!profile || !department || department.tenantId !== authContext.tenantId || !department.isActive) {
            return (0, dashboard_snapshot_1.buildDepartmentUserDashboardSnapshot)({
                announcements: [],
                auth: {
                    departmentAccessMode: authContext.departmentAccessMode,
                    departmentId: departmentId ? String(departmentId) : undefined,
                    tenantId: String(authContext.tenantId),
                },
                categories: [],
                currentUser,
                department: null,
                fiscalYearStartMonth: tenant.fiscalYearStartMonth,
                items: [],
                leaderboardEntries: [],
                now: Date.now(),
                plans: [],
                procurementOfficer: null,
                tenant: {
                    id: String(tenant._id),
                    name: tenant.name,
                },
                tenantTimeZone: tenant.timeZone,
            });
        }
        if (!(0, department_user_access_1.hasConfiguredDepartmentUserSubmissionWindow)({
            submissionEndsAt: department.submissionEndsAt,
            submissionStartsAt: department.submissionStartsAt,
        })) {
            return (0, dashboard_snapshot_1.buildDepartmentUserDashboardSnapshot)({
                announcements: [],
                auth: {
                    departmentAccessMode: authContext.departmentAccessMode,
                    departmentId: departmentId ? String(departmentId) : undefined,
                    tenantId: String(authContext.tenantId),
                },
                categories: [],
                currentUser,
                department: null,
                fiscalYearStartMonth: tenant.fiscalYearStartMonth,
                items: [],
                leaderboardEntries: [],
                now: Date.now(),
                plans: [],
                procurementOfficer: null,
                tenant: {
                    id: String(tenant._id),
                    name: tenant.name,
                },
                tenantTimeZone: tenant.timeZone,
            });
        }
        const deadlineTimeZone = (0, deadlines_1.resolveDeadlineTimeZone)({
            tenantTimeZone: tenant.timeZone,
        }).timeZone;
        const deadlineFiscalYearKey = (0, deadlines_1.getFiscalYearForTimestampInTimeZone)({
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            timeZone: deadlineTimeZone,
            timestamp: department.submissionEndsAt,
        }).key;
        const [categories, items, plans, procurementOfficerTenantUser, submissionDeadline] = await Promise.all([
            ctx.db
                .query("procurementCategories")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("procurementItems")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("plans")
                .withIndex("by_departmentId", (q) => q.eq("departmentId", department._id))
                .collect(),
            ctx.db.get(department.procurementOfficerTenantUserId),
            ctx.db
                .query("submissionDeadlines")
                .withIndex("by_tenantId_fiscalYearKey", (q) => q.eq("tenantId", authContext.tenantId).eq("fiscalYearKey", deadlineFiscalYearKey))
                .first(),
        ]);
        const procurementOfficerUser = procurementOfficerTenantUser?.userId
            ? await ctx.db.get(procurementOfficerTenantUser.userId)
            : null;
        const procurementOfficer = procurementOfficerTenantUser &&
            procurementOfficerTenantUser.role === "procurement_officer" &&
            procurementOfficerTenantUser.isActive
            ? readAuthUserSummary(procurementOfficerUser, "Procurement Officer")
            : null;
        const budgetAnnouncement = (0, dashboard_1.buildDepartmentBudgetChangeAnnouncement)({
            budgetAllocation: department.budgetAllocation ?? null,
            departmentId: String(department._id),
            lastAuthenticatedAt: profile.lastAuthenticatedAt ?? null,
            lastBudgetChangedAt: department.lastBudgetChangedAt ?? null,
        });
        const deadlineAnnouncement = (0, dashboard_1.buildDepartmentDeadlineAnnouncement)({
            announcementIssuedAt: submissionDeadline?.announcementIssuedAt ?? null,
            announcementMessage: submissionDeadline?.announcementMessage ?? null,
            announcementTitle: submissionDeadline?.announcementTitle ?? null,
            departmentId: String(department._id),
            lastAuthenticatedAt: profile.lastAuthenticatedAt ?? null,
        });
        const announcements = [budgetAnnouncement, deadlineAnnouncement].filter((item) => Boolean(item));
        return (0, dashboard_snapshot_1.buildDepartmentUserDashboardSnapshot)({
            announcements,
            auth: {
                departmentAccessMode: authContext.departmentAccessMode,
                departmentId: String(department._id),
                tenantId: String(authContext.tenantId),
            },
            categories: categories.map((category) => ({
                id: String(category._id),
                isActive: category.isActive,
                name: category.name,
            })),
            currentUser,
            department: {
                budgetAllocation: department.budgetAllocation ?? null,
                code: department.code,
                id: String(department._id),
                name: department.name,
                submissionEndsAt: department.submissionEndsAt,
                submissionStartsAt: department.submissionStartsAt,
                submissionTimeZone: submissionDeadline?.timeZone ?? deadlineTimeZone,
            },
            items: items.map((item) => ({
                categoryId: String(item.categoryId),
                id: String(item._id),
                isActive: item.isActive,
            })),
            leaderboardEntries: [],
            now: Date.now(),
            plans: plans.map((plan) => ({
                categorySummaries: plan.categorySummaries.map((summary) => ({
                    amount: summary.amount,
                    categoryId: String(summary.categoryId),
                    categoryName: summary.categoryName,
                    itemCount: summary.itemCount,
                })),
                createdAt: plan.createdAt,
                estimatedBudgetUsed: plan.estimatedBudgetUsed,
                fiscalYear: plan.fiscalYear,
                id: String(plan._id),
                itemCount: plan.itemCount,
                rejectionComment: plan.rejectionComment ?? null,
                selectedCategoryIds: plan.selectedCategoryIds.map((categoryId) => String(categoryId)),
                status: plan.status,
                updatedAt: plan.updatedAt,
            })),
            procurementOfficer: procurementOfficer
                ? {
                    email: procurementOfficer.email,
                    initials: procurementOfficer.initials,
                    name: procurementOfficer.name,
                }
                : null,
            tenant: {
                id: String(tenant._id),
                name: tenant.name,
            },
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            tenantTimeZone: tenant.timeZone,
        });
    },
});
function readAuthUserSummary(userDocument, fallbackName) {
    const record = userDocument && typeof userDocument === "object" && !Array.isArray(userDocument)
        ? userDocument
        : {};
    const email = typeof record.email === "string" && record.email.trim().length > 0
        ? record.email.trim()
        : "No email available";
    const name = typeof record.name === "string" && record.name.trim().length > 0
        ? record.name.trim()
        : email !== "No email available"
            ? email.split("@")[0] || fallbackName
            : fallbackName;
    return {
        email,
        initials: name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0))
            .join("")
            .toUpperCase(),
        name,
    };
}
