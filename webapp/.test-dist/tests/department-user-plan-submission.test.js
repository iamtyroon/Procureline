"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDepartmentUserPlanSubmissionTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const du_workspace_calculations_1 = require("../lib/shared/blockly/du-workspace-calculations");
const plan_submission_1 = require("../lib/shared/blockly/plan-submission");
const compliance_1 = require("../lib/procurement/compliance");
const submission_1 = require("../lib/plans/submission");
const pre_submission_validation_1 = require("../lib/plans/pre-submission-validation");
function createWorkspaceSummary() {
    const budgetState = (0, du_workspace_calculations_1.mapDepartmentUserBudgetMeterState)({
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
        complianceState: (0, compliance_1.createUnavailableProcurementComplianceSnapshot)({
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
function runDepartmentUserPlanSubmissionTests() {
    const completedTests = [];
    const summary = createWorkspaceSummary();
    strict_1.default.deepEqual((0, plan_submission_1.buildDepartmentUserPlanSubmissionReviewSummary)(summary), {
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
    strict_1.default.deepEqual((0, plan_submission_1.buildDepartmentUserPlanSubmissionReviewSummary)({
        ...summary,
        totalItemCount: 0,
        validationState: {
            ...summary.validationState,
            submitBlockedReasons: ["Resolve duplicate items."],
            validationUnavailableReason: "Validation service is unavailable.",
        },
    }).blockerMessages, [
        "Add at least one actionable item before submitting this plan.",
        "Resolve duplicate items.",
        "Validation service is unavailable.",
    ]);
    completedTests.push("department-user submission review summaries surface item totals, category spend, and canonical blocker messaging without trusting the editor shell");
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
    const zeroQuantityReview = (0, plan_submission_1.buildDepartmentUserPlanSubmissionReviewSummary)(zeroQuantitySummary);
    strict_1.default.equal(zeroQuantityReview.issues.length, 1);
    strict_1.default.equal(zeroQuantityReview.issues[0]?.code, "zero_quantity");
    strict_1.default.equal(zeroQuantityReview.issues[0]?.fixTarget?.type, "workspace_block");
    strict_1.default.equal(zeroQuantityReview.validationSummary.validationStatus, "blocked");
    completedTests.push("department-user submission review summaries preserve itemized zero-quantity blockers with workspace fix targets");
    strict_1.default.deepEqual((0, plan_submission_1.getDepartmentUserPlanSubmitState)({
        budgetState: summary.budgetState,
        hasUnsyncedChanges: false,
        mode: "edit",
        saveState: "idle",
        totalItemCount: summary.totalItemCount,
        validationState: summary.validationState,
    }), {
        disabled: false,
        label: "Review & Submit",
        reason: "Review the current plan summary, then confirm submission to Procurement.",
    });
    strict_1.default.equal((0, plan_submission_1.getDepartmentUserPlanSubmitState)({
        budgetState: summary.budgetState,
        hasUnsyncedChanges: true,
        mode: "edit",
        saveState: "idle",
        totalItemCount: summary.totalItemCount,
        validationState: summary.validationState,
    }).label, "Save Draft Before Submit");
    strict_1.default.equal((0, plan_submission_1.getDepartmentUserPlanSubmitState)({
        budgetState: summary.budgetState,
        hasUnsyncedChanges: false,
        mode: "edit",
        saveState: "blocked",
        totalItemCount: summary.totalItemCount,
        validationState: summary.validationState,
    }).label, "Cloud Save Required");
    strict_1.default.equal((0, plan_submission_1.getDepartmentUserPlanSubmitState)({
        budgetState: (0, du_workspace_calculations_1.mapDepartmentUserBudgetMeterState)({
            totalBudget: 500_000,
            usedAmount: 700_000,
        }),
        hasUnsyncedChanges: false,
        mode: "edit",
        saveState: "idle",
        totalItemCount: summary.totalItemCount,
        validationState: summary.validationState,
    }).label, "Over Budget - Cannot Submit");
    strict_1.default.equal((0, plan_submission_1.getDepartmentUserPlanSubmitState)({
        budgetState: summary.budgetState,
        hasUnsyncedChanges: false,
        mode: "view",
        saveState: "idle",
        totalItemCount: summary.totalItemCount,
        validationState: summary.validationState,
    }).label, "Read-only - Cannot Submit");
    strict_1.default.equal((0, plan_submission_1.getDepartmentUserPlanSubmitState)({
        budgetState: summary.budgetState,
        hasUnsyncedChanges: false,
        mode: "edit",
        saveState: "idle",
        totalItemCount: summary.totalItemCount,
        validationState: {
            ...summary.validationState,
            submitBlockedReasons: ["Fix duplicate items before submitting."],
        },
    }).label, "Fix Validation Issues");
    completedTests.push("department-user submit gating stays truthful across read-only, unsynced, blocked-save, over-budget, and validation-blocked plan states");
    strict_1.default.equal((0, plan_submission_1.canDepartmentUserOpenPlanSubmissionReview)("draft"), true);
    strict_1.default.equal((0, plan_submission_1.canDepartmentUserOpenPlanSubmissionReview)("rejected"), true);
    strict_1.default.equal((0, plan_submission_1.canDepartmentUserOpenPlanSubmissionReview)("submitted"), false);
    strict_1.default.equal((0, plan_submission_1.canDepartmentUserOpenPlanSubmissionReview)("approved"), false);
    strict_1.default.equal((0, plan_submission_1.shouldReplayDepartmentUserSubmittedPlan)({
        status: "submitted",
        submittedAt: 1_775_000_000_000,
        submissionReference: "CS-2627-001",
    }), true);
    strict_1.default.equal((0, plan_submission_1.shouldReplayDepartmentUserSubmittedPlan)({
        status: "submitted",
        submittedAt: null,
        submissionReference: "CS-2627-001",
    }), false);
    strict_1.default.equal((0, plan_submission_1.shouldReplayDepartmentUserSubmittedPlan)({
        status: "draft",
        submittedAt: 1_775_000_000_000,
        submissionReference: "CS-2627-001",
    }), false);
    completedTests.push("department-user submit affordances reopen the confirmation flow for active rejected revision plans while keeping submitted and approved plans read-only");
    const pendingSummary = (0, pre_submission_validation_1.summarizePendingCatalogRequestBlockers)({
        pendingCategoryRequestCount: 1,
        pendingItemRequestCount: 2,
        pendingLinkedCategoryHandoffCount: 1,
    });
    strict_1.default.equal(pendingSummary.message, "You have 4 pending requests. Cancel or wait for PO decision.");
    strict_1.default.equal(pendingSummary.issue?.fixTarget?.type, "pending_requests");
    const linkedAlreadyCountedSummary = (0, pre_submission_validation_1.summarizePendingCatalogRequestBlockers)({
        pendingCategoryRequestCount: 1,
        pendingItemRequestCount: 2,
        pendingLinkedCategoryHandoffCount: 0,
    });
    strict_1.default.equal(linkedAlreadyCountedSummary.message, "You have 3 pending requests. Cancel or wait for PO decision.");
    strict_1.default.equal((0, pre_submission_validation_1.summarizePendingCatalogRequestBlockers)({
        pendingCategoryRequestCount: 0,
        pendingItemRequestCount: 0,
    }).issue, null);
    completedTests.push("pending catalog request validation counts current-plan item, category, and linked category handoff blockers without inventing another request store");
    const sharedWindow = (0, pre_submission_validation_1.resolveEffectiveSubmissionWindow)({
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
    strict_1.default.equal(sharedWindow.source, "shared");
    strict_1.default.equal((0, pre_submission_validation_1.evaluateSubmissionDeadlineIssue)({ now: 29_999, window: sharedWindow })?.message, "Submission window has not opened yet.");
    strict_1.default.equal((0, pre_submission_validation_1.evaluateSubmissionDeadlineIssue)({ now: 30_000, window: sharedWindow }), null);
    strict_1.default.equal((0, pre_submission_validation_1.evaluateSubmissionDeadlineIssue)({ now: 40_000, window: sharedWindow })?.message, "Submission deadline has passed. Contact your PO.");
    strict_1.default.equal((0, pre_submission_validation_1.resolveEffectiveSubmissionWindow)({
        departmentSubmissionEndsAt: 20_000,
        departmentSubmissionStartsAt: 10_000,
        sharedDeadline: null,
    }).source, "department");
    const departmentExtensionWindow = (0, pre_submission_validation_1.resolveEffectiveSubmissionWindow)({
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
    strict_1.default.equal(departmentExtensionWindow.source, "department");
    strict_1.default.equal((0, pre_submission_validation_1.evaluateSubmissionDeadlineIssue)({
        now: 45_000,
        window: departmentExtensionWindow,
    }), null);
    completedTests.push("submission deadline validation prefers shared canonical windows unless a department-specific extension gives one department extra submission time");
    strict_1.default.equal((0, submission_1.formatPlanSubmissionReference)({
        departmentCode: " cs / dept ",
        fiscalYear: "2026-2027",
        submissionSequence: 7,
    }), "CS-DEPT-2627-007");
    strict_1.default.equal((0, submission_1.getNextPlanSubmissionSequence)([
        { submissionSequence: null },
        { submissionSequence: 1 },
        { submissionSequence: 4 },
    ]), 5);
    strict_1.default.equal((0, submission_1.buildPlanSubmissionSequenceKey)({
        planId: "plan-1",
        submissionSequence: 3,
        submittedAt: 5_000,
        tenantId: "tenant-1",
    }), "tenant-1:plan-1:sequence:3");
    strict_1.default.equal((0, submission_1.buildPlanSubmissionSequenceKey)({
        planId: "plan-1",
        submittedAt: 5_000,
        tenantId: "tenant-1",
    }), "tenant-1:plan-1:submitted-at:5000");
    strict_1.default.equal((0, submission_1.buildPlanSubmissionEmailIdempotencyKey)({
        planId: "plan-1",
        submissionSequence: 3,
    }), "plan-submission:plan-1:3");
    completedTests.push("plan submission helpers generate stable references, monotonic submission sequences, keyed snapshot identities, and email idempotency keys");
    strict_1.default.deepEqual((0, submission_1.buildPlanSubmissionPersistenceRecord)({
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
    }), {
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
    });
    strict_1.default.equal((0, submission_1.shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot)({
        activeSnapshotExists: false,
        planStatus: "submitted",
        submissionReference: "CS-2627-001",
        submittedAt: 1_000,
    }), true);
    strict_1.default.equal((0, submission_1.shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot)({
        activeSnapshotExists: true,
        planStatus: "submitted",
        submissionReference: "CS-2627-001",
        submittedAt: 1_000,
    }), false);
    strict_1.default.equal((0, submission_1.shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot)({
        activeSnapshotExists: false,
        planStatus: "draft",
        submissionReference: "CS-2627-001",
        submittedAt: 1_000,
    }), false);
    completedTests.push("submission persistence helpers now write the recomputed canonical summary and preserve legacy withdrawn history when an older submitted plan has no active snapshot yet");
    const latestActiveSnapshot = (0, submission_1.resolveLatestActivePlanSubmissionSnapshot)([
        {
            capturedAt: 2_000,
            lifecycleStatus: "withdrawn",
            submissionSequence: 4,
            submittedAt: 1_900,
        },
        {
            capturedAt: 1_600,
            lifecycleStatus: "active",
            submissionSequence: 2,
            submittedAt: 1_500,
        },
        {
            capturedAt: 1_800,
            lifecycleStatus: "active",
            submissionSequence: 3,
            submittedAt: 1_700,
        },
    ]);
    strict_1.default.equal(latestActiveSnapshot?.submissionSequence, 3);
    const previousActiveSnapshot = (0, submission_1.selectPreviousActivePlanSubmissionSnapshot)({
        currentSubmissionSequence: 4,
        currentSubmittedAt: 2_000,
        snapshots: [
            {
                capturedAt: 2_100,
                lifecycleStatus: "active",
                submissionSequence: 4,
                submittedAt: 2_000,
            },
            {
                capturedAt: 1_900,
                lifecycleStatus: "withdrawn",
                submissionSequence: 3,
                submittedAt: 1_800,
            },
            {
                capturedAt: 1_700,
                lifecycleStatus: "active",
                submissionSequence: 2,
                submittedAt: 1_600,
            },
        ],
    });
    strict_1.default.equal(previousActiveSnapshot?.submissionSequence, 2);
    completedTests.push("submission snapshot selectors ignore withdrawn baselines and keep procurement review comparisons anchored to the latest active prior submission");
    return completedTests;
}
exports.runDepartmentUserPlanSubmissionTests = runDepartmentUserPlanSubmissionTests;
