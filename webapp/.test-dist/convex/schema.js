"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("convex/server");
const values_1 = require("convex/values");
const server_2 = require("@convex-dev/auth/server");
const blocklyWorkspaceStateValidator = values_1.v.object({
    format: values_1.v.literal("blockly_json"),
    schemaVersion: values_1.v.number(),
    workspaceJson: values_1.v.any(),
    editorMetadata: values_1.v.object({
        lastSavedAt: values_1.v.number(),
        lastSavedByUserId: values_1.v.string(),
        recoveredAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        revision: values_1.v.number(),
        saveSource: values_1.v.union(values_1.v.literal("workspace_clear"), values_1.v.literal("workspace_recovery"), values_1.v.literal("workspace_seed"), values_1.v.literal("workspace_sync")),
    }),
});
const catalogRequestStatusValidator = values_1.v.union(values_1.v.literal("pending"), values_1.v.literal("approved"), values_1.v.literal("denied"), values_1.v.literal("expired"), values_1.v.literal("cancelled"));
const catalogRequestDecisionSourceValidator = values_1.v.union(values_1.v.literal("deadline"), values_1.v.literal("du"), values_1.v.literal("po"), values_1.v.literal("system"));
const catalogRequestOriginValidator = values_1.v.union(values_1.v.literal("standalone"), values_1.v.literal("item_handoff"));
const planRedraftRequestStatusValidator = values_1.v.union(values_1.v.literal("pending"), values_1.v.literal("approved"), values_1.v.literal("denied"), values_1.v.literal("cancelled"));
const planReviewDecisionTypeValidator = values_1.v.union(values_1.v.literal("approved"), values_1.v.literal("rejected"), values_1.v.literal("revision_requested"));
const planReviewDecisionLifecycleStatusValidator = values_1.v.union(values_1.v.literal("active"), values_1.v.literal("superseded"), values_1.v.literal("undone"));
const planReviewDecisionNotificationStatusValidator = values_1.v.union(values_1.v.literal("failed"), values_1.v.literal("queued"));
const planReviewFlaggedTargetValidator = values_1.v.object({
    categoryId: values_1.v.string(),
    id: values_1.v.string(),
    itemId: values_1.v.union(values_1.v.string(), values_1.v.null()),
    label: values_1.v.string(),
    type: values_1.v.union(values_1.v.literal("category"), values_1.v.literal("item")),
});
const consolidationStatusValidator = values_1.v.union(values_1.v.literal("draft"), values_1.v.literal("finalized"), values_1.v.literal("archived"));
const consolidationExportStatusValidator = values_1.v.union(values_1.v.literal("queued"), values_1.v.literal("processing"), values_1.v.literal("completed"), values_1.v.literal("failed"), values_1.v.literal("expired"));
const tenantAdminReportTypeValidator = values_1.v.union(values_1.v.literal("activity"), values_1.v.literal("audit"), values_1.v.literal("budget"));
const tenantAdminReportFormatValidator = values_1.v.union(values_1.v.literal("csv"), values_1.v.literal("xlsx"));
const tenantAdminReportStatusValidator = values_1.v.union(values_1.v.literal("failed"), values_1.v.literal("queued"), values_1.v.literal("ready"));
const tenantAdminReportScheduleCadenceValidator = values_1.v.union(values_1.v.literal("monthly"), values_1.v.literal("weekly"));
exports.default = (0, server_1.defineSchema)({
    ...server_2.authTables,
    tenants: (0, server_1.defineTable)({
        name: values_1.v.string(),
        subdomain: values_1.v.string(),
        tier: values_1.v.union(values_1.v.literal("free"), values_1.v.literal("starter"), values_1.v.literal("professional"), values_1.v.literal("enterprise")),
        status: values_1.v.union(values_1.v.literal("active"), values_1.v.literal("suspended"), values_1.v.literal("cancelled"), values_1.v.literal("pending")),
        profileComplete: values_1.v.boolean(),
        primaryContactName: values_1.v.optional(values_1.v.string()),
        primaryContactEmail: values_1.v.optional(values_1.v.string()),
        primaryContactPhone: values_1.v.optional(values_1.v.string()),
        procurementBudgetCeiling: values_1.v.optional(values_1.v.number()),
        fiscalYearStartMonth: values_1.v.optional(values_1.v.number()),
        timeZone: values_1.v.optional(values_1.v.string()),
        logoUrl: values_1.v.optional(values_1.v.string()),
        onboardingCompletedAt: values_1.v.optional(values_1.v.number()),
        storageLimitBytes: values_1.v.optional(values_1.v.number()),
        storageUsedBytes: values_1.v.optional(values_1.v.number()),
        userLimit: values_1.v.optional(values_1.v.number()),
        suspendedAt: values_1.v.optional(values_1.v.number()),
        suspendedByPlatformUserId: values_1.v.optional(values_1.v.id("users")),
        suspensionReason: values_1.v.optional(values_1.v.string()),
        restoredAt: values_1.v.optional(values_1.v.number()),
        restoredByPlatformUserId: values_1.v.optional(values_1.v.id("users")),
        restoreReason: values_1.v.optional(values_1.v.string()),
        softDeletedAt: values_1.v.optional(values_1.v.number()),
        softDeletedByPlatformUserId: values_1.v.optional(values_1.v.id("users")),
        softDeleteReason: values_1.v.optional(values_1.v.string()),
        purgeScheduledAt: values_1.v.optional(values_1.v.number()),
        previousSubdomains: values_1.v.optional(values_1.v.array(values_1.v.string())),
        subscriptionStatus: values_1.v.optional(values_1.v.union(values_1.v.literal("active"), values_1.v.literal("trialing"), values_1.v.literal("past_due"), values_1.v.literal("grace_period"), values_1.v.literal("suspended"), values_1.v.literal("cancelled"))),
        subscriptionAmountCents: values_1.v.optional(values_1.v.number()),
        subscriptionCurrency: values_1.v.optional(values_1.v.string()),
        subscriptionBillingCycle: values_1.v.optional(values_1.v.union(values_1.v.literal("monthly"), values_1.v.literal("annual"))),
        subscriptionPaymentMethod: values_1.v.optional(values_1.v.union(values_1.v.literal("stripe"), values_1.v.literal("intasend"), values_1.v.literal("bank_transfer"), values_1.v.literal("custom"))),
        subscriptionNextBillingDate: values_1.v.optional(values_1.v.number()),
        subscriptionGracePeriodEndsAt: values_1.v.optional(values_1.v.number()),
        subscriptionPendingTier: values_1.v.optional(values_1.v.union(values_1.v.literal("free"), values_1.v.literal("starter"), values_1.v.literal("professional"), values_1.v.literal("enterprise"))),
        subscriptionPendingChangeEffectiveAt: values_1.v.optional(values_1.v.number()),
        subscriptionDeletionReviewAt: values_1.v.optional(values_1.v.number()),
        subscriptionCustomPriceCents: values_1.v.optional(values_1.v.number()),
        subscriptionCustomPriceReason: values_1.v.optional(values_1.v.string()),
        subscriptionCustomPriceUpdatedAt: values_1.v.optional(values_1.v.number()),
        lastPaymentFailureAt: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
    })
        .index("by_subdomain", ["subdomain"])
        .index("by_status", ["status"])
        .index("by_tier", ["tier"])
        .index("by_subscriptionStatus", ["subscriptionStatus"])
        .index("by_subscriptionPaymentMethod", ["subscriptionPaymentMethod"])
        .index("by_subscriptionNextBillingDate", ["subscriptionNextBillingDate"]),
    tenantSubdomainRedirects: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        fromSubdomain: values_1.v.string(),
        toSubdomain: values_1.v.string(),
        expiresAt: values_1.v.number(),
        createdAt: values_1.v.number(),
        createdByPlatformUserId: values_1.v.id("users"),
    })
        .index("by_fromSubdomain", ["fromSubdomain"])
        .index("by_tenantId", ["tenantId", "createdAt"]),
    tenantConfigOverrides: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        key: values_1.v.string(),
        value: values_1.v.string(),
        reason: values_1.v.string(),
        expiresAt: values_1.v.number(),
        createdAt: values_1.v.number(),
        createdByPlatformUserId: values_1.v.id("users"),
    })
        .index("by_tenantId", ["tenantId", "createdAt"])
        .index("by_expiresAt", ["expiresAt"]),
    platformTenantDataExports: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        requestedByPlatformUserId: values_1.v.id("users"),
        status: values_1.v.union(values_1.v.literal("queued"), values_1.v.literal("ready"), values_1.v.literal("failed")),
        downloadUrl: values_1.v.optional(values_1.v.string()),
        errorMessage: values_1.v.optional(values_1.v.string()),
        storageId: values_1.v.optional(values_1.v.string()),
        fileSizeBytes: values_1.v.optional(values_1.v.number()),
        requestedAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
        expiresAt: values_1.v.number(),
    })
        .index("by_tenantId", ["tenantId", "requestedAt"])
        .index("by_status", ["status", "updatedAt"]),
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
    poInvitations: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        email: values_1.v.string(),
        normalizedEmail: values_1.v.string(),
        fullName: values_1.v.string(),
        phone: values_1.v.string(),
        inviteTokenHash: values_1.v.string(),
        activationCodeHash: values_1.v.string(),
        activationCodeSuffix: values_1.v.string(),
        issueVersion: values_1.v.number(),
        status: values_1.v.union(values_1.v.literal("pending"), values_1.v.literal("accepted"), values_1.v.literal("expired"), values_1.v.literal("bounced"), values_1.v.literal("revoked")),
        expiresAt: values_1.v.number(),
        resentCount: values_1.v.number(),
        createdByTenantUserId: values_1.v.id("tenantUsers"),
        acceptedByUserId: values_1.v.optional(values_1.v.id("users")),
        acceptedTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        acceptedAt: values_1.v.optional(values_1.v.number()),
        providerMessageId: values_1.v.optional(values_1.v.string()),
        lastEmailSentAt: values_1.v.optional(values_1.v.number()),
        bounceReason: values_1.v.optional(values_1.v.string()),
        bounceNotifiedAt: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tenantId", ["tenantId", "createdAt"])
        .index("by_inviteTokenHash", ["inviteTokenHash"])
        .index("by_activationCodeHash", ["activationCodeHash"])
        .index("by_tenantId_email", ["tenantId", "normalizedEmail"])
        .index("by_tenantId_status", ["tenantId", "status", "createdAt"])
        .index("by_normalizedEmail", ["normalizedEmail", "createdAt"]),
    procurementOfficerAuthChallenges: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        invitationId: values_1.v.id("poInvitations"),
        normalizedEmail: values_1.v.string(),
        authAccountId: values_1.v.optional(values_1.v.id("authAccounts")),
        authUserId: values_1.v.optional(values_1.v.id("users")),
        expiresAt: values_1.v.number(),
        consumedAt: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_invitationId", ["invitationId", "createdAt"])
        .index("by_normalizedEmail", ["normalizedEmail", "createdAt"])
        .index("by_expiresAt", ["expiresAt"]),
    tenantUsers: (0, server_1.defineTable)({
        userId: values_1.v.id("users"),
        tenantId: values_1.v.id("tenants"),
        role: values_1.v.union(values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user")),
        isActive: values_1.v.boolean(),
        deactivatedAt: values_1.v.optional(values_1.v.number()),
        deactivatedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        reactivatedAt: values_1.v.optional(values_1.v.number()),
    })
        .index("by_userId", ["userId"])
        .index("by_tenantId", ["tenantId"])
        .index("by_userId_tenantId", ["userId", "tenantId"]),
    departments: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        procurementOfficerTenantUserId: values_1.v.id("tenantUsers"),
        name: values_1.v.string(),
        normalizedName: values_1.v.string(),
        code: values_1.v.string(),
        normalizedCode: values_1.v.string(),
        voteNumber: values_1.v.optional(values_1.v.string()),
        normalizedVoteNumber: values_1.v.optional(values_1.v.string()),
        budgetAllocation: values_1.v.optional(values_1.v.number()),
        isActive: values_1.v.boolean(),
        submissionStartsAt: values_1.v.optional(values_1.v.number()),
        submissionEndsAt: values_1.v.optional(values_1.v.number()),
        deletedAt: values_1.v.optional(values_1.v.number()),
        deletedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        lastBudgetChangedAt: values_1.v.optional(values_1.v.number()),
        lastBudgetChangedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tenantId", ["tenantId"])
        .index("by_tenantId_isActive", ["tenantId", "isActive"])
        .index("by_tenantId_code", ["tenantId", "code"])
        .index("by_tenantId_normalizedCode", ["tenantId", "normalizedCode"])
        .index("by_tenantId_normalizedName", ["tenantId", "normalizedName"])
        .index("by_procurementOfficerTenantUserId", [
        "procurementOfficerTenantUserId",
    ]),
    submissionDeadlines: (0, server_1.defineTable)({
        announcementIssuedAt: values_1.v.optional(values_1.v.number()),
        announcementMessage: values_1.v.optional(values_1.v.string()),
        announcementTitle: values_1.v.optional(values_1.v.string()),
        createdAt: values_1.v.number(),
        createdByTenantUserId: values_1.v.id("tenantUsers"),
        deadlineVersion: values_1.v.number(),
        fiscalYearKey: values_1.v.string(),
        lastChangeType: values_1.v.union(values_1.v.literal("edited"), values_1.v.literal("extension"), values_1.v.literal("initial_setup"), values_1.v.literal("tightened")),
        lastExtensionReason: values_1.v.optional(values_1.v.string()),
        previousSubmissionEndsAt: values_1.v.optional(values_1.v.number()),
        reminderOffsets: values_1.v.array(values_1.v.number()),
        scheduledReminderOffsets: values_1.v.array(values_1.v.number()),
        skippedReminderOffsets: values_1.v.array(values_1.v.number()),
        submissionEndsAt: values_1.v.number(),
        submissionStartsAt: values_1.v.number(),
        tenantId: values_1.v.id("tenants"),
        timeZone: values_1.v.string(),
        updatedAt: values_1.v.number(),
        updatedByTenantUserId: values_1.v.id("tenantUsers"),
    })
        .index("by_tenantId", ["tenantId", "updatedAt"])
        .index("by_tenantId_fiscalYearKey", ["tenantId", "fiscalYearKey"]),
    submissionDeadlineReminderJobs: (0, server_1.defineTable)({
        createdAt: values_1.v.number(),
        deadlineVersion: values_1.v.number(),
        deliverAt: values_1.v.number(),
        fiscalYearKey: values_1.v.string(),
        idempotencyKey: values_1.v.string(),
        jobId: values_1.v.optional(values_1.v.string()),
        recipientEmail: values_1.v.string(),
        reminderOffsetDays: values_1.v.number(),
        status: values_1.v.union(values_1.v.literal("cancelled"), values_1.v.literal("failed"), values_1.v.literal("scheduled"), values_1.v.literal("skipped")),
        statusMessage: values_1.v.optional(values_1.v.string()),
        submissionDeadlineId: values_1.v.id("submissionDeadlines"),
        tenantId: values_1.v.id("tenants"),
        updatedAt: values_1.v.number(),
    })
        .index("by_jobId", ["jobId"])
        .index("by_idempotencyKey", ["idempotencyKey"])
        .index("by_submissionDeadlineId_version", [
        "submissionDeadlineId",
        "deadlineVersion",
    ])
        .index("by_tenantId_fiscalYearKey", [
        "tenantId",
        "fiscalYearKey",
        "deadlineVersion",
    ]),
    procurementCategories: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        name: values_1.v.string(),
        normalizedName: values_1.v.optional(values_1.v.string()),
        description: values_1.v.optional(values_1.v.string()),
        color: values_1.v.optional(values_1.v.string()),
        icon: values_1.v.optional(values_1.v.string()),
        isActive: values_1.v.boolean(),
        archivedAt: values_1.v.optional(values_1.v.number()),
        archivedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        sortOrder: values_1.v.number(),
        revision: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tenantId", ["tenantId"])
        .index("by_tenantId_isActive", ["tenantId", "isActive"])
        .index("by_tenantId_normalizedName", ["tenantId", "normalizedName"])
        .index("by_tenantId_sortOrder", ["tenantId", "sortOrder"]),
    procurementItems: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        categoryId: values_1.v.id("procurementCategories"),
        categoryNameSnapshot: values_1.v.optional(values_1.v.string()),
        catalogSearchText: values_1.v.optional(values_1.v.string()),
        name: values_1.v.string(),
        normalizedName: values_1.v.optional(values_1.v.string()),
        description: values_1.v.optional(values_1.v.string()),
        unitOfMeasurement: values_1.v.optional(values_1.v.string()),
        unitPrice: values_1.v.optional(values_1.v.number()),
        procurementMethod: values_1.v.optional(values_1.v.string()),
        sourceOfFunds: values_1.v.optional(values_1.v.string()),
        minQuantity: values_1.v.optional(values_1.v.number()),
        maxQuantity: values_1.v.optional(values_1.v.number()),
        complianceFlags: values_1.v.optional(values_1.v.array(values_1.v.union(values_1.v.literal("agpo"), values_1.v.literal("pwd"), values_1.v.literal("local_content")))),
        sortOrder: values_1.v.optional(values_1.v.number()),
        isActive: values_1.v.boolean(),
        archivedAt: values_1.v.optional(values_1.v.number()),
        archivedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        lastPriceChangedAt: values_1.v.optional(values_1.v.number()),
        lastPriceChangedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        revision: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tenantId", ["tenantId"])
        .index("by_categoryId", ["categoryId"])
        .index("by_tenantId_isActive", ["tenantId", "isActive"])
        .index("by_tenantId_categoryId", ["tenantId", "categoryId"])
        .index("by_tenantId_categoryId_normalizedName", [
        "tenantId",
        "categoryId",
        "normalizedName",
    ])
        .searchIndex("search_by_catalog", {
        filterFields: ["tenantId"],
        searchField: "catalogSearchText",
    }),
    procurementItemPriceHistory: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        itemId: values_1.v.id("procurementItems"),
        previousUnitPrice: values_1.v.union(values_1.v.number(), values_1.v.null()),
        nextUnitPrice: values_1.v.number(),
        changedAt: values_1.v.number(),
        changedByTenantUserId: values_1.v.id("tenantUsers"),
    })
        .index("by_itemId_changedAt", ["itemId", "changedAt"])
        .index("by_tenantId_changedAt", ["tenantId", "changedAt"]),
    categoryRequests: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        departmentId: values_1.v.id("departments"),
        planId: values_1.v.id("plans"),
        fiscalYear: values_1.v.string(),
        requestorTenantUserId: values_1.v.id("tenantUsers"),
        requestorUserId: values_1.v.id("users"),
        name: values_1.v.string(),
        normalizedName: values_1.v.string(),
        description: values_1.v.string(),
        justification: values_1.v.string(),
        requesterDuplicateKey: values_1.v.string(),
        sharedGroupingKey: values_1.v.string(),
        requestOrigin: catalogRequestOriginValidator,
        status: catalogRequestStatusValidator,
        revision: values_1.v.number(),
        decisionReason: values_1.v.optional(values_1.v.string()),
        decisionSource: values_1.v.optional(catalogRequestDecisionSourceValidator),
        decisionSnapshot: values_1.v.optional(values_1.v.any()),
        decisionNotificationDeliverAt: values_1.v.optional(values_1.v.number()),
        decisionNotificationErrorCode: values_1.v.optional(values_1.v.string()),
        decisionNotificationErrorMessage: values_1.v.optional(values_1.v.string()),
        decisionNotificationIdempotencyKey: values_1.v.optional(values_1.v.string()),
        decisionNotificationQueuedAt: values_1.v.optional(values_1.v.number()),
        decisionNotificationStatus: values_1.v.optional(values_1.v.union(values_1.v.literal("cancelled"), values_1.v.literal("failed"), values_1.v.literal("queued"))),
        denialUndoDeadlineAt: values_1.v.optional(values_1.v.number()),
        reviewedAt: values_1.v.optional(values_1.v.number()),
        reviewedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        linkedCatalogCategoryId: values_1.v.optional(values_1.v.id("procurementCategories")),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
        cancelledAt: values_1.v.optional(values_1.v.number()),
        submittedAt: values_1.v.number(),
    })
        .index("by_tenantId_status", ["tenantId", "status", "updatedAt"])
        .index("by_tenantId_createdAt", ["tenantId", "createdAt"])
        .index("by_tenantId_departmentId_createdAt", [
        "tenantId",
        "departmentId",
        "createdAt",
    ])
        .index("by_departmentId_status", ["departmentId", "status", "updatedAt"])
        .index("by_requestorTenantUserId_status", [
        "requestorTenantUserId",
        "status",
        "updatedAt",
    ])
        .index("by_planId", ["planId", "updatedAt"])
        .index("by_tenantId_requesterDuplicateKey", [
        "tenantId",
        "requesterDuplicateKey",
    ])
        .index("by_tenantId_sharedGroupingKey", ["tenantId", "sharedGroupingKey"]),
    itemRequests: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        departmentId: values_1.v.id("departments"),
        planId: values_1.v.id("plans"),
        fiscalYear: values_1.v.string(),
        requestorTenantUserId: values_1.v.id("tenantUsers"),
        requestorUserId: values_1.v.id("users"),
        name: values_1.v.string(),
        normalizedName: values_1.v.string(),
        description: values_1.v.string(),
        justification: values_1.v.string(),
        estimatedUnitPrice: values_1.v.number(),
        categoryId: values_1.v.optional(values_1.v.id("procurementCategories")),
        categoryNameSnapshot: values_1.v.string(),
        normalizedCategoryName: values_1.v.string(),
        categoryReferenceKey: values_1.v.string(),
        linkedCategoryRequestId: values_1.v.optional(values_1.v.id("categoryRequests")),
        requesterDuplicateKey: values_1.v.string(),
        sharedGroupingKey: values_1.v.string(),
        status: catalogRequestStatusValidator,
        revision: values_1.v.number(),
        decisionReason: values_1.v.optional(values_1.v.string()),
        decisionSource: values_1.v.optional(catalogRequestDecisionSourceValidator),
        decisionSnapshot: values_1.v.optional(values_1.v.any()),
        decisionNotificationDeliverAt: values_1.v.optional(values_1.v.number()),
        decisionNotificationErrorCode: values_1.v.optional(values_1.v.string()),
        decisionNotificationErrorMessage: values_1.v.optional(values_1.v.string()),
        decisionNotificationIdempotencyKey: values_1.v.optional(values_1.v.string()),
        decisionNotificationQueuedAt: values_1.v.optional(values_1.v.number()),
        decisionNotificationStatus: values_1.v.optional(values_1.v.union(values_1.v.literal("cancelled"), values_1.v.literal("failed"), values_1.v.literal("queued"))),
        denialUndoDeadlineAt: values_1.v.optional(values_1.v.number()),
        reviewedAt: values_1.v.optional(values_1.v.number()),
        reviewedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        linkedCatalogItemId: values_1.v.optional(values_1.v.id("procurementItems")),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
        cancelledAt: values_1.v.optional(values_1.v.number()),
        submittedAt: values_1.v.number(),
    })
        .index("by_tenantId_status", ["tenantId", "status", "updatedAt"])
        .index("by_tenantId_createdAt", ["tenantId", "createdAt"])
        .index("by_tenantId_departmentId_createdAt", [
        "tenantId",
        "departmentId",
        "createdAt",
    ])
        .index("by_departmentId_status", ["departmentId", "status", "updatedAt"])
        .index("by_requestorTenantUserId_status", [
        "requestorTenantUserId",
        "status",
        "updatedAt",
    ])
        .index("by_planId", ["planId", "updatedAt"])
        .index("by_tenantId_requesterDuplicateKey", [
        "tenantId",
        "requesterDuplicateKey",
    ])
        .index("by_tenantId_sharedGroupingKey", ["tenantId", "sharedGroupingKey"])
        .index("by_linkedCategoryRequestId", ["linkedCategoryRequestId", "updatedAt"]),
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
        workspaceState: values_1.v.optional(blocklyWorkspaceStateValidator),
        rejectionComment: values_1.v.optional(values_1.v.string()),
        departmentCodeSnapshot: values_1.v.optional(values_1.v.string()),
        departmentNameSnapshot: values_1.v.optional(values_1.v.string()),
        submissionReference: values_1.v.optional(values_1.v.string()),
        submissionSequence: values_1.v.optional(values_1.v.number()),
        submissionEmailStatus: values_1.v.optional(values_1.v.union(values_1.v.literal("failed"), values_1.v.literal("queued"))),
        submissionEmailErrorMessage: values_1.v.optional(values_1.v.string()),
        workspaceVersion: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
        submittedAt: values_1.v.optional(values_1.v.number()),
        reviewStartedAt: values_1.v.optional(values_1.v.number()),
        reviewStartedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        reviewStartedByUserId: values_1.v.optional(values_1.v.id("users")),
        approvedAt: values_1.v.optional(values_1.v.number()),
        consolidatedAt: values_1.v.optional(values_1.v.number()),
        rejectedAt: values_1.v.optional(values_1.v.number()),
        lastApprovedAt: values_1.v.optional(values_1.v.number()),
        lastApprovedSnapshotId: values_1.v.optional(values_1.v.id("planSubmissionSnapshots")),
        redraftApprovedAt: values_1.v.optional(values_1.v.number()),
        redraftApprovedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        redraftCycle: values_1.v.optional(values_1.v.number()),
        redraftReason: values_1.v.optional(values_1.v.string()),
        redraftRequestedAt: values_1.v.optional(values_1.v.number()),
    })
        .index("by_tenantId", ["tenantId"])
        .index("by_departmentId", ["departmentId"])
        .index("by_departmentId_fiscalYear", ["departmentId", "fiscalYear"])
        .index("by_tenantId_status", ["tenantId", "status"]),
    planReviewDecisions: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        departmentId: values_1.v.id("departments"),
        planId: values_1.v.id("plans"),
        fiscalYear: values_1.v.string(),
        decisionType: planReviewDecisionTypeValidator,
        lifecycleStatus: planReviewDecisionLifecycleStatusValidator,
        comment: values_1.v.string(),
        flaggedTargets: values_1.v.array(planReviewFlaggedTargetValidator),
        revisionDeadlineAt: values_1.v.optional(values_1.v.union(values_1.v.number(), values_1.v.null())),
        decidedAt: values_1.v.number(),
        decidedByUserId: values_1.v.id("users"),
        decidedByTenantUserId: values_1.v.id("tenantUsers"),
        notificationIdempotencyKey: values_1.v.optional(values_1.v.string()),
        notificationQueuedAt: values_1.v.optional(values_1.v.number()),
        notificationStatus: values_1.v.optional(planReviewDecisionNotificationStatusValidator),
        notificationErrorCode: values_1.v.optional(values_1.v.string()),
        notificationErrorMessage: values_1.v.optional(values_1.v.string()),
        undoneAt: values_1.v.optional(values_1.v.number()),
        undoneByUserId: values_1.v.optional(values_1.v.id("users")),
        undoneByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        supersededAt: values_1.v.optional(values_1.v.number()),
    })
        .index("by_planId_decidedAt", ["planId", "decidedAt"])
        .index("by_planId_lifecycleStatus_decidedAt", [
        "planId",
        "lifecycleStatus",
        "decidedAt",
    ])
        .index("by_tenantId_departmentId_fiscalYear_decidedAt", [
        "tenantId",
        "departmentId",
        "fiscalYear",
        "decidedAt",
    ])
        .index("by_tenantId_lifecycleStatus_decidedAt", [
        "tenantId",
        "lifecycleStatus",
        "decidedAt",
    ]),
    planRedraftRequests: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        departmentId: values_1.v.id("departments"),
        planId: values_1.v.id("plans"),
        fiscalYear: values_1.v.string(),
        requestorTenantUserId: values_1.v.id("tenantUsers"),
        requestorUserId: values_1.v.id("users"),
        reason: values_1.v.string(),
        status: planRedraftRequestStatusValidator,
        decisionNote: values_1.v.optional(values_1.v.string()),
        decidedAt: values_1.v.optional(values_1.v.number()),
        decidedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        decidedByUserId: values_1.v.optional(values_1.v.id("users")),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
        cancelledAt: values_1.v.optional(values_1.v.number()),
    })
        .index("by_planId_status", ["planId", "status", "updatedAt"])
        .index("by_tenantId_status", ["tenantId", "status", "updatedAt"])
        .index("by_departmentId_status", ["departmentId", "status", "updatedAt"])
        .index("by_tenantId_departmentId_fiscalYear", [
        "tenantId",
        "departmentId",
        "fiscalYear",
    ]),
    planSubmissionSnapshots: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        planId: values_1.v.id("plans"),
        departmentId: values_1.v.id("departments"),
        fiscalYear: values_1.v.string(),
        submissionSequenceKey: values_1.v.string(),
        submissionSequence: values_1.v.optional(values_1.v.number()),
        submissionReference: values_1.v.optional(values_1.v.string()),
        lifecycleStatus: values_1.v.optional(values_1.v.union(values_1.v.literal("active"), values_1.v.literal("withdrawn"))),
        submittedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        capturedAt: values_1.v.number(),
        capturedByUserId: values_1.v.id("users"),
        capturedByTenantUserId: values_1.v.id("tenantUsers"),
        withdrawnAt: values_1.v.optional(values_1.v.number()),
        withdrawnByUserId: values_1.v.optional(values_1.v.id("users")),
        withdrawnByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        departmentCodeSnapshot: values_1.v.optional(values_1.v.string()),
        departmentNameSnapshot: values_1.v.optional(values_1.v.string()),
        estimatedBudgetUsed: values_1.v.number(),
        itemCount: values_1.v.number(),
        selectedCategoryIds: values_1.v.array(values_1.v.string()),
        categorySummaries: values_1.v.array(values_1.v.object({
            amount: values_1.v.number(),
            categoryId: values_1.v.string(),
            categoryName: values_1.v.string(),
            itemCount: values_1.v.number(),
        })),
        workspaceState: values_1.v.optional(blocklyWorkspaceStateValidator),
    })
        .index("by_submissionSequenceKey", ["submissionSequenceKey"])
        .index("by_planId_submittedAt", ["planId", "submittedAt"])
        .index("by_tenantId_departmentId_fiscalYear_capturedAt", [
        "tenantId",
        "departmentId",
        "fiscalYear",
        "capturedAt",
    ]),
    planReviewComments: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        planId: values_1.v.id("plans"),
        authorUserId: values_1.v.id("users"),
        authorTenantUserId: values_1.v.id("tenantUsers"),
        authorNameSnapshot: values_1.v.string(),
        body: values_1.v.string(),
        createdAt: values_1.v.number(),
    })
        .index("by_planId_createdAt", ["planId", "createdAt"])
        .index("by_tenantId_planId_createdAt", ["tenantId", "planId", "createdAt"]),
    consolidations: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        fiscalYear: values_1.v.string(),
        status: consolidationStatusValidator,
        draftData: values_1.v.any(),
        workspaceState: values_1.v.optional(values_1.v.any()),
        schemaVersion: values_1.v.number(),
        revision: values_1.v.number(),
        createdByTenantUserId: values_1.v.id("tenantUsers"),
        updatedByTenantUserId: values_1.v.id("tenantUsers"),
        finalizedAt: values_1.v.optional(values_1.v.number()),
        finalizedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tenantId_fiscalYear", ["tenantId", "fiscalYear"])
        .index("by_tenantId_status_fiscalYear", ["tenantId", "status", "fiscalYear"]),
    consolidationSnapshots: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        consolidationId: values_1.v.id("consolidations"),
        fiscalYear: values_1.v.string(),
        status: values_1.v.literal("finalized"),
        schemaVersion: values_1.v.number(),
        sourcePlanIds: values_1.v.array(values_1.v.string()),
        selectedSourceDepartmentIds: values_1.v.array(values_1.v.string()),
        draftData: values_1.v.any(),
        workspaceState: values_1.v.optional(values_1.v.any()),
        calculatedTotals: values_1.v.any(),
        complianceSummary: values_1.v.any(),
        notes: values_1.v.string(),
        capturedAt: values_1.v.number(),
        capturedByTenantUserId: values_1.v.id("tenantUsers"),
        capturedByUserId: values_1.v.id("users"),
    })
        .index("by_consolidationId", ["consolidationId", "capturedAt"])
        .index("by_tenantId_fiscalYear", ["tenantId", "fiscalYear", "capturedAt"]),
    consolidationExports: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        consolidationId: values_1.v.id("consolidations"),
        snapshotId: values_1.v.id("consolidationSnapshots"),
        fiscalYear: values_1.v.string(),
        format: values_1.v.union(values_1.v.literal("xlsx"), values_1.v.literal("audit_xlsx")),
        status: consolidationExportStatusValidator,
        progress: values_1.v.optional(values_1.v.number()),
        generatedByTenantUserId: values_1.v.id("tenantUsers"),
        generatedByUserId: values_1.v.id("users"),
        generatedAt: values_1.v.optional(values_1.v.number()),
        queuedAt: values_1.v.number(),
        processingStartedAt: values_1.v.optional(values_1.v.number()),
        completedAt: values_1.v.optional(values_1.v.number()),
        failedAt: values_1.v.optional(values_1.v.number()),
        storageId: values_1.v.optional(values_1.v.string()),
        downloadUrl: values_1.v.optional(values_1.v.string()),
        safeFileName: values_1.v.string(),
        fileSizeBytes: values_1.v.optional(values_1.v.number()),
        checksum: values_1.v.optional(values_1.v.string()),
        errorMessage: values_1.v.optional(values_1.v.string()),
        downloadCount: values_1.v.number(),
        lastDownloadedAt: values_1.v.optional(values_1.v.number()),
        lastDownloadedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        staleTimeoutAt: values_1.v.number(),
        fileExpiresAt: values_1.v.optional(values_1.v.number()),
        idempotencyKey: values_1.v.string(),
        serviceEventKey: values_1.v.optional(values_1.v.string()),
        serviceJobId: values_1.v.optional(values_1.v.string()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tenantId_fiscalYear", ["tenantId", "fiscalYear", "createdAt"])
        .index("by_consolidationId", ["consolidationId", "createdAt"])
        .index("by_snapshotId", ["snapshotId", "createdAt"])
        .index("by_idempotencyKey", ["idempotencyKey"])
        .index("by_tenantId_status_staleTimeoutAt", [
        "tenantId",
        "status",
        "staleTimeoutAt",
    ]),
    tenantAdminReportJobs: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        requestedByTenantUserId: values_1.v.id("tenantUsers"),
        requestedByUserId: values_1.v.id("users"),
        reportType: tenantAdminReportTypeValidator,
        format: tenantAdminReportFormatValidator,
        status: tenantAdminReportStatusValidator,
        fiscalYear: values_1.v.string(),
        dateFrom: values_1.v.string(),
        dateTo: values_1.v.string(),
        departmentId: values_1.v.union(values_1.v.string(), values_1.v.literal("all")),
        procurementOfficerId: values_1.v.union(values_1.v.string(), values_1.v.literal("all")),
        outputFormat: tenantAdminReportFormatValidator,
        schemaVersion: values_1.v.string(),
        metadata: values_1.v.any(),
        reportName: values_1.v.string(),
        idempotencyKey: values_1.v.string(),
        serviceJobId: values_1.v.optional(values_1.v.string()),
        fileName: values_1.v.optional(values_1.v.string()),
        downloadUrl: values_1.v.optional(values_1.v.string()),
        checksum: values_1.v.optional(values_1.v.string()),
        fileSizeBytes: values_1.v.optional(values_1.v.number()),
        storageId: values_1.v.optional(values_1.v.string()),
        errorMessage: values_1.v.optional(values_1.v.string()),
        retryCount: values_1.v.number(),
        queuedAt: values_1.v.number(),
        staleTimeoutAt: values_1.v.optional(values_1.v.number()),
        readyAt: values_1.v.optional(values_1.v.number()),
        failedAt: values_1.v.optional(values_1.v.number()),
        lastDownloadedAt: values_1.v.optional(values_1.v.number()),
        lastDownloadedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        downloadCount: values_1.v.number(),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tenantId_createdAt", ["tenantId", "createdAt"])
        .index("by_tenantId_reportType_status", ["tenantId", "reportType", "status"])
        .index("by_tenantId_fiscalYear", ["tenantId", "fiscalYear", "createdAt"])
        .index("by_requestedByTenantUserId", ["requestedByTenantUserId", "createdAt"])
        .index("by_serviceJobId", ["serviceJobId"])
        .index("by_idempotencyKey", ["idempotencyKey"]),
    tenantAdminReportSecureLinks: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        reportJobId: values_1.v.id("tenantAdminReportJobs"),
        createdByTenantUserId: values_1.v.id("tenantUsers"),
        tokenHash: values_1.v.string(),
        expiresAt: values_1.v.number(),
        createdAt: values_1.v.number(),
        lastAccessedAt: values_1.v.optional(values_1.v.number()),
        accessCount: values_1.v.number(),
        revokedAt: values_1.v.optional(values_1.v.number()),
    })
        .index("by_tenantId_expiresAt", ["tenantId", "expiresAt"])
        .index("by_reportJobId", ["reportJobId"])
        .index("by_tokenHash", ["tokenHash"]),
    tenantAdminReportSchedules: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        createdByTenantUserId: values_1.v.id("tenantUsers"),
        reportType: values_1.v.union(values_1.v.literal("activity"), values_1.v.literal("budget")),
        cadence: tenantAdminReportScheduleCadenceValidator,
        parameters: values_1.v.any(),
        enabled: values_1.v.boolean(),
        retryCount: values_1.v.number(),
        maxRetries: values_1.v.number(),
        lastRunAt: values_1.v.optional(values_1.v.number()),
        nextRunAt: values_1.v.number(),
        lastFailureAt: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_enabled_nextRunAt", ["enabled", "nextRunAt"])
        .index("by_tenantId_enabled_nextRunAt", ["tenantId", "enabled", "nextRunAt"])
        .index("by_tenantId_reportType", ["tenantId", "reportType"]),
    departmentAccessCodes: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        departmentId: values_1.v.id("departments"),
        codeHash: values_1.v.string(),
        codeSuffix: values_1.v.string(),
        expiresAt: values_1.v.number(),
        isActive: values_1.v.boolean(),
        issuedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        revokedAt: values_1.v.optional(values_1.v.number()),
        revokedByTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        revocationReason: values_1.v.optional(values_1.v.union(values_1.v.literal("deactivated"), values_1.v.literal("rotated"))),
        replacedByAccessCodeId: values_1.v.optional(values_1.v.id("departmentAccessCodes")),
        deliveryAttemptCount: values_1.v.optional(values_1.v.number()),
        lastDeliveryEmail: values_1.v.optional(values_1.v.string()),
        lastDeliveryRequestedAt: values_1.v.optional(values_1.v.number()),
        lastDeliveryQueuedAt: values_1.v.optional(values_1.v.number()),
        lastDeliveredAt: values_1.v.optional(values_1.v.number()),
        lastDeliveryIdempotencyKey: values_1.v.optional(values_1.v.string()),
        lastDeliveryStatus: values_1.v.optional(values_1.v.union(values_1.v.literal("failed"), values_1.v.literal("queued"), values_1.v.literal("sent"))),
        lastDeliveryErrorCode: values_1.v.optional(values_1.v.string()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_tenantId", ["tenantId"])
        .index("by_departmentId", ["departmentId"])
        .index("by_departmentId_isActive", ["departmentId", "isActive"])
        .index("by_codeHash", ["codeHash"])
        .index("by_tenantId_codeHash", ["tenantId", "codeHash"])
        .index("by_tenantId_departmentId", ["tenantId", "departmentId"]),
    departmentAccessCodeEvents: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        departmentId: values_1.v.id("departments"),
        accessCodeId: values_1.v.id("departmentAccessCodes"),
        event: values_1.v.union(values_1.v.literal("deactivated"), values_1.v.literal("email_failed"), values_1.v.literal("email_queued"), values_1.v.literal("issued"), values_1.v.literal("login_denied"), values_1.v.literal("login_success"), values_1.v.literal("rotated")),
        outcome: values_1.v.union(values_1.v.literal("allowed"), values_1.v.literal("blocked"), values_1.v.literal("failed"), values_1.v.literal("queued")),
        occurredAt: values_1.v.number(),
        actorTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        actorUserId: values_1.v.optional(values_1.v.id("users")),
        normalizedEmail: values_1.v.optional(values_1.v.string()),
        requestOriginStatus: values_1.v.union(values_1.v.literal("captured"), values_1.v.literal("unavailable")),
        ipAddress: values_1.v.optional(values_1.v.string()),
        userAgent: values_1.v.optional(values_1.v.string()),
        message: values_1.v.optional(values_1.v.string()),
        metadata: values_1.v.optional(values_1.v.any()),
    })
        .index("by_accessCodeId_occurredAt", ["accessCodeId", "occurredAt"])
        .index("by_departmentId_occurredAt", ["departmentId", "occurredAt"])
        .index("by_tenantId_occurredAt", ["tenantId", "occurredAt"]),
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
    platformMaintenanceWindows: (0, server_1.defineTable)({
        title: values_1.v.string(),
        message: values_1.v.string(),
        startsAt: values_1.v.number(),
        endsAt: values_1.v.number(),
        status: values_1.v.union(values_1.v.literal("scheduled"), values_1.v.literal("active"), values_1.v.literal("completed"), values_1.v.literal("cancelled")),
        createdByPlatformUserId: values_1.v.id("users"),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_status_startsAt", ["status", "startsAt"])
        .index("by_startsAt", ["startsAt"]),
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
        activeTenantId: values_1.v.optional(values_1.v.id("tenants")),
        activeTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        activeTenantRole: values_1.v.optional(values_1.v.union(values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user"))),
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
        tenantAdminDeviceLabel: values_1.v.optional(values_1.v.string()),
        tenantAdminIpCountry: values_1.v.optional(values_1.v.string()),
        tenantAdminUserAgent: values_1.v.optional(values_1.v.string()),
        tenantAdminAuthStage: values_1.v.optional(values_1.v.union(values_1.v.literal("verification_required"), values_1.v.literal("verified"))),
        tenantAdminVerifiedAt: values_1.v.optional(values_1.v.number()),
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
    billingRecords: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        amountCents: values_1.v.number(),
        currency: values_1.v.string(),
        provider: values_1.v.union(values_1.v.literal("stripe"), values_1.v.literal("intasend"), values_1.v.literal("bank_transfer"), values_1.v.literal("custom")),
        paymentReference: values_1.v.string(),
        status: values_1.v.union(values_1.v.literal("pending"), values_1.v.literal("verified"), values_1.v.literal("failed"), values_1.v.literal("refunded")),
        billingCycle: values_1.v.union(values_1.v.literal("monthly"), values_1.v.literal("annual")),
        periodStart: values_1.v.number(),
        periodEnd: values_1.v.number(),
        verifiedAt: values_1.v.optional(values_1.v.number()),
        failedAt: values_1.v.optional(values_1.v.number()),
        gracePeriodEndsAt: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
        metadata: values_1.v.optional(values_1.v.any()),
        invoiceDownloadUrl: values_1.v.optional(values_1.v.string()),
        invoiceGeneratedAt: values_1.v.optional(values_1.v.number()),
    })
        .index("by_tenantId", ["tenantId", "createdAt"])
        .index("by_paymentReference", ["paymentReference"])
        .index("by_status", ["status", "updatedAt"])
        .index("by_provider_status", ["provider", "status", "updatedAt"]),
    tenantSettingsVersions: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        version: values_1.v.number(),
        effectiveFromNextCycle: values_1.v.boolean(),
        fiscalYearStartMonth: values_1.v.number(),
        fiscalYearDisplayFormat: values_1.v.union(values_1.v.literal("FY2025-26"), values_1.v.literal("2025/2026"), values_1.v.literal("custom")),
        fiscalYearCustomFormat: values_1.v.optional(values_1.v.string()),
        complianceTargets: values_1.v.object({
            agpo: values_1.v.number(),
            pwd: values_1.v.number(),
            localContent: values_1.v.number(),
        }),
        allowedEmailDomains: values_1.v.array(values_1.v.string()),
        createdByTenantUserId: values_1.v.id("tenantUsers"),
        createdAt: values_1.v.number(),
    })
        .index("by_tenantId", ["tenantId", "version"])
        .index("by_tenantId_createdAt", ["tenantId", "createdAt"]),
    tenantPendingEmailChanges: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        targetUserId: values_1.v.id("users"),
        targetTenantUserId: values_1.v.id("tenantUsers"),
        requestedByTenantUserId: values_1.v.id("tenantUsers"),
        requestedEmail: values_1.v.string(),
        tokenHash: values_1.v.string(),
        purpose: values_1.v.union(values_1.v.literal("po_email"), values_1.v.literal("tenant_admin_email")),
        status: values_1.v.union(values_1.v.literal("pending"), values_1.v.literal("verified"), values_1.v.literal("cancelled"), values_1.v.literal("expired")),
        expiresAt: values_1.v.number(),
        createdAt: values_1.v.number(),
        completedAt: values_1.v.optional(values_1.v.number()),
    })
        .index("by_tokenHash", ["tokenHash"])
        .index("by_tenantId_targetTenantUserId", ["tenantId", "targetTenantUserId", "createdAt"]),
    tenantAdminSecurityStates: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        tenantUserId: values_1.v.id("tenantUsers"),
        userId: values_1.v.id("users"),
        totpSecretHash: values_1.v.optional(values_1.v.string()),
        totpSecretCiphertext: values_1.v.optional(values_1.v.string()),
        totpSecretIv: values_1.v.optional(values_1.v.string()),
        totpEnrollmentPendingHash: values_1.v.optional(values_1.v.string()),
        isTwoFactorEnrolled: values_1.v.boolean(),
        recoveryCodes: values_1.v.array(values_1.v.object({
            codeHash: values_1.v.string(),
            suffix: values_1.v.string(),
            consumedAt: values_1.v.optional(values_1.v.number()),
        })),
        recoveryCodesAcknowledgedAt: values_1.v.optional(values_1.v.number()),
        failedLoginAttempts: values_1.v.number(),
        lockedUntil: values_1.v.optional(values_1.v.number()),
        passwordChangedAt: values_1.v.optional(values_1.v.number()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    }).index("by_tenantUserId", ["tenantUserId"]),
    tenantSecurityEvents: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        tenantUserId: values_1.v.id("tenantUsers"),
        userId: values_1.v.id("users"),
        event: values_1.v.string(),
        deviceLabel: values_1.v.optional(values_1.v.string()),
        country: values_1.v.optional(values_1.v.string()),
        userAgent: values_1.v.optional(values_1.v.string()),
        timestamp: values_1.v.number(),
    }).index("by_tenantUserId", ["tenantUserId", "timestamp"]),
    tenantAdminTransferRequests: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        initiatedByTenantUserId: values_1.v.id("tenantUsers"),
        recipientTenantUserId: values_1.v.id("tenantUsers"),
        mode: values_1.v.union(values_1.v.literal("voluntary"), values_1.v.literal("platform_override")),
        status: values_1.v.union(values_1.v.literal("pending_acceptance"), values_1.v.literal("completed"), values_1.v.literal("cancelled"), values_1.v.literal("expired")),
        acceptanceTokenHash: values_1.v.string(),
        initiatorConfirmedAt: values_1.v.number(),
        acceptedAt: values_1.v.optional(values_1.v.number()),
        completedAt: values_1.v.optional(values_1.v.number()),
        expiresAt: values_1.v.number(),
        createdAt: values_1.v.number(),
    })
        .index("by_tenantId", ["tenantId", "createdAt"])
        .index("by_acceptanceTokenHash", ["acceptanceTokenHash"]),
    tenantAdminDeletionRequests: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        tenantUserId: values_1.v.id("tenantUsers"),
        requestedByTenantUserId: values_1.v.id("tenantUsers"),
        status: values_1.v.union(values_1.v.literal("requested"), values_1.v.literal("restored"), values_1.v.literal("blocked")),
        recoverUntil: values_1.v.optional(values_1.v.number()),
        requestedAt: values_1.v.number(),
        restoredAt: values_1.v.optional(values_1.v.number()),
    }).index("by_tenantUserId", ["tenantUserId", "requestedAt"]),
    tenantSubscriptionChangeRequests: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        requestedByTenantUserId: values_1.v.id("tenantUsers"),
        fromTier: values_1.v.union(values_1.v.literal("free"), values_1.v.literal("starter"), values_1.v.literal("professional"), values_1.v.literal("enterprise")),
        toTier: values_1.v.union(values_1.v.literal("free"), values_1.v.literal("starter"), values_1.v.literal("professional"), values_1.v.literal("enterprise")),
        changeType: values_1.v.union(values_1.v.literal("upgrade"), values_1.v.literal("downgrade"), values_1.v.literal("enterprise_contact")),
        status: values_1.v.union(values_1.v.literal("pending_provider_confirmation"), values_1.v.literal("scheduled"), values_1.v.literal("blocked"), values_1.v.literal("submitted")),
        effectiveAt: values_1.v.optional(values_1.v.number()),
        prorationAmountCents: values_1.v.optional(values_1.v.number()),
        blockers: values_1.v.optional(values_1.v.array(values_1.v.string())),
        createdAt: values_1.v.number(),
    }).index("by_tenantId", ["tenantId", "createdAt"]),
    tenantSubscriptionReminders: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        idempotencyKey: values_1.v.string(),
        reminderType: values_1.v.union(values_1.v.literal("grace_daily"), values_1.v.literal("renewal_30"), values_1.v.literal("renewal_7"), values_1.v.literal("deletion_review")),
        deliverAt: values_1.v.number(),
        createdAt: values_1.v.number(),
    })
        .index("by_idempotencyKey", ["idempotencyKey"])
        .index("by_tenantId", ["tenantId", "createdAt"]),
    billingReconciliationRecords: (0, server_1.defineTable)({
        tenantId: values_1.v.optional(values_1.v.id("tenants")),
        provider: values_1.v.union(values_1.v.literal("stripe"), values_1.v.literal("intasend"), values_1.v.literal("bank_transfer"), values_1.v.literal("custom")),
        paymentReference: values_1.v.optional(values_1.v.string()),
        action: values_1.v.string(),
        status: values_1.v.union(values_1.v.literal("queued"), values_1.v.literal("processed"), values_1.v.literal("failed"), values_1.v.literal("requires_approval")),
        attempts: values_1.v.number(),
        maxAttempts: values_1.v.number(),
        nextAttemptAt: values_1.v.optional(values_1.v.number()),
        lastError: values_1.v.optional(values_1.v.string()),
        metadata: values_1.v.optional(values_1.v.any()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_provider_status", ["provider", "status", "updatedAt"])
        .index("by_status_nextAttemptAt", ["status", "nextAttemptAt"])
        .index("by_tenantId", ["tenantId", "updatedAt"]),
    billingRefundApprovals: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        billingRecordId: values_1.v.optional(values_1.v.id("billingRecords")),
        amountCents: values_1.v.number(),
        proratedAmountCents: values_1.v.number(),
        currency: values_1.v.string(),
        reason: values_1.v.string(),
        status: values_1.v.union(values_1.v.literal("pending_approval"), values_1.v.literal("approved"), values_1.v.literal("rejected"), values_1.v.literal("processed")),
        requestedByPlatformUserId: values_1.v.id("users"),
        requestedAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
        metadata: values_1.v.optional(values_1.v.any()),
    })
        .index("by_tenantId", ["tenantId", "requestedAt"])
        .index("by_status", ["status", "updatedAt"]),
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
    platformFreeTierReviews: (0, server_1.defineTable)({
        tenantId: values_1.v.id("tenants"),
        upgradeCandidateFirstHitAt: values_1.v.optional(values_1.v.number()),
        salesFollowUp: values_1.v.boolean(),
        salesNotes: values_1.v.optional(values_1.v.string()),
        inactiveFirstDetectedAt: values_1.v.optional(values_1.v.number()),
        abuseFlag: values_1.v.optional(values_1.v.object({
            reason: values_1.v.string(),
            detectedAt: values_1.v.number(),
            reviewedAt: values_1.v.optional(values_1.v.number()),
        })),
        convertedAt: values_1.v.optional(values_1.v.number()),
        convertedByPlatformUserId: values_1.v.optional(values_1.v.id("users")),
        updatedAt: values_1.v.number(),
        updatedByPlatformUserId: values_1.v.id("users"),
    })
        .index("by_tenantId", ["tenantId"])
        .index("by_salesFollowUp", ["salesFollowUp", "updatedAt"])
        .index("by_updatedAt", ["updatedAt"]),
    platformSupportTickets: (0, server_1.defineTable)({
        tenantId: values_1.v.optional(values_1.v.id("tenants")),
        subject: values_1.v.string(),
        description: values_1.v.string(),
        status: values_1.v.union(values_1.v.literal("open"), values_1.v.literal("in_progress"), values_1.v.literal("resolved"), values_1.v.literal("merged")),
        priority: values_1.v.union(values_1.v.literal("low"), values_1.v.literal("normal"), values_1.v.literal("high"), values_1.v.literal("critical")),
        assignedToPlatformUserId: values_1.v.optional(values_1.v.id("users")),
        slaDueAt: values_1.v.number(),
        escalatedAt: values_1.v.optional(values_1.v.number()),
        mergedIntoTicketId: values_1.v.optional(values_1.v.id("platformSupportTickets")),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_status_slaDueAt", ["status", "slaDueAt"])
        .index("by_tenantId", ["tenantId", "updatedAt"])
        .index("by_assignedTo", ["assignedToPlatformUserId", "updatedAt"]),
    platformIncidents: (0, server_1.defineTable)({
        title: values_1.v.string(),
        summary: values_1.v.string(),
        status: values_1.v.union(values_1.v.literal("investigating"), values_1.v.literal("identified"), values_1.v.literal("monitoring"), values_1.v.literal("resolved")),
        severity: values_1.v.union(values_1.v.literal("minor"), values_1.v.literal("major"), values_1.v.literal("critical")),
        statusPageMessage: values_1.v.string(),
        postIncidentReviewDueAt: values_1.v.optional(values_1.v.number()),
        createdByPlatformUserId: values_1.v.id("users"),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_status", ["status", "updatedAt"])
        .index("by_updatedAt", ["updatedAt"]),
    platformAnnouncements: (0, server_1.defineTable)({
        title: values_1.v.string(),
        message: values_1.v.string(),
        targetTenantIds: values_1.v.optional(values_1.v.array(values_1.v.id("tenants"))),
        status: values_1.v.union(values_1.v.literal("draft"), values_1.v.literal("scheduled"), values_1.v.literal("sent"), values_1.v.literal("cancelled")),
        deliverAt: values_1.v.number(),
        createdByPlatformUserId: values_1.v.id("users"),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_status_deliverAt", ["status", "deliverAt"])
        .index("by_deliverAt", ["deliverAt"]),
    platformConfigurationRecords: (0, server_1.defineTable)({
        key: values_1.v.string(),
        value: values_1.v.any(),
        category: values_1.v.union(values_1.v.literal("system"), values_1.v.literal("feature_flag"), values_1.v.literal("pricing"), values_1.v.literal("email_template"), values_1.v.literal("integration")),
        enabled: values_1.v.optional(values_1.v.boolean()),
        rolloutPercentage: values_1.v.optional(values_1.v.number()),
        tenantOverrides: values_1.v.optional(values_1.v.array(values_1.v.id("tenants"))),
        version: values_1.v.number(),
        updatedByPlatformUserId: values_1.v.id("users"),
        updatedAt: values_1.v.number(),
    })
        .index("by_key", ["key"])
        .index("by_category", ["category", "updatedAt"]),
    platformConfigurationVersions: (0, server_1.defineTable)({
        configId: values_1.v.id("platformConfigurationRecords"),
        key: values_1.v.string(),
        value: values_1.v.any(),
        version: values_1.v.number(),
        reason: values_1.v.string(),
        createdByPlatformUserId: values_1.v.id("users"),
        createdAt: values_1.v.number(),
    })
        .index("by_configId", ["configId", "version"])
        .index("by_key", ["key", "version"]),
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
    devEmailMessages: (0, server_1.defineTable)({
        createdAt: values_1.v.number(),
        debugCode: values_1.v.optional(values_1.v.string()),
        debugLink: values_1.v.optional(values_1.v.string()),
        from: values_1.v.string(),
        html: values_1.v.optional(values_1.v.string()),
        idempotencyKey: values_1.v.optional(values_1.v.string()),
        messageType: values_1.v.string(),
        metadata: values_1.v.optional(values_1.v.any()),
        primaryRecipient: values_1.v.string(),
        subject: values_1.v.string(),
        tags: values_1.v.optional(values_1.v.array(values_1.v.object({
            name: values_1.v.string(),
            value: values_1.v.string(),
        }))),
        text: values_1.v.optional(values_1.v.string()),
        to: values_1.v.array(values_1.v.string()),
        transport: values_1.v.literal("dev_inbox"),
    })
        .index("by_createdAt", ["createdAt"])
        .index("by_idempotencyKey", ["idempotencyKey"])
        .index("by_primaryRecipient_createdAt", ["primaryRecipient", "createdAt"]),
});
