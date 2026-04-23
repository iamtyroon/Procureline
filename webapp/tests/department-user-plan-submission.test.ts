import assert from "node:assert/strict";
import {
    mapDepartmentUserBudgetMeterState,
    type DepartmentUserWorkspaceSummary,
} from "../lib/blockly/du-workspace-calculations";
import {
    buildDepartmentUserPlanSubmissionReviewSummary,
    canDepartmentUserOpenPlanSubmissionReview,
    getDepartmentUserPlanSubmitState,
} from "../lib/blockly/plan-submission";
import { createUnavailableProcurementComplianceSnapshot } from "../lib/procurement/compliance";
import {
    buildPlanSubmissionEmailIdempotencyKey,
    buildPlanSubmissionPersistenceRecord,
    buildPlanSubmissionSequenceKey,
    formatPlanSubmissionReference,
    getNextPlanSubmissionSequence,
    resolveLatestActivePlanSubmissionSnapshot,
    selectPreviousActivePlanSubmissionSnapshot,
    shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot,
} from "../lib/plans/submission";

function createWorkspaceSummary(): DepartmentUserWorkspaceSummary {
    const budgetState = mapDepartmentUserBudgetMeterState({
        totalBudget: 2_000_000,
        usedAmount: 650_000,
    });

    return {
        budgetState,
        categories: [
            {
                categoryId: "cat-it",
                categoryName: "ICT Equipment",
                itemCount: 1,
                items: [],
                quarterTotals: { q1: 0, q2: 0, q3: 0, q4: 0 },
                totalCost: 500_000,
            },
            {
                categoryId: "cat-office",
                categoryName: "Office Supplies",
                itemCount: 2,
                items: [],
                quarterTotals: { q1: 0, q2: 0, q3: 0, q4: 0 },
                totalCost: 150_000,
            },
        ],
        complianceState: createUnavailableProcurementComplianceSnapshot({
            totalEligibleSpend: 650_000,
        }),
        departmentTotal: 650_000,
        quarterTotals: { q1: 0, q2: 0, q3: 0, q4: 0 },
        totalItemCount: 3,
        validationState: {
            hasBlockingIssues: false,
            issues: [],
            itemIssuesByBlockId: {},
            submitBlockedReasons: [],
            validationUnavailableReason: null,
        },
    };
}

export function runDepartmentUserPlanSubmissionTests(): string[] {
    const completedTests: string[] = [];

    const summary = createWorkspaceSummary();
    assert.deepEqual(buildDepartmentUserPlanSubmissionReviewSummary(summary), {
        blockerMessages: [],
        categories: [
            {
                categoryId: "cat-it",
                categoryName: "ICT Equipment",
                estimatedBudgetUsed: 500_000,
                itemCount: 1,
            },
            {
                categoryId: "cat-office",
                categoryName: "Office Supplies",
                estimatedBudgetUsed: 150_000,
                itemCount: 2,
            },
        ],
        estimatedBudgetUsed: 650_000,
        itemCount: 3,
    });
    assert.deepEqual(
        buildDepartmentUserPlanSubmissionReviewSummary({
            ...summary,
            totalItemCount: 0,
            validationState: {
                ...summary.validationState,
                submitBlockedReasons: ["Resolve duplicate items."],
                validationUnavailableReason: "Validation service is unavailable.",
            },
        }).blockerMessages,
        [
            "Add at least one actionable item before submitting this plan.",
            "Resolve duplicate items.",
            "Validation service is unavailable.",
        ],
    );
    completedTests.push(
        "department-user submission review summaries surface item totals, category spend, and canonical blocker messaging without trusting the editor shell",
    );

    assert.deepEqual(
        getDepartmentUserPlanSubmitState({
            budgetState: summary.budgetState,
            hasUnsyncedChanges: false,
            mode: "edit",
            saveState: "idle",
            totalItemCount: summary.totalItemCount,
            validationState: summary.validationState,
        }),
        {
            disabled: false,
            label: "Review & Submit",
            reason: "Review the current plan summary, then confirm submission to Procurement.",
        },
    );
    assert.equal(
        getDepartmentUserPlanSubmitState({
            budgetState: summary.budgetState,
            hasUnsyncedChanges: true,
            mode: "edit",
            saveState: "idle",
            totalItemCount: summary.totalItemCount,
            validationState: summary.validationState,
        }).label,
        "Save Draft Before Submit",
    );
    assert.equal(
        getDepartmentUserPlanSubmitState({
            budgetState: summary.budgetState,
            hasUnsyncedChanges: false,
            mode: "edit",
            saveState: "blocked",
            totalItemCount: summary.totalItemCount,
            validationState: summary.validationState,
        }).label,
        "Cloud Save Required",
    );
    assert.equal(
        getDepartmentUserPlanSubmitState({
            budgetState: mapDepartmentUserBudgetMeterState({
                totalBudget: 500_000,
                usedAmount: 700_000,
            }),
            hasUnsyncedChanges: false,
            mode: "edit",
            saveState: "idle",
            totalItemCount: summary.totalItemCount,
            validationState: summary.validationState,
        }).label,
        "Over Budget - Cannot Submit",
    );
    assert.equal(
        getDepartmentUserPlanSubmitState({
            budgetState: summary.budgetState,
            hasUnsyncedChanges: false,
            mode: "view",
            saveState: "idle",
            totalItemCount: summary.totalItemCount,
            validationState: summary.validationState,
        }).label,
        "Read-only - Cannot Submit",
    );
    assert.equal(
        getDepartmentUserPlanSubmitState({
            budgetState: summary.budgetState,
            hasUnsyncedChanges: false,
            mode: "edit",
            saveState: "idle",
            totalItemCount: summary.totalItemCount,
            validationState: {
                ...summary.validationState,
                submitBlockedReasons: ["Fix duplicate items before submitting."],
            },
        }).label,
        "Fix Validation Issues",
    );
    completedTests.push(
        "department-user submit gating stays truthful across read-only, unsynced, blocked-save, over-budget, and validation-blocked plan states",
    );

    assert.equal(canDepartmentUserOpenPlanSubmissionReview("draft"), true);
    assert.equal(canDepartmentUserOpenPlanSubmissionReview("rejected"), false);
    assert.equal(canDepartmentUserOpenPlanSubmissionReview("submitted"), false);
    assert.equal(canDepartmentUserOpenPlanSubmissionReview("approved"), false);
    completedTests.push(
        "department-user submit affordances only open the confirmation flow for true draft plans so rejected and closed states do not surface backend-rejected actions",
    );

    assert.equal(
        formatPlanSubmissionReference({
            departmentCode: " cs / dept ",
            fiscalYear: "2026-2027",
            submissionSequence: 7,
        }),
        "CS-DEPT-2627-007",
    );
    assert.equal(
        getNextPlanSubmissionSequence([
            { submissionSequence: null },
            { submissionSequence: 1 },
            { submissionSequence: 4 },
        ]),
        5,
    );
    assert.equal(
        buildPlanSubmissionSequenceKey({
            planId: "plan-1",
            submissionSequence: 3,
            submittedAt: 5_000,
            tenantId: "tenant-1",
        }),
        "tenant-1:plan-1:sequence:3",
    );
    assert.equal(
        buildPlanSubmissionSequenceKey({
            planId: "plan-1",
            submittedAt: 5_000,
            tenantId: "tenant-1",
        }),
        "tenant-1:plan-1:submitted-at:5000",
    );
    assert.equal(
        buildPlanSubmissionEmailIdempotencyKey({
            planId: "plan-1",
            submissionSequence: 3,
        }),
        "plan-submission:plan-1:3",
    );
    completedTests.push(
        "plan submission helpers generate stable references, monotonic submission sequences, keyed snapshot identities, and email idempotency keys",
    );

    assert.deepEqual(
        buildPlanSubmissionPersistenceRecord({
            categorySummaries: [
                {
                    amount: 500_000,
                    categoryId: "cat-it",
                    categoryName: "ICT Equipment",
                    itemCount: 1,
                },
                {
                    amount: 150_000,
                    categoryId: "cat-office",
                    categoryName: "Office Supplies",
                    itemCount: 2,
                },
            ],
            estimatedBudgetUsed: 650_000,
            existingSelectedCategoryIds: ["cat-legacy", "cat-it"],
            itemCount: 3,
        }),
        {
            categorySummaries: [
                {
                    amount: 500_000,
                    categoryId: "cat-it",
                    categoryName: "ICT Equipment",
                    itemCount: 1,
                },
                {
                    amount: 150_000,
                    categoryId: "cat-office",
                    categoryName: "Office Supplies",
                    itemCount: 2,
                },
            ],
            estimatedBudgetUsed: 650_000,
            itemCount: 3,
            selectedCategoryIds: ["cat-legacy", "cat-it", "cat-office"],
        },
    );
    assert.equal(
        shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot({
            activeSnapshotExists: false,
            planStatus: "submitted",
            submissionReference: "CS-2627-001",
            submittedAt: 1_000,
        }),
        true,
    );
    assert.equal(
        shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot({
            activeSnapshotExists: true,
            planStatus: "submitted",
            submissionReference: "CS-2627-001",
            submittedAt: 1_000,
        }),
        false,
    );
    assert.equal(
        shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot({
            activeSnapshotExists: false,
            planStatus: "draft",
            submissionReference: "CS-2627-001",
            submittedAt: 1_000,
        }),
        false,
    );
    completedTests.push(
        "submission persistence helpers now write the recomputed canonical summary and preserve legacy withdrawn history when an older submitted plan has no active snapshot yet",
    );

    const latestActiveSnapshot = resolveLatestActivePlanSubmissionSnapshot([
        {
            capturedAt: 2_000,
            lifecycleStatus: "withdrawn" as const,
            submissionSequence: 4,
            submittedAt: 1_900,
        },
        {
            capturedAt: 1_600,
            lifecycleStatus: "active" as const,
            submissionSequence: 2,
            submittedAt: 1_500,
        },
        {
            capturedAt: 1_800,
            lifecycleStatus: "active" as const,
            submissionSequence: 3,
            submittedAt: 1_700,
        },
    ]);
    assert.equal(latestActiveSnapshot?.submissionSequence, 3);

    const previousActiveSnapshot = selectPreviousActivePlanSubmissionSnapshot({
        currentSubmissionSequence: 4,
        currentSubmittedAt: 2_000,
        snapshots: [
            {
                capturedAt: 2_100,
                lifecycleStatus: "active" as const,
                submissionSequence: 4,
                submittedAt: 2_000,
            },
            {
                capturedAt: 1_900,
                lifecycleStatus: "withdrawn" as const,
                submissionSequence: 3,
                submittedAt: 1_800,
            },
            {
                capturedAt: 1_700,
                lifecycleStatus: "active" as const,
                submissionSequence: 2,
                submittedAt: 1_600,
            },
        ],
    });
    assert.equal(previousActiveSnapshot?.submissionSequence, 2);
    completedTests.push(
        "submission snapshot selectors ignore withdrawn baselines and keep procurement review comparisons anchored to the latest active prior submission",
    );

    return completedTests;
}
