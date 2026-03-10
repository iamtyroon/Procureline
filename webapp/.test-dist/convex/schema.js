"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("convex/server");
const values_1 = require("convex/values");
const server_2 = require("@convex-dev/auth/server");
exports.default = (0, server_1.defineSchema)({
    ...server_2.authTables,
    tenants: (0, server_1.defineTable)({
        name: values_1.v.string(),
        subdomain: values_1.v.string(),
        tier: values_1.v.union(values_1.v.literal("free"), values_1.v.literal("starter"), values_1.v.literal("professional"), values_1.v.literal("enterprise")),
        status: values_1.v.union(values_1.v.literal("active"), values_1.v.literal("suspended"), values_1.v.literal("cancelled")),
        createdAt: values_1.v.number(),
    })
        .index("by_subdomain", ["subdomain"])
        .index("by_status", ["status"]),
    tenantUsers: (0, server_1.defineTable)({
        userId: values_1.v.id("users"),
        tenantId: values_1.v.id("tenants"),
        role: values_1.v.union(values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user")),
        isActive: values_1.v.boolean(),
    })
        .index("by_userId", ["userId"])
        .index("by_tenantId", ["tenantId"])
        .index("by_userId_tenantId", ["userId", "tenantId"]),
    platformUsers: (0, server_1.defineTable)({
        userId: values_1.v.id("users"),
        isActive: values_1.v.boolean(),
        createdAt: values_1.v.number(),
    })
        .index("by_userId", ["userId"])
        .index("by_userId_isActive", ["userId", "isActive"]),
    sessionMetadata: (0, server_1.defineTable)({
        sessionId: values_1.v.id("authSessions"),
        userId: values_1.v.id("users"),
        rememberMe: values_1.v.boolean(),
        lastActivityAt: values_1.v.number(),
        createdAt: values_1.v.number(),
        revokedAt: values_1.v.optional(values_1.v.number()),
        loggedOutAt: values_1.v.optional(values_1.v.number()),
    })
        .index("by_sessionId", ["sessionId"])
        .index("by_userId", ["userId"])
        .index("by_userId_sessionId", ["userId", "sessionId"]),
    subscriptionTiers: (0, server_1.defineTable)({
        tierName: values_1.v.string(),
        slug: values_1.v.string(),
        priceUSD: values_1.v.number(),
        billingCycle: values_1.v.string(),
        description: values_1.v.string(),
        features: values_1.v.array(values_1.v.string()),
        limits: values_1.v.object({
            departments: values_1.v.union(values_1.v.number(), values_1.v.string()),
            categories: values_1.v.union(values_1.v.number(), values_1.v.string()),
            itemsPerCategory: values_1.v.union(values_1.v.number(), values_1.v.string()),
            users: values_1.v.union(values_1.v.number(), values_1.v.string()),
            storage: values_1.v.string(),
            apiAccess: values_1.v.boolean(),
            ssoLdap: values_1.v.boolean(),
        }),
        isPopular: values_1.v.boolean(),
        displayOrder: values_1.v.number(),
        isActive: values_1.v.boolean(),
    })
        .index("by_slug", ["slug"])
        .index("by_display_order", ["displayOrder", "isActive"]),
    salesInquiries: (0, server_1.defineTable)({
        contactName: values_1.v.string(),
        email: values_1.v.string(),
        message: values_1.v.string(),
        organizationName: values_1.v.string(),
        organizationNameKey: values_1.v.optional(values_1.v.string()),
        requestedTier: values_1.v.literal("enterprise"),
        source: values_1.v.literal("pricing_page"),
        status: values_1.v.union(values_1.v.literal("new"), values_1.v.literal("contacted"), values_1.v.literal("closed")),
        createdAt: values_1.v.number(),
    })
        .index("by_email", ["email", "createdAt"])
        .index("by_organizationNameKey", ["organizationNameKey", "createdAt"])
        .index("by_status", ["status", "createdAt"]),
    tenantIsolationEvents: (0, server_1.defineTable)({
        action: values_1.v.string(),
        actorRole: values_1.v.union(values_1.v.literal("platform_admin"), values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user")),
        actorUserId: values_1.v.id("users"),
        entityType: values_1.v.string(),
        event: values_1.v.union(values_1.v.literal("tenant.probe_blocked"), values_1.v.literal("tenant.platform_read_allowed")),
        outcome: values_1.v.union(values_1.v.literal("allowed_platform_bypass"), values_1.v.literal("blocked_missing_metadata"), values_1.v.literal("blocked_not_found")),
        recordId: values_1.v.optional(values_1.v.string()),
        sourceTenantId: values_1.v.optional(values_1.v.id("tenants")),
        tableName: values_1.v.string(),
        targetTenantId: values_1.v.optional(values_1.v.id("tenants")),
        timestamp: values_1.v.number(),
    })
        .index("by_actorUserId", ["actorUserId", "timestamp"])
        .index("by_event", ["event", "timestamp"])
        .index("by_targetTenantId", ["targetTenantId", "timestamp"])
        .index("by_timestamp", ["timestamp"]),
    auditLogs: (0, server_1.defineTable)({
        action: values_1.v.string(),
        actorRole: values_1.v.union(values_1.v.literal("anonymous"), values_1.v.literal("platform_admin"), values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user"), values_1.v.literal("unassigned")),
        actorState: values_1.v.union(values_1.v.literal("anonymous"), values_1.v.literal("authenticated")),
        actorUserId: values_1.v.optional(values_1.v.id("users")),
        entityType: values_1.v.string(),
        event: values_1.v.string(),
        metadata: values_1.v.any(),
        outcome: values_1.v.string(),
        recordId: values_1.v.optional(values_1.v.string()),
        sourceTenantId: values_1.v.optional(values_1.v.id("tenants")),
        tableName: values_1.v.optional(values_1.v.string()),
        targetTenantId: values_1.v.optional(values_1.v.id("tenants")),
        timestamp: values_1.v.number(),
    })
        .index("by_actorUserId", ["actorUserId", "timestamp"])
        .index("by_event", ["event", "timestamp"])
        .index("by_timestamp", ["timestamp"]),
    externalServiceSyncEvents: (0, server_1.defineTable)({
        actorRole: values_1.v.optional(values_1.v.string()),
        actorTenantId: values_1.v.optional(values_1.v.string()),
        actorUserId: values_1.v.optional(values_1.v.string()),
        claimedAt: values_1.v.number(),
        durableChanges: values_1.v.array(values_1.v.any()),
        eventKey: values_1.v.string(),
        eventType: values_1.v.string(),
        lastError: values_1.v.optional(values_1.v.object({
            code: values_1.v.string(),
            message: values_1.v.string(),
        })),
        metadata: values_1.v.any(),
        payloadHash: values_1.v.string(),
        processedAt: values_1.v.optional(values_1.v.number()),
        provider: values_1.v.string(),
        result: values_1.v.optional(values_1.v.any()),
        status: values_1.v.union(values_1.v.literal("claimed"), values_1.v.literal("completed"), values_1.v.literal("failed")),
        updatedAt: values_1.v.number(),
    })
        .index("by_eventKey", ["eventKey"])
        .index("by_provider_status", ["provider", "status", "updatedAt"])
        .index("by_status", ["status", "updatedAt"]),
});
