import { formatDeadlineDateTime, resolveDeadlineTimeZone } from "./deadlines";
import {
  deriveDepartmentUserDisplayStatus,
  selectCanonicalPlans,
  type DepartmentUserStatusTrackingPlanLike,
} from "../department-user/status-tracking";

export const PROCUREMENT_OFFICER_MONITORING_STATUSES = [
  "not_started",
  "draft",
  "submitted",
  "rejected",
  "approved",
] as const;

export type ProcurementOfficerMonitoringStatus =
  (typeof PROCUREMENT_OFFICER_MONITORING_STATUSES)[number];

export interface ProcurementOfficerMonitoringTimelineItem {
  description: string;
  id: string;
  isFallback: boolean;
  timestamp: number | null;
  timestampLabel: string;
  title: string;
}

export interface ProcurementOfficerMonitoringPlanLike
  extends DepartmentUserStatusTrackingPlanLike {
  departmentId: string;
}

export interface ProcurementOfficerMonitoringDepartment {
  code: string | null;
  id: string;
  isActive: boolean;
  name: string;
}

export interface ProcurementOfficerMonitoringDecisionLike {
  comment: string;
  decidedAt: number;
  decisionType: "approved" | "rejected" | "revision_requested";
  effectiveRevisionDeadlineAt?: number | null;
  revisionDeadlineAt?: number | null;
}

export interface ProcurementOfficerMonitoringContact {
  email: string | null;
  isActive: boolean;
  name: string | null;
}

export interface ProcurementOfficerMonitoringRow {
  departmentCode: string | null;
  departmentId: string;
  departmentName: string;
  duContactLabel: string;
  duRecipientCount: number;
  historyState: "complete" | "partial";
  lastUpdatedAt: number | null;
  lastUpdatedLabel: string;
  planId: string | null;
  status: ProcurementOfficerMonitoringStatus;
  statusLabel: string;
  timeline: ProcurementOfficerMonitoringTimelineItem[];
}

export interface ProcurementOfficerMonitoringSummary {
  approved: number;
  draft: number;
  notStarted: number;
  rejected: number;
  submitted: number;
  submittedOfTotalLabel: string;
  totalDepartments: number;
}

function createTimelineItem(args: {
  description: string;
  id: string;
  timeZone: string;
  timestamp: number | null;
  title: string;
}): ProcurementOfficerMonitoringTimelineItem {
  return {
    description: args.description,
    id: args.id,
    isFallback: typeof args.timestamp !== "number",
    timestamp: args.timestamp,
    timestampLabel:
      typeof args.timestamp === "number"
        ? formatDeadlineDateTime(args.timestamp, args.timeZone)
        : "Unavailable",
    title: args.title,
  };
}

export function deriveProcurementOfficerMonitoringStatus(
  plan: ProcurementOfficerMonitoringPlanLike | null,
): ProcurementOfficerMonitoringStatus {
  if (!plan) {
    return "not_started";
  }

  if (plan.status === "draft") {
    return "draft";
  }

  const displayStatus = deriveDepartmentUserDisplayStatus(plan);
  if (displayStatus === "approved") {
    return "approved";
  }
  if (displayStatus === "rejected" || displayStatus === "revision_requested") {
    return "rejected";
  }
  return "submitted";
}

export function getProcurementOfficerMonitoringStatusLabel(
  status: ProcurementOfficerMonitoringStatus,
): string {
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

export function selectCanonicalMonitoringPlan<TPlan extends ProcurementOfficerMonitoringPlanLike>(
  plans: readonly TPlan[],
  fiscalYear: string,
): TPlan | null {
  const canonical = selectCanonicalPlans(plans.filter((plan) => plan.fiscalYear === fiscalYear));
  return canonical[0] ?? null;
}

export function buildProcurementOfficerMonitoringTimeline(args: {
  plan: ProcurementOfficerMonitoringPlanLike | null;
  timeZone: string;
}): ProcurementOfficerMonitoringTimelineItem[] {
  if (!args.plan) {
    return [];
  }

  const items: ProcurementOfficerMonitoringTimelineItem[] = [
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

    return (left.submissionSequence ?? Number.MAX_SAFE_INTEGER) - (right.submissionSequence ?? Number.MAX_SAFE_INTEGER);
  });

  if (snapshots.length === 0 && args.plan.status !== "draft") {
    items.push(
      createTimelineItem({
        description: "Submission snapshot unavailable for this plan.",
        id: `${args.plan.id}:submitted:fallback`,
        timeZone: args.timeZone,
        timestamp: args.plan.submittedAt ?? null,
        title: "Submitted",
      }),
    );
  }

  for (const snapshot of snapshots) {
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

  if (args.plan.status !== "draft") {
    items.push(
      createTimelineItem({
        description:
          typeof args.plan.reviewStartedAt === "number"
            ? "Procurement Officer review started."
            : "Review start time unavailable.",
        id: `${args.plan.id}:review-started`,
        timeZone: args.timeZone,
        timestamp: args.plan.reviewStartedAt ?? null,
        title: "Under Review",
      }),
    );
  }

  const decisions = (args.plan.reviewDecisions ?? []).filter(
    (decision) => decision.lifecycleStatus !== "undone",
  );

  if (decisions.length > 0) {
    for (const decision of decisions) {
      items.push(
        createTimelineItem({
          description:
            decision.comment.trim() ||
            (decision.decisionType === "approved"
              ? "Plan approved for this fiscal year."
              : "Review decision recorded."),
          id: `${args.plan.id}:decision:${decision.id}`,
          timeZone: args.timeZone,
          timestamp: decision.decidedAt,
          title:
            decision.decisionType === "approved"
              ? "Approved"
              : decision.decisionType === "revision_requested"
                ? "Revision Requested"
                : "Rejected",
        }),
      );
    }
  } else if (args.plan.status === "approved" || args.plan.status === "rejected") {
    items.push(
      createTimelineItem({
        description:
          args.plan.status === "approved"
            ? "Plan approved for this fiscal year."
            : args.plan.rejectionComment?.trim() || "Review decision recorded.",
        id: `${args.plan.id}:terminal`,
        timeZone: args.timeZone,
        timestamp:
          args.plan.status === "approved"
            ? args.plan.approvedAt ?? args.plan.lastApprovedAt ?? null
            : args.plan.rejectedAt ?? null,
        title: args.plan.status === "approved" ? "Approved" : "Rejected",
      }),
    );
  }

  return items
    .filter(
      (item, index, collection) =>
        collection.findIndex((candidate) => candidate.id === item.id) === index,
    )
    .sort((left, right) => {
      const leftValue = left.timestamp ?? Number.MAX_SAFE_INTEGER;
      const rightValue = right.timestamp ?? Number.MAX_SAFE_INTEGER;
      if (leftValue !== rightValue) {
        return leftValue - rightValue;
      }

      return left.id.localeCompare(right.id);
    });
}

export function summarizeProcurementOfficerMonitoringRows(
  rows: readonly Pick<ProcurementOfficerMonitoringRow, "status">[],
): ProcurementOfficerMonitoringSummary {
  const summary: ProcurementOfficerMonitoringSummary = {
    approved: 0,
    draft: 0,
    notStarted: 0,
    rejected: 0,
    submitted: 0,
    submittedOfTotalLabel: "0 of 0 departments submitted",
    totalDepartments: rows.length,
  };

  for (const row of rows) {
    switch (row.status) {
      case "approved":
        summary.approved += 1;
        break;
      case "draft":
        summary.draft += 1;
        break;
      case "not_started":
        summary.notStarted += 1;
        break;
      case "rejected":
        summary.rejected += 1;
        break;
      default:
        summary.submitted += 1;
        break;
    }
  }

  summary.submittedOfTotalLabel = `${summary.submitted + summary.approved} of ${summary.totalDepartments} departments submitted`;
  return summary;
}

function resolveProcurementOfficerMonitoringContactEmails(
  contacts: readonly ProcurementOfficerMonitoringContact[],
): string[] {
  return Array.from(
    new Set(
      contacts
        .filter((contact) => contact.isActive)
        .map((contact) => contact.email?.trim().toLowerCase() ?? null)
        .filter((email): email is string => Boolean(email)),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function buildProcurementOfficerMonitoringRow(args: {
  contacts: readonly ProcurementOfficerMonitoringContact[];
  department: ProcurementOfficerMonitoringDepartment;
  plan: ProcurementOfficerMonitoringPlanLike | null;
  tenantTimeZone?: string | null;
}): ProcurementOfficerMonitoringRow {
  const timeZone = resolveDeadlineTimeZone({
    tenantTimeZone: args.tenantTimeZone,
  }).timeZone;
  const status = deriveProcurementOfficerMonitoringStatus(args.plan);
  const contactEmails = resolveProcurementOfficerMonitoringContactEmails(args.contacts);
  const timeline = buildProcurementOfficerMonitoringTimeline({
    plan: args.plan,
    timeZone,
  });
  const lastUpdatedAt = args.plan?.updatedAt ?? null;

  return {
    departmentCode: args.department.code,
    departmentId: args.department.id,
    departmentName: args.department.name,
    duContactLabel:
      contactEmails.length > 0
        ? contactEmails.join(", ")
        : "No active DU contact",
    duRecipientCount: contactEmails.length,
    historyState: timeline.some((item) => item.isFallback) ? "partial" : "complete",
    lastUpdatedAt,
    lastUpdatedLabel:
      typeof lastUpdatedAt === "number"
        ? formatDeadlineDateTime(lastUpdatedAt, timeZone)
        : "Unavailable",
    planId: args.plan?.id ?? null,
    status,
    statusLabel: getProcurementOfficerMonitoringStatusLabel(status),
    timeline,
  };
}

export function buildProcurementOfficerMonitoringExportRows(
  rows: readonly Pick<
    ProcurementOfficerMonitoringRow,
    "departmentName" | "duContactLabel" | "lastUpdatedLabel" | "statusLabel"
  >[],
): Array<{
  department: string;
  status: string;
  "last updated": string;
  "DU contact": string;
}> {
  return rows.map((row) => ({
    department: row.departmentName,
    status: row.statusLabel,
    "last updated": row.lastUpdatedLabel,
    "DU contact": row.duContactLabel,
  }));
}
