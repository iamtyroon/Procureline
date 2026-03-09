"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBlockedOriginEvent = exports.buildSecurityInputRejectedEvent = exports.serializeAuditEvent = exports.createAuthenticatedAuditActor = exports.createAnonymousAuditActor = exports.AUDIT_OUTCOMES = exports.AUDIT_EVENT_NAMES = void 0;
exports.AUDIT_EVENT_NAMES = {
    securityInputRejected: "security.input_rejected",
    securityOriginBlocked: "security.origin_blocked",
    tenantPlatformReadAllowed: "tenant.platform_read_allowed",
    tenantProbeBlocked: "tenant.probe_blocked",
};
exports.AUDIT_OUTCOMES = {
    allowedPlatformBypass: "allowed_platform_bypass",
    blockedDisallowedOrigin: "blocked_disallowed_origin",
    blockedMissingMetadata: "blocked_missing_metadata",
    blockedMissingOrigin: "blocked_missing_origin",
    blockedNotFound: "blocked_not_found",
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
