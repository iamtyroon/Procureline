import type {
    DepartmentUserBudgetMeterState,
    DepartmentUserWorkspaceSummary,
} from "@/lib/blockly/du-workspace-calculations";
import type { DepartmentUserWorkspaceSaveIndicatorState } from "@/lib/blockly/workspace-draft-queue";
import type { DepartmentUserWorkspaceValidationState } from "@/lib/blockly/workspace-validation";

export type DepartmentUserPlanSubmissionIssueCode =
    | "budget_blocked"
    | "deadline_closed"
    | "deadline_not_open"
    | "empty_plan"
    | "pending_catalog_requests"
    | "revision_flagged_target"
    | "revision_state_unavailable"
    | "validation_unavailable"
    | DepartmentUserWorkspaceValidationState["issues"][number]["code"];

export interface DepartmentUserPlanSubmissionFixTarget {
    id: string;
    label: string;
    type:
        | "budget_summary"
        | "deadline_summary"
        | "pending_requests"
        | "workspace_block"
        | "workspace_category"
        | "workspace_summary";
}

export interface DepartmentUserPlanSubmissionIssue {
    blocksSubmission: boolean;
    categoryId?: string | null;
    categoryName?: string | null;
    code: DepartmentUserPlanSubmissionIssueCode;
    fixTarget?: DepartmentUserPlanSubmissionFixTarget | null;
    itemId?: string | null;
    itemName?: string | null;
    message: string;
    severity: "error" | "warning";
}

export interface DepartmentUserPlanSubmissionCategorySummary {
    categoryId: string;
    categoryName: string;
    estimatedBudgetUsed: number;
    itemCount: number;
}

export interface DepartmentUserPlanSubmissionReviewSummary {
    blockerMessages: string[];
    categories: DepartmentUserPlanSubmissionCategorySummary[];
    estimatedBudgetUsed: number;
    issues: DepartmentUserPlanSubmissionIssue[];
    itemCount: number;
    validationSummary: {
        budgetStatus: string;
        pendingRequestStatus: string;
        validationStatus: "blocked" | "passed";
    };
}

export interface DepartmentUserPlanSubmitState {
    disabled: boolean;
    label: string;
    reason: string;
}

export function canDepartmentUserOpenPlanSubmissionReview(
    status: "approved" | "draft" | "rejected" | "submitted",
): boolean {
    return status === "draft" || status === "rejected";
}

export function shouldReplayDepartmentUserSubmittedPlan(args: {
    status: "approved" | "draft" | "rejected" | "submitted";
    submittedAt?: number | null;
    submissionReference?: string | null;
}): boolean {
    return (
        args.status === "submitted" &&
        typeof args.submittedAt === "number" &&
        Boolean(args.submissionReference?.trim())
    );
}

function normalizeSubmissionBlockerMessages(args: {
    supplementalBlockerMessages?: readonly string[] | null;
    totalItemCount: number;
    validationState?: DepartmentUserWorkspaceValidationState | null;
}): string[] {
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

    return Array.from(
        new Set(blockers.map((message) => message.trim()).filter((message) => message.length > 0)),
    );
}

function dedupeSubmissionIssues(
    issues: readonly DepartmentUserPlanSubmissionIssue[],
): DepartmentUserPlanSubmissionIssue[] {
    const issueMap = new Map<string, DepartmentUserPlanSubmissionIssue>();

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

function buildSubmissionIssues(args: {
    supplementalIssues?: readonly DepartmentUserPlanSubmissionIssue[] | null;
    summary: DepartmentUserWorkspaceSummary | null | undefined;
}): DepartmentUserPlanSubmissionIssue[] {
    const validationState = args.summary?.validationState ?? null;
    const totalItemCount = args.summary?.totalItemCount ?? 0;
    const issues: DepartmentUserPlanSubmissionIssue[] = [
        ...(totalItemCount <= 0
            ? [
                  {
                      blocksSubmission: true,
                      code: "empty_plan" as const,
                      fixTarget: {
                          id: "workspace-summary",
                          label: "Workspace summary",
                          type: "workspace_summary" as const,
                      },
                      message: "Plan must have at least 1 item",
                      severity: "error" as const,
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
                      code: "validation_unavailable" as const,
                      fixTarget: {
                          id: "workspace-summary",
                          label: "Workspace summary",
                          type: "workspace_summary" as const,
                      },
                      message: validationState.validationUnavailableReason,
                      severity: "error" as const,
                  },
              ]
            : []),
        ...(args.summary?.budgetState.canSubmitByBudget === false
            ? [
                  {
                      blocksSubmission: true,
                      code: "budget_blocked" as const,
                      fixTarget: {
                          id: "budget-meter",
                          label: "Budget summary",
                          type: "budget_summary" as const,
                      },
                      message:
                          args.summary.budgetState.bannerText ??
                          "Budget allocation is unavailable, so submission must remain blocked.",
                      severity: "error" as const,
                  },
              ]
            : []),
        ...(args.supplementalIssues ?? []),
    ];

    return dedupeSubmissionIssues(issues);
}

export function buildDepartmentUserPlanSubmissionReviewSummary(
    summary: DepartmentUserWorkspaceSummary | null | undefined,
    options?: {
        supplementalBlockerMessages?: readonly string[] | null;
        supplementalIssues?: readonly DepartmentUserPlanSubmissionIssue[] | null;
    },
): DepartmentUserPlanSubmissionReviewSummary {
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
        categories:
            summary?.categories.map((category) => ({
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
            pendingRequestStatus:
                options?.supplementalIssues?.some(
                    (issue) => issue.code === "pending_catalog_requests",
                ) ?? false
                    ? "Pending catalog requests require PO decision"
                    : "No pending catalog requests",
            validationStatus: issues.some((issue) => issue.blocksSubmission)
                ? "blocked"
                : "passed",
        },
    };
}

export function getDepartmentUserPlanSubmitState(args: {
    budgetState: DepartmentUserBudgetMeterState;
    hasUnsyncedChanges: boolean;
    mode: "edit" | "view";
    saveState: DepartmentUserWorkspaceSaveIndicatorState;
    supplementalBlockerMessages?: readonly string[] | null;
    totalItemCount: number;
    validationState?: DepartmentUserWorkspaceValidationState | null;
}): DepartmentUserPlanSubmitState {
    if (args.mode === "view") {
        return {
            disabled: true,
            label: "Read-only - Cannot Submit",
            reason:
                "This plan is open in read-only mode, so submission stays unavailable here.",
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
            reason:
                "Save this Blockly draft to cloud first so submission reflects the latest workspace state.",
        };
    }

    if (args.saveState === "blocked" || args.saveState === "error") {
        return {
            disabled: true,
            label: "Cloud Save Required",
            reason:
                "Cloud save is blocked right now. Resolve the local draft sync issue before submitting.",
        };
    }

    if (args.budgetState.state === "over_budget") {
        return {
            disabled: true,
            label: "Over Budget - Cannot Submit",
            reason:
                args.budgetState.bannerText ??
                "Budget exceeded. Remove items or reduce quantities before submission can unlock.",
        };
    }

    if (args.budgetState.state === "unallocated") {
        return {
            disabled: true,
            label: "No Budget - Cannot Submit",
            reason:
                "Budget allocation is unavailable, so submission must remain blocked.",
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
            label:
                args.totalItemCount <= 0
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
