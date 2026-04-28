import { formatDeadlineDateTime } from "../procurement-officer/deadlines";
import {
    normalizePlanSubmissionLifecycleStatus,
    resolveLatestActivePlanSubmissionSnapshot,
    type PlanSubmissionLifecycleStatus,
} from "../plans/submission";

export type DepartmentUserDisplayStatus =
    | "approved"
    | "draft"
    | "no_plan"
    | "rejected"
    | "submitted"
    | "under_review";

export interface DepartmentUserReviewerSummary {
    label: string | null;
    state: "available" | "unavailable";
}

export interface DepartmentUserTimelineItem {
    description: string;
    id: string;
    timestamp: number | null;
    timestampLabel: string;
    title: string;
}

export interface DepartmentUserPlanSubmissionSnapshotRecord {
    capturedAt: number;
    lifecycleStatus?: PlanSubmissionLifecycleStatus | null;
    submissionReference?: string | null;
    submissionSequence?: number | null;
    submittedAt: number | null;
    withdrawnAt?: number | null;
}

export interface DepartmentUserStatusTrackingPlanLike {
    approvedAt?: number | null;
    categorySummaries?: readonly {
        amount: number;
        categoryId: string;
        categoryName: string;
        itemCount: number;
    }[];
    createdAt: number;
    estimatedBudgetUsed?: number;
    fiscalYear: string;
    id: string;
    itemCount: number;
    lastApprovedAt?: number | null;
    pendingRedraftRequest?: {
        id: string;
        reason: string;
        requestedAt: number;
    } | null;
    rejectionComment?: string | null;
    rejectedAt?: number | null;
    reviewStartedAt?: number | null;
    reviewer?: DepartmentUserReviewerSummary | null;
    selectedCategoryIds?: readonly string[];
    status: "approved" | "draft" | "rejected" | "submitted";
    submissionReference?: string | null;
    submissionSnapshots?: readonly DepartmentUserPlanSubmissionSnapshotRecord[];
    submittedAt?: number | null;
    updatedAt: number;
}

export interface DepartmentUserDerivedStatusDetails {
    canWithdraw: boolean;
    displayStatus: DepartmentUserDisplayStatus;
    helperText: string;
    historyState: "complete" | "partial";
    historySummary: string | null;
    itemCountLabel: string;
    rejectionComment: string | null;
    reviewerLabel: string | null;
    reviewerState: "available" | "unavailable" | null;
    statusDateLabel: string | null;
    statusLabel: "Approved" | "Draft" | "No Plan" | "Rejected" | "Submitted" | "Under Review";
    submissionReference: string | null;
    timeline: DepartmentUserTimelineItem[];
}

const STATUS_PRIORITY: Record<
    DepartmentUserStatusTrackingPlanLike["status"],
    number
> = {
    approved: 3,
    draft: 0,
    rejected: 2,
    submitted: 1,
};

export function selectCanonicalPlans<TPlan extends DepartmentUserStatusTrackingPlanLike>(
    plans: readonly TPlan[],
): TPlan[] {
    const canonicalPlans = new Map<string, TPlan>();

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

export function deriveDepartmentUserStatusDetails(args: {
    fiscalYearKey: string;
    plan: DepartmentUserStatusTrackingPlanLike | null;
    timeZone: string;
}): DepartmentUserDerivedStatusDetails {
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
    const activeSnapshot = resolveLatestActivePlanSubmissionSnapshot(
        (args.plan.submissionSnapshots ?? []).map((snapshot) => ({
            ...snapshot,
            lifecycleStatus: normalizePlanSubmissionLifecycleStatus(
                snapshot.lifecycleStatus ?? null,
            ),
        })),
    );
    const submittedAt =
        activeSnapshot?.submittedAt ??
        args.plan.submittedAt ??
        null;
    const submissionReference =
        activeSnapshot?.submissionReference ??
        args.plan.submissionReference ??
        null;
    const approvedAt = args.plan.approvedAt ?? args.plan.lastApprovedAt ?? null;
    const reviewer = args.plan.reviewer ?? null;
    const timeline = buildDepartmentUserTimeline({
        plan: args.plan,
        submittedAt,
        timeZone: args.timeZone,
    });
    const historySummary =
        shouldShowPartialHistoryNotice({
            displayStatus,
            plan: args.plan,
            submittedAt,
        })
            ? "Some earlier status history is unavailable for this plan."
            : null;

    return {
        canWithdraw:
            displayStatus === "submitted" &&
            typeof args.plan.reviewStartedAt !== "number",
        displayStatus,
        helperText: buildDepartmentUserStatusHelperText({
            approvedAt,
            displayStatus,
            fiscalYearKey: args.fiscalYearKey,
            itemCount: args.plan.itemCount,
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
        reviewerState:
            displayStatus === "under_review"
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

export function deriveDepartmentUserDisplayStatus(
    plan: Pick<
        DepartmentUserStatusTrackingPlanLike,
        "approvedAt" | "rejectedAt" | "reviewStartedAt" | "status"
    >,
): DepartmentUserDisplayStatus {
    if (plan.status === "approved" || typeof plan.approvedAt === "number") {
        return "approved";
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
    if (plan.status === "draft") {
        return "draft";
    }
    return "no_plan";
}

export function getDepartmentUserStatusLabel(
    status: DepartmentUserDisplayStatus,
): DepartmentUserDerivedStatusDetails["statusLabel"] {
    switch (status) {
        case "approved":
            return "Approved";
        case "draft":
            return "Draft";
        case "rejected":
            return "Rejected";
        case "submitted":
            return "Submitted";
        case "under_review":
            return "Under Review";
        default:
            return "No Plan";
    }
}

function getCanonicalPlanRank(
    plan: DepartmentUserStatusTrackingPlanLike,
): number {
    const displayStatus = deriveDepartmentUserDisplayStatus(plan);
    if (displayStatus === "under_review") {
        return STATUS_PRIORITY.submitted + 1;
    }

    return STATUS_PRIORITY[plan.status];
}

function buildDepartmentUserTimeline(args: {
    plan: DepartmentUserStatusTrackingPlanLike;
    submittedAt: number | null;
    timeZone: string;
}): DepartmentUserTimelineItem[] {
    const items: DepartmentUserTimelineItem[] = [
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
            items.push(
                createTimelineItem({
                    description:
                        snapshot.submissionReference?.trim()
                            ? `Submitted as ${snapshot.submissionReference.trim()}.`
                            : "Submitted for Procurement Officer review.",
                    id: `${args.plan.id}:submitted:${snapshot.submissionSequence ?? snapshot.capturedAt}`,
                    timeZone: args.timeZone,
                    timestamp: snapshot.submittedAt,
                    title: "Submitted",
                }),
            );
        }

        if (typeof snapshot.withdrawnAt === "number") {
            items.push(
                createTimelineItem({
                    description: "Submission withdrawn back to draft.",
                    id: `${args.plan.id}:withdrawn:${snapshot.submissionSequence ?? snapshot.withdrawnAt}`,
                    timeZone: args.timeZone,
                    timestamp: snapshot.withdrawnAt,
                    title: "Withdrawn",
                }),
            );
        }
    }

    if (
        typeof args.submittedAt === "number" &&
        !items.some((item) => item.title === "Submitted" && item.timestamp === args.submittedAt)
    ) {
        items.push(
            createTimelineItem({
                description:
                    args.plan.submissionReference?.trim()
                        ? `Submitted as ${args.plan.submissionReference.trim()}.`
                        : "Submitted for Procurement Officer review.",
                id: `${args.plan.id}:submitted:plan`,
                timeZone: args.timeZone,
                timestamp: args.submittedAt,
                title: "Submitted",
            }),
        );
    }

    if (typeof args.plan.reviewStartedAt === "number") {
        items.push(
            createTimelineItem({
                description:
                    args.plan.reviewer?.label && args.plan.reviewer.state === "available"
                        ? `${args.plan.reviewer.label} started Procurement Officer review.`
                        : "Procurement Officer review started.",
                id: `${args.plan.id}:review-started`,
                timeZone: args.timeZone,
                timestamp: args.plan.reviewStartedAt,
                title: "Under Review",
            }),
        );
    }

    const approvedAt = args.plan.approvedAt ?? args.plan.lastApprovedAt ?? null;
    if (typeof approvedAt === "number") {
        items.push(
            createTimelineItem({
                description: "Plan approved for this fiscal year.",
                id: `${args.plan.id}:approved`,
                timeZone: args.timeZone,
                timestamp: approvedAt,
                title: "Approved",
            }),
        );
    }

    if (typeof args.plan.rejectedAt === "number") {
        items.push(
            createTimelineItem({
                description:
                    args.plan.rejectionComment?.trim()
                        ? args.plan.rejectionComment.trim()
                        : "Revision requested by Procurement Officer.",
                id: `${args.plan.id}:rejected`,
                timeZone: args.timeZone,
                timestamp: args.plan.rejectedAt,
                title: "Rejected",
            }),
        );
    }

    return items
        .filter(
            (item, index, collection) =>
                item.timestamp !== null &&
                collection.findIndex((candidate) => candidate.id === item.id) === index,
        )
        .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0));
}

function createTimelineItem(args: {
    description: string;
    id: string;
    timeZone: string;
    timestamp: number | null;
    title: string;
}): DepartmentUserTimelineItem {
    return {
        description: args.description,
        id: args.id,
        timestamp: args.timestamp,
        timestampLabel:
            typeof args.timestamp === "number"
                ? formatDeadlineDateTime(args.timestamp, args.timeZone)
                : "Unavailable",
        title: args.title,
    };
}

function buildDepartmentUserStatusHelperText(args: {
    approvedAt: number | null;
    displayStatus: DepartmentUserDisplayStatus;
    fiscalYearKey: string;
    itemCount: number;
    rejectionComment: string | null;
    reviewStartedAt: number | null;
    reviewer: DepartmentUserReviewerSummary | null;
    submissionReference: string | null;
    submittedAt: number | null;
    timeZone: string;
}): string {
    switch (args.displayStatus) {
        case "submitted":
            return [
                args.submissionReference?.trim()
                    ? `Submitted as ${args.submissionReference.trim()}.`
                    : `Submitted for ${args.fiscalYearKey}.`,
                typeof args.submittedAt === "number"
                    ? `Submitted ${formatDeadlineDateTime(args.submittedAt, args.timeZone)}.`
                    : "Submission time unavailable.",
                "Waiting for Procurement Officer review.",
            ].join(" ");
        case "under_review":
            return [
                typeof args.reviewStartedAt === "number"
                    ? `Review started ${formatDeadlineDateTime(args.reviewStartedAt, args.timeZone)}.`
                    : "Review start time unavailable.",
                args.reviewer?.label && args.reviewer.state === "available"
                    ? `Reviewer: ${args.reviewer.label}.`
                    : "Procurement Officer review in progress.",
                "This plan is read-only while review is in progress.",
            ].join(" ");
        case "approved":
            return [
                typeof args.approvedAt === "number"
                    ? `Approved ${formatDeadlineDateTime(args.approvedAt, args.timeZone)}.`
                    : "Approved plan.",
                args.submissionReference?.trim()
                    ? `Reference ${args.submissionReference.trim()}.`
                    : "Submission reference unavailable.",
                `${args.itemCount} ${args.itemCount === 1 ? "item" : "items"} locked for this approved plan.`,
            ].join(" ");
        case "rejected":
            return [
                "Revision requested.",
                args.rejectionComment?.trim()
                    ? args.rejectionComment.trim()
                    : "Decision comments unavailable.",
            ].join(" ");
        case "draft":
            return `Draft plan for ${args.fiscalYearKey}.`;
        default:
            return "No Plan";
    }
}

function buildStatusDateLabel(args: {
    approvedAt: number | null;
    displayStatus: DepartmentUserDisplayStatus;
    rejectedAt: number | null;
    reviewStartedAt: number | null;
    submittedAt: number | null;
    timeZone: string;
}): string | null {
    switch (args.displayStatus) {
        case "submitted":
            return typeof args.submittedAt === "number"
                ? formatDeadlineDateTime(args.submittedAt, args.timeZone)
                : "Submitted date unavailable";
        case "under_review":
            return typeof args.reviewStartedAt === "number"
                ? formatDeadlineDateTime(args.reviewStartedAt, args.timeZone)
                : "Review start unavailable";
        case "approved":
            return typeof args.approvedAt === "number"
                ? formatDeadlineDateTime(args.approvedAt, args.timeZone)
                : "Approval date unavailable";
        case "rejected":
            return typeof args.rejectedAt === "number"
                ? formatDeadlineDateTime(args.rejectedAt, args.timeZone)
                : "Decision date unavailable";
        default:
            return null;
    }
}

function shouldShowPartialHistoryNotice(args: {
    displayStatus: DepartmentUserDisplayStatus;
    plan: DepartmentUserStatusTrackingPlanLike;
    submittedAt: number | null;
}): boolean {
    switch (args.displayStatus) {
        case "submitted":
            return args.submittedAt === null;
        case "under_review":
            return (
                args.submittedAt === null ||
                typeof args.plan.reviewStartedAt !== "number"
            );
        case "approved":
            return (
                args.submittedAt === null ||
                typeof args.plan.reviewStartedAt !== "number" ||
                typeof (args.plan.approvedAt ?? args.plan.lastApprovedAt ?? null) !==
                    "number"
            );
        case "rejected":
            return (
                args.submittedAt === null ||
                typeof args.plan.reviewStartedAt !== "number" ||
                typeof args.plan.rejectedAt !== "number"
            );
        default:
            return false;
    }
}
