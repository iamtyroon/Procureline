import {
    buildAvailableProcurementFiscalYears,
    deriveProcurementChecklist,
    deriveSharedSubmissionDeadline,
    formatCoverageValue,
    formatProcurementFiscalYearLabel,
    getDepartmentFiscalYearKey,
    getProcurementFiscalYearForDate,
    isValidDepartmentWindow,
    type ProcurementSubmissionDeadlineRecord,
    type ProcurementDashboardState,
    type ProcurementDepartmentWindowRecord,
} from "./dashboard";

export interface ProcurementOfficerDashboardTenantRecord {
    id: string;
    name: string;
}

export interface ProcurementOfficerDashboardDepartmentRecord
    extends ProcurementDepartmentWindowRecord {
    code: string;
    name: string;
}

export interface ProcurementOfficerDashboardAccessCodeRecord {
    departmentId: string;
    expiresAt: number;
    id: string;
    isActive: boolean;
}

export interface ProcurementOfficerDashboardDepartmentUserProfileRecord {
    deactivatedAt?: number | null;
    departmentId: string;
    id: string;
    isActive: boolean;
}

export interface ProcurementOfficerDashboardAction {
    href: string;
    label: string;
    state: ProcurementDashboardState;
}

export interface ProcurementOfficerDashboardAlert {
    cta: ProcurementOfficerDashboardAction;
    id: "deadline" | "fiscal_year";
    message: string;
    state: "warning";
    title: string;
}

export interface ProcurementOfficerDashboardSummaryCard {
    helperText: string;
    href: string;
    id:
        | "access_code_coverage"
        | "deadline_readiness"
        | "departments_configured"
        | "du_assignment_coverage";
    label: string;
    state: ProcurementDashboardState;
    statusLabel: string;
    tone: "neutral" | "positive" | "warning";
    value: string;
}

export interface ProcurementOfficerDashboardDepartmentBadge {
    label: string;
    state: ProcurementDashboardState;
}

export interface ProcurementOfficerDashboardDepartmentReadinessItem {
    accessCode: ProcurementOfficerDashboardDepartmentBadge;
    blockerSummary: string;
    code: string;
    deadline: ProcurementOfficerDashboardDepartmentBadge;
    departmentUser: ProcurementOfficerDashboardDepartmentBadge;
    id: string;
    name: string;
    overallState: ProcurementDashboardState;
    progressValue: number;
}

export interface ProcurementOfficerDashboardFuturePanel {
    cta: ProcurementOfficerDashboardAction;
    description: string;
    id:
        | "categories"
        | "consolidation"
        | "items"
        | "request_inbox"
        | "submission_monitoring";
    label: string;
    state: ProcurementDashboardState;
    statusLabel: string;
}

export interface ProcurementOfficerDashboardSnapshot {
    alerts: ProcurementOfficerDashboardAlert[];
    deadlineOverview: {
        countdownLabel: string;
        state: ProcurementDashboardState;
        targetAt: number | null;
        timeZone: string;
    };
    departmentReadiness: {
        items: ProcurementOfficerDashboardDepartmentReadinessItem[];
        state: ProcurementDashboardState;
        summary: string;
    };
    fiscalYears: {
        currentFiscalYear: string;
        options: string[];
        selectedFiscalYear: string | null;
        state: ProcurementDashboardState;
    };
    futurePanels: ProcurementOfficerDashboardFuturePanel[];
    hero: {
        description: string;
        eyebrow: string;
        primaryAction: ProcurementOfficerDashboardAction;
        secondaryAction: ProcurementOfficerDashboardAction;
        state: ProcurementDashboardState;
        title: string;
    };
    meta: {
        activeDepartmentCount: number;
        generatedAt: number;
        selectedDepartmentCount: number;
        selectedFiscalYear: string | null;
        tenantId: string;
        tenantName: string;
    };
    setupChecklist: ReturnType<typeof deriveProcurementChecklist>;
    summaryCards: ProcurementOfficerDashboardSummaryCard[];
}

export interface BuildProcurementOfficerDashboardSnapshotArgs {
    accessCodes: readonly ProcurementOfficerDashboardAccessCodeRecord[];
    departments: readonly ProcurementOfficerDashboardDepartmentRecord[];
    departmentUserProfiles: readonly ProcurementOfficerDashboardDepartmentUserProfileRecord[];
    fiscalYearStartMonth?: number | null;
    now: number;
    selectedFiscalYear?: string;
    submissionDeadlines?: readonly ProcurementSubmissionDeadlineRecord[];
    tenant: ProcurementOfficerDashboardTenantRecord;
    tenantTimeZone?: string | null;
}

export function buildProcurementOfficerDashboardSnapshot(
    args: BuildProcurementOfficerDashboardSnapshotArgs,
): ProcurementOfficerDashboardSnapshot {
    const currentFiscalYear = getProcurementFiscalYearForDate(args.now, {
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        timeZone: args.tenantTimeZone,
    }).key;
    const activeDepartments = args.departments.filter((department) => department.isActive);
    const safeFiscalYears = buildAvailableProcurementFiscalYears({
        departments: activeDepartments,
        existingFiscalYearKeys: (args.submissionDeadlines ?? []).map(
            (deadline) => deadline.fiscalYearKey,
        ),
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        now: args.now,
        requestedFiscalYear: args.selectedFiscalYear,
        timeZone: args.tenantTimeZone,
    });
    const selectedFiscalYear = resolveSelectedFiscalYear({
        currentFiscalYear,
        requestedFiscalYear: args.selectedFiscalYear,
        safeFiscalYears,
    });
    const matchedDepartments = activeDepartments.filter(
        (department) =>
            getDepartmentFiscalYearKey(department, {
                fiscalYearStartMonth: args.fiscalYearStartMonth,
                timeZone: args.tenantTimeZone,
            }) === selectedFiscalYear,
    );
    const departmentsInScope =
        matchedDepartments.length > 0 ? matchedDepartments : activeDepartments;
    const departmentIdsInScope = new Set(
        departmentsInScope.map((department) => department.id),
    );
    const accessCodeCoverage = createCoverage({
        ids: args.accessCodes
            .filter(
                (accessCode) =>
                    accessCode.isActive &&
                    accessCode.expiresAt > args.now &&
                    departmentIdsInScope.has(accessCode.departmentId),
            )
            .map((accessCode) => accessCode.departmentId),
        totalCount: departmentsInScope.length,
    });
    const departmentUserCoverage = createCoverage({
        ids: args.departmentUserProfiles
            .filter(
                (profile) =>
                    profile.isActive &&
                    profile.deactivatedAt == null &&
                    departmentIdsInScope.has(profile.departmentId),
            )
            .map((profile) => profile.departmentId),
        totalCount: departmentsInScope.length,
    });
    const deadlineCoverage = createCoverage({
        ids: departmentsInScope
            .filter((department) => isValidDepartmentWindow(department))
            .map((department) => department.id),
        totalCount: departmentsInScope.length,
    });
    const sharedDeadline = deriveSharedSubmissionDeadline({
        deadlineRecord:
            (args.submissionDeadlines ?? []).find(
                (deadline) => deadline.fiscalYearKey === selectedFiscalYear,
            ) ?? null,
        departments: departmentsInScope,
        fiscalYearKey: selectedFiscalYear,
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        now: args.now,
        tenantTimeZone: args.tenantTimeZone,
    });

    return {
        alerts: buildAlerts({
            sharedDeadline,
        }),
        deadlineOverview: {
            countdownLabel: sharedDeadline.countdownLabel,
            state: sharedDeadline.state === "available" ? "available" : "setup_required",
            targetAt: sharedDeadline.countdownTargetAt,
            timeZone: sharedDeadline.timeZone,
        },
        departmentReadiness: buildDepartmentReadiness({
            accessCodeDepartmentIds: createReadyDepartmentSet({
                ids: args.accessCodes
                    .filter(
                        (accessCode) =>
                            accessCode.isActive &&
                            accessCode.expiresAt > args.now &&
                            departmentIdsInScope.has(accessCode.departmentId),
                    )
                    .map((accessCode) => accessCode.departmentId),
            }),
            departments: departmentsInScope,
            departmentUserIds: createReadyDepartmentSet({
                ids: args.departmentUserProfiles
                    .filter(
                        (profile) =>
                            profile.isActive &&
                            profile.deactivatedAt == null &&
                            departmentIdsInScope.has(profile.departmentId),
                    )
                    .map((profile) => profile.departmentId),
            }),
            sharedDeadline,
        }),
        fiscalYears: {
            currentFiscalYear,
            options: safeFiscalYears,
            selectedFiscalYear,
            state: "available",
        },
        futurePanels: buildFuturePanels(),
        hero: buildHero({
            accessCodeCoverage,
            departmentCount: departmentsInScope.length,
            selectedFiscalYear,
            sharedDeadline,
        }),
        meta: {
            activeDepartmentCount: activeDepartments.length,
            generatedAt: args.now,
            selectedDepartmentCount: departmentsInScope.length,
            selectedFiscalYear,
            tenantId: args.tenant.id,
            tenantName: args.tenant.name,
        },
        setupChecklist: deriveProcurementChecklist({
            accessCodeCoverage,
            departmentCount: departmentsInScope.length,
            sharedDeadline,
        }),
        summaryCards: buildSummaryCards({
            accessCodeCoverage,
            currentFiscalYear,
            deadlineCoverage,
            departmentCount: departmentsInScope.length,
            departmentUserCoverage,
            selectedFiscalYear,
            sharedDeadline,
        }),
    };
}

function resolveSelectedFiscalYear(args: {
    currentFiscalYear: string;
    requestedFiscalYear?: string;
    safeFiscalYears: readonly string[];
}): string {
    if (
        args.requestedFiscalYear &&
        args.safeFiscalYears.includes(args.requestedFiscalYear)
    ) {
        return args.requestedFiscalYear;
    }

    if (args.safeFiscalYears.includes(args.currentFiscalYear)) {
        return args.currentFiscalYear;
    }

    return args.safeFiscalYears[0] ?? args.currentFiscalYear;
}

function createCoverage(args: {
    ids: readonly string[];
    totalCount: number;
}) {
    return {
        readyCount: new Set(args.ids).size,
        totalCount: args.totalCount,
    };
}

function createReadyDepartmentSet(args: {
    ids: readonly string[];
}): ReadonlySet<string> {
    return new Set(args.ids);
}

function buildAlerts(args: {
    sharedDeadline: ReturnType<typeof deriveSharedSubmissionDeadline>;
}): ProcurementOfficerDashboardAlert[] {
    const alerts: ProcurementOfficerDashboardAlert[] = [];

    if (args.sharedDeadline.state !== "available") {
        alerts.push({
            cta: {
                href: "/po/deadlines",
                label: "Configure deadline",
                state: "setup_required",
            },
            id: "deadline",
            message: "Submission deadline not set. Configure before DUs can submit.",
            state: "warning",
            title: "Shared deadline missing",
        });
    }

    return alerts;
}

function buildHero(args: {
    accessCodeCoverage: { readyCount: number; totalCount: number };
    departmentCount: number;
    selectedFiscalYear: string;
    sharedDeadline: ReturnType<typeof deriveSharedSubmissionDeadline>;
}): ProcurementOfficerDashboardSnapshot["hero"] {
    if (args.departmentCount === 0) {
        return {
            description:
                "Start with departments first so access codes, deadline setup, and DU onboarding have a truthful place to anchor.",
            eyebrow: "Preparation dashboard",
            primaryAction: {
                href: "/po/departments",
                label: "Create your first department",
                state: "available",
            },
            secondaryAction: {
                href: "/po/access-codes",
                label: "Access codes follow departments",
                state: "coming_soon",
            },
            state: "empty",
            title: "Build your procurement workspace",
        };
    }

    if (args.sharedDeadline.state !== "available") {
        return {
            description:
                "Preparation work is underway, but DUs should not receive a deadline until one safe shared window is configured for every active department.",
            eyebrow: formatProcurementFiscalYearLabel(args.selectedFiscalYear),
            primaryAction: {
                href: "/po/deadlines",
                label: "Configure submission deadline",
                state: "setup_required",
            },
            secondaryAction: {
                href: "/po/access-codes",
                label: "Open access codes",
                state: "available",
            },
            state: "setup_required",
            title: "Preparation is in progress",
        };
    }

    if (args.accessCodeCoverage.readyCount < args.accessCodeCoverage.totalCount) {
        return {
            description:
                "Departments are live for the selected fiscal year, but some DUs still need active access codes before onboarding can finish cleanly.",
            eyebrow: formatProcurementFiscalYearLabel(args.selectedFiscalYear),
            primaryAction: {
                href: "/po/access-codes",
                label: "Open access codes",
                state: "available",
            },
            secondaryAction: {
                href: "/po/departments",
                label: "Open departments",
                state: "available",
            },
            state: "setup_required",
            title: "Finish procurement onboarding",
        };
    }

    return {
        description:
            "The prep phase is configured for the selected fiscal year. Use the readiness list to spot the last departments that still need follow-through.",
        eyebrow: formatProcurementFiscalYearLabel(args.selectedFiscalYear),
        primaryAction: {
            href: "/po/departments",
            label: "Open departments",
            state: "available",
        },
        secondaryAction: {
            href: "/po/consolidation",
            label: "Consolidation coming soon",
            state: "coming_soon",
        },
        state: "available",
        title: "Preparation dashboard is live",
    };
}

function buildSummaryCards(args: {
    accessCodeCoverage: { readyCount: number; totalCount: number };
    currentFiscalYear: string;
    deadlineCoverage: { readyCount: number; totalCount: number };
    departmentCount: number;
    departmentUserCoverage: { readyCount: number; totalCount: number };
    selectedFiscalYear: string;
    sharedDeadline: ReturnType<typeof deriveSharedSubmissionDeadline>;
}): ProcurementOfficerDashboardSummaryCard[] {
    const selectedFiscalYearLabel = formatProcurementFiscalYearLabel(
        args.selectedFiscalYear,
    );

    return [
        {
            helperText:
                args.departmentCount === 0
                    ? "No active departments are configured for procurement prep yet."
                    : `${args.departmentCount} active department${args.departmentCount === 1 ? "" : "s"} are currently in scope for ${selectedFiscalYearLabel}.`,
            href: "/po/departments",
            id: "departments_configured",
            label: "Departments configured",
            state: args.departmentCount === 0 ? "empty" : "available",
            statusLabel: args.departmentCount === 0 ? "Create departments" : "In scope",
            tone: args.departmentCount === 0 ? "warning" : "positive",
            value: String(args.departmentCount),
        },
        {
            helperText:
                args.departmentCount === 0
                    ? "Access-code coverage appears after departments exist."
                    : "Only currently valid active codes count, and each department contributes once.",
            href: "/po/access-codes",
            id: "access_code_coverage",
            label: "Access-code coverage",
            state:
                args.departmentCount === 0
                    ? "setup_required"
                    : args.accessCodeCoverage.readyCount === args.accessCodeCoverage.totalCount
                      ? "available"
                      : "setup_required",
            statusLabel:
                args.departmentCount === 0
                    ? "Not configured"
                    : args.accessCodeCoverage.readyCount === args.accessCodeCoverage.totalCount
                      ? "Ready"
                      : "Action needed",
            tone:
                args.departmentCount > 0 &&
                args.accessCodeCoverage.readyCount === args.accessCodeCoverage.totalCount
                    ? "positive"
                    : "warning",
            value: formatCoverageValue(args.accessCodeCoverage),
        },
        {
            helperText:
                args.departmentCount === 0
                    ? "DU assignment coverage appears after departments exist."
                    : "Only active, non-deactivated department-user profiles count toward readiness.",
            href: "/po/departments",
            id: "du_assignment_coverage",
            label: "DU assignment coverage",
            state:
                args.departmentCount === 0
                    ? "setup_required"
                    : args.departmentUserCoverage.readyCount ===
                        args.departmentUserCoverage.totalCount
                      ? "available"
                      : "setup_required",
            statusLabel:
                args.departmentCount === 0
                    ? "Not configured"
                    : args.departmentUserCoverage.readyCount ===
                        args.departmentUserCoverage.totalCount
                      ? "Ready"
                      : "Needs follow-up",
            tone:
                args.departmentCount > 0 &&
                args.departmentUserCoverage.readyCount ===
                    args.departmentUserCoverage.totalCount
                    ? "positive"
                    : "warning",
            value: formatCoverageValue(args.departmentUserCoverage),
        },
        {
            helperText:
                args.departmentCount === 0
                    ? "Deadline readiness appears after departments exist."
                    : args.sharedDeadline.state === "available"
                      ? `Shared deadline safely resolves to ${args.sharedDeadline.label} in ${args.sharedDeadline.timeZone}.`
                      : "Every department needs a valid window before the tenant-wide deadline can be trusted.",
            href: "/po/deadlines",
            id: "deadline_readiness",
            label: "Deadline readiness",
            state:
                args.departmentCount === 0
                    ? "setup_required"
                    : args.sharedDeadline.state === "available"
                      ? "available"
                      : "setup_required",
            statusLabel:
                args.departmentCount === 0
                    ? "Not configured"
                    : args.sharedDeadline.state === "available"
                      ? "Shared deadline ready"
                      : "Shared deadline pending",
            tone:
                args.departmentCount > 0 && args.sharedDeadline.state === "available"
                    ? "positive"
                    : "warning",
            value:
                args.departmentCount > 0 && args.sharedDeadline.state === "available"
                    ? args.sharedDeadline.countdownLabel
                    : formatCoverageValue(args.deadlineCoverage),
        },
    ];
}

function buildDepartmentReadiness(args: {
    accessCodeDepartmentIds: ReadonlySet<string>;
    departments: readonly ProcurementOfficerDashboardDepartmentRecord[];
    departmentUserIds: ReadonlySet<string>;
    sharedDeadline: ReturnType<typeof deriveSharedSubmissionDeadline>;
}): ProcurementOfficerDashboardSnapshot["departmentReadiness"] {
    if (args.departments.length === 0) {
        return {
            items: [],
            state: "empty",
            summary: "No departments are configured yet.",
        };
    }

    const items = [...args.departments]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((department) => {
            const accessCodeReady = args.accessCodeDepartmentIds.has(department.id);
            const departmentUserReady = args.departmentUserIds.has(department.id);
            const deadlineReady = isValidDepartmentWindow(department);
            const accessCodeState: ProcurementDashboardState = accessCodeReady
                ? "available"
                : "setup_required";
            const departmentUserState: ProcurementDashboardState = departmentUserReady
                ? "available"
                : "setup_required";
            const deadlineState: ProcurementDashboardState = deadlineReady
                ? "available"
                : "setup_required";
            const progressValue = Math.round(
                ([accessCodeReady, departmentUserReady, deadlineReady].filter(Boolean)
                    .length /
                    3) *
                    100,
            );
            const blockers: string[] = [];

            if (!accessCodeReady) {
                blockers.push("Access code missing.");
            }
            if (!departmentUserReady) {
                blockers.push("No active DU assigned.");
            }
            if (!deadlineReady) {
                blockers.push("Submission window invalid.");
            }
            if (blockers.length === 0 && args.sharedDeadline.state !== "available") {
                blockers.push("Awaiting one shared tenant-wide deadline.");
            }
            const overallState: ProcurementDashboardState =
                blockers.length === 0 ? "available" : "setup_required";

            return {
                accessCode: {
                    label: accessCodeReady ? "Ready" : "Setup required",
                    state: accessCodeState,
                },
                blockerSummary: blockers[0] ?? "Ready for Departmental Users.",
                code: department.code,
                deadline: {
                    label: deadlineReady ? "Window set" : "Setup required",
                    state: deadlineState,
                },
                departmentUser: {
                    label: departmentUserReady ? "Assigned" : "Setup required",
                    state: departmentUserState,
                },
                id: department.id,
                name: department.name,
                overallState,
                progressValue,
            };
        });

    return {
        items,
        state: "available",
        summary:
            args.sharedDeadline.state === "available"
                ? "Department readiness reflects access codes, DU coverage, and deadline setup."
                : "Department readiness is visible, but the shared deadline still needs honest setup.",
    };
}

function buildFuturePanels(): ProcurementOfficerDashboardFuturePanel[] {
    return [
        {
            cta: {
                href: "/po/categories",
                label: "Categories coming soon",
                state: "coming_soon",
            },
            description:
                "Category management is reserved for a later Epic 4 story, so this panel intentionally avoids fake totals.",
            id: "categories",
            label: "Categories",
            state: "coming_soon",
            statusLabel: "Awaiting later story",
        },
        {
            cta: {
                href: "/po/categories/items",
                label: "Items coming soon",
                state: "coming_soon",
            },
            description:
                "Item catalog setup stays staged until live item sources land, rather than copying prototype internals into production early.",
            id: "items",
            label: "Items",
            state: "coming_soon",
            statusLabel: "Awaiting later story",
        },
        {
            cta: {
                href: "/po/requests",
                label: "Requests go live later",
                state: "unavailable",
            },
            description:
                "Request review depends on later-story request queues, so counts and inbox badges remain unavailable on purpose.",
            id: "request_inbox",
            label: "Request inbox",
            state: "unavailable",
            statusLabel: "Unavailable",
        },
        {
            cta: {
                href: "/po/requests",
                label: "Submission monitoring later",
                state: "unavailable",
            },
            description:
                "Submission monitoring is reserved for a later story, so this dashboard does not invent pending-plan or overdue totals.",
            id: "submission_monitoring",
            label: "Submission monitoring",
            state: "unavailable",
            statusLabel: "Unavailable",
        },
        {
            cta: {
                href: "/po/consolidation",
                label: "Consolidation coming soon",
                state: "coming_soon",
            },
            description:
                "Consolidation remains a future workflow until reviewed department plans become a real live source in Epic 7.",
            id: "consolidation",
            label: "Consolidation",
            state: "coming_soon",
            statusLabel: "Future workflow",
        },
    ];
}
