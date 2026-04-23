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
import {
    summarizeProcurementOfficerSubmissionQueue,
    type ProcurementOfficerSubmissionStatus,
} from "./submissions";

export interface ProcurementOfficerDashboardTenantRecord {
    id: string;
    name: string;
}

export interface ProcurementOfficerDashboardDepartmentRecord
    extends ProcurementDepartmentWindowRecord {
    budgetAllocation?: number | null;
    code: string;
    name: string;
    voteNumber: string;
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

export interface ProcurementOfficerDashboardPlanSummaryRecord {
    departmentId: string;
    estimatedBudgetUsed: number;
    fiscalYear: string;
    itemCount: number;
    status: ProcurementOfficerSubmissionStatus;
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
    budgetStatus: ProcurementOfficerDashboardDepartmentBadge;
    code: string;
    deadline: ProcurementOfficerDashboardDepartmentBadge;
    departmentUser: ProcurementOfficerDashboardDepartmentBadge;
    id: string;
    name: string;
    overallState: ProcurementDashboardState;
    progressValue: number;
    voteNumber: string;
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
    organizationOverview: {
        activeDepartmentCount: number;
        activeUserCount: number;
        budget: {
            state: ProcurementDashboardState;
            totalBudget: number;
            totalBudgetLabel: string;
            usedBudget: number;
            usedBudgetLabel: string;
            utilizationPercent: number;
        };
        totalItemCount: number;
    };
    meta: {
        activeDepartmentCount: number;
        generatedAt: number;
        selectedDepartmentCount: number;
        selectedFiscalYear: string | null;
        tenantId: string;
        tenantName: string;
    };
    submissionProgress: {
        approvedDepartmentCount: number;
        helperText: string;
        state: ProcurementDashboardState;
        submittedDepartmentCount: number;
        totalDepartmentCount: number;
        utilizationPercent: number;
    };
    setupChecklist: ReturnType<typeof deriveProcurementChecklist>;
    summaryCards: ProcurementOfficerDashboardSummaryCard[];
}

export interface BuildProcurementOfficerDashboardSnapshotArgs {
  accessCodes: readonly ProcurementOfficerDashboardAccessCodeRecord[];
  activeItemCount?: number;
  departments: readonly ProcurementOfficerDashboardDepartmentRecord[];
  departmentUserProfiles: readonly ProcurementOfficerDashboardDepartmentUserProfileRecord[];
  fiscalYearStartMonth?: number | null;
  now: number;
  plans?: readonly ProcurementOfficerDashboardPlanSummaryRecord[];
  requestSummary?: {
    pendingCategoryCount: number;
    pendingItemCount: number;
    totalCount: number;
    totalPendingCount: number;
  } | null;
  selectedFiscalYear?: string;
  submissionDeadlines?: readonly ProcurementSubmissionDeadlineRecord[];
  tenant: ProcurementOfficerDashboardTenantRecord;
  tenantBudgetCeiling?: number | null;
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
    const submissionSummary = summarizeProcurementOfficerSubmissionQueue({
        plans: args.plans ?? [],
        selectedFiscalYear,
    });
    const submissionProgress = buildSubmissionProgress({
        departmentIdsInScope,
        departmentCount: departmentsInScope.length,
        plans: args.plans ?? [],
        selectedFiscalYear,
    });
    const organizationOverview = buildOrganizationOverview({
        activeItemCount: args.activeItemCount ?? 0,
        activeUserCount: args.departmentUserProfiles.filter(
            (profile) => profile.isActive && profile.deactivatedAt == null,
        ).length,
        departmentCount: departmentsInScope.length,
        departmentIdsInScope,
        departments: departmentsInScope,
        plans: args.plans ?? [],
        selectedFiscalYear,
        tenantBudgetCeiling: args.tenantBudgetCeiling ?? null,
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
            plans: args.plans ?? [],
            selectedFiscalYear,
            sharedDeadline,
        }),
        fiscalYears: {
            currentFiscalYear,
            options: safeFiscalYears,
            selectedFiscalYear,
            state: "available",
        },
        futurePanels: buildFuturePanels({
            requestSummary: args.requestSummary ?? null,
            submissionSummary,
        }),
        hero: buildHero({
            accessCodeCoverage,
            departmentCount: departmentsInScope.length,
            selectedFiscalYear,
            sharedDeadline,
        }),
        organizationOverview,
        meta: {
            activeDepartmentCount: activeDepartments.length,
            generatedAt: args.now,
            selectedDepartmentCount: departmentsInScope.length,
            selectedFiscalYear,
            tenantId: args.tenant.id,
            tenantName: args.tenant.name,
        },
        submissionProgress,
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
                label: "Add department",
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
            label: "Add department",
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
    plans: readonly ProcurementOfficerDashboardPlanSummaryRecord[];
    selectedFiscalYear: string;
    sharedDeadline: ReturnType<typeof deriveSharedSubmissionDeadline>;
}): ProcurementOfficerDashboardSnapshot["departmentReadiness"] {
    if (args.departments.length === 0) {
        return {
            items: [],
            state: "empty",
            summary: "No departments are configured yet.",
        };
    }

    const plansByDepartmentId = new Map(
        args.plans
            .filter((plan) => plan.fiscalYear === args.selectedFiscalYear)
            .map((plan) => [plan.departmentId, plan] as const),
    );

    const items = [...args.departments]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((department) => {
            const departmentPlan = plansByDepartmentId.get(department.id) ?? null;
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
            const budgetStatus = resolveDepartmentBudgetStatus({
                budgetAllocation: department.budgetAllocation ?? null,
                estimatedBudgetUsed: departmentPlan?.estimatedBudgetUsed ?? null,
            });

            return {
                accessCode: {
                    label: accessCodeReady ? "Ready" : "Setup required",
                    state: accessCodeState,
                },
                blockerSummary: blockers[0] ?? "Ready for Departmental Users.",
                budgetStatus,
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
                voteNumber: department.voteNumber,
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

function resolveDepartmentBudgetStatus(args: {
    budgetAllocation?: number | null;
    estimatedBudgetUsed?: number | null;
}): ProcurementOfficerDashboardDepartmentBadge {
    const budgetAllocation =
        typeof args.budgetAllocation === "number" && args.budgetAllocation > 0
            ? args.budgetAllocation
            : null;

    if (budgetAllocation === null) {
        return {
            label: "Budget not set",
            state: "setup_required",
        };
    }

    if (typeof args.estimatedBudgetUsed !== "number") {
        return {
            label: "Awaiting plan submission",
            state: "empty",
        };
    }

    const usedBudget = Math.max(0, args.estimatedBudgetUsed);
    const utilizationPercent = Math.round((usedBudget / budgetAllocation) * 100);

    if (usedBudget > budgetAllocation) {
        return {
            label: `Over budget (${utilizationPercent}%)`,
            state: "setup_required",
        };
    }

    return {
        label: `Within budget (${utilizationPercent}%)`,
        state: "available",
    };
}

function buildFuturePanels(args?: {
    requestSummary?: {
        pendingCategoryCount: number;
        pendingItemCount: number;
        totalCount: number;
        totalPendingCount: number;
    } | null;
    submissionSummary?: {
        approvedCount: number;
        rejectedCount: number;
        selectedFiscalYearCount: number;
        submittedCount: number;
        totalCount: number;
    } | null;
}): ProcurementOfficerDashboardFuturePanel[] {
    const pendingTotal = args?.requestSummary?.totalPendingCount ?? 0;
    const totalCount = args?.requestSummary?.totalCount ?? 0;
    const requestState: ProcurementDashboardState =
        totalCount === 0 ? "empty" : "available";
    const requestStatusLabel =
        pendingTotal > 0 ? `${pendingTotal} pending` : "No pending";
    const requestDescription =
        totalCount === 0
            ? "No catalog requests have been submitted yet. This inbox will light up as DUs submit item or category requests."
            : "Review live item and category requests across departments, with bulk actions and request history in the same dashboard shell.";
    const selectedSubmissionCount =
        args?.submissionSummary?.selectedFiscalYearCount ?? 0;
    const totalSubmissionCount = args?.submissionSummary?.totalCount ?? 0;
    const submissionState: ProcurementDashboardState =
        selectedSubmissionCount > 0
            ? "available"
            : "empty";
    const submissionStatusLabel =
        selectedSubmissionCount > 0
            ? `${selectedSubmissionCount} in queue`
            : totalSubmissionCount > 0
              ? "Other fiscal years only"
              : "No submissions";
    const submissionDescription =
        selectedSubmissionCount > 0
            ? "Review submitted plans directly from the dashboard card, then open a simple summary modal for the selected department plan."
            : totalSubmissionCount > 0
              ? "This fiscal year has no matching plans yet, but the tenant already has submissions in other fiscal years."
              : "No submitted or reviewed plans are available yet. This queue will update live as departments submit.";

    return [
        {
            cta: {
                href: "/po/categories",
                label: "Open categories workspace",
                state: "available",
            },
            description:
                "Category management now runs inside the PO dashboard modal with live catalog counts and ordering controls.",
            id: "categories",
            label: "Categories",
            state: "available",
            statusLabel: "Live workspace",
        },
        {
            cta: {
                href: "/po/categories/items",
                label: "Open items workspace",
                state: "available",
            },
            description:
                "Item catalog management now reuses the live procurementItems source, with single-item entry, category handoff, and workbook import in one workspace.",
            id: "items",
            label: "Items",
            state: "available",
            statusLabel: "Live workspace",
        },
        {
            cta: {
                href: "/po/requests",
                label: "Open request inbox",
                state: requestState,
            },
            description: requestDescription,
            id: "request_inbox",
            label: "Request inbox",
            state: requestState,
            statusLabel: requestStatusLabel,
        },
        {
            cta: {
                href: "/po",
                label: "Review submitted plans",
                state: submissionState,
            },
            description: submissionDescription,
            id: "submission_monitoring",
            label: "Submission monitoring",
            state: submissionState,
            statusLabel: submissionStatusLabel,
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

function buildSubmissionProgress(args: {
    departmentCount: number;
    departmentIdsInScope: ReadonlySet<string>;
    plans: readonly ProcurementOfficerDashboardPlanSummaryRecord[];
    selectedFiscalYear: string;
}): ProcurementOfficerDashboardSnapshot["submissionProgress"] {
    if (args.departmentCount === 0) {
        return {
            approvedDepartmentCount: 0,
            helperText:
                "Departments must exist before submission progress can be tracked truthfully.",
            state: "empty",
            submittedDepartmentCount: 0,
            totalDepartmentCount: 0,
            utilizationPercent: 0,
        };
    }

    const submittedDepartmentCount = new Set(
        args.plans
            .filter(
                (plan) =>
                    plan.fiscalYear === args.selectedFiscalYear &&
                    args.departmentIdsInScope.has(plan.departmentId) &&
                    (plan.status === "submitted" || plan.status === "approved"),
            )
            .map((plan) => plan.departmentId),
    ).size;
    const approvedDepartmentCount = new Set(
        args.plans
            .filter(
                (plan) =>
                    plan.fiscalYear === args.selectedFiscalYear &&
                    args.departmentIdsInScope.has(plan.departmentId) &&
                    plan.status === "approved",
            )
            .map((plan) => plan.departmentId),
    ).size;
    const utilizationPercent = Math.max(
        0,
        Math.min(
            100,
            Math.round((approvedDepartmentCount / args.departmentCount) * 100),
        ),
    );

    let helperText = "Submission tracking is live for the selected fiscal year.";
    if (submittedDepartmentCount === 0) {
        helperText =
            "No departments have submitted a plan yet. Consolidation progress only starts after departments submit and then moves forward as plans are approved.";
    } else if (approvedDepartmentCount === 0) {
        helperText = `${submittedDepartmentCount} department${submittedDepartmentCount === 1 ? "" : "s"} submitted plans, but approvals have not started yet for this fiscal year.`;
    } else if (approvedDepartmentCount < args.departmentCount) {
        const remainingApprovalCount = args.departmentCount - approvedDepartmentCount;
        helperText = `${submittedDepartmentCount} department${submittedDepartmentCount === 1 ? "" : "s"} submitted and ${approvedDepartmentCount} approved. ${remainingApprovalCount} department${remainingApprovalCount === 1 ? "" : "s"} still need approved plans for consolidation.`;
    } else {
        helperText =
            "All in-scope departments now have approved plans for the selected fiscal year.";
    }

    return {
        approvedDepartmentCount,
        helperText,
        state:
            submittedDepartmentCount > 0 || approvedDepartmentCount > 0
                ? "available"
                : "empty",
        submittedDepartmentCount,
        totalDepartmentCount: args.departmentCount,
        utilizationPercent,
    };
}

function buildOrganizationOverview(args: {
    activeItemCount: number;
    activeUserCount: number;
    departmentCount: number;
    departmentIdsInScope: ReadonlySet<string>;
    departments: readonly ProcurementOfficerDashboardDepartmentRecord[];
    plans: readonly ProcurementOfficerDashboardPlanSummaryRecord[];
    selectedFiscalYear: string;
    tenantBudgetCeiling?: number | null;
}): ProcurementOfficerDashboardSnapshot["organizationOverview"] {
    const usedBudget = args.plans
        .filter(
            (plan) =>
                plan.fiscalYear === args.selectedFiscalYear &&
                args.departmentIdsInScope.has(plan.departmentId),
        )
        .reduce((total, plan) => total + Math.max(0, plan.estimatedBudgetUsed), 0);
    const fallbackBudget = args.departments.reduce(
        (total, department) => total + Math.max(0, department.budgetAllocation ?? 0),
        0,
    );
    const totalBudget =
        typeof args.tenantBudgetCeiling === "number" && args.tenantBudgetCeiling > 0
            ? args.tenantBudgetCeiling
            : fallbackBudget;
    const budgetState: ProcurementDashboardState =
        totalBudget > 0 ? "available" : "empty";
    const utilizationPercent =
        totalBudget > 0
            ? Math.max(0, Math.round((usedBudget / totalBudget) * 100))
            : 0;

    return {
        activeDepartmentCount: args.departmentCount,
        activeUserCount: args.activeUserCount,
        budget: {
            state: budgetState,
            totalBudget,
            totalBudgetLabel:
                totalBudget > 0
                    ? formatProcurementBudget(totalBudget)
                    : "--",
            usedBudget,
            usedBudgetLabel:
                usedBudget > 0
                    ? formatProcurementBudget(usedBudget)
                    : "--",
            utilizationPercent,
        },
        totalItemCount: args.activeItemCount,
    };
}

function formatProcurementBudget(amount: number): string {
    const absAmount = Math.abs(amount);
    if (absAmount >= 1_000_000) {
        return `KES ${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (absAmount >= 1_000) {
        return `KES ${(amount / 1_000).toFixed(1)}K`;
    }
    return `KES ${amount.toFixed(0)}`;
}
