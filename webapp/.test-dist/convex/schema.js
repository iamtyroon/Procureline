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
        profileComplete: values_1.v.boolean(),
        primaryContactName: values_1.v.optional(values_1.v.string()),
        primaryContactEmail: values_1.v.optional(values_1.v.string()),
        primaryContactPhone: values_1.v.optional(values_1.v.string()),
        fiscalYearStartMonth: values_1.v.optional(values_1.v.number()),
        logoUrl: values_1.v.optional(values_1.v.string()),
        onboardingCompletedAt: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
    })
        .index("by_subdomain", ["subdomain"])
        .index("by_status", ["status"]),
    tenantAdminInvitations: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        email: values_1.v.string(),
        normalizedEmail: values_1.v.string(),
        tokenHash: values_1.v.string(),
        status: values_1.v.union(values_1.v.literal("pending"), values_1.v.literal("accepted"), values_1.v.literal("expired"), values_1.v.literal("revoked")),
        expiresAt: values_1.v.number(),
        resentCount: values_1.v.number(),
        createdByPlatformUserId: values_1.v.optional(values_1.v.id("users")),
        acceptedByUserId: values_1.v.optional(values_1.v.id("users")),
        acceptedAt: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tokenHash", ["tokenHash"])
        .index("by_tenantId_email", ["tenantId", "normalizedEmail"])
        .index("by_normalizedEmail", ["normalizedEmail", "createdAt"]),
    tenantAdminOnboardingStates: (0, server_1.defineTable)({
        normalizedEmail: values_1.v.string(),
        mode: values_1.v.union(values_1.v.literal("invite"), values_1.v.literal("self_serve")),
        tenantId: values_1.v.optional(values_1.v.id("tenants")),
        invitationId: values_1.v.optional(values_1.v.id("tenantAdminInvitations")),
        verificationWindowExpiresAt: values_1.v.number(),
        lastVerificationSentAt: values_1.v.number(),
        autoResendCount: values_1.v.number(),
        manualResendCount: values_1.v.number(),
        completedAt: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_normalizedEmail", ["normalizedEmail", "createdAt"])
        .index("by_invitationId", ["invitationId", "createdAt"]),
    tenantUsers: (0, server_1.defineTable)({
        userId: values_1.v.id("users"),
        tenantId: values_1.v.id("tenants"),
        role: values_1.v.union(values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user")),
        isActive: values_1.v.boolean(),
    })
        .index("by_userId", ["userId"])
        .index("by_tenantId", ["tenantId"])
        .index("by_userId_tenantId", ["userId", "tenantId"]),
    departments: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        procurementOfficerTenantUserId: values_1.v.id("tenantUsers"),
        name: values_1.v.string(),
        code: values_1.v.string(),
        budgetAllocation: values_1.v.optional(values_1.v.number()),
        isActive: values_1.v.boolean(),
        submissionStartsAt: values_1.v.number(),
        submissionEndsAt: values_1.v.number(),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tenantId", ["tenantId"])
        .index("by_tenantId_code", ["tenantId", "code"])
        .index("by_procurementOfficerTenantUserId", ["procurementOfficerTenantUserId"]),
    procurementCategories: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        name: values_1.v.string(),
        description: values_1.v.optional(values_1.v.string()),
        isActive: values_1.v.boolean(),
        sortOrder: values_1.v.number(),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tenantId", ["tenantId"])
        .index("by_tenantId_isActive", ["tenantId", "isActive"]),
    procurementItems: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        categoryId: values_1.v.id("procurementCategories"),
        name: values_1.v.string(),
        description: values_1.v.optional(values_1.v.string()),
        isActive: values_1.v.boolean(),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tenantId", ["tenantId"])
        .index("by_categoryId", ["categoryId"])
        .index("by_tenantId_isActive", ["tenantId", "isActive"]),
    plans: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        departmentId: values_1.v.id("departments"),
        fiscalYear: values_1.v.string(),
        status: values_1.v.union(values_1.v.literal("draft"), values_1.v.literal("submitted"), values_1.v.literal("rejected"), values_1.v.literal("approved")),
        itemCount: values_1.v.number(),
        estimatedBudgetUsed: values_1.v.number(),
        selectedCategoryIds: values_1.v.array(values_1.v.id("procurementCategories")),
        categorySummaries: values_1.v.array(values_1.v.object({
            categoryId: values_1.v.id("procurementCategories"),
            categoryName: values_1.v.string(),
            amount: values_1.v.number(),
            itemCount: values_1.v.number(),
        })),
        rejectionComment: values_1.v.optional(values_1.v.string()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
        submittedAt: values_1.v.optional(values_1.v.number()),
        approvedAt: values_1.v.optional(values_1.v.number()),
        rejectedAt: values_1.v.optional(values_1.v.number()),
    })
        .index("by_tenantId", ["tenantId"])
        .index("by_departmentId", ["departmentId"])
        .index("by_departmentId_fiscalYear", ["departmentId", "fiscalYear"])
        .index("by_tenantId_status", ["tenantId", "status"]),
    departmentAccessCodes: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        departmentId: values_1.v.id("departments"),
        codeHash: values_1.v.string(),
        codeSuffix: values_1.v.string(),
        expiresAt: values_1.v.number(),
        isActive: values_1.v.boolean(),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tenantId", ["tenantId"])
        .index("by_departmentId", ["departmentId"])
        .index("by_codeHash", ["codeHash"])
        .index("by_tenantId_codeHash", ["tenantId", "codeHash"]),
    departmentUserProfiles: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        tenantUserId: values_1.v.id("tenantUsers"),
        departmentId: values_1.v.id("departments"),
        normalizedEmail: values_1.v.string(),
        isActive: values_1.v.boolean(),
        deactivatedAt: values_1.v.optional(values_1.v.number()),
        lastAuthenticatedAt: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tenantId", ["tenantId"])
        .index("by_tenantUserId", ["tenantUserId"])
        .index("by_departmentId_email", ["departmentId", "normalizedEmail"])
        .index("by_tenantId_email", ["tenantId", "normalizedEmail"]),
    departmentUserLoginAttempts: (0, server_1.defineTable)({
        normalizedEmail: values_1.v.string(),
        accessCodeHash: values_1.v.string(),
        accessCodeId: values_1.v.optional(values_1.v.id("departmentAccessCodes")),
        failedAttempts: values_1.v.number(),
        lockedUntil: values_1.v.optional(values_1.v.number()),
        lastFailureAt: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_email_accessCodeHash", ["normalizedEmail", "accessCodeHash"])
        .index("by_accessCodeId", ["accessCodeId"]),
    departmentUserAuthChallenges: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        departmentId: values_1.v.id("departments"),
        accessCodeId: values_1.v.id("departmentAccessCodes"),
        normalizedEmail: values_1.v.string(),
        accessMode: values_1.v.union(values_1.v.literal("editable"), values_1.v.literal("read_only_grace")),
        authAccountId: values_1.v.optional(values_1.v.id("authAccounts")),
        authUserId: values_1.v.optional(values_1.v.id("users")),
        expiresAt: values_1.v.number(),
        consumedAt: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_normalizedEmail", ["normalizedEmail", "createdAt"])
        .index("by_accessCodeId", ["accessCodeId", "createdAt"])
        .index("by_expiresAt", ["expiresAt"]),
    platformUsers: (0, server_1.defineTable)({
        userId: values_1.v.id("users"),
        isActive: values_1.v.boolean(),
        createdAt: values_1.v.number(),
    })
        .index("by_userId", ["userId"])
        .index("by_userId_isActive", ["userId", "isActive"]),
    platformAdminSecurityStates: (0, server_1.defineTable)({
        userId: values_1.v.id("users"),
        enrollmentEmail: values_1.v.optional(values_1.v.string()),
        isTwoFactorEnrolled: values_1.v.boolean(),
        backupCodes: values_1.v.array(values_1.v.object({
            codeHash: values_1.v.string(),
            suffix: values_1.v.string(),
            createdAt: values_1.v.number(),
            consumedAt: values_1.v.optional(values_1.v.number()),
        })),
        lastTrustedAt: values_1.v.optional(values_1.v.number()),
        lastTrustedCountry: values_1.v.optional(values_1.v.string()),
        lastTrustedIpHash: values_1.v.optional(values_1.v.string()),
        lastTrustedUserAgentHash: values_1.v.optional(values_1.v.string()),
        passwordResetCompletionTokenHash: values_1.v.optional(values_1.v.string()),
        passwordResetCompletionTokenIssuedAt: values_1.v.optional(values_1.v.number()),
        passwordResetRequiredAt: values_1.v.optional(values_1.v.number()),
        revokedAt: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    }).index("by_userId", ["userId"]),
    platformAdminPreferences: (0, server_1.defineTable)({
        userId: values_1.v.id("users"),
        alertSeverityFilter: values_1.v.union(values_1.v.literal("all"), values_1.v.literal("warning"), values_1.v.literal("critical")),
        hiddenWidgetIds: values_1.v.array(values_1.v.union(values_1.v.literal("recent_tenants"), values_1.v.literal("system_health"), values_1.v.literal("recent_alerts"))),
        sidebarCollapsed: values_1.v.boolean(),
        widgetOrder: values_1.v.array(values_1.v.union(values_1.v.literal("recent_tenants"), values_1.v.literal("system_health"), values_1.v.literal("recent_alerts"))),
        updatedAt: values_1.v.number(),
    }).index("by_userId", ["userId"]),
    platformHealthSnapshots: (0, server_1.defineTable)({
        capturedAt: values_1.v.number(),
        summaryState: values_1.v.optional(values_1.v.union(values_1.v.literal("healthy"), values_1.v.literal("warning"), values_1.v.literal("critical"))),
        api: values_1.v.optional(values_1.v.object({
            state: values_1.v.union(values_1.v.literal("healthy"), values_1.v.literal("warning"), values_1.v.literal("critical")),
            detail: values_1.v.optional(values_1.v.string()),
        })),
        database: values_1.v.optional(values_1.v.object({
            state: values_1.v.union(values_1.v.literal("healthy"), values_1.v.literal("warning"), values_1.v.literal("critical")),
            detail: values_1.v.optional(values_1.v.string()),
        })),
        jobs: values_1.v.optional(values_1.v.object({
            state: values_1.v.union(values_1.v.literal("healthy"), values_1.v.literal("warning"), values_1.v.literal("critical")),
            detail: values_1.v.optional(values_1.v.string()),
        })),
        storage: values_1.v.optional(values_1.v.object({
            state: values_1.v.union(values_1.v.literal("healthy"), values_1.v.literal("warning"), values_1.v.literal("critical")),
            detail: values_1.v.optional(values_1.v.string()),
        })),
        email: values_1.v.optional(values_1.v.object({
            state: values_1.v.union(values_1.v.literal("healthy"), values_1.v.literal("warning"), values_1.v.literal("critical")),
            detail: values_1.v.optional(values_1.v.string()),
        })),
    }).index("by_capturedAt", ["capturedAt"]),
    platformAdminChallenges: (0, server_1.defineTable)({
        userId: values_1.v.id("users"),
        sessionId: values_1.v.id("authSessions"),
        purpose: values_1.v.union(values_1.v.literal("setup"), values_1.v.literal("verify")),
        codeHash: values_1.v.string(),
        deliveryEmail: values_1.v.string(),
        riskLevel: values_1.v.union(values_1.v.literal("normal"), values_1.v.literal("suspicious")),
        riskReasons: values_1.v.array(values_1.v.union(values_1.v.literal("country_changed"), values_1.v.literal("ip_changed"), values_1.v.literal("user_agent_changed"))),
        failedAttempts: values_1.v.number(),
        lockedUntil: values_1.v.optional(values_1.v.number()),
        sentAt: values_1.v.number(),
        expiresAt: values_1.v.number(),
        consumedAt: values_1.v.optional(values_1.v.number()),
        revokedAt: values_1.v.optional(values_1.v.number()),
        ipAddress: values_1.v.optional(values_1.v.string()),
        ipCountry: values_1.v.optional(values_1.v.string()),
        ipRegion: values_1.v.optional(values_1.v.string()),
        ipCity: values_1.v.optional(values_1.v.string()),
        userAgent: values_1.v.optional(values_1.v.string()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_userId", ["userId", "createdAt"])
        .index("by_sessionId", ["sessionId", "createdAt"])
        .index("by_userId_sessionId_purpose", ["userId", "sessionId", "purpose"])
        .index("by_expiresAt", ["expiresAt"]),
    sessionMetadata: (0, server_1.defineTable)({
        sessionId: values_1.v.id("authSessions"),
        userId: values_1.v.id("users"),
        rememberMe: values_1.v.boolean(),
        lastActivityAt: values_1.v.number(),
        createdAt: values_1.v.number(),
        revokedAt: values_1.v.optional(values_1.v.number()),
        loggedOutAt: values_1.v.optional(values_1.v.number()),
        isPlatformAdminSession: values_1.v.optional(values_1.v.boolean()),
        platformAdminAuthStage: values_1.v.optional(values_1.v.union(values_1.v.literal("setup_required"), values_1.v.literal("verification_required"), values_1.v.literal("verified"), values_1.v.literal("reset_required"))),
        platformAdminChallengeId: values_1.v.optional(values_1.v.id("platformAdminChallenges")),
        platformAdminRiskLevel: values_1.v.optional(values_1.v.union(values_1.v.literal("normal"), values_1.v.literal("suspicious"))),
        platformAdminRiskReasons: values_1.v.optional(values_1.v.array(values_1.v.union(values_1.v.literal("country_changed"), values_1.v.literal("ip_changed"), values_1.v.literal("user_agent_changed")))),
        platformAdminVerifiedAt: values_1.v.optional(values_1.v.number()),
        platformAdminTrustedAt: values_1.v.optional(values_1.v.number()),
        platformAdminVerificationMethod: values_1.v.optional(values_1.v.union(values_1.v.literal("email_otp"), values_1.v.literal("backup_code"))),
        platformAdminRevocationReason: values_1.v.optional(values_1.v.string()),
        platformAdminIpAddress: values_1.v.optional(values_1.v.string()),
        platformAdminIpCountry: values_1.v.optional(values_1.v.string()),
        platformAdminIpRegion: values_1.v.optional(values_1.v.string()),
        platformAdminIpCity: values_1.v.optional(values_1.v.string()),
        platformAdminUserAgent: values_1.v.optional(values_1.v.string()),
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
        .index("by_sourceTenantId", ["sourceTenantId", "timestamp"])
        .index("by_targetTenantId", ["targetTenantId", "timestamp"])
        .index("by_timestamp", ["timestamp"]),
    externalServiceSyncEvents: (0, server_1.defineTable)({
        actorRole: values_1.v.optional(values_1.v.string()),
        actorTenantId: values_1.v.optional(values_1.v.id("tenants")),
        actorUserId: values_1.v.optional(values_1.v.id("users")),
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
