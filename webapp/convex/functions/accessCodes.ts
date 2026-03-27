import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
    action,
    internalMutation,
    mutation,
    query,
    type ActionCtx,
    type MutationCtx,
    type QueryCtx,
} from "../_generated/server";
import {
    getDepartmentUserAccessCodeSuffix,
    hashDepartmentUserAccessCode,
    normalizeDepartmentUserAccessCode,
} from "../../lib/auth/department-user-access";
import {
    ACCESS_CODE_DEACTIVATED_MESSAGE,
    ACCESS_CODE_DELIVERY_GENERIC_ERROR_MESSAGE,
    ACCESS_CODE_EXPIRATION_PAST_MESSAGE,
    ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE,
    ACCESS_CODE_LOGIN_URL_PATH,
    ACCESS_CODE_NO_ELIGIBLE_BULK_MESSAGE,
    ACCESS_CODE_NOT_FOUND_MESSAGE,
    ACCESS_CODE_SYNC_REPAIR_REQUIRED_MESSAGE,
    buildCanonicalDepartmentAccessCode,
    buildAbsoluteAccessCodeLoginUrl,
    deriveAccessCodeExpirationDefault,
    mapAccessCodeDeliveryStatusLabel,
    maskCanonicalDepartmentAccessCode,
    normalizeCanonicalDepartmentAccessCode,
    selectDepartmentsForBulkAccessCodeGeneration,
    validateAccessCodeExpiration,
    type AccessCodeDeliveryStatus,
} from "../../lib/procurement-officer/access-codes";
import { normalizeDepartmentCode } from "../../lib/procurement-officer/departments";
import {
    AUDIT_EVENT_NAMES,
    AUDIT_OUTCOMES,
    createAuthenticatedAuditActor,
    type AuditEventName,
} from "../../lib/security/audit";
import { normalizeAuthEmail, validateEmailInput } from "../../lib/security/input";
import { appendAuditLogRequired } from "./_audit";
import { requireTenantRole } from "./_roleGuard";
import { getCurrentTenantUserMembership } from "./_tenantGuard";
import { getServiceActorContext } from "../actions/_helpers";

type AccessCodeRecord = Doc<"departmentAccessCodes">;
type DepartmentRecord = Doc<"departments">;

export interface AccessCodeEventRequestOrigin {
    ipAddress?: string | null;
    requestOriginStatus: "captured" | "unavailable";
    userAgent?: string | null;
}

function isActiveDepartment(department: DepartmentRecord): boolean {
    return department.isActive && department.deletedAt === undefined;
}

function isUsableAccessCode(
    accessCode: Pick<AccessCodeRecord, "expiresAt" | "isActive">,
    now: number,
): boolean {
    return accessCode.isActive && accessCode.expiresAt > now;
}

function formatAccessCodeDateTime(timestamp: number | null | undefined): string | null {
    if (typeof timestamp !== "number") {
        return null;
    }

    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(timestamp));
}

function createAccessCodeAuditEntry(args: {
    action: string;
    actorUserId: Id<"users">;
    event: AuditEventName;
    metadata?: Record<string, unknown>;
    outcome: string;
    recordId?: string;
    tenantId: Id<"tenants">;
}): Parameters<typeof appendAuditLogRequired>[1] {
    return {
        action: args.action,
        actor: createAuthenticatedAuditActor({
            role: "procurement_officer",
            userId: String(args.actorUserId),
        }),
        entityType: "access_code",
        event: args.event,
        metadata: args.metadata,
        outcome: args.outcome as any,
        recordId: args.recordId,
        sourceTenantId: String(args.tenantId),
        tableName: "departmentAccessCodes",
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    };
}

export async function appendDepartmentAccessCodeEventBestEffort(
    ctx: MutationCtx,
    args: {
        accessCodeId: Id<"departmentAccessCodes">;
        actorTenantUserId?: Id<"tenantUsers">;
        actorUserId?: Id<"users">;
        departmentId: Id<"departments">;
        event:
            | "deactivated"
            | "email_failed"
            | "email_queued"
            | "issued"
            | "login_denied"
            | "login_success"
            | "rotated";
        message?: string;
        metadata?: Record<string, unknown>;
        normalizedEmail?: string;
        outcome: "allowed" | "blocked" | "failed" | "queued";
        requestOrigin?: AccessCodeEventRequestOrigin;
        tenantId: Id<"tenants">;
    },
): Promise<void> {
    try {
        await ctx.db.insert("departmentAccessCodeEvents", {
            accessCodeId: args.accessCodeId,
            actorTenantUserId: args.actorTenantUserId,
            actorUserId: args.actorUserId,
            departmentId: args.departmentId,
            event: args.event,
            ipAddress: args.requestOrigin?.ipAddress ?? undefined,
            message: args.message,
            metadata: args.metadata,
            normalizedEmail: args.normalizedEmail,
            occurredAt: Date.now(),
            outcome: args.outcome,
            requestOriginStatus:
                args.requestOrigin?.requestOriginStatus ?? "unavailable",
            tenantId: args.tenantId,
            userAgent: args.requestOrigin?.userAgent ?? undefined,
        });
    } catch {
        // History is append-only but must remain non-blocking for auth and bridge flows.
    }
}

export const appendDepartmentAccessCodeEventFromAction = internalMutation({
    args: {
        accessCodeId: v.id("departmentAccessCodes"),
        actorTenantUserId: v.optional(v.id("tenantUsers")),
        actorUserId: v.optional(v.id("users")),
        departmentId: v.id("departments"),
        event: v.union(
            v.literal("deactivated"),
            v.literal("email_failed"),
            v.literal("email_queued"),
            v.literal("issued"),
            v.literal("login_denied"),
            v.literal("login_success"),
            v.literal("rotated"),
        ),
        ipAddress: v.optional(v.string()),
        message: v.optional(v.string()),
        metadata: v.optional(v.any()),
        normalizedEmail: v.optional(v.string()),
        outcome: v.union(
            v.literal("allowed"),
            v.literal("blocked"),
            v.literal("failed"),
            v.literal("queued"),
        ),
        requestOriginStatus: v.union(
            v.literal("captured"),
            v.literal("unavailable"),
        ),
        tenantId: v.id("tenants"),
        userAgent: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        await appendDepartmentAccessCodeEventBestEffort(ctx, {
            accessCodeId: args.accessCodeId,
            actorTenantUserId: args.actorTenantUserId,
            actorUserId: args.actorUserId,
            departmentId: args.departmentId,
            event: args.event,
            message: args.message,
            metadata: args.metadata,
            normalizedEmail: args.normalizedEmail,
            outcome: args.outcome,
            requestOrigin: {
                ipAddress: args.ipAddress,
                requestOriginStatus: args.requestOriginStatus,
                userAgent: args.userAgent,
            },
            tenantId: args.tenantId,
        });

        return null;
    },
});

async function loadProcurementOfficerMutationContext(ctx: MutationCtx) {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    const [tenant, tenantUser] = await Promise.all([
        ctx.db.get(authContext.tenantId),
        getCurrentTenantUserMembership(ctx),
    ]);

    if (!tenant) {
        throw new ConvexError({
            code: "NOT_FOUND",
            message: "Tenant record not found",
        });
    }

    if (!tenantUser || tenantUser.role !== "procurement_officer" || !tenantUser.isActive) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for this resource.",
        });
    }

    return {
        authContext,
        tenant,
        tenantUser,
    };
}

async function loadProcurementOfficerQueryContext(ctx: QueryCtx) {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    const tenant = await ctx.db.get(authContext.tenantId);

    if (!tenant) {
        throw new ConvexError({
            code: "NOT_FOUND",
            message: "Tenant record not found",
        });
    }

    return {
        authContext,
        tenant,
    };
}

async function loadProcurementOfficerActionContext(ctx: ActionCtx) {
    const actor = await getServiceActorContext(ctx);
    if (actor.role !== "procurement_officer" || !actor.tenantId) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for this resource.",
        });
    }

    const tenantUser: {
        _id: Id<"tenantUsers">;
        isActive: boolean;
        role: "department_user" | "procurement_officer" | "tenant_admin";
        tenantId: Id<"tenants">;
        userId: Id<"users">;
    } = await ctx.runQuery("functions/users:getCurrentUserTenant" as any, {});

    if (tenantUser.role !== "procurement_officer" || !tenantUser.isActive) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for this resource.",
        });
    }

    return {
        actor,
        tenantUser,
    };
}

async function getTenantDepartmentOrThrow(
    ctx: MutationCtx | QueryCtx,
    args: {
        departmentId: Id<"departments">;
        tenantId: Id<"tenants">;
    },
): Promise<DepartmentRecord> {
    const department = await ctx.db.get(args.departmentId);

    if (!department || department.tenantId !== args.tenantId || !isActiveDepartment(department)) {
        throw new ConvexError({
            code: "NOT_FOUND",
            message: "Department not found",
        });
    }

    return department;
}

async function loadDepartmentAccessCodes(
    ctx: MutationCtx | QueryCtx,
    departmentId: Id<"departments">,
): Promise<AccessCodeRecord[]> {
    return await ctx.db
        .query("departmentAccessCodes")
        .withIndex("by_departmentId", (q) => q.eq("departmentId", departmentId))
        .collect();
}

async function buildUniqueCanonicalAccessCode(args: {
    ctx: MutationCtx;
    department: DepartmentRecord;
    tenantId: Id<"tenants">;
}): Promise<{
    code: string;
    codeHash: string;
    codeSuffix: string;
}> {
    const [departmentAccessCodes, departments] = await Promise.all([
        args.ctx.db
            .query("departmentAccessCodes")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
            .collect(),
        args.ctx.db
            .query("departments")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
            .collect(),
    ]);
    const existingCodeHashes = new Set(
        departmentAccessCodes.map((accessCode) => accessCode.codeHash),
    );
    const existingDepartmentCodes = new Set(
        departments
            .filter(isActiveDepartment)
            .map((department) => normalizeDepartmentCode(department.code)),
    );

    for (let attempt = 0; attempt < 25; attempt += 1) {
        const code = buildCanonicalDepartmentAccessCode({
            departmentName: args.department.name,
        });
        const normalizedCode = normalizeDepartmentUserAccessCode(code);
        const codeHash = await hashDepartmentUserAccessCode(normalizedCode);

        if (
            !existingCodeHashes.has(codeHash) &&
            !existingDepartmentCodes.has(normalizeDepartmentCode(code))
        ) {
            return {
                code,
                codeHash,
                codeSuffix: getDepartmentUserAccessCodeSuffix(normalizedCode),
            };
        }
    }

    throw new ConvexError({
        code: "INVALID_STATE",
        message: "We could not issue a unique access code right now.",
    });
}

async function doesDepartmentCodeMatchAccessCode(args: {
    accessCode: Pick<AccessCodeRecord, "codeHash">;
    department: Pick<DepartmentRecord, "code">;
}): Promise<boolean> {
    const normalizedCode = normalizeDepartmentUserAccessCode(args.department.code);
    const codeHash = await hashDepartmentUserAccessCode(normalizedCode);

    return codeHash === args.accessCode.codeHash;
}

async function revokeDepartmentAccessCodes(args: {
    accessCodes: AccessCodeRecord[];
    ctx: MutationCtx;
    replacementAccessCodeId?: Id<"departmentAccessCodes">;
    revocationReason: "deactivated" | "rotated";
    revokedByTenantUserId: Id<"tenantUsers">;
}) {
    const now = Date.now();

    for (const accessCode of args.accessCodes) {
        await args.ctx.db.patch(accessCode._id, {
            isActive: false,
            replacedByAccessCodeId: args.replacementAccessCodeId,
            revokedAt: now,
            revokedByTenantUserId: args.revokedByTenantUserId,
            revocationReason: args.revocationReason,
            updatedAt: now,
        });
    }
}

async function issueDepartmentAccessCode(args: {
    actionLabel: "bulk_generate" | "generate" | "rotate";
    ctx: MutationCtx;
    department: DepartmentRecord;
    expirationAt: number;
    tenantUser: {
        _id: Id<"tenantUsers">;
        tenantId: Id<"tenants">;
        userId: Id<"users">;
    };
}) {
    const expirationValidation = validateAccessCodeExpiration({
        expirationAt: args.expirationAt,
    });
    if (!expirationValidation.ok) {
        throw new ConvexError({
            code: "VALIDATION_FAILED",
            field: "expirationAt",
            message: expirationValidation.message,
        });
    }

    const now = Date.now();
    const existingCodes = await loadDepartmentAccessCodes(args.ctx, args.department._id);
    const activeCodes = existingCodes.filter((accessCode) =>
        isUsableAccessCode(accessCode, now),
    );
    const issuedCode = await buildUniqueCanonicalAccessCode({
        ctx: args.ctx,
        department: args.department,
        tenantId: args.tenantUser.tenantId,
    });

    const accessCodeId = await args.ctx.db.insert("departmentAccessCodes", {
        codeHash: issuedCode.codeHash,
        codeSuffix: issuedCode.codeSuffix,
        createdAt: now,
        deliveryAttemptCount: 0,
        departmentId: args.department._id,
        expiresAt: args.expirationAt,
        isActive: true,
        issuedByTenantUserId: args.tenantUser._id,
        tenantId: args.tenantUser.tenantId,
        updatedAt: now,
    });

    if (activeCodes.length > 0) {
        await revokeDepartmentAccessCodes({
            accessCodes: activeCodes,
            ctx: args.ctx,
            replacementAccessCodeId: accessCodeId,
            revocationReason: "rotated",
            revokedByTenantUserId: args.tenantUser._id,
        });
    }

    await args.ctx.db.patch(args.department._id, {
        code: issuedCode.code,
        normalizedCode: normalizeCanonicalDepartmentAccessCode(issuedCode.code),
        updatedAt: now,
    });

    await appendDepartmentAccessCodeEventBestEffort(args.ctx, {
        accessCodeId,
        actorTenantUserId: args.tenantUser._id,
        actorUserId: args.tenantUser.userId,
        departmentId: args.department._id,
        event: activeCodes.length > 0 ? "rotated" : "issued",
        message:
            activeCodes.length > 0
                ? "Active department access code rotated."
                : "Department access code issued.",
        outcome: "allowed",
        tenantId: args.tenantUser.tenantId,
    });

    await appendAuditLogRequired(
        args.ctx,
        createAccessCodeAuditEntry({
            action: args.actionLabel,
            actorUserId: args.tenantUser.userId,
            event:
                activeCodes.length > 0
                    ? AUDIT_EVENT_NAMES.accessCodeRotated
                    : AUDIT_EVENT_NAMES.accessCodeGenerated,
            metadata: {
                accessCodeId: String(accessCodeId),
                departmentId: String(args.department._id),
                departmentName: args.department.name,
                expiresAt: args.expirationAt,
                previousActiveCodeCount: activeCodes.length,
                summary:
                    activeCodes.length > 0
                        ? `Rotated the active access code for ${args.department.name}.`
                        : `Issued a new access code for ${args.department.name}.`,
            },
            outcome: AUDIT_OUTCOMES.allowed,
            recordId: String(accessCodeId),
            tenantId: args.tenantUser.tenantId,
        }),
    );

    return {
        accessCodeId,
        code: issuedCode.code,
        departmentId: args.department._id,
        expiresAt: args.expirationAt,
        hadActiveCode: activeCodes.length > 0,
        maskedCode: maskCanonicalDepartmentAccessCode(issuedCode.code),
    };
}

async function evaluateRecipientEligibility(args: {
    ctx: MutationCtx;
    departmentId: Id<"departments">;
    normalizedEmail: string;
    tenantId: Id<"tenants">;
}): Promise<void> {
    const [users, existingDepartmentProfiles] = await Promise.all([
        args.ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", args.normalizedEmail))
            .collect(),
        args.ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantId_email", (q) =>
                q.eq("tenantId", args.tenantId).eq("normalizedEmail", args.normalizedEmail),
            )
            .collect(),
    ]);

    if (users.length > 1) {
        throw new ConvexError({
            code: "FORBIDDEN",
            message: ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE,
        });
    }

    if (users.length === 0) {
        if (existingDepartmentProfiles.length > 0) {
            throw new ConvexError({
                code: "FORBIDDEN",
                message: ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE,
            });
        }
        return;
    }

    const user = users.at(0);

    if (!user) {
        return;
    }

    const [platformMemberships, tenantMemberships] = await Promise.all([
        args.ctx.db
            .query("platformUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect(),
        args.ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect(),
    ]);
    const activePlatformMemberships = platformMemberships.filter(
        (membership) => membership.isActive,
    );
    const activeTenantMemberships = tenantMemberships.filter(
        (membership) => membership.isActive,
    );

    if (
        activePlatformMemberships.length > 0 ||
        activeTenantMemberships.length > 1
    ) {
        throw new ConvexError({
            code: "FORBIDDEN",
            message: ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE,
        });
    }

    if (activeTenantMemberships.length === 1) {
        const tenantMembership = activeTenantMemberships.at(0);

        if (!tenantMembership) {
            return;
        }

        if (
            tenantMembership.role !== "department_user" ||
            tenantMembership.tenantId !== args.tenantId
        ) {
            throw new ConvexError({
                code: "FORBIDDEN",
                message: ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE,
            });
        }

        const profile = await args.ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantUserId", (q) =>
                q.eq("tenantUserId", tenantMembership._id),
            )
            .first();

        if (
            !profile ||
            !profile.isActive ||
            profile.departmentId !== args.departmentId ||
            profile.normalizedEmail !== args.normalizedEmail
        ) {
            throw new ConvexError({
                code: "FORBIDDEN",
                message: ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE,
            });
        }
    }
}

function formatAccessCodeActivitySummary(
    latestEvent:
        | Doc<"departmentAccessCodeEvents">
        | undefined,
): string {
    if (!latestEvent) {
        return "No activity recorded yet.";
    }

    switch (latestEvent.event) {
        case "login_success":
            return "Most recent DU login succeeded.";
        case "login_denied":
            return latestEvent.message ?? "Most recent DU login was denied.";
        case "email_queued":
            return "Latest access-code email is queued.";
        case "email_failed":
            return latestEvent.message ?? "Latest access-code email needs a retry.";
        case "deactivated":
            return "Access code was manually deactivated.";
        case "rotated":
            return "Access code was rotated.";
        default:
            return "Access code was issued.";
    }
}

export const getAccessCodesWorkspace = query({
    args: {},
    returns: v.any(),
    handler: async (ctx) => {
        const { authContext } = await loadProcurementOfficerQueryContext(ctx);
        const now = Date.now();
        const [departments, accessCodes, events, profiles, tenantUsers] = await Promise.all([
            ctx.db
                .query("departments")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("departmentAccessCodes")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("departmentAccessCodeEvents")
                .withIndex("by_tenantId_occurredAt", (q) =>
                    q.eq("tenantId", authContext.tenantId),
                )
                .collect(),
            ctx.db
                .query("departmentUserProfiles")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("tenantUsers")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
        ]);

        const activeDepartments = departments.filter(isActiveDepartment);
        const tenantUsersById = new Map(
            tenantUsers.map((tenantUser) => [String(tenantUser._id), tenantUser]),
        );
        const relevantUserIds = Array.from(
            new Set(
                profiles
                    .map((profile) => tenantUsersById.get(String(profile.tenantUserId))?.userId)
                    .filter((userId): userId is Id<"users"> => userId !== undefined),
            ),
        );
        const userDocs = await Promise.all(
            relevantUserIds.map(async (userId) => [String(userId), await ctx.db.get(userId)] as const),
        );
        const usersById = new Map(userDocs);
        const expirationDefault = deriveAccessCodeExpirationDefault({
            departments: activeDepartments.map((department) => ({
                id: String(department._id),
                isActive: department.isActive,
                submissionEndsAt: department.submissionEndsAt,
                submissionStartsAt: department.submissionStartsAt,
            })),
        });

        const rows = await Promise.all(
            activeDepartments.map(async (department) => {
                const departmentCodes = accessCodes
                    .filter((accessCode) => accessCode.departmentId === department._id)
                    .sort((left, right) => right.createdAt - left.createdAt);
                const currentAccessCode = departmentCodes.find((accessCode) =>
                    isUsableAccessCode(accessCode, now),
                );
                const latestAccessCode = departmentCodes.at(0);
                const departmentEvents = events
                    .filter((event) => event.departmentId === department._id)
                    .sort((left, right) => right.occurredAt - left.occurredAt);
                const activeProfileEmails = Array.from(
                    new Set(
                        profiles
                            .filter(
                                (profile) =>
                                    profile.departmentId === department._id && profile.isActive,
                            )
                            .map((profile) => {
                                const tenantUser = tenantUsersById.get(
                                    String(profile.tenantUserId),
                                );
                                const user = tenantUser
                                    ? usersById.get(String(tenantUser.userId))
                                    : null;
                                return typeof user?.email === "string"
                                    ? user.email.trim()
                                    : null;
                            })
                            .filter((email): email is string => Boolean(email)),
                    ),
                ).sort((left, right) => left.localeCompare(right));
                const deliveryStatus = (
                    currentAccessCode
                        ? currentAccessCode.lastDeliveryStatus
                        : latestAccessCode
                          ? latestAccessCode.lastDeliveryStatus
                          : undefined
                ) as AccessCodeDeliveryStatus | undefined;
                const isCurrentCodeSynced =
                    currentAccessCode === undefined
                        ? true
                        : await doesDepartmentCodeMatchAccessCode({
                            accessCode: currentAccessCode,
                            department,
                        });

                return {
                    accessCodeId: currentAccessCode ? String(currentAccessCode._id) : null,
                    canEmailActiveCode:
                        Boolean(currentAccessCode) && isCurrentCodeSynced,
                    codeMasked: maskCanonicalDepartmentAccessCode(department.code),
                    deliveryStatus: deliveryStatus ?? "none",
                    deliveryStatusLabel: mapAccessCodeDeliveryStatusLabel(
                        deliveryStatus ?? "none",
                    ),
                    expiresAt: currentAccessCode
                        ? currentAccessCode.expiresAt
                        : latestAccessCode
                          ? latestAccessCode.expiresAt
                          : null,
                    hasActiveCode: Boolean(currentAccessCode),
                    id: String(department._id),
                    issuedAt: currentAccessCode
                        ? currentAccessCode.createdAt
                        : latestAccessCode
                          ? latestAccessCode.createdAt
                          : null,
                    knownRecipientEmails: activeProfileEmails,
                    lastActivityAt: departmentEvents[0]?.occurredAt ?? null,
                    lastActivitySummary: formatAccessCodeActivitySummary(
                        departmentEvents[0],
                    ),
                    lastDeliveryEmail: currentAccessCode
                        ? currentAccessCode.lastDeliveryEmail ?? null
                        : latestAccessCode
                          ? latestAccessCode.lastDeliveryEmail ?? null
                          : null,
                    latestHistoryCount: departmentEvents.length,
                    name: department.name,
                    statusLabel: currentAccessCode
                        ? isCurrentCodeSynced
                            ? "Active"
                            : "Sync required"
                        : latestAccessCode && latestAccessCode.revocationReason === "deactivated"
                          ? "Deactivated"
                          : latestAccessCode && latestAccessCode.expiresAt <= now
                            ? "Expired"
                            : "Missing",
                };
            }),
        );

        return {
            meta: {
                defaultExpirationAt: expirationDefault.deadlineAt,
                defaultExpirationLabel: expirationDefault.label,
                defaultExpirationState: expirationDefault.state,
                loginUrl: ACCESS_CODE_LOGIN_URL_PATH,
                now,
            },
            rows: rows.sort((left, right) => left.name.localeCompare(right.name)),
        };
    },
});

export const getDepartmentAccessCodeHistory = query({
    args: {
        departmentId: v.id("departments"),
        limit: v.optional(v.number()),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const { authContext } = await loadProcurementOfficerQueryContext(ctx);
        await getTenantDepartmentOrThrow(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });

        const boundedLimit = Math.max(Math.min(args.limit ?? 20, 50), 1);
        const events = await ctx.db
            .query("departmentAccessCodeEvents")
            .withIndex("by_departmentId_occurredAt", (q) =>
                q.eq("departmentId", args.departmentId),
            )
            .order("desc")
            .take(boundedLimit);

        return {
            items: events.map((event) => ({
                email: event.normalizedEmail ?? null,
                event: event.event,
                message: event.message ?? formatAccessCodeActivitySummary(event),
                occurredAt: event.occurredAt,
                origin: event.requestOriginStatus === "captured"
                    ? event.ipAddress ?? "Origin captured without IP"
                    : "Origin unavailable",
                outcome: event.outcome,
                userAgent: event.userAgent ?? null,
            })),
            limit: boundedLimit,
        };
    },
});

export const generateAccessCode = mutation({
    args: {
        departmentId: v.id("departments"),
        expiresAt: v.number(),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser } = await loadProcurementOfficerMutationContext(ctx);
        const department = await getTenantDepartmentOrThrow(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        const activeCodes = (await loadDepartmentAccessCodes(ctx, department._id)).filter(
            (accessCode) => isUsableAccessCode(accessCode, Date.now()),
        );

        if (activeCodes.length > 0) {
            throw new ConvexError({
                code: "FORBIDDEN",
                message: "Department already has an active access code. Rotate it instead.",
            });
        }

        return await issueDepartmentAccessCode({
            actionLabel: "generate",
            ctx,
            department,
            expirationAt: args.expiresAt,
            tenantUser,
        });
    },
});

export const rotateAccessCode = mutation({
    args: {
        departmentId: v.id("departments"),
        expiresAt: v.number(),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser } = await loadProcurementOfficerMutationContext(ctx);
        const department = await getTenantDepartmentOrThrow(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });

        return await issueDepartmentAccessCode({
            actionLabel: "rotate",
            ctx,
            department,
            expirationAt: args.expiresAt,
            tenantUser,
        });
    },
});

export const deactivateAccessCode = mutation({
    args: {
        departmentId: v.id("departments"),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser } = await loadProcurementOfficerMutationContext(ctx);
        const department = await getTenantDepartmentOrThrow(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        const activeCodes = (await loadDepartmentAccessCodes(ctx, department._id)).filter(
            (accessCode) => isUsableAccessCode(accessCode, Date.now()),
        );

        if (activeCodes.length === 0) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: ACCESS_CODE_NOT_FOUND_MESSAGE,
            });
        }

        await revokeDepartmentAccessCodes({
            accessCodes: activeCodes,
            ctx,
            revocationReason: "deactivated",
            revokedByTenantUserId: tenantUser._id,
        });

        for (const accessCode of activeCodes) {
            await appendDepartmentAccessCodeEventBestEffort(ctx, {
                accessCodeId: accessCode._id,
                actorTenantUserId: tenantUser._id,
                actorUserId: tenantUser.userId,
                departmentId: department._id,
                event: "deactivated",
                message: ACCESS_CODE_DEACTIVATED_MESSAGE,
                outcome: "allowed",
                tenantId: authContext.tenantId,
            });
        }

        await appendAuditLogRequired(
            ctx,
            createAccessCodeAuditEntry({
                action: "deactivate",
                actorUserId: tenantUser.userId,
                event: AUDIT_EVENT_NAMES.accessCodeDeactivated,
                metadata: {
                    activeCodeCount: activeCodes.length,
                    departmentId: String(department._id),
                    departmentName: department.name,
                    summary: `Deactivated the active access code for ${department.name}.`,
                },
                outcome: AUDIT_OUTCOMES.allowed,
                recordId: String(activeCodes[0]?._id ?? department._id),
                tenantId: authContext.tenantId,
            }),
        );

        return {
            departmentId: args.departmentId,
        };
    },
});

export const bulkGenerateAccessCodes = mutation({
    args: {
        expiresAt: v.number(),
        includeDepartmentsWithActiveCodes: v.optional(v.boolean()),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser } = await loadProcurementOfficerMutationContext(ctx);
        const expirationValidation = validateAccessCodeExpiration({
            expirationAt: args.expiresAt,
        });
        if (!expirationValidation.ok) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: "expiresAt",
                message:
                    expirationValidation.message || ACCESS_CODE_EXPIRATION_PAST_MESSAGE,
            });
        }

        const now = Date.now();
        const departments = (await ctx.db
            .query("departments")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
            .collect())
            .filter(isActiveDepartment);
        const accessCodes = await ctx.db
            .query("departmentAccessCodes")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
            .collect();
        const eligibleDepartmentIds = new Set(
            selectDepartmentsForBulkAccessCodeGeneration({
                candidates: departments.map((department) => ({
                    departmentId: String(department._id),
                    hasActiveCode: accessCodes.some(
                        (accessCode) =>
                            accessCode.departmentId === department._id &&
                            isUsableAccessCode(accessCode, now),
                    ),
                    isActive: true,
                })),
                includeDepartmentsWithActiveCodes:
                    args.includeDepartmentsWithActiveCodes,
            }),
        );

        if (eligibleDepartmentIds.size === 0) {
            return {
                noEligibleDepartments: true,
                results: [],
                summary: ACCESS_CODE_NO_ELIGIBLE_BULK_MESSAGE,
            };
        }

        const results: Array<{
            departmentId: string;
            departmentName: string;
            outcome: "failed" | "generated" | "skipped";
            reason?: string;
        }> = [];

        for (const department of departments) {
            if (!eligibleDepartmentIds.has(String(department._id))) {
                results.push({
                    departmentId: String(department._id),
                    departmentName: department.name,
                    outcome: "skipped",
                    reason: "Department already has an active access code.",
                });
                continue;
            }

            try {
                await issueDepartmentAccessCode({
                    actionLabel: "bulk_generate",
                    ctx,
                    department,
                    expirationAt: args.expiresAt,
                    tenantUser,
                });
                results.push({
                    departmentId: String(department._id),
                    departmentName: department.name,
                    outcome: "generated",
                });
            } catch (error) {
                results.push({
                    departmentId: String(department._id),
                    departmentName: department.name,
                    outcome: "failed",
                    reason: error instanceof Error ? error.message : "Generation failed",
                });
            }
        }

        await appendAuditLogRequired(
            ctx,
            createAccessCodeAuditEntry({
                action: "bulk_generate",
                actorUserId: tenantUser.userId,
                event: AUDIT_EVENT_NAMES.accessCodeBulkGenerated,
                metadata: {
                    generatedCount: results.filter((result) => result.outcome === "generated").length,
                    failedCount: results.filter((result) => result.outcome === "failed").length,
                    skippedCount: results.filter((result) => result.outcome === "skipped").length,
                    includeDepartmentsWithActiveCodes:
                        args.includeDepartmentsWithActiveCodes ?? false,
                    summary: "Bulk access-code generation completed.",
                },
                outcome: AUDIT_OUTCOMES.allowed,
                tenantId: authContext.tenantId,
            }),
        );

        return {
            noEligibleDepartments: false,
            results,
            summary:
                results.filter((result) => result.outcome === "generated").length > 0
                    ? "Bulk access-code generation completed."
                    : ACCESS_CODE_NO_ELIGIBLE_BULK_MESSAGE,
        };
    },
});

export const prepareAccessCodeEmailDelivery = internalMutation({
    args: {
        accessCodeId: v.id("departmentAccessCodes"),
        departmentId: v.id("departments"),
        email: v.string(),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser, tenant } = await loadProcurementOfficerMutationContext(ctx);
        const department = await getTenantDepartmentOrThrow(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        const accessCode = await ctx.db.get(args.accessCodeId);

        if (
            !accessCode ||
            accessCode.departmentId !== args.departmentId ||
            accessCode.tenantId !== authContext.tenantId ||
            !isUsableAccessCode(accessCode, Date.now())
        ) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: ACCESS_CODE_NOT_FOUND_MESSAGE,
            });
        }

        const currentUsableCode = (await loadDepartmentAccessCodes(ctx, department._id))
            .filter((departmentAccessCode) =>
                isUsableAccessCode(departmentAccessCode, Date.now()),
            )
            .sort((left, right) => right.createdAt - left.createdAt)
            .at(0);
        if (!currentUsableCode || currentUsableCode._id !== accessCode._id) {
            throw new ConvexError({
                code: "FORBIDDEN",
                message: ACCESS_CODE_NOT_FOUND_MESSAGE,
            });
        }

        const departmentCodeMatchesAccessCode = await doesDepartmentCodeMatchAccessCode({
            accessCode,
            department,
        });
        if (!departmentCodeMatchesAccessCode) {
            throw new ConvexError({
                code: "INVALID_STATE",
                message: ACCESS_CODE_SYNC_REPAIR_REQUIRED_MESSAGE,
            });
        }

        const emailResult = validateEmailInput(args.email);
        if (!emailResult.ok) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: "email",
                message: emailResult.issue.message,
            });
        }

        const normalizedEmail = normalizeAuthEmail(emailResult.value);
        await evaluateRecipientEligibility({
            ctx,
            departmentId: department._id,
            normalizedEmail,
            tenantId: authContext.tenantId,
        });

        const now = Date.now();
        const duplicateQueuedRequest =
            accessCode.lastDeliveryStatus === "queued" &&
            accessCode.lastDeliveryEmail === normalizedEmail &&
            typeof accessCode.lastDeliveryRequestedAt === "number" &&
            now - accessCode.lastDeliveryRequestedAt < 60_000 &&
            typeof accessCode.lastDeliveryIdempotencyKey === "string";
        const deliveryAttemptCount = duplicateQueuedRequest
            ? accessCode.deliveryAttemptCount ?? 1
            : (accessCode.deliveryAttemptCount ?? 0) + 1;
        const idempotencyKey = duplicateQueuedRequest
            ? (accessCode.lastDeliveryIdempotencyKey as string)
            : `access-code:${accessCode._id}:${normalizedEmail}:${deliveryAttemptCount}`;

        await ctx.db.patch(accessCode._id, {
            deliveryAttemptCount,
            lastDeliveryEmail: normalizedEmail,
            lastDeliveryIdempotencyKey: idempotencyKey,
            lastDeliveryRequestedAt: now,
            updatedAt: now,
        });

        return {
            accessCodeId: accessCode._id,
            accessCodeValue: department.code,
            departmentId: department._id,
            departmentName: department.name,
            duplicateQueuedRequest,
            email: normalizedEmail,
            expirationLabel:
                formatAccessCodeDateTime(accessCode.expiresAt) ?? "Not configured",
            idempotencyKey,
            loginUrl: buildAbsoluteAccessCodeLoginUrl({
                loginPath: ACCESS_CODE_LOGIN_URL_PATH,
            }),
            tenantId: authContext.tenantId,
            tenantName: tenant.name,
            tenantUserId: tenantUser._id,
            userId: tenantUser.userId,
        };
    },
});

export const completeAccessCodeEmailDelivery = internalMutation({
    args: {
        accessCodeId: v.id("departmentAccessCodes"),
        email: v.string(),
        eventKey: v.optional(v.string()),
        idempotencyKey: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const accessCode = await ctx.db.get(args.accessCodeId);
        if (!accessCode) {
            return null;
        }

        await ctx.db.patch(args.accessCodeId, {
            lastDeliveryEmail: args.email,
            lastDeliveryIdempotencyKey: args.idempotencyKey,
            lastDeliveryQueuedAt: Date.now(),
            lastDeliveryStatus: "queued",
            updatedAt: Date.now(),
        });

        await appendDepartmentAccessCodeEventBestEffort(ctx, {
            accessCodeId: accessCode._id,
            departmentId: accessCode.departmentId,
            event: "email_queued",
            message: "Access-code email queued for delivery.",
            normalizedEmail: args.email,
            outcome: "queued",
            tenantId: accessCode.tenantId,
        });

        return null;
    },
});

export const failAccessCodeEmailDelivery = internalMutation({
    args: {
        accessCodeId: v.id("departmentAccessCodes"),
        email: v.string(),
        errorCode: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const accessCode = await ctx.db.get(args.accessCodeId);
        if (!accessCode) {
            return null;
        }

        await ctx.db.patch(args.accessCodeId, {
            lastDeliveryEmail: args.email,
            lastDeliveryErrorCode: args.errorCode ?? "QUEUE_FAILED",
            lastDeliveryStatus: "failed",
            updatedAt: Date.now(),
        });

        await appendDepartmentAccessCodeEventBestEffort(ctx, {
            accessCodeId: accessCode._id,
            departmentId: accessCode.departmentId,
            event: "email_failed",
            message: "Access-code email failed before queue confirmation.",
            normalizedEmail: args.email,
            outcome: "failed",
            tenantId: accessCode.tenantId,
        });

        return null;
    },
});

export const sendAccessCodeEmail = action({
    args: {
        accessCodeId: v.id("departmentAccessCodes"),
        departmentId: v.id("departments"),
        email: v.string(),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        await loadProcurementOfficerActionContext(ctx);
        const prepared = await ctx.runMutation(
            "functions/accessCodes:prepareAccessCodeEmailDelivery" as any,
            args,
        );

        try {
            const queueResult = await ctx.runAction(
                "actions/email:queueTransactionalEmail" as any,
                {
                    idempotencyKey: prepared.idempotencyKey,
                    subject: `${prepared.tenantName} access code for ${prepared.departmentName}`,
                    template: "access-code-delivery",
                    templateProps: {
                        accessCode: prepared.accessCodeValue,
                        departmentName: prepared.departmentName,
                        expirationLabel: prepared.expirationLabel,
                        loginUrl: prepared.loginUrl,
                        tenantName: prepared.tenantName,
                    },
                    to: prepared.email,
                },
            );

            await ctx.runMutation(
                "functions/accessCodes:completeAccessCodeEmailDelivery" as any,
                {
                    accessCodeId: prepared.accessCodeId,
                    email: prepared.email,
                    eventKey: queueResult?.eventKey,
                    idempotencyKey: prepared.idempotencyKey,
                },
            );

            await ctx.runMutation(
                "functions/auditLogs:appendAuditLogFromAction" as any,
                {
                    action: "email_queue",
                    actorRole: "procurement_officer",
                    actorState: createAuthenticatedAuditActor({
                        role: "procurement_officer",
                        userId: String(prepared.userId),
                    }).state,
                    actorUserId: String(prepared.userId),
                    entityType: "access_code",
                    event: AUDIT_EVENT_NAMES.accessCodeEmailQueued,
                    metadata: {
                        accessCodeId: String(prepared.accessCodeId),
                        departmentId: String(prepared.departmentId),
                        email: prepared.email,
                        idempotencyKey: prepared.idempotencyKey,
                    },
                    outcome: AUDIT_OUTCOMES.queued,
                    recordId: String(prepared.accessCodeId),
                    sourceTenantId: String(prepared.tenantId),
                    tableName: "departmentAccessCodes",
                    targetTenantId: String(prepared.tenantId),
                    timestamp: Date.now(),
                },
            ).catch(() => undefined);

            return {
                deliveryStatus: "queued" as const,
                duplicate: Boolean(queueResult?.duplicate),
            };
        } catch (error) {
            await ctx.runMutation(
                "functions/accessCodes:failAccessCodeEmailDelivery" as any,
                {
                    accessCodeId: prepared.accessCodeId,
                    email: prepared.email,
                    errorCode:
                        error instanceof Error && error.message.trim().length > 0
                            ? error.message.trim()
                            : "QUEUE_FAILED",
                },
            );

            await ctx.runMutation(
                "functions/auditLogs:appendAuditLogFromAction" as any,
                {
                    action: "email_queue",
                    actorRole: "procurement_officer",
                    actorState: createAuthenticatedAuditActor({
                        role: "procurement_officer",
                        userId: String(prepared.userId),
                    }).state,
                    actorUserId: String(prepared.userId),
                    entityType: "access_code",
                    event: AUDIT_EVENT_NAMES.accessCodeEmailFailed,
                    metadata: {
                        accessCodeId: String(prepared.accessCodeId),
                        departmentId: String(prepared.departmentId),
                        email: prepared.email,
                    },
                    outcome: AUDIT_OUTCOMES.failed,
                    recordId: String(prepared.accessCodeId),
                    sourceTenantId: String(prepared.tenantId),
                    tableName: "departmentAccessCodes",
                    targetTenantId: String(prepared.tenantId),
                    timestamp: Date.now(),
                },
            ).catch(() => undefined);

            throw new ConvexError({
                code: "SERVICE_UNAVAILABLE",
                message: ACCESS_CODE_DELIVERY_GENERIC_ERROR_MESSAGE,
            });
        }
    },
});
