"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidDepartmentWindow = exports.formatCoverageValue = exports.deriveProcurementChecklist = exports.deriveSharedSubmissionDeadline = exports.buildAvailableProcurementFiscalYears = exports.getDepartmentFiscalYearKey = exports.resolveProcurementOfficerWorkspaceNavigation = exports.buildProcurementOfficerWorkspaceModalPath = exports.normalizeProcurementOfficerWorkspaceModalState = exports.isProcurementOfficerWorkspaceModal = exports.formatProcurementFiscalYearLabel = exports.getProcurementFiscalYearForDate = exports.PROCUREMENT_OFFICER_WORKSPACE_MODALS = void 0;
const dashboard_1 = require("../tenant-admin/dashboard");
const deadlines_1 = require("./deadlines");
const dashboard_search_1 = require("./dashboard-search");
exports.PROCUREMENT_OFFICER_WORKSPACE_MODALS = [
    "deadlines",
    "requests",
    "review",
];
function getProcurementFiscalYearForDate(input, args) {
    if (!args?.timeZone && !args?.fiscalYearStartMonth) {
        return (0, dashboard_1.getFiscalYearForDate)(input);
    }
    const resolvedTimeZone = (0, deadlines_1.resolveDeadlineTimeZone)({
        tenantTimeZone: args.timeZone,
    });
    const timestamp = input instanceof Date ? input.getTime() : input;
    const fiscalYear = (0, deadlines_1.getFiscalYearForTimestampInTimeZone)({
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
exports.getProcurementFiscalYearForDate = getProcurementFiscalYearForDate;
function formatProcurementFiscalYearLabel(fiscalYearKey) {
    return (0, dashboard_1.formatFiscalYearLabel)(fiscalYearKey);
}
exports.formatProcurementFiscalYearLabel = formatProcurementFiscalYearLabel;
function isProcurementOfficerWorkspaceModal(value) {
    return exports.PROCUREMENT_OFFICER_WORKSPACE_MODALS.some((modal) => modal === value);
}
exports.isProcurementOfficerWorkspaceModal = isProcurementOfficerWorkspaceModal;
function normalizeProcurementOfficerWorkspaceModalState(args) {
    if (!isProcurementOfficerWorkspaceModal(args.modal)) {
        return null;
    }
    if (args.modal === "review") {
        const planId = args.planId?.trim() ?? "";
        if (planId.length === 0) {
            return null;
        }
        return {
            modal: "review",
            planId,
        };
    }
    return {
        modal: args.modal,
    };
}
exports.normalizeProcurementOfficerWorkspaceModalState = normalizeProcurementOfficerWorkspaceModalState;
function buildProcurementOfficerWorkspaceModalPath(state, options) {
    const searchParams = new URLSearchParams({
        modal: state.modal,
    });
    const dashboardSearchParams = options?.dashboardSearchParams
        ? (0, dashboard_search_1.extractProcurementOfficerDashboardSearchParams)(options.dashboardSearchParams)
        : new URLSearchParams();
    dashboardSearchParams.forEach((value, key) => {
        searchParams.append(key, value);
    });
    if (state.modal === "review") {
        searchParams.set("planId", state.planId);
    }
    return `/po?${searchParams.toString()}`;
}
exports.buildProcurementOfficerWorkspaceModalPath = buildProcurementOfficerWorkspaceModalPath;
function resolveProcurementOfficerWorkspaceNavigation(href) {
    const targetUrl = new URL(href, "https://procureline.local");
    switch (targetUrl.pathname) {
        case "/po/departments":
            return {
                href: `${targetUrl.pathname}${targetUrl.search}`,
                type: "route",
            };
        case "/po/deadlines":
            return {
                href: buildProcurementOfficerWorkspaceModalPath({
                    modal: "deadlines",
                }, {
                    dashboardSearchParams: targetUrl.searchParams,
                }),
                type: "modal",
                modalState: { modal: "deadlines" },
            };
        case "/po/requests":
            return {
                href: buildProcurementOfficerWorkspaceModalPath({
                    modal: "requests",
                }, {
                    dashboardSearchParams: targetUrl.searchParams,
                }),
                type: "modal",
                modalState: { modal: "requests" },
            };
        case "/po/submissions":
            {
                const dashboardSearchParams = (0, dashboard_search_1.extractProcurementOfficerDashboardSearchParams)(targetUrl.searchParams);
                const query = dashboardSearchParams.toString();
                return {
                    href: query.length > 0 ? `/po?${query}` : "/po",
                    type: "route",
                };
            }
        case "/po/review": {
            const planId = targetUrl.searchParams.get("planId")?.trim() ?? "";
            if (planId.length === 0) {
                const dashboardSearchParams = (0, dashboard_search_1.extractProcurementOfficerDashboardSearchParams)(targetUrl.searchParams);
                const query = dashboardSearchParams.toString();
                return {
                    href: query.length > 0 ? `/po?${query}` : "/po",
                    type: "route",
                };
            }
            return {
                href: buildProcurementOfficerWorkspaceModalPath({
                    modal: "review",
                    planId,
                }, {
                    dashboardSearchParams: targetUrl.searchParams,
                }),
                type: "modal",
                modalState: {
                    modal: "review",
                    planId,
                },
            };
        }
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
exports.resolveProcurementOfficerWorkspaceNavigation = resolveProcurementOfficerWorkspaceNavigation;
function getDepartmentFiscalYearKey(department, args) {
    if (!department.isActive ||
        typeof department.submissionStartsAt !== "number" ||
        typeof department.submissionEndsAt !== "number" ||
        department.submissionEndsAt <= department.submissionStartsAt) {
        return null;
    }
    const resolvedTimeZone = (0, deadlines_1.resolveDeadlineTimeZone)({
        tenantTimeZone: args?.timeZone,
    });
    const startFiscalYear = (0, deadlines_1.getFiscalYearForTimestampInTimeZone)({
        fiscalYearStartMonth: args?.fiscalYearStartMonth,
        timeZone: resolvedTimeZone.timeZone,
        timestamp: department.submissionStartsAt,
    }).key;
    const endFiscalYear = (0, deadlines_1.getFiscalYearForTimestampInTimeZone)({
        fiscalYearStartMonth: args?.fiscalYearStartMonth,
        timeZone: resolvedTimeZone.timeZone,
        timestamp: department.submissionEndsAt,
    }).key;
    return startFiscalYear === endFiscalYear ? startFiscalYear : null;
}
exports.getDepartmentFiscalYearKey = getDepartmentFiscalYearKey;
function buildAvailableProcurementFiscalYears(args) {
    const safeYears = new Set(args.existingFiscalYearKeys ?? []);
    for (const department of args.departments) {
        const fiscalYearKey = getDepartmentFiscalYearKey(department, {
            fiscalYearStartMonth: args.fiscalYearStartMonth,
            timeZone: args.timeZone,
        });
        if (fiscalYearKey) {
            safeYears.add(fiscalYearKey);
        }
    }
    return (0, deadlines_1.buildDeadlineFiscalYearOptions)({
        existingFiscalYearKeys: Array.from(safeYears),
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        now: args.now,
        requestedFiscalYear: args.requestedFiscalYear,
        timeZone: (0, deadlines_1.resolveDeadlineTimeZone)({
            tenantTimeZone: args.timeZone,
        }).timeZone,
    });
}
exports.buildAvailableProcurementFiscalYears = buildAvailableProcurementFiscalYears;
function deriveSharedSubmissionDeadline(args) {
    const resolved = (0, deadlines_1.resolveSubmissionDeadline)({
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
        label: deadlineAt === null
            ? "Not configured"
            : (0, deadlines_1.formatDeadlineDate)(deadlineAt, resolved.timeZone),
        reason: resolved.reason,
        reminderOffsets: resolved.reminderOffsets,
        source: resolved.source,
        startAt: resolved.submissionStartsAt,
        state: resolved.state,
        timeZone: resolved.timeZone,
        timeZoneUsesFallback: resolved.timeZoneUsesFallback,
    };
}
exports.deriveSharedSubmissionDeadline = deriveSharedSubmissionDeadline;
function deriveProcurementChecklist(args) {
    const hasDepartments = args.departmentCount > 0;
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
            description: "Create, reorder, archive, and maintain category metadata from the shared PO dashboard workspace.",
            href: "/po/categories",
            id: "add_categories",
            label: "Add Categories",
            state: "available",
            statusLabel: "Live workspace",
        },
        {
            description: "Add, move, archive, and import live catalog items inside the shared categories and items workspace.",
            href: "/po/items",
            id: "add_items",
            label: "Add Items",
            state: "available",
            statusLabel: "Live workspace",
        },
        {
            description: !hasDepartments
                ? "Department-code generation unlocks after departments exist."
                : "Generate and email each Department User code from the department editor.",
            href: "/po/departments",
            id: "generate_department_codes",
            label: "Generate Department Codes",
            state: hasDepartments ? "available" : "setup_required",
            statusLabel: hasDepartments ? "Use department editor" : "Action needed",
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
exports.deriveProcurementChecklist = deriveProcurementChecklist;
function formatCoverageValue(args) {
    if (args.totalCount === 0) {
        return "Not configured";
    }
    return `${args.readyCount} / ${args.totalCount}`;
}
exports.formatCoverageValue = formatCoverageValue;
function isValidDepartmentWindow(department) {
    return (typeof department.submissionStartsAt === "number" &&
        typeof department.submissionEndsAt === "number" &&
        department.submissionEndsAt > department.submissionStartsAt);
}
exports.isValidDepartmentWindow = isValidDepartmentWindow;
