import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { buildPlatformAdminDashboardSnapshot } from "../../lib/shared/platform-admin/dashboard-snapshot";
import { normalizePlatformAdminDashboardPreferences } from "../../lib/shared/platform-admin/dashboard";
import {
    createPlatformAdminDashboardReadAccessToken,
    verifyPlatformAdminDashboardReadAccessToken,
} from "../../lib/shared/platform-admin/dashboard-access-token";
import { requirePlatformAdmin } from "./_roleGuard";
import { auditPlatformAdminBypassRead } from "./_tenantGuard";

const widgetIdValidator = v.union(
    v.literal("recent_tenants"),
    v.literal("system_health"),
    v.literal("recent_alerts"),
);

const alertSeverityFilterValidator = v.union(
    v.literal("all"),
    v.literal("warning"),
    v.literal("critical"),
);

export const getPlatformAdminDashboardSnapshot = query({
    args: {
        accessToken: v.string(),
    },
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const accessResult =
            await verifyPlatformAdminDashboardReadAccessToken({
                token: args.accessToken,
                userId: String(authContext.userId),
            });

        if (!accessResult.ok) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message:
                    accessResult.reason === "expired"
                        ? "Platform admin dashboard access expired. Refresh the page and try again."
                        : "Platform admin dashboard access could not be verified.",
            });
        }

        const [
            currentUserDocument,
            tenants,
            tenantUsers,
            departments,
            subscriptionTiers,
            latestHealthSnapshot,
            savedPreferences,
            latestAuditLogs,
            latestIsolationEvents,
            failedSyncEvents,
            claimedSyncEvents,
        ] = await Promise.all([
            ctx.db.get(authContext.userId),
            ctx.db.query("tenants").collect(),
            ctx.db.query("tenantUsers").collect(),
            ctx.db.query("departments").collect(),
            ctx.db.query("subscriptionTiers").collect(),
            ctx.db
                .query("platformHealthSnapshots")
                .withIndex("by_capturedAt", (q) => q)
                .order("desc")
                .first(),
            ctx.db
                .query("platformAdminPreferences")
                .withIndex("by_userId", (q) => q.eq("userId", authContext.userId))
                .first(),
            ctx.db
                .query("auditLogs")
                .withIndex("by_timestamp", (q) => q)
                .order("desc")
                .take(40),
            ctx.db
                .query("tenantIsolationEvents")
                .withIndex("by_timestamp", (q) => q)
                .order("desc")
                .take(20),
            ctx.db
                .query("externalServiceSyncEvents")
                .withIndex("by_status", (q) => q.eq("status", "failed"))
                .order("desc")
                .take(15),
            ctx.db
                .query("externalServiceSyncEvents")
                .withIndex("by_status", (q) => q.eq("status", "claimed"))
                .order("desc")
                .take(10),
        ]);

        return buildPlatformAdminDashboardSnapshot({
            auditLogs: latestAuditLogs.map((auditLog) => ({
                action: auditLog.action,
                entityType: auditLog.entityType,
                event: auditLog.event,
                id: String(auditLog._id),
                metadata: auditLog.metadata,
                outcome: auditLog.outcome,
                sourceTenantId: auditLog.sourceTenantId
                    ? String(auditLog.sourceTenantId)
                    : undefined,
                targetTenantId: auditLog.targetTenantId
                    ? String(auditLog.targetTenantId)
                    : undefined,
                timestamp: auditLog.timestamp,
            })),
            currentAdmin: readCurrentPlatformAdminProfile(currentUserDocument),
            departments: departments.map((department) => ({
                id: String(department._id),
                isActive: department.isActive,
                tenantId: String(department.tenantId),
            })),
            externalSyncEvents: [...failedSyncEvents, ...claimedSyncEvents].map((event) => ({
                eventKey: event.eventKey,
                eventType: event.eventType,
                id: String(event._id),
                lastError: event.lastError ?? null,
                metadata: event.metadata,
                provider: event.provider,
                status: event.status,
                updatedAt: event.updatedAt,
            })),
            healthSnapshot: latestHealthSnapshot
                ? {
                    api: latestHealthSnapshot.api,
                    capturedAt: latestHealthSnapshot.capturedAt,
                    database: latestHealthSnapshot.database,
                    email: latestHealthSnapshot.email,
                    jobs: latestHealthSnapshot.jobs,
                    storage: latestHealthSnapshot.storage,
                    summaryState: latestHealthSnapshot.summaryState,
                }
                : null,
            isolationEvents: latestIsolationEvents.map((event) => ({
                event: event.event,
                id: String(event._id),
                outcome: event.outcome,
                recordId: event.recordId,
                tableName: event.tableName,
                targetTenantId: event.targetTenantId
                    ? String(event.targetTenantId)
                    : undefined,
                timestamp: event.timestamp,
            })),
            now: Date.now(),
            preferences: savedPreferences,
            subscriptionTiers: subscriptionTiers.map((tier) => ({
                billingCycle: tier.billingCycle,
                isActive: tier.isActive,
                priceUSD: tier.priceUSD,
                slug: tier.slug,
            })),
            tenantUsers: tenantUsers.map((tenantUser) => ({
                id: String(tenantUser._id),
                isActive: tenantUser.isActive,
                role: tenantUser.role,
                tenantId: String(tenantUser.tenantId),
            })),
            tenants: tenants.map((tenant) => ({
                createdAt: tenant.createdAt,
                id: String(tenant._id),
                name: tenant.name,
                status: tenant.status,
                subdomain: tenant.subdomain,
                tier: tenant.tier,
            })),
        });
    },
});

export const issuePlatformAdminDashboardReadAccess = mutation({
    args: {},
    handler: async (ctx) => {
        const authContext = await requirePlatformAdmin(ctx);

        await Promise.all([
            auditPlatformAdminBypassRead(ctx, {
                action: "dashboard_snapshot_read",
                entityType: "tenant",
                tableName: "tenants",
            }),
            auditPlatformAdminBypassRead(ctx, {
                action: "dashboard_snapshot_read",
                entityType: "tenantUser",
                tableName: "tenantUsers",
            }),
            auditPlatformAdminBypassRead(ctx, {
                action: "dashboard_snapshot_read",
                entityType: "department",
                tableName: "departments",
            }),
        ]);

        return await createPlatformAdminDashboardReadAccessToken({
            userId: String(authContext.userId),
        });
    },
});

export const saveCurrentPlatformAdminDashboardPreferences = mutation({
    args: {
        alertSeverityFilter: v.optional(alertSeverityFilterValidator),
        hiddenWidgetIds: v.optional(v.array(widgetIdValidator)),
        sidebarCollapsed: v.optional(v.boolean()),
        widgetOrder: v.optional(v.array(widgetIdValidator)),
    },
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const existingPreferences = await ctx.db
            .query("platformAdminPreferences")
            .withIndex("by_userId", (q) => q.eq("userId", authContext.userId))
            .first();

        const normalizedPreferences = normalizePlatformAdminDashboardPreferences({
            alertSeverityFilter:
                args.alertSeverityFilter ?? existingPreferences?.alertSeverityFilter,
            hiddenWidgetIds:
                args.hiddenWidgetIds ?? existingPreferences?.hiddenWidgetIds,
            sidebarCollapsed:
                args.sidebarCollapsed ?? existingPreferences?.sidebarCollapsed,
            widgetOrder: args.widgetOrder ?? existingPreferences?.widgetOrder,
        });
        const updatedAt = Date.now();

        if (!existingPreferences) {
            await ctx.db.insert("platformAdminPreferences", {
                ...normalizedPreferences,
                updatedAt,
                userId: authContext.userId,
            });

            return normalizedPreferences;
        }

        await ctx.db.patch(existingPreferences._id, {
            ...normalizedPreferences,
            updatedAt,
        });

        return normalizedPreferences;
    },
});

function readCurrentPlatformAdminProfile(userDocument: unknown): {
    email: string;
    initials: string;
    name: string;
} {
    const record =
        userDocument && typeof userDocument === "object" && !Array.isArray(userDocument)
            ? (userDocument as Record<string, unknown>)
            : {};
    const email =
        typeof record.email === "string" && record.email.trim().length > 0
            ? record.email.trim()
            : "Unavailable";
    const name =
        typeof record.name === "string" && record.name.trim().length > 0
            ? record.name.trim()
            : email.includes("@")
              ? (email.split("@")[0] || "Platform account")
              : "Platform account";

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
