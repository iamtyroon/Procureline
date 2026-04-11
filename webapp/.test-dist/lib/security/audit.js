"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBlockedOriginEvent = exports.buildSecurityInputRejectedEvent = exports.serializeAuditEvent = exports.createAuthenticatedAuditActor = exports.createAnonymousAuditActor = exports.AUDIT_OUTCOMES = exports.AUDIT_EVENT_NAMES = void 0;
exports.AUDIT_EVENT_NAMES = {
    accessCodeBulkGenerated: "access_code.bulk_generated",
    accessCodeDeactivated: "access_code.deactivated",
    accessCodeEmailFailed: "access_code.email_failed",
    accessCodeEmailQueued: "access_code.email_queued",
    accessCodeGenerated: "access_code.generated",
    accessCodeRotated: "access_code.rotated",
    catalogExported: "catalog.exported",
    categoryArchived: "category.archived",
    categoryCreated: "category.created",
    categoryDeleted: "category.deleted",
    categoryImported: "category.imported",
    categoryReordered: "category.reordered",
    categoryUpdated: "category.updated",
    itemArchived: "item.archived",
    itemCreated: "item.created",
    itemImported: "item.imported",
    itemMoved: "item.moved",
    itemPriceChanged: "item.price_changed",
    itemUpdated: "item.updated",
    departmentBudgetChanged: "department.budget_changed",
    departmentCreated: "department.created",
    departmentDeleted: "department.deleted",
    departmentUpdated: "department.updated",
    departmentUserChallengeStarted: "du.access_code.challenge_started",
    departmentUserChallengeVerified: "du.access_code.challenge_verified",
    departmentUserCollision: "du.access_code.role_collision",
    departmentUserDataIntegrity: "du.access_code.data_integrity_blocked",
    departmentUserDeactivated: "du.access_code.deactivated",
    departmentUserExpired: "du.access_code.expired",
    departmentUserInvalid: "du.access_code.invalid",
    departmentUserLockedOut: "du.access_code.locked_out",
    departmentUserTenantInactive: "du.access_code.tenant_inactive",
    departmentUserWindowBlocked: "du.access_code.window_blocked",
    platformAdminBackupCodeRejected: "platform_admin.auth.backup_code_rejected",
    platformAdminBackupCodeUsed: "platform_admin.auth.backup_code_used",
    platformAdminChallengeBlocked: "platform_admin.auth.challenge_blocked",
    platformAdminChallengeExpired: "platform_admin.auth.challenge_expired",
    platformAdminChallengeIssued: "platform_admin.auth.challenge_issued",
    platformAdminChallengeRejected: "platform_admin.auth.challenge_rejected",
    platformAdminChallengeVerified: "platform_admin.auth.challenge_verified",
    platformAdminDeletionBlocked: "platform_admin.account.delete_blocked",
    platformAdminNonAdminDenied: "platform_admin.auth.non_admin_denied",
    platformAdminPasswordResetRequired: "platform_admin.auth.password_reset_required",
    platformAdminSessionInitialized: "platform_admin.auth.session_initialized",
    platformAdminSessionRevoked: "platform_admin.session.revoked",
    platformAdminSuspiciousLoginDetected: "platform_admin.auth.suspicious_login_detected",
    procurementOfficerChallengeStarted: "procurement_officer.invitation.challenge_started",
    procurementOfficerChallengeVerified: "procurement_officer.invitation.challenge_verified",
    procurementOfficerInvitationAccepted: "procurement_officer.invitation.accepted",
    procurementOfficerInvitationBounced: "procurement_officer.invitation.bounced",
    procurementOfficerInvitationBlocked: "procurement_officer.invitation.blocked",
    procurementOfficerInvitationIssued: "procurement_officer.invitation.issued",
    procurementOfficerInvitationResent: "procurement_officer.invitation.resent",
    securityInputRejected: "security.input_rejected",
    securityOriginBlocked: "security.origin_blocked",
    tenantAdminInvitationAccepted: "tenant_admin.invitation.accepted",
    tenantAdminInvitationIssued: "tenant_admin.invitation.issued",
    tenantAdminInvitationResent: "tenant_admin.invitation.resent",
    tenantAdminOnboardingBlocked: "tenant_admin.onboarding.blocked",
    tenantAdminOnboardingCompleted: "tenant_admin.onboarding.completed",
    tenantPlatformReadAllowed: "tenant.platform_read_allowed",
    tenantProbeBlocked: "tenant.probe_blocked",
};
exports.AUDIT_OUTCOMES = {
    allowed: "allowed",
    failed: "failed",
    queued: "queued",
    allowedPlatformBypass: "allowed_platform_bypass",
    blockedChallengeExpired: "blocked_challenge_expired",
    blockedDataIntegrity: "blocked_data_integrity",
    blockedDeactivatedDepartmentUser: "blocked_deactivated_department_user",
    blockedDisallowedOrigin: "blocked_disallowed_origin",
    blockedExpiredAccessCode: "blocked_expired_access_code",
    blockedInvalidAccessCode: "blocked_invalid_access_code",
    blockedInvalidInvitation: "blocked_invalid_invitation",
    blockedLockedOut: "blocked_locked_out",
    blockedMissingMetadata: "blocked_missing_metadata",
    blockedMissingOrigin: "blocked_missing_origin",
    blockedNotFound: "blocked_not_found",
    blockedPlatformAdminAccessDenied: "blocked_platform_admin_access_denied",
    blockedPlatformAdminBackupCodeReplay: "blocked_platform_admin_backup_code_replay",
    blockedPlatformAdminChallengeExpired: "blocked_platform_admin_challenge_expired",
    blockedPlatformAdminChallengeLocked: "blocked_platform_admin_challenge_locked",
    blockedPlatformAdminDeletion: "blocked_platform_admin_deletion",
    blockedPlatformAdminPasswordResetRequired: "blocked_platform_admin_password_reset_required",
    blockedRoleCollision: "blocked_role_collision",
    blockedSubmissionWindow: "blocked_submission_window",
    blockedSubscriptionInactive: "blocked_subscription_inactive",
    allowedBackupCode: "allowed_backup_code",
    allowedWithStepUp: "allowed_with_step_up",
    rejectedInvalidCode: "rejected_invalid_code",
    rejectedInvalidEmail: "rejected_invalid_email",
    rejectedTooLong: "rejected_too_long",
    rejectedUnsafePlainText: "rejected_unsafe_plain_text",
};
function createAnonymousAuditActor() {
    return {
        role: "anonymous",
        state: "anonymous",
    };
}
exports.createAnonymousAuditActor = createAnonymousAuditActor;
function createAuthenticatedAuditActor(args) {
    return {
        role: args.role,
        state: "authenticated",
        userId: args.userId,
    };
}
exports.createAuthenticatedAuditActor = createAuthenticatedAuditActor;
function serializeAuditEvent(entry) {
    return {
        action: entry.action,
        actorRole: entry.actor.role,
        actorState: entry.actor.state,
        actorUserId: entry.actor.userId,
        entityType: entry.entityType,
        event: entry.event,
        metadata: entry.metadata,
        outcome: entry.outcome,
        recordId: entry.recordId,
        sourceTenantId: entry.sourceTenantId,
        tableName: entry.tableName,
        targetTenantId: entry.targetTenantId,
        timestamp: entry.timestamp,
    };
}
exports.serializeAuditEvent = serializeAuditEvent;
function buildSecurityInputRejectedEvent(args) {
    return {
        action: "validate",
        actor: args.actor ?? createAnonymousAuditActor(),
        entityType: "input",
        event: exports.AUDIT_EVENT_NAMES.securityInputRejected,
        metadata: {
            field: args.field,
            flow: args.flow,
            path: args.path,
            reason: args.reason,
        },
        outcome: args.outcome,
        timestamp: args.timestamp ?? Date.now(),
    };
}
exports.buildSecurityInputRejectedEvent = buildSecurityInputRejectedEvent;
function buildBlockedOriginEvent(args) {
    return {
        action: "origin_check",
        actor: createAnonymousAuditActor(),
        entityType: "http_request",
        event: exports.AUDIT_EVENT_NAMES.securityOriginBlocked,
        metadata: {
            allowedOrigins: [...args.allowedOrigins],
            method: args.method,
            origin: args.origin,
            path: args.path,
            requestOrigin: args.requestOrigin,
        },
        outcome: args.origin
            ? exports.AUDIT_OUTCOMES.blockedDisallowedOrigin
            : exports.AUDIT_OUTCOMES.blockedMissingOrigin,
        timestamp: args.timestamp ?? Date.now(),
    };
}
exports.buildBlockedOriginEvent = buildBlockedOriginEvent;
