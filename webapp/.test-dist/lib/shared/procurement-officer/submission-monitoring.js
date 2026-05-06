"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProcurementOfficerMonitoringTimeline = exports.selectCanonicalMonitoringPlan = exports.getProcurementOfficerMonitoringStatusLabel = exports.deriveProcurementOfficerMonitoringStatus = void 0;
const STATUS_PRIORITY = {
    approved: 3,
    draft: 0,
    rejected: 2,
    submitted: 1,
};
function formatTimestamp(timestamp, timeZone) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
        minute: "2-digit",
        month: "short",
        timeZone,
        year: "numeric",
    }).format(new Date(timestamp));
}
function createTimelineItem(args) {
    return {
        description: args.description,
        id: args.id,
        isFallback: typeof args.timestamp !== "number",
        timestamp: args.timestamp,
        timestampLabel: typeof args.timestamp === "number"
            ? formatTimestamp(args.timestamp, args.timeZone)
            : "Unavailable",
        title: args.title,
    };
}
function deriveDisplayStatus(plan) {
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
function getCanonicalPlanRank(plan) {
    const displayStatus = deriveDisplayStatus(plan);
    if (displayStatus === "under_review") {
        return STATUS_PRIORITY.submitted + 1;
    }
    return STATUS_PRIORITY[plan.status];
}
function deriveProcurementOfficerMonitoringStatus(plan) {
    if (!plan) {
        return "not_started";
    }
    if (plan.status === "draft") {
        return "draft";
    }
    const displayStatus = deriveDisplayStatus(plan);
    if (displayStatus === "approved") {
        return "approved";
    }
    if (displayStatus === "rejected" || displayStatus === "revision_requested") {
        return "rejected";
    }
    return "submitted";
}
exports.deriveProcurementOfficerMonitoringStatus = deriveProcurementOfficerMonitoringStatus;
function getProcurementOfficerMonitoringStatusLabel(status) {
    switch (status) {
        case "not_started":
            return "Not Started";
        case "draft":
            return "Draft";
        case "submitted":
            return "Submitted";
        case "rejected":
            return "Rejected";
        default:
            return "Approved";
    }
}
exports.getProcurementOfficerMonitoringStatusLabel = getProcurementOfficerMonitoringStatusLabel;
function selectCanonicalMonitoringPlan(plans, fiscalYear) {
    let canonicalPlan = null;
    for (const plan of plans) {
        if (plan.fiscalYear !== fiscalYear) {
            continue;
        }
        if (!canonicalPlan) {
            canonicalPlan = plan;
            continue;
        }
        const existingRank = getCanonicalPlanRank(canonicalPlan);
        const candidateRank = getCanonicalPlanRank(plan);
        if (candidateRank > existingRank) {
            canonicalPlan = plan;
            continue;
        }
        if (candidateRank < existingRank) {
            continue;
        }
        const existingTimestamp = Math.max(canonicalPlan.updatedAt, canonicalPlan.createdAt);
        const candidateTimestamp = Math.max(plan.updatedAt, plan.createdAt);
        if (candidateTimestamp >= existingTimestamp) {
            canonicalPlan = plan;
        }
    }
    return canonicalPlan;
}
exports.selectCanonicalMonitoringPlan = selectCanonicalMonitoringPlan;
function buildProcurementOfficerMonitoringTimeline(args) {
    if (!args.plan) {
        return [];
    }
    const items = [
        createTimelineItem({
            description: "Plan workspace created.",
            id: `${args.plan.id}:draft-created`,
            timeZone: args.timeZone,
            timestamp: args.plan.createdAt,
            title: "Draft Created",
        }),
    ];
    const snapshots = [...(args.plan.submissionSnapshots ?? [])].sort((left, right) => {
        const leftTimestamp = left.submittedAt ?? left.capturedAt;
        const rightTimestamp = right.submittedAt ?? right.capturedAt;
        if (leftTimestamp !== rightTimestamp) {
            return leftTimestamp - rightTimestamp;
        }
        return ((left.submissionSequence ?? Number.MAX_SAFE_INTEGER) -
            (right.submissionSequence ?? Number.MAX_SAFE_INTEGER));
    });
    if (snapshots.length === 0 && args.plan.status !== "draft") {
        items.push(createTimelineItem({
            description: "Submission snapshot unavailable for this plan.",
            id: `${args.plan.id}:submitted:fallback`,
            timeZone: args.timeZone,
            timestamp: args.plan.submittedAt ?? null,
            title: "Submitted",
        }));
    }
    for (const snapshot of snapshots) {
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
    if (args.plan.status !== "draft") {
        items.push(createTimelineItem({
            description: typeof args.plan.reviewStartedAt === "number"
                ? "Procurement Officer review started."
                : "Review start time unavailable.",
            id: `${args.plan.id}:review-started`,
            timeZone: args.timeZone,
            timestamp: args.plan.reviewStartedAt ?? null,
            title: "Under Review",
        }));
    }
    const decisions = (args.plan.reviewDecisions ?? []).filter((decision) => decision.lifecycleStatus !== "undone");
    if (decisions.length > 0) {
        for (const decision of decisions) {
            items.push(createTimelineItem({
                description: decision.comment.trim() ||
                    (decision.decisionType === "approved"
                        ? "Plan approved for this fiscal year."
                        : "Review decision recorded."),
                id: `${args.plan.id}:decision:${decision.id}`,
                timeZone: args.timeZone,
                timestamp: decision.decidedAt,
                title: decision.decisionType === "approved"
                    ? "Approved"
                    : decision.decisionType === "revision_requested"
                        ? "Revision Requested"
                        : "Rejected",
            }));
        }
    }
    else if (args.plan.status === "approved" || args.plan.status === "rejected") {
        items.push(createTimelineItem({
            description: args.plan.status === "approved"
                ? "Plan approved for this fiscal year."
                : args.plan.rejectionComment?.trim() || "Review decision recorded.",
            id: `${args.plan.id}:terminal`,
            timeZone: args.timeZone,
            timestamp: args.plan.status === "approved"
                ? args.plan.approvedAt ?? args.plan.lastApprovedAt ?? null
                : args.plan.rejectedAt ?? null,
            title: args.plan.status === "approved" ? "Approved" : "Rejected",
        }));
    }
    return items
        .filter((item, index, collection) => collection.findIndex((candidate) => candidate.id === item.id) === index)
        .sort((left, right) => {
        const leftValue = left.timestamp ?? Number.MAX_SAFE_INTEGER;
        const rightValue = right.timestamp ?? Number.MAX_SAFE_INTEGER;
        if (leftValue !== rightValue) {
            return leftValue - rightValue;
        }
        return left.id.localeCompare(right.id);
    });
}
exports.buildProcurementOfficerMonitoringTimeline = buildProcurementOfficerMonitoringTimeline;
