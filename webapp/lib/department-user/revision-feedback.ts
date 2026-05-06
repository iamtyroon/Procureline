import type { DepartmentUserPlanSubmissionIssue } from "@/lib/shared/blockly/plan-submission";
import type { DepartmentUserWorkspaceSummary } from "@/lib/shared/blockly/du-workspace-calculations";
import { formatDeadlineDateTime } from "@/lib/procurement-officer/deadlines";

export interface DepartmentUserRevisionDecisionRecord {
    comment: string;
    decidedAt: number;
    decisionType: "approved" | "rejected" | "revision_requested";
    effectiveRevisionDeadlineAt?: number | null;
    flaggedTargets: readonly DepartmentUserRevisionFlaggedTarget[];
    id: string;
    lifecycleStatus?: "active" | "superseded" | "undone" | null;
    revisionDeadlineAt?: number | null;
    submissionReference?: string | null;
}

export interface DepartmentUserRevisionFlaggedTarget {
    categoryId: string;
    id: string;
    itemId: string | null;
    label: string;
    type: "category" | "item";
}

export interface DepartmentUserRevisionHistoryEntry {
    detail: string;
    id: string;
    kind:
        | "approved"
        | "rejected"
        | "revision_requested"
        | "submitted"
        | "withdrawn";
    timestamp: number | null;
    timestampLabel: string;
    title: string;
}

export interface DepartmentUserSubmissionSnapshotHistoryRecord {
    capturedAt: number;
    lifecycleStatus?: string | null;
    submissionReference?: string | null;
    submissionSequence?: number | null;
    submittedAt: number | null;
    withdrawnAt?: number | null;
}

export function mapDepartmentUserFlaggedTargetsToIssues(args: {
    flaggedTargets: readonly DepartmentUserRevisionFlaggedTarget[];
    workspaceSummary: DepartmentUserWorkspaceSummary | null | undefined;
}): DepartmentUserPlanSubmissionIssue[] {
    const workspaceCategories = args.workspaceSummary?.categories ?? [];

    return args.flaggedTargets.map((target) => {
        const matchingCategory = workspaceCategories.find(
            (category) => category.categoryId === target.categoryId,
        );
        const matchingItem =
            target.itemId === null
                ? null
                : matchingCategory?.items.find((item) => item.itemId === target.itemId) ??
                  null;
        const fixTarget =
            target.type === "item" && matchingItem?.blockId
                ? {
                      id: matchingItem.blockId,
                      label: matchingItem.itemName || target.label,
                      type: "workspace_block" as const,
                  }
                : matchingCategory
                  ? {
                        id: matchingCategory.categoryId,
                        label: matchingCategory.categoryName,
                        type: "workspace_category" as const,
                    }
                  : {
                        id: target.id,
                        label: target.label,
                        type: "workspace_summary" as const,
                    };

        return {
            blocksSubmission: true,
            categoryId: target.categoryId,
            categoryName: matchingCategory?.categoryName ?? null,
            code:
                matchingCategory || matchingItem
                    ? ("revision_flagged_target" as const)
                    : ("revision_state_unavailable" as const),
            fixTarget,
            itemId: target.itemId,
            itemName: matchingItem?.itemName ?? target.label,
            message:
                target.type === "item"
                    ? matchingItem
                        ? `Procurement flagged ${matchingItem.itemName || target.label} for revision before resubmission.`
                        : `Previously flagged item is unavailable: ${target.label}. Review this feedback before resubmitting.`
                    : matchingCategory
                      ? `Procurement flagged ${matchingCategory.categoryName} for revision before resubmission.`
                      : `Previously flagged category is unavailable: ${target.label}. Review this feedback before resubmitting.`,
            severity: "error" as const,
        };
    });
}

export function buildDepartmentUserRevisionHistory(args: {
    decisions: readonly DepartmentUserRevisionDecisionRecord[];
    snapshots: readonly DepartmentUserSubmissionSnapshotHistoryRecord[];
    timeZone: string;
}): DepartmentUserRevisionHistoryEntry[] {
    const entries: DepartmentUserRevisionHistoryEntry[] = [];

    const sortedSnapshots = [...args.snapshots].sort((left, right) => {
        const leftTimestamp = left.submittedAt ?? left.capturedAt;
        const rightTimestamp = right.submittedAt ?? right.capturedAt;
        if (leftTimestamp !== rightTimestamp) {
            return leftTimestamp - rightTimestamp;
        }
        return (left.submissionSequence ?? Number.MAX_SAFE_INTEGER) - (right.submissionSequence ?? Number.MAX_SAFE_INTEGER);
    });

    for (const snapshot of sortedSnapshots) {
        if (typeof snapshot.submittedAt === "number") {
            entries.push({
                detail: snapshot.submissionReference?.trim()
                    ? `Submitted as ${snapshot.submissionReference.trim()}.`
                    : "Submitted to Procurement for review.",
                id: `submission:${snapshot.submissionSequence ?? snapshot.submittedAt}`,
                kind: "submitted",
                timestamp: snapshot.submittedAt,
                timestampLabel: formatDeadlineDateTime(
                    snapshot.submittedAt,
                    args.timeZone,
                ),
                title: "Submitted",
            });
        }
        if (typeof snapshot.withdrawnAt === "number") {
            entries.push({
                detail: "Submission withdrawn back to draft.",
                id: `withdrawn:${snapshot.submissionSequence ?? snapshot.withdrawnAt}`,
                kind: "withdrawn",
                timestamp: snapshot.withdrawnAt,
                timestampLabel: formatDeadlineDateTime(
                    snapshot.withdrawnAt,
                    args.timeZone,
                ),
                title: "Withdrawn",
            });
        }
        if (
            typeof snapshot.submittedAt !== "number" &&
            typeof snapshot.withdrawnAt !== "number"
        ) {
            entries.push({
                detail: snapshot.submissionReference?.trim()
                    ? `Historical submission metadata is available for ${snapshot.submissionReference.trim()}, but the full submission timestamp is unavailable.`
                    : "Historical submission metadata is available, but the full submission timestamp is unavailable.",
                id: `submission-metadata:${snapshot.submissionSequence ?? snapshot.capturedAt}`,
                kind: "submitted",
                timestamp: snapshot.capturedAt,
                timestampLabel: formatDeadlineDateTime(
                    snapshot.capturedAt,
                    args.timeZone,
                ),
                title: "Submission Metadata",
            });
        }
    }

    for (const decision of [...args.decisions].sort((left, right) => left.decidedAt - right.decidedAt)) {
        if (decision.lifecycleStatus === "undone") {
            continue;
        }
        entries.push({
            detail: decision.comment.trim().length > 0
                ? decision.comment.trim()
                : decision.decisionType === "approved"
                  ? "Plan approved."
                  : "Revision feedback recorded.",
            id: `decision:${decision.id}`,
            kind: decision.decisionType,
            timestamp: decision.decidedAt,
            timestampLabel: formatDeadlineDateTime(
                decision.decidedAt,
                args.timeZone,
            ),
            title:
                decision.decisionType === "revision_requested"
                    ? "Revision Requested"
                    : decision.decisionType === "rejected"
                      ? "Rejected"
                      : "Approved",
        });
    }

    return entries.sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0));
}
