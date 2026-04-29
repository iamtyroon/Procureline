"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDepartmentUserDashboardSnapshot = void 0;
const dashboard_1 = require("./dashboard");
const status_tracking_1 = require("./status-tracking");
function buildDepartmentUserDashboardSnapshot(args) {
    const fallbackFiscalYear = (0, dashboard_1.getDepartmentUserFiscalYearForDate)(args.now, {
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        timeZone: args.tenantTimeZone,
    }).key;
    if (!args.department || !args.auth.departmentId) {
        return createBlockedSnapshot({
            auth: args.auth,
            currentUser: args.currentUser,
            fiscalYearKey: fallbackFiscalYear,
            now: args.now,
            tenant: args.tenant,
        });
    }
    const fiscalYearKey = (0, dashboard_1.getDepartmentUserFiscalYearForDate)(args.department.submissionStartsAt, {
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        timeZone: args.department.submissionTimeZone ??
            args.tenantTimeZone ??
            "Africa/Nairobi",
    }).key;
    const deadline = (0, dashboard_1.deriveDeadlinePresentation)({
        departmentAccessMode: args.auth.departmentAccessMode,
        fiscalYearKey,
        now: args.now,
        submissionEndsAt: args.department.submissionEndsAt,
        submissionStartsAt: args.department.submissionStartsAt,
        timeZone: args.department.submissionTimeZone ?? "Africa/Nairobi",
    });
    const statusTimeZone = args.department.submissionTimeZone ?? args.tenantTimeZone ?? "Africa/Nairobi";
    const canonicalPlans = (0, status_tracking_1.selectCanonicalPlans)(args.plans);
    const currentPlan = canonicalPlans.find((plan) => plan.fiscalYear === fiscalYearKey) ?? null;
    const currentPlanStatusDetails = (0, status_tracking_1.deriveDepartmentUserStatusDetails)({
        fiscalYearKey,
        plan: currentPlan,
        timeZone: statusTimeZone,
    });
    const currentPlanStatus = currentPlanStatusDetails.statusLabel;
    const currentPlanRevisionExpired = typeof currentPlan?.latestDecision?.effectiveRevisionDeadlineAt === "number" &&
        args.now > currentPlan.latestDecision.effectiveRevisionDeadlineAt;
    const currentPlanHref = currentPlan
        ? `/du/plans/${currentPlan.id}?mode=${(0, dashboard_1.isDepartmentUserEditablePlanStatus)(currentPlanStatus) &&
            !currentPlanRevisionExpired
            ? "edit"
            : "view"}`
        : "/du/plans/new";
    const currentPlanAction = (0, dashboard_1.derivePlanAction)({
        accessMode: currentPlanRevisionExpired ? null : args.auth.departmentAccessMode,
        hasCanonicalPlan: currentPlan !== null,
        planHref: currentPlanHref,
        status: currentPlanStatus,
    });
    const orderedCategories = [...args.categories].sort((left, right) => (left.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
        left.name.localeCompare(right.name));
    const categoriesById = new Map(orderedCategories.map((category) => [category.id, category]));
    const activeCategories = orderedCategories.filter((category) => category.isActive);
    const itemCountByCategory = new Map();
    for (const item of args.items) {
        if (!item.isActive) {
            continue;
        }
        itemCountByCategory.set(item.categoryId, (itemCountByCategory.get(item.categoryId) ?? 0) + 1);
    }
    const selectableCategoryIds = activeCategories
        .filter((category) => (itemCountByCategory.get(category.id) ?? 0) > 0)
        .map((category) => category.id);
    const hasCatalogItems = selectableCategoryIds.length > 0;
    const catalogState = activeCategories.length === 0 || !hasCatalogItems
        ? "setup_required"
        : "available";
    const selectedCategoryIds = currentPlan === null
        ? []
        : (0, dashboard_1.sanitizeCategorySelection)({
            availableCategoryIds: (0, dashboard_1.createCategorySelectionState)(currentPlan.selectedCategoryIds.filter((categoryId) => categoriesById.has(categoryId))),
            selectedCategoryIds: currentPlan.selectedCategoryIds,
        });
    const visibleCategoryIds = new Set(currentPlan === null
        ? activeCategories.map((category) => category.id)
        : [
            ...activeCategories.map((category) => category.id),
            ...selectedCategoryIds,
        ]);
    const visibleCategories = orderedCategories.filter((category) => visibleCategoryIds.has(category.id));
    const budgetAmount = args.department.budgetAllocation ?? null;
    const usedBudget = currentPlan?.estimatedBudgetUsed ?? 0;
    const budgetState = typeof budgetAmount === "number" && budgetAmount > 0 ? "available" : "empty";
    const utilizationPercent = budgetAmount && budgetAmount > 0
        ? Math.max(0, Math.min(100, Math.round((usedBudget / budgetAmount) * 100)))
        : 0;
    const budgetBreakdown = (currentPlan?.categorySummaries ?? [])
        .slice()
        .sort((left, right) => right.amount - left.amount)
        .map((summary) => ({
        amountLabel: (0, dashboard_1.formatDepartmentUserCurrency)(summary.amount),
        categoryName: summary.categoryName,
        id: summary.categoryId,
        itemCountLabel: (0, dashboard_1.formatDepartmentUserCount)(summary.itemCount, "item"),
    }));
    const launchpad = (0, dashboard_1.deriveLaunchpadState)({
        accessMode: args.auth.departmentAccessMode,
        budgetState,
        catalogState,
        currentPlanAction,
        deadlineHelperText: deadline.helperText,
        deadlineState: deadline.state,
        hasCanonicalPlan: currentPlan !== null,
    });
    const planRows = canonicalPlans
        .slice()
        .sort((left, right) => right.fiscalYear.localeCompare(left.fiscalYear))
        .map((plan) => createPlanRow({
        accessMode: plan.fiscalYear === fiscalYearKey
            ? args.auth.departmentAccessMode
            : null,
        fiscalYearKey,
        now: args.now,
        plan,
        timeZone: statusTimeZone,
    }));
    return {
        announcements: {
            emptyMessage: args.announcements.length === 0
                ? "Announcements are unavailable right now."
                : "No announcements",
            items: [...args.announcements],
            state: args.announcements.length > 0 ? "available" : "unavailable",
            title: "Recent Announcements",
        },
        heroSupport: {
            departmentCode: args.department.code,
            departmentName: args.department.name,
            support: args.procurementOfficer
                ? {
                    email: args.procurementOfficer.email,
                    helperText: "Planning Support Active",
                    initials: args.procurementOfficer.initials,
                    name: args.procurementOfficer.name,
                    pillLabel: "Planning Support Active",
                    state: "available",
                }
                : {
                    email: "Support contact unavailable",
                    helperText: "Procurement Officer support details are not available yet.",
                    initials: "--",
                    name: "Support unavailable",
                    pillLabel: "Support unavailable",
                    state: "unavailable",
                },
            tenantName: args.tenant.name,
        },
        launchpad: {
            categories: visibleCategories.map((category) => {
                const itemCount = itemCountByCategory.get(category.id) ?? 0;
                const isDisabled = !category.isActive || itemCount === 0;
                return {
                    disabled: isDisabled,
                    disabledReason: !category.isActive
                        ? "Archived categories remain visible on existing plans but are unavailable for new selection."
                        : itemCount === 0
                            ? "No active catalog items are available in this category yet."
                            : null,
                    id: category.id,
                    isSelected: selectedCategoryIds.includes(category.id),
                    itemCount,
                    itemCountLabel: (0, dashboard_1.formatDepartmentUserCount)(itemCount, "item"),
                    name: category.name,
                };
            }),
            canSelectCategories: launchpad.canSelectCategories,
            disabledReason: launchpad.disabledReason,
            primaryAction: launchpad.primaryAction,
            selectedCategoryIds,
            selectedCount: selectedCategoryIds.length,
            state: launchpad.state,
            subtitle: currentPlan === null
                ? "Select categories, then launch a new procurement plan."
                : "Your current fiscal-year plan already exists. Open it to continue.",
            title: "Plan Launchpad",
        },
        leaderboard: {
            emptyMessage: args.leaderboardEntries.length === 0
                ? "Leaderboard metrics are unavailable right now."
                : "No leaderboard data",
            items: [...args.leaderboardEntries],
            state: args.leaderboardEntries.length > 0 ? "available" : "unavailable",
            title: "Department Efficiency Leaderboard",
        },
        meta: {
            blockedMessage: null,
            blockedTitle: null,
            currentUser: args.currentUser,
            departmentAccessMode: args.auth.departmentAccessMode,
            departmentId: args.department.id,
            fiscalYearKey,
            generatedAt: args.now,
            tenantId: args.tenant.id,
            tenantName: args.tenant.name,
            viewState: "dashboard",
        },
        plans: {
            emptyMessage: planRows.length === 0
                ? "No plans available yet. Select categories above to start your first plan."
                : "",
            rows: planRows,
            state: planRows.length > 0 ? "available" : "empty",
            title: "Annual Procurement Plans",
        },
        quickStats: {
            budget: {
                breakdown: {
                    emptyMessage: budgetBreakdown.length === 0
                        ? "No category breakdown available yet."
                        : "",
                    items: budgetBreakdown,
                },
                helperText: budgetState === "available"
                    ? "Budget by category"
                    : "No budget allocated. Contact your Procurement Officer.",
                state: budgetState,
                totalBudget: budgetAmount ?? 0,
                totalBudgetLabel: budgetAmount && budgetAmount > 0
                    ? (0, dashboard_1.formatDepartmentUserCurrency)(budgetAmount)
                    : "--",
                usedBudget,
                usedBudgetLabel: budgetAmount && budgetAmount > 0
                    ? (0, dashboard_1.formatDepartmentUserCurrency)(usedBudget)
                    : "--",
                utilizationPercent,
            },
            deadline,
            plan: {
                canWithdraw: currentPlanStatusDetails.canWithdraw,
                helperText: currentPlanStatusDetails.helperText,
                historySummary: currentPlanStatusDetails.historySummary,
                itemCount: currentPlan?.itemCount ?? 0,
                primaryActionHref: currentPlanAction.href,
                primaryActionLabel: currentPlanAction.label,
                redraftRequest: {
                    canRequest: currentPlanStatus === "Approved" &&
                        currentPlan?.pendingRedraftRequest == null,
                    pendingRequestId: currentPlan?.pendingRedraftRequest?.id ?? null,
                    pendingReason: currentPlan?.pendingRedraftRequest?.reason ?? null,
                    requestedAt: currentPlan?.pendingRedraftRequest?.requestedAt ?? null,
                },
                reviewerLabel: currentPlanStatusDetails.reviewerLabel,
                reviewerState: currentPlanStatusDetails.reviewerState === "available"
                    ? "available"
                    : currentPlanStatusDetails.reviewerState === "unavailable"
                        ? "unavailable"
                        : null,
                state: currentPlan === null ? "empty" : "available",
                statusDateLabel: currentPlanStatusDetails.statusDateLabel,
                statusLabel: currentPlanStatus,
                submissionReference: currentPlanStatusDetails.submissionReference,
                timeline: currentPlanStatusDetails.timeline.map((item) => ({
                    description: item.description,
                    id: item.id,
                    timestampLabel: item.timestampLabel,
                    title: item.title,
                })),
            },
        },
        rejectionNotice: (currentPlanStatus === "Rejected" ||
            currentPlanStatus === "Revision Requested") &&
            currentPlan?.rejectionComment
            ? {
                action: currentPlanAction,
                message: currentPlan.rejectionComment,
                title: currentPlanStatus === "Revision Requested"
                    ? "Revision requested"
                    : "Rejected",
            }
            : null,
    };
}
exports.buildDepartmentUserDashboardSnapshot = buildDepartmentUserDashboardSnapshot;
function createBlockedSnapshot(args) {
    return {
        announcements: {
            emptyMessage: "Announcements are unavailable right now.",
            items: [],
            state: "unavailable",
            title: "Recent Announcements",
        },
        heroSupport: {
            departmentCode: "--",
            departmentName: "Department setup incomplete",
            support: {
                email: "Support contact unavailable",
                helperText: "Procurement Officer support details are not available yet.",
                initials: "--",
                name: "Support unavailable",
                pillLabel: "Support unavailable",
                state: "unavailable",
            },
            tenantName: args.tenant.name,
        },
        launchpad: {
            categories: [],
            canSelectCategories: false,
            disabledReason: "Department setup is incomplete. Contact your Procurement Officer to finish linking your account.",
            primaryAction: {
                disabled: true,
                href: "/du",
                kind: "create",
                label: "Start Your Plan",
            },
            selectedCategoryIds: [],
            selectedCount: 0,
            state: "unavailable",
            subtitle: "Department access must be linked before planning can begin.",
            title: "Plan Launchpad",
        },
        leaderboard: {
            emptyMessage: "Leaderboard metrics are unavailable right now.",
            items: [],
            state: "unavailable",
            title: "Department Efficiency Leaderboard",
        },
        meta: {
            blockedMessage: "Department setup is incomplete. Contact your Procurement Officer to finish linking your account.",
            blockedTitle: "Department setup incomplete",
            currentUser: args.currentUser,
            departmentAccessMode: args.auth.departmentAccessMode,
            departmentId: null,
            fiscalYearKey: args.fiscalYearKey,
            generatedAt: args.now,
            tenantId: args.tenant.id,
            tenantName: args.tenant.name,
            viewState: "blocked",
        },
        plans: {
            emptyMessage: "No department plan can be shown until setup is complete.",
            rows: [],
            state: "unavailable",
            title: "Annual Procurement Plans",
        },
        quickStats: {
            budget: {
                breakdown: {
                    emptyMessage: "No category breakdown available yet.",
                    items: [],
                },
                helperText: "Department setup is incomplete. Contact your Procurement Officer.",
                state: "unavailable",
                totalBudget: 0,
                totalBudgetLabel: "--",
                usedBudget: 0,
                usedBudgetLabel: "--",
                utilizationPercent: 0,
            },
            deadline: {
                deadlineDateLabel: "--",
                daysRemaining: null,
                fiscalYearKey: args.fiscalYearKey,
                fiscalYearLabel: args.fiscalYearKey,
                gaugeLabel: "--",
                gaugePercent: 0,
                helperText: "Department setup is incomplete. Contact your Procurement Officer.",
                isUrgent: false,
                label: "Submission Deadline",
                note: "Setup required",
                state: "unavailable",
                targetAt: null,
                timeZone: "Africa/Nairobi",
            },
            plan: {
                canWithdraw: false,
                helperText: "No Plan",
                historySummary: null,
                itemCount: 0,
                primaryActionHref: "/du",
                primaryActionLabel: "Start Your Plan",
                redraftRequest: {
                    canRequest: false,
                    pendingRequestId: null,
                    pendingReason: null,
                    requestedAt: null,
                },
                reviewerLabel: null,
                reviewerState: null,
                state: "unavailable",
                statusDateLabel: null,
                statusLabel: "No Plan",
                submissionReference: null,
                timeline: [],
            },
        },
        rejectionNotice: null,
    };
}
function createPlanRow(args) {
    const statusDetails = (0, status_tracking_1.deriveDepartmentUserStatusDetails)({
        fiscalYearKey: args.fiscalYearKey,
        plan: args.plan,
        timeZone: args.timeZone,
    });
    const statusLabel = statusDetails.statusLabel;
    const revisionExpired = typeof args.plan.latestDecision?.effectiveRevisionDeadlineAt === "number" &&
        typeof args.now === "number" &&
        args.now > args.plan.latestDecision.effectiveRevisionDeadlineAt;
    const editMode = (0, dashboard_1.isDepartmentUserEditablePlanStatus)(statusLabel) && !revisionExpired
        ? "edit"
        : "view";
    const planHref = `/du/plans/${args.plan.id}?mode=${editMode}`;
    return {
        action: (0, dashboard_1.derivePlanAction)({
            accessMode: revisionExpired ? null : args.accessMode,
            hasCanonicalPlan: true,
            planHref,
            status: statusLabel,
        }),
        fiscalYear: args.plan.fiscalYear,
        id: args.plan.id,
        isCurrentFiscalYear: args.plan.fiscalYear === args.fiscalYearKey,
        itemCount: args.plan.itemCount,
        itemCountLabel: (0, dashboard_1.formatDepartmentUserCount)(args.plan.itemCount, "item"),
        rejectionComment: args.plan.rejectionComment ?? null,
        reviewerLabel: statusDetails.reviewerLabel,
        statusDateLabel: statusDetails.statusDateLabel,
        statusDetail: statusDetails.helperText,
        statusHistorySummary: statusDetails.historySummary,
        statusLabel,
        submissionReference: statusDetails.submissionReference,
        viewHref: `/du/plans/${args.plan.id}?mode=view`,
    };
}
