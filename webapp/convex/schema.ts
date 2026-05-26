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

const planRedraftRequestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("denied"),
  v.literal("cancelled"),
);

const planReviewDecisionTypeValidator = v.union(
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("revision_requested"),
);

const planReviewDecisionLifecycleStatusValidator = v.union(
  v.literal("active"),
  v.literal("superseded"),
  v.literal("undone"),
);

const planReviewDecisionNotificationStatusValidator = v.union(
  v.literal("failed"),
  v.literal("queued"),
);

const planReviewFlaggedTargetValidator = v.object({
  categoryId: v.string(),
  id: v.string(),
  itemId: v.union(v.string(), v.null()),
  label: v.string(),
  type: v.union(v.literal("category"), v.literal("item")),
});

const consolidationStatusValidator = v.union(
  v.literal("draft"),
  v.literal("finalized"),
  v.literal("archived"),
);

const consolidationExportStatusValidator = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("expired"),
);

const tenantAdminReportTypeValidator = v.union(
  v.literal("activity"),
  v.literal("audit"),
  v.literal("budget"),
);

const tenantAdminReportFormatValidator = v.union(
  v.literal("csv"),
  v.literal("xlsx"),
);

const tenantAdminReportStatusValidator = v.union(
  v.literal("failed"),
  v.literal("queued"),
  v.literal("ready"),
);

const tenantAdminReportScheduleCadenceValidator = v.union(
  v.literal("monthly"),
  v.literal("weekly"),
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
      v.literal("pending"),
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
    storageLimitBytes: v.optional(v.number()),
    storageUsedBytes: v.optional(v.number()),
    userLimit: v.optional(v.number()),
    suspendedAt: v.optional(v.number()),
    suspendedByPlatformUserId: v.optional(v.id("users")),
    suspensionReason: v.optional(v.string()),
    restoredAt: v.optional(v.number()),
    restoredByPlatformUserId: v.optional(v.id("users")),
    restoreReason: v.optional(v.string()),
    softDeletedAt: v.optional(v.number()),
    softDeletedByPlatformUserId: v.optional(v.id("users")),
    softDeleteReason: v.optional(v.string()),
    purgeScheduledAt: v.optional(v.number()),
    previousSubdomains: v.optional(v.array(v.string())),
    subscriptionStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("trialing"),
        v.literal("past_due"),
        v.literal("grace_period"),
        v.literal("suspended"),
        v.literal("cancelled"),
      ),
    ),
    subscriptionAmountCents: v.optional(v.number()),
    subscriptionCurrency: v.optional(v.string()),
    subscriptionBillingCycle: v.optional(
      v.union(v.literal("monthly"), v.literal("annual")),
    ),
    subscriptionPaymentMethod: v.optional(
      v.union(
        v.literal("stripe"),
        v.literal("intasend"),
        v.literal("bank_transfer"),
        v.literal("custom"),
      ),
    ),
    subscriptionNextBillingDate: v.optional(v.number()),
    subscriptionGracePeriodEndsAt: v.optional(v.number()),
    subscriptionPendingTier: v.optional(
      v.union(
        v.literal("free"),
        v.literal("starter"),
        v.literal("professional"),
        v.literal("enterprise"),
      ),
    ),
    subscriptionPendingChangeEffectiveAt: v.optional(v.number()),
    subscriptionDeletionReviewAt: v.optional(v.number()),
    subscriptionCustomPriceCents: v.optional(v.number()),
    subscriptionCustomPriceReason: v.optional(v.string()),
    subscriptionCustomPriceUpdatedAt: v.optional(v.number()),
    lastPaymentFailureAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_subdomain", ["subdomain"])
    .index("by_status", ["status"])
    .index("by_tier", ["tier"])
    .index("by_subscriptionStatus", ["subscriptionStatus"])
    .index("by_subscriptionPaymentMethod", ["subscriptionPaymentMethod"])
    .index("by_subscriptionNextBillingDate", ["subscriptionNextBillingDate"]),

  tenantSubdomainRedirects: defineTable({
    tenantId: v.id("tenants"),
    fromSubdomain: v.string(),
    toSubdomain: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    createdByPlatformUserId: v.id("users"),
  })
    .index("by_fromSubdomain", ["fromSubdomain"])
    .index("by_tenantId", ["tenantId", "createdAt"]),

  tenantConfigOverrides: defineTable({
    tenantId: v.id("tenants"),
    key: v.string(),
    value: v.string(),
    reason: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    createdByPlatformUserId: v.id("users"),
  })
    .index("by_tenantId", ["tenantId", "createdAt"])
    .index("by_expiresAt", ["expiresAt"]),

  platformTenantDataExports: defineTable({
    tenantId: v.id("tenants"),
    requestedByPlatformUserId: v.id("users"),
    status: v.union(
      v.literal("queued"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    downloadUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    storageId: v.optional(v.string()),
    fileSizeBytes: v.optional(v.number()),
    requestedAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_tenantId", ["tenantId", "requestedAt"])
    .index("by_status", ["status", "updatedAt"]),

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
    deactivatedAt: v.optional(v.number()),
    deactivatedByTenantUserId: v.optional(v.id("tenantUsers")),
    reactivatedAt: v.optional(v.number()),
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
    voteNumber: v.optional(v.string()),
    normalizedVoteNumber: v.optional(v.string()),
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
    departmentCodeSnapshot: v.optional(v.string()),
    departmentNameSnapshot: v.optional(v.string()),
    submissionReference: v.optional(v.string()),
    submissionSequence: v.optional(v.number()),
    submissionEmailStatus: v.optional(
      v.union(v.literal("failed"), v.literal("queued")),
    ),
    submissionEmailErrorMessage: v.optional(v.string()),
    workspaceVersion: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    submittedAt: v.optional(v.number()),
    reviewStartedAt: v.optional(v.number()),
    reviewStartedByTenantUserId: v.optional(v.id("tenantUsers")),
    reviewStartedByUserId: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    consolidatedAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
    lastApprovedAt: v.optional(v.number()),
    lastApprovedSnapshotId: v.optional(v.id("planSubmissionSnapshots")),
    redraftApprovedAt: v.optional(v.number()),
    redraftApprovedByTenantUserId: v.optional(v.id("tenantUsers")),
    redraftCycle: v.optional(v.number()),
    redraftReason: v.optional(v.string()),
    redraftRequestedAt: v.optional(v.number()),
  })
    .index("by_tenantId", ["tenantId"])
    .index("by_departmentId", ["departmentId"])
    .index("by_departmentId_fiscalYear", ["departmentId", "fiscalYear"])
    .index("by_tenantId_status", ["tenantId", "status"]),

  planReviewDecisions: defineTable({
    tenantId: v.id("tenants"),
    departmentId: v.id("departments"),
    planId: v.id("plans"),
    fiscalYear: v.string(),
    decisionType: planReviewDecisionTypeValidator,
    lifecycleStatus: planReviewDecisionLifecycleStatusValidator,
    comment: v.string(),
    flaggedTargets: v.array(planReviewFlaggedTargetValidator),
    revisionDeadlineAt: v.optional(v.union(v.number(), v.null())),
    decidedAt: v.number(),
    decidedByUserId: v.id("users"),
    decidedByTenantUserId: v.id("tenantUsers"),
    notificationIdempotencyKey: v.optional(v.string()),
    notificationQueuedAt: v.optional(v.number()),
    notificationStatus: v.optional(planReviewDecisionNotificationStatusValidator),
    notificationErrorCode: v.optional(v.string()),
    notificationErrorMessage: v.optional(v.string()),
    undoneAt: v.optional(v.number()),
    undoneByUserId: v.optional(v.id("users")),
    undoneByTenantUserId: v.optional(v.id("tenantUsers")),
    supersededAt: v.optional(v.number()),
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

  planRedraftRequests: defineTable({
    tenantId: v.id("tenants"),
    departmentId: v.id("departments"),
    planId: v.id("plans"),
    fiscalYear: v.string(),
    requestorTenantUserId: v.id("tenantUsers"),
    requestorUserId: v.id("users"),
    reason: v.string(),
    status: planRedraftRequestStatusValidator,
    decisionNote: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    decidedByTenantUserId: v.optional(v.id("tenantUsers")),
    decidedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
    cancelledAt: v.optional(v.number()),
  })
    .index("by_planId_status", ["planId", "status", "updatedAt"])
    .index("by_tenantId_status", ["tenantId", "status", "updatedAt"])
    .index("by_departmentId_status", ["departmentId", "status", "updatedAt"])
    .index("by_tenantId_departmentId_fiscalYear", [
      "tenantId",
      "departmentId",
      "fiscalYear",
    ]),

  planSubmissionSnapshots: defineTable({
    tenantId: v.id("tenants"),
    planId: v.id("plans"),
    departmentId: v.id("departments"),
    fiscalYear: v.string(),
    submissionSequenceKey: v.string(),
    submissionSequence: v.optional(v.number()),
    submissionReference: v.optional(v.string()),
    lifecycleStatus: v.optional(
      v.union(v.literal("active"), v.literal("withdrawn")),
    ),
    submittedAt: v.union(v.number(), v.null()),
    capturedAt: v.number(),
    capturedByUserId: v.id("users"),
    capturedByTenantUserId: v.id("tenantUsers"),
    withdrawnAt: v.optional(v.number()),
    withdrawnByUserId: v.optional(v.id("users")),
    withdrawnByTenantUserId: v.optional(v.id("tenantUsers")),
    departmentCodeSnapshot: v.optional(v.string()),
    departmentNameSnapshot: v.optional(v.string()),
    estimatedBudgetUsed: v.number(),
    itemCount: v.number(),
    selectedCategoryIds: v.array(v.string()),
    categorySummaries: v.array(
      v.object({
        amount: v.number(),
        categoryId: v.string(),
        categoryName: v.string(),
        itemCount: v.number(),
      }),
    ),
    workspaceState: v.optional(blocklyWorkspaceStateValidator),
  })
    .index("by_submissionSequenceKey", ["submissionSequenceKey"])
    .index("by_planId_submittedAt", ["planId", "submittedAt"])
    .index("by_tenantId_departmentId_fiscalYear_capturedAt", [
      "tenantId",
      "departmentId",
      "fiscalYear",
      "capturedAt",
    ]),

  planReviewComments: defineTable({
    tenantId: v.id("tenants"),
    planId: v.id("plans"),
    authorUserId: v.id("users"),
    authorTenantUserId: v.id("tenantUsers"),
    authorNameSnapshot: v.string(),
    body: v.string(),
    createdAt: v.number(),
  })
    .index("by_planId_createdAt", ["planId", "createdAt"])
    .index("by_tenantId_planId_createdAt", ["tenantId", "planId", "createdAt"]),

  consolidations: defineTable({
    tenantId: v.id("tenants"),
    fiscalYear: v.string(),
    status: consolidationStatusValidator,
    draftData: v.any(),
    workspaceState: v.optional(v.any()),
    schemaVersion: v.number(),
    revision: v.number(),
    createdByTenantUserId: v.id("tenantUsers"),
    updatedByTenantUserId: v.id("tenantUsers"),
    finalizedAt: v.optional(v.number()),
    finalizedByTenantUserId: v.optional(v.id("tenantUsers")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId_fiscalYear", ["tenantId", "fiscalYear"])
    .index("by_tenantId_status_fiscalYear", ["tenantId", "status", "fiscalYear"]),

  consolidationSnapshots: defineTable({
    tenantId: v.id("tenants"),
    consolidationId: v.id("consolidations"),
    fiscalYear: v.string(),
    status: v.literal("finalized"),
    schemaVersion: v.number(),
    sourcePlanIds: v.array(v.string()),
    selectedSourceDepartmentIds: v.array(v.string()),
    draftData: v.any(),
    workspaceState: v.optional(v.any()),
    calculatedTotals: v.any(),
    complianceSummary: v.any(),
    notes: v.string(),
    capturedAt: v.number(),
    capturedByTenantUserId: v.id("tenantUsers"),
    capturedByUserId: v.id("users"),
  })
    .index("by_consolidationId", ["consolidationId", "capturedAt"])
    .index("by_tenantId_fiscalYear", ["tenantId", "fiscalYear", "capturedAt"]),

  consolidationExports: defineTable({
    tenantId: v.id("tenants"),
    consolidationId: v.id("consolidations"),
    snapshotId: v.id("consolidationSnapshots"),
    fiscalYear: v.string(),
    format: v.union(v.literal("xlsx"), v.literal("audit_xlsx")),
    status: consolidationExportStatusValidator,
    progress: v.optional(v.number()),
    generatedByTenantUserId: v.id("tenantUsers"),
    generatedByUserId: v.id("users"),
    generatedAt: v.optional(v.number()),
    queuedAt: v.number(),
    processingStartedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    storageId: v.optional(v.string()),
    downloadUrl: v.optional(v.string()),
    safeFileName: v.string(),
    fileSizeBytes: v.optional(v.number()),
    checksum: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    downloadCount: v.number(),
    lastDownloadedAt: v.optional(v.number()),
    lastDownloadedByTenantUserId: v.optional(v.id("tenantUsers")),
    staleTimeoutAt: v.number(),
    fileExpiresAt: v.optional(v.number()),
    idempotencyKey: v.string(),
    serviceEventKey: v.optional(v.string()),
    serviceJobId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
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

  tenantAdminReportJobs: defineTable({
    tenantId: v.id("tenants"),
    requestedByTenantUserId: v.id("tenantUsers"),
    requestedByUserId: v.id("users"),
    reportType: tenantAdminReportTypeValidator,
    format: tenantAdminReportFormatValidator,
    status: tenantAdminReportStatusValidator,
    fiscalYear: v.string(),
    dateFrom: v.string(),
    dateTo: v.string(),
    departmentId: v.union(v.string(), v.literal("all")),
    procurementOfficerId: v.union(v.string(), v.literal("all")),
    outputFormat: tenantAdminReportFormatValidator,
    schemaVersion: v.string(),
    metadata: v.any(),
    reportName: v.string(),
    idempotencyKey: v.string(),
    serviceJobId: v.optional(v.string()),
    fileName: v.optional(v.string()),
    downloadUrl: v.optional(v.string()),
    checksum: v.optional(v.string()),
    fileSizeBytes: v.optional(v.number()),
    storageId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    retryCount: v.number(),
    queuedAt: v.number(),
    staleTimeoutAt: v.optional(v.number()),
    readyAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    lastDownloadedAt: v.optional(v.number()),
    lastDownloadedByTenantUserId: v.optional(v.id("tenantUsers")),
    downloadCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId_createdAt", ["tenantId", "createdAt"])
    .index("by_tenantId_reportType_status", ["tenantId", "reportType", "status"])
    .index("by_tenantId_fiscalYear", ["tenantId", "fiscalYear", "createdAt"])
    .index("by_requestedByTenantUserId", ["requestedByTenantUserId", "createdAt"])
    .index("by_serviceJobId", ["serviceJobId"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  tenantAdminReportSecureLinks: defineTable({
    tenantId: v.id("tenants"),
    reportJobId: v.id("tenantAdminReportJobs"),
    createdByTenantUserId: v.id("tenantUsers"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    lastAccessedAt: v.optional(v.number()),
    accessCount: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_tenantId_expiresAt", ["tenantId", "expiresAt"])
    .index("by_reportJobId", ["reportJobId"])
    .index("by_tokenHash", ["tokenHash"]),

  tenantAdminReportSchedules: defineTable({
    tenantId: v.id("tenants"),
    createdByTenantUserId: v.id("tenantUsers"),
    reportType: v.union(v.literal("activity"), v.literal("budget")),
    cadence: tenantAdminReportScheduleCadenceValidator,
    parameters: v.any(),
    enabled: v.boolean(),
    retryCount: v.number(),
    maxRetries: v.number(),
    lastRunAt: v.optional(v.number()),
    nextRunAt: v.number(),
    lastFailureAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_enabled_nextRunAt", ["enabled", "nextRunAt"])
    .index("by_tenantId_enabled_nextRunAt", ["tenantId", "enabled", "nextRunAt"])
    .index("by_tenantId_reportType", ["tenantId", "reportType"]),

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

  platformMaintenanceWindows: defineTable({
    title: v.string(),
    message: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    createdByPlatformUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_startsAt", ["status", "startsAt"])
    .index("by_startsAt", ["startsAt"]),

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
    tenantAdminDeviceLabel: v.optional(v.string()),
    tenantAdminIpCountry: v.optional(v.string()),
    tenantAdminUserAgent: v.optional(v.string()),
    tenantAdminAuthStage: v.optional(
      v.union(v.literal("verification_required"), v.literal("verified")),
    ),
    tenantAdminVerifiedAt: v.optional(v.number()),
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

  billingRecords: defineTable({
    tenantId: v.id("tenants"),
    amountCents: v.number(),
    currency: v.string(),
    provider: v.union(
      v.literal("stripe"),
      v.literal("intasend"),
      v.literal("bank_transfer"),
      v.literal("custom"),
    ),
    paymentReference: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("verified"),
      v.literal("failed"),
      v.literal("refunded"),
    ),
    billingCycle: v.union(v.literal("monthly"), v.literal("annual")),
    periodStart: v.number(),
    periodEnd: v.number(),
    verifiedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    gracePeriodEndsAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    metadata: v.optional(v.any()),
    invoiceDownloadUrl: v.optional(v.string()),
    invoiceGeneratedAt: v.optional(v.number()),
  })
    .index("by_tenantId", ["tenantId", "createdAt"])
    .index("by_paymentReference", ["paymentReference"])
    .index("by_status", ["status", "updatedAt"])
    .index("by_provider_status", ["provider", "status", "updatedAt"]),

  tenantSettingsVersions: defineTable({
    tenantId: v.id("tenants"),
    version: v.number(),
    effectiveFromNextCycle: v.boolean(),
    fiscalYearStartMonth: v.number(),
    fiscalYearDisplayFormat: v.union(
      v.literal("FY2025-26"),
      v.literal("2025/2026"),
      v.literal("custom"),
    ),
    fiscalYearCustomFormat: v.optional(v.string()),
    complianceTargets: v.object({
      agpo: v.number(),
      pwd: v.number(),
      localContent: v.number(),
    }),
    allowedEmailDomains: v.array(v.string()),
    createdByTenantUserId: v.id("tenantUsers"),
    createdAt: v.number(),
  })
    .index("by_tenantId", ["tenantId", "version"])
    .index("by_tenantId_createdAt", ["tenantId", "createdAt"]),

  tenantPendingEmailChanges: defineTable({
    tenantId: v.id("tenants"),
    targetUserId: v.id("users"),
    targetTenantUserId: v.id("tenantUsers"),
    requestedByTenantUserId: v.id("tenantUsers"),
    requestedEmail: v.string(),
    tokenHash: v.string(),
    purpose: v.union(v.literal("po_email"), v.literal("tenant_admin_email")),
    status: v.union(v.literal("pending"), v.literal("verified"), v.literal("cancelled"), v.literal("expired")),
    expiresAt: v.number(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_tenantId_targetTenantUserId", ["tenantId", "targetTenantUserId", "createdAt"]),

  tenantNotifications: defineTable({
    tenantId: v.id("tenants"),
    recipientTenantUserId: v.id("tenantUsers"),
    recipientUserId: v.id("users"),
    eventKey: v.string(),
    category: v.union(
      v.literal("po_lifecycle"),
      v.literal("submission"),
      v.literal("billing"),
      v.literal("security"),
      v.literal("broadcast"),
    ),
    priority: v.union(v.literal("normal"), v.literal("high"), v.literal("critical")),
    title: v.string(),
    message: v.string(),
    actionTarget: v.optional(
      v.union(
        v.literal("/tenant-admin/po-management"),
        v.literal("/tenant-admin/billing"),
        v.literal("/tenant-admin/security"),
        v.literal("/tenant-admin/notifications"),
      ),
    ),
    emailStatus: v.union(v.literal("not_requested"), v.literal("queued"), v.literal("digest_queued"), v.literal("sent"), v.literal("failed")),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_eventKey", ["eventKey"])
    .index("by_recipientTenantUserId", ["recipientTenantUserId", "createdAt"])
    .index("by_tenantId", ["tenantId", "createdAt"]),

  tenantNotificationPreferences: defineTable({
    tenantId: v.id("tenants"),
    tenantUserId: v.id("tenantUsers"),
    preset: v.union(v.literal("all"), v.literal("critical_only"), v.literal("custom")),
    categories: v.array(
      v.object({
        category: v.union(v.literal("po_lifecycle"), v.literal("submission"), v.literal("billing"), v.literal("security"), v.literal("broadcast")),
        email: v.boolean(),
        inApp: v.boolean(),
      }),
    ),
    updatedAt: v.number(),
  }).index("by_tenantUserId", ["tenantUserId"]),

  tenantNotificationBroadcasts: defineTable({
    tenantId: v.id("tenants"),
    createdByTenantUserId: v.id("tenantUsers"),
    subject: v.string(),
    message: v.string(),
    channels: v.array(v.union(v.literal("email"), v.literal("in_app"))),
    createdAt: v.number(),
  }).index("by_tenantId", ["tenantId", "createdAt"]),

  tenantNotificationDeliveries: defineTable({
    tenantId: v.id("tenants"),
    broadcastId: v.id("tenantNotificationBroadcasts"),
    recipientTenantUserId: v.id("tenantUsers"),
    emailStatus: v.union(v.literal("not_requested"), v.literal("queued"), v.literal("failed")),
    inAppNotificationId: v.optional(v.id("tenantNotifications")),
    createdAt: v.number(),
  }).index("by_broadcastId", ["broadcastId", "createdAt"]),

  tenantAdminSecurityStates: defineTable({
    tenantId: v.id("tenants"),
    tenantUserId: v.id("tenantUsers"),
    userId: v.id("users"),
    totpSecretHash: v.optional(v.string()),
    totpSecretCiphertext: v.optional(v.string()),
    totpSecretIv: v.optional(v.string()),
    totpEnrollmentPendingHash: v.optional(v.string()),
    isTwoFactorEnrolled: v.boolean(),
    recoveryCodes: v.array(v.object({
      codeHash: v.string(),
      suffix: v.string(),
      consumedAt: v.optional(v.number()),
    })),
    recoveryCodesAcknowledgedAt: v.optional(v.number()),
    failedLoginAttempts: v.number(),
    lockedUntil: v.optional(v.number()),
    passwordChangedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tenantUserId", ["tenantUserId"]),

  tenantSecurityEvents: defineTable({
    tenantId: v.id("tenants"),
    tenantUserId: v.id("tenantUsers"),
    userId: v.id("users"),
    event: v.string(),
    deviceLabel: v.optional(v.string()),
    country: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_tenantUserId", ["tenantUserId", "timestamp"]),

  tenantAdminTransferRequests: defineTable({
    tenantId: v.id("tenants"),
    initiatedByTenantUserId: v.id("tenantUsers"),
    recipientTenantUserId: v.id("tenantUsers"),
    mode: v.union(v.literal("voluntary"), v.literal("platform_override")),
    status: v.union(v.literal("pending_acceptance"), v.literal("completed"), v.literal("cancelled"), v.literal("expired")),
    acceptanceTokenHash: v.string(),
    initiatorConfirmedAt: v.number(),
    acceptedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_tenantId", ["tenantId", "createdAt"])
    .index("by_acceptanceTokenHash", ["acceptanceTokenHash"]),

  tenantAdminDeletionRequests: defineTable({
    tenantId: v.id("tenants"),
    tenantUserId: v.id("tenantUsers"),
    requestedByTenantUserId: v.id("tenantUsers"),
    status: v.union(v.literal("requested"), v.literal("restored"), v.literal("blocked")),
    recoverUntil: v.optional(v.number()),
    requestedAt: v.number(),
    restoredAt: v.optional(v.number()),
  }).index("by_tenantUserId", ["tenantUserId", "requestedAt"]),

  tenantSubscriptionChangeRequests: defineTable({
    tenantId: v.id("tenants"),
    requestedByTenantUserId: v.id("tenantUsers"),
    fromTier: v.union(v.literal("free"), v.literal("starter"), v.literal("professional"), v.literal("enterprise")),
    toTier: v.union(v.literal("free"), v.literal("starter"), v.literal("professional"), v.literal("enterprise")),
    changeType: v.union(v.literal("upgrade"), v.literal("downgrade"), v.literal("enterprise_contact")),
    status: v.union(v.literal("pending_provider_confirmation"), v.literal("scheduled"), v.literal("blocked"), v.literal("submitted")),
    effectiveAt: v.optional(v.number()),
    prorationAmountCents: v.optional(v.number()),
    blockers: v.optional(v.array(v.string())),
    createdAt: v.number(),
  }).index("by_tenantId", ["tenantId", "createdAt"]),

  tenantSubscriptionReminders: defineTable({
    tenantId: v.id("tenants"),
    idempotencyKey: v.string(),
    reminderType: v.union(v.literal("grace_daily"), v.literal("renewal_30"), v.literal("renewal_7"), v.literal("deletion_review")),
    deliverAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_tenantId", ["tenantId", "createdAt"]),

  billingReconciliationRecords: defineTable({
    tenantId: v.optional(v.id("tenants")),
    provider: v.union(
      v.literal("stripe"),
      v.literal("intasend"),
      v.literal("bank_transfer"),
      v.literal("custom"),
    ),
    paymentReference: v.optional(v.string()),
    action: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("requires_approval"),
    ),
    attempts: v.number(),
    maxAttempts: v.number(),
    nextAttemptAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_provider_status", ["provider", "status", "updatedAt"])
    .index("by_status_nextAttemptAt", ["status", "nextAttemptAt"])
    .index("by_tenantId", ["tenantId", "updatedAt"]),

  billingRefundApprovals: defineTable({
    tenantId: v.id("tenants"),
    billingRecordId: v.optional(v.id("billingRecords")),
    amountCents: v.number(),
    proratedAmountCents: v.number(),
    currency: v.string(),
    reason: v.string(),
    status: v.union(
      v.literal("pending_approval"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("processed"),
    ),
    requestedByPlatformUserId: v.id("users"),
    requestedAt: v.number(),
    updatedAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_tenantId", ["tenantId", "requestedAt"])
    .index("by_status", ["status", "updatedAt"]),

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

  platformFreeTierReviews: defineTable({
    tenantId: v.id("tenants"),
    upgradeCandidateFirstHitAt: v.optional(v.number()),
    salesFollowUp: v.boolean(),
    salesNotes: v.optional(v.string()),
    inactiveFirstDetectedAt: v.optional(v.number()),
    abuseFlag: v.optional(
      v.object({
        reason: v.string(),
        detectedAt: v.number(),
        reviewedAt: v.optional(v.number()),
      }),
    ),
    convertedAt: v.optional(v.number()),
    convertedByPlatformUserId: v.optional(v.id("users")),
    updatedAt: v.number(),
    updatedByPlatformUserId: v.id("users"),
  })
    .index("by_tenantId", ["tenantId"])
    .index("by_salesFollowUp", ["salesFollowUp", "updatedAt"])
    .index("by_updatedAt", ["updatedAt"]),

  platformSupportTickets: defineTable({
    tenantId: v.optional(v.id("tenants")),
    subject: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("merged"),
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("normal"),
      v.literal("high"),
      v.literal("critical"),
    ),
    assignedToPlatformUserId: v.optional(v.id("users")),
    slaDueAt: v.number(),
    escalatedAt: v.optional(v.number()),
    mergedIntoTicketId: v.optional(v.id("platformSupportTickets")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_slaDueAt", ["status", "slaDueAt"])
    .index("by_tenantId", ["tenantId", "updatedAt"])
    .index("by_assignedTo", ["assignedToPlatformUserId", "updatedAt"]),

  platformIncidents: defineTable({
    title: v.string(),
    summary: v.string(),
    status: v.union(
      v.literal("investigating"),
      v.literal("identified"),
      v.literal("monitoring"),
      v.literal("resolved"),
    ),
    severity: v.union(
      v.literal("minor"),
      v.literal("major"),
      v.literal("critical"),
    ),
    statusPageMessage: v.string(),
    postIncidentReviewDueAt: v.optional(v.number()),
    createdByPlatformUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status", "updatedAt"])
    .index("by_updatedAt", ["updatedAt"]),

  platformAnnouncements: defineTable({
    title: v.string(),
    message: v.string(),
    targetTenantIds: v.optional(v.array(v.id("tenants"))),
    status: v.union(
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("cancelled"),
    ),
    deliverAt: v.number(),
    createdByPlatformUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_deliverAt", ["status", "deliverAt"])
    .index("by_deliverAt", ["deliverAt"]),

  platformConfigurationRecords: defineTable({
    key: v.string(),
    value: v.any(),
    category: v.union(
      v.literal("system"),
      v.literal("feature_flag"),
      v.literal("pricing"),
      v.literal("email_template"),
      v.literal("integration"),
    ),
    enabled: v.optional(v.boolean()),
    rolloutPercentage: v.optional(v.number()),
    tenantOverrides: v.optional(v.array(v.id("tenants"))),
    version: v.number(),
    updatedByPlatformUserId: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_category", ["category", "updatedAt"]),

  platformConfigurationVersions: defineTable({
    configId: v.id("platformConfigurationRecords"),
    key: v.string(),
    value: v.any(),
    version: v.number(),
    reason: v.string(),
    createdByPlatformUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_configId", ["configId", "version"])
    .index("by_key", ["key", "version"]),

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
