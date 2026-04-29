"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDepartmentUserStatusTrackingTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const status_tracking_1 = require("../lib/department-user/status-tracking");
function runDepartmentUserStatusTrackingTests() {
    const completedTests = [];
    strict_1.default.equal((0, status_tracking_1.deriveDepartmentUserDisplayStatus)({
        approvedAt: null,
        rejectedAt: null,
        reviewStartedAt: null,
        status: "submitted",
    }), "submitted");
    strict_1.default.equal((0, status_tracking_1.deriveDepartmentUserDisplayStatus)({
        approvedAt: null,
        rejectedAt: null,
        reviewStartedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
        status: "submitted",
    }), "under_review");
    strict_1.default.equal((0, status_tracking_1.deriveDepartmentUserDisplayStatus)({
        approvedAt: Date.UTC(2026, 7, 14, 11, 0, 0),
        rejectedAt: null,
        reviewStartedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
        status: "submitted",
    }), "approved");
    strict_1.default.equal((0, status_tracking_1.deriveDepartmentUserDisplayStatus)({
        approvedAt: null,
        rejectedAt: Date.UTC(2026, 7, 14, 11, 0, 0),
        reviewStartedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
        status: "submitted",
    }), "rejected");
    strict_1.default.equal((0, status_tracking_1.deriveDepartmentUserDisplayStatus)({
        approvedAt: null,
        latestDecision: {
            comment: "Adjust phasing.",
            decidedAt: Date.UTC(2026, 7, 14, 11, 0, 0),
            decisionType: "revision_requested",
            effectiveRevisionDeadlineAt: Date.UTC(2026, 7, 16, 11, 0, 0),
        },
        rejectedAt: Date.UTC(2026, 7, 14, 11, 0, 0),
        reviewStartedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
        status: "rejected",
    }), "revision_requested");
    completedTests.push("department-user status tracking derives submitted, under-review, approved, and rejected views from canonical plan fields without inventing a new workflow enum");
    const underReviewDetails = (0, status_tracking_1.deriveDepartmentUserStatusDetails)({
        fiscalYearKey: "2026-2027",
        plan: {
            createdAt: Date.UTC(2026, 7, 1, 8, 0, 0),
            fiscalYear: "2026-2027",
            id: "plan-1",
            itemCount: 7,
            reviewStartedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
            reviewer: {
                label: null,
                state: "unavailable",
            },
            status: "submitted",
            submissionReference: "CS-2627-002",
            submittedAt: Date.UTC(2026, 7, 10, 8, 0, 0),
            updatedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
        },
        timeZone: "Africa/Nairobi",
    });
    strict_1.default.equal(underReviewDetails.statusLabel, "Under Review");
    strict_1.default.equal(underReviewDetails.canWithdraw, false);
    strict_1.default.equal(underReviewDetails.reviewerLabel, null);
    strict_1.default.equal(underReviewDetails.reviewerState, "unavailable");
    strict_1.default.match(underReviewDetails.helperText, /Procurement Officer review in progress/i);
    completedTests.push("department-user status tracking keeps under-review plans read-only and degrades reviewer details to neutral copy when the reviewer identity cannot be safely resolved");
    const snapshotPrecedenceDetails = (0, status_tracking_1.deriveDepartmentUserStatusDetails)({
        fiscalYearKey: "2026-2027",
        plan: {
            createdAt: Date.UTC(2026, 7, 1, 8, 0, 0),
            fiscalYear: "2026-2027",
            id: "plan-2",
            itemCount: 5,
            status: "submitted",
            submissionReference: "STALE-REF",
            submissionSnapshots: [
                {
                    capturedAt: Date.UTC(2026, 7, 8, 10, 0, 0),
                    lifecycleStatus: "withdrawn",
                    submissionReference: "CS-2627-001",
                    submissionSequence: 1,
                    submittedAt: Date.UTC(2026, 7, 8, 8, 0, 0),
                    withdrawnAt: Date.UTC(2026, 7, 9, 8, 0, 0),
                },
                {
                    capturedAt: Date.UTC(2026, 7, 10, 10, 0, 0),
                    lifecycleStatus: "active",
                    submissionReference: "CS-2627-002",
                    submissionSequence: 2,
                    submittedAt: Date.UTC(2026, 7, 10, 8, 0, 0),
                },
            ],
            submittedAt: Date.UTC(2026, 7, 11, 8, 0, 0),
            updatedAt: Date.UTC(2026, 7, 11, 8, 0, 0),
        },
        timeZone: "Africa/Nairobi",
    });
    strict_1.default.equal(snapshotPrecedenceDetails.submissionReference, "CS-2627-002");
    strict_1.default.equal(snapshotPrecedenceDetails.timeline[1]?.title, "Submitted");
    strict_1.default.equal(snapshotPrecedenceDetails.timeline[2]?.title, "Withdrawn");
    strict_1.default.equal(snapshotPrecedenceDetails.timeline[snapshotPrecedenceDetails.timeline.length - 1]?.timestampLabel, "10 Aug 2026, 11:00 GMT+3");
    completedTests.push("department-user status tracking prefers the active submission snapshot over mutable plan-level submission fields and preserves withdrawn plus resubmitted timeline history in order");
    const mixedLegacyOrderingDetails = (0, status_tracking_1.deriveDepartmentUserStatusDetails)({
        fiscalYearKey: "2026-2027",
        plan: {
            createdAt: Date.UTC(2026, 7, 1, 8, 0, 0),
            fiscalYear: "2026-2027",
            id: "plan-mixed",
            itemCount: 4,
            status: "submitted",
            submissionSnapshots: [
                {
                    capturedAt: Date.UTC(2026, 7, 12, 10, 0, 0),
                    lifecycleStatus: "active",
                    submissionReference: "CS-2627-003",
                    submissionSequence: 3,
                    submittedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
                },
                {
                    capturedAt: Date.UTC(2026, 7, 5, 10, 0, 0),
                    lifecycleStatus: "active",
                    submissionReference: "LEGACY-1",
                    submittedAt: Date.UTC(2026, 7, 5, 8, 0, 0),
                },
            ],
            submittedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
            updatedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
        },
        timeZone: "Africa/Nairobi",
    });
    strict_1.default.deepEqual(mixedLegacyOrderingDetails.timeline
        .filter((item) => item.title === "Submitted")
        .map((item) => item.description), ["Submitted as LEGACY-1.", "Submitted as CS-2627-003."]);
    completedTests.push("department-user status tracking orders mixed legacy and sequenced submission snapshots by actual chronology instead of comparing sequence ordinals directly to timestamps");
    const legacyDetails = (0, status_tracking_1.deriveDepartmentUserStatusDetails)({
        fiscalYearKey: "2026-2027",
        plan: {
            createdAt: Date.UTC(2026, 7, 1, 8, 0, 0),
            fiscalYear: "2026-2027",
            id: "plan-legacy",
            itemCount: 3,
            status: "submitted",
            updatedAt: Date.UTC(2026, 7, 11, 8, 0, 0),
        },
        timeZone: "Africa/Nairobi",
    });
    strict_1.default.equal(legacyDetails.historyState, "partial");
    strict_1.default.equal(legacyDetails.historySummary, "Some earlier status history is unavailable for this plan.");
    completedTests.push("department-user status tracking marks incomplete legacy submission history explicitly instead of inventing missing timestamps");
    const legacyApprovedDetails = (0, status_tracking_1.deriveDepartmentUserStatusDetails)({
        fiscalYearKey: "2026-2027",
        plan: {
            approvedAt: Date.UTC(2026, 7, 15, 8, 0, 0),
            createdAt: Date.UTC(2026, 7, 1, 8, 0, 0),
            fiscalYear: "2026-2027",
            id: "plan-approved-legacy",
            itemCount: 3,
            status: "approved",
            submittedAt: Date.UTC(2026, 7, 10, 8, 0, 0),
            updatedAt: Date.UTC(2026, 7, 15, 8, 0, 0),
        },
        timeZone: "Africa/Nairobi",
    });
    strict_1.default.equal(legacyApprovedDetails.historyState, "partial");
    const legacyRejectedDetails = (0, status_tracking_1.deriveDepartmentUserStatusDetails)({
        fiscalYearKey: "2026-2027",
        plan: {
            createdAt: Date.UTC(2026, 7, 1, 8, 0, 0),
            fiscalYear: "2026-2027",
            id: "plan-rejected-legacy",
            itemCount: 3,
            rejectedAt: Date.UTC(2026, 7, 15, 8, 0, 0),
            status: "rejected",
            submittedAt: Date.UTC(2026, 7, 10, 8, 0, 0),
            updatedAt: Date.UTC(2026, 7, 15, 8, 0, 0),
        },
        timeZone: "Africa/Nairobi",
    });
    strict_1.default.equal(legacyRejectedDetails.historyState, "partial");
    completedTests.push("department-user status tracking keeps legacy approved and rejected plans marked as partial history when canonical intermediate workflow events are missing");
    const revisionHistoryDetails = (0, status_tracking_1.deriveDepartmentUserStatusDetails)({
        fiscalYearKey: "2026-2027",
        plan: {
            createdAt: Date.UTC(2026, 7, 1, 8, 0, 0),
            fiscalYear: "2026-2027",
            id: "plan-revision-history",
            itemCount: 3,
            latestDecision: {
                comment: "Adjust delivery timing.",
                decidedAt: Date.UTC(2026, 7, 14, 8, 0, 0),
                decisionType: "revision_requested",
                effectiveRevisionDeadlineAt: Date.UTC(2026, 7, 16, 8, 0, 0),
            },
            rejectedAt: Date.UTC(2026, 7, 14, 8, 0, 0),
            reviewDecisions: [
                {
                    comment: "Adjust delivery timing.",
                    decidedAt: Date.UTC(2026, 7, 14, 8, 0, 0),
                    decisionType: "revision_requested",
                    effectiveRevisionDeadlineAt: Date.UTC(2026, 7, 16, 8, 0, 0),
                    id: "decision-1",
                    lifecycleStatus: "active",
                    revisionDeadlineAt: null,
                },
            ],
            status: "rejected",
            submissionSnapshots: [
                {
                    capturedAt: Date.UTC(2026, 7, 10, 10, 0, 0),
                    lifecycleStatus: "active",
                    submissionReference: "CS-2627-001",
                    submissionSequence: 1,
                    submittedAt: Date.UTC(2026, 7, 10, 8, 0, 0),
                },
                {
                    capturedAt: Date.UTC(2026, 7, 16, 10, 0, 0),
                    lifecycleStatus: "active",
                    submissionReference: "CS-2627-002",
                    submissionSequence: 2,
                    submittedAt: Date.UTC(2026, 7, 16, 8, 0, 0),
                },
            ],
            submittedAt: Date.UTC(2026, 7, 16, 8, 0, 0),
            updatedAt: Date.UTC(2026, 7, 16, 8, 0, 0),
        },
        timeZone: "Africa/Nairobi",
    });
    strict_1.default.deepEqual(revisionHistoryDetails.timeline.map((item) => item.title), ["Draft Created", "Submitted", "Revision Requested", "Submitted"]);
    strict_1.default.match(revisionHistoryDetails.helperText, /Effective revision deadline/i);
    completedTests.push("department-user status tracking reuses review-decision history to show revision-requested cycles and surface the effective resubmission deadline in DU helper copy");
    const canonicalPlans = (0, status_tracking_1.selectCanonicalPlans)([
        {
            createdAt: Date.UTC(2026, 7, 1, 8, 0, 0),
            fiscalYear: "2026-2027",
            id: "plan-submitted",
            itemCount: 4,
            status: "submitted",
            submittedAt: Date.UTC(2026, 7, 10, 8, 0, 0),
            updatedAt: Date.UTC(2026, 7, 10, 8, 0, 0),
        },
        {
            createdAt: Date.UTC(2026, 7, 11, 8, 0, 0),
            fiscalYear: "2026-2027",
            id: "plan-newer-draft",
            itemCount: 1,
            status: "draft",
            updatedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
        },
    ]);
    strict_1.default.equal(canonicalPlans.length, 1);
    strict_1.default.equal(canonicalPlans[0]?.id, "plan-submitted");
    completedTests.push("department-user canonical plan selection keeps an active same-year workflow plan visible even when a newer draft exists for the same fiscal year");
    return completedTests;
}
exports.runDepartmentUserStatusTrackingTests = runDepartmentUserStatusTrackingTests;
