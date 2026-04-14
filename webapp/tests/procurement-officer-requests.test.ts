import assert from "node:assert/strict";
import {
  buildBulkDecisionCompatibility,
  buildProcurementCatalogRequestStatusLabel,
  getProcurementRequestDecisionErrorMessage,
  isDenialUndoEligible,
  normalizeProcurementCatalogRequestFilters,
  resolveProcurementCatalogRequestSummary,
  resolveProcurementRequestDenialUndoDeadline,
} from "../lib/procurement-officer/requests";
import { shouldExpireCatalogRequest } from "../lib/procurement/catalog-requests";

export function runProcurementOfficerRequestTests(): string[] {
  const completedTests: string[] = [];

  assert.deepEqual(
    normalizeProcurementCatalogRequestFilters({
      departmentId: "  dept-1 ",
      requestType: "all",
      status: "all",
      startDate: Number.NaN,
      endDate: 123,
    }),
    {
      departmentId: "dept-1",
      endDate: 123,
      requestType: null,
      startDate: null,
      status: null,
    },
  );
  completedTests.push(
    "procurement-officer request filter normalization trims optional fields and drops invalid ranges",
  );

  const deadline = resolveProcurementRequestDenialUndoDeadline({
    now: 1000,
    windowMs: 5000,
  });
  assert.equal(deadline, 6000);
  completedTests.push(
    "procurement-officer denial undo deadline uses the configured window",
  );

  assert.equal(
    isDenialUndoEligible({
      status: "denied",
      denialUndoDeadlineAt: Date.now() + 1000,
      decisionNotificationStatus: "queued",
    }),
    true,
  );
  assert.equal(
    isDenialUndoEligible({
      status: "denied",
      denialUndoDeadlineAt: Date.now() - 1000,
      decisionNotificationStatus: "queued",
    }),
    false,
  );
  assert.equal(
    isDenialUndoEligible({
      status: "denied",
      denialUndoDeadlineAt: Date.now() + 1000,
      decisionNotificationStatus: "failed",
    }),
    false,
  );
  completedTests.push(
    "procurement-officer denial undo eligibility respects deadline and notification state",
  );

  assert.deepEqual(
    resolveProcurementCatalogRequestSummary({
      categoryRequests: [
        { departmentId: "dept-active", status: "pending" },
        { departmentId: "dept-active", status: "approved" },
      ],
      departments: [
        {
          id: "dept-active",
          submissionEndsAt: Date.now() + 60_000,
          submissionStartsAt: Date.now() - 60_000,
        },
        {
          id: "dept-expired",
          submissionEndsAt: Date.now() - 60_000,
          submissionStartsAt: Date.now() - 120_000,
        },
      ],
      itemRequests: [
        { departmentId: "dept-expired", status: "pending" },
        { departmentId: "dept-expired", status: "denied" },
      ],
    }),
    {
      pendingCategoryCount: 1,
      pendingItemCount: 0,
      totalCount: 4,
      totalPendingCount: 1,
    },
  );
  completedTests.push(
    "procurement-officer request summary downgrades deadline-expired pending rows before dashboard badges and inbox counts are computed",
  );

  assert.equal(
    shouldExpireCatalogRequest({
      now: Date.UTC(2026, 6, 1, 8, 0, 1),
      status: "pending",
      submissionEndsAt: Date.UTC(2026, 6, 1, 8, 0, 0),
      submissionStartsAt: Date.UTC(2026, 5, 1, 8, 0, 0),
    }),
    true,
  );
  completedTests.push(
    "procurement-officer expiry helpers treat the submission deadline itself as the cutoff for pending request actionability",
  );

  const bulkCompatibility = buildBulkDecisionCompatibility({
    action: "approve",
    allowedType: "item",
    requests: [
      { id: "ok-1", status: "pending", type: "item" },
      { id: "skip-type", status: "pending", type: "category" },
      { id: "skip-status", status: "approved", type: "item" },
    ],
  });
  assert.deepEqual(bulkCompatibility.eligibleIds, ["ok-1"]);
  assert.equal(bulkCompatibility.skipped.length, 2);
  completedTests.push(
    "procurement-officer bulk compatibility enforces type and pending-only selection",
  );

  assert.equal(buildProcurementCatalogRequestStatusLabel("approved"), "Approved");
  assert.equal(
    getProcurementRequestDecisionErrorMessage(
      new Error("Custom error"),
      "Fallback",
    ),
    "Custom error",
  );
  assert.equal(
    getProcurementRequestDecisionErrorMessage(null, "Fallback"),
    "Fallback",
  );
  completedTests.push(
    "procurement-officer request helpers surface status labels and deterministic error messages",
  );

  return completedTests;
}
