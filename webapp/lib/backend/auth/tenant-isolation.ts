import { AUDIT_EVENT_NAMES } from "@/lib/shared/security/audit";

export const TENANT_SCOPED_TABLES = [
    "departmentAccessCodes",
    "departmentUserAuthChallenges",
    "departmentUserProfiles",
    "departments",
    "tenantUsers",
] as const;
export const TENANT_ROOT_TABLES = ["tenants"] as const;
export const PLATFORM_SCOPED_TABLES = ["platformUsers"] as const;
export const GLOBAL_ONLY_TABLES = ["sessionMetadata", "subscriptionTiers"] as const;

export type TenantScopedTableName = (typeof TENANT_SCOPED_TABLES)[number];
export type TenantRootTableName = (typeof TENANT_ROOT_TABLES)[number];
export type PlatformScopedTableName = (typeof PLATFORM_SCOPED_TABLES)[number];
export type GlobalOnlyTableName = (typeof GLOBAL_ONLY_TABLES)[number];
export type TenantIsolationTableName =
    | TenantScopedTableName
    | TenantRootTableName
    | PlatformScopedTableName
    | GlobalOnlyTableName;

export type TenantIsolationTableClassification =
    | "tenant_root"
    | "tenant_scoped"
    | "platform_scoped"
    | "global";

export const TENANT_ISOLATION_EVENT_NAMES = {
    blockedProbe: AUDIT_EVENT_NAMES.tenantProbeBlocked,
    platformBypassRead: AUDIT_EVENT_NAMES.tenantPlatformReadAllowed,
} as const;

export type TenantIsolationEventName =
    (typeof TENANT_ISOLATION_EVENT_NAMES)[keyof typeof TENANT_ISOLATION_EVENT_NAMES];

export type TenantIsolationOutcome =
    | "allowed_platform_bypass"
    | "blocked_missing_metadata"
    | "blocked_not_found";

export type TenantIsolationActorRole =
    | "anonymous"
    | "platform_admin"
    | "tenant_admin"
    | "procurement_officer"
    | "department_user"
    | "unassigned";

export type TenantIsolationActorScope = "none" | "platform" | "tenant";

export interface TenantIsolationAuditEvent {
    action: string;
    actorRole: Exclude<TenantIsolationActorRole, "anonymous" | "unassigned">;
    actorUserId?: string;
    entityType: string;
    event: TenantIsolationEventName;
    outcome: TenantIsolationOutcome;
    recordId?: string;
    sourceTenantId?: string;
    tableName: string;
    targetTenantId?: string;
    timestamp: number;
}

export interface TenantOwnedRecordLike {
    _id: string;
    tenantId?: string | null;
}

export interface AccessDecisionBase {
    action: string;
    actorRole: TenantIsolationActorRole;
    actorScope: TenantIsolationActorScope;
    actorTenantId?: string;
    actorUserId?: string;
    allowPlatformAdminBypass?: boolean;
    entityType: string;
    recordExists: boolean;
    recordId?: string;
    tableName: string;
    targetTenantId?: string | null;
    timestamp: number;
}

export type TenantAccessDecision =
    | { kind: "allow" }
    | { kind: "allow_with_audit"; auditEvent: TenantIsolationAuditEvent }
    | { kind: "not_found"; auditEvent?: TenantIsolationAuditEvent }
    | { kind: "unauthorized"; message: string };

const CURRENT_TABLE_CLASSIFICATIONS: Record<
    TenantIsolationTableName,
    TenantIsolationTableClassification
> = {
    departmentAccessCodes: "tenant_scoped",
    departmentUserAuthChallenges: "tenant_scoped",
    departmentUserProfiles: "tenant_scoped",
    departments: "tenant_scoped",
    platformUsers: "platform_scoped",
    sessionMetadata: "global",
    subscriptionTiers: "global",
    tenantUsers: "tenant_scoped",
    tenants: "tenant_root",
};

const CANONICAL_TENANT_INDEXES = {
    departmentAccessCodes: {
        byTenant: "by_tenantId",
    },
    departmentUserProfiles: {
        byTenant: "by_tenantId",
    },
    departments: {
        byTenant: "by_tenantId",
    },
    tenantUsers: {
        byTenant: "by_tenantId",
        byUserTenant: "by_userId_tenantId",
    },
} as const;

declare const verifiedTenantRecordIdBrand: unique symbol;

export type VerifiedTenantRecordId<TableName extends string> = string & {
    readonly [verifiedTenantRecordIdBrand]: TableName;
};

export type AccessibleTenantOwnedRecord<
    TableName extends TenantScopedTableName,
    TRecord extends TenantOwnedRecordLike = TenantOwnedRecordLike,
> = TRecord & {
    _id: VerifiedTenantRecordId<TableName>;
    tenantId: string;
};

export function classifyTenantIsolationTable(
    tableName: TenantIsolationTableName,
): TenantIsolationTableClassification {
    return CURRENT_TABLE_CLASSIFICATIONS[tableName];
}

export function getCanonicalTenantIndex<
    TableName extends keyof typeof CANONICAL_TENANT_INDEXES,
    IndexName extends keyof (typeof CANONICAL_TENANT_INDEXES)[TableName],
>(
    tableName: TableName,
    indexName: IndexName,
): (typeof CANONICAL_TENANT_INDEXES)[TableName][IndexName] {
    return CANONICAL_TENANT_INDEXES[tableName][indexName];
}

export function toVerifiedTenantRecordId<TableName extends string>(
    recordId: string,
): VerifiedTenantRecordId<TableName> {
    return recordId as VerifiedTenantRecordId<TableName>;
}

function buildAuditEvent(
    args: AccessDecisionBase,
    event: TenantIsolationEventName,
    outcome: TenantIsolationOutcome,
): TenantIsolationAuditEvent | undefined {
    if (
        args.actorRole === "anonymous" ||
        args.actorRole === "unassigned"
    ) {
        return undefined;
    }

    return {
        action: args.action,
        actorRole: args.actorRole,
        actorUserId: args.actorUserId,
        entityType: args.entityType,
        event,
        outcome,
        recordId: args.recordId,
        sourceTenantId: args.actorTenantId,
        tableName: args.tableName,
        targetTenantId: args.targetTenantId ?? undefined,
        timestamp: args.timestamp,
    };
}

export function resolveTenantRecordAccess(
    args: AccessDecisionBase,
): TenantAccessDecision {
    if (args.actorRole === "anonymous" || args.actorScope === "none") {
        return {
            kind: "unauthorized",
            message: "You must be signed in to access this resource",
        };
    }

    if (args.actorRole === "unassigned") {
        return {
            kind: "unauthorized",
            message: "You do not have an active application role",
        };
    }

    if (args.actorScope === "platform") {
        if (!args.allowPlatformAdminBypass) {
            return {
                kind: "unauthorized",
                message: "Platform administrator access requires an explicit read bypass helper",
            };
        }

        if (!args.recordExists) {
            return { kind: "not_found" };
        }

        return {
            kind: "allow_with_audit",
            auditEvent: buildAuditEvent(
                args,
                TENANT_ISOLATION_EVENT_NAMES.platformBypassRead,
                "allowed_platform_bypass",
            )!,
        };
    }

    if (!args.actorTenantId) {
        return {
            kind: "unauthorized",
            message: "Tenant-scoped access is required for this resource",
        };
    }

    if (!args.recordExists) {
        return { kind: "not_found" };
    }

    if (!args.targetTenantId) {
        return {
            kind: "not_found",
            auditEvent: buildAuditEvent(
                args,
                TENANT_ISOLATION_EVENT_NAMES.blockedProbe,
                "blocked_missing_metadata",
            ),
        };
    }

    if (args.targetTenantId !== args.actorTenantId) {
        return {
            kind: "not_found",
            auditEvent: buildAuditEvent(
                args,
                TENANT_ISOLATION_EVENT_NAMES.blockedProbe,
                "blocked_not_found",
            ),
        };
    }

    return { kind: "allow" };
}

export function sanitizeTenantOwnedRecordsForActor<
    TRecord extends TenantOwnedRecordLike,
>(args: {
    action: string;
    actorRole: Exclude<TenantIsolationActorRole, "anonymous" | "unassigned">;
    actorTenantId: string;
    actorUserId?: string;
    entityType: string;
    records: readonly TRecord[];
    tableName: TenantScopedTableName;
    timestamp: number;
}): {
    auditEvents: TenantIsolationAuditEvent[];
    records: Array<AccessibleTenantOwnedRecord<typeof args.tableName, TRecord>>;
} {
    const auditEvents: TenantIsolationAuditEvent[] = [];
    const records: Array<
        AccessibleTenantOwnedRecord<typeof args.tableName, TRecord>
    > = [];

    for (const record of args.records) {
        const decision = resolveTenantRecordAccess({
            action: args.action,
            actorRole: args.actorRole,
            actorScope: "tenant",
            actorTenantId: args.actorTenantId,
            actorUserId: args.actorUserId,
            entityType: args.entityType,
            recordExists: true,
            recordId: record._id,
            tableName: args.tableName,
            targetTenantId: record.tenantId,
            timestamp: args.timestamp,
        });

        if (decision.kind === "allow") {
            records.push({
                ...record,
                _id: toVerifiedTenantRecordId<typeof args.tableName>(record._id),
                tenantId: record.tenantId!,
            });
            continue;
        }

        if (decision.kind === "not_found" && decision.auditEvent) {
            auditEvents.push(decision.auditEvent);
        }
    }

    return { auditEvents, records };
}

/**
 * Count records that have already been proven accessible for the current
 * tenant actor.
 *
 * The type signature intentionally rejects raw tenant-owned records so the
 * caller must sanitize them first.
 */
export function countAccessibleTenantOwnedRecords<
    TableName extends TenantScopedTableName,
    TRecord extends AccessibleTenantOwnedRecord<TableName>,
>(records: readonly TRecord[]): number {
    return records.length;
}

export function hasAccessibleTenantOwnedRecord<
    TableName extends TenantScopedTableName,
    TRecord extends AccessibleTenantOwnedRecord<TableName>,
>(records: readonly TRecord[], recordId: string): boolean {
    return records.some((record) => record._id === recordId);
}
