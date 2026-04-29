"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartmentUserPlanSubmitState = exports.buildDepartmentUserPlanSubmissionReviewSummary = exports.shouldReplayDepartmentUserSubmittedPlan = exports.canDepartmentUserOpenPlanSubmissionReview = void 0;
function canDepartmentUserOpenPlanSubmissionReview(status) {
    return status === "draft" || status === "rejected";
}
exports.canDepartmentUserOpenPlanSubmissionReview = canDepartmentUserOpenPlanSubmissionReview;
function shouldReplayDepartmentUserSubmittedPlan(args) {
    return (args.status === "submitted" &&
        typeof args.submittedAt === "number" &&
        Boolean(args.submissionReference?.trim()));
}
exports.shouldReplayDepartmentUserSubmittedPlan = shouldReplayDepartmentUserSubmittedPlan;
function normalizeSubmissionBlockerMessages(args) {
    const blockers = [
        ...(args.totalItemCount <= 0
            ? ["Add at least one actionable item before submitting this plan."]
            : []),
        ...(args.validationState?.submitBlockedReasons ?? []),
        ...(args.validationState?.validationUnavailableReason
            ? [args.validationState.validationUnavailableReason]
            : []),
        ...(args.supplementalBlockerMessages ?? []),
    ];
    return Array.from(new Set(blockers.map((message) => message.trim()).filter((message) => message.length > 0)));
}
function dedupeSubmissionIssues(issues) {
    const issueMap = new Map();
    for (const issue of issues) {
        const key = [
            issue.code,
            issue.itemId ?? issue.itemName ?? "",
            issue.categoryId ?? "",
            issue.message,
        ].join("::");
        if (!issueMap.has(key)) {
            issueMap.set(key, issue);
        }
    }
    return Array.from(issueMap.values());
}
function buildSubmissionIssues(args) {
    const validationState = args.summary?.validationState ?? null;
    const totalItemCount = args.summary?.totalItemCount ?? 0;
    const issues = [
        ...(totalItemCount <= 0
            ? [
                {
                    blocksSubmission: true,
                    code: "empty_plan",
                    fixTarget: {
                        id: "workspace-summary",
                        label: "Workspace summary",
                        type: "workspace_summary",
                    },
                    message: "Plan must have at least 1 item",
                    severity: "error",
                },
            ]
            : []),
        ...(validationState?.issues.map((issue) => ({
            blocksSubmission: issue.blocksSubmission,
            categoryId: issue.categoryId,
            categoryName: issue.categoryName ?? null,
            code: issue.code,
            fixTarget: issue.fixTarget ?? null,
            itemId: issue.itemId,
            itemName: issue.itemName,
            message: issue.message,
            severity: issue.severity,
        })) ?? []),
        ...(validationState?.validationUnavailableReason
            ? [
                {
                    blocksSubmission: true,
                    code: "validation_unavailable",
                    fixTarget: {
                        id: "workspace-summary",
                        label: "Workspace summary",
                        type: "workspace_summary",
                    },
                    message: validationState.validationUnavailableReason,
                    severity: "error",
                },
            ]
            : []),
        ...(args.summary?.budgetState.canSubmitByBudget === false
            ? [
                {
                    blocksSubmission: true,
                    code: "budget_blocked",
                    fixTarget: {
                        id: "budget-meter",
                        label: "Budget summary",
                        type: "budget_summary",
                    },
                    message: args.summary.budgetState.bannerText ??
                        "Budget allocation is unavailable, so submission must remain blocked.",
                    severity: "error",
                },
            ]
            : []),
        ...(args.supplementalIssues ?? []),
    ];
    return dedupeSubmissionIssues(issues);
}
function buildDepartmentUserPlanSubmissionReviewSummary(summary, options) {
    const issues = buildSubmissionIssues({
        supplementalIssues: options?.supplementalIssues ?? null,
        summary,
    });
    return {
        blockerMessages: normalizeSubmissionBlockerMessages({
            supplementalBlockerMessages: options?.supplementalBlockerMessages ?? null,
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
        issues,
        itemCount: summary?.totalItemCount ?? 0,
        validationSummary: {
            budgetStatus: summary?.budgetState.statusLabel ?? "Budget unavailable",
            pendingRequestStatus: options?.supplementalIssues?.some((issue) => issue.code === "pending_catalog_requests") ?? false
                ? "Pending catalog requests require PO decision"
                : "No pending catalog requests",
            validationStatus: issues.some((issue) => issue.blocksSubmission)
                ? "blocked"
                : "passed",
        },
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
        supplementalBlockerMessages: args.supplementalBlockerMessages ?? null,
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
