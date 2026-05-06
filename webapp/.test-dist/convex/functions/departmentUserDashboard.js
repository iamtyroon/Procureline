"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartmentUserDashboardSnapshot = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const _roleGuard_1 = require("./_roleGuard");
const dashboard_1 = require("../../lib/department-user/dashboard");
const dashboard_snapshot_1 = require("../../lib/department-user/dashboard-snapshot");
const department_user_access_1 = require("../../lib/shared/auth/department-user-access");
const deadlines_1 = require("../../lib/procurement-officer/deadlines");
const revision_deadline_1 = require("../../lib/plans/revision-deadline");
const status_tracking_1 = require("../../lib/department-user/status-tracking");
const dashboardStateValidator = values_1.v.union(values_1.v.literal("available"), values_1.v.literal("coming_soon"), values_1.v.literal("empty"), values_1.v.literal("read_only"), values_1.v.literal("setup_required"), values_1.v.literal("unavailable"));
const planActionValidator = values_1.v.object({
    disabled: values_1.v.boolean(),
    href: values_1.v.string(),
    kind: values_1.v.union(values_1.v.literal("create"), values_1.v.literal("edit"), values_1.v.literal("resume"), values_1.v.literal("view"), values_1.v.literal("view_rejection")),
    label: values_1.v.string(),
});
const planStatusValidator = values_1.v.union(values_1.v.literal("Approved"), values_1.v.literal("Draft"), values_1.v.literal("No Plan"), values_1.v.literal("Rejected"), values_1.v.literal("Revision Requested"), values_1.v.literal("Submitted"), values_1.v.literal("Under Review"));
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
            disabled: values_1.v.boolean(),
            disabledReason: values_1.v.union(values_1.v.string(), values_1.v.null()),
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
            reviewerLabel: values_1.v.union(values_1.v.string(), values_1.v.null()),
            statusDateLabel: values_1.v.union(values_1.v.string(), values_1.v.null()),
            statusDetail: values_1.v.string(),
            statusHistorySummary: values_1.v.union(values_1.v.string(), values_1.v.null()),
            statusLabel: planStatusValidator,
            submissionReference: values_1.v.union(values_1.v.string(), values_1.v.null()),
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
            canWithdraw: values_1.v.boolean(),
            helperText: values_1.v.string(),
            historySummary: values_1.v.union(values_1.v.string(), values_1.v.null()),
            itemCount: values_1.v.number(),
            primaryActionHref: values_1.v.string(),
            primaryActionLabel: values_1.v.string(),
            redraftRequest: values_1.v.object({
                canRequest: values_1.v.boolean(),
                pendingRequestId: values_1.v.union(values_1.v.string(), values_1.v.null()),
                pendingReason: values_1.v.union(values_1.v.string(), values_1.v.null()),
                requestedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
            }),
            reviewerLabel: values_1.v.union(values_1.v.string(), values_1.v.null()),
            reviewerState: values_1.v.union(dashboardStateValidator, values_1.v.null()),
            state: dashboardStateValidator,
            statusDateLabel: values_1.v.union(values_1.v.string(), values_1.v.null()),
            statusLabel: planStatusValidator,
            submissionReference: values_1.v.union(values_1.v.string(), values_1.v.null()),
            timeline: values_1.v.array(values_1.v.object({
                description: values_1.v.string(),
                id: values_1.v.string(),
                timestampLabel: values_1.v.string(),
                title: values_1.v.string(),
            })),
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
        const [categories, items, plans, redraftRequests, procurementOfficerTenantUser, submissionDeadline] = await Promise.all([
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
            ctx.db
                .query("planRedraftRequests")
                .withIndex("by_departmentId_status", (q) => q.eq("departmentId", department._id).eq("status", "pending"))
                .collect(),
            ctx.db.get(department.procurementOfficerTenantUserId),
            ctx.db
                .query("submissionDeadlines")
                .withIndex("by_tenantId_fiscalYearKey", (q) => q.eq("tenantId", authContext.tenantId).eq("fiscalYearKey", deadlineFiscalYearKey))
                .first(),
        ]);
        const canonicalPlanIds = new Set((0, status_tracking_1.selectCanonicalPlans)(plans.map((plan) => ({
            createdAt: plan.createdAt,
            fiscalYear: plan.fiscalYear,
            id: String(plan._id),
            itemCount: plan.itemCount,
            approvedAt: plan.approvedAt ?? null,
            lastApprovedAt: plan.lastApprovedAt ?? null,
            rejectedAt: plan.rejectedAt ?? null,
            reviewStartedAt: plan.reviewStartedAt ?? null,
            status: plan.status,
            submittedAt: plan.submittedAt ?? null,
            updatedAt: plan.updatedAt,
        }))).map((plan) => plan.id));
        const canonicalPlans = plans.filter((plan) => canonicalPlanIds.has(String(plan._id)));
        const planSnapshotEntries = await Promise.all(canonicalPlans.map(async (plan) => [
            String(plan._id),
            await ctx.db
                .query("planSubmissionSnapshots")
                .withIndex("by_planId_submittedAt", (q) => q.eq("planId", plan._id))
                .collect(),
        ]));
        const planSnapshotsByPlanId = new Map(planSnapshotEntries);
        const decisionEntries = await Promise.all(canonicalPlans.map(async (plan) => [
            String(plan._id),
            await ctx.db
                .query("planReviewDecisions")
                .withIndex("by_planId_decidedAt", (q) => q.eq("planId", plan._id))
                .collect(),
        ]));
        const decisionsByPlanId = new Map(decisionEntries);
        const reviewerRecordIds = new Set();
        for (const plan of canonicalPlans) {
            if (plan.reviewStartedByUserId && plan.reviewStartedByTenantUserId) {
                reviewerRecordIds.add(String(plan.reviewStartedByUserId));
                reviewerRecordIds.add(String(plan.reviewStartedByTenantUserId));
            }
        }
        const reviewerRecordEntries = await Promise.all(Array.from(reviewerRecordIds).map(async (recordId) => {
            const userId = ctx.db.normalizeId("users", recordId);
            if (userId) {
                return [recordId, await ctx.db.get(userId)];
            }
            const tenantUserId = ctx.db.normalizeId("tenantUsers", recordId);
            return tenantUserId
                ? [recordId, await ctx.db.get(tenantUserId)]
                : [recordId, null];
        }));
        const reviewerRecordsById = new Map(reviewerRecordEntries);
        const reviewerEntries = await Promise.all(canonicalPlans.map(async (plan) => {
            if (!plan.reviewStartedByUserId || !plan.reviewStartedByTenantUserId) {
                return [String(plan._id), null];
            }
            const reviewerUser = reviewerRecordsById.get(String(plan.reviewStartedByUserId));
            const reviewerTenantUser = readRecord(reviewerRecordsById.get(String(plan.reviewStartedByTenantUserId)));
            const isTenantScopedReviewer = reviewerTenantUser
                ? reviewerTenantUser.tenantId === authContext.tenantId &&
                    reviewerTenantUser.userId === plan.reviewStartedByUserId &&
                    reviewerTenantUser.role === "procurement_officer" &&
                    reviewerTenantUser.isActive === true
                : false;
            if (!isTenantScopedReviewer) {
                return [
                    String(plan._id),
                    {
                        label: null,
                        state: "unavailable",
                    },
                ];
            }
            return [
                String(plan._id),
                {
                    label: readAuthUserSummary(reviewerUser, "Procurement Officer").name,
                    state: "available",
                },
            ];
        }));
        const reviewerByPlanId = new Map(reviewerEntries);
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
        const pendingRedraftRequestByPlanId = new Map(redraftRequests.map((request) => [String(request.planId), request]));
        return (0, dashboard_snapshot_1.buildDepartmentUserDashboardSnapshot)({
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
                latestDecision: (() => {
                    const decisions = decisionsByPlanId.get(String(plan._id)) ?? [];
                    const activeDecision = decisions
                        .filter((decision) => decision.lifecycleStatus === "active")
                        .sort((left, right) => right.decidedAt - left.decidedAt)[0] ??
                        null;
                    return activeDecision
                        ? {
                            comment: activeDecision.comment,
                            decidedAt: activeDecision.decidedAt,
                            decisionType: activeDecision.decisionType,
                            effectiveRevisionDeadlineAt: (0, revision_deadline_1.deriveDepartmentUserEffectiveRevisionDeadline)({
                                decisionType: activeDecision.decisionType,
                                decidedAt: activeDecision.decidedAt,
                                revisionDeadlineAt: activeDecision.revisionDeadlineAt ?? null,
                                submissionDeadlineAt: resolveDepartmentEffectiveSubmissionDeadlineAt({
                                    departmentSubmissionEndsAt: department.submissionEndsAt,
                                    sharedSubmissionEndsAt: submissionDeadline?.submissionEndsAt,
                                }),
                            }).effectiveDeadlineAt,
                            revisionDeadlineAt: activeDecision.revisionDeadlineAt ?? null,
                        }
                        : null;
                })(),
                lastApprovedAt: plan.lastApprovedAt ?? null,
                rejectionComment: plan.rejectionComment ?? null,
                rejectedAt: plan.rejectedAt ?? null,
                reviewStartedAt: plan.reviewStartedAt ?? null,
                reviewDecisions: (decisionsByPlanId.get(String(plan._id)) ?? []).map((decision) => ({
                    comment: decision.comment,
                    decidedAt: decision.decidedAt,
                    decisionType: decision.decisionType,
                    effectiveRevisionDeadlineAt: (0, revision_deadline_1.deriveDepartmentUserEffectiveRevisionDeadline)({
                        decisionType: decision.decisionType,
                        decidedAt: decision.decidedAt,
                        revisionDeadlineAt: decision.revisionDeadlineAt ?? null,
                        submissionDeadlineAt: resolveDepartmentEffectiveSubmissionDeadlineAt({
                            departmentSubmissionEndsAt: department.submissionEndsAt,
                            sharedSubmissionEndsAt: submissionDeadline?.submissionEndsAt,
                        }),
                    }).effectiveDeadlineAt,
                    id: String(decision._id),
                    lifecycleStatus: decision.lifecycleStatus ?? null,
                    revisionDeadlineAt: decision.revisionDeadlineAt ?? null,
                })),
                reviewer: reviewerByPlanId.get(String(plan._id)) ?? null,
                selectedCategoryIds: plan.selectedCategoryIds.map((categoryId) => String(categoryId)),
                status: plan.status,
                submissionReference: plan.submissionReference ?? null,
                submissionSnapshots: (planSnapshotsByPlanId.get(String(plan._id)) ?? []).map((snapshot) => ({
                    capturedAt: snapshot.capturedAt,
                    lifecycleStatus: snapshot.lifecycleStatus ?? null,
                    submissionReference: snapshot.submissionReference ?? null,
                    submissionSequence: snapshot.submissionSequence ?? null,
                    submittedAt: snapshot.submittedAt ?? null,
                    withdrawnAt: snapshot.withdrawnAt ?? null,
                })),
                submittedAt: plan.submittedAt ?? null,
                approvedAt: plan.approvedAt ?? null,
                pendingRedraftRequest: (() => {
                    const request = pendingRedraftRequestByPlanId.get(String(plan._id));
                    return request
                        ? {
                            id: String(request._id),
                            reason: request.reason,
                            requestedAt: request.createdAt,
                        }
                        : null;
                })(),
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
function readRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function resolveDepartmentEffectiveSubmissionDeadlineAt(args) {
    if (typeof args.departmentSubmissionEndsAt === "number" &&
        typeof args.sharedSubmissionEndsAt === "number") {
        return Math.max(args.departmentSubmissionEndsAt, args.sharedSubmissionEndsAt);
    }
    return args.sharedSubmissionEndsAt ?? args.departmentSubmissionEndsAt ?? null;
}
