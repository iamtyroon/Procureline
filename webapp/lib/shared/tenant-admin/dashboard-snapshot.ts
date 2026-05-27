import {
    buildAvailableFiscalYears,
    deriveDashboardCyclePresentation,
    deriveOnboardingChecklist,
    deriveQuickActions,
    formatDashboardTimestamp,
    getFiscalYearForDate,
    humanizeToken,
    isTimestampInFiscalYear,
    type DashboardCyclePresentation,
    type DashboardMetricState,
    type OnboardingChecklistItem,
    type QuickActionItem,
} from "./dashboard";
import type { TenantAdminInstitutionalOverview } from "./institutional-visibility";

export type DashboardTenantTier =
    | "enterprise"
    | "free"
    | "professional"
    | "starter";

export type DashboardTenantStatus = "active" | "cancelled" | "pending" | "suspended";

export type DashboardAuditActorRole =
    | "anonymous"
    | "department_user"
    | "platform_admin"
    | "procurement_officer"
    | "tenant_admin"
    | "unassigned";

export interface DashboardTenantRecord {
    createdAt: number;
    id: string;
    name: string;
    status: DashboardTenantStatus;
    tier: DashboardTenantTier;
}

export interface DashboardTenantUserRecord {
    id: string;
    isActive: boolean;
    role: "department_user" | "procurement_officer" | "tenant_admin";
}

export interface DashboardDepartmentRecord {
    createdAt: number;
    id: string;
    isActive: boolean;
    name: string;
    submissionEndsAt?: number | null;
    submissionStartsAt?: number | null;
    updatedAt: number;
}

export interface DashboardAuditLogRecord {
    action: string;
    actorRole: DashboardAuditActorRole;
    actorUserId?: string;
    entityType: string;
    event: string;
    id: string;
    metadata?: unknown;
    outcome: string;
    recordId?: string;
    timestamp: number;
}

export interface DashboardSummaryCard {
    dataState: DashboardMetricState;
    helperText: string;
    id:
        | "budget_utilization"
        | "departments"
        | "submission_progress"
        | "total_pos";
    label: string;
    statusLabel: string;
    tone: "neutral" | "positive" | "warning";
    trendLabel: string;
    value: string;
}

export interface TenantAdminActivityItem {
    action: string;
    actor: string;
    entity: string;
    id: string;
    occurredAt: number;
    occurredAtLabel: string;
    outcome: string;
}

export interface TenantAdminActivityFeed {
    items: TenantAdminActivityItem[];
    state: "available" | "empty";
    totalReturned: number;
}

export interface TenantAdminDepartmentStatusItem {
    detail: string;
    id: string;
    name: string;
    progressTone: "neutral" | "positive" | "warning";
    progressValue: number;
    statusLabel: string;
}

export interface TenantAdminUserSummary {
    activeTotal: number;
    departmentUsers: number;
    procurementOfficers: number;
    tenantAdmins: number;
}

export interface TenantAdminCurrentAdminProfile {
    email: string;
    initials: string;
    name: string;
}

export interface TenantAdminProcurementOfficerProfile {
    departmentsManaged: number;
    email: string;
    id: string;
    initials: string;
    lastSeenAt: number | null;
    lastSeenLabel: string;
    name: string;
    statusLabel: string;
}

export interface TenantAdminProcurementOfficerDirectoryEntry {
    activationCodeSuffix?: string;
    departmentsManaged: number;
    email: string;
    id: string;
    invitationId?: string;
    initials: string;
    issuedAt: number | null;
    issuedAtLabel: string;
    lastSeenAt: number | null;
    lastSeenLabel: string;
    name: string;
    source: "active_member" | "invitation";
    status: "accepted" | "active" | "bounced" | "expired" | "inactive" | "pending";
    statusLabel: string;
}

export interface TenantAdminDepartmentUserProfile {
    departmentName: string;
    email: string;
    id: string;
    initials: string;
    lastSeenAt: number | null;
    lastSeenLabel: string;
    name: string;
    statusLabel: string;
}

export interface TenantAdminDashboardMeta {
    availableFiscalYears: string[];
    currentFiscalYear: string;
    emptyPeriodReason: string | null;
    hasDataForSelectedFiscalYear: boolean;
    isSelectedCurrentFiscalYear: boolean;
    lastUpdatedAt: number;
    selectedFiscalYear: string;
    snapshotGeneratedAt: number;
    sourceState: "cached" | "live";
    tenantId: string;
    tenantName: string;
    tenantStatus: DashboardTenantStatus;
    tenantTier: DashboardTenantTier;
}

export interface TenantAdminDashboardSnapshot {
    activityFeed: TenantAdminActivityFeed;
    cycleState: DashboardCyclePresentation;
    departmentStatus: TenantAdminDepartmentStatusItem[];
    directory: {
        currentTenantAdmin: TenantAdminCurrentAdminProfile | null;
        departmentUsers: TenantAdminDepartmentUserProfile[];
        procurementOfficerDirectory: TenantAdminProcurementOfficerDirectoryEntry[];
        procurementOfficers: TenantAdminProcurementOfficerProfile[];
    };
    meta: TenantAdminDashboardMeta;
    onboardingChecklist: OnboardingChecklistItem[];
    institutionalOverview: TenantAdminInstitutionalOverview;
    quickActions: QuickActionItem[];
    summaryCards: {
        budgetUtilization: DashboardSummaryCard;
        departments: DashboardSummaryCard;
        submissionProgress: DashboardSummaryCard;
        totalPOs: DashboardSummaryCard;
    };
    userSummary: TenantAdminUserSummary;
}

export interface BuildTenantAdminDashboardSnapshotArgs {
    activityLogs: readonly DashboardAuditLogRecord[];
    departments: readonly DashboardDepartmentRecord[];
    fiscalYearKeys?: readonly string[];
    now: number;
    selectedFiscalYear?: string;
    tenant: DashboardTenantRecord;
    tenantUsers: readonly DashboardTenantUserRecord[];
}

export function buildTenantAdminDashboardSnapshot(
    args: BuildTenantAdminDashboardSnapshotArgs,
): TenantAdminDashboardSnapshot {
    const currentFiscalYear = getFiscalYearForDate(args.now).key;
    const selectedFiscalYear = args.selectedFiscalYear ?? currentFiscalYear;
    const activityTimestamps = args.activityLogs.map((activity) => activity.timestamp);
    const availableFiscalYears = buildAvailableFiscalYears({
        activityTimestamps,
        departmentWindows: args.departments,
        fiscalYearKeys: args.fiscalYearKeys,
        now: args.now,
    });

    const selectedFiscalYearHasSignals =
        selectedFiscalYear === currentFiscalYear ||
        availableFiscalYears.includes(selectedFiscalYear) ||
        activityTimestamps.some((timestamp) =>
            isTimestampInFiscalYear({ fiscalYearKey: selectedFiscalYear, timestamp }),
        ) ||
        args.departments.some(
            (department) =>
                (typeof department.submissionStartsAt === "number" &&
                    isTimestampInFiscalYear({
                        fiscalYearKey: selectedFiscalYear,
                        timestamp: department.submissionStartsAt,
                    })) ||
                (typeof department.submissionEndsAt === "number" &&
                    isTimestampInFiscalYear({
                        fiscalYearKey: selectedFiscalYear,
                        timestamp: department.submissionEndsAt,
                    })),
        );

    const filteredDepartments = args.departments.filter((department) =>
        selectedFiscalYear === currentFiscalYear
            ? true
            : typeof department.submissionStartsAt === "number" &&
              isTimestampInFiscalYear({
                  fiscalYearKey: selectedFiscalYear,
                  timestamp: department.submissionStartsAt,
              }),
    );

    const cycleState = deriveDashboardCyclePresentation({
        departments: filteredDepartments,
        fiscalYearKey: selectedFiscalYear,
        now: args.now,
    });

    const procurementOfficerCount = args.tenantUsers.filter(
        (tenantUser) =>
            tenantUser.isActive && tenantUser.role === "procurement_officer",
    ).length;
    const tenantAdminCount = args.tenantUsers.filter(
        (tenantUser) => tenantUser.isActive && tenantUser.role === "tenant_admin",
    ).length;
    const departmentUserCount = args.tenantUsers.filter(
        (tenantUser) =>
            tenantUser.isActive && tenantUser.role === "department_user",
    ).length;
    const activeUserCount =
        procurementOfficerCount + tenantAdminCount + departmentUserCount;
    const activeDepartmentCount = args.departments.filter(
        (department) => department.isActive,
    ).length;

    return {
        activityFeed: buildActivityFeed(args.activityLogs, selectedFiscalYear),
        cycleState,
        departmentStatus: buildDepartmentStatus(filteredDepartments, args.now),
        directory: {
            currentTenantAdmin: null,
            departmentUsers: [],
            procurementOfficerDirectory: [],
            procurementOfficers: [],
        },
        meta: {
            availableFiscalYears,
            currentFiscalYear,
            emptyPeriodReason:
                selectedFiscalYearHasSignals || selectedFiscalYear === currentFiscalYear
                    ? null
                    : `No dashboard records exist for ${selectedFiscalYear} yet.`,
            hasDataForSelectedFiscalYear:
                selectedFiscalYearHasSignals || selectedFiscalYear === currentFiscalYear,
            isSelectedCurrentFiscalYear: selectedFiscalYear === currentFiscalYear,
            lastUpdatedAt: args.now,
            selectedFiscalYear,
            snapshotGeneratedAt: args.now,
            sourceState: "live",
            tenantId: args.tenant.id,
            tenantName: args.tenant.name,
            tenantStatus: args.tenant.status,
            tenantTier: args.tenant.tier,
        },
        onboardingChecklist: deriveOnboardingChecklist({
            cycleState: cycleState.state,
            departmentCount: activeDepartmentCount,
            procurementOfficerCount,
        }),
        institutionalOverview: createEmptyInstitutionalOverview({
            fiscalYear: selectedFiscalYear,
            now: args.now,
        }),
        quickActions: deriveQuickActions({
            cycleState: cycleState.state,
            departmentCount: activeDepartmentCount,
            procurementOfficerCount,
        }),
        summaryCards: buildSummaryCards({
            cycleState: cycleState.state,
            departmentCount: activeDepartmentCount,
            hasDataForSelectedFiscalYear: selectedFiscalYearHasSignals,
            isSelectedCurrentFiscalYear: selectedFiscalYear === currentFiscalYear,
            procurementOfficerCount,
        }),
        userSummary: {
            activeTotal: activeUserCount,
            departmentUsers: departmentUserCount,
            procurementOfficers: procurementOfficerCount,
            tenantAdmins: tenantAdminCount,
        },
    };
}

function createEmptyInstitutionalOverview(args: {
    fiscalYear: string;
    now: number;
}): TenantAdminInstitutionalOverview {
    return {
        anomalies: [],
        availableFiscalYears: [args.fiscalYear],
        exportRequest: {
            asOf: args.now,
            state: "queued",
            summary: "Institutional export requests are queued and generated server-side.",
        },
        fiscalYear: args.fiscalYear,
        generatedAt: args.now,
        poRollups: [],
        rows: [],
        summary: {
            anomalyCount: 0,
            approvedOrSubmitted: 0,
            approvedOrSubmittedLabel: "0 of 0",
            poCoverageLabel: "0 of 0",
            totalAllocated: 0,
            totalAllocatedLabel: "KES 0",
            totalDepartments: 0,
            totalUtilizationLabel: "Unavailable",
            totalUtilizationPercent: null,
            totalUtilized: 0,
            totalUtilizedLabel: "KES 0",
        },
    };
}

function buildDepartmentStatus(
    departments: readonly DashboardDepartmentRecord[],
    now: number,
): TenantAdminDepartmentStatusItem[] {
    return departments
        .filter((department) => department.isActive)
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(0, 12)
        .map((department) => {
            if (
                typeof department.submissionStartsAt !== "number" ||
                typeof department.submissionEndsAt !== "number"
            ) {
                return {
                    detail: "Submission window not configured yet.",
                    id: department.id,
                    name: department.name,
                    progressTone: "warning" as const,
                    progressValue: 12,
                    statusLabel: "Setup required",
                };
            }

            if (department.submissionEndsAt <= department.submissionStartsAt) {
                return {
                    detail: "Department dates need correction.",
                    id: department.id,
                    name: department.name,
                    progressTone: "warning" as const,
                    progressValue: 12,
                    statusLabel: "Invalid window",
                };
            }

            if (now < department.submissionStartsAt) {
                return {
                    detail: `Opens ${formatDashboardTimestamp(
                        department.submissionStartsAt,
                    )}.`,
                    id: department.id,
                    name: department.name,
                    progressTone: "neutral" as const,
                    progressValue: 24,
                    statusLabel: "Upcoming",
                };
            }

            if (now <= department.submissionEndsAt) {
                const duration =
                    department.submissionEndsAt - department.submissionStartsAt;
                const elapsed = now - department.submissionStartsAt;
                const progressValue =
                    duration <= 0
                        ? 65
                        : Math.max(
                              18,
                              Math.min(96, Math.round((elapsed / duration) * 100)),
                          );

                return {
                    detail: `Open until ${formatDashboardTimestamp(
                        department.submissionEndsAt,
                    )}.`,
                    id: department.id,
                    name: department.name,
                    progressTone: "positive" as const,
                    progressValue,
                    statusLabel: "In progress",
                };
            }

            return {
                detail: `Closed ${formatDashboardTimestamp(
                    department.submissionEndsAt,
                )}.`,
                id: department.id,
                name: department.name,
                progressTone: "positive" as const,
                progressValue: 100,
                statusLabel: "Complete",
            };
        });
}

function buildActivityFeed(
    activityLogs: readonly DashboardAuditLogRecord[],
    selectedFiscalYear: string,
): TenantAdminActivityFeed {
    const items = activityLogs
        .filter((activity) =>
            isTimestampInFiscalYear({
                fiscalYearKey: selectedFiscalYear,
                timestamp: activity.timestamp,
            }),
        )
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, 20)
        .map((activity) => ({
            action: resolveActivityAction(activity),
            actor: resolveActorLabel(activity),
            entity: resolveEntityLabel(activity),
            id: activity.id,
            occurredAt: activity.timestamp,
            occurredAtLabel: formatDashboardTimestamp(activity.timestamp),
            outcome: humanizeToken(activity.outcome),
        }));

    return {
        items,
        state: items.length > 0 ? "available" : "empty",
        totalReturned: items.length,
    };
}

function buildSummaryCards(args: {
    cycleState: DashboardCyclePresentation["state"];
    departmentCount: number;
    hasDataForSelectedFiscalYear: boolean;
    isSelectedCurrentFiscalYear: boolean;
    procurementOfficerCount: number;
}): TenantAdminDashboardSnapshot["summaryCards"] {
    if (args.isSelectedCurrentFiscalYear) {
        return {
            budgetUtilization: {
                dataState: "unavailable",
                helperText:
                    "Budget utilization remains hidden until budget allocation sources land in a later story.",
                id: "budget_utilization",
                label: "Budget Utilization",
                statusLabel: "Awaiting live source",
                tone: "warning",
                trendLabel: "Coming soon",
                value: "Not available",
            },
            departments: {
                dataState: args.departmentCount === 0 ? "empty" : "available",
                helperText:
                    args.departmentCount === 0
                        ? "No active departments have been configured yet."
                        : `${args.departmentCount} active department${args.departmentCount === 1 ? "" : "s"} are in scope.`,
                id: "departments",
                label: "Departments",
                statusLabel:
                    args.departmentCount === 0 ? "Setup required" : "Active structure",
                tone: args.departmentCount === 0 ? "warning" : "positive",
                trendLabel:
                    args.departmentCount === 0
                        ? "Add departments"
                        : `${args.departmentCount} active`,
                value: String(args.departmentCount),
            },
            submissionProgress: {
                dataState:
                    args.departmentCount === 0 || args.cycleState === "setup_required"
                        ? "unconfigured"
                        : "unavailable",
                helperText:
                    args.departmentCount === 0 || args.cycleState === "setup_required"
                        ? "Submission tracking stays hidden until departments share a safe tenant-wide timeline."
                        : "Plan submission tracking has not shipped yet, so the dashboard shows an honest unavailable state.",
                id: "submission_progress",
                label: "Submission Progress",
                statusLabel:
                    args.departmentCount === 0 ||
                    args.cycleState === "setup_required"
                        ? "Setup required"
                        : "Awaiting live source",
                tone: "warning",
                trendLabel:
                    args.departmentCount === 0 ||
                    args.cycleState === "setup_required"
                        ? "Configure timeline"
                        : "Coming soon",
                value:
                    args.departmentCount === 0 ||
                    args.cycleState === "setup_required"
                        ? "Setup required"
                        : "Not available",
            },
            totalPOs: {
                dataState:
                    args.procurementOfficerCount === 0 ? "empty" : "available",
                helperText:
                    args.procurementOfficerCount === 0
                        ? "No active Procurement Officers are assigned yet."
                        : `${args.procurementOfficerCount} active Procurement Officer${args.procurementOfficerCount === 1 ? "" : "s"} assigned.`,
                id: "total_pos",
                label: "Total POs",
                statusLabel:
                    args.procurementOfficerCount === 0
                        ? "Attention needed"
                        : "Operational",
                tone: args.procurementOfficerCount === 0 ? "warning" : "positive",
                trendLabel:
                    args.procurementOfficerCount === 0
                        ? "Add your first PO"
                        : `${args.procurementOfficerCount} active`,
                value: String(args.procurementOfficerCount),
            },
        };
    }

    const noDataValue = args.hasDataForSelectedFiscalYear
        ? "Historical data unavailable"
        : "No data";

    return {
        budgetUtilization: createHistoricalCard(
            "budget_utilization",
            "Budget Utilization",
            noDataValue,
        ),
        departments: createHistoricalCard(
            "departments",
            "Departments",
            noDataValue,
        ),
        submissionProgress: createHistoricalCard(
            "submission_progress",
            "Submission Progress",
            noDataValue,
        ),
        totalPOs: createHistoricalCard("total_pos", "Total POs", noDataValue),
    };
}

function createHistoricalCard(
    id: DashboardSummaryCard["id"],
    label: string,
    value: string,
): DashboardSummaryCard {
    return {
        dataState: value === "No data" ? "empty" : "unavailable",
        helperText:
            value === "No data"
                ? "This fiscal year does not have dashboard records yet."
                : "Historical snapshots are reserved for a later story, so current totals are intentionally hidden here.",
        id,
        label,
        statusLabel: value,
        tone: "neutral",
        trendLabel: "Select another year",
        value,
    };
}

function readMetadataString(metadata: unknown, key: string): string | null {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        return null;
    }

    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function resolveActorLabel(activity: DashboardAuditLogRecord): string {
    return (
        readMetadataString(activity.metadata, "actorLabel") ??
        readMetadataString(activity.metadata, "actorName") ??
        humanizeToken(activity.actorRole)
    );
}

function resolveEntityLabel(activity: DashboardAuditLogRecord): string {
    return (
        readMetadataString(activity.metadata, "entityLabel") ??
        readMetadataString(activity.metadata, "departmentName") ??
        readMetadataString(activity.metadata, "tenantName") ??
        humanizeToken(activity.entityType)
    );
}

function resolveActivityAction(activity: DashboardAuditLogRecord): string {
    return (
        readMetadataString(activity.metadata, "summary") ??
        readMetadataString(activity.metadata, "description") ??
        humanizeToken(activity.action || activity.event)
    );
}
