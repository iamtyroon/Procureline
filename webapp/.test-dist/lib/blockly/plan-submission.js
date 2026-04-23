"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartmentUserPlanSubmitState = exports.buildDepartmentUserPlanSubmissionReviewSummary = exports.canDepartmentUserOpenPlanSubmissionReview = void 0;
function canDepartmentUserOpenPlanSubmissionReview(status) {
    return status === "draft";
}
exports.canDepartmentUserOpenPlanSubmissionReview = canDepartmentUserOpenPlanSubmissionReview;
function normalizeSubmissionBlockerMessages(args) {
    const blockers = [
        ...(args.totalItemCount <= 0
            ? ["Add at least one actionable item before submitting this plan."]
            : []),
        ...(args.validationState?.submitBlockedReasons ?? []),
        ...(args.validationState?.validationUnavailableReason
            ? [args.validationState.validationUnavailableReason]
            : []),
    ];
    return Array.from(new Set(blockers.map((message) => message.trim()).filter((message) => message.length > 0)));
}
function buildDepartmentUserPlanSubmissionReviewSummary(summary) {
    return {
        blockerMessages: normalizeSubmissionBlockerMessages({
            totalItemCount: summary?.totalItemCount ?? 0,
            validationState: summary?.validationState ?? null,
        }),
        categories: summary?.categories.map((category) => ({
            categoryId: category.categoryId,
            categoryName: category.categoryName,
            estimatedBudgetUsed: category.totalCost,
            itemCount: category.itemCount,
        })) ?? [],
        estimatedBudgetUsed: summary?.departmentTotal ?? 0,
        itemCount: summary?.totalItemCount ?? 0,
    };
}
exports.buildDepartmentUserPlanSubmissionReviewSummary = buildDepartmentUserPlanSubmissionReviewSummary;
function getDepartmentUserPlanSubmitState(args) {
    if (args.mode === "view") {
        return {
            disabled: true,
            label: "Read-only - Cannot Submit",
            reason: "This plan is open in read-only mode, so submission stays unavailable here.",
        };
    }
    if (args.saveState === "saving") {
        return {
            disabled: true,
            label: "Saving Draft...",
            reason: "Wait for the latest cloud save to finish before submitting.",
        };
    }
    if (args.hasUnsyncedChanges || args.saveState === "queued") {
        return {
            disabled: true,
            label: "Save Draft Before Submit",
            reason: "Save this Blockly draft to cloud first so submission reflects the latest workspace state.",
        };
    }
    if (args.saveState === "blocked" || args.saveState === "error") {
        return {
            disabled: true,
            label: "Cloud Save Required",
            reason: "Cloud save is blocked right now. Resolve the local draft sync issue before submitting.",
        };
    }
    if (args.budgetState.state === "over_budget") {
        return {
            disabled: true,
            label: "Over Budget - Cannot Submit",
            reason: args.budgetState.bannerText ??
                "Budget exceeded. Remove items or reduce quantities before submission can unlock.",
        };
    }
    if (args.budgetState.state === "unallocated") {
        return {
            disabled: true,
            label: "No Budget - Cannot Submit",
            reason: "Budget allocation is unavailable, so submission must remain blocked.",
        };
    }
    const blockerMessages = normalizeSubmissionBlockerMessages({
        totalItemCount: args.totalItemCount,
        validationState: args.validationState ?? null,
    });
    if (blockerMessages.length > 0) {
        return {
            disabled: true,
            label: args.totalItemCount <= 0
                ? "Add Items Before Submit"
                : "Fix Validation Issues",
            reason: blockerMessages.join(" "),
        };
    }
    return {
        disabled: false,
        label: "Review & Submit",
        reason: "Review the current plan summary, then confirm submission to Procurement.",
    };
}
exports.getDepartmentUserPlanSubmitState = getDepartmentUserPlanSubmitState;
