"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartmentUserStatusLabel = exports.deriveDepartmentUserDisplayStatus = exports.deriveDepartmentUserStatusDetails = exports.selectCanonicalPlans = void 0;
const deadlines_1 = require("../procurement-officer/deadlines");
const submission_1 = require("../plans/submission");
const STATUS_PRIORITY = {
    approved: 3,
    draft: 0,
    rejected: 2,
    submitted: 1,
};
function selectCanonicalPlans(plans) {
    const canonicalPlans = new Map();
    for (const plan of plans) {
        const existingPlan = canonicalPlans.get(plan.fiscalYear);
        if (!existingPlan) {
            canonicalPlans.set(plan.fiscalYear, plan);
            continue;
        }
        const existingRank = getCanonicalPlanRank(existingPlan);
        const candidateRank = getCanonicalPlanRank(plan);
        if (candidateRank > existingRank) {
            canonicalPlans.set(plan.fiscalYear, plan);
            continue;
        }
        if (candidateRank < existingRank) {
            continue;
        }
        const existingTimestamp = Math.max(existingPlan.updatedAt, existingPlan.createdAt);
        const candidateTimestamp = Math.max(plan.updatedAt, plan.createdAt);
        if (candidateTimestamp >= existingTimestamp) {
            canonicalPlans.set(plan.fiscalYear, plan);
        }
    }
    return Array.from(canonicalPlans.values());
}
exports.selectCanonicalPlans = selectCanonicalPlans;
function deriveDepartmentUserStatusDetails(args) {
    if (!args.plan) {
        return {
            canWithdraw: false,
            displayStatus: "no_plan",
            helperText: "No Plan",
            historyState: "partial",
            historySummary: null,
            itemCountLabel: "0 items",
            rejectionComment: null,
            reviewerLabel: null,
            reviewerState: null,
            statusDateLabel: null,
            statusLabel: "No Plan",
            submissionReference: null,
            timeline: [],
        };
    }
    const displayStatus = deriveDepartmentUserDisplayStatus(args.plan);
    const activeSnapshot = (0, submission_1.resolveLatestActivePlanSubmissionSnapshot)((args.plan.submissionSnapshots ?? []).map((snapshot) => ({
        ...snapshot,
        lifecycleStatus: (0, submission_1.normalizePlanSubmissionLifecycleStatus)(snapshot.lifecycleStatus ?? null),
    })));
    const submittedAt = activeSnapshot?.submittedAt ??
        args.plan.submittedAt ??
        null;
    const submissionReference = activeSnapshot?.submissionReference ??
        args.plan.submissionReference ??
        null;
    const approvedAt = args.plan.approvedAt ?? args.plan.lastApprovedAt ?? null;
    const reviewer = args.plan.reviewer ?? null;
    const timeline = buildDepartmentUserTimeline({
        plan: args.plan,
        submittedAt,
        timeZone: args.timeZone,
    });
    const historySummary = shouldShowPartialHistoryNotice({
        displayStatus,
        plan: args.plan,
        submittedAt,
    })
        ? "Some earlier status history is unavailable for this plan."
        : null;
    return {
        canWithdraw: displayStatus === "submitted" &&
            typeof args.plan.reviewStartedAt !== "number",
        displayStatus,
        helperText: buildDepartmentUserStatusHelperText({
            approvedAt,
            displayStatus,
            fiscalYearKey: args.fiscalYearKey,
            itemCount: args.plan.itemCount,
            latestDecision: args.plan.latestDecision ?? null,
            rejectionComment: args.plan.rejectionComment ?? null,
            reviewStartedAt: args.plan.reviewStartedAt ?? null,
            reviewer,
            submissionReference,
            submittedAt,
            timeZone: args.timeZone,
        }),
        historyState: historySummary ? "partial" : "complete",
        historySummary,
        itemCountLabel: `${args.plan.itemCount} ${args.plan.itemCount === 1 ? "item" : "items"}`,
        rejectionComment: args.plan.rejectionComment ?? null,
        reviewerLabel: reviewer?.label ?? null,
        reviewerState: displayStatus === "under_review"
            ? reviewer?.state ?? "unavailable"
            : null,
        statusDateLabel: buildStatusDateLabel({
            approvedAt,
            displayStatus,
            rejectedAt: args.plan.rejectedAt ?? null,
            reviewStartedAt: args.plan.reviewStartedAt ?? null,
            submittedAt,
            timeZone: args.timeZone,
        }),
        statusLabel: getDepartmentUserStatusLabel(displayStatus),
        submissionReference,
        timeline,
    };
}
exports.deriveDepartmentUserStatusDetails = deriveDepartmentUserStatusDetails;
function deriveDepartmentUserDisplayStatus(plan) {
    if (plan.status === "approved" || typeof plan.approvedAt === "number") {
        return "approved";
    }
    if (plan.status === "rejected" &&
        plan.latestDecision?.decisionType === "revision_requested") {
        return "revision_requested";
    }
    if (plan.status === "rejected" || typeof plan.rejectedAt === "number") {
        return "rejected";
    }
    if (plan.status === "submitted" && typeof plan.reviewStartedAt === "number") {
        return "under_review";
    }
    if (plan.status === "submitted") {
        return "submitted";
    }
    return "draft";
}
exports.deriveDepartmentUserDisplayStatus = deriveDepartmentUserDisplayStatus;
function getDepartmentUserStatusLabel(status) {
    switch (status) {
        case "approved":
            return "Approved";
        case "draft":
            return "Draft";
        case "rejected":
            return "Rejected";
        case "revision_requested":
            return "Revision Requested";
        case "submitted":
            return "Submitted";
        case "under_review":
            return "Under Review";
        default:
            return "No Plan";
    }
}
exports.getDepartmentUserStatusLabel = getDepartmentUserStatusLabel;
function getCanonicalPlanRank(plan) {
    const displayStatus = deriveDepartmentUserDisplayStatus(plan);
    if (displayStatus === "under_review") {
        return STATUS_PRIORITY.submitted + 1;
    }
    return STATUS_PRIORITY[plan.status];
}
function buildDepartmentUserTimeline(args) {
    const items = [
        createTimelineItem({
            description: "Plan workspace created.",
            id: `${args.plan.id}:draft-created`,
            timeZone: args.timeZone,
            timestamp: args.plan.createdAt,
            title: "Draft Created",
        }),
    ];
    const sortedSnapshots = [...(args.plan.submissionSnapshots ?? [])].sort((left, right) => {
        const leftTimestamp = left.submittedAt ?? left.capturedAt;
        const rightTimestamp = right.submittedAt ?? right.capturedAt;
        if (leftTimestamp !== rightTimestamp) {
            return leftTimestamp - rightTimestamp;
        }
        const leftSequence = left.submissionSequence ?? Number.MAX_SAFE_INTEGER;
        const rightSequence = right.submissionSequence ?? Number.MAX_SAFE_INTEGER;
        return leftSequence - rightSequence;
    });
    for (const snapshot of sortedSnapshots) {
        if (typeof snapshot.submittedAt === "number") {
            items.push(createTimelineItem({
                description: snapshot.submissionReference?.trim()
                    ? `Submitted as ${snapshot.submissionReference.trim()}.`
                    : "Submitted for Procurement Officer review.",
                id: `${args.plan.id}:submitted:${snapshot.submissionSequence ?? snapshot.capturedAt}`,
                timeZone: args.timeZone,
                timestamp: snapshot.submittedAt,
                title: "Submitted",
            }));
        }
        if (typeof snapshot.withdrawnAt === "number") {
            items.push(createTimelineItem({
                description: "Submission withdrawn back to draft.",
                id: `${args.plan.id}:withdrawn:${snapshot.submissionSequence ?? snapshot.withdrawnAt}`,
                timeZone: args.timeZone,
                timestamp: snapshot.withdrawnAt,
                title: "Withdrawn",
            }));
        }
    }
    if (typeof args.submittedAt === "number" &&
        !items.some((item) => item.title === "Submitted" && item.timestamp === args.submittedAt)) {
        items.push(createTimelineItem({
            description: args.plan.submissionReference?.trim()
                ? `Submitted as ${args.plan.submissionReference.trim()}.`
                : "Submitted for Procurement Officer review.",
            id: `${args.plan.id}:submitted:plan`,
            timeZone: args.timeZone,
            timestamp: args.submittedAt,
            title: "Submitted",
        }));
    }
    if (typeof args.plan.reviewStartedAt === "number") {
        items.push(createTimelineItem({
            description: args.plan.reviewer?.label && args.plan.reviewer.state === "available"
                ? `${args.plan.reviewer.label} started Procurement Officer review.`
                : "Procurement Officer review started.",
            id: `${args.plan.id}:review-started`,
            timeZone: args.timeZone,
            timestamp: args.plan.reviewStartedAt,
            title: "Under Review",
        }));
    }
    const reviewDecisions = args.plan.reviewDecisions?.filter((decision) => decision.lifecycleStatus !== "undone") ?? [];
    if (reviewDecisions.length > 0) {
        for (const decision of reviewDecisions) {
            items.push(createTimelineItem({
                description: decision.comment.trim() ||
                    (decision.decisionType === "approved"
                        ? "Plan approved for this fiscal year."
                        : "Revision feedback recorded."),
                id: `${args.plan.id}:decision:${decision.id}`,
                timeZone: args.timeZone,
                timestamp: decision.decidedAt,
                title: decision.decisionType === "revision_requested"
                    ? "Revision Requested"
                    : decision.decisionType === "rejected"
                        ? "Rejected"
                        : "Approved",
            }));
        }
    }
    else {
        const approvedAt = args.plan.approvedAt ?? args.plan.lastApprovedAt ?? null;
        if (typeof approvedAt === "number") {
            items.push(createTimelineItem({
                description: "Plan approved for this fiscal year.",
                id: `${args.plan.id}:approved`,
                timeZone: args.timeZone,
                timestamp: approvedAt,
                title: "Approved",
            }));
        }
        if (typeof args.plan.rejectedAt === "number") {
            items.push(createTimelineItem({
                description: args.plan.latestDecision?.comment.trim() ||
                    args.plan.rejectionComment?.trim() ||
                    "Revision requested by Procurement Officer.",
                id: `${args.plan.id}:rejected`,
                timeZone: args.timeZone,
                timestamp: args.plan.rejectedAt,
                title: args.plan.latestDecision?.decisionType === "revision_requested"
                    ? "Revision Requested"
                    : "Rejected",
            }));
        }
    }
    return items
        .filter((item, index, collection) => item.timestamp !== null &&
        collection.findIndex((candidate) => candidate.id === item.id) === index)
        .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0));
}
function createTimelineItem(args) {
    return {
        description: args.description,
        id: args.id,
        timestamp: args.timestamp,
        timestampLabel: typeof args.timestamp === "number"
            ? (0, deadlines_1.formatDeadlineDateTime)(args.timestamp, args.timeZone)
            : "Unavailable",
        title: args.title,
    };
}
function buildDepartmentUserStatusHelperText(args) {
    switch (args.displayStatus) {
        case "submitted":
            return [
                args.submissionReference?.trim()
                    ? `Submitted as ${args.submissionReference.trim()}.`
                    : `Submitted for ${args.fiscalYearKey}.`,
                typeof args.submittedAt === "number"
                    ? `Submitted ${(0, deadlines_1.formatDeadlineDateTime)(args.submittedAt, args.timeZone)}.`
                    : "Submission time unavailable.",
                "Waiting for Procurement Officer review.",
            ].join(" ");
        case "under_review":
            return [
                typeof args.reviewStartedAt === "number"
                    ? `Review started ${(0, deadlines_1.formatDeadlineDateTime)(args.reviewStartedAt, args.timeZone)}.`
                    : "Review start time unavailable.",
                args.reviewer?.label && args.reviewer.state === "available"
                    ? `Reviewer: ${args.reviewer.label}.`
                    : "Procurement Officer review in progress.",
                "This plan is read-only while review is in progress.",
            ].join(" ");
        case "approved":
            return [
                typeof args.approvedAt === "number"
                    ? `Approved ${(0, deadlines_1.formatDeadlineDateTime)(args.approvedAt, args.timeZone)}.`
                    : "Approved plan.",
                args.submissionReference?.trim()
                    ? `Reference ${args.submissionReference.trim()}.`
                    : "Submission reference unavailable.",
                `${args.itemCount} ${args.itemCount === 1 ? "item" : "items"} locked for this approved plan.`,
            ].join(" ");
        case "rejected":
            return [
                "Rejected.",
                args.rejectionComment?.trim()
                    ? args.rejectionComment.trim()
                    : "Decision comments unavailable.",
                typeof args.latestDecision?.effectiveRevisionDeadlineAt === "number"
                    ? `Effective revision deadline ${(0, deadlines_1.formatDeadlineDateTime)(args.latestDecision.effectiveRevisionDeadlineAt, args.timeZone)}.`
                    : null,
            ]
                .filter((part) => Boolean(part))
                .join(" ");
        case "revision_requested":
            return [
                "Revision requested.",
                args.latestDecision?.comment.trim() || args.rejectionComment?.trim()
                    ? args.latestDecision?.comment.trim() ?? args.rejectionComment?.trim() ?? ""
                    : "Decision comments unavailable.",
                typeof args.latestDecision?.effectiveRevisionDeadlineAt === "number"
                    ? `Effective revision deadline ${(0, deadlines_1.formatDeadlineDateTime)(args.latestDecision.effectiveRevisionDeadlineAt, args.timeZone)}.`
                    : null,
            ]
                .filter((part) => Boolean(part))
                .join(" ");
        case "draft":
            return `Draft plan for ${args.fiscalYearKey}.`;
        default:
            return "No Plan";
    }
}
function buildStatusDateLabel(args) {
    switch (args.displayStatus) {
        case "submitted":
            return typeof args.submittedAt === "number"
                ? (0, deadlines_1.formatDeadlineDateTime)(args.submittedAt, args.timeZone)
                : "Submitted date unavailable";
        case "under_review":
            return typeof args.reviewStartedAt === "number"
                ? (0, deadlines_1.formatDeadlineDateTime)(args.reviewStartedAt, args.timeZone)
                : "Review start unavailable";
        case "approved":
            return typeof args.approvedAt === "number"
                ? (0, deadlines_1.formatDeadlineDateTime)(args.approvedAt, args.timeZone)
                : "Approval date unavailable";
        case "rejected":
            return typeof args.rejectedAt === "number"
                ? (0, deadlines_1.formatDeadlineDateTime)(args.rejectedAt, args.timeZone)
                : "Decision date unavailable";
        case "revision_requested":
            return typeof args.rejectedAt === "number"
                ? (0, deadlines_1.formatDeadlineDateTime)(args.rejectedAt, args.timeZone)
                : "Decision date unavailable";
        default:
            return null;
    }
}
function shouldShowPartialHistoryNotice(args) {
    switch (args.displayStatus) {
        case "submitted":
            return args.submittedAt === null;
        case "under_review":
            return (args.submittedAt === null ||
                typeof args.plan.reviewStartedAt !== "number");
        case "approved":
            return (args.submittedAt === null ||
                typeof args.plan.reviewStartedAt !== "number" ||
                typeof (args.plan.approvedAt ?? args.plan.lastApprovedAt ?? null) !==
                    "number");
        case "rejected":
        case "revision_requested":
            return (args.submittedAt === null ||
                typeof args.plan.reviewStartedAt !== "number" ||
                typeof args.plan.rejectedAt !== "number");
        default:
            return false;
    }
}
