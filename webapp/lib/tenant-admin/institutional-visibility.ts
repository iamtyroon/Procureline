import {
    buildProcurementOfficerMonitoringTimeline,
    deriveProcurementOfficerMonitoringStatus,
    getProcurementOfficerMonitoringStatusLabel,
    selectCanonicalMonitoringPlan,
    type ProcurementOfficerMonitoringPlanLike,
} from "../procurement-officer/submission-monitoring";
import { getFiscalYearForDate, isTimestampInFiscalYear } from "./dashboard";

export type InstitutionalOverviewStatus =
    | "approved"
    | "draft"
    | "not_started"
    | "rejected"
    | "submitted";

export type InstitutionalAnomalyType =
    | "budget_variance"
    | "duplicate_department_code"
    | "duplicate_department_name"
    | "invalid_budget_allocation"
    | "missing_du_coverage"
    | "over_budget"
    | "stale_submitted_plan"
    | "unresolved_po_assignment";

export type InstitutionalPoRollupStatus =
    | "attention_needed"
    | "complete"
    | "in_progress"
    | "not_started";

export interface InstitutionalDepartmentRecord {
    budgetAllocation?: number | null;
    code?: string | null;
    createdAt: number;
    id: string;
    isActive: boolean;
    name: string;
    normalizedCode?: string | null;
    normalizedName?: string | null;
    procurementOfficerTenantUserId?: string | null;
    submissionEndsAt?: number | null;
    submissionStartsAt?: number | null;
    updatedAt: number;
}

export interface InstitutionalTenantUserRecord {
    id: string;
    isActive: boolean;
    role: "department_user" | "procurement_officer" | "tenant_admin";
    tenantId: string;
    userId: string;
}

export interface InstitutionalUserRecord {
    email?: string | null;
    id: string;
    name?: string | null;
}

export interface InstitutionalDepartmentUserProfileRecord {
    departmentId: string;
    id: string;
    isActive: boolean;
    lastAuthenticatedAt?: number | null;
    normalizedEmail: string;
    tenantId: string;
    tenantUserId: string;
    updatedAt: number;
}

export interface InstitutionalPlanRecord extends ProcurementOfficerMonitoringPlanLike {
    workspaceState?: unknown;
}

export interface InstitutionalPlanSubmissionSnapshotRecord {
    capturedAt: number;
    categorySummaries: {
        amount: number;
        categoryId: string;
        categoryName: string;
        itemCount: number;
    }[];
    departmentId: string;
    estimatedBudgetUsed: number;
    fiscalYear: string;
    id: string;
    itemCount: number;
    lifecycleStatus?: "active" | "withdrawn" | null;
    planId: string;
    selectedCategoryIds: readonly string[];
    submittedAt: number | null;
    submissionReference?: string | null;
    submissionSequence?: number | null;
    withdrawnAt?: number | null;
}

export interface InstitutionalPlanReviewDecisionRecord {
    comment: string;
    decidedAt: number;
    decisionType: "approved" | "rejected" | "revision_requested";
    effectiveRevisionDeadlineAt?: number | null;
    fiscalYear: string;
    id: string;
    lifecycleStatus?: "active" | "superseded" | "undone" | null;
    planId: string;
    revisionDeadlineAt?: number | null;
}

export interface InstitutionalSubmissionDeadlineRecord {
    fiscalYearKey: string;
    submissionEndsAt: number;
    submissionStartsAt: number;
    updatedAt: number;
}

export interface InstitutionalAuditLogRecord {
    actorUserId?: string | null;
    event: string;
    id: string;
    recordId?: string | null;
    timestamp: number;
}

export interface InstitutionalDuContact {
    email: string;
    id: string;
    name: string;
    state: "active";
}

export interface InstitutionalBudgetPresentation {
    allocation: number | null;
    allocationLabel: string;
    state: "available" | "invalid" | "unavailable";
    used: number | null;
    usedLabel: string;
    utilizationLabel: string;
    utilizationPercent: number | null;
}

export interface InstitutionalOverviewRow {
    anomalyCount: number;
    budget: InstitutionalBudgetPresentation;
    categorySummaries: {
        amount: number;
        categoryId: string;
        categoryName: string;
        itemCount: number;
    }[];
    departmentCode: string | null;
    departmentId: string;
    departmentName: string;
    duContacts: InstitutionalDuContact[];
    itemTotal: number;
    lastActivityAt: number | null;
    planId: string | null;
    procurementOfficer: {
        email: string | null;
        id: string | null;
        name: string;
        state: "active" | "inactive" | "unavailable";
    };
    status: InstitutionalOverviewStatus;
    statusLabel: string;
    timeline: {
        description: string;
        id: string;
        timestamp: number | null;
        timestampLabel: string;
        title: string;
    }[];
}

export interface InstitutionalAnomaly {
    departmentId: string;
    departmentName: string;
    description: string;
    severity: "attention" | "critical" | "warning";
    type: InstitutionalAnomalyType;
}

export interface InstitutionalPoRollup {
    attentionNeeded: number;
    complete: number;
    departmentCount: number;
    id: string;
    inProgress: number;
    lastActivityAt: number | null;
    name: string;
    notStarted: number;
    status: InstitutionalPoRollupStatus;
    statusLabel: "Attention Needed" | "Complete" | "In Progress" | "Not Started";
}

export interface InstitutionalOverviewSummary {
    anomalyCount: number;
    approvedOrSubmitted: number;
    approvedOrSubmittedLabel: string;
    poCoverageLabel: string;
    totalAllocated: number;
    totalAllocatedLabel: string;
    totalDepartments: number;
    totalUtilizationLabel: string;
    totalUtilizationPercent: number | null;
    totalUtilized: number;
    totalUtilizedLabel: string;
}

export interface TenantAdminInstitutionalOverview {
    anomalies: InstitutionalAnomaly[];
    availableFiscalYears: string[];
    exportRequest: {
        asOf: number;
        state: "export_ready" | "queued";
        summary: string;
    };
    fiscalYear: string;
    generatedAt: number;
    poRollups: InstitutionalPoRollup[];
    rows: InstitutionalOverviewRow[];
    summary: InstitutionalOverviewSummary;
}

export interface BuildTenantAdminInstitutionalOverviewArgs {
    auditLogs: readonly InstitutionalAuditLogRecord[];
    departments: readonly InstitutionalDepartmentRecord[];
    departmentUserProfiles: readonly InstitutionalDepartmentUserProfileRecord[];
    fiscalYear: string;
    now: number;
    planReviewDecisions: readonly InstitutionalPlanReviewDecisionRecord[];
    planSubmissionSnapshots: readonly InstitutionalPlanSubmissionSnapshotRecord[];
    plans: readonly InstitutionalPlanRecord[];
    staleSubmittedThresholdMs?: number;
    submissionDeadlines: readonly InstitutionalSubmissionDeadlineRecord[];
    tenantId: string;
    tenantUsers: readonly InstitutionalTenantUserRecord[];
    users: readonly InstitutionalUserRecord[];
}

export interface InstitutionalOverviewFilter {
    procurementOfficerId?: string | "all";
    query?: string;
    status?: InstitutionalOverviewStatus | "all";
}

export function buildTenantAdminInstitutionalOverview(
    args: BuildTenantAdminInstitutionalOverviewArgs,
): TenantAdminInstitutionalOverview {
    const tenantUsersById = new Map(args.tenantUsers.map((user) => [user.id, user]));
    const usersById = new Map(args.users.map((user) => [user.id, user]));
    const decisionsByPlanId = groupBy(args.planReviewDecisions, (decision) => decision.planId);
    const snapshotsByPlanId = groupBy(args.planSubmissionSnapshots, (snapshot) => snapshot.planId);
    const plansByDepartmentId = groupBy(args.plans, (plan) => plan.departmentId);
    const auditByRecordId = groupBy(
        args.auditLogs.filter((log) => typeof log.recordId === "string"),
        (log) => log.recordId ?? "",
    );

    const activeDepartments = args.departments
        .filter((department) => department.isActive)
        .sort((left, right) => left.name.localeCompare(right.name));
    const duplicateCodes = findDuplicateNormalizedValues(activeDepartments, "code");
    const duplicateNames = findDuplicateNormalizedValues(activeDepartments, "name");

    const rows = activeDepartments.map((department) => {
        const departmentPlans = (plansByDepartmentId.get(department.id) ?? [])
            .filter((plan) => plan.fiscalYear === args.fiscalYear)
            .map((plan) => enrichPlanForOverview({
                decisions: decisionsByPlanId.get(plan.id) ?? [],
                plan,
                snapshots: snapshotsByPlanId.get(plan.id) ?? [],
            }));
        const canonicalPlan = selectCanonicalMonitoringPlan(
            departmentPlans,
            args.fiscalYear,
        );
        const activeSnapshot = canonicalPlan
            ? selectLatestActiveSnapshot(snapshotsByPlanId.get(canonicalPlan.id) ?? [])
            : null;
        const status = mapMonitoringStatus(
            deriveProcurementOfficerMonitoringStatus(canonicalPlan),
        );
        const po = resolveProcurementOfficer({
            department,
            tenantUsersById,
            usersById,
        });
        const duContacts = resolveSafeDuContacts({
            departmentId: department.id,
            profiles: args.departmentUserProfiles,
            tenantId: args.tenantId,
            tenantUsersById,
            usersById,
        });
        const usedBudget =
            activeSnapshot?.estimatedBudgetUsed ??
            canonicalPlan?.estimatedBudgetUsed ??
            null;
        const budget = buildBudgetPresentation({
            allocation: department.budgetAllocation ?? null,
            used: usedBudget,
        });
        const planAudit = canonicalPlan ? auditByRecordId.get(canonicalPlan.id) ?? [] : [];
        const lastActivityAt = [
            department.updatedAt,
            canonicalPlan?.updatedAt,
            activeSnapshot?.capturedAt,
            ...planAudit.map((log) => log.timestamp),
        ]
            .filter((value): value is number => typeof value === "number")
            .sort((left, right) => right - left)[0] ?? null;

        return {
            anomalyCount: 0,
            budget,
            categorySummaries: [
                ...(activeSnapshot?.categorySummaries ??
                    canonicalPlan?.categorySummaries ??
                    []),
            ],
            departmentCode: department.code ?? null,
            departmentId: department.id,
            departmentName: department.name,
            duContacts,
            itemTotal: activeSnapshot?.itemCount ?? canonicalPlan?.itemCount ?? 0,
            lastActivityAt,
            planId: canonicalPlan?.id ?? null,
            procurementOfficer: po,
            status,
            statusLabel:
                status === "not_started"
                    ? "Not Started"
                    : getProcurementOfficerMonitoringStatusLabel(status),
            timeline: buildProcurementOfficerMonitoringTimeline({
                plan: canonicalPlan,
                timeZone: "Africa/Nairobi",
            }).map(({ description, id, timestamp, timestampLabel, title }) => ({
                description,
                id,
                timestamp,
                timestampLabel,
                title,
            })),
        } satisfies InstitutionalOverviewRow;
    });

    const anomalies = buildInstitutionalAnomalies({
        duplicateCodes,
        duplicateNames,
        fiscalYear: args.fiscalYear,
        now: args.now,
        rows,
        staleSubmittedThresholdMs:
            args.staleSubmittedThresholdMs ?? 7 * 24 * 60 * 60 * 1000,
    });
    const anomalyCounts = new Map<string, number>();
    for (const anomaly of anomalies) {
        anomalyCounts.set(
            anomaly.departmentId,
            (anomalyCounts.get(anomaly.departmentId) ?? 0) + 1,
        );
    }

    const rowsWithAnomalyCounts = rows.map((row) => ({
        ...row,
        anomalyCount: anomalyCounts.get(row.departmentId) ?? 0,
    }));
    const poRollups = buildPoRollups({
        rows: rowsWithAnomalyCounts,
        tenantUsers: args.tenantUsers,
        usersById,
    });

    return {
        anomalies,
        availableFiscalYears: buildInstitutionalFiscalYears(args),
        exportRequest: {
            asOf: args.now,
            state: "queued",
            summary: "Institutional export requests are queued and generated server-side.",
        },
        fiscalYear: args.fiscalYear,
        generatedAt: args.now,
        poRollups,
        rows: rowsWithAnomalyCounts,
        summary: summarizeInstitutionalOverview(rowsWithAnomalyCounts, anomalies),
    };
}

export function filterInstitutionalOverviewRows(
    rows: readonly InstitutionalOverviewRow[],
    filter: InstitutionalOverviewFilter,
): InstitutionalOverviewRow[] {
    const query = normalizeForComparison(filter.query ?? "");

    return rows.filter((row) => {
        if (
            filter.status &&
            filter.status !== "all" &&
            row.status !== filter.status
        ) {
            return false;
        }

        if (
            filter.procurementOfficerId &&
            filter.procurementOfficerId !== "all" &&
            row.procurementOfficer.id !== filter.procurementOfficerId
        ) {
            return false;
        }

        if (!query) {
            return true;
        }

        return normalizeForComparison(
            `${row.departmentName} ${row.departmentCode ?? ""}`,
        ).includes(query);
    });
}

export function summarizeInstitutionalOverview(
    rows: readonly InstitutionalOverviewRow[],
    anomalies: readonly InstitutionalAnomaly[],
): InstitutionalOverviewSummary {
    const totalAllocated = rows.reduce(
        (sum, row) => sum + (row.budget.state === "available" ? row.budget.allocation ?? 0 : 0),
        0,
    );
    const totalUtilized = rows.reduce(
        (sum, row) => sum + (row.budget.used ?? 0),
        0,
    );
    const totalUtilizationPercent =
        totalAllocated > 0 ? Math.round((totalUtilized / totalAllocated) * 100) : null;
    const approvedOrSubmitted = rows.filter(
        (row) => row.status === "approved" || row.status === "submitted",
    ).length;
    const poCovered = rows.filter(
        (row) => row.procurementOfficer.state === "active",
    ).length;

    return {
        anomalyCount: anomalies.length,
        approvedOrSubmitted,
        approvedOrSubmittedLabel: `${approvedOrSubmitted} of ${rows.length}`,
        poCoverageLabel: `${poCovered} of ${rows.length}`,
        totalAllocated,
        totalAllocatedLabel: formatCurrency(totalAllocated),
        totalDepartments: rows.length,
        totalUtilizationLabel:
            totalUtilizationPercent === null ? "Unavailable" : `${totalUtilizationPercent}%`,
        totalUtilizationPercent,
        totalUtilized,
        totalUtilizedLabel: formatCurrency(totalUtilized),
    };
}

export function buildInstitutionalExportPreview(args: {
    actorTenantUserId: string;
    asOf: number;
    fiscalYear: string;
    overview: TenantAdminInstitutionalOverview;
    requestId: string;
    tenantId: string;
}): {
    departments: Array<{
        anomalies: InstitutionalAnomaly[];
        budget: InstitutionalBudgetPresentation;
        departmentCode: string | null;
        departmentId: string;
        departmentName: string;
        duContacts: InstitutionalDuContact[];
        plan: {
            categorySummaries: InstitutionalOverviewRow["categorySummaries"];
            internalReviewComments?: never;
            itemTotal: number;
            planId: string | null;
            status: InstitutionalOverviewStatus;
            statusLabel: string;
            workspaceState?: never;
        };
        procurementOfficer: InstitutionalOverviewRow["procurementOfficer"];
    }>;
    metadata: {
        actorTenantUserId: string;
        asOf: number;
        fiscalYear: string;
        requestId: string;
        schemaVersion: "tenant-admin-institutional-export.v1";
        tenantId: string;
    };
} {
    return {
        departments: args.overview.rows.map((row) => ({
            anomalies: args.overview.anomalies.filter(
                (anomaly) => anomaly.departmentId === row.departmentId,
            ),
            budget: row.budget,
            departmentCode: row.departmentCode,
            departmentId: row.departmentId,
            departmentName: row.departmentName,
            duContacts: row.duContacts,
            plan: {
                categorySummaries: row.categorySummaries,
                itemTotal: row.itemTotal,
                planId: row.planId,
                status: row.status,
                statusLabel: row.statusLabel,
            },
            procurementOfficer: row.procurementOfficer,
        })),
        metadata: {
            actorTenantUserId: args.actorTenantUserId,
            asOf: args.asOf,
            fiscalYear: args.fiscalYear,
            requestId: args.requestId,
            schemaVersion: "tenant-admin-institutional-export.v1",
            tenantId: args.tenantId,
        },
    };
}

function enrichPlanForOverview(args: {
    decisions: readonly InstitutionalPlanReviewDecisionRecord[];
    plan: InstitutionalPlanRecord;
    snapshots: readonly InstitutionalPlanSubmissionSnapshotRecord[];
}): InstitutionalPlanRecord {
    const decisions = args.decisions
        .filter((decision) => decision.lifecycleStatus !== "undone")
        .sort((left, right) => right.decidedAt - left.decidedAt);
    const latestDecision = decisions[0] ?? null;

    return {
        ...args.plan,
        latestDecision,
        reviewDecisions: decisions,
        submissionSnapshots: args.snapshots.map((snapshot) => ({
            capturedAt: snapshot.capturedAt,
            lifecycleStatus: snapshot.lifecycleStatus ?? null,
            submissionReference: snapshot.submissionReference ?? null,
            submissionSequence: snapshot.submissionSequence ?? null,
            submittedAt: snapshot.submittedAt,
            withdrawnAt: snapshot.withdrawnAt ?? null,
        })),
    };
}

function selectLatestActiveSnapshot(
    snapshots: readonly InstitutionalPlanSubmissionSnapshotRecord[],
): InstitutionalPlanSubmissionSnapshotRecord | null {
    return [...snapshots]
        .filter((snapshot) => snapshot.lifecycleStatus !== "withdrawn")
        .sort((left, right) => {
            const leftTimestamp = left.submittedAt ?? left.capturedAt;
            const rightTimestamp = right.submittedAt ?? right.capturedAt;
            return rightTimestamp - leftTimestamp;
        })[0] ?? null;
}

function resolveProcurementOfficer(args: {
    department: InstitutionalDepartmentRecord;
    tenantUsersById: Map<string, InstitutionalTenantUserRecord>;
    usersById: Map<string, InstitutionalUserRecord>;
}): InstitutionalOverviewRow["procurementOfficer"] {
    const tenantUserId = args.department.procurementOfficerTenantUserId ?? null;
    const tenantUser = tenantUserId ? args.tenantUsersById.get(tenantUserId) : null;

    if (!tenantUser || tenantUser.role !== "procurement_officer") {
        return {
            email: null,
            id: tenantUserId,
            name: "Procurement Officer unavailable",
            state: "unavailable",
        };
    }

    const user = args.usersById.get(tenantUser.userId);
    return {
        email: user?.email?.trim() || null,
        id: tenantUser.id,
        name: user?.name?.trim() || user?.email?.split("@")[0] || "Procurement Officer",
        state: tenantUser.isActive ? "active" : "inactive",
    };
}

function resolveSafeDuContacts(args: {
    departmentId: string;
    profiles: readonly InstitutionalDepartmentUserProfileRecord[];
    tenantId: string;
    tenantUsersById: Map<string, InstitutionalTenantUserRecord>;
    usersById: Map<string, InstitutionalUserRecord>;
}): InstitutionalDuContact[] {
    const contacts = new Map<string, InstitutionalDuContact>();

    for (const profile of args.profiles) {
        if (
            profile.departmentId !== args.departmentId ||
            profile.tenantId !== args.tenantId ||
            !profile.isActive
        ) {
            continue;
        }

        const tenantUser = args.tenantUsersById.get(profile.tenantUserId);
        if (
            !tenantUser ||
            tenantUser.tenantId !== args.tenantId ||
            tenantUser.role !== "department_user" ||
            !tenantUser.isActive
        ) {
            continue;
        }

        const user = args.usersById.get(tenantUser.userId);
        const email = (user?.email ?? profile.normalizedEmail).trim().toLowerCase();
        if (!email || contacts.has(email)) {
            continue;
        }

        contacts.set(email, {
            email,
            id: tenantUser.id,
            name: user?.name?.trim() || email.split("@")[0] || "Department User",
            state: "active",
        });
    }

    return Array.from(contacts.values()).sort((left, right) =>
        left.name.localeCompare(right.name),
    );
}

function buildBudgetPresentation(args: {
    allocation: number | null;
    used: number | null;
}): InstitutionalBudgetPresentation {
    const allocation =
        typeof args.allocation === "number" && Number.isFinite(args.allocation)
            ? args.allocation
            : null;
    const used =
        typeof args.used === "number" && Number.isFinite(args.used)
            ? args.used
            : null;

    if (allocation === null) {
        return {
            allocation,
            allocationLabel: "Unavailable",
            state: "unavailable",
            used,
            usedLabel: used === null ? "Unavailable" : formatCurrency(used),
            utilizationLabel: "Unavailable",
            utilizationPercent: null,
        };
    }

    if (allocation <= 0) {
        return {
            allocation,
            allocationLabel: formatCurrency(allocation),
            state: "invalid",
            used,
            usedLabel: used === null ? "Unavailable" : formatCurrency(used),
            utilizationLabel: "Invalid allocation",
            utilizationPercent: null,
        };
    }

    const utilizationPercent =
        used === null ? null : Math.round((used / allocation) * 100);

    return {
        allocation,
        allocationLabel: formatCurrency(allocation),
        state: "available",
        used,
        usedLabel: used === null ? "Unavailable" : formatCurrency(used),
        utilizationLabel:
            utilizationPercent === null ? "Unavailable" : `${utilizationPercent}%`,
        utilizationPercent,
    };
}

function buildInstitutionalAnomalies(args: {
    duplicateCodes: Set<string>;
    duplicateNames: Set<string>;
    fiscalYear: string;
    now: number;
    rows: readonly InstitutionalOverviewRow[];
    staleSubmittedThresholdMs: number;
}): InstitutionalAnomaly[] {
    const anomalies: InstitutionalAnomaly[] = [];

    for (const row of args.rows) {
        const normalizedCode = normalizeForComparison(row.departmentCode ?? "");
        const normalizedName = normalizeForComparison(row.departmentName);

        if (row.procurementOfficer.state !== "active") {
            anomalies.push(createAnomaly(row, "unresolved_po_assignment", "attention", "Procurement Officer assignment is inactive or unavailable."));
        }
        if (row.duContacts.length === 0) {
            anomalies.push(createAnomaly(row, "missing_du_coverage", "attention", "No active tenant-scoped DU contact is safely assigned."));
        }
        if (row.budget.state === "invalid") {
            anomalies.push(createAnomaly(row, "invalid_budget_allocation", "warning", "Budget allocation is zero or negative, so utilization is unavailable."));
        }
        if (
            row.budget.state === "available" &&
            typeof row.budget.used === "number" &&
            typeof row.budget.allocation === "number"
        ) {
            const variancePercent =
                ((row.budget.used - row.budget.allocation) / row.budget.allocation) * 100;
            if (Math.abs(variancePercent) > 50) {
                anomalies.push(createAnomaly(row, "budget_variance", "warning", "Budget variance is greater than 50% for the selected fiscal year."));
            }
            if (row.budget.used > row.budget.allocation) {
                anomalies.push(createAnomaly(row, "over_budget", "critical", "Plan budget used is higher than the department allocation."));
            }
        }
        if (normalizedCode && args.duplicateCodes.has(normalizedCode)) {
            anomalies.push(createAnomaly(row, "duplicate_department_code", "attention", "Active department code duplicates another department after normalization."));
        }
        if (normalizedName && args.duplicateNames.has(normalizedName)) {
            anomalies.push(createAnomaly(row, "duplicate_department_name", "attention", "Active department name duplicates another department after normalization."));
        }
        const submittedTimeline = row.timeline.find((item) => item.title === "Submitted");
        const hasReview = row.timeline.some((item) =>
            ["Approved", "Rejected", "Revision Requested", "Under Review"].includes(item.title),
        );
        if (
            row.status === "submitted" &&
            typeof submittedTimeline?.timestamp === "number" &&
            !hasReview &&
            args.now - submittedTimeline.timestamp > args.staleSubmittedThresholdMs
        ) {
            anomalies.push(createAnomaly(row, "stale_submitted_plan", "attention", `Submitted plan has not entered review after the configured threshold for ${args.fiscalYear}.`));
        }
    }

    return anomalies;
}

function createAnomaly(
    row: InstitutionalOverviewRow,
    type: InstitutionalAnomalyType,
    severity: InstitutionalAnomaly["severity"],
    description: string,
): InstitutionalAnomaly {
    return {
        departmentId: row.departmentId,
        departmentName: row.departmentName,
        description,
        severity,
        type,
    };
}

function buildPoRollups(args: {
    rows: readonly InstitutionalOverviewRow[];
    tenantUsers: readonly InstitutionalTenantUserRecord[];
    usersById: Map<string, InstitutionalUserRecord>;
}): InstitutionalPoRollup[] {
    return args.tenantUsers
        .filter((tenantUser) => tenantUser.role === "procurement_officer")
        .map((tenantUser) => {
            const rows = args.rows.filter(
                (row) => row.procurementOfficer.id === tenantUser.id,
            );
            const notStarted = rows.filter((row) => row.status === "not_started").length;
            const complete = rows.filter((row) => row.status === "approved").length;
            const attentionNeeded = rows.filter(
                (row) =>
                    row.anomalyCount > 0 ||
                    row.status === "rejected" ||
                    row.procurementOfficer.state !== "active",
            ).length;
            const inProgress = rows.length - notStarted - complete;
            const status = derivePoRollupStatus({
                attentionNeeded,
                complete,
                departmentCount: rows.length,
                inProgress,
                notStarted,
            });
            const user = args.usersById.get(tenantUser.userId);
            return {
                attentionNeeded,
                complete,
                departmentCount: rows.length,
                id: tenantUser.id,
                inProgress,
                lastActivityAt: rows
                    .map((row) => row.lastActivityAt)
                    .filter((value): value is number => typeof value === "number")
                    .sort((left, right) => right - left)[0] ?? null,
                name:
                    user?.name?.trim() ||
                    user?.email?.split("@")[0] ||
                    "Procurement Officer",
                notStarted,
                status,
                statusLabel: getPoRollupStatusLabel(status),
            };
        })
        .sort((left, right) => left.name.localeCompare(right.name));
}

function derivePoRollupStatus(args: {
    attentionNeeded: number;
    complete: number;
    departmentCount: number;
    inProgress: number;
    notStarted: number;
}): InstitutionalPoRollupStatus {
    if (args.attentionNeeded > 0) {
        return "attention_needed";
    }
    if (args.departmentCount === 0 || args.notStarted === args.departmentCount) {
        return "not_started";
    }
    if (args.complete === args.departmentCount) {
        return "complete";
    }
    return args.inProgress > 0 ? "in_progress" : "not_started";
}

function getPoRollupStatusLabel(
    status: InstitutionalPoRollupStatus,
): InstitutionalPoRollup["statusLabel"] {
    switch (status) {
        case "attention_needed":
            return "Attention Needed";
        case "complete":
            return "Complete";
        case "in_progress":
            return "In Progress";
        default:
            return "Not Started";
    }
}

function buildInstitutionalFiscalYears(
    args: BuildTenantAdminInstitutionalOverviewArgs,
): string[] {
    const years = new Set<string>([
        args.fiscalYear,
        getFiscalYearForDate(args.now).key,
    ]);

    for (const deadline of args.submissionDeadlines) {
        years.add(deadline.fiscalYearKey);
    }
    for (const plan of args.plans) {
        years.add(plan.fiscalYear);
    }
    for (const snapshot of args.planSubmissionSnapshots) {
        years.add(snapshot.fiscalYear);
    }
    for (const decision of args.planReviewDecisions) {
        years.add(decision.fiscalYear);
    }
    for (const department of args.departments) {
        for (const timestamp of [
            department.submissionStartsAt,
            department.submissionEndsAt,
            department.createdAt,
            department.updatedAt,
        ]) {
            if (typeof timestamp === "number") {
                years.add(getFiscalYearForDate(timestamp).key);
            }
        }
    }
    for (const log of args.auditLogs) {
        years.add(getFiscalYearForDate(log.timestamp).key);
    }

    return Array.from(years).sort((left, right) => right.localeCompare(left));
}

function mapMonitoringStatus(
    status: ReturnType<typeof deriveProcurementOfficerMonitoringStatus>,
): InstitutionalOverviewStatus {
    return status;
}

function findDuplicateNormalizedValues(
    departments: readonly InstitutionalDepartmentRecord[],
    field: "code" | "name",
): Set<string> {
    const counts = new Map<string, number>();
    for (const department of departments) {
        const stored =
            field === "code" ? department.normalizedCode : department.normalizedName;
        const display = field === "code" ? department.code : department.name;
        const normalized = normalizeForComparison(stored || display || "");
        if (!normalized) {
            continue;
        }
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }

    return new Set(
        Array.from(counts.entries())
            .filter(([, count]) => count > 1)
            .map(([value]) => value),
    );
}

function groupBy<TItem>(
    items: readonly TItem[],
    getKey: (item: TItem) => string,
): Map<string, TItem[]> {
    const grouped = new Map<string, TItem[]>();
    for (const item of items) {
        const key = getKey(item);
        const collection = grouped.get(key) ?? [];
        collection.push(item);
        grouped.set(key, collection);
    }
    return grouped;
}

export function normalizeForComparison(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-KE", {
        currency: "KES",
        maximumFractionDigits: 0,
        style: "currency",
    }).format(value);
}
