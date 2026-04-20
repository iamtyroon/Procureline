import assert from "node:assert/strict";
import { PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS } from "../lib/procurement-officer/dashboard-search";
import {
  buildProcurementOfficerSubmissionModalPath,
  buildProcurementOfficerSubmissionReviewHref,
  buildProcurementOfficerSubmissionSearchParams,
  collectProcurementOfficerSubmissionNotifications,
  deriveProcurementOfficerSubmissionEmptyState,
  extractProcurementOfficerSubmissionSearchParams,
  filterProcurementOfficerSubmissionRows,
  normalizeProcurementOfficerSubmissionFilters,
  shapeProcurementOfficerSubmissionRow,
  sortProcurementOfficerSubmissionRows,
} from "../lib/procurement-officer/submissions";

export function runProcurementOfficerSubmissionTests(): string[] {
  const completedTests: string[] = [];

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
      status: "submitted" as const,
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
      status: "approved" as const,
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
      status: "rejected" as const,
      submittedAt: Date.UTC(2026, 3, 9, 6, 0, 0),
      updatedAt: Date.UTC(2026, 3, 10, 7, 0, 0),
    },
  ];

  const shapedRows = sourceRows.map((row) =>
    shapeProcurementOfficerSubmissionRow({
      now: Date.UTC(2026, 3, 20, 9, 0, 0),
      row,
      tenantTimeZone: "Africa/Nairobi",
    }),
  );

  assert.equal(shapedRows[0]?.statusLabel, "Submitted");
  assert.equal(shapedRows[1]?.sortSubmittedAt, sourceRows[1]?.updatedAt);
  assert.equal(shapedRows[1]?.totalAmountLabel, "KES 250,000.00");
  assert.equal(
    shapedRows[0]?.reviewHref,
    "/po/review?planId=plan-1&from=submissions",
  );
  assert.equal(shapedRows[0]?.urgencyLabel, "10d waiting");
  completedTests.push(
    "procurement-officer submission rows stay truthful about live statuses, fallback timestamps, KES totals, and reserved review handoff targets",
  );

  assert.deepEqual(
    sortProcurementOfficerSubmissionRows(shapedRows).map((row) => row.planId),
    ["plan-2", "plan-3", "plan-1"],
  );
  assert.deepEqual(
    sortProcurementOfficerSubmissionRows(shapedRows, {
      direction: "asc",
      sortBy: "departmentName",
    }).map((row) => row.planId),
    ["plan-3", "plan-1", "plan-2"],
  );
  assert.deepEqual(
    sortProcurementOfficerSubmissionRows(shapedRows, {
      direction: "desc",
      sortBy: "status",
    }).map((row) => row.planId),
    ["plan-1", "plan-3", "plan-2"],
  );
  completedTests.push(
    "procurement-officer submission sorting defaults to oldest-first and stays deterministic across department, amount, and status overrides",
  );

  const normalizedFilters = normalizeProcurementOfficerSubmissionFilters(
    {
      departmentId: " department-1 ",
      endDate: "2026-04-10",
      sortBy: "status",
      sortDirection: "desc",
      startDate: "2026-04-10",
      status: "submitted",
    },
    {
      tenantTimeZone: "Africa/Nairobi",
    },
  );
  assert.deepEqual(
    filterProcurementOfficerSubmissionRows(shapedRows, normalizedFilters).map(
      (row) => row.planId,
    ),
    ["plan-1"],
  );
  assert.equal(normalizedFilters.departmentId, "department-1");
  assert.equal(normalizedFilters.startDate, "2026-04-10");
  assert.equal(normalizedFilters.endDate, "2026-04-10");
  completedTests.push(
    "procurement-officer submission filters trim shareable state and honor same-day end boundaries in tenant time-zone filtering",
  );

  assert.deepEqual(
    deriveProcurementOfficerSubmissionEmptyState({
      filteredCount: 0,
      hasActiveFilters: false,
      selectedFiscalYearCount: 0,
      selectedFiscalYearLabel: "FY 2026/27",
      totalCount: 0,
    }),
    {
      description:
        "Check back after departments submit. This queue only shows submitted, approved, or rejected plans.",
      kind: "global-empty",
      showClearFilters: false,
      title: "No submitted plans yet.",
    },
  );
  assert.deepEqual(
    deriveProcurementOfficerSubmissionEmptyState({
      filteredCount: 0,
      hasActiveFilters: false,
      selectedFiscalYearCount: 0,
      selectedFiscalYearLabel: "FY 2026/27",
      totalCount: 3,
    }),
    {
      description:
        "The current fiscal-year scope has no matching submissions, but other fiscal years in this tenant do.",
      kind: "fiscal-year-empty",
      showClearFilters: false,
      title: "No submissions for FY 2026/27.",
    },
  );
  assert.deepEqual(
    deriveProcurementOfficerSubmissionEmptyState({
      filteredCount: 0,
      hasActiveFilters: true,
      selectedFiscalYearCount: 3,
      selectedFiscalYearLabel: "FY 2026/27",
      totalCount: 3,
    }),
    {
      description:
        "No submissions match the current filters. Clear one or more filters to widen the queue again.",
      kind: "filtered-empty",
      showClearFilters: true,
      title: "No submissions match these filters.",
    },
  );
  completedTests.push(
    "procurement-officer submission empty states distinguish tenant-wide emptiness, fiscal-year gaps, and filter-only misses",
  );

  const submittedRow = shapedRows.find((row) => row.planId === "plan-1");
  assert.ok(submittedRow);

  const firstNotificationPass = collectProcurementOfficerSubmissionNotifications({
    nextRows: [
      submittedRow,
      {
        ...submittedRow,
        departmentName: "Procurement",
        planId: "plan-4",
      },
    ],
    notifiedPlanIds: new Set<string>(),
    previousKnownPlanIds: new Set<string>(["plan-1", "plan-2", "plan-3"]),
    previousVisiblePlanIds: new Set<string>(["plan-1", "plan-2", "plan-3"]),
  });
  assert.deepEqual(
    firstNotificationPass.notifications.map((row) => row.planId),
    ["plan-4"],
  );
  const replayNotificationPass = collectProcurementOfficerSubmissionNotifications({
    nextRows: [
      submittedRow,
      {
        ...submittedRow,
        departmentName: "Procurement",
        planId: "plan-4",
      },
    ],
    notifiedPlanIds: firstNotificationPass.notifiedPlanIds,
    previousKnownPlanIds: new Set<string>(["plan-1", "plan-2", "plan-3", "plan-4"]),
    previousVisiblePlanIds: new Set<string>(),
  });
  assert.equal(replayNotificationPass.notifications.length, 0);
  completedTests.push(
    "procurement-officer submission notifications only announce newly arrived submitted plans and suppress replay duplicates after reconnects",
  );

  assert.equal(
    buildProcurementOfficerSubmissionSearchParams({
      departmentId: "department-1",
      endDate: "2026-04-10",
      sortBy: "status",
      sortDirection: "desc",
      startDate: "2026-04-01",
      status: "submitted",
    }).toString(),
    "poSubmissionsDepartment=department-1&poSubmissionsStatus=submitted&poSubmissionsStart=2026-04-01&poSubmissionsEnd=2026-04-10&poSubmissionsSort=status&poSubmissionsDirection=desc",
  );
  assert.equal(
    extractProcurementOfficerSubmissionSearchParams(
      new URLSearchParams(
        `${PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear}=2025-2026&modal=submissions&poSubmissionsStatus=submitted&poSubmissionsSort=status&itemSearch=laptop&foo=bar`,
      ),
    ).toString(),
    "poSubmissionsStatus=submitted&poSubmissionsSort=status",
  );
  assert.equal(
    buildProcurementOfficerSubmissionReviewHref({
      planId: "plan-77",
      returnToSearchParams: new URLSearchParams(
        `${PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear}=2025-2026&poSubmissionsStatus=submitted&itemSearch=laptop&poSubmissionsSort=status`,
      ),
    }),
    "/po/review?planId=plan-77&from=submissions&poFiscalYear=2025-2026&poSubmissionsStatus=submitted&poSubmissionsSort=status",
  );
  assert.equal(
    buildProcurementOfficerSubmissionModalPath({
      submissionWorkspaceSearchParams: new URLSearchParams(
        `${PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear}=2025-2026&poSubmissionsStatus=submitted&itemSearch=laptop`,
      ),
    }),
    "/po?modal=submissions&poFiscalYear=2025-2026&poSubmissionsStatus=submitted",
  );
  completedTests.push(
    "procurement-officer submission deep links preserve the selected fiscal year while keeping queue params namespaced so dashboard modal state cannot collide with other workspaces",
  );

  return completedTests;
}
