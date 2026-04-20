"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeProcurementOfficerSubmissionQueue = exports.hasActiveProcurementOfficerSubmissionFilters = exports.collectProcurementOfficerSubmissionNotifications = exports.deriveProcurementOfficerSubmissionEmptyState = exports.filterProcurementOfficerSubmissionRows = exports.sortProcurementOfficerSubmissionRows = exports.shapeProcurementOfficerSubmissionRow = exports.getProcurementOfficerSubmissionStatusLabel = exports.buildProcurementOfficerSubmissionReviewHref = exports.buildProcurementOfficerSubmissionModalPath = exports.extractProcurementOfficerSubmissionSearchParams = exports.buildProcurementOfficerSubmissionSearchParams = exports.normalizeProcurementOfficerSubmissionFilters = exports.PROCUREMENT_OFFICER_SUBMISSION_STATUSES = exports.PROCUREMENT_OFFICER_SUBMISSION_SORT_DIRECTIONS = exports.PROCUREMENT_OFFICER_SUBMISSION_SORT_FIELDS = exports.PROCUREMENT_OFFICER_SUBMISSION_NOTICE_VALUES = exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS = void 0;
const departments_1 = require("./departments");
const deadlines_1 = require("./deadlines");
const dashboard_search_1 = require("./dashboard-search");
const DAY_MS = 24 * 60 * 60 * 1000;
exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS = {
    departmentId: "poSubmissionsDepartment",
    direction: "poSubmissionsDirection",
    endDate: "poSubmissionsEnd",
    notice: "poSubmissionsNotice",
    sortBy: "poSubmissionsSort",
    startDate: "poSubmissionsStart",
    status: "poSubmissionsStatus",
};
exports.PROCUREMENT_OFFICER_SUBMISSION_NOTICE_VALUES = [
    "review-target-unavailable",
];
exports.PROCUREMENT_OFFICER_SUBMISSION_SORT_FIELDS = [
    "submittedAt",
    "departmentName",
    "estimatedBudgetUsed",
    "status",
];
exports.PROCUREMENT_OFFICER_SUBMISSION_SORT_DIRECTIONS = [
    "asc",
    "desc",
];
exports.PROCUREMENT_OFFICER_SUBMISSION_STATUSES = [
    "submitted",
    "approved",
    "rejected",
];
function isSubmissionStatus(value) {
    return exports.PROCUREMENT_OFFICER_SUBMISSION_STATUSES.some((status) => status === value);
}
function isSubmissionSortField(value) {
    return exports.PROCUREMENT_OFFICER_SUBMISSION_SORT_FIELDS.some((field) => field === value);
}
function isSubmissionSortDirection(value) {
    return exports.PROCUREMENT_OFFICER_SUBMISSION_SORT_DIRECTIONS.some((direction) => direction === value);
}
function isSubmissionNotice(value) {
    return exports.PROCUREMENT_OFFICER_SUBMISSION_NOTICE_VALUES.some((notice) => notice === value);
}
function addDaysToIsoDate(value, days) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) {
        return null;
    }
    const nextDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
    return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDate.getUTCDate()).padStart(2, "0")}`;
}
function buildDateBoundaryTimestamp(args) {
    if (!args.date) {
        return null;
    }
    const resolvedTimeZone = (0, deadlines_1.resolveDeadlineTimeZone)({
        tenantTimeZone: args.tenantTimeZone,
    }).timeZone;
    if (args.boundary === "start") {
        return ((0, deadlines_1.parseTimeZoneInputValue)(`${args.date}T00:00`, resolvedTimeZone) ?? null);
    }
    const nextDate = addDaysToIsoDate(args.date, 1);
    if (!nextDate) {
        return null;
    }
    const nextDayStart = (0, deadlines_1.parseTimeZoneInputValue)(`${nextDate}T00:00`, resolvedTimeZone);
    return typeof nextDayStart === "number" ? nextDayStart - 1 : null;
}
function getStatusSortRank(status) {
    switch (status) {
        case "approved":
            return 0;
        case "rejected":
            return 1;
        default:
            return 2;
    }
}
function compareText(left, right) {
    return left.localeCompare(right, undefined, {
        sensitivity: "base",
    });
}
function compareRowsDeterministically(left, right, primaryComparison) {
    if (primaryComparison !== 0) {
        return primaryComparison;
    }
    const submittedAtComparison = left.sortSubmittedAt - right.sortSubmittedAt;
    if (submittedAtComparison !== 0) {
        return submittedAtComparison;
    }
    const departmentComparison = compareText(left.departmentName, right.departmentName);
    if (departmentComparison !== 0) {
        return departmentComparison;
    }
    return left.planId.localeCompare(right.planId);
}
function normalizeProcurementOfficerSubmissionFilters(input, options) {
    const departmentId = input?.departmentId?.trim() ?? "";
    const startDate = input?.startDate?.trim() ?? "";
    const endDate = input?.endDate?.trim() ?? "";
    return {
        departmentId: departmentId.length > 0 ? departmentId : null,
        endDate: endDate.length > 0 ? endDate : null,
        endTimestamp: buildDateBoundaryTimestamp({
            boundary: "end",
            date: endDate.length > 0 ? endDate : null,
            tenantTimeZone: options?.tenantTimeZone,
        }),
        notice: isSubmissionNotice(input?.notice) ? input.notice : null,
        sortBy: isSubmissionSortField(input?.sortBy)
            ? input.sortBy
            : "submittedAt",
        sortDirection: isSubmissionSortDirection(input?.sortDirection)
            ? input.sortDirection
            : "asc",
        startDate: startDate.length > 0 ? startDate : null,
        startTimestamp: buildDateBoundaryTimestamp({
            boundary: "start",
            date: startDate.length > 0 ? startDate : null,
            tenantTimeZone: options?.tenantTimeZone,
        }),
        status: isSubmissionStatus(input?.status) ? input.status : null,
    };
}
exports.normalizeProcurementOfficerSubmissionFilters = normalizeProcurementOfficerSubmissionFilters;
function buildProcurementOfficerSubmissionSearchParams(input) {
    const normalized = normalizeProcurementOfficerSubmissionFilters(input);
    const searchParams = new URLSearchParams();
    if (normalized.departmentId) {
        searchParams.set(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.departmentId, normalized.departmentId);
    }
    if (normalized.status) {
        searchParams.set(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.status, normalized.status);
    }
    if (normalized.startDate) {
        searchParams.set(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.startDate, normalized.startDate);
    }
    if (normalized.endDate) {
        searchParams.set(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.endDate, normalized.endDate);
    }
    if (normalized.sortBy !== "submittedAt") {
        searchParams.set(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.sortBy, normalized.sortBy);
    }
    if (normalized.sortDirection !== "asc") {
        searchParams.set(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.direction, normalized.sortDirection);
    }
    if (normalized.notice) {
        searchParams.set(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.notice, normalized.notice);
    }
    return searchParams;
}
exports.buildProcurementOfficerSubmissionSearchParams = buildProcurementOfficerSubmissionSearchParams;
function extractProcurementOfficerSubmissionSearchParams(searchParams) {
    const rawNotice = searchParams.get(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.notice);
    const rawSortBy = searchParams.get(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.sortBy);
    const rawSortDirection = searchParams.get(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.direction);
    const rawStatus = searchParams.get(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.status);
    const normalized = normalizeProcurementOfficerSubmissionFilters({
        departmentId: searchParams.get(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.departmentId),
        endDate: searchParams.get(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.endDate),
        notice: isSubmissionNotice(rawNotice) ? rawNotice : null,
        sortBy: isSubmissionSortField(rawSortBy) ? rawSortBy : null,
        sortDirection: isSubmissionSortDirection(rawSortDirection)
            ? rawSortDirection
            : null,
        startDate: searchParams.get(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.startDate),
        status: isSubmissionStatus(rawStatus) ? rawStatus : null,
    });
    return buildProcurementOfficerSubmissionSearchParams(normalized);
}
exports.extractProcurementOfficerSubmissionSearchParams = extractProcurementOfficerSubmissionSearchParams;
function buildProcurementOfficerSubmissionModalPath(args) {
    const searchParams = new URLSearchParams({
        modal: "submissions",
    });
    const dashboardSearchParams = args?.submissionWorkspaceSearchParams
        ? (0, dashboard_search_1.extractProcurementOfficerDashboardSearchParams)(args.submissionWorkspaceSearchParams)
        : new URLSearchParams();
    const whitelisted = args?.submissionWorkspaceSearchParams
        ? extractProcurementOfficerSubmissionSearchParams(args.submissionWorkspaceSearchParams)
        : new URLSearchParams();
    dashboardSearchParams.forEach((value, key) => {
        searchParams.append(key, value);
    });
    if (args?.notice) {
        whitelisted.set(exports.PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.notice, args.notice);
    }
    whitelisted.forEach((value, key) => {
        searchParams.append(key, value);
    });
    return `/po?${searchParams.toString()}`;
}
exports.buildProcurementOfficerSubmissionModalPath = buildProcurementOfficerSubmissionModalPath;
function buildProcurementOfficerSubmissionReviewHref(args) {
    const searchParams = new URLSearchParams({
        planId: args.planId,
        from: "submissions",
    });
    if (args.returnToSearchParams) {
        const dashboardSearchParams = (0, dashboard_search_1.extractProcurementOfficerDashboardSearchParams)(args.returnToSearchParams);
        const queueSearchParams = extractProcurementOfficerSubmissionSearchParams(args.returnToSearchParams);
        dashboardSearchParams.forEach((value, key) => {
            searchParams.append(key, value);
        });
        queueSearchParams.forEach((value, key) => {
            searchParams.append(key, value);
        });
    }
    return `/po/review?${searchParams.toString()}`;
}
exports.buildProcurementOfficerSubmissionReviewHref = buildProcurementOfficerSubmissionReviewHref;
function getProcurementOfficerSubmissionStatusLabel(status) {
    switch (status) {
        case "approved":
            return "Approved";
        case "rejected":
            return "Rejected";
        default:
            return "Submitted";
    }
}
exports.getProcurementOfficerSubmissionStatusLabel = getProcurementOfficerSubmissionStatusLabel;
function shapeProcurementOfficerSubmissionRow(args) {
    const sortSubmittedAt = args.row.submittedAt ?? args.row.updatedAt;
    const resolvedTimeZone = (0, deadlines_1.resolveDeadlineTimeZone)({
        tenantTimeZone: args.tenantTimeZone,
    }).timeZone;
    const now = args.now ?? Date.now();
    const ageInDays = Math.max(0, Math.ceil((now - sortSubmittedAt) / DAY_MS));
    return {
        ...args.row,
        reviewHref: buildProcurementOfficerSubmissionReviewHref({
            planId: args.row.planId,
        }),
        sortSubmittedAt,
        statusLabel: getProcurementOfficerSubmissionStatusLabel(args.row.status),
        submittedAtLabel: (0, deadlines_1.formatDeadlineDateTime)(sortSubmittedAt, resolvedTimeZone),
        totalAmountLabel: (0, departments_1.formatDepartmentBudget)(args.row.estimatedBudgetUsed),
        urgencyLabel: args.row.status === "submitted" && ageInDays >= 7
            ? `${ageInDays}d waiting`
            : null,
    };
}
exports.shapeProcurementOfficerSubmissionRow = shapeProcurementOfficerSubmissionRow;
function sortProcurementOfficerSubmissionRows(rows, options) {
    const sortBy = options?.sortBy ?? "submittedAt";
    const direction = options?.direction ?? "asc";
    const directionMultiplier = direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
        let comparison = 0;
        switch (sortBy) {
            case "departmentName":
                comparison = compareText(left.departmentName, right.departmentName);
                break;
            case "estimatedBudgetUsed":
                comparison = left.estimatedBudgetUsed - right.estimatedBudgetUsed;
                break;
            case "status":
                comparison =
                    getStatusSortRank(left.status) - getStatusSortRank(right.status);
                break;
            default:
                comparison = left.sortSubmittedAt - right.sortSubmittedAt;
                break;
        }
        return (compareRowsDeterministically(left, right, comparison) * directionMultiplier);
    });
}
exports.sortProcurementOfficerSubmissionRows = sortProcurementOfficerSubmissionRows;
function filterProcurementOfficerSubmissionRows(rows, filters) {
    return rows.filter((row) => {
        if (filters.departmentId && row.departmentId !== filters.departmentId) {
            return false;
        }
        if (filters.status && row.status !== filters.status) {
            return false;
        }
        if (typeof filters.startTimestamp === "number" &&
            row.sortSubmittedAt < filters.startTimestamp) {
            return false;
        }
        if (typeof filters.endTimestamp === "number" &&
            row.sortSubmittedAt > filters.endTimestamp) {
            return false;
        }
        return true;
    });
}
exports.filterProcurementOfficerSubmissionRows = filterProcurementOfficerSubmissionRows;
function deriveProcurementOfficerSubmissionEmptyState(args) {
    if (args.filteredCount > 0) {
        return {
            description: "",
            kind: "global-empty",
            showClearFilters: false,
            title: "",
        };
    }
    if (args.hasActiveFilters && args.selectedFiscalYearCount > 0) {
        return {
            description: "No submissions match the current filters. Clear one or more filters to widen the queue again.",
            kind: "filtered-empty",
            showClearFilters: true,
            title: "No submissions match these filters.",
        };
    }
    if (args.totalCount === 0) {
        return {
            description: "Check back after departments submit. This queue only shows submitted, approved, or rejected plans.",
            kind: "global-empty",
            showClearFilters: false,
            title: "No submitted plans yet.",
        };
    }
    return {
        description: "The current fiscal-year scope has no matching submissions, but other fiscal years in this tenant do.",
        kind: "fiscal-year-empty",
        showClearFilters: false,
        title: `No submissions for ${args.selectedFiscalYearLabel}.`,
    };
}
exports.deriveProcurementOfficerSubmissionEmptyState = deriveProcurementOfficerSubmissionEmptyState;
function collectProcurementOfficerSubmissionNotifications(args) {
    const nextNotifiedPlanIds = new Set(args.notifiedPlanIds);
    const notifications = args.nextRows.filter((row) => {
        if (row.status !== "submitted") {
            return false;
        }
        if (args.previousVisiblePlanIds.has(row.planId)) {
            return false;
        }
        if (args.previousKnownPlanIds.has(row.planId)) {
            return false;
        }
        if (args.notifiedPlanIds.has(row.planId)) {
            return false;
        }
        nextNotifiedPlanIds.add(row.planId);
        return true;
    });
    return {
        notifications,
        notifiedPlanIds: nextNotifiedPlanIds,
    };
}
exports.collectProcurementOfficerSubmissionNotifications = collectProcurementOfficerSubmissionNotifications;
function hasActiveProcurementOfficerSubmissionFilters(filters) {
    return Boolean(filters.departmentId ||
        filters.endDate ||
        filters.startDate ||
        filters.status);
}
exports.hasActiveProcurementOfficerSubmissionFilters = hasActiveProcurementOfficerSubmissionFilters;
function summarizeProcurementOfficerSubmissionQueue(args) {
    const summary = {
        approvedCount: 0,
        rejectedCount: 0,
        selectedFiscalYearCount: 0,
        submittedCount: 0,
        totalCount: 0,
    };
    for (const plan of args.plans) {
        summary.totalCount += 1;
        if (plan.fiscalYear === args.selectedFiscalYear) {
            summary.selectedFiscalYearCount += 1;
            if (plan.status === "approved") {
                summary.approvedCount += 1;
            }
            else if (plan.status === "rejected") {
                summary.rejectedCount += 1;
            }
            else {
                summary.submittedCount += 1;
            }
        }
    }
    return summary;
}
exports.summarizeProcurementOfficerSubmissionQueue = summarizeProcurementOfficerSubmissionQueue;
