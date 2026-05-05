"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConsolidationBlockedReasonLabel = exports.validateConsolidationDraftPayload = exports.selectCanonicalApprovedPlansByDepartment = exports.buildConsolidationReadiness = exports.normalizeConsolidationFiscalYear = exports.CONSOLIDATION_EMPTY_MESSAGE = exports.CONSOLIDATION_DRAFT_SCHEMA_VERSION = void 0;
const dashboard_1 = require("./dashboard");
exports.CONSOLIDATION_DRAFT_SCHEMA_VERSION = 1;
exports.CONSOLIDATION_EMPTY_MESSAGE = "No approved plans available for consolidation. Approve department submissions first.";
function normalizeConsolidationFiscalYear(args) {
    const requestedFiscalYear = args.requestedFiscalYear && /^\d{4}-\d{4}$/.test(args.requestedFiscalYear)
        ? args.requestedFiscalYear
        : undefined;
    const currentFiscalYear = (0, dashboard_1.getProcurementFiscalYearForDate)(args.now, {
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        timeZone: args.tenantTimeZone,
    }).key;
    const options = (0, dashboard_1.buildAvailableProcurementFiscalYears)({
        departments: args.departments,
        existingFiscalYearKeys: args.submissionDeadlineFiscalYears,
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        now: args.now,
        requestedFiscalYear: undefined,
        timeZone: args.tenantTimeZone,
    });
    if (requestedFiscalYear &&
        options.includes(requestedFiscalYear)) {
        return { currentFiscalYear, options, selectedFiscalYear: requestedFiscalYear };
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
exports.normalizeConsolidationFiscalYear = normalizeConsolidationFiscalYear;
function buildConsolidationReadiness(args) {
    const activeDepartments = args.departments.filter((department) => department.isActive);
    const departmentsInFiscalYear = activeDepartments.filter((department) => (0, dashboard_1.getDepartmentFiscalYearKey)(department, {
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        timeZone: args.tenantTimeZone,
    }) === args.selectedFiscalYear);
    const scopedDepartments = departmentsInFiscalYear.length > 0 ? departmentsInFiscalYear : activeDepartments;
    const canonicalApprovedPlans = selectCanonicalApprovedPlansByDepartment({
        plans: args.plans,
        selectedFiscalYear: args.selectedFiscalYear,
    });
    const plansByDepartment = groupPlansByDepartment(args.plans);
    const readyDepartments = [];
    const blockedDepartments = [];
    for (const department of [...scopedDepartments].sort((left, right) => left.name.localeCompare(right.name))) {
        const canonicalApprovedPlan = canonicalApprovedPlans.get(department.id) ?? null;
        if (canonicalApprovedPlan) {
            readyDepartments.push({
                approvedAt: canonicalApprovedPlan.approvedAt ?? null,
                departmentCode: department.code,
                departmentId: department.id,
                departmentName: canonicalApprovedPlan.departmentNameSnapshot ?? department.name,
                estimatedBudgetUsed: canonicalApprovedPlan.estimatedBudgetUsed,
                itemCount: canonicalApprovedPlan.itemCount,
                planId: canonicalApprovedPlan.id,
                voteNumber: department.voteNumber ?? department.code,
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
        selectedFiscalYearLabel: (0, dashboard_1.formatProcurementFiscalYearLabel)(args.selectedFiscalYear),
        totalBudget: readyDepartments.reduce((total, department) => total + Math.max(0, department.estimatedBudgetUsed), 0),
        totalDepartmentCount: scopedDepartments.length,
        totalItemCount: readyDepartments.reduce((total, department) => total + Math.max(0, department.itemCount), 0),
    };
}
exports.buildConsolidationReadiness = buildConsolidationReadiness;
function selectCanonicalApprovedPlansByDepartment(args) {
    const approvedPlans = args.plans.filter((plan) => plan.fiscalYear === args.selectedFiscalYear &&
        plan.status === "approved");
    const selected = new Map();
    for (const plan of approvedPlans) {
        const existing = selected.get(plan.departmentId);
        if (!existing || compareApprovedPlanRecency(plan, existing) > 0) {
            selected.set(plan.departmentId, plan);
        }
    }
    return selected;
}
exports.selectCanonicalApprovedPlansByDepartment = selectCanonicalApprovedPlansByDepartment;
function validateConsolidationDraftPayload(args) {
    if (args.selectedSourceDepartmentIds.length > 100) {
        return {
            ok: false,
            message: "A consolidation draft cannot select more than 100 source departments.",
        };
    }
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
exports.validateConsolidationDraftPayload = validateConsolidationDraftPayload;
function validateWorkspaceJsonLike(value) {
    let serialized = "";
    try {
        serialized = JSON.stringify(value);
    }
    catch {
        return {
            ok: false,
            message: "Workspace state must be JSON serializable.",
        };
    }
    if (serialized.length > 200_000) {
        return {
            ok: false,
            message: "Workspace state is too large to save safely.",
        };
    }
    const stats = inspectJsonShape(value);
    if (stats.depth > 24) {
        return {
            ok: false,
            message: "Workspace state is nested too deeply to save safely.",
        };
    }
    if (stats.blockCount > 500) {
        return {
            ok: false,
            message: "Workspace state contains too many blocks for this draft shell.",
        };
    }
    return { ok: true };
}
function inspectJsonShape(value) {
    const stack = [{ depth: 1, value }];
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
        if (!Array.isArray(current.value) &&
            typeof current.value.type === "string") {
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
function compareApprovedPlanRecency(left, right) {
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
function groupPlansByDepartment(plans) {
    const grouped = new Map();
    for (const plan of plans) {
        grouped.set(plan.departmentId, [...(grouped.get(plan.departmentId) ?? []), plan]);
    }
    return grouped;
}
function selectMostRelevantNonApprovedPlan(args) {
    return ([...args.plans]
        .filter((plan) => plan.fiscalYear === args.selectedFiscalYear)
        .sort((left, right) => right.updatedAt - left.updatedAt || right.id.localeCompare(left.id))[0] ??
        null);
}
function resolveBlockedDepartmentReason(args) {
    const departmentFiscalYear = (0, dashboard_1.getDepartmentFiscalYearKey)(args.department, {
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
function getConsolidationBlockedReasonLabel(reason) {
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
exports.getConsolidationBlockedReasonLabel = getConsolidationBlockedReasonLabel;
