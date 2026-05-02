"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDepartmentUserRevisionHistory = exports.mapDepartmentUserFlaggedTargetsToIssues = void 0;
const deadlines_1 = require("@/lib/procurement-officer/deadlines");
function mapDepartmentUserFlaggedTargetsToIssues(args) {
    const workspaceCategories = args.workspaceSummary?.categories ?? [];
    return args.flaggedTargets.map((target) => {
        const matchingCategory = workspaceCategories.find((category) => category.categoryId === target.categoryId);
        const matchingItem = target.itemId === null
            ? null
            : matchingCategory?.items.find((item) => item.itemId === target.itemId) ??
                null;
        const fixTarget = target.type === "item" && matchingItem?.blockId
            ? {
                id: matchingItem.blockId,
                label: matchingItem.itemName || target.label,
                type: "workspace_block",
            }
            : matchingCategory
                ? {
                    id: matchingCategory.categoryId,
                    label: matchingCategory.categoryName,
                    type: "workspace_category",
                }
                : {
                    id: target.id,
                    label: target.label,
                    type: "workspace_summary",
                };
        return {
            blocksSubmission: true,
            categoryId: target.categoryId,
            categoryName: matchingCategory?.categoryName ?? null,
            code: matchingCategory || matchingItem
                ? "revision_flagged_target"
                : "revision_state_unavailable",
            fixTarget,
            itemId: target.itemId,
            itemName: matchingItem?.itemName ?? target.label,
            message: target.type === "item"
                ? matchingItem
                    ? `Procurement flagged ${matchingItem.itemName || target.label} for revision before resubmission.`
                    : `Previously flagged item is unavailable: ${target.label}. Review this feedback before resubmitting.`
                : matchingCategory
                    ? `Procurement flagged ${matchingCategory.categoryName} for revision before resubmission.`
                    : `Previously flagged category is unavailable: ${target.label}. Review this feedback before resubmitting.`,
            severity: "error",
        };
    });
}
exports.mapDepartmentUserFlaggedTargetsToIssues = mapDepartmentUserFlaggedTargetsToIssues;
function buildDepartmentUserRevisionHistory(args) {
    const entries = [];
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
                timestampLabel: (0, deadlines_1.formatDeadlineDateTime)(snapshot.submittedAt, args.timeZone),
                title: "Submitted",
            });
        }
        if (typeof snapshot.withdrawnAt === "number") {
            entries.push({
                detail: "Submission withdrawn back to draft.",
                id: `withdrawn:${snapshot.submissionSequence ?? snapshot.withdrawnAt}`,
                kind: "withdrawn",
                timestamp: snapshot.withdrawnAt,
                timestampLabel: (0, deadlines_1.formatDeadlineDateTime)(snapshot.withdrawnAt, args.timeZone),
                title: "Withdrawn",
            });
        }
        if (typeof snapshot.submittedAt !== "number" &&
            typeof snapshot.withdrawnAt !== "number") {
            entries.push({
                detail: snapshot.submissionReference?.trim()
                    ? `Historical submission metadata is available for ${snapshot.submissionReference.trim()}, but the full submission timestamp is unavailable.`
                    : "Historical submission metadata is available, but the full submission timestamp is unavailable.",
                id: `submission-metadata:${snapshot.submissionSequence ?? snapshot.capturedAt}`,
                kind: "submitted",
                timestamp: snapshot.capturedAt,
                timestampLabel: (0, deadlines_1.formatDeadlineDateTime)(snapshot.capturedAt, args.timeZone),
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
            timestampLabel: (0, deadlines_1.formatDeadlineDateTime)(decision.decidedAt, args.timeZone),
            title: decision.decisionType === "revision_requested"
                ? "Revision Requested"
                : decision.decisionType === "rejected"
                    ? "Rejected"
                    : "Approved",
        });
    }
    return entries.sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0));
}
exports.buildDepartmentUserRevisionHistory = buildDepartmentUserRevisionHistory;
