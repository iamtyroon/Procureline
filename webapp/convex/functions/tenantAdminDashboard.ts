import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { requireTenantRole } from "./_roleGuard";
import { buildTenantAdminDashboardSnapshot } from "../../lib/tenant-admin/dashboard-snapshot";

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

        const [tenantUsers, departments, departmentUserProfiles, targetActivity, sourceActivity] =
            await Promise.all([
                ctx.db
                    .query("tenantUsers")
                    .withIndex("by_tenantId", (q) =>
                        q.eq("tenantId", authContext.tenantId),
                    )
                    .collect(),
                ctx.db
                    .query("departments")
                    .withIndex("by_tenantId", (q) =>
                        q.eq("tenantId", authContext.tenantId),
                    )
                    .collect(),
                ctx.db
                    .query("departmentUserProfiles")
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
            ]);

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
                procurementOfficers,
            },
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
