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
});
