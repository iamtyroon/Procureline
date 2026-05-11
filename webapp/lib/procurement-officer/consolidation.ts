import {
    buildAvailableProcurementFiscalYears,
    formatProcurementFiscalYearLabel,
    getDepartmentFiscalYearKey,
    getProcurementFiscalYearForDate,
    type ProcurementDepartmentWindowRecord,
} from "./dashboard";

export const CONSOLIDATION_DRAFT_SCHEMA_VERSION = 1 as const;
export const CONSOLIDATION_EMPTY_MESSAGE =
    "No approved plans available for consolidation. Approve department submissions first.";

export type ConsolidationPlanStatus =
    | "approved"
    | "draft"
    | "rejected"
    | "submitted";

export type ConsolidationBlockedReason =
    | "draft"
    | "inactive"
    | "missing_plan"
    | "out_of_fiscal_year"
    | "rejected"
    | "stale_fiscal_year"
    | "submitted";

export interface ConsolidationDepartmentRecord
    extends ProcurementDepartmentWindowRecord {
    budgetAllocation?: number | null;
    code: string;
    name: string;
    voteNumber?: string | null;
}

export interface ConsolidationPlanRecord {
    approvedAt?: number | null;
    consolidatedAt?: number | null;
    departmentId: string;
    departmentNameSnapshot?: string | null;
    estimatedBudgetUsed: number;
    fiscalYear: string;
    id: string;
    itemCount: number;
    status: ConsolidationPlanStatus;
    updatedAt: number;
    workspaceState?: unknown;
}

export interface ConsolidationSourcePlan {
    approvedAt: number | null;
    departmentCode: string;
    departmentId: string;
    departmentName: string;
    estimatedBudgetUsed: number;
    itemCount: number;
    planId: string;
    voteNumber: string;
    workspaceState: unknown;
}

export interface ConsolidationBlockedDepartment {
    departmentCode: string;
    departmentId: string;
    departmentName: string;
    reason: ConsolidationBlockedReason;
    reasonLabel: string;
    status: ConsolidationPlanStatus | "missing";
    voteNumber: string;
}

export interface ConsolidationReadinessResult {
    blockedDepartments: ConsolidationBlockedDepartment[];
    hasActiveDepartments: boolean;
    readyCount: number;
    readyDepartments: ConsolidationSourcePlan[];
    readyDepartmentIds: string[];
    selectedFiscalYear: string;
    selectedFiscalYearLabel: string;
    totalBudget: number;
    totalDepartmentCount: number;
    totalItemCount: number;
}

export interface ConsolidationFiscalYearOptionsArgs {
    approvedPlanFiscalYears?: readonly string[];
    departments: readonly ProcurementDepartmentWindowRecord[];
    fiscalYearStartMonth?: number | null;
    now: number;
    requestedFiscalYear?: string | null;
    submissionDeadlineFiscalYears?: readonly string[];
    tenantTimeZone?: string | null;
}

export function normalizeConsolidationFiscalYear(
    args: ConsolidationFiscalYearOptionsArgs,
): { currentFiscalYear: string; options: string[]; selectedFiscalYear: string } {
    const requestedFiscalYear =
        args.requestedFiscalYear && /^\d{4}-\d{4}$/.test(args.requestedFiscalYear)
            ? args.requestedFiscalYear
            : undefined;
    const currentFiscalYear = getProcurementFiscalYearForDate(args.now, {
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        timeZone: args.tenantTimeZone,
    }).key;
    const approvedPlanFiscalYears = new Set(args.approvedPlanFiscalYears ?? []);
    const options = buildAvailableProcurementFiscalYears({
        departments: args.departments,
        existingFiscalYearKeys: [
            ...(args.submissionDeadlineFiscalYears ?? []),
            ...(args.approvedPlanFiscalYears ?? []),
        ],
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        now: args.now,
        requestedFiscalYear: undefined,
        timeZone: args.tenantTimeZone,
    });

    if (
        requestedFiscalYear &&
        options.includes(requestedFiscalYear)
    ) {
        return { currentFiscalYear, options, selectedFiscalYear: requestedFiscalYear };
    }

    const approvedOptions = options
        .filter((option) => approvedPlanFiscalYears.has(option))
        .sort((left, right) => right.localeCompare(left));
    if (approvedOptions.includes(currentFiscalYear)) {
        return { currentFiscalYear, options, selectedFiscalYear: currentFiscalYear };
    }
    if (approvedOptions[0]) {
        return {
            currentFiscalYear,
            options,
            selectedFiscalYear: approvedOptions[0],
        };
    }

    if (options.includes(currentFiscalYear)) {
        return { currentFiscalYear, options, selectedFiscalYear: currentFiscalYear };
    }

    return {
        currentFiscalYear,
        options,
        selectedFiscalYear: options[0] ?? currentFiscalYear,
    };
}

export function buildConsolidationReadiness(
    args: {
        departments: readonly ConsolidationDepartmentRecord[];
        fiscalYearStartMonth?: number | null;
        plans: readonly ConsolidationPlanRecord[];
        selectedFiscalYear: string;
        tenantTimeZone?: string | null;
    },
): ConsolidationReadinessResult {
    const activeDepartments = args.departments.filter((department) => department.isActive);
    const departmentsInFiscalYear = activeDepartments.filter(
        (department) =>
            getDepartmentFiscalYearKey(department, {
                fiscalYearStartMonth: args.fiscalYearStartMonth,
                timeZone: args.tenantTimeZone,
            }) === args.selectedFiscalYear,
    );
    const scopedDepartments =
        departmentsInFiscalYear.length > 0 ? departmentsInFiscalYear : activeDepartments;
    const canonicalApprovedPlans = selectCanonicalApprovedPlansByDepartment({
        plans: args.plans,
        selectedFiscalYear: args.selectedFiscalYear,
    });
    const plansByDepartment = groupPlansByDepartment(args.plans);
    const readyDepartments: ConsolidationSourcePlan[] = [];
    const blockedDepartments: ConsolidationBlockedDepartment[] = [];

    for (const department of [...scopedDepartments].sort((left, right) =>
        left.name.localeCompare(right.name),
    )) {
        const canonicalApprovedPlan = canonicalApprovedPlans.get(department.id) ?? null;
        if (canonicalApprovedPlan) {
            readyDepartments.push({
                approvedAt: canonicalApprovedPlan.approvedAt ?? null,
                departmentCode: department.code,
                departmentId: department.id,
                departmentName:
                    canonicalApprovedPlan.departmentNameSnapshot ?? department.name,
                estimatedBudgetUsed: canonicalApprovedPlan.estimatedBudgetUsed,
                itemCount: canonicalApprovedPlan.itemCount,
                planId: canonicalApprovedPlan.id,
                voteNumber: department.voteNumber ?? department.code,
                workspaceState: canonicalApprovedPlan.workspaceState ?? null,
            });
            continue;
        }

        const departmentPlans = plansByDepartment.get(department.id) ?? [];
        const mostRelevantPlan = selectMostRelevantNonApprovedPlan({
            plans: departmentPlans,
            selectedFiscalYear: args.selectedFiscalYear,
        });
        const reason = resolveBlockedDepartmentReason({
            department,
            plan: mostRelevantPlan,
            selectedFiscalYear: args.selectedFiscalYear,
            fiscalYearStartMonth: args.fiscalYearStartMonth,
            tenantTimeZone: args.tenantTimeZone,
        });

        blockedDepartments.push({
            departmentCode: department.code,
            departmentId: department.id,
            departmentName: department.name,
            reason,
            reasonLabel: getConsolidationBlockedReasonLabel(reason),
            status: mostRelevantPlan?.status ?? "missing",
            voteNumber: department.voteNumber ?? department.code,
        });
    }

    return {
        blockedDepartments,
        hasActiveDepartments: activeDepartments.length > 0,
        readyCount: readyDepartments.length,
        readyDepartments,
        readyDepartmentIds: readyDepartments.map((department) => department.departmentId),
        selectedFiscalYear: args.selectedFiscalYear,
        selectedFiscalYearLabel: formatProcurementFiscalYearLabel(args.selectedFiscalYear),
        totalBudget: readyDepartments.reduce(
            (total, department) => total + Math.max(0, department.estimatedBudgetUsed),
            0,
        ),
        totalDepartmentCount: scopedDepartments.length,
        totalItemCount: readyDepartments.reduce(
            (total, department) => total + Math.max(0, department.itemCount),
            0,
        ),
    };
}

export function selectCanonicalApprovedPlansByDepartment(args: {
    plans: readonly ConsolidationPlanRecord[];
    selectedFiscalYear: string;
}): Map<string, ConsolidationPlanRecord> {
    const approvedPlans = args.plans.filter(
        (plan) =>
            plan.fiscalYear === args.selectedFiscalYear &&
            plan.status === "approved",
    );
    const selected = new Map<string, ConsolidationPlanRecord>();

    for (const plan of approvedPlans) {
        const existing = selected.get(plan.departmentId);
        if (!existing || compareApprovedPlanRecency(plan, existing) > 0) {
            selected.set(plan.departmentId, plan);
        }
    }

    return selected;
}

export function validateConsolidationDraftPayload(args: {
    notes?: string | null;
    selectedSourceDepartmentIds: readonly string[];
    workspaceState?: unknown;
}): { message?: string; ok: true } | { message: string; ok: false } {
    const uniqueSourceIds = new Set(args.selectedSourceDepartmentIds);
    if (uniqueSourceIds.size !== args.selectedSourceDepartmentIds.length) {
        return {
            ok: false,
            message: "A consolidation draft cannot contain duplicate source departments.",
        };
    }

    if ((args.notes ?? "").length > 2_000) {
        return {
            ok: false,
            message: "Consolidation notes must be 2,000 characters or fewer.",
        };
    }

    if (args.workspaceState !== undefined && args.workspaceState !== null) {
        const workspaceValidation = validateWorkspaceJsonLike(args.workspaceState);
        if (!workspaceValidation.ok) {
            return workspaceValidation;
        }
    }

    return { ok: true };
}

function validateWorkspaceJsonLike(
    value: unknown,
): { message?: string; ok: true } | { message: string; ok: false } {
    let serialized = "";
    try {
        serialized = JSON.stringify(value);
    } catch {
        return {
            ok: false,
            message: "Workspace state must be JSON serializable.",
        };
    }

    if (isPersistedBlocklyWorkspaceRecordLike(value)) {
        return { ok: true };
    }

    const stats = inspectJsonShape(value);
    if (stats.depth > 24) {
        return {
            ok: false,
            message: "Workspace state is nested too deeply to save safely.",
        };
    }
    return { ok: true };
}

function isPersistedBlocklyWorkspaceRecordLike(value: unknown): boolean {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const record = value as Record<string, unknown>;
    return (
        record.format === "blockly_json" &&
        typeof record.workspaceJson === "string" &&
        typeof record.editorMetadata === "object" &&
        record.editorMetadata !== null
    );
}

function inspectJsonShape(value: unknown): { blockCount: number; depth: number } {
    const stack: Array<{ depth: number; value: unknown }> = [{ depth: 1, value }];
    let blockCount = 0;
    let maxDepth = 0;

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) {
            continue;
        }
        maxDepth = Math.max(maxDepth, current.depth);
        if (!current.value || typeof current.value !== "object") {
            continue;
        }
        if (
            !Array.isArray(current.value) &&
            typeof (current.value as Record<string, unknown>).type === "string"
        ) {
            blockCount += 1;
        }
        for (const child of Array.isArray(current.value)
            ? current.value
            : Object.values(current.value)) {
            stack.push({ depth: current.depth + 1, value: child });
        }
    }

    return { blockCount, depth: maxDepth };
}

function compareApprovedPlanRecency(
    left: ConsolidationPlanRecord,
    right: ConsolidationPlanRecord,
): number {
    const leftApprovedAt = left.approvedAt ?? 0;
    const rightApprovedAt = right.approvedAt ?? 0;
    if (leftApprovedAt !== rightApprovedAt) {
        return leftApprovedAt - rightApprovedAt;
    }

    if (left.updatedAt !== right.updatedAt) {
        return left.updatedAt - right.updatedAt;
    }

    return left.id.localeCompare(right.id);
}

function groupPlansByDepartment(
    plans: readonly ConsolidationPlanRecord[],
): Map<string, ConsolidationPlanRecord[]> {
    const grouped = new Map<string, ConsolidationPlanRecord[]>();
    for (const plan of plans) {
        grouped.set(plan.departmentId, [...(grouped.get(plan.departmentId) ?? []), plan]);
    }
    return grouped;
}

function selectMostRelevantNonApprovedPlan(args: {
    plans: readonly ConsolidationPlanRecord[];
    selectedFiscalYear: string;
}): ConsolidationPlanRecord | null {
    return (
        [...args.plans]
            .filter((plan) => plan.fiscalYear === args.selectedFiscalYear)
            .sort((left, right) => right.updatedAt - left.updatedAt || right.id.localeCompare(left.id))[0] ??
        null
    );
}

function resolveBlockedDepartmentReason(args: {
    department: ConsolidationDepartmentRecord;
    fiscalYearStartMonth?: number | null;
    plan: ConsolidationPlanRecord | null;
    selectedFiscalYear: string;
    tenantTimeZone?: string | null;
}): ConsolidationBlockedReason {
    const departmentFiscalYear = getDepartmentFiscalYearKey(args.department, {
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        timeZone: args.tenantTimeZone,
    });

    if (!args.department.isActive) {
        return "inactive";
    }
    if (departmentFiscalYear && departmentFiscalYear !== args.selectedFiscalYear) {
        return "out_of_fiscal_year";
    }
    if (!args.plan) {
        return "missing_plan";
    }
    if (args.plan.fiscalYear !== args.selectedFiscalYear) {
        return "stale_fiscal_year";
    }
    return args.plan.status === "approved" ? "missing_plan" : args.plan.status;
}

export function getConsolidationBlockedReasonLabel(
    reason: ConsolidationBlockedReason,
): string {
    switch (reason) {
        case "draft":
            return "Draft plan";
        case "inactive":
            return "Inactive department";
        case "missing_plan":
            return "No plan";
        case "out_of_fiscal_year":
            return "Outside fiscal year";
        case "rejected":
            return "Rejected plan";
        case "stale_fiscal_year":
            return "Stale fiscal year";
        case "submitted":
            return "Pending approval";
    }
}
