import {
    evaluateDepartmentUserSubmissionWindow,
    type DepartmentUserAccessMode,
} from "../auth/department-user-access";

export type DepartmentUserDashboardState =
    | "available"
    | "coming_soon"
    | "empty"
    | "read_only"
    | "setup_required"
    | "unavailable";

export type DepartmentUserPlanStatus =
    | "Approved"
    | "Draft"
    | "No Plan"
    | "Rejected"
    | "Submitted";

export interface DepartmentUserFiscalYear {
    endYear: number;
    key: string;
    label: string;
    startYear: number;
}

export interface DepartmentUserDeadlinePresentation {
    deadlineDateLabel: string;
    daysRemaining: number | null;
    fiscalYearKey: string;
    fiscalYearLabel: string;
    gaugeLabel: string;
    gaugePercent: number;
    helperText: string;
    isUrgent: boolean;
    label: string;
    note: string;
    state: DepartmentUserDashboardState;
}

export interface DepartmentUserPlanAction {
    disabled: boolean;
    href: string;
    kind: "create" | "edit" | "resume" | "view" | "view_rejection";
    label: string;
}

export interface DepartmentUserLaunchpadState {
    canSelectCategories: boolean;
    disabledReason: string | null;
    primaryAction: DepartmentUserPlanAction;
    state: DepartmentUserDashboardState;
}

export interface DepartmentUserAnnouncement {
    id: string;
    message: string;
    title: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getDepartmentUserFiscalYearForDate(timestamp: number): DepartmentUserFiscalYear {
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const startYear = month >= 6 ? year : year - 1;
    const endYear = startYear + 1;

    return {
        endYear,
        key: `${startYear}-${endYear}`,
        label: `${startYear}/${String(endYear).slice(-2)}`,
        startYear,
    };
}

export function formatDepartmentUserFiscalYearLabel(fiscalYearKey: string): string {
    const [startYear, endYear] = fiscalYearKey.split("-");
    if (!startYear || !endYear) {
        return fiscalYearKey;
    }

    return `${startYear}/${endYear.slice(-2)}`;
}

export function createCategorySelectionState(categoryIds: readonly string[]): string[] {
    return Array.from(new Set(categoryIds.filter(Boolean))).sort((left, right) =>
        left.localeCompare(right),
    );
}

export function toggleCategorySelection(args: {
    categoryId: string;
    selectedCategoryIds: readonly string[];
}): string[] {
    const selected = new Set(args.selectedCategoryIds);
    if (selected.has(args.categoryId)) {
        selected.delete(args.categoryId);
    } else {
        selected.add(args.categoryId);
    }

    return createCategorySelectionState(Array.from(selected));
}

export function selectAllCategories(categoryIds: readonly string[]): string[] {
    return createCategorySelectionState(categoryIds);
}

export function sanitizeCategorySelection(args: {
    availableCategoryIds: readonly string[];
    selectedCategoryIds: readonly string[];
}): string[] {
    const availableIds = new Set(args.availableCategoryIds);
    return createCategorySelectionState(
        args.selectedCategoryIds.filter((categoryId) => availableIds.has(categoryId)),
    );
}

export function normalizeDepartmentUserPlanStatus(
    status: string | null | undefined,
): DepartmentUserPlanStatus {
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

export function derivePlanAction(args: {
    accessMode?: DepartmentUserAccessMode | null;
    hasCanonicalPlan: boolean;
    planHref: string;
    status: DepartmentUserPlanStatus;
}): DepartmentUserPlanAction {
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

export function deriveDeadlinePresentation(args: {
    departmentAccessMode?: DepartmentUserAccessMode | null;
    fiscalYearKey: string;
    now: number;
    submissionEndsAt: number;
    submissionStartsAt: number;
}): DepartmentUserDeadlinePresentation {
    const windowState = evaluateDepartmentUserSubmissionWindow({
        now: args.now,
        submissionEndsAt: args.submissionEndsAt,
        submissionStartsAt: args.submissionStartsAt,
    });
    const resolvedAccessMode = args.departmentAccessMode ?? windowState.accessMode ?? null;
    const fiscalYearLabel = formatDepartmentUserFiscalYearLabel(args.fiscalYearKey);
    const submissionStartsLabel = formatDepartmentUserDashboardDate(args.submissionStartsAt);
    const submissionEndsLabel = formatDepartmentUserDashboardDate(args.submissionEndsAt);

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
        };
    }

    const rawDaysRemaining = Math.ceil(
        Math.max(args.submissionEndsAt - args.now, 0) / DAY_MS,
    );
    const safeDaysRemaining = Math.max(rawDaysRemaining, 0);
    const duration = Math.max(args.submissionEndsAt - args.submissionStartsAt, DAY_MS);
    const remainingDuration = Math.max(args.submissionEndsAt - args.now, 0);
    const gaugePercent = Math.max(
        0,
        Math.min(100, Math.round((remainingDuration / duration) * 100)),
    );

    return {
        deadlineDateLabel: submissionEndsLabel,
        daysRemaining: safeDaysRemaining,
        fiscalYearKey: args.fiscalYearKey,
        fiscalYearLabel,
        gaugeLabel: `${safeDaysRemaining}d left`,
        gaugePercent,
        helperText:
            safeDaysRemaining <= 7
                ? `Submission closes on ${submissionEndsLabel}.`
                : `Submission deadline is ${submissionEndsLabel}.`,
        isUrgent: safeDaysRemaining <= 7,
        label: "Submission Deadline",
        note:
            safeDaysRemaining <= 7
                ? "Deadline approaching"
                : "Submission window active",
        state: "available",
    };
}

function formatDepartmentUserDashboardDate(timestamp: number): string {
    return new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(timestamp));
}

export function deriveLaunchpadState(args: {
    accessMode?: DepartmentUserAccessMode | null;
    budgetState: DepartmentUserDashboardState;
    catalogState: DepartmentUserDashboardState;
    currentPlanAction: DepartmentUserPlanAction;
    deadlineHelperText?: string;
    deadlineState?: DepartmentUserDashboardState;
    hasCanonicalPlan: boolean;
    selectedCategoryCount: number;
}): DepartmentUserLaunchpadState {
    if (args.hasCanonicalPlan) {
        return {
            canSelectCategories: false,
            disabledReason: "A current fiscal-year plan already exists for this department.",
            primaryAction: args.currentPlanAction,
            state:
                args.currentPlanAction.kind === "view" ||
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
            disabledReason:
                "Setup in progress. Your Procurement Officer is preparing the catalog.",
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
            disabledReason:
                args.deadlineHelperText ??
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
            disabledReason:
                args.deadlineHelperText ?? "Submission window has not opened yet.",
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

export function formatDepartmentUserCurrency(amount: number): string {
    const absAmount = Math.abs(amount);
    if (absAmount >= 1_000_000) {
        return `KES ${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (absAmount >= 1_000) {
        return `KES ${(amount / 1_000).toFixed(1)}K`;
    }
    return `KES ${amount.toFixed(0)}`;
}

export function formatDepartmentUserCount(
    count: number,
    singular: string,
    plural = `${singular}s`,
): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

export function buildDepartmentBudgetChangeAnnouncement(args: {
    budgetAllocation?: number | null;
    departmentId: string;
    lastAuthenticatedAt?: number | null;
    lastBudgetChangedAt?: number | null;
}): DepartmentUserAnnouncement | null {
    if (
        typeof args.lastBudgetChangedAt !== "number" ||
        (typeof args.lastAuthenticatedAt === "number" &&
            args.lastBudgetChangedAt <= args.lastAuthenticatedAt)
    ) {
        return null;
    }

    return {
        id: `budget-change:${args.departmentId}:${args.lastBudgetChangedAt}`,
        message:
            typeof args.budgetAllocation === "number" && args.budgetAllocation > 0
                ? `Your department budget is now ${formatDepartmentUserCurrency(
                      args.budgetAllocation,
                  )}. Review any draft planning assumptions.`
                : "Your Procurement Officer updated this department budget. Review any draft planning assumptions.",
        title: "Budget allocation updated",
    };
}
