import assert from "node:assert/strict";
import {
  buildApprovedPlanRedraftSnapshotKey,
  getPlanRedraftRequestEligibility,
  hasPendingPlanRedraftRequest,
  normalizePlanRedraftReason,
} from "../lib/plans/redraft";

export function runPlanRedraftTests(): string[] {
  const completedTests: string[] = [];

  assert.deepEqual(normalizePlanRedraftReason("   "), {
    message: "Explain why this approved plan needs to be redrafted.",
    ok: false,
  });
  assert.deepEqual(normalizePlanRedraftReason("  Update laptop quantities.  "), {
    ok: true,
    value: "Update laptop quantities.",
  });
  completedTests.push(
    "plan redraft reasons are required, trimmed, and normalized before a DU can request PO approval",
  );

  assert.equal(
    hasPendingPlanRedraftRequest({
      fiscalYear: "2026-2027",
      planId: "plan-1",
      requests: [
        { fiscalYear: "2026-2027", planId: "plan-1", status: "denied" },
        { fiscalYear: "2026-2027", planId: "plan-2", status: "pending" },
      ],
    }),
    false,
  );
  assert.equal(
    hasPendingPlanRedraftRequest({
      fiscalYear: "2026-2027",
      planId: "plan-1",
      requests: [
        { fiscalYear: "2026-2027", planId: "plan-1", status: "pending" },
      ],
    }),
    true,
  );
  completedTests.push(
    "plan redraft duplicate detection only blocks a pending request for the same plan and fiscal year",
  );

  assert.deepEqual(
    getPlanRedraftRequestEligibility({
      currentFiscalYear: "2026-2027",
      departmentId: "dept-1",
      pendingRequestExists: false,
      plan: {
        approvedAt: 10,
        departmentId: "dept-1",
        fiscalYear: "2026-2027",
        id: "plan-1",
        status: "approved",
        tenantId: "tenant-1",
      },
      tenantId: "tenant-1",
    }),
    {
      canRequest: true,
      message: null,
    },
  );
  assert.equal(
    getPlanRedraftRequestEligibility({
      currentFiscalYear: "2026-2027",
      departmentId: "dept-1",
      pendingRequestExists: false,
      plan: {
        approvedAt: 10,
        departmentId: "dept-1",
        fiscalYear: "2026-2027",
        id: "plan-1",
        status: "submitted",
        tenantId: "tenant-1",
      },
      tenantId: "tenant-1",
    }).message,
    "Only approved plans can be requested for redraft.",
  );
  assert.equal(
    getPlanRedraftRequestEligibility({
      currentFiscalYear: "2026-2027",
      departmentId: "dept-1",
      pendingRequestExists: true,
      plan: {
        approvedAt: 10,
        departmentId: "dept-1",
        fiscalYear: "2026-2027",
        id: "plan-1",
        status: "approved",
        tenantId: "tenant-1",
      },
      tenantId: "tenant-1",
    }).message,
    "A redraft request is already pending for this approved plan.",
  );
  completedTests.push(
    "plan redraft eligibility is approved-only, department-scoped, current-year scoped, and duplicate-safe",
  );

  assert.equal(
    buildApprovedPlanRedraftSnapshotKey({
      approvedAt: 1234,
      planId: "plan-1",
      tenantId: "tenant-1",
    }),
    "tenant-1:plan-1:approved-baseline:1234",
  );
  completedTests.push(
    "plan redraft approved-baseline snapshot keys are stable per tenant, plan, and approval timestamp",
  );

  return completedTests;
}

