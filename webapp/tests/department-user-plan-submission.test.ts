import assert from "node:assert/strict";
import {
    mapDepartmentUserBudgetMeterState,
    type DepartmentUserWorkspaceSummary,
} from "../lib/shared/blockly/du-workspace-calculations";
import {
    buildDepartmentUserPlanSubmissionReviewSummary,
    canDepartmentUserOpenPlanSubmissionReview,
    getDepartmentUserPlanSubmitState,
    shouldReplayDepartmentUserSubmittedPlan,
} from "../lib/shared/blockly/plan-submission";
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
import {
    evaluateSubmissionDeadlineIssue,
    resolveEffectiveSubmissionWindow,
    summarizePendingCatalogRequestBlockers,
} from "../lib/plans/pre-submission-validation";

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
        issues: [],
        itemCount: 3,
        validationSummary: {
            budgetStatus: "Within budget",
            pendingRequestStatus: "No pending catalog requests",
            validationStatus: "passed",
        },
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

    const zeroQuantitySummary = createWorkspaceSummary();
    zeroQuantitySummary.validationState = {
        hasBlockingIssues: true,
        itemIssuesByBlockId: {
            "block-laptop": [
                {
                    blockId: "block-laptop",
                    blocksSubmission: true,
                    categoryId: "cat-it",
                    categoryName: "ICT Equipment",
                    code: "zero_quantity",
                    fixTarget: {
                        id: "block-laptop",
                        label: "Laptop",
                        type: "workspace_block",
                    },
                    itemId: "item-laptop",
                    itemName: "Laptop",
                    message: "Laptop has zero quantity. Enter quantity or remove item.",
                    severity: "error",
                },
            ],
        },
        issues: [
            {
                blockId: "block-laptop",
                blocksSubmission: true,
                categoryId: "cat-it",
                categoryName: "ICT Equipment",
                code: "zero_quantity",
                fixTarget: {
                    id: "block-laptop",
                    label: "Laptop",
                    type: "workspace_block",
                },
                itemId: "item-laptop",
                itemName: "Laptop",
                message: "Laptop has zero quantity. Enter quantity or remove item.",
                severity: "error",
            },
        ],
        submitBlockedReasons: [
            "Laptop has zero quantity. Enter quantity or remove item.",
        ],
        validationUnavailableReason: null,
    };
    const zeroQuantityReview =
        buildDepartmentUserPlanSubmissionReviewSummary(zeroQuantitySummary);
    assert.equal(zeroQuantityReview.issues.length, 1);
    assert.equal(zeroQuantityReview.issues[0]?.code, "zero_quantity");
    assert.equal(zeroQuantityReview.issues[0]?.fixTarget?.type, "workspace_block");
    assert.equal(zeroQuantityReview.validationSummary.validationStatus, "blocked");
    completedTests.push(
        "department-user submission review summaries preserve itemized zero-quantity blockers with workspace fix targets",
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
    assert.equal(canDepartmentUserOpenPlanSubmissionReview("rejected"), true);
    assert.equal(canDepartmentUserOpenPlanSubmissionReview("submitted"), false);
    assert.equal(canDepartmentUserOpenPlanSubmissionReview("approved"), false);
    assert.equal(
        shouldReplayDepartmentUserSubmittedPlan({
            status: "submitted",
            submittedAt: 1_775_000_000_000,
            submissionReference: "CS-2627-001",
        }),
        true,
    );
    assert.equal(
        shouldReplayDepartmentUserSubmittedPlan({
            status: "submitted",
            submittedAt: null,
            submissionReference: "CS-2627-001",
        }),
        false,
    );
    assert.equal(
        shouldReplayDepartmentUserSubmittedPlan({
            status: "draft",
            submittedAt: 1_775_000_000_000,
            submissionReference: "CS-2627-001",
        }),
        false,
    );
    completedTests.push(
        "department-user submit affordances reopen the confirmation flow for active rejected revision plans while keeping submitted and approved plans read-only",
    );

    const pendingSummary = summarizePendingCatalogRequestBlockers({
        pendingCategoryRequestCount: 1,
        pendingItemRequestCount: 2,
        pendingLinkedCategoryHandoffCount: 1,
    });
    assert.equal(
        pendingSummary.message,
        "You have 4 pending requests. Cancel or wait for PO decision.",
    );
    assert.equal(pendingSummary.issue?.fixTarget?.type, "pending_requests");
    const linkedAlreadyCountedSummary = summarizePendingCatalogRequestBlockers({
        pendingCategoryRequestCount: 1,
        pendingItemRequestCount: 2,
        pendingLinkedCategoryHandoffCount: 0,
    });
    assert.equal(
        linkedAlreadyCountedSummary.message,
        "You have 3 pending requests. Cancel or wait for PO decision.",
    );
    assert.equal(
        summarizePendingCatalogRequestBlockers({
            pendingCategoryRequestCount: 0,
            pendingItemRequestCount: 0,
        }).issue,
        null,
    );
    completedTests.push(
        "pending catalog request validation counts current-plan item, category, and linked category handoff blockers without inventing another request store",
    );

    const sharedWindow = resolveEffectiveSubmissionWindow({
        departmentSubmissionEndsAt: 20_000,
        departmentSubmissionStartsAt: 10_000,
        sharedDeadline: {
            deadlineVersion: 2,
            submissionEndsAt: 40_000,
            submissionStartsAt: 30_000,
            timeZone: "Africa/Nairobi",
            updatedAt: 9_000,
        },
    });
    assert.equal(sharedWindow.source, "shared");
    assert.equal(evaluateSubmissionDeadlineIssue({ now: 29_999, window: sharedWindow })?.message, "Submission window has not opened yet.");
    assert.equal(evaluateSubmissionDeadlineIssue({ now: 30_000, window: sharedWindow }), null);
    assert.equal(evaluateSubmissionDeadlineIssue({ now: 40_000, window: sharedWindow })?.message, "Submission deadline has passed. Contact your PO.");
    assert.equal(
        resolveEffectiveSubmissionWindow({
            departmentSubmissionEndsAt: 20_000,
            departmentSubmissionStartsAt: 10_000,
            sharedDeadline: null,
        }).source,
        "department",
    );
    const departmentExtensionWindow = resolveEffectiveSubmissionWindow({
        departmentSubmissionEndsAt: 50_000,
        departmentSubmissionStartsAt: 30_000,
        sharedDeadline: {
            deadlineVersion: 2,
            submissionEndsAt: 40_000,
            submissionStartsAt: 30_000,
            timeZone: "Africa/Nairobi",
            updatedAt: 9_000,
        },
    });
    assert.equal(departmentExtensionWindow.source, "department");
    assert.equal(
        evaluateSubmissionDeadlineIssue({
            now: 45_000,
            window: departmentExtensionWindow,
        }),
        null,
    );
    completedTests.push(
        "submission deadline validation prefers shared canonical windows unless a department-specific extension gives one department extra submission time",
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
