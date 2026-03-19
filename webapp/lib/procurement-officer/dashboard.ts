import { format } from "date-fns";
import {
    formatFiscalYearLabel,
    getFiscalYearForDate,
} from "../tenant-admin/dashboard";

export type ProcurementDashboardState =
    | "available"
    | "coming_soon"
    | "empty"
    | "setup_required"
    | "unavailable";

export const PROCUREMENT_OFFICER_WORKSPACE_MODALS = [
    "access-codes",
    "categories",
    "deadlines",
    "departments",
    "requests",
] as const;

export const PROCUREMENT_OFFICER_WORKSPACE_SECTIONS = ["items"] as const;

export type ProcurementOfficerWorkspaceModal =
    (typeof PROCUREMENT_OFFICER_WORKSPACE_MODALS)[number];
export type ProcurementOfficerWorkspaceSection =
    (typeof PROCUREMENT_OFFICER_WORKSPACE_SECTIONS)[number];

export interface ProcurementOfficerWorkspaceModalState {
    modal: ProcurementOfficerWorkspaceModal;
    section?: ProcurementOfficerWorkspaceSection;
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
    deadlineAt: number | null;
    label: string;
    reason:
        | "inconsistent_windows"
        | "invalid_window"
        | "missing_window"
        | "no_departments";
    startAt: number | null;
    state: "available" | "setup_required";
}

export function getProcurementFiscalYearForDate(input: Date | number) {
    return getFiscalYearForDate(input);
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

export function isProcurementOfficerWorkspaceSection(
    value: string | null | undefined,
): value is ProcurementOfficerWorkspaceSection {
    return PROCUREMENT_OFFICER_WORKSPACE_SECTIONS.some(
        (section) => section === value,
    );
}

export function normalizeProcurementOfficerWorkspaceModalState(args: {
    modal: string | null;
    section?: string | null;
}): ProcurementOfficerWorkspaceModalState | null {
    if (!isProcurementOfficerWorkspaceModal(args.modal)) {
        return null;
    }

    if (args.modal === "categories" && isProcurementOfficerWorkspaceSection(args.section)) {
        return {
            modal: args.modal,
            section: args.section,
        };
    }

    return {
        modal: args.modal,
    };
}

export function buildProcurementOfficerWorkspaceModalPath(
    state: ProcurementOfficerWorkspaceModalState,
): string {
    const searchParams = new URLSearchParams({
        modal: state.modal,
    });

    if (state.modal === "categories" && state.section) {
        searchParams.set("section", state.section);
    }

    return `/po?${searchParams.toString()}`;
}

export function resolveProcurementOfficerWorkspaceNavigation(
    href: string,
): ProcurementOfficerWorkspaceNavigationTarget {
    switch (href) {
        case "/po/departments":
            return {
                href: buildProcurementOfficerWorkspaceModalPath({
                    modal: "departments",
                }),
                type: "modal",
                modalState: { modal: "departments" },
            };
        case "/po/access-codes":
            return {
                href: buildProcurementOfficerWorkspaceModalPath({
                    modal: "access-codes",
                }),
                type: "modal",
                modalState: { modal: "access-codes" },
            };
        case "/po/deadlines":
            return {
                href: buildProcurementOfficerWorkspaceModalPath({
                    modal: "deadlines",
                }),
                type: "modal",
                modalState: { modal: "deadlines" },
            };
        case "/po/requests":
            return {
                href: buildProcurementOfficerWorkspaceModalPath({
                    modal: "requests",
                }),
                type: "modal",
                modalState: { modal: "requests" },
            };
        case "/po/items":
        case "/po/categories/items":
            return {
                href: buildProcurementOfficerWorkspaceModalPath({
                    modal: "categories",
                    section: "items",
                }),
                type: "modal",
                modalState: {
                    modal: "categories",
                    section: "items",
                },
            };
        case "/po/categories":
            return {
                href: buildProcurementOfficerWorkspaceModalPath({
                    modal: "categories",
                }),
                type: "modal",
                modalState: { modal: "categories" },
            };
        default:
            return {
                href,
                type: "route",
            };
    }
}

export function getDepartmentFiscalYearKey(
    department: ProcurementDepartmentWindowRecord,
): string | null {
    if (
        !department.isActive ||
        typeof department.submissionStartsAt !== "number" ||
        typeof department.submissionEndsAt !== "number" ||
        department.submissionEndsAt <= department.submissionStartsAt
    ) {
        return null;
    }

    const startFiscalYear = getFiscalYearForDate(department.submissionStartsAt).key;
    const endFiscalYear = getFiscalYearForDate(department.submissionEndsAt).key;

    return startFiscalYear === endFiscalYear ? startFiscalYear : null;
}

export function buildAvailableProcurementFiscalYears(args: {
    departments: readonly ProcurementDepartmentWindowRecord[];
}): string[] {
    const safeYears = new Set<string>();

    for (const department of args.departments) {
        const fiscalYearKey = getDepartmentFiscalYearKey(department);
        if (fiscalYearKey) {
            safeYears.add(fiscalYearKey);
        }
    }

    return Array.from(safeYears).sort((left, right) => right.localeCompare(left));
}

export function deriveSharedSubmissionDeadline(
    departments: readonly ProcurementDepartmentWindowRecord[],
): SharedSubmissionDeadline {
    const activeDepartments = departments.filter((department) => department.isActive);
    if (activeDepartments.length === 0) {
        return {
            deadlineAt: null,
            label: "Not configured",
            reason: "no_departments",
            startAt: null,
            state: "setup_required",
        };
    }

    const starts: number[] = [];
    const ends: number[] = [];

    for (const department of activeDepartments) {
        if (
            typeof department.submissionStartsAt !== "number" ||
            typeof department.submissionEndsAt !== "number"
        ) {
            return {
                deadlineAt: null,
                label: "Not configured",
                reason: "missing_window",
                startAt: null,
                state: "setup_required",
            };
        }

        if (department.submissionEndsAt <= department.submissionStartsAt) {
            return {
                deadlineAt: null,
                label: "Not configured",
                reason: "invalid_window",
                startAt: null,
                state: "setup_required",
            };
        }

        starts.push(department.submissionStartsAt);
        ends.push(department.submissionEndsAt);
    }

    const uniqueStarts = new Set(starts);
    const uniqueEnds = new Set(ends);
    if (uniqueStarts.size !== 1 || uniqueEnds.size !== 1) {
        return {
            deadlineAt: null,
            label: "Not configured",
            reason: "inconsistent_windows",
            startAt: null,
            state: "setup_required",
        };
    }

    const startAt = starts[0] ?? null;
    const deadlineAt = ends[0] ?? null;

    return {
        deadlineAt,
        label:
            deadlineAt === null
                ? "Not configured"
                : format(new Date(deadlineAt), "dd MMM yyyy"),
        reason: "no_departments",
        startAt,
        state: startAt !== null && deadlineAt !== null ? "available" : "setup_required",
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
                "Categories will stay honest until Story 4.7 lands with live data and management flows.",
            href: "/po/categories",
            id: "add_categories",
            label: "Add Categories",
            state: "coming_soon",
            statusLabel: "Awaiting later story",
        },
        {
            description:
                "Item catalog setup is reserved for Story 4.8, so the dashboard keeps this step explicitly staged.",
            href: "/po/items",
            id: "add_items",
            label: "Add Items",
            state: "coming_soon",
            statusLabel: "Awaiting later story",
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
                  ? `Shared submission deadline is set for ${args.sharedDeadline.label}.`
                  : "A safe tenant-wide submission deadline cannot be derived yet, so this step remains blocked.",
            href: "/po/deadlines",
            id: "set_deadline",
            label: "Set Deadline",
            state: sharedDeadlineReady ? "available" : "setup_required",
            statusLabel: sharedDeadlineReady ? "Complete" : "Configure next",
        },
    ];
}

export function formatCoverageValue(args: ProcurementReadinessCoverage): string {
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
