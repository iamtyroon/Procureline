"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantAdminDashboardSnapshot = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const _roleGuard_1 = require("./_roleGuard");
const dashboard_snapshot_1 = require("../../lib/shared/tenant-admin/dashboard-snapshot");
const dashboard_1 = require("../../lib/shared/tenant-admin/dashboard");
const institutional_visibility_1 = require("../../lib/shared/tenant-admin/institutional-visibility");
const invitations_1 = require("../../lib/procurement-officer/invitations");
const metricStateValidator = values_1.v.union(values_1.v.literal("available"), values_1.v.literal("empty"), values_1.v.literal("unconfigured"), values_1.v.literal("unavailable"));
const cycleStateValidator = values_1.v.union(values_1.v.literal("setup_required"), values_1.v.literal("before_start"), values_1.v.literal("active_submission"), values_1.v.literal("cycle_complete"));
const timelineStepStatusValidator = values_1.v.union(values_1.v.literal("complete"), values_1.v.literal("current"), values_1.v.literal("upcoming"), values_1.v.literal("blocked"));
const onboardingStatusValidator = values_1.v.union(values_1.v.literal("blocked"), values_1.v.literal("complete"), values_1.v.literal("recommended"));
const availabilityValidator = values_1.v.union(values_1.v.literal("available"), values_1.v.literal("coming_soon"));
const quickActionStatusValidator = values_1.v.union(values_1.v.literal("coming_soon"), values_1.v.literal("ready"), values_1.v.literal("setup_required"));
const tenantTierValidator = values_1.v.union(values_1.v.literal("free"), values_1.v.literal("starter"), values_1.v.literal("professional"), values_1.v.literal("enterprise"));
const tenantStatusValidator = values_1.v.union(values_1.v.literal("active"), values_1.v.literal("cancelled"), values_1.v.literal("suspended"));
const summaryCardValidator = values_1.v.object({
    dataState: metricStateValidator,
    helperText: values_1.v.string(),
    id: values_1.v.string(),
    label: values_1.v.string(),
    statusLabel: values_1.v.string(),
    tone: values_1.v.union(values_1.v.literal("neutral"), values_1.v.literal("positive"), values_1.v.literal("warning")),
    trendLabel: values_1.v.string(),
    value: values_1.v.string(),
});
const institutionalOverviewStatusValidator = values_1.v.union(values_1.v.literal("approved"), values_1.v.literal("draft"), values_1.v.literal("not_started"), values_1.v.literal("rejected"), values_1.v.literal("submitted"));
const institutionalAnomalyTypeValidator = values_1.v.union(values_1.v.literal("budget_variance"), values_1.v.literal("duplicate_department_code"), values_1.v.literal("duplicate_department_name"), values_1.v.literal("invalid_budget_allocation"), values_1.v.literal("missing_du_coverage"), values_1.v.literal("over_budget"), values_1.v.literal("stale_submitted_plan"), values_1.v.literal("unresolved_po_assignment"));
const institutionalBudgetValidator = values_1.v.object({
    allocation: values_1.v.union(values_1.v.number(), values_1.v.null()),
    allocationLabel: values_1.v.string(),
    state: values_1.v.union(values_1.v.literal("available"), values_1.v.literal("invalid"), values_1.v.literal("unavailable")),
    used: values_1.v.union(values_1.v.number(), values_1.v.null()),
    usedLabel: values_1.v.string(),
    utilizationLabel: values_1.v.string(),
    utilizationPercent: values_1.v.union(values_1.v.number(), values_1.v.null()),
});
const institutionalCategorySummaryValidator = values_1.v.object({
    amount: values_1.v.number(),
    categoryId: values_1.v.string(),
    categoryName: values_1.v.string(),
    itemCount: values_1.v.number(),
});
const institutionalOverviewValidator = values_1.v.object({
    anomalies: values_1.v.array(values_1.v.object({
        departmentId: values_1.v.string(),
        departmentName: values_1.v.string(),
        description: values_1.v.string(),
        severity: values_1.v.union(values_1.v.literal("attention"), values_1.v.literal("critical"), values_1.v.literal("warning")),
        type: institutionalAnomalyTypeValidator,
    })),
    availableFiscalYears: values_1.v.array(values_1.v.string()),
    exportRequest: values_1.v.object({
        asOf: values_1.v.number(),
        state: values_1.v.union(values_1.v.literal("queued"), values_1.v.literal("export_ready")),
        summary: values_1.v.string(),
    }),
    fiscalYear: values_1.v.string(),
    generatedAt: values_1.v.number(),
    poRollups: values_1.v.array(values_1.v.object({
        attentionNeeded: values_1.v.number(),
        complete: values_1.v.number(),
        departmentCount: values_1.v.number(),
        id: values_1.v.string(),
        inProgress: values_1.v.number(),
        lastActivityAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        name: values_1.v.string(),
        notStarted: values_1.v.number(),
        status: values_1.v.union(values_1.v.literal("attention_needed"), values_1.v.literal("complete"), values_1.v.literal("in_progress"), values_1.v.literal("not_started")),
        statusLabel: values_1.v.union(values_1.v.literal("Attention Needed"), values_1.v.literal("Complete"), values_1.v.literal("In Progress"), values_1.v.literal("Not Started")),
    })),
    rows: values_1.v.array(values_1.v.object({
        anomalyCount: values_1.v.number(),
        budget: institutionalBudgetValidator,
        categorySummaries: values_1.v.array(institutionalCategorySummaryValidator),
        departmentCode: values_1.v.union(values_1.v.string(), values_1.v.null()),
        departmentId: values_1.v.string(),
        departmentName: values_1.v.string(),
        duContacts: values_1.v.array(values_1.v.object({
            email: values_1.v.string(),
            id: values_1.v.string(),
            name: values_1.v.string(),
            state: values_1.v.literal("active"),
        })),
        itemTotal: values_1.v.number(),
        lastActivityAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        planId: values_1.v.union(values_1.v.string(), values_1.v.null()),
        procurementOfficer: values_1.v.object({
            email: values_1.v.union(values_1.v.string(), values_1.v.null()),
            id: values_1.v.union(values_1.v.string(), values_1.v.null()),
            name: values_1.v.string(),
            state: values_1.v.union(values_1.v.literal("active"), values_1.v.literal("inactive"), values_1.v.literal("unavailable")),
        }),
        status: institutionalOverviewStatusValidator,
        statusLabel: values_1.v.string(),
        timeline: values_1.v.array(values_1.v.object({
            description: values_1.v.string(),
            id: values_1.v.string(),
            timestamp: values_1.v.union(values_1.v.number(), values_1.v.null()),
            timestampLabel: values_1.v.string(),
            title: values_1.v.string(),
        })),
    })),
    summary: values_1.v.object({
        anomalyCount: values_1.v.number(),
        approvedOrSubmitted: values_1.v.number(),
        approvedOrSubmittedLabel: values_1.v.string(),
        poCoverageLabel: values_1.v.string(),
        totalAllocated: values_1.v.number(),
        totalAllocatedLabel: values_1.v.string(),
        totalDepartments: values_1.v.number(),
        totalUtilizationLabel: values_1.v.string(),
        totalUtilizationPercent: values_1.v.union(values_1.v.number(), values_1.v.null()),
        totalUtilized: values_1.v.number(),
        totalUtilizedLabel: values_1.v.string(),
    }),
});
const dashboardSnapshotValidator = values_1.v.object({
    activityFeed: values_1.v.object({
        items: values_1.v.array(values_1.v.object({
            action: values_1.v.string(),
            actor: values_1.v.string(),
            entity: values_1.v.string(),
            id: values_1.v.string(),
            occurredAt: values_1.v.number(),
            occurredAtLabel: values_1.v.string(),
            outcome: values_1.v.string(),
        })),
        state: values_1.v.union(values_1.v.literal("available"), values_1.v.literal("empty")),
        totalReturned: values_1.v.number(),
    }),
    cycleState: values_1.v.object({
        countdown: values_1.v.object({
            label: values_1.v.string(),
            mode: values_1.v.union(values_1.v.literal("until_start"), values_1.v.literal("until_deadline"), values_1.v.literal("completed"), values_1.v.literal("unavailable")),
            targetAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        }),
        description: values_1.v.string(),
        reason: values_1.v.union(values_1.v.literal("inconsistent_windows"), values_1.v.literal("invalid_window"), values_1.v.literal("missing_windows"), values_1.v.literal("no_departments"), values_1.v.null()),
        safeWindow: values_1.v.union(values_1.v.object({
            endAt: values_1.v.number(),
            startAt: values_1.v.number(),
        }), values_1.v.null()),
        state: cycleStateValidator,
        timeline: values_1.v.array(values_1.v.object({
            description: values_1.v.string(),
            id: values_1.v.string(),
            label: values_1.v.string(),
            status: timelineStepStatusValidator,
        })),
        title: values_1.v.string(),
    }),
    departmentStatus: values_1.v.array(values_1.v.object({
        detail: values_1.v.string(),
        id: values_1.v.string(),
        name: values_1.v.string(),
        progressTone: values_1.v.union(values_1.v.literal("neutral"), values_1.v.literal("positive"), values_1.v.literal("warning")),
        progressValue: values_1.v.number(),
        statusLabel: values_1.v.string(),
    })),
    directory: values_1.v.object({
        currentTenantAdmin: values_1.v.union(values_1.v.object({
            email: values_1.v.string(),
            initials: values_1.v.string(),
            name: values_1.v.string(),
        }), values_1.v.null()),
        departmentUsers: values_1.v.array(values_1.v.object({
            departmentName: values_1.v.string(),
            email: values_1.v.string(),
            id: values_1.v.string(),
            initials: values_1.v.string(),
            lastSeenAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
            lastSeenLabel: values_1.v.string(),
            name: values_1.v.string(),
            statusLabel: values_1.v.string(),
        })),
        procurementOfficerDirectory: values_1.v.array(values_1.v.object({
            activationCodeSuffix: values_1.v.optional(values_1.v.string()),
            departmentsManaged: values_1.v.number(),
            email: values_1.v.string(),
            id: values_1.v.string(),
            invitationId: values_1.v.optional(values_1.v.string()),
            initials: values_1.v.string(),
            issuedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
            issuedAtLabel: values_1.v.string(),
            lastSeenAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
            lastSeenLabel: values_1.v.string(),
            name: values_1.v.string(),
            source: values_1.v.union(values_1.v.literal("active_member"), values_1.v.literal("invitation")),
            status: values_1.v.union(values_1.v.literal("accepted"), values_1.v.literal("active"), values_1.v.literal("bounced"), values_1.v.literal("expired"), values_1.v.literal("inactive"), values_1.v.literal("pending")),
            statusLabel: values_1.v.string(),
        })),
        procurementOfficers: values_1.v.array(values_1.v.object({
            departmentsManaged: values_1.v.number(),
            email: values_1.v.string(),
            id: values_1.v.string(),
            initials: values_1.v.string(),
            lastSeenAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
            lastSeenLabel: values_1.v.string(),
            name: values_1.v.string(),
            statusLabel: values_1.v.string(),
        })),
    }),
    meta: values_1.v.object({
        availableFiscalYears: values_1.v.array(values_1.v.string()),
        currentFiscalYear: values_1.v.string(),
        emptyPeriodReason: values_1.v.union(values_1.v.string(), values_1.v.null()),
        hasDataForSelectedFiscalYear: values_1.v.boolean(),
        isSelectedCurrentFiscalYear: values_1.v.boolean(),
        lastUpdatedAt: values_1.v.number(),
        selectedFiscalYear: values_1.v.string(),
        snapshotGeneratedAt: values_1.v.number(),
        sourceState: values_1.v.union(values_1.v.literal("cached"), values_1.v.literal("live")),
        tenantId: values_1.v.string(),
        tenantName: values_1.v.string(),
        tenantStatus: tenantStatusValidator,
        tenantTier: tenantTierValidator,
    }),
    onboardingChecklist: values_1.v.array(values_1.v.object({
        availability: availabilityValidator,
        description: values_1.v.string(),
        href: values_1.v.string(),
        id: values_1.v.union(values_1.v.literal("add_po"), values_1.v.literal("configure_settings"), values_1.v.literal("review_billing")),
        isPriority: values_1.v.boolean(),
        label: values_1.v.string(),
        status: onboardingStatusValidator,
    })),
    institutionalOverview: institutionalOverviewValidator,
    quickActions: values_1.v.array(values_1.v.object({
        description: values_1.v.string(),
        highlighted: values_1.v.boolean(),
        href: values_1.v.string(),
        id: values_1.v.union(values_1.v.literal("add_po"), values_1.v.literal("view_reports"), values_1.v.literal("settings")),
        label: values_1.v.string(),
        status: quickActionStatusValidator,
    })),
    summaryCards: values_1.v.object({
        budgetUtilization: summaryCardValidator,
        departments: summaryCardValidator,
        submissionProgress: summaryCardValidator,
        totalPOs: summaryCardValidator,
    }),
    userSummary: values_1.v.object({
        activeTotal: values_1.v.number(),
        departmentUsers: values_1.v.number(),
        procurementOfficers: values_1.v.number(),
        tenantAdmins: values_1.v.number(),
    }),
});
exports.getTenantAdminDashboardSnapshot = (0, server_1.query)({
    args: {
        selectedFiscalYear: values_1.v.optional(values_1.v.string()),
    },
    returns: dashboardSnapshotValidator,
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const tenant = await ctx.db.get(authContext.tenantId);
        if (!tenant) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }
        const now = Date.now();
        const selectedFiscalYear = args.selectedFiscalYear ?? (0, dashboard_1.getFiscalYearForDate)(now).key;
        const [tenantUsers, departments, departmentUserProfiles, poInvitations, targetActivity, sourceActivity, submissionDeadlines] = await Promise.all([
            ctx.db
                .query("tenantUsers")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("departments")
                .withIndex("by_tenantId_isActive", (q) => q.eq("tenantId", authContext.tenantId).eq("isActive", true))
                .collect(),
            ctx.db
                .query("departmentUserProfiles")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("poInvitations")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("auditLogs")
                .withIndex("by_targetTenantId", (q) => q.eq("targetTenantId", authContext.tenantId))
                .order("desc")
                .take(20),
            ctx.db
                .query("auditLogs")
                .withIndex("by_sourceTenantId", (q) => q.eq("sourceTenantId", authContext.tenantId))
                .order("desc")
                .take(20),
            ctx.db
                .query("submissionDeadlines")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
        ]);
        const departmentProcurementData = await Promise.all(departments.map(async (department) => {
            const [departmentPlans, departmentSnapshots, departmentDecisions, departmentRedrafts] = await Promise.all([
                ctx.db
                    .query("plans")
                    .withIndex("by_departmentId", (q) => q.eq("departmentId", department._id))
                    .collect(),
                ctx.db
                    .query("planSubmissionSnapshots")
                    .withIndex("by_tenantId_departmentId_fiscalYear_capturedAt", (q) => q
                    .eq("tenantId", authContext.tenantId)
                    .eq("departmentId", department._id)
                    .eq("fiscalYear", selectedFiscalYear))
                    .collect(),
                ctx.db
                    .query("planReviewDecisions")
                    .withIndex("by_tenantId_departmentId_fiscalYear_decidedAt", (q) => q
                    .eq("tenantId", authContext.tenantId)
                    .eq("departmentId", department._id)
                    .eq("fiscalYear", selectedFiscalYear))
                    .collect(),
                ctx.db
                    .query("planRedraftRequests")
                    .withIndex("by_tenantId_departmentId_fiscalYear", (q) => q
                    .eq("tenantId", authContext.tenantId)
                    .eq("departmentId", department._id)
                    .eq("fiscalYear", selectedFiscalYear))
                    .collect(),
            ]);
            return {
                decisions: departmentDecisions,
                plans: departmentPlans,
                redrafts: departmentRedrafts,
                snapshots: departmentSnapshots,
            };
        }));
        const plans = departmentProcurementData.flatMap((entry) => entry.plans);
        const planSubmissionSnapshots = departmentProcurementData.flatMap((entry) => entry.snapshots);
        const planReviewDecisions = departmentProcurementData.flatMap((entry) => entry.decisions);
        const planRedraftRequests = departmentProcurementData.flatMap((entry) => entry.redrafts);
        const fiscalYearKeys = Array.from(new Set([
            selectedFiscalYear,
            ...plans.map((plan) => plan.fiscalYear),
            ...planSubmissionSnapshots.map((snapshot) => snapshot.fiscalYear),
            ...planReviewDecisions.map((decision) => decision.fiscalYear),
            ...planRedraftRequests.map((request) => request.fiscalYear),
            ...submissionDeadlines.map((deadline) => deadline.fiscalYearKey),
        ]));
        const mergedActivity = [...targetActivity, ...sourceActivity]
            .sort((left, right) => right.timestamp - left.timestamp)
            .filter((activity, index, collection) => collection.findIndex((candidate) => candidate._id === activity._id) === index)
            .slice(0, 20);
        const userIds = Array.from(new Set(tenantUsers
            .map((tenantUser) => tenantUser.userId)
            .concat(authContext.userId)));
        const userDocuments = await Promise.all(userIds.map(async (userId) => [String(userId), await ctx.db.get(userId)]));
        const userDocumentMap = new Map(userDocuments);
        const departmentsById = new Map(departments.map((department) => [String(department._id), department]));
        const lastSeenByUserId = new Map();
        for (const activity of mergedActivity) {
            if (!activity.actorUserId) {
                continue;
            }
            const key = String(activity.actorUserId);
            const existing = lastSeenByUserId.get(key);
            if (existing === undefined || activity.timestamp > existing) {
                lastSeenByUserId.set(key, activity.timestamp);
            }
        }
        for (const profile of departmentUserProfiles) {
            const tenantUser = tenantUsers.find((candidate) => candidate._id === profile.tenantUserId);
            if (!tenantUser || profile.lastAuthenticatedAt === undefined) {
                continue;
            }
            const key = String(tenantUser.userId);
            const existing = lastSeenByUserId.get(key);
            if (existing === undefined || profile.lastAuthenticatedAt > existing) {
                lastSeenByUserId.set(key, profile.lastAuthenticatedAt);
            }
        }
        const procurementOfficers = tenantUsers
            .filter((tenantUser) => tenantUser.role === "procurement_officer")
            .map((tenantUser) => {
            const authUser = userDocumentMap.get(String(tenantUser.userId));
            const summary = readAuthUserSummary(authUser, "Procurement Officer");
            const lastSeenAt = lastSeenByUserId.get(String(tenantUser.userId)) ?? null;
            return {
                departmentsManaged: departments.filter((department) => department.procurementOfficerTenantUserId === tenantUser._id &&
                    department.isActive).length,
                email: summary.email,
                id: String(tenantUser._id),
                initials: summary.initials,
                lastSeenAt,
                lastSeenLabel: formatLastSeenLabel(lastSeenAt),
                name: summary.name,
                statusLabel: tenantUser.isActive ? "Active" : "Inactive",
            };
        });
        const activeProcurementOfficerEmailSet = new Set(procurementOfficers.map((member) => member.email.toLowerCase()));
        const invitationDirectory = poInvitations
            .map((invitation) => {
            const effectiveStatus = (0, invitations_1.evaluateProcurementOfficerInvitationStatus)({
                expiresAt: invitation.expiresAt,
                now: Date.now(),
                status: invitation.status,
            });
            if (effectiveStatus === "accepted" &&
                activeProcurementOfficerEmailSet.has(invitation.email.toLowerCase())) {
                return null;
            }
            if (effectiveStatus !== "accepted" &&
                activeProcurementOfficerEmailSet.has(invitation.email.toLowerCase())) {
                return null;
            }
            if (effectiveStatus === "revoked") {
                return null;
            }
            return {
                activationCodeSuffix: invitation.activationCodeSuffix,
                departmentsManaged: 0,
                email: invitation.email,
                id: String(invitation._id),
                invitationId: String(invitation._id),
                initials: readNameInitials(invitation.fullName),
                issuedAt: invitation.createdAt,
                issuedAtLabel: formatIssuedLabel(invitation.createdAt),
                lastSeenAt: null,
                lastSeenLabel: "Invitation not accepted yet",
                name: invitation.fullName,
                source: "invitation",
                status: effectiveStatus === "accepted"
                    ? "accepted"
                    : effectiveStatus === "bounced"
                        ? "bounced"
                        : effectiveStatus === "expired"
                            ? "expired"
                            : "pending",
                statusLabel: (0, invitations_1.formatProcurementOfficerInvitationStatusLabel)(effectiveStatus),
            };
        })
            .filter((entry) => entry !== null);
        const memberDirectory = procurementOfficers
            .map((member) => ({
            activationCodeSuffix: undefined,
            departmentsManaged: member.departmentsManaged,
            email: member.email,
            id: member.id,
            invitationId: undefined,
            initials: member.initials,
            issuedAt: null,
            issuedAtLabel: member.lastSeenLabel,
            lastSeenAt: member.lastSeenAt,
            lastSeenLabel: member.lastSeenLabel,
            name: member.name,
            source: "active_member",
            status: member.statusLabel === "Inactive"
                ? "inactive"
                : "active",
            statusLabel: member.statusLabel,
        }));
        const procurementOfficerDirectory = [
            ...memberDirectory,
            ...invitationDirectory,
        ]
            .sort((left, right) => left.name.localeCompare(right.name));
        const departmentUsersDirectory = departmentUserProfiles
            .map((profile) => {
            const tenantUser = tenantUsers.find((candidate) => candidate._id === profile.tenantUserId);
            if (!tenantUser) {
                return null;
            }
            const authUser = userDocumentMap.get(String(tenantUser.userId));
            const summary = readAuthUserSummary(authUser, "Department User");
            const lastSeenAt = profile.lastAuthenticatedAt ??
                lastSeenByUserId.get(String(tenantUser.userId)) ??
                null;
            return {
                departmentName: departmentsById.get(String(profile.departmentId))?.name ??
                    "Unassigned department",
                email: summary.email,
                id: String(profile.tenantUserId),
                initials: summary.initials,
                lastSeenAt,
                lastSeenLabel: formatLastSeenLabel(lastSeenAt),
                name: summary.name,
                statusLabel: profile.isActive && tenantUser.isActive ? "Active" : "Inactive",
            };
        })
            .filter((profile) => profile !== null)
            .sort((left, right) => left.name.localeCompare(right.name));
        const currentAdminSummary = readAuthUserSummary(userDocumentMap.get(String(authContext.userId)), "Tenant Admin");
        const baseSnapshot = (0, dashboard_snapshot_1.buildTenantAdminDashboardSnapshot)({
            activityLogs: mergedActivity.map((activity) => ({
                action: activity.action,
                actorRole: activity.actorRole,
                actorUserId: activity.actorUserId ? String(activity.actorUserId) : undefined,
                entityType: activity.entityType,
                event: activity.event,
                id: String(activity._id),
                metadata: activity.metadata,
                outcome: activity.outcome,
                recordId: activity.recordId,
                timestamp: activity.timestamp,
            })),
            departments: departments.map((department) => ({
                createdAt: department.createdAt,
                id: String(department._id),
                isActive: department.isActive,
                name: department.name,
                submissionEndsAt: department.submissionEndsAt,
                submissionStartsAt: department.submissionStartsAt,
                updatedAt: department.updatedAt,
            })),
            fiscalYearKeys,
            now: Date.now(),
            selectedFiscalYear,
            tenant: {
                createdAt: tenant.createdAt,
                id: String(tenant._id),
                name: tenant.name,
                status: tenant.status,
                tier: tenant.tier,
            },
            tenantUsers: tenantUsers.map((tenantUser) => ({
                id: String(tenantUser._id),
                isActive: tenantUser.isActive,
                role: tenantUser.role,
            })),
        });
        const institutionalOverview = (0, institutional_visibility_1.buildTenantAdminInstitutionalOverview)({
            auditLogs: mergedActivity.map((activity) => ({
                actorUserId: activity.actorUserId ? String(activity.actorUserId) : null,
                event: activity.event,
                id: String(activity._id),
                recordId: activity.recordId,
                timestamp: activity.timestamp,
            })),
            departments: departments.map((department) => ({
                budgetAllocation: department.budgetAllocation,
                code: department.code,
                createdAt: department.createdAt,
                id: String(department._id),
                isActive: department.isActive,
                name: department.name,
                normalizedCode: department.normalizedCode,
                normalizedName: department.normalizedName,
                procurementOfficerTenantUserId: String(department.procurementOfficerTenantUserId),
                submissionEndsAt: department.submissionEndsAt,
                submissionStartsAt: department.submissionStartsAt,
                updatedAt: department.updatedAt,
            })),
            departmentUserProfiles: departmentUserProfiles.map((profile) => ({
                departmentId: String(profile.departmentId),
                id: String(profile._id),
                isActive: profile.isActive,
                lastAuthenticatedAt: profile.lastAuthenticatedAt,
                normalizedEmail: profile.normalizedEmail,
                tenantId: String(profile.tenantId),
                tenantUserId: String(profile.tenantUserId),
                updatedAt: profile.updatedAt,
            })),
            fiscalYear: baseSnapshot.meta.selectedFiscalYear,
            now,
            planReviewDecisions: planReviewDecisions.map((decision) => ({
                comment: decision.comment,
                decidedAt: decision.decidedAt,
                decisionType: decision.decisionType,
                fiscalYear: decision.fiscalYear,
                id: String(decision._id),
                lifecycleStatus: decision.lifecycleStatus,
                planId: String(decision.planId),
                revisionDeadlineAt: decision.revisionDeadlineAt,
            })),
            planSubmissionSnapshots: planSubmissionSnapshots.map((snapshot) => ({
                capturedAt: snapshot.capturedAt,
                categorySummaries: snapshot.categorySummaries,
                departmentId: String(snapshot.departmentId),
                estimatedBudgetUsed: snapshot.estimatedBudgetUsed,
                fiscalYear: snapshot.fiscalYear,
                id: String(snapshot._id),
                itemCount: snapshot.itemCount,
                lifecycleStatus: snapshot.lifecycleStatus,
                planId: String(snapshot.planId),
                selectedCategoryIds: snapshot.selectedCategoryIds,
                submittedAt: snapshot.submittedAt,
                submissionReference: snapshot.submissionReference,
                submissionSequence: snapshot.submissionSequence,
                withdrawnAt: snapshot.withdrawnAt,
            })),
            plans: plans.map((plan) => ({
                approvedAt: plan.approvedAt,
                categorySummaries: plan.categorySummaries.map((summary) => ({
                    amount: summary.amount,
                    categoryId: String(summary.categoryId),
                    categoryName: summary.categoryName,
                    itemCount: summary.itemCount,
                })),
                createdAt: plan.createdAt,
                departmentId: String(plan.departmentId),
                estimatedBudgetUsed: plan.estimatedBudgetUsed,
                fiscalYear: plan.fiscalYear,
                id: String(plan._id),
                itemCount: plan.itemCount,
                lastApprovedAt: plan.lastApprovedAt,
                rejectedAt: plan.rejectedAt,
                rejectionComment: plan.rejectionComment,
                reviewStartedAt: plan.reviewStartedAt,
                selectedCategoryIds: plan.selectedCategoryIds.map(String),
                status: plan.status,
                submittedAt: plan.submittedAt,
                submissionReference: plan.submissionReference,
                updatedAt: plan.updatedAt,
            })),
            submissionDeadlines: submissionDeadlines.map((deadline) => ({
                fiscalYearKey: deadline.fiscalYearKey,
                submissionEndsAt: deadline.submissionEndsAt,
                submissionStartsAt: deadline.submissionStartsAt,
                updatedAt: deadline.updatedAt,
            })),
            tenantId: String(authContext.tenantId),
            tenantUsers: tenantUsers.map((tenantUser) => ({
                id: String(tenantUser._id),
                isActive: tenantUser.isActive,
                role: tenantUser.role,
                tenantId: String(tenantUser.tenantId),
                userId: String(tenantUser.userId),
            })),
            users: userDocuments.map(([userId, userDocument]) => {
                const summary = readAuthUserSummary(userDocument, "User");
                return {
                    email: summary.email === "No email available" ? null : summary.email,
                    id: userId,
                    name: summary.name,
                };
            }),
        });
        return {
            ...baseSnapshot,
            directory: {
                currentTenantAdmin: {
                    email: currentAdminSummary.email,
                    initials: currentAdminSummary.initials,
                    name: currentAdminSummary.name,
                },
                departmentUsers: departmentUsersDirectory,
                procurementOfficerDirectory,
                procurementOfficers,
            },
            institutionalOverview,
        };
    },
});
function readAuthUserSummary(userDocument, fallbackName) {
    const record = userDocument && typeof userDocument === "object" && !Array.isArray(userDocument)
        ? userDocument
        : {};
    const email = typeof record.email === "string" && record.email.trim().length > 0
        ? record.email.trim()
        : "No email available";
    const name = typeof record.name === "string" && record.name.trim().length > 0
        ? record.name.trim()
        : email !== "No email available"
            ? email.split("@")[0] || fallbackName
            : fallbackName;
    return {
        email,
        initials: name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0))
            .join("")
            .toUpperCase(),
        name,
    };
}
function formatLastSeenLabel(lastSeenAt) {
    return lastSeenAt ? new Date(lastSeenAt).toLocaleString("en-GB") : "No activity recorded";
}
function formatIssuedLabel(timestamp) {
    return timestamp ? new Date(timestamp).toLocaleString("en-GB") : "Not issued";
}
function readNameInitials(name) {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase();
}
