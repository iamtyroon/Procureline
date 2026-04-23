import { formatDepartmentBudget } from "./departments";
import {
  formatDeadlineDateTime,
  parseTimeZoneInputValue,
  resolveDeadlineTimeZone,
} from "./deadlines";
import { extractProcurementOfficerDashboardSearchParams } from "./dashboard-search";

const DAY_MS = 24 * 60 * 60 * 1000;

export const PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS = {
  departmentId: "poSubmissionsDepartment",
  direction: "poSubmissionsDirection",
  endDate: "poSubmissionsEnd",
  notice: "poSubmissionsNotice",
  sortBy: "poSubmissionsSort",
  startDate: "poSubmissionsStart",
  status: "poSubmissionsStatus",
} as const;

export const PROCUREMENT_OFFICER_SUBMISSION_NOTICE_VALUES = [
  "review-target-unavailable",
] as const;

export const PROCUREMENT_OFFICER_SUBMISSION_SORT_FIELDS = [
  "submittedAt",
  "departmentName",
  "estimatedBudgetUsed",
  "status",
] as const;

export const PROCUREMENT_OFFICER_SUBMISSION_SORT_DIRECTIONS = [
  "asc",
  "desc",
] as const;

export const PROCUREMENT_OFFICER_SUBMISSION_STATUSES = [
  "submitted",
  "approved",
  "rejected",
] as const;

export type ProcurementOfficerSubmissionNotice =
  (typeof PROCUREMENT_OFFICER_SUBMISSION_NOTICE_VALUES)[number];
export type ProcurementOfficerSubmissionSortField =
  (typeof PROCUREMENT_OFFICER_SUBMISSION_SORT_FIELDS)[number];
export type ProcurementOfficerSubmissionSortDirection =
  (typeof PROCUREMENT_OFFICER_SUBMISSION_SORT_DIRECTIONS)[number];
export type ProcurementOfficerSubmissionStatus =
  (typeof PROCUREMENT_OFFICER_SUBMISSION_STATUSES)[number];

export interface ProcurementOfficerSubmissionSourceRow {
  approvedAt: number | null;
  departmentCode: string | null;
  departmentId: string | null;
  departmentName: string;
  estimatedBudgetUsed: number;
  fiscalYear: string;
  itemCount: number;
  planId: string;
  rejectedAt: number | null;
  status: ProcurementOfficerSubmissionStatus;
  submittedAt: number | null;
  updatedAt: number;
}

export interface ProcurementOfficerSubmissionRow
  extends ProcurementOfficerSubmissionSourceRow {
  reviewHref: string;
  sortSubmittedAt: number;
  statusLabel: string;
  submittedAtLabel: string;
  totalAmountLabel: string;
  urgencyLabel: string | null;
}

export interface ProcurementOfficerSubmissionFilterInput {
  departmentId?: string | null;
  endDate?: string | null;
  notice?: ProcurementOfficerSubmissionNotice | null;
  sortBy?: ProcurementOfficerSubmissionSortField | null;
  sortDirection?: ProcurementOfficerSubmissionSortDirection | null;
  startDate?: string | null;
  status?: ProcurementOfficerSubmissionStatus | "all" | null;
}

export interface NormalizedProcurementOfficerSubmissionFilters {
  departmentId: string | null;
  endDate: string | null;
  endTimestamp: number | null;
  notice: ProcurementOfficerSubmissionNotice | null;
  sortBy: ProcurementOfficerSubmissionSortField;
  sortDirection: ProcurementOfficerSubmissionSortDirection;
  startDate: string | null;
  startTimestamp: number | null;
  status: ProcurementOfficerSubmissionStatus | null;
}

export interface ProcurementOfficerSubmissionEmptyState {
  description: string;
  kind: "filtered-empty" | "fiscal-year-empty" | "global-empty";
  showClearFilters: boolean;
  title: string;
}

interface SearchParamsReader {
  get(name: string): string | null;
}

function isSubmissionStatus(
  value: string | null | undefined,
): value is ProcurementOfficerSubmissionStatus {
  return PROCUREMENT_OFFICER_SUBMISSION_STATUSES.some(
    (status) => status === value,
  );
}

function isSubmissionSortField(
  value: string | null | undefined,
): value is ProcurementOfficerSubmissionSortField {
  return PROCUREMENT_OFFICER_SUBMISSION_SORT_FIELDS.some(
    (field) => field === value,
  );
}

function isSubmissionSortDirection(
  value: string | null | undefined,
): value is ProcurementOfficerSubmissionSortDirection {
  return PROCUREMENT_OFFICER_SUBMISSION_SORT_DIRECTIONS.some(
    (direction) => direction === value,
  );
}

function isSubmissionNotice(
  value: string | null | undefined,
): value is ProcurementOfficerSubmissionNotice {
  return PROCUREMENT_OFFICER_SUBMISSION_NOTICE_VALUES.some(
    (notice) => notice === value,
  );
}

function addDaysToIsoDate(value: string, days: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const nextDate = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days),
  );

  return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDate.getUTCDate()).padStart(2, "0")}`;
}

function buildDateBoundaryTimestamp(args: {
  date: string | null;
  boundary: "end" | "start";
  tenantTimeZone?: string | null;
}): number | null {
  if (!args.date) {
    return null;
  }

  const resolvedTimeZone = resolveDeadlineTimeZone({
    tenantTimeZone: args.tenantTimeZone,
  }).timeZone;

  if (args.boundary === "start") {
    return (
      parseTimeZoneInputValue(`${args.date}T00:00`, resolvedTimeZone) ?? null
    );
  }

  const nextDate = addDaysToIsoDate(args.date, 1);
  if (!nextDate) {
    return null;
  }

  const nextDayStart = parseTimeZoneInputValue(
    `${nextDate}T00:00`,
    resolvedTimeZone,
  );
  return typeof nextDayStart === "number" ? nextDayStart - 1 : null;
}

function getStatusSortRank(status: ProcurementOfficerSubmissionStatus): number {
  switch (status) {
    case "approved":
      return 0;
    case "rejected":
      return 1;
    default:
      return 2;
  }
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    sensitivity: "base",
  });
}

function compareRowsDeterministically(
  left: ProcurementOfficerSubmissionRow,
  right: ProcurementOfficerSubmissionRow,
  primaryComparison: number,
): number {
  if (primaryComparison !== 0) {
    return primaryComparison;
  }

  const submittedAtComparison = left.sortSubmittedAt - right.sortSubmittedAt;
  if (submittedAtComparison !== 0) {
    return submittedAtComparison;
  }

  const departmentComparison = compareText(
    left.departmentName,
    right.departmentName,
  );
  if (departmentComparison !== 0) {
    return departmentComparison;
  }

  return left.planId.localeCompare(right.planId);
}

export function normalizeProcurementOfficerSubmissionFilters(
  input?: ProcurementOfficerSubmissionFilterInput | null,
  options?: {
    tenantTimeZone?: string | null;
  },
): NormalizedProcurementOfficerSubmissionFilters {
  const departmentId = input?.departmentId?.trim() ?? "";
  const startDate = input?.startDate?.trim() ?? "";
  const endDate = input?.endDate?.trim() ?? "";

  return {
    departmentId: departmentId.length > 0 ? departmentId : null,
    endDate: endDate.length > 0 ? endDate : null,
    endTimestamp: buildDateBoundaryTimestamp({
      boundary: "end",
      date: endDate.length > 0 ? endDate : null,
      tenantTimeZone: options?.tenantTimeZone,
    }),
    notice: isSubmissionNotice(input?.notice) ? input.notice : null,
    sortBy: isSubmissionSortField(input?.sortBy)
      ? input.sortBy
      : "submittedAt",
    sortDirection: isSubmissionSortDirection(input?.sortDirection)
      ? input.sortDirection
      : "asc",
    startDate: startDate.length > 0 ? startDate : null,
    startTimestamp: buildDateBoundaryTimestamp({
      boundary: "start",
      date: startDate.length > 0 ? startDate : null,
      tenantTimeZone: options?.tenantTimeZone,
    }),
    status: isSubmissionStatus(input?.status) ? input.status : null,
  };
}

export function buildProcurementOfficerSubmissionSearchParams(
  input?: ProcurementOfficerSubmissionFilterInput | null,
): URLSearchParams {
  const normalized = normalizeProcurementOfficerSubmissionFilters(input);
  const searchParams = new URLSearchParams();

  if (normalized.departmentId) {
    searchParams.set(
      PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.departmentId,
      normalized.departmentId,
    );
  }
  if (normalized.status) {
    searchParams.set(
      PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.status,
      normalized.status,
    );
  }
  if (normalized.startDate) {
    searchParams.set(
      PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.startDate,
      normalized.startDate,
    );
  }
  if (normalized.endDate) {
    searchParams.set(
      PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.endDate,
      normalized.endDate,
    );
  }
  if (normalized.sortBy !== "submittedAt") {
    searchParams.set(
      PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.sortBy,
      normalized.sortBy,
    );
  }
  if (normalized.sortDirection !== "asc") {
    searchParams.set(
      PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.direction,
      normalized.sortDirection,
    );
  }
  if (normalized.notice) {
    searchParams.set(
      PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.notice,
      normalized.notice,
    );
  }

  return searchParams;
}

export function extractProcurementOfficerSubmissionSearchParams(
  searchParams: SearchParamsReader,
): URLSearchParams {
  const rawNotice = searchParams.get(
    PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.notice,
  );
  const rawSortBy = searchParams.get(
    PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.sortBy,
  );
  const rawSortDirection = searchParams.get(
    PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.direction,
  );
  const rawStatus = searchParams.get(
    PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.status,
  );
  const normalized = normalizeProcurementOfficerSubmissionFilters({
    departmentId: searchParams.get(
      PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.departmentId,
    ),
    endDate: searchParams.get(PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.endDate),
    notice: isSubmissionNotice(rawNotice) ? rawNotice : null,
    sortBy: isSubmissionSortField(rawSortBy) ? rawSortBy : null,
    sortDirection: isSubmissionSortDirection(rawSortDirection)
      ? rawSortDirection
      : null,
    startDate: searchParams.get(
      PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.startDate,
    ),
    status: isSubmissionStatus(rawStatus) ? rawStatus : null,
  });

  return buildProcurementOfficerSubmissionSearchParams(normalized);
}

export function buildProcurementOfficerSubmissionModalPath(args?: {
  notice?: ProcurementOfficerSubmissionNotice | null;
  submissionWorkspaceSearchParams?: SearchParamsReader | URLSearchParams;
}): string {
  const searchParams = new URLSearchParams();
  const dashboardSearchParams = args?.submissionWorkspaceSearchParams
    ? extractProcurementOfficerDashboardSearchParams(
        args.submissionWorkspaceSearchParams,
      )
    : new URLSearchParams();

  const whitelisted = args?.submissionWorkspaceSearchParams
    ? extractProcurementOfficerSubmissionSearchParams(
        args.submissionWorkspaceSearchParams,
      )
    : new URLSearchParams();

  dashboardSearchParams.forEach((value, key) => {
    searchParams.append(key, value);
  });

  if (args?.notice) {
    whitelisted.set(PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.notice, args.notice);
  }

  whitelisted.forEach((value, key) => {
    searchParams.append(key, value);
  });

  return `/po?${searchParams.toString()}`;
}

export function buildProcurementOfficerSubmissionReviewHref(args: {
  planId: string;
  returnToSearchParams?: SearchParamsReader | URLSearchParams;
}): string {
  const searchParams = new URLSearchParams({
    modal: "review",
    planId: args.planId,
  });

  if (args.returnToSearchParams) {
    const dashboardSearchParams = extractProcurementOfficerDashboardSearchParams(
      args.returnToSearchParams,
    );

    dashboardSearchParams.forEach((value, key) => {
      searchParams.append(key, value);
    });
  }

  return `/po?${searchParams.toString()}`;
}

export function getProcurementOfficerSubmissionStatusLabel(
  status: ProcurementOfficerSubmissionStatus,
): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return "Submitted";
  }
}

export function shapeProcurementOfficerSubmissionRow(args: {
  now?: number;
  row: ProcurementOfficerSubmissionSourceRow;
  tenantTimeZone?: string | null;
}): ProcurementOfficerSubmissionRow {
  const sortSubmittedAt = args.row.submittedAt ?? args.row.updatedAt;
  const resolvedTimeZone = resolveDeadlineTimeZone({
    tenantTimeZone: args.tenantTimeZone,
  }).timeZone;
  const now = args.now ?? Date.now();
  const ageInDays = Math.max(0, Math.ceil((now - sortSubmittedAt) / DAY_MS));

  return {
    ...args.row,
    reviewHref: buildProcurementOfficerSubmissionReviewHref({
      planId: args.row.planId,
    }),
    sortSubmittedAt,
    statusLabel: getProcurementOfficerSubmissionStatusLabel(args.row.status),
    submittedAtLabel: formatDeadlineDateTime(sortSubmittedAt, resolvedTimeZone),
    totalAmountLabel: formatDepartmentBudget(args.row.estimatedBudgetUsed),
    urgencyLabel:
      args.row.status === "submitted" && ageInDays >= 7
        ? `${ageInDays}d waiting`
        : null,
  };
}

export function sortProcurementOfficerSubmissionRows(
  rows: readonly ProcurementOfficerSubmissionRow[],
  options?: {
    direction?: ProcurementOfficerSubmissionSortDirection;
    sortBy?: ProcurementOfficerSubmissionSortField;
  },
): ProcurementOfficerSubmissionRow[] {
  const sortBy = options?.sortBy ?? "submittedAt";
  const direction = options?.direction ?? "asc";
  const directionMultiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    let comparison = 0;

    switch (sortBy) {
      case "departmentName":
        comparison = compareText(left.departmentName, right.departmentName);
        break;
      case "estimatedBudgetUsed":
        comparison = left.estimatedBudgetUsed - right.estimatedBudgetUsed;
        break;
      case "status":
        comparison =
          getStatusSortRank(left.status) - getStatusSortRank(right.status);
        break;
      default:
        comparison = left.sortSubmittedAt - right.sortSubmittedAt;
        break;
    }

    return (
      compareRowsDeterministically(left, right, comparison) * directionMultiplier
    );
  });
}

export function filterProcurementOfficerSubmissionRows(
  rows: readonly ProcurementOfficerSubmissionRow[],
  filters: NormalizedProcurementOfficerSubmissionFilters,
): ProcurementOfficerSubmissionRow[] {
  return rows.filter((row) => {
    if (filters.departmentId && row.departmentId !== filters.departmentId) {
      return false;
    }

    if (filters.status && row.status !== filters.status) {
      return false;
    }

    if (
      typeof filters.startTimestamp === "number" &&
      row.sortSubmittedAt < filters.startTimestamp
    ) {
      return false;
    }

    if (
      typeof filters.endTimestamp === "number" &&
      row.sortSubmittedAt > filters.endTimestamp
    ) {
      return false;
    }

    return true;
  });
}

export function deriveProcurementOfficerSubmissionEmptyState(args: {
  filteredCount: number;
  hasActiveFilters: boolean;
  selectedFiscalYearCount: number;
  selectedFiscalYearLabel: string;
  totalCount: number;
}): ProcurementOfficerSubmissionEmptyState {
  if (args.filteredCount > 0) {
    return {
      description: "",
      kind: "global-empty",
      showClearFilters: false,
      title: "",
    };
  }

  if (args.hasActiveFilters && args.selectedFiscalYearCount > 0) {
    return {
      description:
        "No submissions match the current filters. Clear one or more filters to widen the queue again.",
      kind: "filtered-empty",
      showClearFilters: true,
      title: "No submissions match these filters.",
    };
  }

  if (args.totalCount === 0) {
    return {
      description:
        "Check back after departments submit. This queue only shows submitted, approved, or rejected plans.",
      kind: "global-empty",
      showClearFilters: false,
      title: "No submitted plans yet.",
    };
  }

  return {
    description:
      "The current fiscal-year scope has no matching submissions, but other fiscal years in this tenant do.",
    kind: "fiscal-year-empty",
    showClearFilters: false,
    title: `No submissions for ${args.selectedFiscalYearLabel}.`,
  };
}

export function collectProcurementOfficerSubmissionNotifications(args: {
  nextRows: readonly ProcurementOfficerSubmissionRow[];
  notifiedPlanIds: ReadonlySet<string>;
  previousKnownPlanIds: ReadonlySet<string>;
  previousVisiblePlanIds: ReadonlySet<string>;
}): {
  notifications: ProcurementOfficerSubmissionRow[];
  notifiedPlanIds: Set<string>;
} {
  const nextNotifiedPlanIds = new Set(args.notifiedPlanIds);
  const notifications = args.nextRows.filter((row) => {
    if (row.status !== "submitted") {
      return false;
    }

    if (args.previousVisiblePlanIds.has(row.planId)) {
      return false;
    }

    if (args.previousKnownPlanIds.has(row.planId)) {
      return false;
    }

    if (args.notifiedPlanIds.has(row.planId)) {
      return false;
    }

    nextNotifiedPlanIds.add(row.planId);
    return true;
  });

  return {
    notifications,
    notifiedPlanIds: nextNotifiedPlanIds,
  };
}

export function hasActiveProcurementOfficerSubmissionFilters(
  filters: NormalizedProcurementOfficerSubmissionFilters,
): boolean {
  return Boolean(
    filters.departmentId ||
      filters.endDate ||
      filters.startDate ||
      filters.status,
  );
}

export function summarizeProcurementOfficerSubmissionQueue(args: {
  plans: readonly Pick<
    ProcurementOfficerSubmissionSourceRow,
    "fiscalYear" | "status"
  >[];
  selectedFiscalYear: string;
}): {
  approvedCount: number;
  rejectedCount: number;
  selectedFiscalYearCount: number;
  submittedCount: number;
  totalCount: number;
} {
  const summary = {
    approvedCount: 0,
    rejectedCount: 0,
    selectedFiscalYearCount: 0,
    submittedCount: 0,
    totalCount: 0,
  };

  for (const plan of args.plans) {
    summary.totalCount += 1;
    if (plan.fiscalYear === args.selectedFiscalYear) {
      summary.selectedFiscalYearCount += 1;
      if (plan.status === "approved") {
        summary.approvedCount += 1;
      } else if (plan.status === "rejected") {
        summary.rejectedCount += 1;
      } else {
        summary.submittedCount += 1;
      }
    }
  }

  return summary;
}
