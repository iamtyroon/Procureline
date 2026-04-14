import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const blocklyWorkspaceStateValidator = v.object({
  format: v.literal("blockly_json"),
  schemaVersion: v.number(),
  workspaceJson: v.any(),
  editorMetadata: v.object({
    lastSavedAt: v.number(),
    lastSavedByUserId: v.string(),
    recoveredAt: v.union(v.number(), v.null()),
    revision: v.number(),
    saveSource: v.union(
      v.literal("workspace_clear"),
      v.literal("workspace_recovery"),
      v.literal("workspace_seed"),
      v.literal("workspace_sync"),
    ),
  }),
});

const catalogRequestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("denied"),
  v.literal("expired"),
  v.literal("cancelled"),
);

const catalogRequestDecisionSourceValidator = v.union(
  v.literal("deadline"),
  v.literal("du"),
  v.literal("po"),
  v.literal("system"),
);

const catalogRequestOriginValidator = v.union(
  v.literal("standalone"),
  v.literal("item_handoff"),
);

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
    profileComplete: v.boolean(),
    primaryContactName: v.optional(v.string()),
    primaryContactEmail: v.optional(v.string()),
    primaryContactPhone: v.optional(v.string()),
    procurementBudgetCeiling: v.optional(v.number()),
    fiscalYearStartMonth: v.optional(v.number()),
    timeZone: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    onboardingCompletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_subdomain", ["subdomain"])
    .index("by_status", ["status"]),

  tenantAdminInvitations: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    normalizedEmail: v.string(),
    tokenHash: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("revoked"),
    ),
    expiresAt: v.number(),
    resentCount: v.number(),
    createdByPlatformUserId: v.optional(v.id("users")),
    acceptedByUserId: v.optional(v.id("users")),
    acceptedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_tenantId_email", ["tenantId", "normalizedEmail"])
    .index("by_normalizedEmail", ["normalizedEmail", "createdAt"]),

  tenantAdminOnboardingStates: defineTable({
    normalizedEmail: v.string(),
    mode: v.union(v.literal("invite"), v.literal("self_serve")),
    tenantId: v.optional(v.id("tenants")),
    invitationId: v.optional(v.id("tenantAdminInvitations")),
    verificationWindowExpiresAt: v.number(),
    lastVerificationSentAt: v.number(),
    autoResendCount: v.number(),
    manualResendCount: v.number(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_normalizedEmail", ["normalizedEmail", "createdAt"])
    .index("by_invitationId", ["invitationId", "createdAt"]),

  poInvitations: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    normalizedEmail: v.string(),
    fullName: v.string(),
    phone: v.string(),
    inviteTokenHash: v.string(),
    activationCodeHash: v.string(),
    activationCodeSuffix: v.string(),
    issueVersion: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("bounced"),
      v.literal("revoked"),
    ),
    expiresAt: v.number(),
    resentCount: v.number(),
    createdByTenantUserId: v.id("tenantUsers"),
    acceptedByUserId: v.optional(v.id("users")),
    acceptedTenantUserId: v.optional(v.id("tenantUsers")),
    acceptedAt: v.optional(v.number()),
    providerMessageId: v.optional(v.string()),
    lastEmailSentAt: v.optional(v.number()),
    bounceReason: v.optional(v.string()),
    bounceNotifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId", ["tenantId", "createdAt"])
    .index("by_inviteTokenHash", ["inviteTokenHash"])
    .index("by_activationCodeHash", ["activationCodeHash"])
    .index("by_tenantId_email", ["tenantId", "normalizedEmail"])
    .index("by_tenantId_status", ["tenantId", "status", "createdAt"])
    .index("by_normalizedEmail", ["normalizedEmail", "createdAt"]),

  procurementOfficerAuthChallenges: defineTable({
    tenantId: v.id("tenants"),
    invitationId: v.id("poInvitations"),
    normalizedEmail: v.string(),
    authAccountId: v.optional(v.id("authAccounts")),
    authUserId: v.optional(v.id("users")),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_invitationId", ["invitationId", "createdAt"])
    .index("by_normalizedEmail", ["normalizedEmail", "createdAt"])
    .index("by_expiresAt", ["expiresAt"]),

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

  departments: defineTable({
    tenantId: v.id("tenants"),
    procurementOfficerTenantUserId: v.id("tenantUsers"),
    name: v.string(),
    normalizedName: v.string(),
    code: v.string(),
    normalizedCode: v.string(),
    budgetAllocation: v.optional(v.number()),
    isActive: v.boolean(),
    submissionStartsAt: v.optional(v.number()),
    submissionEndsAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    deletedByTenantUserId: v.optional(v.id("tenantUsers")),
    lastBudgetChangedAt: v.optional(v.number()),
    lastBudgetChangedByTenantUserId: v.optional(v.id("tenantUsers")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId", ["tenantId"])
    .index("by_tenantId_isActive", ["tenantId", "isActive"])
    .index("by_tenantId_code", ["tenantId", "code"])
    .index("by_tenantId_normalizedCode", ["tenantId", "normalizedCode"])
    .index("by_tenantId_normalizedName", ["tenantId", "normalizedName"])
    .index("by_procurementOfficerTenantUserId", [
      "procurementOfficerTenantUserId",
    ]),

  submissionDeadlines: defineTable({
    announcementIssuedAt: v.optional(v.number()),
    announcementMessage: v.optional(v.string()),
    announcementTitle: v.optional(v.string()),
    createdAt: v.number(),
    createdByTenantUserId: v.id("tenantUsers"),
    deadlineVersion: v.number(),
    fiscalYearKey: v.string(),
    lastChangeType: v.union(
      v.literal("edited"),
      v.literal("extension"),
      v.literal("initial_setup"),
      v.literal("tightened"),
    ),
    lastExtensionReason: v.optional(v.string()),
    previousSubmissionEndsAt: v.optional(v.number()),
    reminderOffsets: v.array(v.number()),
    scheduledReminderOffsets: v.array(v.number()),
    skippedReminderOffsets: v.array(v.number()),
    submissionEndsAt: v.number(),
    submissionStartsAt: v.number(),
    tenantId: v.id("tenants"),
    timeZone: v.string(),
    updatedAt: v.number(),
    updatedByTenantUserId: v.id("tenantUsers"),
  })
    .index("by_tenantId", ["tenantId", "updatedAt"])
    .index("by_tenantId_fiscalYearKey", ["tenantId", "fiscalYearKey"]),

  submissionDeadlineReminderJobs: defineTable({
    createdAt: v.number(),
    deadlineVersion: v.number(),
    deliverAt: v.number(),
    fiscalYearKey: v.string(),
    idempotencyKey: v.string(),
    jobId: v.optional(v.string()),
    recipientEmail: v.string(),
    reminderOffsetDays: v.number(),
    status: v.union(
      v.literal("cancelled"),
      v.literal("failed"),
      v.literal("scheduled"),
      v.literal("skipped"),
    ),
    statusMessage: v.optional(v.string()),
    submissionDeadlineId: v.id("submissionDeadlines"),
    tenantId: v.id("tenants"),
    updatedAt: v.number(),
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

  procurementCategories: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    normalizedName: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    isActive: v.boolean(),
    archivedAt: v.optional(v.number()),
    archivedByTenantUserId: v.optional(v.id("tenantUsers")),
    sortOrder: v.number(),
    revision: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId", ["tenantId"])
    .index("by_tenantId_isActive", ["tenantId", "isActive"])
    .index("by_tenantId_normalizedName", ["tenantId", "normalizedName"])
    .index("by_tenantId_sortOrder", ["tenantId", "sortOrder"]),

  procurementItems: defineTable({
    tenantId: v.id("tenants"),
    categoryId: v.id("procurementCategories"),
    categoryNameSnapshot: v.optional(v.string()),
    catalogSearchText: v.optional(v.string()),
    name: v.string(),
    normalizedName: v.optional(v.string()),
    description: v.optional(v.string()),
    unitOfMeasurement: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    procurementMethod: v.optional(v.string()),
    sourceOfFunds: v.optional(v.string()),
    minQuantity: v.optional(v.number()),
    maxQuantity: v.optional(v.number()),
    complianceFlags: v.optional(
      v.array(
        v.union(
          v.literal("agpo"),
          v.literal("pwd"),
          v.literal("local_content"),
        ),
      ),
    ),
    sortOrder: v.optional(v.number()),
    isActive: v.boolean(),
    archivedAt: v.optional(v.number()),
    archivedByTenantUserId: v.optional(v.id("tenantUsers")),
    lastPriceChangedAt: v.optional(v.number()),
    lastPriceChangedByTenantUserId: v.optional(v.id("tenantUsers")),
    revision: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
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

  procurementItemPriceHistory: defineTable({
    tenantId: v.id("tenants"),
    itemId: v.id("procurementItems"),
    previousUnitPrice: v.union(v.number(), v.null()),
    nextUnitPrice: v.number(),
    changedAt: v.number(),
    changedByTenantUserId: v.id("tenantUsers"),
  })
    .index("by_itemId_changedAt", ["itemId", "changedAt"])
    .index("by_tenantId_changedAt", ["tenantId", "changedAt"]),

  categoryRequests: defineTable({
    tenantId: v.id("tenants"),
    departmentId: v.id("departments"),
    planId: v.id("plans"),
    fiscalYear: v.string(),
    requestorTenantUserId: v.id("tenantUsers"),
    requestorUserId: v.id("users"),
    name: v.string(),
    normalizedName: v.string(),
    description: v.string(),
    justification: v.string(),
    requesterDuplicateKey: v.string(),
    sharedGroupingKey: v.string(),
    requestOrigin: catalogRequestOriginValidator,
    status: catalogRequestStatusValidator,
    revision: v.number(),
    decisionReason: v.optional(v.string()),
    decisionSource: v.optional(catalogRequestDecisionSourceValidator),
    decisionSnapshot: v.optional(v.any()),
    decisionNotificationDeliverAt: v.optional(v.number()),
    decisionNotificationErrorCode: v.optional(v.string()),
    decisionNotificationErrorMessage: v.optional(v.string()),
    decisionNotificationIdempotencyKey: v.optional(v.string()),
    decisionNotificationQueuedAt: v.optional(v.number()),
    decisionNotificationStatus: v.optional(
      v.union(
        v.literal("cancelled"),
        v.literal("failed"),
        v.literal("queued"),
      ),
    ),
    denialUndoDeadlineAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()),
    reviewedByTenantUserId: v.optional(v.id("tenantUsers")),
    linkedCatalogCategoryId: v.optional(v.id("procurementCategories")),
    createdAt: v.number(),
    updatedAt: v.number(),
    cancelledAt: v.optional(v.number()),
    submittedAt: v.number(),
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

  itemRequests: defineTable({
    tenantId: v.id("tenants"),
    departmentId: v.id("departments"),
    planId: v.id("plans"),
    fiscalYear: v.string(),
    requestorTenantUserId: v.id("tenantUsers"),
    requestorUserId: v.id("users"),
    name: v.string(),
    normalizedName: v.string(),
    description: v.string(),
    justification: v.string(),
    estimatedUnitPrice: v.number(),
    categoryId: v.optional(v.id("procurementCategories")),
    categoryNameSnapshot: v.string(),
    normalizedCategoryName: v.string(),
    categoryReferenceKey: v.string(),
    linkedCategoryRequestId: v.optional(v.id("categoryRequests")),
    requesterDuplicateKey: v.string(),
    sharedGroupingKey: v.string(),
    status: catalogRequestStatusValidator,
    revision: v.number(),
    decisionReason: v.optional(v.string()),
    decisionSource: v.optional(catalogRequestDecisionSourceValidator),
    decisionSnapshot: v.optional(v.any()),
    decisionNotificationDeliverAt: v.optional(v.number()),
    decisionNotificationErrorCode: v.optional(v.string()),
    decisionNotificationErrorMessage: v.optional(v.string()),
    decisionNotificationIdempotencyKey: v.optional(v.string()),
    decisionNotificationQueuedAt: v.optional(v.number()),
    decisionNotificationStatus: v.optional(
      v.union(
        v.literal("cancelled"),
        v.literal("failed"),
        v.literal("queued"),
      ),
    ),
    denialUndoDeadlineAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()),
    reviewedByTenantUserId: v.optional(v.id("tenantUsers")),
    linkedCatalogItemId: v.optional(v.id("procurementItems")),
    createdAt: v.number(),
    updatedAt: v.number(),
    cancelledAt: v.optional(v.number()),
    submittedAt: v.number(),
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

  plans: defineTable({
    tenantId: v.id("tenants"),
    departmentId: v.id("departments"),
    fiscalYear: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("rejected"),
      v.literal("approved"),
    ),
    itemCount: v.number(),
    estimatedBudgetUsed: v.number(),
    selectedCategoryIds: v.array(v.id("procurementCategories")),
    categorySummaries: v.array(
      v.object({
        categoryId: v.id("procurementCategories"),
        categoryName: v.string(),
        amount: v.number(),
        itemCount: v.number(),
      }),
    ),
    workspaceState: v.optional(blocklyWorkspaceStateValidator),
    rejectionComment: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    submittedAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
  })
    .index("by_tenantId", ["tenantId"])
    .index("by_departmentId", ["departmentId"])
    .index("by_departmentId_fiscalYear", ["departmentId", "fiscalYear"])
    .index("by_tenantId_status", ["tenantId", "status"]),

  departmentAccessCodes: defineTable({
    tenantId: v.id("tenants"),
    departmentId: v.id("departments"),
    codeHash: v.string(),
    codeSuffix: v.string(),
    expiresAt: v.number(),
    isActive: v.boolean(),
    issuedByTenantUserId: v.optional(v.id("tenantUsers")),
    revokedAt: v.optional(v.number()),
    revokedByTenantUserId: v.optional(v.id("tenantUsers")),
    revocationReason: v.optional(
      v.union(v.literal("deactivated"), v.literal("rotated")),
    ),
    replacedByAccessCodeId: v.optional(v.id("departmentAccessCodes")),
    deliveryAttemptCount: v.optional(v.number()),
    lastDeliveryEmail: v.optional(v.string()),
    lastDeliveryRequestedAt: v.optional(v.number()),
    lastDeliveryQueuedAt: v.optional(v.number()),
    lastDeliveredAt: v.optional(v.number()),
    lastDeliveryIdempotencyKey: v.optional(v.string()),
    lastDeliveryStatus: v.optional(
      v.union(v.literal("failed"), v.literal("queued"), v.literal("sent")),
    ),
    lastDeliveryErrorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId", ["tenantId"])
    .index("by_departmentId", ["departmentId"])
    .index("by_departmentId_isActive", ["departmentId", "isActive"])
    .index("by_codeHash", ["codeHash"])
    .index("by_tenantId_codeHash", ["tenantId", "codeHash"])
    .index("by_tenantId_departmentId", ["tenantId", "departmentId"]),

  departmentAccessCodeEvents: defineTable({
    tenantId: v.id("tenants"),
    departmentId: v.id("departments"),
    accessCodeId: v.id("departmentAccessCodes"),
    event: v.union(
      v.literal("deactivated"),
      v.literal("email_failed"),
      v.literal("email_queued"),
      v.literal("issued"),
      v.literal("login_denied"),
      v.literal("login_success"),
      v.literal("rotated"),
    ),
    outcome: v.union(
      v.literal("allowed"),
      v.literal("blocked"),
      v.literal("failed"),
      v.literal("queued"),
    ),
    occurredAt: v.number(),
    actorTenantUserId: v.optional(v.id("tenantUsers")),
    actorUserId: v.optional(v.id("users")),
    normalizedEmail: v.optional(v.string()),
    requestOriginStatus: v.union(
      v.literal("captured"),
      v.literal("unavailable"),
    ),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    message: v.optional(v.string()),
    metadata: v.optional(v.any()),
  })
    .index("by_accessCodeId_occurredAt", ["accessCodeId", "occurredAt"])
    .index("by_departmentId_occurredAt", ["departmentId", "occurredAt"])
    .index("by_tenantId_occurredAt", ["tenantId", "occurredAt"]),

  departmentUserProfiles: defineTable({
    tenantId: v.id("tenants"),
    tenantUserId: v.id("tenantUsers"),
    departmentId: v.id("departments"),
    normalizedEmail: v.string(),
    isActive: v.boolean(),
    deactivatedAt: v.optional(v.number()),
    lastAuthenticatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId", ["tenantId"])
    .index("by_tenantUserId", ["tenantUserId"])
    .index("by_departmentId_email", ["departmentId", "normalizedEmail"])
    .index("by_tenantId_email", ["tenantId", "normalizedEmail"]),

  departmentUserLoginAttempts: defineTable({
    normalizedEmail: v.string(),
    accessCodeHash: v.string(),
    accessCodeId: v.optional(v.id("departmentAccessCodes")),
    failedAttempts: v.number(),
    lockedUntil: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email_accessCodeHash", ["normalizedEmail", "accessCodeHash"])
    .index("by_accessCodeId", ["accessCodeId"]),

  departmentUserAuthChallenges: defineTable({
    tenantId: v.id("tenants"),
    departmentId: v.id("departments"),
    accessCodeId: v.id("departmentAccessCodes"),
    normalizedEmail: v.string(),
    accessMode: v.union(v.literal("editable"), v.literal("read_only_grace")),
    authAccountId: v.optional(v.id("authAccounts")),
    authUserId: v.optional(v.id("users")),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_normalizedEmail", ["normalizedEmail", "createdAt"])
    .index("by_accessCodeId", ["accessCodeId", "createdAt"])
    .index("by_expiresAt", ["expiresAt"]),

  platformUsers: defineTable({
    userId: v.id("users"),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_isActive", ["userId", "isActive"]),

  platformAdminSecurityStates: defineTable({
    userId: v.id("users"),
    enrollmentEmail: v.optional(v.string()),
    isTwoFactorEnrolled: v.boolean(),
    backupCodes: v.array(
      v.object({
        codeHash: v.string(),
        suffix: v.string(),
        createdAt: v.number(),
        consumedAt: v.optional(v.number()),
      }),
    ),
    lastTrustedAt: v.optional(v.number()),
    lastTrustedCountry: v.optional(v.string()),
    lastTrustedIpHash: v.optional(v.string()),
    lastTrustedUserAgentHash: v.optional(v.string()),
    passwordResetCompletionTokenHash: v.optional(v.string()),
    passwordResetCompletionTokenIssuedAt: v.optional(v.number()),
    passwordResetRequiredAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  platformAdminPreferences: defineTable({
    userId: v.id("users"),
    alertSeverityFilter: v.union(
      v.literal("all"),
      v.literal("warning"),
      v.literal("critical"),
    ),
    hiddenWidgetIds: v.array(
      v.union(
        v.literal("recent_tenants"),
        v.literal("system_health"),
        v.literal("recent_alerts"),
      ),
    ),
    sidebarCollapsed: v.boolean(),
    widgetOrder: v.array(
      v.union(
        v.literal("recent_tenants"),
        v.literal("system_health"),
        v.literal("recent_alerts"),
      ),
    ),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  platformHealthSnapshots: defineTable({
    capturedAt: v.number(),
    summaryState: v.optional(
      v.union(
        v.literal("healthy"),
        v.literal("warning"),
        v.literal("critical"),
      ),
    ),
    api: v.optional(
      v.object({
        state: v.union(
          v.literal("healthy"),
          v.literal("warning"),
          v.literal("critical"),
        ),
        detail: v.optional(v.string()),
      }),
    ),
    database: v.optional(
      v.object({
        state: v.union(
          v.literal("healthy"),
          v.literal("warning"),
          v.literal("critical"),
        ),
        detail: v.optional(v.string()),
      }),
    ),
    jobs: v.optional(
      v.object({
        state: v.union(
          v.literal("healthy"),
          v.literal("warning"),
          v.literal("critical"),
        ),
        detail: v.optional(v.string()),
      }),
    ),
    storage: v.optional(
      v.object({
        state: v.union(
          v.literal("healthy"),
          v.literal("warning"),
          v.literal("critical"),
        ),
        detail: v.optional(v.string()),
      }),
    ),
    email: v.optional(
      v.object({
        state: v.union(
          v.literal("healthy"),
          v.literal("warning"),
          v.literal("critical"),
        ),
        detail: v.optional(v.string()),
      }),
    ),
  }).index("by_capturedAt", ["capturedAt"]),

  platformAdminChallenges: defineTable({
    userId: v.id("users"),
    sessionId: v.id("authSessions"),
    purpose: v.union(v.literal("setup"), v.literal("verify")),
    codeHash: v.string(),
    deliveryEmail: v.string(),
    riskLevel: v.union(v.literal("normal"), v.literal("suspicious")),
    riskReasons: v.array(
      v.union(
        v.literal("country_changed"),
        v.literal("ip_changed"),
        v.literal("user_agent_changed"),
      ),
    ),
    failedAttempts: v.number(),
    lockedUntil: v.optional(v.number()),
    sentAt: v.number(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    ipAddress: v.optional(v.string()),
    ipCountry: v.optional(v.string()),
    ipRegion: v.optional(v.string()),
    ipCity: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId", "createdAt"])
    .index("by_sessionId", ["sessionId", "createdAt"])
    .index("by_userId_sessionId_purpose", ["userId", "sessionId", "purpose"])
    .index("by_expiresAt", ["expiresAt"]),

  sessionMetadata: defineTable({
    sessionId: v.id("authSessions"),
    userId: v.id("users"),
    rememberMe: v.boolean(),
    lastActivityAt: v.number(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
    loggedOutAt: v.optional(v.number()),
    activeTenantId: v.optional(v.id("tenants")),
    activeTenantUserId: v.optional(v.id("tenantUsers")),
    activeTenantRole: v.optional(
      v.union(
        v.literal("tenant_admin"),
        v.literal("procurement_officer"),
        v.literal("department_user"),
      ),
    ),
    isPlatformAdminSession: v.optional(v.boolean()),
    platformAdminAuthStage: v.optional(
      v.union(
        v.literal("setup_required"),
        v.literal("verification_required"),
        v.literal("verified"),
        v.literal("reset_required"),
      ),
    ),
    platformAdminChallengeId: v.optional(v.id("platformAdminChallenges")),
    platformAdminRiskLevel: v.optional(
      v.union(v.literal("normal"), v.literal("suspicious")),
    ),
    platformAdminRiskReasons: v.optional(
      v.array(
        v.union(
          v.literal("country_changed"),
          v.literal("ip_changed"),
          v.literal("user_agent_changed"),
        ),
      ),
    ),
    platformAdminVerifiedAt: v.optional(v.number()),
    platformAdminTrustedAt: v.optional(v.number()),
    platformAdminVerificationMethod: v.optional(
      v.union(v.literal("email_otp"), v.literal("backup_code")),
    ),
    platformAdminRevocationReason: v.optional(v.string()),
    platformAdminIpAddress: v.optional(v.string()),
    platformAdminIpCountry: v.optional(v.string()),
    platformAdminIpRegion: v.optional(v.string()),
    platformAdminIpCity: v.optional(v.string()),
    platformAdminUserAgent: v.optional(v.string()),
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
    actorState: v.union(v.literal("anonymous"), v.literal("authenticated")),
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
    .index("by_sourceTenantId", ["sourceTenantId", "timestamp"])
    .index("by_targetTenantId", ["targetTenantId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  externalServiceSyncEvents: defineTable({
    actorRole: v.optional(v.string()),
    actorTenantId: v.optional(v.id("tenants")),
    actorUserId: v.optional(v.id("users")),
    claimedAt: v.number(),
    durableChanges: v.array(v.any()),
    eventKey: v.string(),
    eventType: v.string(),
    lastError: v.optional(
      v.object({
        code: v.string(),
        message: v.string(),
      }),
    ),
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

  devEmailMessages: defineTable({
    createdAt: v.number(),
    debugCode: v.optional(v.string()),
    debugLink: v.optional(v.string()),
    from: v.string(),
    html: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    messageType: v.string(),
    metadata: v.optional(v.any()),
    primaryRecipient: v.string(),
    subject: v.string(),
    tags: v.optional(
      v.array(
        v.object({
          name: v.string(),
          value: v.string(),
        }),
      ),
    ),
    text: v.optional(v.string()),
    to: v.array(v.string()),
    transport: v.literal("dev_inbox"),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_primaryRecipient_createdAt", ["primaryRecipient", "createdAt"]),
});
