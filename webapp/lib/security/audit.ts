export const AUDIT_EVENT_NAMES = {
    securityInputRejected: "security.input_rejected",
    securityOriginBlocked: "security.origin_blocked",
    tenantPlatformReadAllowed: "tenant.platform_read_allowed",
    tenantProbeBlocked: "tenant.probe_blocked",
} as const;

export const AUDIT_OUTCOMES = {
    allowedPlatformBypass: "allowed_platform_bypass",
    blockedDisallowedOrigin: "blocked_disallowed_origin",
    blockedMissingMetadata: "blocked_missing_metadata",
    blockedMissingOrigin: "blocked_missing_origin",
    blockedNotFound: "blocked_not_found",
    rejectedInvalidCode: "rejected_invalid_code",
    rejectedInvalidEmail: "rejected_invalid_email",
    rejectedTooLong: "rejected_too_long",
    rejectedUnsafePlainText: "rejected_unsafe_plain_text",
} as const;

export type AuditEventName =
    (typeof AUDIT_EVENT_NAMES)[keyof typeof AUDIT_EVENT_NAMES];
export type AuditOutcome =
    (typeof AUDIT_OUTCOMES)[keyof typeof AUDIT_OUTCOMES];
export type AuditActorRole =
    | "anonymous"
    | "department_user"
    | "platform_admin"
    | "procurement_officer"
    | "tenant_admin"
    | "unassigned";
export type AuditActorState = "anonymous" | "authenticated";

export interface AuditActor {
    role: AuditActorRole;
    state: AuditActorState;
    userId?: string;
}

export interface AuditEventEntry {
    action: string;
    actor: AuditActor;
    entityType: string;
    event: AuditEventName;
    metadata?: Record<string, unknown>;
    outcome: AuditOutcome;
    recordId?: string;
    sourceTenantId?: string;
    tableName?: string;
    targetTenantId?: string;
    timestamp: number;
}

export interface SerializedAuditEventEntry {
    action: string;
    actorRole: AuditActorRole;
    actorState: AuditActorState;
    actorUserId?: string;
    entityType: string;
    event: AuditEventName;
    metadata?: Record<string, unknown>;
    outcome: AuditOutcome;
    recordId?: string;
    sourceTenantId?: string;
    tableName?: string;
    targetTenantId?: string;
    timestamp: number;
}

export function createAnonymousAuditActor(): AuditActor {
    return {
        role: "anonymous",
        state: "anonymous",
    };
}

export function createAuthenticatedAuditActor(args: {
    role: Exclude<AuditActorRole, "anonymous">;
    userId?: string;
}): AuditActor {
    return {
        role: args.role,
        state: "authenticated",
        userId: args.userId,
    };
}

export function serializeAuditEvent(
    entry: AuditEventEntry,
): SerializedAuditEventEntry {
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

export function buildSecurityInputRejectedEvent(args: {
    actor?: AuditActor;
    field: string;
    flow: string;
    outcome:
        | typeof AUDIT_OUTCOMES.rejectedInvalidCode
        | typeof AUDIT_OUTCOMES.rejectedInvalidEmail
        | typeof AUDIT_OUTCOMES.rejectedTooLong
        | typeof AUDIT_OUTCOMES.rejectedUnsafePlainText;
    path: string;
    reason: string;
    timestamp?: number;
}): AuditEventEntry {
    return {
        action: "validate",
        actor: args.actor ?? createAnonymousAuditActor(),
        entityType: "input",
        event: AUDIT_EVENT_NAMES.securityInputRejected,
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

export function buildBlockedOriginEvent(args: {
    allowedOrigins: readonly string[];
    method: string;
    origin?: string;
    path: string;
    requestOrigin?: string;
    timestamp?: number;
}): AuditEventEntry {
    return {
        action: "origin_check",
        actor: createAnonymousAuditActor(),
        entityType: "http_request",
        event: AUDIT_EVENT_NAMES.securityOriginBlocked,
        metadata: {
            allowedOrigins: [...args.allowedOrigins],
            method: args.method,
            origin: args.origin,
            path: args.path,
            requestOrigin: args.requestOrigin,
        },
        outcome: args.origin
            ? AUDIT_OUTCOMES.blockedDisallowedOrigin
            : AUDIT_OUTCOMES.blockedMissingOrigin,
        timestamp: args.timestamp ?? Date.now(),
    };
}
