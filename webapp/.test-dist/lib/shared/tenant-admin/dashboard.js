"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.humanizeToken = exports.formatDashboardTimestamp = exports.formatDashboardDate = exports.deriveQuickActions = exports.deriveOnboardingChecklist = exports.deriveDashboardCyclePresentation = exports.isTimestampInFiscalYear = exports.buildAvailableFiscalYears = exports.formatFiscalYearLabel = exports.getFiscalYearKeyForTimestamp = exports.parseFiscalYearKey = exports.getFiscalYearForDate = exports.KENYA_FISCAL_YEAR_START_MONTH_INDEX = void 0;
const date_fns_1 = require("date-fns");
exports.KENYA_FISCAL_YEAR_START_MONTH_INDEX = 6;
function getFiscalYearForDate(input) {
    const date = input instanceof Date ? input : new Date(input);
    const year = date.getUTCFullYear();
    const monthIndex = date.getUTCMonth();
    const startYear = monthIndex >= exports.KENYA_FISCAL_YEAR_START_MONTH_INDEX ? year : year - 1;
    const endYear = startYear + 1;
    return {
        endYear,
        endAt: Date.UTC(endYear, exports.KENYA_FISCAL_YEAR_START_MONTH_INDEX, 1),
        isCurrent: true,
        key: `${startYear}-${endYear}`,
        label: `FY ${startYear}/${endYear}`,
        startAt: Date.UTC(startYear, exports.KENYA_FISCAL_YEAR_START_MONTH_INDEX, 1),
        startYear,
    };
}
exports.getFiscalYearForDate = getFiscalYearForDate;
function parseFiscalYearKey(fiscalYearKey) {
    const match = /^(\d{4})-(\d{4})$/.exec(fiscalYearKey.trim());
    if (!match) {
        return null;
    }
    const startYear = Number(match[1]);
    const endYear = Number(match[2]);
    if (endYear !== startYear + 1) {
        return null;
    }
    return {
        endYear,
        endAt: Date.UTC(endYear, exports.KENYA_FISCAL_YEAR_START_MONTH_INDEX, 1),
        isCurrent: false,
        key: fiscalYearKey,
        label: `FY ${startYear}/${endYear}`,
        startAt: Date.UTC(startYear, exports.KENYA_FISCAL_YEAR_START_MONTH_INDEX, 1),
        startYear,
    };
}
exports.parseFiscalYearKey = parseFiscalYearKey;
function getFiscalYearKeyForTimestamp(timestamp) {
    return getFiscalYearForDate(timestamp).key;
}
exports.getFiscalYearKeyForTimestamp = getFiscalYearKeyForTimestamp;
function formatFiscalYearLabel(fiscalYearKey) {
    return parseFiscalYearKey(fiscalYearKey)?.label ?? fiscalYearKey;
}
exports.formatFiscalYearLabel = formatFiscalYearLabel;
function buildAvailableFiscalYears(args) {
    const currentFiscalYear = getFiscalYearForDate(args.now).key;
    const years = new Set([currentFiscalYear]);
    for (const timestamp of args.activityTimestamps ?? []) {
        years.add(getFiscalYearKeyForTimestamp(timestamp));
    }
    for (const fiscalYearKey of args.fiscalYearKeys ?? []) {
        if (parseFiscalYearKey(fiscalYearKey)) {
            years.add(fiscalYearKey);
        }
    }
    for (const department of args.departmentWindows ?? []) {
        if (typeof department.submissionStartsAt === "number") {
            years.add(getFiscalYearKeyForTimestamp(department.submissionStartsAt));
        }
        if (typeof department.submissionEndsAt === "number") {
            years.add(getFiscalYearKeyForTimestamp(department.submissionEndsAt));
        }
    }
    return Array.from(years)
        .filter((year) => year <= currentFiscalYear)
        .sort((left, right) => right.localeCompare(left));
}
exports.buildAvailableFiscalYears = buildAvailableFiscalYears;
function isTimestampInFiscalYear(args) {
    const parsedYear = parseFiscalYearKey(args.fiscalYearKey);
    if (!parsedYear) {
        return false;
    }
    return (args.timestamp >= parsedYear.startAt && args.timestamp < parsedYear.endAt);
}
exports.isTimestampInFiscalYear = isTimestampInFiscalYear;
function deriveDashboardCyclePresentation(args) {
    const activeDepartments = args.departments.filter((department) => department.isActive);
    if (activeDepartments.length === 0) {
        return {
            countdown: {
                label: "Add departments to define a submission window.",
                mode: "unavailable",
                targetAt: null,
            },
            description: "The dashboard cannot show a tenant-wide deadline until at least one active department exists.",
            reason: "no_departments",
            safeWindow: null,
            state: "setup_required",
            timeline: [
                createTimelineStep("prepare", "Preparation", "current", "Create departments and assign procurement ownership first."),
                createTimelineStep("submit", "Submission window", "blocked", "No shared submission dates are configured yet."),
                createTimelineStep("complete", "Cycle complete", "blocked", "Completion messaging appears after a valid window is configured."),
            ],
            title: "Setup required",
        };
    }
    const hasMissingWindow = activeDepartments.some((department) => typeof department.submissionStartsAt !== "number" ||
        typeof department.submissionEndsAt !== "number");
    if (hasMissingWindow) {
        return {
            countdown: {
                label: "Add submission dates to every active department.",
                mode: "unavailable",
                targetAt: null,
            },
            description: "A tenant-wide countdown is hidden until every active department exposes a usable submission start and end date.",
            reason: "missing_windows",
            safeWindow: null,
            state: "setup_required",
            timeline: [
                createTimelineStep("prepare", "Preparation", "current", "Department dates still need configuration."),
                createTimelineStep("submit", "Submission window", "blocked", "Incomplete department windows prevent a safe headline date."),
                createTimelineStep("complete", "Cycle complete", "blocked", "Completion metrics unlock once the window is reliable."),
            ],
            title: "Timeline not configured",
        };
    }
    const startDates = new Set(activeDepartments.map((department) => department.submissionStartsAt));
    const endDates = new Set(activeDepartments.map((department) => department.submissionEndsAt));
    if (startDates.size !== 1 || endDates.size !== 1) {
        return {
            countdown: {
                label: "Align department windows before showing a shared deadline.",
                mode: "unavailable",
                targetAt: null,
            },
            description: "Active departments currently disagree on the submission window, so the dashboard avoids inventing a synthetic tenant-wide date.",
            reason: "inconsistent_windows",
            safeWindow: null,
            state: "setup_required",
            timeline: [
                createTimelineStep("prepare", "Preparation", "current", "Review department windows and align them to one shared cycle."),
                createTimelineStep("submit", "Submission window", "blocked", "Different department dates cannot collapse into a single deadline safely."),
                createTimelineStep("complete", "Cycle complete", "blocked", "Completion messaging stays blocked until the timeline is trustworthy."),
            ],
            title: "Timeline needs alignment",
        };
    }
    const startAt = Array.from(startDates)[0];
    const endAt = Array.from(endDates)[0];
    if (startAt === undefined || endAt === undefined || endAt <= startAt) {
        return {
            countdown: {
                label: "Review the configured submission start and end dates.",
                mode: "unavailable",
                targetAt: null,
            },
            description: "The available department dates do not form a valid submission window yet.",
            reason: "invalid_window",
            safeWindow: null,
            state: "setup_required",
            timeline: [
                createTimelineStep("prepare", "Preparation", "current", "Correct the submission dates before exposing a countdown."),
                createTimelineStep("submit", "Submission window", "blocked", "Invalid date ordering is hiding the deadline intentionally."),
                createTimelineStep("complete", "Cycle complete", "blocked", "Completion metrics remain blocked until the dates are fixed."),
            ],
            title: "Invalid timeline configuration",
        };
    }
    if (args.now < startAt) {
        return {
            countdown: {
                label: buildCountdownLabel(startAt, args.now, "Submission opens"),
                mode: "until_start",
                targetAt: startAt,
            },
            description: `The selected fiscal year opens for submissions on ${formatDashboardDate(startAt)}.`,
            reason: null,
            safeWindow: { endAt, startAt },
            state: "before_start",
            timeline: [
                createTimelineStep("prepare", "Preparation", "current", "Use this period to finish onboarding and deadline communication."),
                createTimelineStep("submit", "Submission window", "upcoming", `Scheduled for ${formatDashboardDate(startAt)} to ${formatDashboardDate(endAt)}.`),
                createTimelineStep("complete", "Cycle complete", "upcoming", "Completion metrics appear after the submission window closes."),
            ],
            title: `Submission opens ${formatDashboardDate(startAt)}`,
        };
    }
    if (args.now <= endAt) {
        return {
            countdown: {
                label: buildCountdownLabel(endAt, args.now, "Deadline closes"),
                mode: "until_deadline",
                targetAt: endAt,
            },
            description: `Submissions are currently open for ${formatFiscalYearLabel(args.fiscalYearKey)}.`,
            reason: null,
            safeWindow: { endAt, startAt },
            state: "active_submission",
            timeline: [
                createTimelineStep("prepare", "Preparation", "complete", "Submission dates are configured and active."),
                createTimelineStep("submit", "Submission window", "current", `Live now until ${formatDashboardDate(endAt)}.`),
                createTimelineStep("complete", "Cycle complete", "upcoming", "Completion messaging appears after the active deadline passes."),
            ],
            title: `Submission deadline ${formatDashboardDate(endAt)}`,
        };
    }
    return {
        countdown: {
            label: `Submission window closed on ${formatDashboardDate(endAt)}.`,
            mode: "completed",
            targetAt: endAt,
        },
        description: "The current submission window has ended. The dashboard is now focused on completion messaging and follow-up actions.",
        reason: null,
        safeWindow: { endAt, startAt },
        state: "cycle_complete",
        timeline: [
            createTimelineStep("prepare", "Preparation", "complete", "Setup work was completed before the submission window opened."),
            createTimelineStep("submit", "Submission window", "complete", `Closed on ${formatDashboardDate(endAt)}.`),
            createTimelineStep("complete", "Cycle complete", "current", "Review completion outcomes and next-cycle readiness."),
        ],
        title: "Cycle complete",
    };
}
exports.deriveDashboardCyclePresentation = deriveDashboardCyclePresentation;
function deriveOnboardingChecklist(args) {
    const missingProcurementOfficer = args.procurementOfficerCount === 0;
    const missingDepartments = args.departmentCount === 0;
    const requiresSettings = args.cycleState === "setup_required";
    return [
        {
            availability: "available",
            description: missingProcurementOfficer
                ? "Assign your first Procurement Officer to unlock delegated procurement setup."
                : `${args.procurementOfficerCount} active Procurement Officer${args.procurementOfficerCount === 1 ? "" : "s"} available.`,
            href: "/tenant-admin/po-management",
            id: "add_po",
            isPriority: missingProcurementOfficer,
            label: "Add PO",
            status: missingProcurementOfficer ? "blocked" : "complete",
        },
        {
            availability: "available",
            description: missingDepartments
                ? "Departments and their submission windows are still missing, so the shared dashboard timeline stays blocked."
                : requiresSettings
                    ? "Department windows still need alignment before the tenant-wide timeline can be trusted."
                    : "Timeline and core setup are configured for the active cycle.",
            href: "/tenant-admin/settings",
            id: "configure_settings",
            isPriority: !missingProcurementOfficer && requiresSettings,
            label: "Configure Settings",
            status: missingDepartments || requiresSettings
                ? "blocked"
                : "complete",
        },
        {
            availability: "coming_soon",
            description: "Billing snapshots and invoice history are reserved for a follow-on story, so this remains a recommended follow-up.",
            href: "/tenant-admin/settings",
            id: "review_billing",
            isPriority: false,
            label: "Review Billing",
            status: "recommended",
        },
    ];
}
exports.deriveOnboardingChecklist = deriveOnboardingChecklist;
function deriveQuickActions(args) {
    const highlightAddPo = args.procurementOfficerCount === 0;
    const highlightSettings = !highlightAddPo &&
        (args.departmentCount === 0 || args.cycleState === "setup_required");
    const highlightReports = !highlightAddPo &&
        !highlightSettings &&
        args.cycleState === "cycle_complete";
    return [
        {
            description: highlightAddPo
                ? "Recommended next step: add your first Procurement Officer."
                : "Manage Procurement Officer assignments and ownership handoffs.",
            highlighted: highlightAddPo,
            href: "/tenant-admin/po-management",
            id: "add_po",
            label: "Add PO",
            status: highlightAddPo ? "setup_required" : "ready",
        },
        {
            description: highlightReports
                ? "Reserved next step once the cycle closes and reporting stories land."
                : "Reserved route for future reporting workflows.",
            highlighted: highlightReports,
            href: "/tenant-admin/reports",
            id: "view_reports",
            label: "View Reports",
            status: "coming_soon",
        },
        {
            description: highlightSettings
                ? "Recommended next step: finish institutional settings and submission dates."
                : "Review institutional settings, fiscal-year context, and future billing controls.",
            highlighted: highlightSettings,
            href: "/tenant-admin/settings",
            id: "settings",
            label: "Settings",
            status: highlightSettings ? "setup_required" : "ready",
        },
    ];
}
exports.deriveQuickActions = deriveQuickActions;
function formatDashboardDate(timestamp) {
    return (0, date_fns_1.format)(new Date(timestamp), "dd MMM yyyy");
}
exports.formatDashboardDate = formatDashboardDate;
function formatDashboardTimestamp(timestamp) {
    return (0, date_fns_1.format)(new Date(timestamp), "dd MMM yyyy HH:mm");
}
exports.formatDashboardTimestamp = formatDashboardTimestamp;
function humanizeToken(input) {
    return input
        .replaceAll(/[._-]+/g, " ")
        .trim()
        .replace(/\b\w/g, (character) => character.toUpperCase());
}
exports.humanizeToken = humanizeToken;
function buildCountdownLabel(targetAt, now, prefix) {
    const distance = (0, date_fns_1.formatDistanceStrict)(new Date(targetAt), new Date(now), {
        addSuffix: true,
    });
    return `${prefix} ${distance}`;
}
function createTimelineStep(id, label, status, description) {
    return {
        description,
        id,
        label,
        status,
    };
}
