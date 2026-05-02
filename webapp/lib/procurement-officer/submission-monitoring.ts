import { formatDeadlineDateTime, resolveDeadlineTimeZone } from "./deadlines";
import {
  deriveDepartmentUserDisplayStatus,
  selectCanonicalPlans,
  type DepartmentUserStatusTrackingPlanLike,
} from "../department-user/status-tracking";
import { deriveDepartmentUserEffectiveRevisionDeadline } from "../plans/revision-deadline";

export const PROCUREMENT_OFFICER_MONITORING_STATUSES = [
  "not_started",
  "draft",
  "submitted",
  "rejected",
  "approved",
] as const;

export type ProcurementOfficerMonitoringStatus =
  (typeof PROCUREMENT_OFFICER_MONITORING_STATUSES)[number];

export type ProcurementOfficerReminderSkipReason =
  | "already_approved"
  | "cross_tenant"
  | "deadline_expired"
  | "inactive_department"
  | "missing_contact_email"
  | "missing_deadline"
  | "no_safe_du_access"
  | "not_in_scope"
  | "not_lagging";

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
  dueAt: number | null;
  dueLabel: string | null;
  duContactLabel: string;
  duRecipientCount: number;
  hasSafeDuAccess: boolean;
  historyState: "complete" | "partial";
  lastUpdatedAt: number | null;
  lastUpdatedLabel: string;
  planId: string | null;
  recipientEmails: string[];
  reminderEligibility: {
    dueAt: number | null;
    eligible: boolean;
    reason: ProcurementOfficerReminderSkipReason | null;
  };
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

export function deriveProcurementOfficerReminderEligibility(args: {
  contacts: readonly ProcurementOfficerMonitoringContact[];
  deadlineAt: number | null;
  department: ProcurementOfficerMonitoringDepartment;
  fiscalYearInScope: boolean;
  hasSafeDuAccess?: boolean;
  now: number;
  plan: ProcurementOfficerMonitoringPlanLike | null;
  tenantMatches: boolean;
}): {
  dueAt: number | null;
  eligible: boolean;
  reason: ProcurementOfficerReminderSkipReason | null;
  resolvedContacts: string[];
  safeAccess: boolean;
} {
  if (!args.tenantMatches) {
    return {
      dueAt: null,
      eligible: false,
      reason: "cross_tenant",
      resolvedContacts: [],
      safeAccess: false,
    };
  }

  if (!args.department.isActive) {
    return {
      dueAt: null,
      eligible: false,
      reason: "inactive_department",
      resolvedContacts: [],
      safeAccess: false,
    };
  }

  if (!args.fiscalYearInScope) {
    return {
      dueAt: null,
      eligible: false,
      reason: "not_in_scope",
      resolvedContacts: [],
      safeAccess: false,
    };
  }

  const resolvedContacts = Array.from(
    new Set(
      args.contacts
        .filter((contact) => contact.isActive)
        .map((contact) => contact.email?.trim().toLowerCase() ?? null)
        .filter((email): email is string => Boolean(email)),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const safeAccess =
    typeof args.hasSafeDuAccess === "boolean"
      ? args.hasSafeDuAccess
      : args.contacts.some((contact) => contact.isActive);

  if (!safeAccess) {
    return {
      dueAt: null,
      eligible: false,
      reason: "no_safe_du_access",
      resolvedContacts,
      safeAccess,
    };
  }

  if (resolvedContacts.length === 0) {
    return {
      dueAt: null,
      eligible: false,
      reason: "missing_contact_email",
      resolvedContacts,
      safeAccess,
    };
  }

  const status = deriveProcurementOfficerMonitoringStatus(args.plan);
  if (status === "approved") {
    return {
      dueAt: null,
      eligible: false,
      reason: "already_approved",
      resolvedContacts,
      safeAccess,
    };
  }

  let dueAt = args.deadlineAt;
  if (!dueAt) {
    return {
      dueAt: null,
      eligible: false,
      reason: "missing_deadline",
      resolvedContacts,
      safeAccess,
    };
  }

  const latestDecision = args.plan?.latestDecision ?? null;
  if (
    latestDecision &&
    (latestDecision.decisionType === "rejected" ||
      latestDecision.decisionType === "revision_requested")
  ) {
    const effectiveDeadline = deriveDepartmentUserEffectiveRevisionDeadline({
      decidedAt: latestDecision.decidedAt,
      decisionType: latestDecision.decisionType,
      revisionDeadlineAt: latestDecision.revisionDeadlineAt ?? null,
      submissionDeadlineAt: args.deadlineAt,
    }).effectiveDeadlineAt;
    dueAt = effectiveDeadline ?? dueAt;
  }

  if (args.now > dueAt) {
    return {
      dueAt,
      eligible: false,
      reason: "deadline_expired",
      resolvedContacts,
      safeAccess,
    };
  }

  if (status !== "not_started" && status !== "draft" && status !== "rejected") {
    return {
      dueAt,
      eligible: false,
      reason: "not_lagging",
      resolvedContacts,
      safeAccess,
    };
  }

  return {
    dueAt,
    eligible: true,
    reason: null,
    resolvedContacts,
    safeAccess,
  };
}

export function buildProcurementOfficerSubmissionReminderIdempotencyKey(args: {
  departmentId: string;
  dueAt: number;
  fiscalYear: string;
  reminderWindow: string;
  reason: ProcurementOfficerMonitoringStatus;
  tenantId: string;
}): string {
  return [
    "submission-reminder",
    args.tenantId,
    args.fiscalYear,
    args.departmentId,
    args.reason,
    String(args.dueAt),
    args.reminderWindow,
  ].join(":");
}

export function buildProcurementOfficerSubmissionReminderWindow(args: {
  now: number;
  windowMs?: number;
}): string {
  const windowMs = args.windowMs ?? 5 * 60 * 1000;
  return String(Math.floor(args.now / windowMs));
}

export function buildProcurementOfficerMonitoringRow(args: {
  contacts: readonly ProcurementOfficerMonitoringContact[];
  deadlineAt: number | null;
  department: ProcurementOfficerMonitoringDepartment;
  fiscalYear: string;
  hasSafeDuAccess?: boolean;
  now: number;
  plan: ProcurementOfficerMonitoringPlanLike | null;
  tenantMatches?: boolean;
  tenantTimeZone?: string | null;
}): ProcurementOfficerMonitoringRow {
  const timeZone = resolveDeadlineTimeZone({
    tenantTimeZone: args.tenantTimeZone,
  }).timeZone;
  const status = deriveProcurementOfficerMonitoringStatus(args.plan);
  const reminder = deriveProcurementOfficerReminderEligibility({
    contacts: args.contacts,
    deadlineAt: args.deadlineAt,
    department: args.department,
    fiscalYearInScope: true,
    hasSafeDuAccess: args.hasSafeDuAccess,
    now: args.now,
    plan: args.plan,
    tenantMatches: args.tenantMatches ?? true,
  });
  const timeline = buildProcurementOfficerMonitoringTimeline({
    plan: args.plan,
    timeZone,
  });
  const lastUpdatedAt = args.plan?.updatedAt ?? null;

  return {
    departmentCode: args.department.code,
    departmentId: args.department.id,
    departmentName: args.department.name,
    dueAt: reminder.dueAt,
    dueLabel:
      typeof reminder.dueAt === "number"
        ? formatDeadlineDateTime(reminder.dueAt, timeZone)
        : null,
    duContactLabel:
      reminder.resolvedContacts.length > 0
        ? reminder.resolvedContacts.join(", ")
        : "No active DU contact",
    duRecipientCount: reminder.resolvedContacts.length,
    hasSafeDuAccess: reminder.safeAccess,
    historyState: timeline.some((item) => item.isFallback) ? "partial" : "complete",
    lastUpdatedAt,
    lastUpdatedLabel:
      typeof lastUpdatedAt === "number"
        ? formatDeadlineDateTime(lastUpdatedAt, timeZone)
        : "Unavailable",
    planId: args.plan?.id ?? null,
    recipientEmails: reminder.resolvedContacts,
    reminderEligibility: {
      dueAt: reminder.dueAt,
      eligible: reminder.eligible,
      reason: reminder.reason,
    },
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
