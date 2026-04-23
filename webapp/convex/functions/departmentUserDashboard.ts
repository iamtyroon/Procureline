import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { requireTenantRole } from "./_roleGuard";
import {
    buildDepartmentBudgetChangeAnnouncement,
    buildDepartmentDeadlineAnnouncement,
} from "../../lib/department-user/dashboard";
import { buildDepartmentUserDashboardSnapshot } from "../../lib/department-user/dashboard-snapshot";
import { hasConfiguredDepartmentUserSubmissionWindow } from "../../lib/auth/department-user-access";
import {
    getFiscalYearForTimestampInTimeZone,
    resolveDeadlineTimeZone,
} from "../../lib/procurement-officer/deadlines";

const dashboardStateValidator = v.union(
    v.literal("available"),
    v.literal("coming_soon"),
    v.literal("empty"),
    v.literal("read_only"),
    v.literal("setup_required"),
    v.literal("unavailable"),
);

const planActionValidator = v.object({
    disabled: v.boolean(),
    href: v.string(),
    kind: v.union(
        v.literal("create"),
        v.literal("edit"),
        v.literal("resume"),
        v.literal("view"),
        v.literal("view_rejection"),
    ),
    label: v.string(),
});

const planStatusValidator = v.union(
    v.literal("Approved"),
    v.literal("Draft"),
    v.literal("No Plan"),
    v.literal("Rejected"),
    v.literal("Submitted"),
);

const dashboardSnapshotValidator = v.object({
    announcements: v.object({
        emptyMessage: v.string(),
        items: v.array(
            v.object({
                id: v.string(),
                message: v.string(),
                title: v.string(),
            }),
        ),
        state: dashboardStateValidator,
        title: v.string(),
    }),
    heroSupport: v.object({
        departmentCode: v.string(),
        departmentName: v.string(),
        support: v.object({
            email: v.string(),
            helperText: v.string(),
            initials: v.string(),
            name: v.string(),
            pillLabel: v.string(),
            state: dashboardStateValidator,
        }),
        tenantName: v.string(),
    }),
    launchpad: v.object({
        categories: v.array(
            v.object({
                disabled: v.boolean(),
                disabledReason: v.union(v.string(), v.null()),
                id: v.string(),
                isSelected: v.boolean(),
                itemCount: v.number(),
                itemCountLabel: v.string(),
                name: v.string(),
            }),
        ),
        canSelectCategories: v.boolean(),
        disabledReason: v.union(v.string(), v.null()),
        primaryAction: planActionValidator,
        selectedCategoryIds: v.array(v.string()),
        selectedCount: v.number(),
        state: dashboardStateValidator,
        subtitle: v.string(),
        title: v.string(),
    }),
    leaderboard: v.object({
        emptyMessage: v.string(),
        items: v.array(
            v.object({
                id: v.string(),
                label: v.string(),
                rank: v.number(),
                score: v.string(),
            }),
        ),
        state: dashboardStateValidator,
        title: v.string(),
    }),
    meta: v.object({
        blockedMessage: v.union(v.string(), v.null()),
        blockedTitle: v.union(v.string(), v.null()),
        currentUser: v.object({
            email: v.string(),
            initials: v.string(),
            name: v.string(),
        }),
        departmentAccessMode: v.optional(
            v.union(v.literal("editable"), v.literal("read_only_grace"), v.null()),
        ),
        departmentId: v.union(v.string(), v.null()),
        fiscalYearKey: v.string(),
        generatedAt: v.number(),
        tenantId: v.string(),
        tenantName: v.string(),
        viewState: v.union(v.literal("blocked"), v.literal("dashboard")),
    }),
    plans: v.object({
        emptyMessage: v.string(),
        rows: v.array(
            v.object({
                action: planActionValidator,
                fiscalYear: v.string(),
                id: v.string(),
                isCurrentFiscalYear: v.boolean(),
                itemCount: v.number(),
                itemCountLabel: v.string(),
                rejectionComment: v.union(v.string(), v.null()),
                statusLabel: planStatusValidator,
                submissionReference: v.union(v.string(), v.null()),
                viewHref: v.string(),
            }),
        ),
        state: dashboardStateValidator,
        title: v.string(),
    }),
    quickStats: v.object({
        budget: v.object({
            breakdown: v.object({
                emptyMessage: v.string(),
                items: v.array(
                    v.object({
                        amountLabel: v.string(),
                        categoryName: v.string(),
                        id: v.string(),
                        itemCountLabel: v.string(),
                    }),
                ),
            }),
            helperText: v.string(),
            state: dashboardStateValidator,
            totalBudget: v.number(),
            totalBudgetLabel: v.string(),
            usedBudget: v.number(),
            usedBudgetLabel: v.string(),
            utilizationPercent: v.number(),
        }),
        deadline: v.object({
            deadlineDateLabel: v.string(),
            daysRemaining: v.union(v.number(), v.null()),
            fiscalYearKey: v.string(),
            fiscalYearLabel: v.string(),
            gaugeLabel: v.string(),
            gaugePercent: v.number(),
            helperText: v.string(),
            isUrgent: v.boolean(),
            label: v.string(),
            note: v.string(),
            state: dashboardStateValidator,
            targetAt: v.union(v.number(), v.null()),
            timeZone: v.string(),
        }),
        plan: v.object({
            helperText: v.string(),
            itemCount: v.number(),
            primaryActionHref: v.string(),
            primaryActionLabel: v.string(),
            state: dashboardStateValidator,
            statusLabel: planStatusValidator,
            submissionReference: v.union(v.string(), v.null()),
        }),
    }),
    rejectionNotice: v.union(
        v.object({
            action: planActionValidator,
            message: v.string(),
            title: v.string(),
        }),
        v.null(),
    ),
});

export const getDepartmentUserDashboardSnapshot = query({
    args: {},
    returns: dashboardSnapshotValidator,
    handler: async (ctx) => {
        const authContext = await requireTenantRole(ctx, ["department_user"]);
        const tenant = await ctx.db.get(authContext.tenantId);

        if (!tenant) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }

        const tenantUser = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId_tenantId", (q) =>
                q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId),
            )
            .first();
        const authUser = await ctx.db.get(authContext.userId);
        const currentUser = readAuthUserSummary(authUser, "Department User");

        if (!tenantUser || tenantUser.role !== "department_user" || !tenantUser.isActive) {
            return buildDepartmentUserDashboardSnapshot({
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
            return buildDepartmentUserDashboardSnapshot({
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

        if (
            !hasConfiguredDepartmentUserSubmissionWindow({
                submissionEndsAt: department.submissionEndsAt,
                submissionStartsAt: department.submissionStartsAt,
            })
        ) {
            return buildDepartmentUserDashboardSnapshot({
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

        const deadlineTimeZone = resolveDeadlineTimeZone({
            tenantTimeZone: tenant.timeZone,
        }).timeZone;
        const deadlineFiscalYearKey = getFiscalYearForTimestampInTimeZone({
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            timeZone: deadlineTimeZone,
            timestamp: department.submissionEndsAt as number,
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
                .withIndex("by_tenantId_fiscalYearKey", (q) =>
                    q.eq("tenantId", authContext.tenantId).eq(
                        "fiscalYearKey",
                        deadlineFiscalYearKey,
                    ),
                )
                .first(),
        ]);

        const procurementOfficerUser =
            procurementOfficerTenantUser?.userId
                ? await ctx.db.get(procurementOfficerTenantUser.userId)
                : null;
        const procurementOfficer =
            procurementOfficerTenantUser &&
            procurementOfficerTenantUser.role === "procurement_officer" &&
            procurementOfficerTenantUser.isActive
                ? readAuthUserSummary(procurementOfficerUser, "Procurement Officer")
                : null;
        const budgetAnnouncement = buildDepartmentBudgetChangeAnnouncement({
            budgetAllocation: department.budgetAllocation ?? null,
            departmentId: String(department._id),
            lastAuthenticatedAt: profile.lastAuthenticatedAt ?? null,
            lastBudgetChangedAt: department.lastBudgetChangedAt ?? null,
        });
        const deadlineAnnouncement = buildDepartmentDeadlineAnnouncement({
            announcementIssuedAt: submissionDeadline?.announcementIssuedAt ?? null,
            announcementMessage: submissionDeadline?.announcementMessage ?? null,
            announcementTitle: submissionDeadline?.announcementTitle ?? null,
            departmentId: String(department._id),
            lastAuthenticatedAt: profile.lastAuthenticatedAt ?? null,
        });
        const announcements = [budgetAnnouncement, deadlineAnnouncement].filter(
            (item): item is NonNullable<typeof item> => Boolean(item),
        );

        return buildDepartmentUserDashboardSnapshot({
            announcements,
            auth: {
                departmentAccessMode: authContext.departmentAccessMode,
                departmentId: String(department._id),
                tenantId: String(authContext.tenantId),
            },
            categories: categories.map((category) => ({
                archivedAt: category.archivedAt ?? null,
                color: category.color ?? null,
                id: String(category._id),
                icon: category.icon ?? null,
                isActive: category.isActive,
                name: category.name,
                sortOrder: category.sortOrder,
            })),
            currentUser,
            department: {
                budgetAllocation: department.budgetAllocation ?? null,
                code: department.code,
                id: String(department._id),
                name: department.name,
                submissionEndsAt: department.submissionEndsAt as number,
                submissionStartsAt: department.submissionStartsAt as number,
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
                selectedCategoryIds: plan.selectedCategoryIds.map((categoryId) =>
                    String(categoryId),
                ),
                status: plan.status,
                submissionReference: plan.submissionReference ?? null,
                submittedAt: plan.submittedAt ?? null,
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

function readAuthUserSummary(
    userDocument: unknown,
    fallbackName: string,
): { email: string; initials: string; name: string } {
    const record =
        userDocument && typeof userDocument === "object" && !Array.isArray(userDocument)
            ? (userDocument as Record<string, unknown>)
            : {};
    const email =
        typeof record.email === "string" && record.email.trim().length > 0
            ? record.email.trim()
            : "No email available";
    const name =
        typeof record.name === "string" && record.name.trim().length > 0
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
