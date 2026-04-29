"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcurementOfficerReviewDecisionTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const review_decision_1 = require("../lib/procurement-officer/review-decision");
const status_tracking_1 = require("../lib/department-user/status-tracking");
const dashboard_snapshot_1 = require("../lib/department-user/dashboard-snapshot");
const dashboard_1 = require("../lib/department-user/dashboard");
function runProcurementOfficerReviewDecisionTests() {
    const completedTests = [];
    strict_1.default.deepEqual((0, review_decision_1.normalizeProcurementOfficerDecisionComment)("   "), {
        message: "Decision comments cannot be blank.",
        ok: false,
    });
    strict_1.default.deepEqual((0, review_decision_1.normalizeProcurementOfficerDecisionComment)("  Tighten the quantities on ICT items.  "), {
        ok: true,
        value: "Tighten the quantities on ICT items.",
    });
    completedTests.push("review decision comments trim canonical DU-facing guidance and reject blank outcomes");
    strict_1.default.deepEqual((0, review_decision_1.normalizeProcurementOfficerFlaggedTargets)({
        descriptors: [
            {
                id: "category:cat-it",
                label: "ICT Equipment",
                type: "category",
            },
            {
                id: "item:cat-it:item-laptop",
                label: "Laptops (ICT Equipment)",
                type: "item",
            },
            {
                id: "item:cat-it:item-missing",
                label: "Missing",
                type: "item",
            },
        ],
        validSelectionIds: ["category:cat-it", "item:cat-it:item-laptop"],
    }), {
        invalidIds: ["item:cat-it:item-missing"],
        targets: [
            {
                categoryId: "cat-it",
                id: "category:cat-it",
                itemId: null,
                label: "ICT Equipment",
                type: "category",
            },
            {
                categoryId: "cat-it",
                id: "item:cat-it:item-laptop",
                itemId: "item-laptop",
                label: "Laptops (ICT Equipment)",
                type: "item",
            },
        ],
    });
    completedTests.push("review decision target normalization preserves stable descriptors while failing closed on stale selections");
    const now = Date.UTC(2026, 3, 28, 8, 0, 0);
    strict_1.default.deepEqual((0, review_decision_1.validateProcurementOfficerRevisionDeadline)({
        input: "2026-04-29T10:00",
        now,
        timeZone: "Africa/Nairobi",
    }), {
        ok: true,
        value: Date.UTC(2026, 3, 29, 7, 0, 0),
    });
    strict_1.default.equal((0, review_decision_1.validateProcurementOfficerRevisionDeadline)({
        input: "2026-04-27T10:00",
        now,
        timeZone: "Africa/Nairobi",
    }).ok, false);
    completedTests.push("review decision deadlines parse tenant-local wall time and block past revision dates");
    strict_1.default.deepEqual((0, review_decision_1.getProcurementOfficerUndoApprovalEligibility)({
        approvedAt: now,
        now: now + 60 * 60 * 1000,
        status: "approved",
    }), {
        blockedReason: null,
        canUndo: true,
        undoDeadlineAt: now + 24 * 60 * 60 * 1000,
    });
    strict_1.default.equal((0, review_decision_1.getProcurementOfficerUndoApprovalEligibility)({
        approvedAt: now,
        consolidatedAt: now + 1,
        now: now + 60 * 60 * 1000,
        status: "approved",
    }).canUndo, false);
    strict_1.default.equal((0, review_decision_1.getProcurementOfficerUndoApprovalEligibility)({
        approvedAt: now,
        now: now + 25 * 60 * 60 * 1000,
        status: "approved",
    }).blockedReason, "Undo window expired 24 hours after approval.");
    completedTests.push("approval undo eligibility stays deterministic across active, consolidated, and expired-window outcomes");
    strict_1.default.equal((0, review_decision_1.buildProcurementOfficerDecisionNotificationIdempotencyKey)({
        decisionId: "decision-7",
        decisionType: "revision_requested",
        planId: "plan-1",
        recipientEmail: "DU@Example.com",
        tenantId: "tenant-1",
    }), "plan-review-decision:tenant-1:plan-1:decision-7:revision_requested:du@example.com");
    strict_1.default.equal((0, review_decision_1.getProcurementOfficerPlanDecisionStatusLabel)("revision_requested"), "Revision Requested");
    strict_1.default.match((0, review_decision_1.buildProcurementOfficerDecisionSummary)({
        comment: "Update the laptop quantities.",
        decidedAt: now,
        decisionType: "revision_requested",
        flaggedTargets: [
            {
                categoryId: "cat-it",
                id: "item:cat-it:item-laptop",
                itemId: "item-laptop",
                label: "Laptops (ICT Equipment)",
                type: "item",
            },
        ],
        revisionDeadlineAt: Date.UTC(2026, 3, 30, 7, 0, 0),
    }, "Africa/Nairobi") ?? "", /Revision Requested/i);
    completedTests.push("review decision labels, summaries, and notification keys stay stable for DU-facing notifications");
    strict_1.default.equal((0, dashboard_1.normalizeDepartmentUserPlanStatus)("revision_requested"), "Revision Requested");
    strict_1.default.deepEqual((0, dashboard_1.derivePlanAction)({
        accessMode: "editable",
        hasCanonicalPlan: true,
        planHref: "/du/plans/plan-1?mode=edit",
        status: "Revision Requested",
    }), {
        disabled: false,
        href: "/du/plans/plan-1?mode=edit",
        kind: "edit",
        label: "Edit Plan",
    });
    completedTests.push("revision-requested DU plans stay editable through the same canonical action flow as rejected plans");
    const statusDetails = (0, status_tracking_1.deriveDepartmentUserStatusDetails)({
        fiscalYearKey: "2026-2027",
        plan: {
            approvedAt: null,
            createdAt: now - 10_000,
            fiscalYear: "2026-2027",
            id: "plan-1",
            itemCount: 4,
            latestDecision: {
                comment: "Revise the ICT quantities before resubmitting.",
                decidedAt: now,
                decisionType: "revision_requested",
                revisionDeadlineAt: Date.UTC(2026, 3, 30, 7, 0, 0),
            },
            rejectedAt: now,
            reviewStartedAt: now - 5_000,
            status: "rejected",
            updatedAt: now,
        },
        timeZone: "Africa/Nairobi",
    });
    strict_1.default.equal(statusDetails.displayStatus, "revision_requested");
    strict_1.default.equal(statusDetails.statusLabel, "Revision Requested");
    strict_1.default.match(statusDetails.helperText, /Revise the ICT quantities/i);
    strict_1.default.equal(statusDetails.timeline.at(-1)?.title, "Revision Requested");
    completedTests.push("department-user status tracking surfaces revision requested as a distinct label while reusing canonical rejected plan state");
    const revisionRequestedSnapshot = (0, dashboard_snapshot_1.buildDepartmentUserDashboardSnapshot)({
        announcements: [],
        auth: {
            departmentAccessMode: "editable",
            departmentId: "department-1",
            tenantId: "tenant-1",
        },
        categories: [{ id: "cat-1", isActive: true, name: "ICT Equipment", sortOrder: 1 }],
        currentUser: {
            email: "du@example.com",
            initials: "DU",
            name: "Department User",
        },
        department: {
            budgetAllocation: 8_000_000,
            code: "CS",
            id: "department-1",
            name: "Computer Science",
            submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
            submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
        },
        items: [{ categoryId: "cat-1", id: "item-1", isActive: true }],
        leaderboardEntries: [],
        now,
        plans: [
            {
                categorySummaries: [],
                createdAt: now - 10_000,
                estimatedBudgetUsed: 250_000,
                fiscalYear: "2026-2027",
                id: "plan-1",
                itemCount: 4,
                latestDecision: {
                    comment: "Revise the ICT quantities before resubmitting.",
                    decidedAt: now,
                    decisionType: "revision_requested",
                    revisionDeadlineAt: Date.UTC(2026, 3, 30, 7, 0, 0),
                },
                rejectionComment: "Revise the ICT quantities before resubmitting.",
                rejectedAt: now,
                selectedCategoryIds: ["cat-1"],
                status: "rejected",
                updatedAt: now,
            },
        ],
        procurementOfficer: null,
        tenant: {
            id: "tenant-1",
            name: "Pwani University",
        },
    });
    strict_1.default.equal(revisionRequestedSnapshot.quickStats.plan.statusLabel, "Revision Requested");
    strict_1.default.equal(revisionRequestedSnapshot.quickStats.plan.primaryActionLabel, "Edit Plan");
    strict_1.default.equal(revisionRequestedSnapshot.rejectionNotice?.title, "Revision requested");
    strict_1.default.ok(revisionRequestedSnapshot.rejectionNotice);
    strict_1.default.equal(revisionRequestedSnapshot.rejectionNotice.action.href, "/du/plans/plan-1?mode=edit");
    completedTests.push("revision-requested dashboard snapshots keep the DU on an edit path and preserve the visible decision notice");
    return completedTests;
}
exports.runProcurementOfficerReviewDecisionTests = runProcurementOfficerReviewDecisionTests;
