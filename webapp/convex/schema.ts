import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
    ...authTables,

    tenants: defineTable({
        name: v.string(),
        subdomain: v.string(),
        tier: v.union(
            v.literal("free"),
            v.literal("starter"),
            v.literal("professional"),
            v.literal("enterprise"),
        ),
        status: v.union(
            v.literal("active"),
            v.literal("suspended"),
            v.literal("cancelled"),
        ),
        createdAt: v.number(),
    })
        .index("by_subdomain", ["subdomain"])
        .index("by_status", ["status"]),

    tenantUsers: defineTable({
        userId: v.id("users"),
        tenantId: v.id("tenants"),
        role: v.union(
            v.literal("tenant_admin"),
            v.literal("procurement_officer"),
            v.literal("department_user"),
        ),
        isActive: v.boolean(),
    })
        .index("by_userId", ["userId"])
        .index("by_tenantId", ["tenantId"])
        .index("by_userId_tenantId", ["userId", "tenantId"]),

    platformUsers: defineTable({
        userId: v.id("users"),
        isActive: v.boolean(),
        createdAt: v.number(),
    })
        .index("by_userId", ["userId"])
        .index("by_userId_isActive", ["userId", "isActive"]),

    sessionMetadata: defineTable({
        sessionId: v.id("authSessions"),
        userId: v.id("users"),
        rememberMe: v.boolean(),
        lastActivityAt: v.number(),
        createdAt: v.number(),
        revokedAt: v.optional(v.number()),
        loggedOutAt: v.optional(v.number()),
    })
        .index("by_sessionId", ["sessionId"])
        .index("by_userId", ["userId"])
        .index("by_userId_sessionId", ["userId", "sessionId"]),

    subscriptionTiers: defineTable({
        tierName: v.string(),
        slug: v.string(),
        priceUSD: v.number(),
        billingCycle: v.string(),
        description: v.string(),
        features: v.array(v.string()),
        limits: v.object({
            departments: v.union(v.number(), v.string()),
            categories: v.union(v.number(), v.string()),
            itemsPerCategory: v.union(v.number(), v.string()),
            users: v.union(v.number(), v.string()),
            storage: v.string(),
            apiAccess: v.boolean(),
            ssoLdap: v.boolean(),
        }),
        isPopular: v.boolean(),
        displayOrder: v.number(),
        isActive: v.boolean(),
    })
        .index("by_slug", ["slug"])
        .index("by_display_order", ["displayOrder", "isActive"]),

    salesInquiries: defineTable({
        contactName: v.string(),
        email: v.string(),
        message: v.string(),
        organizationName: v.string(),
        organizationNameKey: v.optional(v.string()),
        requestedTier: v.literal("enterprise"),
        source: v.literal("pricing_page"),
        status: v.union(
            v.literal("new"),
            v.literal("contacted"),
            v.literal("closed"),
        ),
        createdAt: v.number(),
    })
        .index("by_email", ["email", "createdAt"])
        .index("by_organizationNameKey", ["organizationNameKey", "createdAt"])
        .index("by_status", ["status", "createdAt"]),

    tenantIsolationEvents: defineTable({
        action: v.string(),
        actorRole: v.union(
            v.literal("platform_admin"),
            v.literal("tenant_admin"),
            v.literal("procurement_officer"),
            v.literal("department_user"),
        ),
        actorUserId: v.id("users"),
        entityType: v.string(),
        event: v.union(
            v.literal("tenant.probe_blocked"),
            v.literal("tenant.platform_read_allowed"),
        ),
        outcome: v.union(
            v.literal("allowed_platform_bypass"),
            v.literal("blocked_missing_metadata"),
            v.literal("blocked_not_found"),
        ),
        recordId: v.optional(v.string()),
        sourceTenantId: v.optional(v.id("tenants")),
        tableName: v.string(),
        targetTenantId: v.optional(v.id("tenants")),
        timestamp: v.number(),
    })
        .index("by_actorUserId", ["actorUserId", "timestamp"])
        .index("by_event", ["event", "timestamp"])
        .index("by_targetTenantId", ["targetTenantId", "timestamp"])
        .index("by_timestamp", ["timestamp"]),

    auditLogs: defineTable({
        action: v.string(),
        actorRole: v.union(
            v.literal("anonymous"),
            v.literal("platform_admin"),
            v.literal("tenant_admin"),
            v.literal("procurement_officer"),
            v.literal("department_user"),
            v.literal("unassigned"),
        ),
        actorState: v.union(
            v.literal("anonymous"),
            v.literal("authenticated"),
        ),
        actorUserId: v.optional(v.id("users")),
        entityType: v.string(),
        event: v.string(),
        metadata: v.any(),
        outcome: v.string(),
        recordId: v.optional(v.string()),
        sourceTenantId: v.optional(v.id("tenants")),
        tableName: v.optional(v.string()),
        targetTenantId: v.optional(v.id("tenants")),
        timestamp: v.number(),
    })
        .index("by_actorUserId", ["actorUserId", "timestamp"])
        .index("by_event", ["event", "timestamp"])
        .index("by_timestamp", ["timestamp"]),

    externalServiceSyncEvents: defineTable({
        actorRole: v.optional(v.string()),
        actorTenantId: v.optional(v.id("tenants")),
        actorUserId: v.optional(v.id("users")),
        claimedAt: v.number(),
        durableChanges: v.array(v.any()),
        eventKey: v.string(),
        eventType: v.string(),
        lastError: v.optional(v.object({
            code: v.string(),
            message: v.string(),
        })),
        metadata: v.any(),
        payloadHash: v.string(),
        processedAt: v.optional(v.number()),
        provider: v.string(),
        result: v.optional(v.any()),
        status: v.union(
            v.literal("claimed"),
            v.literal("completed"),
            v.literal("failed"),
        ),
        updatedAt: v.number(),
    })
        .index("by_eventKey", ["eventKey"])
        .index("by_provider_status", ["provider", "status", "updatedAt"])
        .index("by_status", ["status", "updatedAt"]),
});
