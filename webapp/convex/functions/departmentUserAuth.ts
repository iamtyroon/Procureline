import {
    createAccount,
    signInViaProvider,
    type GenericActionCtxWithAuthConfig,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
    action,
    internalMutation,
    internalQuery,
    type MutationCtx,
    type QueryCtx,
} from "../_generated/server";
import {
    AUDIT_EVENT_NAMES,
    AUDIT_OUTCOMES,
    createAnonymousAuditActor,
    createAuthenticatedAuditActor,
    serializeAuditEvent,
    type AuditEventEntry,
} from "../../lib/security/audit";
import {
    DEACTIVATED_DEPARTMENT_USER_MESSAGE,
    DEPARTMENT_USER_ACCESS_CHALLENGE_WINDOW_MS,
    DEPARTMENT_USER_ACCESS_LOCKOUT_THRESHOLD,
    DEPARTMENT_USER_ACCESS_LOCKOUT_WINDOW_MS,
    DEPARTMENT_USER_AUTH_PROVIDER,
    DEPARTMENT_USER_INVALID_VERIFICATION_CODE_MESSAGE,
    DEPARTMENT_USER_SETUP_REQUIRED_MESSAGE,
    DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE,
    EXPIRED_ACCESS_CODE_MESSAGE,
    INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
    INVALID_ACCESS_CODE_MESSAGE,
    SUBSCRIPTION_INACTIVE_MESSAGE,
    evaluateDepartmentUserSubmissionWindow,
    formatDepartmentUserLockoutMessage,
    getDepartmentUserAccessCodeSuffix,
    getDepartmentUserLockoutState,
    getDepartmentUserSubmissionWindowMessage,
    hasConfiguredDepartmentUserSubmissionWindow,
    hashDepartmentUserAccessCode,
    isDepartmentUserOtpProviderFailureMessage,
    normalizeDepartmentUserAccessCode,
    type DepartmentUserAccessMode,
} from "../../lib/auth/department-user-access";
import {
    normalizeDepartmentCode,
    normalizeDepartmentName,
} from "../../lib/procurement-officer/departments";
import {
    normalizeAuthEmail,
    validateDepartmentUserAccessCodeInput,
    validateEmailInput,
} from "../../lib/security/input";
import { appendAuditLogBestEffort } from "./_audit";
import { ResendOTP } from "../ResendOTP";

type ReadCtx = QueryCtx | MutationCtx;
type ActionCtx = GenericActionCtxWithAuthConfig<any>;

interface AccessAttemptSuccess {
    accessCodeId: Id<"departmentAccessCodes">;
    accessMode: DepartmentUserAccessMode;
    departmentId: Id<"departments">;
    normalizedEmail: string;
    notice: string | null;
    tenantId: Id<"tenants">;
    userIdHint?: Id<"users">;
}

type AccessAttemptFailure = {
    auditEvent:
        | typeof AUDIT_EVENT_NAMES.departmentUserCollision
        | typeof AUDIT_EVENT_NAMES.departmentUserDataIntegrity
        | typeof AUDIT_EVENT_NAMES.departmentUserDeactivated
        | typeof AUDIT_EVENT_NAMES.departmentUserExpired
        | typeof AUDIT_EVENT_NAMES.departmentUserInvalid
        | typeof AUDIT_EVENT_NAMES.departmentUserLockedOut
        | typeof AUDIT_EVENT_NAMES.departmentUserTenantInactive
        | typeof AUDIT_EVENT_NAMES.departmentUserWindowBlocked;
    message: string;
    metadata?: Record<string, unknown>;
    outcome:
        | typeof AUDIT_OUTCOMES.blockedDataIntegrity
        | typeof AUDIT_OUTCOMES.blockedDeactivatedDepartmentUser
        | typeof AUDIT_OUTCOMES.blockedExpiredAccessCode
        | typeof AUDIT_OUTCOMES.blockedInvalidAccessCode
        | typeof AUDIT_OUTCOMES.blockedLockedOut
        | typeof AUDIT_OUTCOMES.blockedRoleCollision
        | typeof AUDIT_OUTCOMES.blockedSubmissionWindow
        | typeof AUDIT_OUTCOMES.blockedSubscriptionInactive;
    tenantId?: Id<"tenants">;
};

type AccessAttemptResult =
    | ({ ok: true } & AccessAttemptSuccess)
    | ({ ok: false } & AccessAttemptFailure);

function getErrorMessage(error: unknown): string | null {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message.trim();
    }

    return null;
}

function createAuditEntry(args: {
    actorUserId?: Id<"users">;
    event: AuditEventEntry["event"];
    metadata?: Record<string, unknown>;
    outcome: AuditEventEntry["outcome"];
    targetTenantId?: Id<"tenants">;
}): AuditEventEntry {
    return {
        action: "authenticate",
        actor: args.actorUserId
            ? createAuthenticatedAuditActor({
                role: "department_user",
                userId: String(args.actorUserId),
            })
            : createAnonymousAuditActor(),
        entityType: "department_user_access",
        event: args.event,
        metadata: args.metadata,
        outcome: args.outcome,
        targetTenantId: args.targetTenantId ? String(args.targetTenantId) : undefined,
        timestamp: Date.now(),
    };
}

async function queueAuditFromAction(
    ctx: {
        runMutation: any;
    },
    entry: AuditEventEntry,
): Promise<void> {
    await ctx.runMutation(
        "functions/auditLogs:appendAuditLogFromAction" as any,
        serializeAuditEvent(entry),
    );
}

async function lookupAccessCodeByNormalizedCode(
    ctx: ReadCtx,
    normalizedAccessCode: string,
) {
    const codeHash = await hashDepartmentUserAccessCode(normalizedAccessCode);
    return await ctx.db
        .query("departmentAccessCodes")
        .withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash))
        .unique();
}

async function loadLoginAttempt(args: {
    accessCodeHash: string;
    ctx: ReadCtx;
    normalizedEmail: string;
}) {
    return await args.ctx.db
        .query("departmentUserLoginAttempts")
        .withIndex("by_email_accessCodeHash", (q) =>
            q.eq("normalizedEmail", args.normalizedEmail).eq("accessCodeHash", args.accessCodeHash),
        )
        .first();
}

async function loadProfileByTenantUserId(
    ctx: ReadCtx,
    tenantUserId: Id<"tenantUsers">,
) {
    return await ctx.db
        .query("departmentUserProfiles")
        .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", tenantUserId))
        .first();
}

async function evaluateAccessAttemptInternal(
    ctx: ReadCtx,
    args: {
        accessCodeId?: Id<"departmentAccessCodes">;
        normalizedAccessCode?: string;
        normalizedEmail: string;
        now?: number;
    },
): Promise<AccessAttemptResult> {
    const now = args.now ?? Date.now();
    const accessCode =
        args.accessCodeId !== undefined
            ? await ctx.db.get(args.accessCodeId)
            : await lookupAccessCodeByNormalizedCode(
                ctx,
                args.normalizedAccessCode ?? "",
            );
    const accessCodeHash =
        accessCode?.codeHash ??
        (args.normalizedAccessCode
            ? await hashDepartmentUserAccessCode(args.normalizedAccessCode)
            : null);

    const lockout =
        accessCodeHash === null
            ? null
            : await loadLoginAttempt({
                accessCodeHash,
                ctx,
                normalizedEmail: args.normalizedEmail,
            });
    const lockoutState = getDepartmentUserLockoutState({
        failedAttempts: lockout?.failedAttempts ?? 0,
        lockedUntil: lockout?.lockedUntil,
        now,
    });
    if (lockoutState.isLockedOut) {
        return {
            ok: false,
            auditEvent: AUDIT_EVENT_NAMES.departmentUserLockedOut,
            message: formatDepartmentUserLockoutMessage(lockoutState.remainingMs),
            metadata: {
                accessCodeHash,
                accessCodeId: accessCode ? String(accessCode._id) : undefined,
                lockedUntil: lockoutState.lockedUntil,
                normalizedEmail: args.normalizedEmail,
            },
            outcome: AUDIT_OUTCOMES.blockedLockedOut,
            tenantId: accessCode?.tenantId,
        };
    }

    if (!accessCode) {
        return {
            ok: false,
            auditEvent: AUDIT_EVENT_NAMES.departmentUserInvalid,
            message: INVALID_ACCESS_CODE_MESSAGE,
            outcome: AUDIT_OUTCOMES.blockedInvalidAccessCode,
        };
    }

    const department = await ctx.db.get(accessCode.departmentId);
    if (!department || department.tenantId !== accessCode.tenantId) {
        return {
            ok: false,
            auditEvent: AUDIT_EVENT_NAMES.departmentUserInvalid,
            message: INVALID_ACCESS_CODE_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                normalizedEmail: args.normalizedEmail,
            },
            outcome: AUDIT_OUTCOMES.blockedInvalidAccessCode,
            tenantId: accessCode.tenantId,
        };
    }

    const tenant = await ctx.db.get(accessCode.tenantId);
    if (!tenant || tenant.status !== "active") {
        return {
            ok: false,
            auditEvent: AUDIT_EVENT_NAMES.departmentUserTenantInactive,
            message: SUBSCRIPTION_INACTIVE_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
            },
            outcome: AUDIT_OUTCOMES.blockedSubscriptionInactive,
            tenantId: accessCode.tenantId,
        };
    }

    if (!department.isActive || !accessCode.isActive || accessCode.expiresAt < now) {
        return {
            ok: false,
            auditEvent: AUDIT_EVENT_NAMES.departmentUserExpired,
            message: EXPIRED_ACCESS_CODE_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
            },
            outcome: AUDIT_OUTCOMES.blockedExpiredAccessCode,
            tenantId: accessCode.tenantId,
        };
    }

    const existingDepartmentProfile = await ctx.db
        .query("departmentUserProfiles")
        .withIndex("by_departmentId_email", (q) =>
            q.eq("departmentId", department._id).eq("normalizedEmail", args.normalizedEmail),
        )
        .first();
    if (existingDepartmentProfile && !existingDepartmentProfile.isActive) {
        return {
            ok: false,
            auditEvent: AUDIT_EVENT_NAMES.departmentUserDeactivated,
            message: DEACTIVATED_DEPARTMENT_USER_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
                tenantUserId: String(existingDepartmentProfile.tenantUserId),
            },
            outcome: AUDIT_OUTCOMES.blockedDeactivatedDepartmentUser,
            tenantId: accessCode.tenantId,
        };
    }

    if (
        !hasConfiguredDepartmentUserSubmissionWindow({
            submissionEndsAt: department.submissionEndsAt,
            submissionStartsAt: department.submissionStartsAt,
        })
    ) {
        return {
            ok: false,
            auditEvent: AUDIT_EVENT_NAMES.departmentUserWindowBlocked,
            message: DEPARTMENT_USER_SETUP_REQUIRED_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
                windowState: "setup_required",
            },
            outcome: AUDIT_OUTCOMES.blockedSubmissionWindow,
            tenantId: accessCode.tenantId,
        };
    }

    const windowState = evaluateDepartmentUserSubmissionWindow({
        now,
        submissionEndsAt: department.submissionEndsAt as number,
        submissionStartsAt: department.submissionStartsAt as number,
    });
    if (windowState.state === "not_started" || windowState.state === "ended") {
        return {
            ok: false,
            auditEvent: AUDIT_EVENT_NAMES.departmentUserWindowBlocked,
            message:
                getDepartmentUserSubmissionWindowMessage({
                    now,
                    submissionEndsAt: department.submissionEndsAt as number,
                    submissionStartsAt: department.submissionStartsAt as number,
                }) ?? DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
                windowState: windowState.state,
            },
            outcome: AUDIT_OUTCOMES.blockedSubmissionWindow,
            tenantId: accessCode.tenantId,
        };
    }

    const emailUsers = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", args.normalizedEmail))
        .collect();
    if (emailUsers.length > 1) {
        return {
            ok: false,
            auditEvent: AUDIT_EVENT_NAMES.departmentUserCollision,
            message: INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
                userCount: emailUsers.length,
            },
            outcome: AUDIT_OUTCOMES.blockedRoleCollision,
            tenantId: accessCode.tenantId,
        };
    }

    let userIdHint: Id<"users"> | undefined;
    if (emailUsers.length === 1) {
        const existingUser = emailUsers.at(0);
        if (existingUser === undefined) {
            return {
                ok: false,
                auditEvent: AUDIT_EVENT_NAMES.departmentUserCollision,
                message: INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                outcome: AUDIT_OUTCOMES.blockedRoleCollision,
                tenantId: accessCode.tenantId,
            };
        }
        userIdHint = existingUser._id;
        const [platformMemberships, tenantMemberships] = await Promise.all([
            ctx.db
                .query("platformUsers")
                .withIndex("by_userId", (q) => q.eq("userId", existingUser._id))
                .collect(),
            ctx.db
                .query("tenantUsers")
                .withIndex("by_userId", (q) => q.eq("userId", existingUser._id))
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
            return {
                ok: false,
                auditEvent: AUDIT_EVENT_NAMES.departmentUserCollision,
                message: INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                metadata: {
                    accessCodeId: String(accessCode._id),
                    departmentId: String(department._id),
                    normalizedEmail: args.normalizedEmail,
                    userId: String(existingUser._id),
                },
                outcome: AUDIT_OUTCOMES.blockedRoleCollision,
                tenantId: accessCode.tenantId,
            };
        }

        if (activeTenantMemberships.length === 1) {
            const activeTenantMembership = activeTenantMemberships.at(0);
            if (activeTenantMembership === undefined) {
                return {
                    ok: false,
                    auditEvent: AUDIT_EVENT_NAMES.departmentUserCollision,
                    message: INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                    outcome: AUDIT_OUTCOMES.blockedRoleCollision,
                    tenantId: accessCode.tenantId,
                };
            }
            if (
                activeTenantMembership.role !== "department_user" ||
                activeTenantMembership.tenantId !== accessCode.tenantId
            ) {
                return {
                    ok: false,
                    auditEvent: AUDIT_EVENT_NAMES.departmentUserCollision,
                    message: INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                    metadata: {
                        accessCodeId: String(accessCode._id),
                        departmentId: String(department._id),
                        normalizedEmail: args.normalizedEmail,
                        tenantUserId: String(activeTenantMembership._id),
                        userId: String(existingUser._id),
                    },
                    outcome: AUDIT_OUTCOMES.blockedRoleCollision,
                    tenantId: accessCode.tenantId,
                };
            }

            const boundProfile = await loadProfileByTenantUserId(
                ctx,
                activeTenantMembership._id,
            );
            if (
                !boundProfile ||
                boundProfile.departmentId !== department._id ||
                boundProfile.normalizedEmail !== args.normalizedEmail
            ) {
                return {
                    ok: false,
                    auditEvent: AUDIT_EVENT_NAMES.departmentUserDataIntegrity,
                    message: INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                    metadata: {
                        accessCodeId: String(accessCode._id),
                        departmentId: String(department._id),
                        normalizedEmail: args.normalizedEmail,
                        integrityReason:
                            !boundProfile
                                ? "tenant_user_missing_department_profile"
                                : "tenant_user_profile_scope_mismatch",
                        tenantUserId: String(activeTenantMembership._id),
                        userId: String(existingUser._id),
                    },
                    outcome: AUDIT_OUTCOMES.blockedDataIntegrity,
                    tenantId: accessCode.tenantId,
                };
            }

            if (!boundProfile.isActive) {
                return {
                    ok: false,
                    auditEvent: AUDIT_EVENT_NAMES.departmentUserDeactivated,
                    message: DEACTIVATED_DEPARTMENT_USER_MESSAGE,
                    metadata: {
                        accessCodeId: String(accessCode._id),
                        departmentId: String(department._id),
                        normalizedEmail: args.normalizedEmail,
                        tenantUserId: String(activeTenantMembership._id),
                        userId: String(existingUser._id),
                    },
                    outcome: AUDIT_OUTCOMES.blockedDeactivatedDepartmentUser,
                    tenantId: accessCode.tenantId,
                };
            }
        }
    } else if (existingDepartmentProfile) {
        return {
            ok: false,
            auditEvent: AUDIT_EVENT_NAMES.departmentUserCollision,
            message: INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
                tenantUserId: String(existingDepartmentProfile.tenantUserId),
            },
            outcome: AUDIT_OUTCOMES.blockedRoleCollision,
            tenantId: accessCode.tenantId,
        };
    }

    return {
        ok: true,
        accessCodeId: accessCode._id,
        accessMode:
            windowState.accessMode === "read_only_grace"
                ? "read_only_grace"
                : "editable",
        departmentId: department._id,
        normalizedEmail: args.normalizedEmail,
        notice: getDepartmentUserSubmissionWindowMessage({
            now,
            submissionEndsAt: department.submissionEndsAt as number,
            submissionStartsAt: department.submissionStartsAt as number,
        }),
        tenantId: accessCode.tenantId,
        userIdHint,
    };
}

export const evaluateAccessAttempt = internalQuery({
    args: {
        accessCodeId: v.optional(v.id("departmentAccessCodes")),
        normalizedAccessCode: v.optional(v.string()),
        normalizedEmail: v.string(),
        now: v.optional(v.number()),
    },
    handler: async (ctx, args) =>
        await evaluateAccessAttemptInternal(ctx, {
            accessCodeId: args.accessCodeId,
            normalizedAccessCode: args.normalizedAccessCode,
            normalizedEmail: args.normalizedEmail,
            now: args.now,
        }),
});

export const createChallenge = internalMutation({
    args: {
        accessCodeId: v.id("departmentAccessCodes"),
        accessMode: v.union(v.literal("editable"), v.literal("read_only_grace")),
        departmentId: v.id("departments"),
        normalizedEmail: v.string(),
        tenantId: v.id("tenants"),
        userIdHint: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("departmentUserAuthChallenges", {
            accessCodeId: args.accessCodeId,
            accessMode: args.accessMode,
            authUserId: args.userIdHint,
            departmentId: args.departmentId,
            expiresAt: now + DEPARTMENT_USER_ACCESS_CHALLENGE_WINDOW_MS,
            normalizedEmail: args.normalizedEmail,
            tenantId: args.tenantId,
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const getChallenge = internalQuery({
    args: {
        challengeId: v.id("departmentUserAuthChallenges"),
        now: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const now = args.now ?? Date.now();
        const challenge = await ctx.db.get(args.challengeId);
        if (!challenge || challenge.consumedAt || challenge.expiresAt < now) {
            return null;
        }

        return challenge;
    },
});

export const bindChallengeToAuthAccount = internalMutation({
    args: {
        accountId: v.id("authAccounts"),
        challengeId: v.id("departmentUserAuthChallenges"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.challengeId, {
            authAccountId: args.accountId,
            authUserId: args.userId,
            updatedAt: Date.now(),
        });
        return null;
    },
});

export const getAuthAccountForEmail = internalQuery({
    args: {
        normalizedEmail: v.string(),
    },
    handler: async (ctx, args) => {
        const account = await ctx.db
            .query("authAccounts")
            .withIndex("providerAndAccountId", (q) =>
                q.eq("provider", DEPARTMENT_USER_AUTH_PROVIDER).eq("providerAccountId", args.normalizedEmail),
            )
            .first();

        return account
            ? {
                accountId: account._id,
                userId: account.userId,
            }
            : null;
    },
});

export const recordFailedAttempt = internalMutation({
    args: {
        accessCodeHash: v.optional(v.string()),
        accessCodeId: v.optional(v.id("departmentAccessCodes")),
        normalizedEmail: v.string(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        let accessCodeHash = args.accessCodeHash;
        if (!accessCodeHash && args.accessCodeId) {
            const accessCode = await ctx.db.get(args.accessCodeId);
            accessCodeHash = accessCode?.codeHash;
        }
        if (!accessCodeHash) {
            throw new ConvexError({
                code: "INVALID_STATE",
                message: "Department User access attempt is missing an access-code fingerprint.",
            });
        }

        const existingAttempt = await loadLoginAttempt({
            accessCodeHash,
            ctx,
            normalizedEmail: args.normalizedEmail,
        });

        const failedAttempts = (existingAttempt?.failedAttempts ?? 0) + 1;
        const lockedUntil =
            failedAttempts >= DEPARTMENT_USER_ACCESS_LOCKOUT_THRESHOLD
                ? now + DEPARTMENT_USER_ACCESS_LOCKOUT_WINDOW_MS
                : undefined;

        if (existingAttempt) {
            await ctx.db.patch(existingAttempt._id, {
                accessCodeId: existingAttempt.accessCodeId ?? args.accessCodeId,
                failedAttempts,
                lastFailureAt: now,
                lockedUntil,
                updatedAt: now,
            });
        } else {
            await ctx.db.insert("departmentUserLoginAttempts", {
                accessCodeHash,
                accessCodeId: args.accessCodeId,
                createdAt: now,
                failedAttempts,
                lastFailureAt: now,
                lockedUntil,
                normalizedEmail: args.normalizedEmail,
                updatedAt: now,
            });
        }

        return {
            failedAttempts,
            lockedUntil: lockedUntil ?? null,
        };
    },
});

export const finalizeSuccessfulAccess = internalMutation({
    args: {
        challengeId: v.id("departmentUserAuthChallenges"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const challenge = await ctx.db.get(args.challengeId);
        if (!challenge || challenge.consumedAt || challenge.expiresAt < now) {
            throw new ConvexError({
                code: "INVALID_STATE",
                message: "Department User sign-in challenge expired. Start again.",
            });
        }

        const attempt = await evaluateAccessAttemptInternal(ctx, {
            accessCodeId: challenge.accessCodeId,
            normalizedEmail: challenge.normalizedEmail,
            now,
        });
        if (!attempt.ok) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: attempt.message,
            });
        }

        const [platformMemberships, tenantMemberships] = await Promise.all([
            ctx.db
                .query("platformUsers")
                .withIndex("by_userId", (q) => q.eq("userId", args.userId))
                .collect(),
            ctx.db
                .query("tenantUsers")
                .withIndex("by_userId", (q) => q.eq("userId", args.userId))
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
                code: "UNAUTHORIZED",
                message: INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
            });
        }

        let tenantUserId = activeTenantMemberships[0]?._id;
        const createdTenantUser = activeTenantMemberships.length === 0;
        if (activeTenantMemberships.length === 1) {
            const existingTenantUser = activeTenantMemberships.at(0);
            if (existingTenantUser === undefined) {
                throw new ConvexError({
                    code: "UNAUTHORIZED",
                    message: INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                });
            }
            if (
                existingTenantUser.role !== "department_user" ||
                existingTenantUser.tenantId !== challenge.tenantId
            ) {
                throw new ConvexError({
                    code: "UNAUTHORIZED",
                    message: INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                });
            }
        } else {
            tenantUserId = await ctx.db.insert("tenantUsers", {
                isActive: true,
                role: "department_user",
                tenantId: challenge.tenantId,
                userId: args.userId,
            });
        }

        if (!tenantUserId) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
            });
        }

        const existingProfile = await loadProfileByTenantUserId(ctx, tenantUserId);
        if (existingProfile) {
            if (
                !existingProfile.isActive ||
                existingProfile.departmentId !== challenge.departmentId ||
                existingProfile.normalizedEmail !== challenge.normalizedEmail
            ) {
                if (existingProfile.isActive) {
                    await appendAuditLogBestEffort(
                        ctx,
                        createAuditEntry({
                            actorUserId: args.userId,
                            event: AUDIT_EVENT_NAMES.departmentUserDataIntegrity,
                            metadata: {
                                challengeId: String(challenge._id),
                                departmentId: String(challenge.departmentId),
                                integrityReason: "tenant_user_profile_scope_mismatch",
                                normalizedEmail: challenge.normalizedEmail,
                                tenantUserId: String(tenantUserId),
                            },
                            outcome: AUDIT_OUTCOMES.blockedDataIntegrity,
                            targetTenantId: challenge.tenantId,
                        }),
                    );
                }

                throw new ConvexError({
                    code: "UNAUTHORIZED",
                    message: existingProfile.isActive
                        ? INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE
                        : DEACTIVATED_DEPARTMENT_USER_MESSAGE,
                });
            }

            await ctx.db.patch(existingProfile._id, {
                lastAuthenticatedAt: now,
                updatedAt: now,
            });
        } else {
            if (!createdTenantUser) {
                await appendAuditLogBestEffort(
                    ctx,
                    createAuditEntry({
                        actorUserId: args.userId,
                        event: AUDIT_EVENT_NAMES.departmentUserDataIntegrity,
                        metadata: {
                            challengeId: String(challenge._id),
                            departmentId: String(challenge.departmentId),
                            integrityReason: "tenant_user_missing_department_profile",
                            normalizedEmail: challenge.normalizedEmail,
                            tenantUserId: String(tenantUserId),
                        },
                        outcome: AUDIT_OUTCOMES.blockedDataIntegrity,
                        targetTenantId: challenge.tenantId,
                    }),
                );

                throw new ConvexError({
                    code: "UNAUTHORIZED",
                    message: INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                });
            }

            await ctx.db.insert("departmentUserProfiles", {
                createdAt: now,
                departmentId: challenge.departmentId,
                isActive: true,
                lastAuthenticatedAt: now,
                normalizedEmail: challenge.normalizedEmail,
                tenantId: challenge.tenantId,
                tenantUserId,
                updatedAt: now,
            });
        }

        const accessCode = await ctx.db.get(challenge.accessCodeId);
        const loginAttempt =
            accessCode === null
                ? null
                : await loadLoginAttempt({
                    accessCodeHash: accessCode.codeHash,
                    ctx,
                    normalizedEmail: challenge.normalizedEmail,
                });
        if (loginAttempt) {
            await ctx.db.patch(loginAttempt._id, {
                failedAttempts: 0,
                lockedUntil: undefined,
                updatedAt: now,
            });
        }

        await ctx.db.patch(challenge._id, {
            consumedAt: now,
            updatedAt: now,
        });

        const concurrentSessions = await ctx.db
            .query("authSessions")
            .withIndex("userId", (q) => q.eq("userId", args.userId))
            .collect();

        await appendAuditLogBestEffort(
            ctx,
            createAuditEntry({
                actorUserId: args.userId,
                event: AUDIT_EVENT_NAMES.departmentUserChallengeVerified,
                metadata: {
                    accessCodeId: String(challenge.accessCodeId),
                    accessMode: challenge.accessMode,
                    concurrentSessionCount: concurrentSessions.length,
                    departmentId: String(challenge.departmentId),
                    highConcurrencyDetected: concurrentSessions.length > 10,
                    normalizedEmail: challenge.normalizedEmail,
                },
                outcome: AUDIT_OUTCOMES.allowed,
                targetTenantId: challenge.tenantId,
            }),
        );

        return {
            accessMode: challenge.accessMode,
            departmentId: challenge.departmentId,
            tenantId: challenge.tenantId,
        };
    },
});

export const bootstrapDepartmentAccessCode = internalMutation({
    args: {
        accessCode: v.string(),
        departmentCode: v.string(),
        departmentName: v.string(),
        expiresAt: v.number(),
        procurementOfficerTenantUserId: v.id("tenantUsers"),
        submissionEndsAt: v.number(),
        submissionStartsAt: v.number(),
        tenantId: v.id("tenants"),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const normalizedAccessCode = normalizeDepartmentUserAccessCode(args.accessCode);
        const codeHash = await hashDepartmentUserAccessCode(normalizedAccessCode);
        const code = normalizeDepartmentCode(args.departmentCode);
        const name = args.departmentName.trim();
        const departmentId = await ctx.db.insert("departments", {
            code,
            createdAt: now,
            isActive: true,
            name,
            normalizedCode: code,
            normalizedName: normalizeDepartmentName(name),
            procurementOfficerTenantUserId: args.procurementOfficerTenantUserId,
            submissionEndsAt: args.submissionEndsAt,
            submissionStartsAt: args.submissionStartsAt,
            tenantId: args.tenantId,
            updatedAt: now,
        });
        const accessCodeId = await ctx.db.insert("departmentAccessCodes", {
            codeHash,
            codeSuffix: getDepartmentUserAccessCodeSuffix(normalizedAccessCode),
            createdAt: now,
            departmentId,
            expiresAt: args.expiresAt,
            isActive: true,
            tenantId: args.tenantId,
            updatedAt: now,
        });

        return {
            accessCodeId,
            departmentId,
        };
    },
});

export const startAccessChallenge = action({
    args: {
        accessCode: v.string(),
        email: v.string(),
    },
    returns: v.object({
        accessMode: v.union(v.literal("editable"), v.literal("read_only_grace")),
        challengeId: v.id("departmentUserAuthChallenges"),
        notice: v.union(v.string(), v.null()),
        verificationExpiresAt: v.number(),
    }),
    handler: async (ctx, args) => {
        const emailResult = validateEmailInput(args.email);
        if (!emailResult.ok) {
            throw new Error(emailResult.issue.message);
        }

        const accessCodeResult = validateDepartmentUserAccessCodeInput(
            args.accessCode,
        );
        if (!accessCodeResult.ok) {
            throw new Error(accessCodeResult.issue.message);
        }

        const normalizedEmail = normalizeAuthEmail(emailResult.value);
        const normalizedAccessCode = accessCodeResult.value;
        const attempt: AccessAttemptResult = await ctx.runQuery(
            "functions/departmentUserAuth:evaluateAccessAttempt" as any,
            {
                normalizedAccessCode,
                normalizedEmail,
            },
        );

        if (!attempt.ok) {
            let failureEvent = attempt.auditEvent;
            let failureMessage = attempt.message;
            let failureMetadata: Record<string, unknown> = {
                normalizedEmail,
                ...attempt.metadata,
            };
            let failureOutcome = attempt.outcome;

            if (attempt.auditEvent === AUDIT_EVENT_NAMES.departmentUserInvalid) {
                const failureState = await ctx.runMutation(
                    "functions/departmentUserAuth:recordFailedAttempt" as any,
                    {
                        accessCodeHash: await hashDepartmentUserAccessCode(normalizedAccessCode),
                        normalizedEmail,
                    },
                );

                failureMetadata = {
                    ...failureMetadata,
                    failedAttempts: failureState.failedAttempts,
                    lockedUntil: failureState.lockedUntil,
                };

                if (failureState.lockedUntil) {
                    const lockoutState = getDepartmentUserLockoutState({
                        failedAttempts: failureState.failedAttempts,
                        lockedUntil: failureState.lockedUntil,
                    });
                    failureEvent = AUDIT_EVENT_NAMES.departmentUserLockedOut;
                    failureMessage = formatDepartmentUserLockoutMessage(
                        lockoutState.remainingMs,
                    );
                    failureOutcome = AUDIT_OUTCOMES.blockedLockedOut;
                }
            }

            await queueAuditFromAction(
                ctx,
                createAuditEntry({
                    event: failureEvent,
                    metadata: failureMetadata,
                    outcome: failureOutcome,
                    targetTenantId: attempt.tenantId,
                }),
            ).catch(() => undefined);
            throw new Error(failureMessage);
        }

        const challengeId: Id<"departmentUserAuthChallenges"> = await ctx.runMutation(
            "functions/departmentUserAuth:createChallenge" as any,
            {
                accessCodeId: attempt.accessCodeId,
                accessMode: attempt.accessMode,
                departmentId: attempt.departmentId,
                normalizedEmail,
                tenantId: attempt.tenantId,
                userIdHint: attempt.userIdHint,
            },
        );

        await ctx.runAction("auth:signIn" as any, {
            calledBy: "department-user-access-start",
            params: {
                challengeId,
                flow: "otp-start",
            },
            provider: DEPARTMENT_USER_AUTH_PROVIDER,
        });

        await queueAuditFromAction(
            ctx,
            createAuditEntry({
                event: AUDIT_EVENT_NAMES.departmentUserChallengeStarted,
                metadata: {
                    accessCodeId: String(attempt.accessCodeId),
                    accessMode: attempt.accessMode,
                    challengeId: String(challengeId),
                    departmentId: String(attempt.departmentId),
                    normalizedEmail,
                },
                outcome: AUDIT_OUTCOMES.allowed,
                targetTenantId: attempt.tenantId,
            }),
        ).catch(() => undefined);

        return {
            accessMode: attempt.accessMode,
            challengeId,
            notice: attempt.notice,
            verificationExpiresAt:
                Date.now() + DEPARTMENT_USER_ACCESS_CHALLENGE_WINDOW_MS,
        };
    },
});

export async function startDepartmentUserOtpChallenge(
    ctx: ActionCtx,
    challengeId: Id<"departmentUserAuthChallenges">,
): Promise<null> {
    const challenge = await ctx.runQuery(
        "functions/departmentUserAuth:getChallenge" as any,
        { challengeId },
    );
    if (!challenge) {
        throw new Error("Department User sign-in challenge expired. Start again.");
    }

    let authAccount = challenge.authAccountId
        ? {
            accountId: challenge.authAccountId,
            userId: challenge.authUserId!,
        }
        : await ctx.runQuery("functions/departmentUserAuth:getAuthAccountForEmail" as any, {
            normalizedEmail: challenge.normalizedEmail,
        });

    if (!authAccount) {
        const created = await createAccount(ctx, {
            account: {
                id: challenge.normalizedEmail,
            },
            profile: {
                email: challenge.normalizedEmail,
            },
            provider: DEPARTMENT_USER_AUTH_PROVIDER,
            shouldLinkViaEmail: true,
        });

        authAccount = {
            accountId: created.account._id,
            userId: created.user._id,
        };
    }

    await ctx.runMutation(
        "functions/departmentUserAuth:bindChallengeToAuthAccount" as any,
        {
            accountId: authAccount.accountId,
            challengeId,
            userId: authAccount.userId,
        },
    );

    await signInViaProvider(ctx, ResendOTP, {
        accountId: authAccount.accountId,
        params: {
            email: challenge.normalizedEmail,
        },
    });

    return null;
}

export async function verifyDepartmentUserOtpChallenge(
    ctx: ActionCtx,
    args: {
        challengeId: Id<"departmentUserAuthChallenges">;
        code: string;
    },
): Promise<{
    sessionId: Id<"authSessions">;
    userId: Id<"users">;
}> {
    const challenge = await ctx.runQuery(
        "functions/departmentUserAuth:getChallenge" as any,
        { challengeId: args.challengeId },
    );

    if (!challenge || !challenge.authAccountId) {
        throw new Error("Department User sign-in challenge expired. Start again.");
    }

    const attempt: AccessAttemptResult = await ctx.runQuery(
        "functions/departmentUserAuth:evaluateAccessAttempt" as any,
        {
            accessCodeId: challenge.accessCodeId,
            normalizedEmail: challenge.normalizedEmail,
        },
    );
    if (!attempt.ok) {
        await queueAuditFromAction(
            ctx,
            createAuditEntry({
                event: attempt.auditEvent,
                metadata: {
                    challengeId: String(challenge._id),
                    normalizedEmail: challenge.normalizedEmail,
                    ...attempt.metadata,
                },
                outcome: attempt.outcome,
                targetTenantId: attempt.tenantId,
            }),
        ).catch(() => undefined);
        throw new Error(attempt.message);
    }

    let signedIn: Awaited<ReturnType<typeof signInViaProvider>> | null = null;
    try {
        signedIn = await signInViaProvider(ctx, ResendOTP, {
            accountId: challenge.authAccountId,
            params: {
                code: args.code,
                email: challenge.normalizedEmail,
            },
        });
    } catch (error) {
        if (!isDepartmentUserOtpProviderFailureMessage(getErrorMessage(error))) {
            throw error;
        }
    }

    if (!signedIn) {
        const failureState = await ctx.runMutation(
            "functions/departmentUserAuth:recordFailedAttempt" as any,
            {
                accessCodeId: challenge.accessCodeId,
                normalizedEmail: challenge.normalizedEmail,
            },
        );

        await queueAuditFromAction(
            ctx,
            createAuditEntry({
                event:
                    failureState.lockedUntil
                        ? AUDIT_EVENT_NAMES.departmentUserLockedOut
                        : AUDIT_EVENT_NAMES.departmentUserInvalid,
                metadata: {
                    accessCodeId: String(challenge.accessCodeId),
                    challengeId: String(challenge._id),
                    failedAttempts: failureState.failedAttempts,
                    lockedUntil: failureState.lockedUntil,
                    normalizedEmail: challenge.normalizedEmail,
                },
                outcome:
                    failureState.lockedUntil
                        ? AUDIT_OUTCOMES.blockedLockedOut
                        : AUDIT_OUTCOMES.blockedInvalidAccessCode,
                targetTenantId: challenge.tenantId,
            }),
        ).catch(() => undefined);

        if (failureState.lockedUntil) {
            const lockoutState = getDepartmentUserLockoutState({
                failedAttempts: failureState.failedAttempts,
                lockedUntil: failureState.lockedUntil,
            });
            throw new Error(
                formatDepartmentUserLockoutMessage(lockoutState.remainingMs),
            );
        }

        throw new Error(DEPARTMENT_USER_INVALID_VERIFICATION_CODE_MESSAGE);
    }

    await ctx.runMutation(
        "functions/departmentUserAuth:finalizeSuccessfulAccess" as any,
        {
            challengeId: challenge._id,
            userId: signedIn.userId,
        },
    );

    return signedIn;
}
