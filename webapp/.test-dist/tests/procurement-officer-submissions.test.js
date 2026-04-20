"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcurementOfficerSubmissionTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const dashboard_search_1 = require("../lib/procurement-officer/dashboard-search");
const submissions_1 = require("../lib/procurement-officer/submissions");
function runProcurementOfficerSubmissionTests() {
    const completedTests = [];
    const sourceRows = [
        {
            approvedAt: null,
            departmentCode: "FIN",
            departmentId: "department-1",
            departmentName: "Finance",
            estimatedBudgetUsed: 1_250_000,
            fiscalYear: "2026-2027",
            itemCount: 12,
            planId: "plan-1",
            rejectedAt: null,
            status: "submitted",
            submittedAt: Date.UTC(2026, 3, 10, 20, 30, 0),
            updatedAt: Date.UTC(2026, 3, 10, 20, 30, 0),
        },
        {
            approvedAt: Date.UTC(2026, 3, 9, 8, 0, 0),
            departmentCode: "ICT",
            departmentId: "department-2",
            departmentName: "ICT",
            estimatedBudgetUsed: 250_000,
            fiscalYear: "2026-2027",
            itemCount: 4,
            planId: "plan-2",
            rejectedAt: null,
            status: "approved",
            submittedAt: null,
            updatedAt: Date.UTC(2026, 3, 8, 12, 0, 0),
        },
        {
            approvedAt: null,
            departmentCode: null,
            departmentId: null,
            departmentName: "Archived department",
            estimatedBudgetUsed: 500_000,
            fiscalYear: "2026-2027",
            itemCount: 7,
            planId: "plan-3",
            rejectedAt: Date.UTC(2026, 3, 10, 7, 0, 0),
            status: "rejected",
            submittedAt: Date.UTC(2026, 3, 9, 6, 0, 0),
            updatedAt: Date.UTC(2026, 3, 10, 7, 0, 0),
        },
    ];
    const shapedRows = sourceRows.map((row) => (0, submissions_1.shapeProcurementOfficerSubmissionRow)({
        now: Date.UTC(2026, 3, 20, 9, 0, 0),
        row,
        tenantTimeZone: "Africa/Nairobi",
    }));
    strict_1.default.equal(shapedRows[0]?.statusLabel, "Submitted");
    strict_1.default.equal(shapedRows[1]?.sortSubmittedAt, sourceRows[1]?.updatedAt);
    strict_1.default.equal(shapedRows[1]?.totalAmountLabel, "KES 250,000.00");
    strict_1.default.equal(shapedRows[0]?.reviewHref, "/po/review?planId=plan-1&from=submissions");
    strict_1.default.equal(shapedRows[0]?.urgencyLabel, "10d waiting");
    completedTests.push("procurement-officer submission rows stay truthful about live statuses, fallback timestamps, KES totals, and reserved review handoff targets");
    strict_1.default.deepEqual((0, submissions_1.sortProcurementOfficerSubmissionRows)(shapedRows).map((row) => row.planId), ["plan-2", "plan-3", "plan-1"]);
    strict_1.default.deepEqual((0, submissions_1.sortProcurementOfficerSubmissionRows)(shapedRows, {
        direction: "asc",
        sortBy: "departmentName",
    }).map((row) => row.planId), ["plan-3", "plan-1", "plan-2"]);
    strict_1.default.deepEqual((0, submissions_1.sortProcurementOfficerSubmissionRows)(shapedRows, {
        direction: "desc",
        sortBy: "status",
    }).map((row) => row.planId), ["plan-1", "plan-3", "plan-2"]);
    completedTests.push("procurement-officer submission sorting defaults to oldest-first and stays deterministic across department, amount, and status overrides");
    const normalizedFilters = (0, submissions_1.normalizeProcurementOfficerSubmissionFilters)({
        departmentId: " department-1 ",
        endDate: "2026-04-10",
        sortBy: "status",
        sortDirection: "desc",
        startDate: "2026-04-10",
        status: "submitted",
    }, {
        tenantTimeZone: "Africa/Nairobi",
    });
    strict_1.default.deepEqual((0, submissions_1.filterProcurementOfficerSubmissionRows)(shapedRows, normalizedFilters).map((row) => row.planId), ["plan-1"]);
    strict_1.default.equal(normalizedFilters.departmentId, "department-1");
    strict_1.default.equal(normalizedFilters.startDate, "2026-04-10");
    strict_1.default.equal(normalizedFilters.endDate, "2026-04-10");
    completedTests.push("procurement-officer submission filters trim shareable state and honor same-day end boundaries in tenant time-zone filtering");
    strict_1.default.deepEqual((0, submissions_1.deriveProcurementOfficerSubmissionEmptyState)({
        filteredCount: 0,
        hasActiveFilters: false,
        selectedFiscalYearCount: 0,
        selectedFiscalYearLabel: "FY 2026/27",
        totalCount: 0,
    }), {
        description: "Check back after departments submit. This queue only shows submitted, approved, or rejected plans.",
        kind: "global-empty",
        showClearFilters: false,
        title: "No submitted plans yet.",
    });
    strict_1.default.deepEqual((0, submissions_1.deriveProcurementOfficerSubmissionEmptyState)({
        filteredCount: 0,
        hasActiveFilters: false,
        selectedFiscalYearCount: 0,
        selectedFiscalYearLabel: "FY 2026/27",
        totalCount: 3,
    }), {
        description: "The current fiscal-year scope has no matching submissions, but other fiscal years in this tenant do.",
        kind: "fiscal-year-empty",
        showClearFilters: false,
        title: "No submissions for FY 2026/27.",
    });
    strict_1.default.deepEqual((0, submissions_1.deriveProcurementOfficerSubmissionEmptyState)({
        filteredCount: 0,
        hasActiveFilters: true,
        selectedFiscalYearCount: 3,
        selectedFiscalYearLabel: "FY 2026/27",
        totalCount: 3,
    }), {
        description: "No submissions match the current filters. Clear one or more filters to widen the queue again.",
        kind: "filtered-empty",
        showClearFilters: true,
        title: "No submissions match these filters.",
    });
    completedTests.push("procurement-officer submission empty states distinguish tenant-wide emptiness, fiscal-year gaps, and filter-only misses");
    const submittedRow = shapedRows.find((row) => row.planId === "plan-1");
    strict_1.default.ok(submittedRow);
    const firstNotificationPass = (0, submissions_1.collectProcurementOfficerSubmissionNotifications)({
        nextRows: [
            submittedRow,
            {
                ...submittedRow,
                departmentName: "Procurement",
                planId: "plan-4",
            },
        ],
        notifiedPlanIds: new Set(),
        previousKnownPlanIds: new Set(["plan-1", "plan-2", "plan-3"]),
        previousVisiblePlanIds: new Set(["plan-1", "plan-2", "plan-3"]),
    });
    strict_1.default.deepEqual(firstNotificationPass.notifications.map((row) => row.planId), ["plan-4"]);
    const replayNotificationPass = (0, submissions_1.collectProcurementOfficerSubmissionNotifications)({
        nextRows: [
            submittedRow,
            {
                ...submittedRow,
                departmentName: "Procurement",
                planId: "plan-4",
            },
        ],
        notifiedPlanIds: firstNotificationPass.notifiedPlanIds,
        previousKnownPlanIds: new Set(["plan-1", "plan-2", "plan-3", "plan-4"]),
        previousVisiblePlanIds: new Set(),
    });
    strict_1.default.equal(replayNotificationPass.notifications.length, 0);
    completedTests.push("procurement-officer submission notifications only announce newly arrived submitted plans and suppress replay duplicates after reconnects");
    strict_1.default.equal((0, submissions_1.buildProcurementOfficerSubmissionSearchParams)({
        departmentId: "department-1",
        endDate: "2026-04-10",
        sortBy: "status",
        sortDirection: "desc",
        startDate: "2026-04-01",
        status: "submitted",
    }).toString(), "poSubmissionsDepartment=department-1&poSubmissionsStatus=submitted&poSubmissionsStart=2026-04-01&poSubmissionsEnd=2026-04-10&poSubmissionsSort=status&poSubmissionsDirection=desc");
    strict_1.default.equal((0, submissions_1.extractProcurementOfficerSubmissionSearchParams)(new URLSearchParams(`${dashboard_search_1.PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear}=2025-2026&modal=submissions&poSubmissionsStatus=submitted&poSubmissionsSort=status&itemSearch=laptop&foo=bar`)).toString(), "poSubmissionsStatus=submitted&poSubmissionsSort=status");
    strict_1.default.equal((0, submissions_1.buildProcurementOfficerSubmissionReviewHref)({
        planId: "plan-77",
        returnToSearchParams: new URLSearchParams(`${dashboard_search_1.PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear}=2025-2026&poSubmissionsStatus=submitted&itemSearch=laptop&poSubmissionsSort=status`),
    }), "/po/review?planId=plan-77&from=submissions&poFiscalYear=2025-2026&poSubmissionsStatus=submitted&poSubmissionsSort=status");
    strict_1.default.equal((0, submissions_1.buildProcurementOfficerSubmissionModalPath)({
        submissionWorkspaceSearchParams: new URLSearchParams(`${dashboard_search_1.PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear}=2025-2026&poSubmissionsStatus=submitted&itemSearch=laptop`),
    }), "/po?modal=submissions&poFiscalYear=2025-2026&poSubmissionsStatus=submitted");
    completedTests.push("procurement-officer submission deep links preserve the selected fiscal year while keeping queue params namespaced so dashboard modal state cannot collide with other workspaces");
    return completedTests;
}
exports.runProcurementOfficerSubmissionTests = runProcurementOfficerSubmissionTests;
