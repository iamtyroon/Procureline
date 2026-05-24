import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
    buildPlatformAdminTenantListSnapshot,
    normalizePlatformAdminTenantListFilters,
    PLATFORM_ADMIN_TENANT_LIST_PAGE_SIZE,
    type PlatformAdminAttentionFilter,
    type PlatformAdminProfileCompletionFilter,
    type PlatformAdminTenantStatus,
    type PlatformAdminTenantTier,
} from "../../lib/shared/platform-admin/tenant-list";
import {
    createPlatformAdminDashboardReadAccessToken,
    verifyPlatformAdminDashboardReadAccessToken,
} from "../../lib/backend/platform-admin/dashboard-access-token";
import { requirePlatformAdmin } from "./_roleGuard";
import { auditPlatformAdminBypassRead } from "./_tenantGuard";

const tenantTierFilterValidator = v.union(
    v.literal("all"),
    v.literal("enterprise"),
    v.literal("free"),
    v.literal("professional"),
    v.literal("starter"),
    v.literal("unknown"),
);

const tenantStatusFilterValidator = v.union(
    v.literal("all"),
    v.literal("active"),
    v.literal("cancelled"),
    v.literal("suspended"),
    v.literal("unknown"),
);

const profileFilterValidator = v.union(
    v.literal("all"),
    v.literal("complete"),
    v.literal("incomplete"),
);

const attentionFilterValidator = v.union(
    v.literal("all"),
    v.literal("attention"),
    v.literal("clear"),
);

export const getPlatformAdminTenantListSnapshot = query({
    args: {
        accessToken: v.string(),
        attention: v.optional(attentionFilterValidator),
        page: v.optional(v.number()),
        profile: v.optional(profileFilterValidator),
        search: v.optional(v.string()),
        status: v.optional(tenantStatusFilterValidator),
        tier: v.optional(tenantTierFilterValidator),
    },
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const accessResult = await verifyPlatformAdminDashboardReadAccessToken({
            scope: "tenant_list",
            token: args.accessToken,
            userId: String(authContext.userId),
        });

        if (!accessResult.ok) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message:
                    accessResult.reason === "expired"
                        ? "Platform admin tenant-list access expired. Retry to re-establish the audited read session."
                        : "Platform admin tenant-list access could not be verified.",
            });
        }

        const [
            tenants,
            tenantUsers,
            departments,
            subscriptionTiers,
            latestHealthSnapshot,
        ] = await Promise.all([
            ctx.db.query("tenants").collect(),
            ctx.db.query("tenantUsers").collect(),
            ctx.db.query("departments").collect(),
            ctx.db.query("subscriptionTiers").collect(),
            ctx.db
                .query("platformHealthSnapshots")
                .withIndex("by_capturedAt", (q) => q)
                .order("desc")
                .first(),
        ]);

        return buildPlatformAdminTenantListSnapshot({
            departments: departments.map((department) => ({
                isActive: department.isActive,
                tenantId: String(department.tenantId),
            })),
            filters: normalizePlatformAdminTenantListFilters({
                attention: args.attention as PlatformAdminAttentionFilter | undefined,
                profile: args.profile as PlatformAdminProfileCompletionFilter | undefined,
                search: args.search,
                status: args.status as
                    | "all"
                    | PlatformAdminTenantStatus
                    | undefined,
                tier: args.tier as "all" | PlatformAdminTenantTier | undefined,
            }),
            healthSnapshot: latestHealthSnapshot
                ? {
                    capturedAt: latestHealthSnapshot.capturedAt,
                    summaryState: latestHealthSnapshot.summaryState,
                }
                : null,
            now: Date.now(),
            page: args.page ?? 1,
            pageSize: PLATFORM_ADMIN_TENANT_LIST_PAGE_SIZE,
            subscriptionTiers: subscriptionTiers.map((tier) => ({
                isActive: tier.isActive,
                slug: tier.slug,
            })),
            tenantUsers: tenantUsers.map((tenantUser) => ({
                isActive: tenantUser.isActive,
                tenantId: String(tenantUser.tenantId),
            })),
            tenants: tenants.map((tenant) => ({
                createdAt: tenant.createdAt,
                id: String(tenant._id),
                name: tenant.name,
                onboardingCompletedAt: tenant.onboardingCompletedAt ?? null,
                primaryContactEmail: tenant.primaryContactEmail ?? null,
                primaryContactName: tenant.primaryContactName ?? null,
                profileComplete: tenant.profileComplete,
                status: tenant.status,
                subdomain: tenant.subdomain,
                tier: tenant.tier,
            })),
        });
    },
});

export const issuePlatformAdminTenantListReadAccess = mutation({
    args: {},
    handler: async (ctx) => {
        const authContext = await requirePlatformAdmin(ctx);

        await Promise.all([
            auditPlatformAdminBypassRead(ctx, {
                action: "tenant_list_snapshot_read",
                entityType: "tenant",
                tableName: "tenants",
            }),
            auditPlatformAdminBypassRead(ctx, {
                action: "tenant_list_snapshot_read",
                entityType: "tenantUser",
                tableName: "tenantUsers",
            }),
            auditPlatformAdminBypassRead(ctx, {
                action: "tenant_list_snapshot_read",
                entityType: "department",
                tableName: "departments",
            }),
        ]);

        return await createPlatformAdminDashboardReadAccessToken({
            scope: "tenant_list",
            userId: String(authContext.userId),
        });
    },
});
