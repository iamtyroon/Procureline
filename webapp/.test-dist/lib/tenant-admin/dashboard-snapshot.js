"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTenantAdminDashboardSnapshot = void 0;
const dashboard_1 = require("./dashboard");
function buildTenantAdminDashboardSnapshot(args) {
    const currentFiscalYear = (0, dashboard_1.getFiscalYearForDate)(args.now).key;
    const selectedFiscalYear = args.selectedFiscalYear ?? currentFiscalYear;
    const activityTimestamps = args.activityLogs.map((activity) => activity.timestamp);
    const availableFiscalYears = (0, dashboard_1.buildAvailableFiscalYears)({
        activityTimestamps,
        departmentWindows: args.departments,
        now: args.now,
        selectedFiscalYear,
    });
    const selectedFiscalYearHasSignals = selectedFiscalYear === currentFiscalYear ||
        activityTimestamps.some((timestamp) => (0, dashboard_1.isTimestampInFiscalYear)({ fiscalYearKey: selectedFiscalYear, timestamp })) ||
        args.departments.some((department) => (typeof department.submissionStartsAt === "number" &&
            (0, dashboard_1.isTimestampInFiscalYear)({
                fiscalYearKey: selectedFiscalYear,
                timestamp: department.submissionStartsAt,
            })) ||
            (typeof department.submissionEndsAt === "number" &&
                (0, dashboard_1.isTimestampInFiscalYear)({
                    fiscalYearKey: selectedFiscalYear,
                    timestamp: department.submissionEndsAt,
                })));
    const filteredDepartments = args.departments.filter((department) => selectedFiscalYear === currentFiscalYear
        ? true
        : typeof department.submissionStartsAt === "number" &&
            (0, dashboard_1.isTimestampInFiscalYear)({
                fiscalYearKey: selectedFiscalYear,
                timestamp: department.submissionStartsAt,
            }));
    const cycleState = (0, dashboard_1.deriveDashboardCyclePresentation)({
        departments: filteredDepartments,
        fiscalYearKey: selectedFiscalYear,
        now: args.now,
    });
    const procurementOfficerCount = args.tenantUsers.filter((tenantUser) => tenantUser.isActive && tenantUser.role === "procurement_officer").length;
    const tenantAdminCount = args.tenantUsers.filter((tenantUser) => tenantUser.isActive && tenantUser.role === "tenant_admin").length;
    const departmentUserCount = args.tenantUsers.filter((tenantUser) => tenantUser.isActive && tenantUser.role === "department_user").length;
    const activeUserCount = procurementOfficerCount + tenantAdminCount + departmentUserCount;
    const activeDepartmentCount = args.departments.filter((department) => department.isActive).length;
    return {
        activityFeed: buildActivityFeed(args.activityLogs, selectedFiscalYear),
        cycleState,
        departmentStatus: buildDepartmentStatus(filteredDepartments, args.now),
        meta: {
            availableFiscalYears,
            currentFiscalYear,
            emptyPeriodReason: selectedFiscalYearHasSignals || selectedFiscalYear === currentFiscalYear
                ? null
                : `No dashboard records exist for ${selectedFiscalYear} yet.`,
            hasDataForSelectedFiscalYear: selectedFiscalYearHasSignals || selectedFiscalYear === currentFiscalYear,
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
        onboardingChecklist: (0, dashboard_1.deriveOnboardingChecklist)({
            cycleState: cycleState.state,
            departmentCount: activeDepartmentCount,
            procurementOfficerCount,
        }),
        quickActions: (0, dashboard_1.deriveQuickActions)({
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
exports.buildTenantAdminDashboardSnapshot = buildTenantAdminDashboardSnapshot;
function buildDepartmentStatus(departments, now) {
    return departments
        .filter((department) => department.isActive)
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(0, 12)
        .map((department) => {
        if (typeof department.submissionStartsAt !== "number" ||
            typeof department.submissionEndsAt !== "number") {
            return {
                detail: "Submission window not configured yet.",
                id: department.id,
                name: department.name,
                progressTone: "warning",
                progressValue: 12,
                statusLabel: "Setup required",
            };
        }
        if (department.submissionEndsAt <= department.submissionStartsAt) {
            return {
                detail: "Department dates need correction.",
                id: department.id,
                name: department.name,
                progressTone: "warning",
                progressValue: 12,
                statusLabel: "Invalid window",
            };
        }
        if (now < department.submissionStartsAt) {
            return {
                detail: `Opens ${(0, dashboard_1.formatDashboardTimestamp)(department.submissionStartsAt)}.`,
                id: department.id,
                name: department.name,
                progressTone: "neutral",
                progressValue: 24,
                statusLabel: "Upcoming",
            };
        }
        if (now <= department.submissionEndsAt) {
            const duration = department.submissionEndsAt - department.submissionStartsAt;
            const elapsed = now - department.submissionStartsAt;
            const progressValue = duration <= 0
                ? 65
                : Math.max(18, Math.min(96, Math.round((elapsed / duration) * 100)));
            return {
                detail: `Open until ${(0, dashboard_1.formatDashboardTimestamp)(department.submissionEndsAt)}.`,
                id: department.id,
                name: department.name,
                progressTone: "positive",
                progressValue,
                statusLabel: "In progress",
            };
        }
        return {
            detail: `Closed ${(0, dashboard_1.formatDashboardTimestamp)(department.submissionEndsAt)}.`,
            id: department.id,
            name: department.name,
            progressTone: "positive",
            progressValue: 100,
            statusLabel: "Complete",
        };
    });
}
function buildActivityFeed(activityLogs, selectedFiscalYear) {
    const items = activityLogs
        .filter((activity) => (0, dashboard_1.isTimestampInFiscalYear)({
        fiscalYearKey: selectedFiscalYear,
        timestamp: activity.timestamp,
    }))
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, 20)
        .map((activity) => ({
        action: resolveActivityAction(activity),
        actor: resolveActorLabel(activity),
        entity: resolveEntityLabel(activity),
        id: activity.id,
        occurredAt: activity.timestamp,
        occurredAtLabel: (0, dashboard_1.formatDashboardTimestamp)(activity.timestamp),
        outcome: (0, dashboard_1.humanizeToken)(activity.outcome),
    }));
    return {
        items,
        state: items.length > 0 ? "available" : "empty",
        totalReturned: items.length,
    };
}
function buildSummaryCards(args) {
    if (args.isSelectedCurrentFiscalYear) {
        return {
            budgetUtilization: {
                dataState: "unavailable",
                helperText: "Budget utilization remains hidden until budget allocation sources land in a later story.",
                id: "budget_utilization",
                label: "Budget Utilization",
                statusLabel: "Awaiting live source",
                tone: "warning",
                trendLabel: "Coming soon",
                value: "Not available",
            },
            departments: {
                dataState: args.departmentCount === 0 ? "empty" : "available",
                helperText: args.departmentCount === 0
                    ? "No active departments have been configured yet."
                    : `${args.departmentCount} active department${args.departmentCount === 1 ? "" : "s"} are in scope.`,
                id: "departments",
                label: "Departments",
                statusLabel: args.departmentCount === 0 ? "Setup required" : "Active structure",
                tone: args.departmentCount === 0 ? "warning" : "positive",
                trendLabel: args.departmentCount === 0
                    ? "Add departments"
                    : `${args.departmentCount} active`,
                value: String(args.departmentCount),
            },
            submissionProgress: {
                dataState: args.departmentCount === 0 || args.cycleState === "setup_required"
                    ? "unconfigured"
                    : "unavailable",
                helperText: args.departmentCount === 0 || args.cycleState === "setup_required"
                    ? "Submission tracking stays hidden until departments share a safe tenant-wide timeline."
                    : "Plan submission tracking has not shipped yet, so the dashboard shows an honest unavailable state.",
                id: "submission_progress",
                label: "Submission Progress",
                statusLabel: args.departmentCount === 0 ||
                    args.cycleState === "setup_required"
                    ? "Setup required"
                    : "Awaiting live source",
                tone: "warning",
                trendLabel: args.departmentCount === 0 ||
                    args.cycleState === "setup_required"
                    ? "Configure timeline"
                    : "Coming soon",
                value: args.departmentCount === 0 ||
                    args.cycleState === "setup_required"
                    ? "Setup required"
                    : "Not available",
            },
            totalPOs: {
                dataState: args.procurementOfficerCount === 0 ? "empty" : "available",
                helperText: args.procurementOfficerCount === 0
                    ? "No active Procurement Officers are assigned yet."
                    : `${args.procurementOfficerCount} active Procurement Officer${args.procurementOfficerCount === 1 ? "" : "s"} assigned.`,
                id: "total_pos",
                label: "Total POs",
                statusLabel: args.procurementOfficerCount === 0
                    ? "Attention needed"
                    : "Operational",
                tone: args.procurementOfficerCount === 0 ? "warning" : "positive",
                trendLabel: args.procurementOfficerCount === 0
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
        budgetUtilization: createHistoricalCard("budget_utilization", "Budget Utilization", noDataValue),
        departments: createHistoricalCard("departments", "Departments", noDataValue),
        submissionProgress: createHistoricalCard("submission_progress", "Submission Progress", noDataValue),
        totalPOs: createHistoricalCard("total_pos", "Total POs", noDataValue),
    };
}
function createHistoricalCard(id, label, value) {
    return {
        dataState: value === "No data" ? "empty" : "unavailable",
        helperText: value === "No data"
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
function readMetadataString(metadata, key) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        return null;
    }
    const value = metadata[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}
function resolveActorLabel(activity) {
    return (readMetadataString(activity.metadata, "actorLabel") ??
        readMetadataString(activity.metadata, "actorName") ??
        (0, dashboard_1.humanizeToken)(activity.actorRole));
}
function resolveEntityLabel(activity) {
    return (readMetadataString(activity.metadata, "entityLabel") ??
        readMetadataString(activity.metadata, "departmentName") ??
        readMetadataString(activity.metadata, "tenantName") ??
        (0, dashboard_1.humanizeToken)(activity.entityType));
}
function resolveActivityAction(activity) {
    return (readMetadataString(activity.metadata, "summary") ??
        readMetadataString(activity.metadata, "description") ??
        (0, dashboard_1.humanizeToken)(activity.action || activity.event));
}
