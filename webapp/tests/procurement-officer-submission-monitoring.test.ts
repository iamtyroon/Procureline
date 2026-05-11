import assert from "node:assert/strict";
import {
  buildProcurementOfficerMonitoringExportRows,
  buildProcurementOfficerMonitoringRow,
  buildProcurementOfficerMonitoringTimeline,
  deriveProcurementOfficerMonitoringStatus,
  selectCanonicalMonitoringPlan,
  summarizeProcurementOfficerMonitoringRows,
} from "../lib/procurement-officer/submission-monitoring";

export function runProcurementOfficerSubmissionMonitoringTests(): string[] {
  const completedTests: string[] = [];

  const canonicalPlan = selectCanonicalMonitoringPlan(
    [
      {
        createdAt: Date.UTC(2026, 7, 1, 8, 0, 0),
        departmentId: "department-1",
        fiscalYear: "2026-2027",
        id: "plan-draft",
        itemCount: 2,
        status: "draft" as const,
        updatedAt: Date.UTC(2026, 7, 2, 8, 0, 0),
      },
      {
        createdAt: Date.UTC(2026, 7, 3, 8, 0, 0),
        departmentId: "department-1",
        fiscalYear: "2026-2027",
        id: "plan-approved",
        itemCount: 4,
        lastApprovedAt: Date.UTC(2026, 7, 8, 8, 0, 0),
        status: "approved" as const,
        updatedAt: Date.UTC(2026, 7, 8, 8, 0, 0),
      },
    ],
    "2026-2027",
  );
  assert.equal(canonicalPlan?.id, "plan-approved");
  completedTests.push(
    "submission monitoring reuses the canonical per-fiscal-year plan selector so later approved records outrank stale drafts for the same department",
  );

  assert.equal(deriveProcurementOfficerMonitoringStatus(null), "not_started");
  assert.equal(
    deriveProcurementOfficerMonitoringStatus({
      createdAt: 1,
      departmentId: "department-1",
      fiscalYear: "2026-2027",
      id: "plan-1",
      itemCount: 1,
      status: "draft",
      updatedAt: 1,
    }),
    "draft",
  );
  assert.equal(
    deriveProcurementOfficerMonitoringStatus({
      createdAt: 1,
      departmentId: "department-1",
      fiscalYear: "2026-2027",
      id: "plan-2",
      itemCount: 1,
      reviewStartedAt: 2,
      status: "submitted",
      updatedAt: 2,
    }),
    "submitted",
  );
  assert.equal(
    deriveProcurementOfficerMonitoringStatus({
      createdAt: 1,
      departmentId: "department-1",
      fiscalYear: "2026-2027",
      id: "plan-3",
      itemCount: 1,
      latestDecision: {
        comment: "Fix totals",
        decidedAt: 4,
        decisionType: "revision_requested",
        revisionDeadlineAt: 10,
      },
      rejectedAt: 4,
      reviewStartedAt: 3,
      status: "rejected",
      updatedAt: 4,
    }),
    "rejected",
  );
  completedTests.push(
    "submission monitoring maps no-plan, draft, under-review, and revision-requested states into one canonical PO-facing status bucket set",
  );

  const timeline = buildProcurementOfficerMonitoringTimeline({
    plan: {
      createdAt: Date.UTC(2026, 7, 1, 8, 0, 0),
      departmentId: "department-2",
      fiscalYear: "2026-2027",
      id: "plan-history",
      itemCount: 3,
      reviewStartedAt: undefined,
      status: "submitted",
      submissionSnapshots: [],
      updatedAt: Date.UTC(2026, 7, 5, 8, 0, 0),
    },
    timeZone: "Africa/Nairobi",
  });
  assert.equal(timeline.some((item) => item.isFallback), true);
  assert.equal(
    timeline.find((item) => item.title === "Submitted")?.timestampLabel,
    "Unavailable",
  );
  completedTests.push(
    "submission monitoring history keeps metadata-only fallback entries when older records are missing canonical timestamps or snapshots",
  );

  const rows = [
    buildProcurementOfficerMonitoringRow({
      contacts: [{ email: "du1@example.com", isActive: true, name: "A" }],
      department: {
        code: "FIN",
        id: "department-1",
        isActive: true,
        name: "Finance",
      },
      plan: null,
      tenantTimeZone: "Africa/Nairobi",
    }),
    buildProcurementOfficerMonitoringRow({
      contacts: [{ email: "du2@example.com", isActive: true, name: "B" }],
      department: {
        code: "ICT",
        id: "department-2",
        isActive: true,
        name: "ICT",
      },
      plan: {
        createdAt: Date.UTC(2026, 7, 3, 8, 0, 0),
        departmentId: "department-2",
        fiscalYear: "2026-2027",
        id: "plan-2",
        itemCount: 3,
        status: "draft",
        updatedAt: Date.UTC(2026, 7, 4, 8, 0, 0),
      },
      tenantTimeZone: "Africa/Nairobi",
    }),
    buildProcurementOfficerMonitoringRow({
      contacts: [{ email: "du3@example.com", isActive: true, name: "C" }],
      department: {
        code: "HR",
        id: "department-3",
        isActive: true,
        name: "HR",
      },
      plan: {
        approvedAt: Date.UTC(2026, 7, 8, 8, 0, 0),
        createdAt: Date.UTC(2026, 7, 2, 8, 0, 0),
        departmentId: "department-3",
        fiscalYear: "2026-2027",
        id: "plan-3",
        itemCount: 5,
        status: "approved",
        updatedAt: Date.UTC(2026, 7, 8, 8, 0, 0),
      },
      tenantTimeZone: "Africa/Nairobi",
    }),
  ];
  assert.deepEqual(summarizeProcurementOfficerMonitoringRows(rows), {
    approved: 1,
    draft: 1,
    notStarted: 1,
    rejected: 0,
    submitted: 0,
    submittedOfTotalLabel: "1 of 3 departments submitted",
    totalDepartments: 3,
  });
  assert.deepEqual(buildProcurementOfficerMonitoringExportRows(rows), [
    {
      "DU contact": "du1@example.com",
      department: "Finance",
      "last updated": "Unavailable",
      status: "Not Started",
    },
    {
      "DU contact": "du2@example.com",
      department: "ICT",
      "last updated": rows[1]?.lastUpdatedLabel ?? "",
      status: "Draft",
    },
    {
      "DU contact": "du3@example.com",
      department: "HR",
      "last updated": rows[2]?.lastUpdatedLabel ?? "",
      status: "Approved",
    },
  ]);
  completedTests.push(
    "submission monitoring rows drive aligned summary counts and export payloads so filtered UI and Excel fields can stay in sync",
  );

  return completedTests;
}
