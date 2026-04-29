import assert from "node:assert/strict";
import {
    buildProcurementOfficerDecisionSummary,
    buildProcurementOfficerDecisionNotificationIdempotencyKey,
    getProcurementOfficerPlanDecisionStatusLabel,
    getProcurementOfficerUndoApprovalEligibility,
    normalizeProcurementOfficerDecisionComment,
    normalizeProcurementOfficerFlaggedTargets,
    validateProcurementOfficerRevisionDeadline,
} from "../lib/procurement-officer/review-decision";
import { deriveDepartmentUserStatusDetails } from "../lib/department-user/status-tracking";
import {
    buildDepartmentUserDashboardSnapshot,
} from "../lib/department-user/dashboard-snapshot";
import {
    derivePlanAction,
    normalizeDepartmentUserPlanStatus,
} from "../lib/department-user/dashboard";

export function runProcurementOfficerReviewDecisionTests(): string[] {
    const completedTests: string[] = [];

    assert.deepEqual(normalizeProcurementOfficerDecisionComment("   "), {
        message: "Decision comments cannot be blank.",
        ok: false,
    });
    assert.deepEqual(
        normalizeProcurementOfficerDecisionComment("  Tighten the quantities on ICT items.  "),
        {
            ok: true,
            value: "Tighten the quantities on ICT items.",
        },
    );
    completedTests.push(
        "review decision comments trim canonical DU-facing guidance and reject blank outcomes",
    );

    assert.deepEqual(
        normalizeProcurementOfficerFlaggedTargets({
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
        }),
        {
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
        },
    );
    completedTests.push(
        "review decision target normalization preserves stable descriptors while failing closed on stale selections",
    );

    const now = Date.UTC(2026, 3, 28, 8, 0, 0);
    assert.deepEqual(
        validateProcurementOfficerRevisionDeadline({
            input: "2026-04-29T10:00",
            now,
            timeZone: "Africa/Nairobi",
        }),
        {
            ok: true,
            value: Date.UTC(2026, 3, 29, 7, 0, 0),
        },
    );
    assert.equal(
        validateProcurementOfficerRevisionDeadline({
            input: "2026-04-27T10:00",
            now,
            timeZone: "Africa/Nairobi",
        }).ok,
        false,
    );
    completedTests.push(
        "review decision deadlines parse tenant-local wall time and block past revision dates",
    );

    assert.deepEqual(
        getProcurementOfficerUndoApprovalEligibility({
            approvedAt: now,
            now: now + 60 * 60 * 1000,
            status: "approved",
        }),
        {
            blockedReason: null,
            canUndo: true,
            undoDeadlineAt: now + 24 * 60 * 60 * 1000,
        },
    );
    assert.equal(
        getProcurementOfficerUndoApprovalEligibility({
            approvedAt: now,
            consolidatedAt: now + 1,
            now: now + 60 * 60 * 1000,
            status: "approved",
        }).canUndo,
        false,
    );
    assert.equal(
        getProcurementOfficerUndoApprovalEligibility({
            approvedAt: now,
            now: now + 25 * 60 * 60 * 1000,
            status: "approved",
        }).blockedReason,
        "Undo window expired 24 hours after approval.",
    );
    completedTests.push(
        "approval undo eligibility stays deterministic across active, consolidated, and expired-window outcomes",
    );

    assert.equal(
        buildProcurementOfficerDecisionNotificationIdempotencyKey({
            decisionId: "decision-7",
            decisionType: "revision_requested",
            planId: "plan-1",
            recipientEmail: "DU@Example.com",
            tenantId: "tenant-1",
        }),
        "plan-review-decision:tenant-1:plan-1:decision-7:revision_requested:du@example.com",
    );
    assert.equal(
        getProcurementOfficerPlanDecisionStatusLabel("revision_requested"),
        "Revision Requested",
    );
    assert.match(
        buildProcurementOfficerDecisionSummary(
            {
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
            },
            "Africa/Nairobi",
        ) ?? "",
        /Revision Requested/i,
    );
    completedTests.push(
        "review decision labels, summaries, and notification keys stay stable for DU-facing notifications",
    );

    assert.equal(
        normalizeDepartmentUserPlanStatus("revision_requested"),
        "Revision Requested",
    );
    assert.deepEqual(
        derivePlanAction({
            accessMode: "editable",
            hasCanonicalPlan: true,
            planHref: "/du/plans/plan-1?mode=edit",
            status: "Revision Requested",
        }),
        {
            disabled: false,
            href: "/du/plans/plan-1?mode=edit",
            kind: "edit",
            label: "Edit Plan",
        },
    );
    completedTests.push(
        "revision-requested DU plans stay editable through the same canonical action flow as rejected plans",
    );

    const statusDetails = deriveDepartmentUserStatusDetails({
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
    assert.equal(statusDetails.displayStatus, "revision_requested");
    assert.equal(statusDetails.statusLabel, "Revision Requested");
    assert.match(statusDetails.helperText, /Revise the ICT quantities/i);
    assert.equal(statusDetails.timeline.at(-1)?.title, "Revision Requested");
    completedTests.push(
        "department-user status tracking surfaces revision requested as a distinct label while reusing canonical rejected plan state",
    );

    const revisionRequestedSnapshot = buildDepartmentUserDashboardSnapshot({
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
    assert.equal(revisionRequestedSnapshot.quickStats.plan.statusLabel, "Revision Requested");
    assert.equal(revisionRequestedSnapshot.quickStats.plan.primaryActionLabel, "Edit Plan");
    assert.equal(
        revisionRequestedSnapshot.rejectionNotice?.title,
        "Revision requested",
    );
    assert.ok(revisionRequestedSnapshot.rejectionNotice);
    assert.equal(
        revisionRequestedSnapshot.rejectionNotice.action.href,
        "/du/plans/plan-1?mode=edit",
    );
    completedTests.push(
        "revision-requested dashboard snapshots keep the DU on an edit path and preserve the visible decision notice",
    );

    return completedTests;
}
