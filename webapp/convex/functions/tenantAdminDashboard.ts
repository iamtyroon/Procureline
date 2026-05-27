import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { requireTenantRole } from "./_roleGuard";
import {
    buildTenantAdminDashboardSnapshot,
    type TenantAdminProcurementOfficerDirectoryEntry,
} from "../../lib/shared/tenant-admin/dashboard-snapshot";
import { getFiscalYearForDate } from "../../lib/shared/tenant-admin/dashboard";
import { buildTenantAdminInstitutionalOverview } from "../../lib/shared/tenant-admin/institutional-visibility";
import {
    evaluateProcurementOfficerInvitationStatus,
    formatProcurementOfficerInvitationStatusLabel,
} from "../../lib/procurement-officer/invitations";

const metricStateValidator = v.union(
    v.literal("available"),
    v.literal("empty"),
    v.literal("unconfigured"),
    v.literal("unavailable"),
);

const cycleStateValidator = v.union(
    v.literal("setup_required"),
    v.literal("before_start"),
    v.literal("active_submission"),
    v.literal("cycle_complete"),
);

const timelineStepStatusValidator = v.union(
    v.literal("complete"),
    v.literal("current"),
    v.literal("upcoming"),
    v.literal("blocked"),
);

const onboardingStatusValidator = v.union(
    v.literal("blocked"),
    v.literal("complete"),
    v.literal("recommended"),
);

const availabilityValidator = v.union(
    v.literal("available"),
    v.literal("coming_soon"),
);

const quickActionStatusValidator = v.union(
    v.literal("coming_soon"),
    v.literal("ready"),
    v.literal("setup_required"),
);

const tenantTierValidator = v.union(
    v.literal("free"),
    v.literal("starter"),
    v.literal("professional"),
    v.literal("enterprise"),
);

const tenantStatusValidator = v.union(
    v.literal("active"),
    v.literal("cancelled"),
    v.literal("pending"),
    v.literal("suspended"),
);

const summaryCardValidator = v.object({
    dataState: metricStateValidator,
    helperText: v.string(),
    id: v.string(),
    label: v.string(),
    statusLabel: v.string(),
    tone: v.union(v.literal("neutral"), v.literal("positive"), v.literal("warning")),
    trendLabel: v.string(),
    value: v.string(),
});

const institutionalOverviewStatusValidator = v.union(
    v.literal("approved"),
    v.literal("draft"),
    v.literal("not_started"),
    v.literal("rejected"),
    v.literal("submitted"),
);

const institutionalAnomalyTypeValidator = v.union(
    v.literal("budget_variance"),
    v.literal("duplicate_department_code"),
    v.literal("duplicate_department_name"),
    v.literal("invalid_budget_allocation"),
    v.literal("missing_du_coverage"),
    v.literal("over_budget"),
    v.literal("stale_submitted_plan"),
    v.literal("unresolved_po_assignment"),
);

const institutionalBudgetValidator = v.object({
    allocation: v.union(v.number(), v.null()),
    allocationLabel: v.string(),
    state: v.union(
        v.literal("available"),
        v.literal("invalid"),
        v.literal("unavailable"),
    ),
    used: v.union(v.number(), v.null()),
    usedLabel: v.string(),
    utilizationLabel: v.string(),
    utilizationPercent: v.union(v.number(), v.null()),
});

const institutionalCategorySummaryValidator = v.object({
    amount: v.number(),
    categoryId: v.string(),
    categoryName: v.string(),
    itemCount: v.number(),
});

const institutionalOverviewValidator = v.object({
    anomalies: v.array(
        v.object({
            departmentId: v.string(),
            departmentName: v.string(),
            description: v.string(),
            severity: v.union(
                v.literal("attention"),
                v.literal("critical"),
                v.literal("warning"),
            ),
            type: institutionalAnomalyTypeValidator,
        }),
    ),
    availableFiscalYears: v.array(v.string()),
    exportRequest: v.object({
        asOf: v.number(),
        state: v.union(v.literal("queued"), v.literal("export_ready")),
        summary: v.string(),
    }),
    fiscalYear: v.string(),
    generatedAt: v.number(),
    poRollups: v.array(
        v.object({
            attentionNeeded: v.number(),
            complete: v.number(),
            departmentCount: v.number(),
            id: v.string(),
            inProgress: v.number(),
            lastActivityAt: v.union(v.number(), v.null()),
            name: v.string(),
            notStarted: v.number(),
            status: v.union(
                v.literal("attention_needed"),
                v.literal("complete"),
                v.literal("in_progress"),
                v.literal("not_started"),
            ),
            statusLabel: v.union(
                v.literal("Attention Needed"),
                v.literal("Complete"),
                v.literal("In Progress"),
                v.literal("Not Started"),
            ),
        }),
    ),
    rows: v.array(
        v.object({
            anomalyCount: v.number(),
            budget: institutionalBudgetValidator,
            categorySummaries: v.array(institutionalCategorySummaryValidator),
            departmentCode: v.union(v.string(), v.null()),
            departmentId: v.string(),
            departmentName: v.string(),
            duContacts: v.array(
                v.object({
                    email: v.string(),
                    id: v.string(),
                    name: v.string(),
                    state: v.literal("active"),
                }),
            ),
            itemTotal: v.number(),
            lastActivityAt: v.union(v.number(), v.null()),
            planId: v.union(v.string(), v.null()),
            procurementOfficer: v.object({
                email: v.union(v.string(), v.null()),
                id: v.union(v.string(), v.null()),
                name: v.string(),
                state: v.union(
                    v.literal("active"),
                    v.literal("inactive"),
                    v.literal("unavailable"),
                ),
            }),
            status: institutionalOverviewStatusValidator,
            statusLabel: v.string(),
            timeline: v.array(
                v.object({
                    description: v.string(),
                    id: v.string(),
                    timestamp: v.union(v.number(), v.null()),
                    timestampLabel: v.string(),
                    title: v.string(),
                }),
            ),
        }),
    ),
    summary: v.object({
        anomalyCount: v.number(),
        approvedOrSubmitted: v.number(),
        approvedOrSubmittedLabel: v.string(),
        poCoverageLabel: v.string(),
        totalAllocated: v.number(),
        totalAllocatedLabel: v.string(),
        totalDepartments: v.number(),
        totalUtilizationLabel: v.string(),
        totalUtilizationPercent: v.union(v.number(), v.null()),
        totalUtilized: v.number(),
        totalUtilizedLabel: v.string(),
    }),
});

const dashboardSnapshotValidator = v.object({
    activityFeed: v.object({
        items: v.array(
            v.object({
                action: v.string(),
                actor: v.string(),
                entity: v.string(),
                id: v.string(),
                occurredAt: v.number(),
                occurredAtLabel: v.string(),
                outcome: v.string(),
            }),
        ),
        state: v.union(v.literal("available"), v.literal("empty")),
        totalReturned: v.number(),
    }),
    cycleState: v.object({
        countdown: v.object({
            label: v.string(),
            mode: v.union(
                v.literal("until_start"),
                v.literal("until_deadline"),
                v.literal("completed"),
                v.literal("unavailable"),
            ),
            targetAt: v.union(v.number(), v.null()),
        }),
        description: v.string(),
        reason: v.union(
            v.literal("inconsistent_windows"),
            v.literal("invalid_window"),
            v.literal("missing_windows"),
            v.literal("no_departments"),
            v.null(),
        ),
        safeWindow: v.union(
            v.object({
                endAt: v.number(),
                startAt: v.number(),
            }),
            v.null(),
        ),
        state: cycleStateValidator,
        timeline: v.array(
            v.object({
                description: v.string(),
                id: v.string(),
                label: v.string(),
                status: timelineStepStatusValidator,
            }),
        ),
        title: v.string(),
    }),
    departmentStatus: v.array(
        v.object({
            detail: v.string(),
            id: v.string(),
            name: v.string(),
            progressTone: v.union(
                v.literal("neutral"),
                v.literal("positive"),
                v.literal("warning"),
            ),
            progressValue: v.number(),
            statusLabel: v.string(),
        }),
    ),
    directory: v.object({
        currentTenantAdmin: v.union(
            v.object({
                email: v.string(),
                initials: v.string(),
                name: v.string(),
            }),
            v.null(),
        ),
        departmentUsers: v.array(
            v.object({
                departmentName: v.string(),
                email: v.string(),
                id: v.string(),
                initials: v.string(),
                lastSeenAt: v.union(v.number(), v.null()),
                lastSeenLabel: v.string(),
                name: v.string(),
                statusLabel: v.string(),
            }),
        ),
        procurementOfficerDirectory: v.array(
            v.object({
                activationCodeSuffix: v.optional(v.string()),
                departmentsManaged: v.number(),
                email: v.string(),
                id: v.string(),
                invitationId: v.optional(v.string()),
                initials: v.string(),
                issuedAt: v.union(v.number(), v.null()),
                issuedAtLabel: v.string(),
                lastSeenAt: v.union(v.number(), v.null()),
                lastSeenLabel: v.string(),
                name: v.string(),
                source: v.union(
                    v.literal("active_member"),
                    v.literal("invitation"),
                ),
                status: v.union(
                    v.literal("accepted"),
                    v.literal("active"),
                    v.literal("bounced"),
                    v.literal("expired"),
                    v.literal("inactive"),
                    v.literal("pending"),
                ),
                statusLabel: v.string(),
            }),
        ),
        procurementOfficers: v.array(
            v.object({
                departmentsManaged: v.number(),
                email: v.string(),
                id: v.string(),
                initials: v.string(),
                lastSeenAt: v.union(v.number(), v.null()),
                lastSeenLabel: v.string(),
                name: v.string(),
                statusLabel: v.string(),
            }),
        ),
    }),
    meta: v.object({
        availableFiscalYears: v.array(v.string()),
        currentFiscalYear: v.string(),
        emptyPeriodReason: v.union(v.string(), v.null()),
        hasDataForSelectedFiscalYear: v.boolean(),
        isSelectedCurrentFiscalYear: v.boolean(),
        lastUpdatedAt: v.number(),
        selectedFiscalYear: v.string(),
        snapshotGeneratedAt: v.number(),
        sourceState: v.union(v.literal("cached"), v.literal("live")),
        tenantId: v.string(),
        tenantName: v.string(),
        tenantStatus: tenantStatusValidator,
        tenantTier: tenantTierValidator,
    }),
    onboardingChecklist: v.array(
        v.object({
            availability: availabilityValidator,
            description: v.string(),
            href: v.string(),
            id: v.union(
                v.literal("add_po"),
                v.literal("configure_settings"),
                v.literal("review_billing"),
            ),
            isPriority: v.boolean(),
            label: v.string(),
            status: onboardingStatusValidator,
        }),
    ),
    institutionalOverview: institutionalOverviewValidator,
    quickActions: v.array(
        v.object({
            description: v.string(),
            highlighted: v.boolean(),
            href: v.string(),
            id: v.union(
                v.literal("add_po"),
                v.literal("view_reports"),
                v.literal("settings"),
            ),
            label: v.string(),
            status: quickActionStatusValidator,
        }),
    ),
    summaryCards: v.object({
        budgetUtilization: summaryCardValidator,
        departments: summaryCardValidator,
        submissionProgress: summaryCardValidator,
        totalPOs: summaryCardValidator,
    }),
    userSummary: v.object({
        activeTotal: v.number(),
        departmentUsers: v.number(),
        procurementOfficers: v.number(),
        tenantAdmins: v.number(),
    }),
});

export const getTenantAdminDashboardSnapshot = query({
    args: {
        selectedFiscalYear: v.optional(v.string()),
    },
    returns: dashboardSnapshotValidator,
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["tenant_admin"]);
        const tenant = await ctx.db.get(authContext.tenantId);

        if (!tenant) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }

        const now = Date.now();
        const currentFiscalYear = getFiscalYearForDate(now).key;
        const selectedFiscalYear =
            args.selectedFiscalYear && args.selectedFiscalYear <= currentFiscalYear
                ? args.selectedFiscalYear
                : currentFiscalYear;
        const [tenantUsers, departments, departmentUserProfiles, poInvitations, targetActivity, sourceActivity, submissionDeadlines] =
            await Promise.all([
                ctx.db
                    .query("tenantUsers")
                    .withIndex("by_tenantId", (q) =>
                        q.eq("tenantId", authContext.tenantId),
                    )
                    .collect(),
                ctx.db
                    .query("departments")
                    .withIndex("by_tenantId_isActive", (q) =>
                        q.eq("tenantId", authContext.tenantId).eq("isActive", true),
                    )
                    .collect(),
                ctx.db
                    .query("departmentUserProfiles")
                    .withIndex("by_tenantId", (q) =>
                        q.eq("tenantId", authContext.tenantId),
                    )
                    .collect(),
                ctx.db
                    .query("poInvitations")
                    .withIndex("by_tenantId", (q) =>
                        q.eq("tenantId", authContext.tenantId),
                    )
                    .collect(),
                ctx.db
                    .query("auditLogs")
                    .withIndex("by_targetTenantId", (q) =>
                        q.eq("targetTenantId", authContext.tenantId),
                    )
                    .order("desc")
                    .take(20),
                ctx.db
                    .query("auditLogs")
                    .withIndex("by_sourceTenantId", (q) =>
                        q.eq("sourceTenantId", authContext.tenantId),
                    )
                    .order("desc")
                    .take(20),
                ctx.db
                    .query("submissionDeadlines")
                    .withIndex("by_tenantId", (q) =>
                        q.eq("tenantId", authContext.tenantId),
                    )
                    .collect(),
            ]);

        const departmentProcurementData = await Promise.all(
            departments.map(async (department) => {
                const [departmentPlans, departmentSnapshots, departmentDecisions, departmentRedrafts] =
                    await Promise.all([
                        ctx.db
                            .query("plans")
                            .withIndex("by_departmentId", (q) =>
                                q.eq("departmentId", department._id),
                            )
                            .collect(),
                        ctx.db
                            .query("planSubmissionSnapshots")
                            .withIndex(
                                "by_tenantId_departmentId_fiscalYear_capturedAt",
                                (q) =>
                                    q
                                        .eq("tenantId", authContext.tenantId)
                                        .eq("departmentId", department._id)
                                        .eq("fiscalYear", selectedFiscalYear),
                            )
                            .collect(),
                        ctx.db
                            .query("planReviewDecisions")
                            .withIndex(
                                "by_tenantId_departmentId_fiscalYear_decidedAt",
                                (q) =>
                                    q
                                        .eq("tenantId", authContext.tenantId)
                                        .eq("departmentId", department._id)
                                        .eq("fiscalYear", selectedFiscalYear),
                            )
                            .collect(),
                        ctx.db
                            .query("planRedraftRequests")
                            .withIndex(
                                "by_tenantId_departmentId_fiscalYear",
                                (q) =>
                                    q
                                        .eq("tenantId", authContext.tenantId)
                                        .eq("departmentId", department._id)
                                        .eq("fiscalYear", selectedFiscalYear),
                            )
                            .collect(),
                    ]);

                return {
                    decisions: departmentDecisions,
                    plans: departmentPlans,
                    redrafts: departmentRedrafts,
                    snapshots: departmentSnapshots,
                };
            }),
        );
        const plans = departmentProcurementData.flatMap((entry) => entry.plans);
        const planSubmissionSnapshots = departmentProcurementData.flatMap(
            (entry) => entry.snapshots,
        );
        const planReviewDecisions = departmentProcurementData.flatMap(
            (entry) => entry.decisions,
        );
        const planRedraftRequests = departmentProcurementData.flatMap(
            (entry) => entry.redrafts,
        );
        const fiscalYearKeys = Array.from(
            new Set([
                ...plans.map((plan) => plan.fiscalYear),
                ...planSubmissionSnapshots.map((snapshot) => snapshot.fiscalYear),
                ...planReviewDecisions.map((decision) => decision.fiscalYear),
                ...planRedraftRequests.map((request) => request.fiscalYear),
                ...submissionDeadlines.map((deadline) => deadline.fiscalYearKey),
            ]),
        );

        const mergedActivity = [...targetActivity, ...sourceActivity]
            .sort((left, right) => right.timestamp - left.timestamp)
            .filter(
                (activity, index, collection) =>
                    collection.findIndex(
                        (candidate) => candidate._id === activity._id,
                    ) === index,
            )
            .slice(0, 20);

        const userIds = Array.from(
            new Set(
                tenantUsers
                    .map((tenantUser) => tenantUser.userId)
                    .concat(authContext.userId),
            ),
        );
        const userDocuments = await Promise.all(
            userIds.map(async (userId) => [String(userId), await ctx.db.get(userId)] as const),
        );
        const userDocumentMap = new Map(userDocuments);
        const departmentsById = new Map(
            departments.map((department) => [String(department._id), department]),
        );

        const lastSeenByUserId = new Map<string, number>();
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
            const tenantUser = tenantUsers.find(
                (candidate) => candidate._id === profile.tenantUserId,
            );
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
                    departmentsManaged: departments.filter(
                        (department) =>
                            department.procurementOfficerTenantUserId === tenantUser._id &&
                            department.isActive,
                    ).length,
                    email: summary.email,
                    id: String(tenantUser._id),
                    initials: summary.initials,
                    lastSeenAt,
                    lastSeenLabel: formatLastSeenLabel(lastSeenAt),
                    name: summary.name,
                    statusLabel: tenantUser.isActive ? "Active" : "Inactive",
                };
            });
        const activeProcurementOfficerEmailSet = new Set(
            procurementOfficers.map((member) => member.email.toLowerCase()),
        );
        const invitationDirectory: TenantAdminProcurementOfficerDirectoryEntry[] = poInvitations
            .map((invitation) => {
                const effectiveStatus = evaluateProcurementOfficerInvitationStatus({
                    expiresAt: invitation.expiresAt,
                    now: Date.now(),
                    status: invitation.status,
                });

                if (
                    effectiveStatus === "accepted" &&
                    activeProcurementOfficerEmailSet.has(invitation.email.toLowerCase())
                ) {
                    return null;
                }

                if (
                    effectiveStatus !== "accepted" &&
                    activeProcurementOfficerEmailSet.has(invitation.email.toLowerCase())
                ) {
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
                    source: "invitation" as const,
                    status:
                        effectiveStatus === "accepted"
                            ? ("accepted" as const)
                            : effectiveStatus === "bounced"
                              ? ("bounced" as const)
                              : effectiveStatus === "expired"
                                ? ("expired" as const)
                                : ("pending" as const),
                    statusLabel: formatProcurementOfficerInvitationStatusLabel(
                        effectiveStatus,
                    ),
                };
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
        const memberDirectory: TenantAdminProcurementOfficerDirectoryEntry[] = procurementOfficers
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
                source: "active_member" as const,
                status:
                    member.statusLabel === "Inactive"
                        ? ("inactive" as const)
                        : ("active" as const),
                statusLabel: member.statusLabel,
            }));
        const procurementOfficerDirectory: TenantAdminProcurementOfficerDirectoryEntry[] = [
            ...memberDirectory,
            ...invitationDirectory,
        ]
            .sort((left, right) => left.name.localeCompare(right.name));

        const departmentUsersDirectory = departmentUserProfiles
            .map((profile) => {
                const tenantUser = tenantUsers.find(
                    (candidate) => candidate._id === profile.tenantUserId,
                );
                if (!tenantUser) {
                    return null;
                }

                const authUser = userDocumentMap.get(String(tenantUser.userId));
                const summary = readAuthUserSummary(authUser, "Department User");
                const lastSeenAt =
                    profile.lastAuthenticatedAt ??
                    lastSeenByUserId.get(String(tenantUser.userId)) ??
                    null;

                return {
                    departmentName:
                        departmentsById.get(String(profile.departmentId))?.name ??
                        "Unassigned department",
                    email: summary.email,
                    id: String(profile.tenantUserId),
                    initials: summary.initials,
                    lastSeenAt,
                    lastSeenLabel: formatLastSeenLabel(lastSeenAt),
                    name: summary.name,
                    statusLabel:
                        profile.isActive && tenantUser.isActive ? "Active" : "Inactive",
                };
            })
            .filter((profile): profile is NonNullable<typeof profile> => profile !== null)
            .sort((left, right) => left.name.localeCompare(right.name));

        const currentAdminSummary = readAuthUserSummary(
            userDocumentMap.get(String(authContext.userId)),
            "Tenant Admin",
        );

        const baseSnapshot = buildTenantAdminDashboardSnapshot({
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
        const institutionalOverview = buildTenantAdminInstitutionalOverview({
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
                categorySummaries: plan.categorySummaries.map((summary: {
                    amount: number;
                    categoryId: unknown;
                    categoryName: string;
                    itemCount: number;
                }) => ({
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

function readAuthUserSummary(
    userDocument: unknown,
    fallbackName: string,
): { email: string; initials: string; name: string } {
    const record =
        userDocument && typeof userDocument === "object" && !Array.isArray(userDocument)
            ? (userDocument as Record<string, unknown>)
            : {};
    const email =
        typeof record.email === "string" && record.email.trim().length > 0
            ? record.email.trim()
            : "No email available";
    const name =
        typeof record.name === "string" && record.name.trim().length > 0
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

function formatLastSeenLabel(lastSeenAt: number | null): string {
    return lastSeenAt ? new Date(lastSeenAt).toLocaleString("en-GB") : "No activity recorded";
}

function formatIssuedLabel(timestamp: number | null): string {
    return timestamp ? new Date(timestamp).toLocaleString("en-GB") : "Not issued";
}

function readNameInitials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase();
}
