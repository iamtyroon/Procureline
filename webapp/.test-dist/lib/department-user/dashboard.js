"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDepartmentDeadlineAnnouncement = exports.buildDepartmentBudgetChangeAnnouncement = exports.formatDepartmentUserCount = exports.formatDepartmentUserCurrency = exports.deriveLaunchpadState = exports.deriveDeadlinePresentation = exports.derivePlanAction = exports.normalizeDepartmentUserPlanStatus = exports.sanitizeCategorySelection = exports.selectAllCategories = exports.toggleCategorySelection = exports.createCategorySelectionState = exports.formatDepartmentUserFiscalYearLabel = exports.getDepartmentUserFiscalYearForDate = void 0;
const department_user_access_1 = require("../auth/department-user-access");
const deadlines_1 = require("../procurement-officer/deadlines");
const DAY_MS = 24 * 60 * 60 * 1000;
function getDepartmentUserFiscalYearForDate(timestamp, args) {
    const fiscalYear = (0, deadlines_1.getFiscalYearForTimestampInTimeZone)({
        fiscalYearStartMonth: args?.fiscalYearStartMonth ?? 7,
        timeZone: args?.timeZone ?? "Africa/Nairobi",
        timestamp,
    });
    return {
        endYear: fiscalYear.endYear,
        key: fiscalYear.key,
        label: fiscalYear.label,
        startYear: fiscalYear.startYear,
    };
}
exports.getDepartmentUserFiscalYearForDate = getDepartmentUserFiscalYearForDate;
function formatDepartmentUserFiscalYearLabel(fiscalYearKey) {
    const [startYear, endYear] = fiscalYearKey.split("-");
    if (!startYear || !endYear) {
        return fiscalYearKey;
    }
    return `${startYear}/${endYear.slice(-2)}`;
}
exports.formatDepartmentUserFiscalYearLabel = formatDepartmentUserFiscalYearLabel;
function createCategorySelectionState(categoryIds) {
    return Array.from(new Set(categoryIds.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}
exports.createCategorySelectionState = createCategorySelectionState;
function toggleCategorySelection(args) {
    const selected = new Set(args.selectedCategoryIds);
    if (selected.has(args.categoryId)) {
        selected.delete(args.categoryId);
    }
    else {
        selected.add(args.categoryId);
    }
    return createCategorySelectionState(Array.from(selected));
}
exports.toggleCategorySelection = toggleCategorySelection;
function selectAllCategories(categoryIds) {
    return createCategorySelectionState(categoryIds);
}
exports.selectAllCategories = selectAllCategories;
function sanitizeCategorySelection(args) {
    const availableIds = new Set(args.availableCategoryIds);
    return createCategorySelectionState(args.selectedCategoryIds.filter((categoryId) => availableIds.has(categoryId)));
}
exports.sanitizeCategorySelection = sanitizeCategorySelection;
function normalizeDepartmentUserPlanStatus(status) {
    switch ((status ?? "").toLowerCase()) {
        case "approved":
            return "Approved";
        case "draft":
            return "Draft";
        case "rejected":
            return "Rejected";
        case "submitted":
            return "Submitted";
        default:
            return "No Plan";
    }
}
exports.normalizeDepartmentUserPlanStatus = normalizeDepartmentUserPlanStatus;
function derivePlanAction(args) {
    if (!args.hasCanonicalPlan || args.status === "No Plan") {
        return {
            disabled: false,
            href: args.planHref,
            kind: "create",
            label: "Start Your Plan",
        };
    }
    if (args.status === "Draft") {
        return {
            disabled: false,
            href: args.planHref,
            kind: args.accessMode === "editable" ? "resume" : "view",
            label: args.accessMode === "editable" ? "Resume Plan" : "View Plan",
        };
    }
    if (args.status === "Rejected") {
        return {
            disabled: false,
            href: args.planHref,
            kind: args.accessMode === "editable" ? "edit" : "view_rejection",
            label: args.accessMode === "editable" ? "Edit Plan" : "View Rejection",
        };
    }
    return {
        disabled: false,
        href: args.planHref,
        kind: "view",
        label: "View Plan",
    };
}
exports.derivePlanAction = derivePlanAction;
function deriveDeadlinePresentation(args) {
    const windowState = (0, department_user_access_1.evaluateDepartmentUserSubmissionWindow)({
        now: args.now,
        submissionEndsAt: args.submissionEndsAt,
        submissionStartsAt: args.submissionStartsAt,
    });
    const resolvedAccessMode = args.departmentAccessMode ?? windowState.accessMode ?? null;
    const fiscalYearLabel = formatDepartmentUserFiscalYearLabel(args.fiscalYearKey);
    const timeZone = args.timeZone ?? "Africa/Nairobi";
    const submissionStartsLabel = (0, deadlines_1.formatDeadlineDateTime)(args.submissionStartsAt, timeZone, {
        includeTimeZoneName: true,
    });
    const submissionEndsLabel = (0, deadlines_1.formatDeadlineDateTime)(args.submissionEndsAt, timeZone, {
        includeTimeZoneName: true,
    });
    if (windowState.state === "not_started") {
        return {
            deadlineDateLabel: submissionStartsLabel,
            daysRemaining: null,
            fiscalYearKey: args.fiscalYearKey,
            fiscalYearLabel,
            gaugeLabel: "Upcoming",
            gaugePercent: 0,
            helperText: `Submission window opens on ${submissionStartsLabel}.`,
            isUrgent: false,
            label: "Submission Deadline",
            note: "Submission window not yet open",
            state: "coming_soon",
            targetAt: args.submissionStartsAt,
            timeZone,
        };
    }
    if (resolvedAccessMode === "read_only_grace" || windowState.state === "ended") {
        return {
            deadlineDateLabel: submissionEndsLabel,
            daysRemaining: 0,
            fiscalYearKey: args.fiscalYearKey,
            fiscalYearLabel,
            gaugeLabel: "Closed",
            gaugePercent: 0,
            helperText: `Submission closed on ${submissionEndsLabel}. Your plan is now read-only.`,
            isUrgent: false,
            label: "Submission Deadline",
            note: "Read-only period",
            state: "read_only",
            targetAt: args.submissionEndsAt,
            timeZone,
        };
    }
    const rawDaysRemaining = Math.ceil(Math.max(args.submissionEndsAt - args.now, 0) / DAY_MS);
    const safeDaysRemaining = Math.max(rawDaysRemaining, 0);
    const duration = Math.max(args.submissionEndsAt - args.submissionStartsAt, DAY_MS);
    const remainingDuration = Math.max(args.submissionEndsAt - args.now, 0);
    const gaugePercent = Math.max(0, Math.min(100, Math.round((remainingDuration / duration) * 100)));
    return {
        deadlineDateLabel: submissionEndsLabel,
        daysRemaining: safeDaysRemaining,
        fiscalYearKey: args.fiscalYearKey,
        fiscalYearLabel,
        gaugeLabel: (0, deadlines_1.formatDeadlineCountdown)({
            deadlineAt: args.submissionEndsAt,
            now: args.now,
        }),
        gaugePercent,
        helperText: safeDaysRemaining <= 7
            ? `Submission closes on ${submissionEndsLabel}.`
            : `Submission deadline is ${submissionEndsLabel}.`,
        isUrgent: safeDaysRemaining <= 7,
        label: "Submission Deadline",
        note: safeDaysRemaining <= 7
            ? "Deadline approaching"
            : "Submission window active",
        state: "available",
        targetAt: args.submissionEndsAt,
        timeZone,
    };
}
exports.deriveDeadlinePresentation = deriveDeadlinePresentation;
function deriveLaunchpadState(args) {
    if (args.hasCanonicalPlan) {
        return {
            canSelectCategories: false,
            disabledReason: "A current fiscal-year plan already exists for this department.",
            primaryAction: args.currentPlanAction,
            state: args.currentPlanAction.kind === "view" ||
                args.currentPlanAction.kind === "view_rejection"
                ? "read_only"
                : "available",
        };
    }
    if (args.budgetState !== "available") {
        return {
            canSelectCategories: false,
            disabledReason: "No budget allocated. Contact your Procurement Officer.",
            primaryAction: {
                ...args.currentPlanAction,
                disabled: true,
            },
            state: "setup_required",
        };
    }
    if (args.catalogState !== "available") {
        return {
            canSelectCategories: false,
            disabledReason: "Setup in progress. Your Procurement Officer is preparing the catalog.",
            primaryAction: {
                ...args.currentPlanAction,
                disabled: true,
            },
            state: "setup_required",
        };
    }
    if (args.deadlineState === "read_only") {
        return {
            canSelectCategories: true,
            disabledReason: args.deadlineHelperText ??
                "Submission deadline has passed. Your plan is now read-only.",
            primaryAction: {
                ...args.currentPlanAction,
                disabled: true,
            },
            state: "read_only",
        };
    }
    if (args.deadlineState === "coming_soon" || args.accessMode == null) {
        return {
            canSelectCategories: true,
            disabledReason: args.deadlineHelperText ?? "Submission window has not opened yet.",
            primaryAction: {
                ...args.currentPlanAction,
                disabled: true,
            },
            state: "coming_soon",
        };
    }
    if (args.selectedCategoryCount === 0) {
        return {
            canSelectCategories: true,
            disabledReason: "Select at least one category to start planning.",
            primaryAction: {
                ...args.currentPlanAction,
                disabled: true,
            },
            state: "available",
        };
    }
    return {
        canSelectCategories: true,
        disabledReason: null,
        primaryAction: {
            ...args.currentPlanAction,
            disabled: false,
        },
        state: "available",
    };
}
exports.deriveLaunchpadState = deriveLaunchpadState;
function formatDepartmentUserCurrency(amount) {
    const absAmount = Math.abs(amount);
    if (absAmount >= 1_000_000) {
        return `KES ${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (absAmount >= 1_000) {
        return `KES ${(amount / 1_000).toFixed(1)}K`;
    }
    return `KES ${amount.toFixed(0)}`;
}
exports.formatDepartmentUserCurrency = formatDepartmentUserCurrency;
function formatDepartmentUserCount(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}
exports.formatDepartmentUserCount = formatDepartmentUserCount;
function buildDepartmentBudgetChangeAnnouncement(args) {
    if (typeof args.lastBudgetChangedAt !== "number" ||
        (typeof args.lastAuthenticatedAt === "number" &&
            args.lastBudgetChangedAt <= args.lastAuthenticatedAt)) {
        return null;
    }
    return {
        id: `budget-change:${args.departmentId}:${args.lastBudgetChangedAt}`,
        message: typeof args.budgetAllocation === "number" && args.budgetAllocation > 0
            ? `Your department budget is now ${formatDepartmentUserCurrency(args.budgetAllocation)}. Review any draft planning assumptions.`
            : "Your Procurement Officer updated this department budget. Review any draft planning assumptions.",
        title: "Budget allocation updated",
    };
}
exports.buildDepartmentBudgetChangeAnnouncement = buildDepartmentBudgetChangeAnnouncement;
function buildDepartmentDeadlineAnnouncement(args) {
    if (typeof args.announcementIssuedAt !== "number" ||
        !args.announcementTitle ||
        !args.announcementMessage ||
        (typeof args.lastAuthenticatedAt === "number" &&
            args.announcementIssuedAt <= args.lastAuthenticatedAt)) {
        return null;
    }
    return {
        id: `deadline-announcement:${args.departmentId}:${args.announcementIssuedAt}`,
        message: args.announcementMessage,
        title: args.announcementTitle,
    };
}
exports.buildDepartmentDeadlineAnnouncement = buildDepartmentDeadlineAnnouncement;
