import {
  formatFiscalYearLabel,
  getFiscalYearForDate,
} from "../tenant-admin/dashboard";
import {
  buildDeadlineFiscalYearOptions,
  formatDeadlineDate,
  getFiscalYearForTimestampInTimeZone,
  resolveDeadlineTimeZone,
  resolveSubmissionDeadline,
  type SubmissionDeadlineRecordLike,
} from "./deadlines";
import { extractProcurementOfficerDashboardSearchParams } from "./dashboard-search";
import { extractProcurementOfficerSubmissionSearchParams } from "./submissions";

export type ProcurementDashboardState =
  | "available"
  | "coming_soon"
  | "empty"
  | "setup_required"
  | "unavailable";

export const PROCUREMENT_OFFICER_WORKSPACE_MODALS = [
  "access-codes",
  "deadlines",
  "requests",
  "submissions",
] as const;

export type ProcurementOfficerWorkspaceModal =
  (typeof PROCUREMENT_OFFICER_WORKSPACE_MODALS)[number];

export interface ProcurementOfficerWorkspaceModalState {
  modal: ProcurementOfficerWorkspaceModal;
}

interface WorkspaceSearchParamsReader {
  get(name: string): string | null;
  getAll(name: string): string[];
}

export type ProcurementOfficerWorkspaceNavigationTarget =
  | {
      href: string;
      type: "modal";
      modalState: ProcurementOfficerWorkspaceModalState;
    }
  | {
      href: string;
      type: "route";
    };

export interface ProcurementDepartmentWindowRecord {
  id: string;
  isActive: boolean;
  submissionEndsAt?: number | null;
  submissionStartsAt?: number | null;
}

export interface ProcurementSubmissionDeadlineRecord extends SubmissionDeadlineRecordLike {}

export interface ProcurementChecklistStep {
  description: string;
  href: string;
  id:
    | "create_departments"
    | "add_categories"
    | "add_items"
    | "generate_access_codes"
    | "set_deadline";
  label: string;
  state: ProcurementDashboardState;
  statusLabel: string;
}

export interface ProcurementReadinessCoverage {
  readyCount: number;
  totalCount: number;
}

export interface SharedSubmissionDeadline {
  countdownLabel: string;
  countdownTargetAt: number | null;
  deadlineAt: number | null;
  label: string;
  reason:
    | "inconsistent_windows"
    | "invalid_window"
    | "missing_window"
    | "no_departments";
  reminderOffsets: number[];
  source: "canonical" | "department_fallback" | "none";
  startAt: number | null;
  state: "available" | "setup_required";
  timeZone: string;
  timeZoneUsesFallback: boolean;
}

export function getProcurementFiscalYearForDate(
  input: Date | number,
  args?: {
    fiscalYearStartMonth?: number | null;
    timeZone?: string | null;
  },
) {
  if (!args?.timeZone && !args?.fiscalYearStartMonth) {
    return getFiscalYearForDate(input);
  }

  const resolvedTimeZone = resolveDeadlineTimeZone({
    tenantTimeZone: args.timeZone,
  });
  const timestamp = input instanceof Date ? input.getTime() : input;
  const fiscalYear = getFiscalYearForTimestampInTimeZone({
    fiscalYearStartMonth: args.fiscalYearStartMonth,
    timeZone: resolvedTimeZone.timeZone,
    timestamp,
  });

  return {
    endYear: fiscalYear.endYear,
    isCurrent: true,
    key: fiscalYear.key,
    label: `FY ${fiscalYear.label}`,
    startYear: fiscalYear.startYear,
  };
}

export function formatProcurementFiscalYearLabel(
  fiscalYearKey: string,
): string {
  return formatFiscalYearLabel(fiscalYearKey);
}

export function isProcurementOfficerWorkspaceModal(
  value: string | null | undefined,
): value is ProcurementOfficerWorkspaceModal {
  return PROCUREMENT_OFFICER_WORKSPACE_MODALS.some((modal) => modal === value);
}

export function normalizeProcurementOfficerWorkspaceModalState(args: {
  modal: string | null;
}): ProcurementOfficerWorkspaceModalState | null {
  if (!isProcurementOfficerWorkspaceModal(args.modal)) {
    return null;
  }

  return {
    modal: args.modal,
  };
}

export function buildProcurementOfficerWorkspaceModalPath(
  state: ProcurementOfficerWorkspaceModalState,
  options?: {
    dashboardSearchParams?: WorkspaceSearchParamsReader | URLSearchParams;
    submissionWorkspaceSearchParams?:
      | WorkspaceSearchParamsReader
      | URLSearchParams;
  },
): string {
  const searchParams = new URLSearchParams({
    modal: state.modal,
  });
  const dashboardSearchParams = options?.dashboardSearchParams
    ? extractProcurementOfficerDashboardSearchParams(
        options.dashboardSearchParams,
      )
    : new URLSearchParams();

  dashboardSearchParams.forEach((value, key) => {
    searchParams.append(key, value);
  });

  if (state.modal === "submissions" && options?.submissionWorkspaceSearchParams) {
    const submissionSearchParams =
      extractProcurementOfficerSubmissionSearchParams(
        options.submissionWorkspaceSearchParams,
      );

    submissionSearchParams.forEach((value, key) => {
      searchParams.append(key, value);
    });
  }

  return `/po?${searchParams.toString()}`;
}

export function resolveProcurementOfficerWorkspaceNavigation(
  href: string,
): ProcurementOfficerWorkspaceNavigationTarget {
  const targetUrl = new URL(href, "https://procureline.local");

  switch (targetUrl.pathname) {
    case "/po/departments":
      return {
        href: `${targetUrl.pathname}${targetUrl.search}`,
        type: "route",
      };
    case "/po/access-codes":
      return {
        href: buildProcurementOfficerWorkspaceModalPath(
          {
            modal: "access-codes",
          },
          {
            dashboardSearchParams: targetUrl.searchParams,
          },
        ),
        type: "modal",
        modalState: { modal: "access-codes" },
      };
    case "/po/deadlines":
      return {
        href: buildProcurementOfficerWorkspaceModalPath(
          {
            modal: "deadlines",
          },
          {
            dashboardSearchParams: targetUrl.searchParams,
          },
        ),
        type: "modal",
        modalState: { modal: "deadlines" },
      };
    case "/po/requests":
      return {
        href: buildProcurementOfficerWorkspaceModalPath(
          {
            modal: "requests",
          },
          {
            dashboardSearchParams: targetUrl.searchParams,
          },
        ),
        type: "modal",
        modalState: { modal: "requests" },
      };
    case "/po/submissions":
      return {
        href: buildProcurementOfficerWorkspaceModalPath(
          {
            modal: "submissions",
          },
          {
            dashboardSearchParams: targetUrl.searchParams,
            submissionWorkspaceSearchParams: targetUrl.searchParams,
          },
        ),
        type: "modal",
        modalState: { modal: "submissions" },
      };
    case "/po/items":
    case "/po/categories":
      return {
        href: `${targetUrl.pathname}${targetUrl.search}`,
        type: "route",
      };
    default:
      return {
        href: `${targetUrl.pathname}${targetUrl.search}`,
        type: "route",
      };
  }
}

export function getDepartmentFiscalYearKey(
  department: ProcurementDepartmentWindowRecord,
  args?: {
    fiscalYearStartMonth?: number | null;
    timeZone?: string | null;
  },
): string | null {
  if (
    !department.isActive ||
    typeof department.submissionStartsAt !== "number" ||
    typeof department.submissionEndsAt !== "number" ||
    department.submissionEndsAt <= department.submissionStartsAt
  ) {
    return null;
  }

  const resolvedTimeZone = resolveDeadlineTimeZone({
    tenantTimeZone: args?.timeZone,
  });
  const startFiscalYear = getFiscalYearForTimestampInTimeZone({
    fiscalYearStartMonth: args?.fiscalYearStartMonth,
    timeZone: resolvedTimeZone.timeZone,
    timestamp: department.submissionStartsAt,
  }).key;
  const endFiscalYear = getFiscalYearForTimestampInTimeZone({
    fiscalYearStartMonth: args?.fiscalYearStartMonth,
    timeZone: resolvedTimeZone.timeZone,
    timestamp: department.submissionEndsAt,
  }).key;

  return startFiscalYear === endFiscalYear ? startFiscalYear : null;
}

export function buildAvailableProcurementFiscalYears(args: {
  departments: readonly ProcurementDepartmentWindowRecord[];
  existingFiscalYearKeys?: readonly string[];
  fiscalYearStartMonth?: number | null;
  now?: number;
  requestedFiscalYear?: string | null;
  timeZone?: string | null;
}): string[] {
  const safeYears = new Set<string>(args.existingFiscalYearKeys ?? []);

  for (const department of args.departments) {
    const fiscalYearKey = getDepartmentFiscalYearKey(department, {
      fiscalYearStartMonth: args.fiscalYearStartMonth,
      timeZone: args.timeZone,
    });
    if (fiscalYearKey) {
      safeYears.add(fiscalYearKey);
    }
  }

  return buildDeadlineFiscalYearOptions({
    existingFiscalYearKeys: Array.from(safeYears),
    fiscalYearStartMonth: args.fiscalYearStartMonth,
    now: args.now,
    requestedFiscalYear: args.requestedFiscalYear,
    timeZone: resolveDeadlineTimeZone({
      tenantTimeZone: args.timeZone,
    }).timeZone,
  });
}

export function deriveSharedSubmissionDeadline(args: {
  deadlineRecord?: ProcurementSubmissionDeadlineRecord | null;
  departments: readonly ProcurementDepartmentWindowRecord[];
  fiscalYearKey: string;
  fiscalYearStartMonth?: number | null;
  now?: number;
  tenantTimeZone?: string | null;
}): SharedSubmissionDeadline {
  const resolved = resolveSubmissionDeadline({
    deadlineRecord: args.deadlineRecord,
    departments: args.departments,
    fiscalYearKey: args.fiscalYearKey,
    fiscalYearStartMonth: args.fiscalYearStartMonth,
    now: args.now,
    tenantTimeZone: args.tenantTimeZone,
  });
  const deadlineAt = resolved.submissionEndsAt;

  return {
    countdownLabel: resolved.countdownLabel,
    countdownTargetAt: resolved.countdownTargetAt,
    deadlineAt: resolved.submissionEndsAt,
    label:
      deadlineAt === null
        ? "Not configured"
        : formatDeadlineDate(deadlineAt, resolved.timeZone),
    reason: resolved.reason,
    reminderOffsets: resolved.reminderOffsets,
    source: resolved.source,
    startAt: resolved.submissionStartsAt,
    state: resolved.state,
    timeZone: resolved.timeZone,
    timeZoneUsesFallback: resolved.timeZoneUsesFallback,
  };
}

export function deriveProcurementChecklist(args: {
  accessCodeCoverage: ProcurementReadinessCoverage;
  departmentCount: number;
  sharedDeadline: SharedSubmissionDeadline;
}): ProcurementChecklistStep[] {
  const hasDepartments = args.departmentCount > 0;
  const accessCodesReady =
    hasDepartments &&
    args.accessCodeCoverage.totalCount > 0 &&
    args.accessCodeCoverage.readyCount === args.accessCodeCoverage.totalCount;
  const sharedDeadlineReady = args.sharedDeadline.state === "available";

  return [
    {
      description: hasDepartments
        ? `${args.departmentCount} active department${args.departmentCount === 1 ? "" : "s"} already anchor the prep phase.`
        : "Start here by creating at least one department before the rest of the setup can move forward.",
      href: "/po/departments",
      id: "create_departments",
      label: "Create Departments",
      state: hasDepartments ? "available" : "setup_required",
      statusLabel: hasDepartments ? "Complete" : "Start here",
    },
    {
      description:
        "Create, reorder, archive, and maintain category metadata from the shared PO dashboard workspace.",
      href: "/po/categories",
      id: "add_categories",
      label: "Add Categories",
      state: "available",
      statusLabel: "Live workspace",
    },
    {
      description:
        "Add, move, archive, and import live catalog items inside the shared categories and items workspace.",
      href: "/po/items",
      id: "add_items",
      label: "Add Items",
      state: "available",
      statusLabel: "Live workspace",
    },
    {
      description: !hasDepartments
        ? "Access-code readiness unlocks after departments exist."
        : accessCodesReady
          ? "Every active department has at least one valid active access code."
          : `${args.accessCodeCoverage.readyCount} of ${args.accessCodeCoverage.totalCount} active department${args.accessCodeCoverage.totalCount === 1 ? "" : "s"} currently have valid access-code coverage.`,
      href: "/po/access-codes",
      id: "generate_access_codes",
      label: "Generate Access Codes",
      state: accessCodesReady ? "available" : "setup_required",
      statusLabel: accessCodesReady ? "Complete" : "Action needed",
    },
    {
      description: !hasDepartments
        ? "A shared submission deadline is blocked until departments exist."
        : sharedDeadlineReady
          ? `Shared submission deadline is set for ${args.sharedDeadline.label} in ${args.sharedDeadline.timeZone}.`
          : "A safe tenant-wide submission deadline cannot be derived yet, so this step remains blocked.",
      href: "/po/deadlines",
      id: "set_deadline",
      label: "Set Deadline",
      state: sharedDeadlineReady ? "available" : "setup_required",
      statusLabel: sharedDeadlineReady ? "Complete" : "Configure next",
    },
  ];
}

export function formatCoverageValue(
  args: ProcurementReadinessCoverage,
): string {
  if (args.totalCount === 0) {
    return "Not configured";
  }

  return `${args.readyCount} / ${args.totalCount}`;
}

export function isValidDepartmentWindow(
  department: ProcurementDepartmentWindowRecord,
): boolean {
  return (
    typeof department.submissionStartsAt === "number" &&
    typeof department.submissionEndsAt === "number" &&
    department.submissionEndsAt > department.submissionStartsAt
  );
}
