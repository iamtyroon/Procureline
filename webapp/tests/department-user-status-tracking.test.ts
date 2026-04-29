import assert from "node:assert/strict";
import {
    deriveDepartmentUserDisplayStatus,
    deriveDepartmentUserStatusDetails,
    selectCanonicalPlans,
} from "../lib/department-user/status-tracking";

export function runDepartmentUserStatusTrackingTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(
        deriveDepartmentUserDisplayStatus({
            approvedAt: null,
            rejectedAt: null,
            reviewStartedAt: null,
            status: "submitted",
        }),
        "submitted",
    );
    assert.equal(
        deriveDepartmentUserDisplayStatus({
            approvedAt: null,
            rejectedAt: null,
            reviewStartedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
            status: "submitted",
        }),
        "under_review",
    );
    assert.equal(
        deriveDepartmentUserDisplayStatus({
            approvedAt: Date.UTC(2026, 7, 14, 11, 0, 0),
            rejectedAt: null,
            reviewStartedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
            status: "submitted",
        }),
        "approved",
    );
    assert.equal(
        deriveDepartmentUserDisplayStatus({
            approvedAt: null,
            rejectedAt: Date.UTC(2026, 7, 14, 11, 0, 0),
            reviewStartedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
            status: "submitted",
        }),
        "rejected",
    );
    assert.equal(
        deriveDepartmentUserDisplayStatus({
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
        }),
        "revision_requested",
    );
    completedTests.push(
        "department-user status tracking derives submitted, under-review, approved, and rejected views from canonical plan fields without inventing a new workflow enum",
    );

    const underReviewDetails = deriveDepartmentUserStatusDetails({
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
    assert.equal(underReviewDetails.statusLabel, "Under Review");
    assert.equal(underReviewDetails.canWithdraw, false);
    assert.equal(underReviewDetails.reviewerLabel, null);
    assert.equal(underReviewDetails.reviewerState, "unavailable");
    assert.match(underReviewDetails.helperText, /Procurement Officer review in progress/i);
    completedTests.push(
        "department-user status tracking keeps under-review plans read-only and degrades reviewer details to neutral copy when the reviewer identity cannot be safely resolved",
    );

    const snapshotPrecedenceDetails = deriveDepartmentUserStatusDetails({
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
    assert.equal(snapshotPrecedenceDetails.submissionReference, "CS-2627-002");
    assert.equal(snapshotPrecedenceDetails.timeline[1]?.title, "Submitted");
    assert.equal(snapshotPrecedenceDetails.timeline[2]?.title, "Withdrawn");
    assert.equal(
        snapshotPrecedenceDetails.timeline[snapshotPrecedenceDetails.timeline.length - 1]?.timestampLabel,
        "10 Aug 2026, 11:00 GMT+3",
    );
    completedTests.push(
        "department-user status tracking prefers the active submission snapshot over mutable plan-level submission fields and preserves withdrawn plus resubmitted timeline history in order",
    );

    const mixedLegacyOrderingDetails = deriveDepartmentUserStatusDetails({
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
    assert.deepEqual(
        mixedLegacyOrderingDetails.timeline
            .filter((item) => item.title === "Submitted")
            .map((item) => item.description),
        ["Submitted as LEGACY-1.", "Submitted as CS-2627-003."],
    );
    completedTests.push(
        "department-user status tracking orders mixed legacy and sequenced submission snapshots by actual chronology instead of comparing sequence ordinals directly to timestamps",
    );

    const legacyDetails = deriveDepartmentUserStatusDetails({
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
    assert.equal(legacyDetails.historyState, "partial");
    assert.equal(
        legacyDetails.historySummary,
        "Some earlier status history is unavailable for this plan.",
    );
    completedTests.push(
        "department-user status tracking marks incomplete legacy submission history explicitly instead of inventing missing timestamps",
    );

    const legacyApprovedDetails = deriveDepartmentUserStatusDetails({
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
    assert.equal(legacyApprovedDetails.historyState, "partial");

    const legacyRejectedDetails = deriveDepartmentUserStatusDetails({
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
    assert.equal(legacyRejectedDetails.historyState, "partial");
    completedTests.push(
        "department-user status tracking keeps legacy approved and rejected plans marked as partial history when canonical intermediate workflow events are missing",
    );

    const revisionHistoryDetails = deriveDepartmentUserStatusDetails({
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
    assert.deepEqual(
        revisionHistoryDetails.timeline.map((item) => item.title),
        ["Draft Created", "Submitted", "Revision Requested", "Submitted"],
    );
    assert.match(
        revisionHistoryDetails.helperText,
        /Effective revision deadline/i,
    );
    completedTests.push(
        "department-user status tracking reuses review-decision history to show revision-requested cycles and surface the effective resubmission deadline in DU helper copy",
    );

    const canonicalPlans = selectCanonicalPlans([
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
    assert.equal(canonicalPlans.length, 1);
    assert.equal(canonicalPlans[0]?.id, "plan-submitted");
    completedTests.push(
        "department-user canonical plan selection keeps an active same-year workflow plan visible even when a newer draft exists for the same fiscal year",
    );

    return completedTests;
}
