"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidDepartmentWindow = exports.formatCoverageValue = exports.deriveProcurementChecklist = exports.deriveSharedSubmissionDeadline = exports.buildAvailableProcurementFiscalYears = exports.getDepartmentFiscalYearKey = exports.resolveProcurementOfficerWorkspaceNavigation = exports.buildProcurementOfficerWorkspaceModalPath = exports.normalizeProcurementOfficerWorkspaceModalState = exports.isProcurementOfficerWorkspaceSection = exports.isProcurementOfficerWorkspaceModal = exports.formatProcurementFiscalYearLabel = exports.getProcurementFiscalYearForDate = exports.PROCUREMENT_OFFICER_WORKSPACE_SECTIONS = exports.PROCUREMENT_OFFICER_WORKSPACE_MODALS = void 0;
const dashboard_1 = require("../tenant-admin/dashboard");
const deadlines_1 = require("./deadlines");
exports.PROCUREMENT_OFFICER_WORKSPACE_MODALS = [
    "access-codes",
    "categories",
    "deadlines",
    "departments",
    "requests",
];
exports.PROCUREMENT_OFFICER_WORKSPACE_SECTIONS = ["items"];
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
function isProcurementOfficerWorkspaceSection(value) {
    return exports.PROCUREMENT_OFFICER_WORKSPACE_SECTIONS.some((section) => section === value);
}
exports.isProcurementOfficerWorkspaceSection = isProcurementOfficerWorkspaceSection;
function normalizeProcurementOfficerWorkspaceModalState(args) {
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
exports.normalizeProcurementOfficerWorkspaceModalState = normalizeProcurementOfficerWorkspaceModalState;
function buildProcurementOfficerWorkspaceModalPath(state) {
    const searchParams = new URLSearchParams({
        modal: state.modal,
    });
    if (state.modal === "categories" && state.section) {
        searchParams.set("section", state.section);
    }
    return `/po?${searchParams.toString()}`;
}
exports.buildProcurementOfficerWorkspaceModalPath = buildProcurementOfficerWorkspaceModalPath;
function resolveProcurementOfficerWorkspaceNavigation(href) {
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
    const accessCodesReady = hasDepartments &&
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
            description: "Categories will stay honest until Story 4.7 lands with live data and management flows.",
            href: "/po/categories",
            id: "add_categories",
            label: "Add Categories",
            state: "coming_soon",
            statusLabel: "Awaiting later story",
        },
        {
            description: "Item catalog setup is reserved for Story 4.8, so the dashboard keeps this step explicitly staged.",
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
