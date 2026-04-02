"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantAdminDashboardSnapshot = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const _roleGuard_1 = require("./_roleGuard");
const dashboard_snapshot_1 = require("../../lib/tenant-admin/dashboard-snapshot");
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
        const [tenantUsers, departments, departmentUserProfiles, poInvitations, targetActivity, sourceActivity] = await Promise.all([
            ctx.db
                .query("tenantUsers")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("departments")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
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
        ]);
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
            now: Date.now(),
            selectedFiscalYear: args.selectedFiscalYear,
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
