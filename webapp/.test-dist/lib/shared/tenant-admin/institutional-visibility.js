"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeForComparison = exports.buildInstitutionalExportPreview = exports.summarizeInstitutionalOverview = exports.filterInstitutionalOverviewRows = exports.buildTenantAdminInstitutionalOverview = void 0;
const submission_monitoring_1 = require("../procurement-officer/submission-monitoring");
const dashboard_1 = require("./dashboard");
function buildTenantAdminInstitutionalOverview(args) {
    const tenantUsersById = new Map(args.tenantUsers.map((user) => [user.id, user]));
    const usersById = new Map(args.users.map((user) => [user.id, user]));
    const decisionsByPlanId = groupBy(args.planReviewDecisions, (decision) => decision.planId);
    const snapshotsByPlanId = groupBy(args.planSubmissionSnapshots, (snapshot) => snapshot.planId);
    const plansByDepartmentId = groupBy(args.plans, (plan) => plan.departmentId);
    const auditByRecordId = groupBy(args.auditLogs.filter((log) => typeof log.recordId === "string"), (log) => log.recordId ?? "");
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
        const canonicalPlan = (0, submission_monitoring_1.selectCanonicalMonitoringPlan)(departmentPlans, args.fiscalYear);
        const activeSnapshot = canonicalPlan
            ? selectLatestActiveSnapshot(snapshotsByPlanId.get(canonicalPlan.id) ?? [])
            : null;
        const status = mapMonitoringStatus((0, submission_monitoring_1.deriveProcurementOfficerMonitoringStatus)(canonicalPlan));
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
        const usedBudget = activeSnapshot?.estimatedBudgetUsed ??
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
            .filter((value) => typeof value === "number")
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
            statusLabel: status === "not_started"
                ? "Not Started"
                : (0, submission_monitoring_1.getProcurementOfficerMonitoringStatusLabel)(status),
            timeline: (0, submission_monitoring_1.buildProcurementOfficerMonitoringTimeline)({
                plan: canonicalPlan,
                timeZone: "Africa/Nairobi",
            }).map(({ description, id, timestamp, timestampLabel, title }) => ({
                description,
                id,
                timestamp,
                timestampLabel,
                title,
            })),
        };
    });
    const anomalies = buildInstitutionalAnomalies({
        duplicateCodes,
        duplicateNames,
        fiscalYear: args.fiscalYear,
        now: args.now,
        rows,
        staleSubmittedThresholdMs: args.staleSubmittedThresholdMs ?? 7 * 24 * 60 * 60 * 1000,
    });
    const anomalyCounts = new Map();
    for (const anomaly of anomalies) {
        anomalyCounts.set(anomaly.departmentId, (anomalyCounts.get(anomaly.departmentId) ?? 0) + 1);
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
exports.buildTenantAdminInstitutionalOverview = buildTenantAdminInstitutionalOverview;
function filterInstitutionalOverviewRows(rows, filter) {
    const query = normalizeForComparison(filter.query ?? "");
    return rows.filter((row) => {
        if (filter.status &&
            filter.status !== "all" &&
            row.status !== filter.status) {
            return false;
        }
        if (filter.procurementOfficerId &&
            filter.procurementOfficerId !== "all" &&
            row.procurementOfficer.id !== filter.procurementOfficerId) {
            return false;
        }
        if (!query) {
            return true;
        }
        return normalizeForComparison(`${row.departmentName} ${row.departmentCode ?? ""}`).includes(query);
    });
}
exports.filterInstitutionalOverviewRows = filterInstitutionalOverviewRows;
function summarizeInstitutionalOverview(rows, anomalies) {
    const totalAllocated = rows.reduce((sum, row) => sum + (row.budget.state === "available" ? row.budget.allocation ?? 0 : 0), 0);
    const totalUtilized = rows.reduce((sum, row) => sum + (row.budget.used ?? 0), 0);
    const totalUtilizationPercent = totalAllocated > 0 ? Math.round((totalUtilized / totalAllocated) * 100) : null;
    const approvedOrSubmitted = rows.filter((row) => row.status === "approved" || row.status === "submitted").length;
    const poCovered = rows.filter((row) => row.procurementOfficer.state === "active").length;
    return {
        anomalyCount: anomalies.length,
        approvedOrSubmitted,
        approvedOrSubmittedLabel: `${approvedOrSubmitted} of ${rows.length}`,
        poCoverageLabel: `${poCovered} of ${rows.length}`,
        totalAllocated,
        totalAllocatedLabel: formatCurrency(totalAllocated),
        totalDepartments: rows.length,
        totalUtilizationLabel: totalUtilizationPercent === null ? "Unavailable" : `${totalUtilizationPercent}%`,
        totalUtilizationPercent,
        totalUtilized,
        totalUtilizedLabel: formatCurrency(totalUtilized),
    };
}
exports.summarizeInstitutionalOverview = summarizeInstitutionalOverview;
function buildInstitutionalExportPreview(args) {
    return {
        departments: args.overview.rows.map((row) => ({
            anomalies: args.overview.anomalies.filter((anomaly) => anomaly.departmentId === row.departmentId),
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
exports.buildInstitutionalExportPreview = buildInstitutionalExportPreview;
function enrichPlanForOverview(args) {
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
function selectLatestActiveSnapshot(snapshots) {
    return [...snapshots]
        .filter((snapshot) => snapshot.lifecycleStatus !== "withdrawn")
        .sort((left, right) => {
        const leftTimestamp = left.submittedAt ?? left.capturedAt;
        const rightTimestamp = right.submittedAt ?? right.capturedAt;
        return rightTimestamp - leftTimestamp;
    })[0] ?? null;
}
function resolveProcurementOfficer(args) {
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
function resolveSafeDuContacts(args) {
    const contacts = new Map();
    for (const profile of args.profiles) {
        if (profile.departmentId !== args.departmentId ||
            profile.tenantId !== args.tenantId ||
            !profile.isActive) {
            continue;
        }
        const tenantUser = args.tenantUsersById.get(profile.tenantUserId);
        if (!tenantUser ||
            tenantUser.tenantId !== args.tenantId ||
            tenantUser.role !== "department_user" ||
            !tenantUser.isActive) {
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
    return Array.from(contacts.values()).sort((left, right) => left.name.localeCompare(right.name));
}
function buildBudgetPresentation(args) {
    const allocation = typeof args.allocation === "number" && Number.isFinite(args.allocation)
        ? args.allocation
        : null;
    const used = typeof args.used === "number" && Number.isFinite(args.used)
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
    const utilizationPercent = used === null ? null : Math.round((used / allocation) * 100);
    return {
        allocation,
        allocationLabel: formatCurrency(allocation),
        state: "available",
        used,
        usedLabel: used === null ? "Unavailable" : formatCurrency(used),
        utilizationLabel: utilizationPercent === null ? "Unavailable" : `${utilizationPercent}%`,
        utilizationPercent,
    };
}
function buildInstitutionalAnomalies(args) {
    const anomalies = [];
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
        if (row.budget.state === "available" &&
            typeof row.budget.used === "number" &&
            typeof row.budget.allocation === "number") {
            const variancePercent = ((row.budget.used - row.budget.allocation) / row.budget.allocation) * 100;
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
        const hasReview = row.timeline.some((item) => ["Approved", "Rejected", "Revision Requested", "Under Review"].includes(item.title));
        if (row.status === "submitted" &&
            typeof submittedTimeline?.timestamp === "number" &&
            !hasReview &&
            args.now - submittedTimeline.timestamp > args.staleSubmittedThresholdMs) {
            anomalies.push(createAnomaly(row, "stale_submitted_plan", "attention", `Submitted plan has not entered review after the configured threshold for ${args.fiscalYear}.`));
        }
    }
    return anomalies;
}
function createAnomaly(row, type, severity, description) {
    return {
        departmentId: row.departmentId,
        departmentName: row.departmentName,
        description,
        severity,
        type,
    };
}
function buildPoRollups(args) {
    return args.tenantUsers
        .filter((tenantUser) => tenantUser.role === "procurement_officer")
        .map((tenantUser) => {
        const rows = args.rows.filter((row) => row.procurementOfficer.id === tenantUser.id);
        const notStarted = rows.filter((row) => row.status === "not_started").length;
        const complete = rows.filter((row) => row.status === "approved").length;
        const attentionNeeded = rows.filter((row) => row.anomalyCount > 0 ||
            row.status === "rejected" ||
            row.procurementOfficer.state !== "active").length;
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
                .filter((value) => typeof value === "number")
                .sort((left, right) => right - left)[0] ?? null,
            name: user?.name?.trim() ||
                user?.email?.split("@")[0] ||
                "Procurement Officer",
            notStarted,
            status,
            statusLabel: getPoRollupStatusLabel(status),
        };
    })
        .sort((left, right) => left.name.localeCompare(right.name));
}
function derivePoRollupStatus(args) {
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
function getPoRollupStatusLabel(status) {
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
function buildInstitutionalFiscalYears(args) {
    const years = new Set([
        args.fiscalYear,
        (0, dashboard_1.getFiscalYearForDate)(args.now).key,
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
                years.add((0, dashboard_1.getFiscalYearForDate)(timestamp).key);
            }
        }
    }
    for (const log of args.auditLogs) {
        years.add((0, dashboard_1.getFiscalYearForDate)(log.timestamp).key);
    }
    return Array.from(years).sort((left, right) => right.localeCompare(left));
}
function mapMonitoringStatus(status) {
    return status;
}
function findDuplicateNormalizedValues(departments, field) {
    const counts = new Map();
    for (const department of departments) {
        const stored = field === "code" ? department.normalizedCode : department.normalizedName;
        const display = field === "code" ? department.code : department.name;
        const normalized = normalizeForComparison(stored || display || "");
        if (!normalized) {
            continue;
        }
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    return new Set(Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([value]) => value));
}
function groupBy(items, getKey) {
    const grouped = new Map();
    for (const item of items) {
        const key = getKey(item);
        const collection = grouped.get(key) ?? [];
        collection.push(item);
        grouped.set(key, collection);
    }
    return grouped;
}
function normalizeForComparison(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
exports.normalizeForComparison = normalizeForComparison;
function formatCurrency(value) {
    return new Intl.NumberFormat("en-KE", {
        currency: "KES",
        maximumFractionDigits: 0,
        style: "currency",
    }).format(value);
}
