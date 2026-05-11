"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyDepartmentUserOtpChallenge = exports.startDepartmentUserOtpChallenge = exports.startAccessChallenge = exports.bootstrapDepartmentAccessCode = exports.finalizeSuccessfulAccess = exports.recordFailedAttempt = exports.getAuthAccountForEmail = exports.bindChallengeToAuthAccount = exports.getChallenge = exports.createChallenge = exports.getAccessCodeForNormalizedCode = exports.evaluateAccessAttempt = void 0;
const server_1 = require("@convex-dev/auth/server");
const values_1 = require("convex/values");
const server_2 = require("../_generated/server");
const audit_1 = require("../../lib/shared/security/audit");
const department_user_access_1 = require("../../lib/shared/auth/department-user-access");
const department_user_request_context_token_1 = require("../../lib/backend/auth/department-user-request-context-token");
const departments_1 = require("../../lib/procurement-officer/departments");
const deadlines_1 = require("../../lib/procurement-officer/deadlines");
const input_1 = require("../../lib/shared/security/input");
const accessCodes_1 = require("./accessCodes");
const _audit_1 = require("./_audit");
const ResendOTP_1 = require("../ResendOTP");
function getErrorMessage(error) {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message.trim();
    }
    return null;
}
function createAuditEntry(args) {
    return {
        action: "authenticate",
        actor: args.actorUserId
            ? (0, audit_1.createAuthenticatedAuditActor)({
                role: "department_user",
                userId: String(args.actorUserId),
            })
            : (0, audit_1.createAnonymousAuditActor)(),
        entityType: "department_user_access",
        event: args.event,
        metadata: args.metadata,
        outcome: args.outcome,
        targetTenantId: args.targetTenantId ? String(args.targetTenantId) : undefined,
        timestamp: Date.now(),
    };
}
async function queueAuditFromAction(ctx, entry) {
    await ctx.runMutation("functions/auditLogs:appendAuditLogFromAction", (0, audit_1.serializeAuditEvent)(entry));
}
async function resolveDepartmentUserRequestOrigin(signedRequestContext) {
    if (!signedRequestContext) {
        return {
            requestOriginStatus: "unavailable",
        };
    }
    try {
        const requestContext = await (0, department_user_request_context_token_1.verifySignedDepartmentUserRequestContext)(signedRequestContext);
        return {
            ipAddress: requestContext.ipAddress ?? undefined,
            requestOriginStatus: "captured",
            userAgent: requestContext.userAgent ?? undefined,
        };
    }
    catch (error) {
        if (error instanceof department_user_request_context_token_1.DepartmentUserRequestContextSignatureError) {
            return {
                requestOriginStatus: "unavailable",
            };
        }
        return {
            requestOriginStatus: "unavailable",
        };
    }
}
async function lookupAccessCodeByNormalizedCode(ctx, normalizedAccessCode) {
    const codeHash = await (0, department_user_access_1.hashDepartmentUserAccessCode)(normalizedAccessCode);
    return await ctx.db
        .query("departmentAccessCodes")
        .withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash))
        .unique();
}
async function loadLoginAttempt(args) {
    return await args.ctx.db
        .query("departmentUserLoginAttempts")
        .withIndex("by_email_accessCodeHash", (q) => q.eq("normalizedEmail", args.normalizedEmail).eq("accessCodeHash", args.accessCodeHash))
        .first();
}
async function loadProfileByTenantUserId(ctx, tenantUserId) {
    return await ctx.db
        .query("departmentUserProfiles")
        .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", tenantUserId))
        .first();
}
async function evaluateAccessAttemptInternal(ctx, args) {
    const now = args.now ?? Date.now();
    const accessCode = args.accessCodeId !== undefined
        ? await ctx.db.get(args.accessCodeId)
        : await lookupAccessCodeByNormalizedCode(ctx, args.normalizedAccessCode ?? "");
    const accessCodeHash = accessCode?.codeHash ??
        (args.normalizedAccessCode
            ? await (0, department_user_access_1.hashDepartmentUserAccessCode)(args.normalizedAccessCode)
            : null);
    const lockout = accessCodeHash === null
        ? null
        : await loadLoginAttempt({
            accessCodeHash,
            ctx,
            normalizedEmail: args.normalizedEmail,
        });
    const lockoutState = (0, department_user_access_1.getDepartmentUserLockoutState)({
        failedAttempts: lockout?.failedAttempts ?? 0,
        lockedUntil: lockout?.lockedUntil,
        now,
    });
    if (lockoutState.isLockedOut) {
        return {
            ok: false,
            auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserLockedOut,
            message: (0, department_user_access_1.formatDepartmentUserLockoutMessage)(lockoutState.remainingMs),
            metadata: {
                accessCodeHash,
                accessCodeId: accessCode ? String(accessCode._id) : undefined,
                lockedUntil: lockoutState.lockedUntil,
                normalizedEmail: args.normalizedEmail,
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedLockedOut,
            tenantId: accessCode?.tenantId,
        };
    }
    if (!accessCode) {
        return {
            ok: false,
            auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserInvalid,
            message: department_user_access_1.INVALID_ACCESS_CODE_MESSAGE,
            outcome: audit_1.AUDIT_OUTCOMES.blockedInvalidAccessCode,
        };
    }
    const department = await ctx.db.get(accessCode.departmentId);
    if (!department || department.tenantId !== accessCode.tenantId) {
        return {
            ok: false,
            auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserInvalid,
            message: department_user_access_1.INVALID_ACCESS_CODE_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                normalizedEmail: args.normalizedEmail,
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedInvalidAccessCode,
            tenantId: accessCode.tenantId,
        };
    }
    const tenant = await ctx.db.get(accessCode.tenantId);
    const deadlineTimeZone = (0, deadlines_1.resolveDeadlineTimeZone)({
        tenantTimeZone: tenant?.timeZone,
    }).timeZone;
    if (!tenant || tenant.status !== "active") {
        return {
            ok: false,
            auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserTenantInactive,
            message: department_user_access_1.SUBSCRIPTION_INACTIVE_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedSubscriptionInactive,
            tenantId: accessCode.tenantId,
        };
    }
    if (!department.isActive || !accessCode.isActive || accessCode.expiresAt < now) {
        return {
            ok: false,
            auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserExpired,
            message: department_user_access_1.EXPIRED_ACCESS_CODE_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedExpiredAccessCode,
            tenantId: accessCode.tenantId,
        };
    }
    const existingDepartmentProfile = await ctx.db
        .query("departmentUserProfiles")
        .withIndex("by_departmentId_email", (q) => q.eq("departmentId", department._id).eq("normalizedEmail", args.normalizedEmail))
        .first();
    if (existingDepartmentProfile && !existingDepartmentProfile.isActive) {
        return {
            ok: false,
            auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserDeactivated,
            message: department_user_access_1.DEACTIVATED_DEPARTMENT_USER_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
                tenantUserId: String(existingDepartmentProfile.tenantUserId),
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedDeactivatedDepartmentUser,
            tenantId: accessCode.tenantId,
        };
    }
    if (!(0, department_user_access_1.hasConfiguredDepartmentUserSubmissionWindow)({
        submissionEndsAt: department.submissionEndsAt,
        submissionStartsAt: department.submissionStartsAt,
    })) {
        return {
            ok: false,
            auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserWindowBlocked,
            message: department_user_access_1.DEPARTMENT_USER_SETUP_REQUIRED_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
                windowState: "setup_required",
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedSubmissionWindow,
            tenantId: accessCode.tenantId,
        };
    }
    const windowState = (0, department_user_access_1.evaluateDepartmentUserSubmissionWindow)({
        now,
        submissionEndsAt: department.submissionEndsAt,
        submissionStartsAt: department.submissionStartsAt,
    });
    if (windowState.state === "not_started" || windowState.state === "ended") {
        return {
            ok: false,
            auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserWindowBlocked,
            message: (0, department_user_access_1.getDepartmentUserSubmissionWindowMessage)({
                now,
                submissionEndsAt: department.submissionEndsAt,
                submissionStartsAt: department.submissionStartsAt,
                timeZone: deadlineTimeZone,
            }) ?? department_user_access_1.DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
                windowState: windowState.state,
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedSubmissionWindow,
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
            auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserCollision,
            message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
                userCount: emailUsers.length,
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedRoleCollision,
            tenantId: accessCode.tenantId,
        };
    }
    let userIdHint;
    if (emailUsers.length === 1) {
        const existingUser = emailUsers.at(0);
        if (existingUser === undefined) {
            return {
                ok: false,
                auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserCollision,
                message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                outcome: audit_1.AUDIT_OUTCOMES.blockedRoleCollision,
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
        const activePlatformMemberships = platformMemberships.filter((membership) => membership.isActive);
        const activeTenantMemberships = tenantMemberships.filter((membership) => membership.isActive);
        if (activePlatformMemberships.length > 0 ||
            activeTenantMemberships.length > 1) {
            return {
                ok: false,
                auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserCollision,
                message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                metadata: {
                    accessCodeId: String(accessCode._id),
                    departmentId: String(department._id),
                    normalizedEmail: args.normalizedEmail,
                    userId: String(existingUser._id),
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedRoleCollision,
                tenantId: accessCode.tenantId,
            };
        }
        if (activeTenantMemberships.length === 0 && existingDepartmentProfile) {
            return {
                ok: false,
                auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserDataIntegrity,
                message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                metadata: {
                    accessCodeId: String(accessCode._id),
                    departmentId: String(department._id),
                    normalizedEmail: args.normalizedEmail,
                    integrityReason: "department_profile_without_active_tenant_user",
                    tenantUserId: String(existingDepartmentProfile.tenantUserId),
                    userId: String(existingUser._id),
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedDataIntegrity,
                tenantId: accessCode.tenantId,
            };
        }
        if (activeTenantMemberships.length === 1) {
            const activeTenantMembership = activeTenantMemberships.at(0);
            if (activeTenantMembership === undefined) {
                return {
                    ok: false,
                    auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserCollision,
                    message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                    outcome: audit_1.AUDIT_OUTCOMES.blockedRoleCollision,
                    tenantId: accessCode.tenantId,
                };
            }
            if (activeTenantMembership.role !== "department_user" ||
                activeTenantMembership.tenantId !== accessCode.tenantId) {
                return {
                    ok: false,
                    auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserCollision,
                    message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                    metadata: {
                        accessCodeId: String(accessCode._id),
                        departmentId: String(department._id),
                        normalizedEmail: args.normalizedEmail,
                        tenantUserId: String(activeTenantMembership._id),
                        userId: String(existingUser._id),
                    },
                    outcome: audit_1.AUDIT_OUTCOMES.blockedRoleCollision,
                    tenantId: accessCode.tenantId,
                };
            }
            const boundProfile = await loadProfileByTenantUserId(ctx, activeTenantMembership._id);
            if (boundProfile === null && existingDepartmentProfile) {
                return {
                    ok: false,
                    auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserDataIntegrity,
                    message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                    metadata: {
                        accessCodeId: String(accessCode._id),
                        departmentId: String(department._id),
                        normalizedEmail: args.normalizedEmail,
                        integrityReason: "department_profile_tenant_user_mismatch",
                        tenantUserId: String(activeTenantMembership._id),
                        userId: String(existingUser._id),
                    },
                    outcome: audit_1.AUDIT_OUTCOMES.blockedDataIntegrity,
                    tenantId: accessCode.tenantId,
                };
            }
            if (boundProfile &&
                (boundProfile.departmentId !== department._id ||
                    boundProfile.normalizedEmail !== args.normalizedEmail)) {
                return {
                    ok: false,
                    auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserDataIntegrity,
                    message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                    metadata: {
                        accessCodeId: String(accessCode._id),
                        departmentId: String(department._id),
                        normalizedEmail: args.normalizedEmail,
                        integrityReason: "tenant_user_profile_scope_mismatch",
                        tenantUserId: String(activeTenantMembership._id),
                        userId: String(existingUser._id),
                    },
                    outcome: audit_1.AUDIT_OUTCOMES.blockedDataIntegrity,
                    tenantId: accessCode.tenantId,
                };
            }
            if (boundProfile && !boundProfile.isActive) {
                return {
                    ok: false,
                    auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserDeactivated,
                    message: department_user_access_1.DEACTIVATED_DEPARTMENT_USER_MESSAGE,
                    metadata: {
                        accessCodeId: String(accessCode._id),
                        departmentId: String(department._id),
                        normalizedEmail: args.normalizedEmail,
                        tenantUserId: String(activeTenantMembership._id),
                        userId: String(existingUser._id),
                    },
                    outcome: audit_1.AUDIT_OUTCOMES.blockedDeactivatedDepartmentUser,
                    tenantId: accessCode.tenantId,
                };
            }
        }
    }
    else if (existingDepartmentProfile) {
        return {
            ok: false,
            auditEvent: audit_1.AUDIT_EVENT_NAMES.departmentUserCollision,
            message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
            metadata: {
                accessCodeId: String(accessCode._id),
                departmentId: String(department._id),
                normalizedEmail: args.normalizedEmail,
                tenantUserId: String(existingDepartmentProfile.tenantUserId),
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedRoleCollision,
            tenantId: accessCode.tenantId,
        };
    }
    return {
        ok: true,
        accessCodeId: accessCode._id,
        accessMode: windowState.accessMode === "read_only_grace"
            ? "read_only_grace"
            : "editable",
        departmentId: department._id,
        normalizedEmail: args.normalizedEmail,
        notice: (0, department_user_access_1.getDepartmentUserSubmissionWindowMessage)({
            now,
            submissionEndsAt: department.submissionEndsAt,
            submissionStartsAt: department.submissionStartsAt,
            timeZone: deadlineTimeZone,
        }),
        tenantId: accessCode.tenantId,
        userIdHint,
    };
}
exports.evaluateAccessAttempt = (0, server_2.internalQuery)({
    args: {
        accessCodeId: values_1.v.optional(values_1.v.id("departmentAccessCodes")),
        normalizedAccessCode: values_1.v.optional(values_1.v.string()),
        normalizedEmail: values_1.v.string(),
        now: values_1.v.optional(values_1.v.number()),
    },
    handler: async (ctx, args) => await evaluateAccessAttemptInternal(ctx, {
        accessCodeId: args.accessCodeId,
        normalizedAccessCode: args.normalizedAccessCode,
        normalizedEmail: args.normalizedEmail,
        now: args.now,
    }),
});
exports.getAccessCodeForNormalizedCode = (0, server_2.internalQuery)({
    args: {
        normalizedAccessCode: values_1.v.string(),
    },
    returns: values_1.v.union(values_1.v.null(), values_1.v.object({
        accessCodeId: values_1.v.id("departmentAccessCodes"),
        departmentId: values_1.v.id("departments"),
        tenantId: values_1.v.id("tenants"),
    })),
    handler: async (ctx, args) => {
        const accessCode = await lookupAccessCodeByNormalizedCode(ctx, args.normalizedAccessCode);
        if (!accessCode) {
            return null;
        }
        return {
            accessCodeId: accessCode._id,
            departmentId: accessCode.departmentId,
            tenantId: accessCode.tenantId,
        };
    },
});
exports.createChallenge = (0, server_2.internalMutation)({
    args: {
        accessCodeId: values_1.v.id("departmentAccessCodes"),
        accessMode: values_1.v.union(values_1.v.literal("editable"), values_1.v.literal("read_only_grace")),
        departmentId: values_1.v.id("departments"),
        normalizedEmail: values_1.v.string(),
        tenantId: values_1.v.id("tenants"),
        userIdHint: values_1.v.optional(values_1.v.id("users")),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("departmentUserAuthChallenges", {
            accessCodeId: args.accessCodeId,
            accessMode: args.accessMode,
            authUserId: args.userIdHint,
            departmentId: args.departmentId,
            expiresAt: now + department_user_access_1.DEPARTMENT_USER_ACCESS_CHALLENGE_WINDOW_MS,
            normalizedEmail: args.normalizedEmail,
            tenantId: args.tenantId,
            createdAt: now,
            updatedAt: now,
        });
    },
});
exports.getChallenge = (0, server_2.internalQuery)({
    args: {
        challengeId: values_1.v.id("departmentUserAuthChallenges"),
        now: values_1.v.optional(values_1.v.number()),
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
exports.bindChallengeToAuthAccount = (0, server_2.internalMutation)({
    args: {
        accountId: values_1.v.id("authAccounts"),
        challengeId: values_1.v.id("departmentUserAuthChallenges"),
        userId: values_1.v.id("users"),
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
exports.getAuthAccountForEmail = (0, server_2.internalQuery)({
    args: {
        normalizedEmail: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const account = await ctx.db
            .query("authAccounts")
            .withIndex("providerAndAccountId", (q) => q.eq("provider", department_user_access_1.DEPARTMENT_USER_AUTH_PROVIDER).eq("providerAccountId", args.normalizedEmail))
            .first();
        return account
            ? {
                accountId: account._id,
                userId: account.userId,
            }
            : null;
    },
});
exports.recordFailedAttempt = (0, server_2.internalMutation)({
    args: {
        accessCodeHash: values_1.v.optional(values_1.v.string()),
        accessCodeId: values_1.v.optional(values_1.v.id("departmentAccessCodes")),
        normalizedEmail: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        let accessCodeHash = args.accessCodeHash;
        if (!accessCodeHash && args.accessCodeId) {
            const accessCode = await ctx.db.get(args.accessCodeId);
            accessCodeHash = accessCode?.codeHash;
        }
        if (!accessCodeHash) {
            throw new values_1.ConvexError({
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
        const lockedUntil = failedAttempts >= department_user_access_1.DEPARTMENT_USER_ACCESS_LOCKOUT_THRESHOLD
            ? now + department_user_access_1.DEPARTMENT_USER_ACCESS_LOCKOUT_WINDOW_MS
            : undefined;
        if (existingAttempt) {
            await ctx.db.patch(existingAttempt._id, {
                accessCodeId: existingAttempt.accessCodeId ?? args.accessCodeId,
                failedAttempts,
                lastFailureAt: now,
                lockedUntil,
                updatedAt: now,
            });
        }
        else {
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
exports.finalizeSuccessfulAccess = (0, server_2.internalMutation)({
    args: {
        challengeId: values_1.v.id("departmentUserAuthChallenges"),
        ipAddress: values_1.v.optional(values_1.v.string()),
        requestOriginStatus: values_1.v.optional(values_1.v.union(values_1.v.literal("captured"), values_1.v.literal("unavailable"))),
        userId: values_1.v.id("users"),
        userAgent: values_1.v.optional(values_1.v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const challenge = await ctx.db.get(args.challengeId);
        if (!challenge || challenge.consumedAt || challenge.expiresAt < now) {
            throw new values_1.ConvexError({
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
            throw new values_1.ConvexError({
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
        const activePlatformMemberships = platformMemberships.filter((membership) => membership.isActive);
        const activeTenantMemberships = tenantMemberships.filter((membership) => membership.isActive);
        if (activePlatformMemberships.length > 0 ||
            activeTenantMemberships.length > 1) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
            });
        }
        let tenantUserId = activeTenantMemberships[0]?._id;
        const createdTenantUser = activeTenantMemberships.length === 0;
        if (activeTenantMemberships.length === 1) {
            const existingTenantUser = activeTenantMemberships.at(0);
            if (existingTenantUser === undefined) {
                throw new values_1.ConvexError({
                    code: "UNAUTHORIZED",
                    message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                });
            }
            if (existingTenantUser.role !== "department_user" ||
                existingTenantUser.tenantId !== challenge.tenantId) {
                throw new values_1.ConvexError({
                    code: "UNAUTHORIZED",
                    message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
                });
            }
        }
        else {
            tenantUserId = await ctx.db.insert("tenantUsers", {
                isActive: true,
                role: "department_user",
                tenantId: challenge.tenantId,
                userId: args.userId,
            });
        }
        if (!tenantUserId) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
            });
        }
        const existingProfile = await loadProfileByTenantUserId(ctx, tenantUserId);
        if (existingProfile) {
            if (!existingProfile.isActive ||
                existingProfile.departmentId !== challenge.departmentId ||
                existingProfile.normalizedEmail !== challenge.normalizedEmail) {
                if (existingProfile.isActive) {
                    await (0, _audit_1.appendAuditLogBestEffort)(ctx, createAuditEntry({
                        actorUserId: args.userId,
                        event: audit_1.AUDIT_EVENT_NAMES.departmentUserDataIntegrity,
                        metadata: {
                            challengeId: String(challenge._id),
                            departmentId: String(challenge.departmentId),
                            integrityReason: "tenant_user_profile_scope_mismatch",
                            normalizedEmail: challenge.normalizedEmail,
                            tenantUserId: String(tenantUserId),
                        },
                        outcome: audit_1.AUDIT_OUTCOMES.blockedDataIntegrity,
                        targetTenantId: challenge.tenantId,
                    }));
                }
                throw new values_1.ConvexError({
                    code: "UNAUTHORIZED",
                    message: existingProfile.isActive
                        ? department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE
                        : department_user_access_1.DEACTIVATED_DEPARTMENT_USER_MESSAGE,
                });
            }
            await ctx.db.patch(existingProfile._id, {
                lastAuthenticatedAt: now,
                updatedAt: now,
            });
        }
        else {
            const existingDepartmentProfile = await ctx.db
                .query("departmentUserProfiles")
                .withIndex("by_departmentId_email", (q) => q.eq("departmentId", challenge.departmentId).eq("normalizedEmail", challenge.normalizedEmail))
                .first();
            if (existingDepartmentProfile) {
                await (0, _audit_1.appendAuditLogBestEffort)(ctx, createAuditEntry({
                    actorUserId: args.userId,
                    event: audit_1.AUDIT_EVENT_NAMES.departmentUserDataIntegrity,
                    metadata: {
                        challengeId: String(challenge._id),
                        departmentId: String(challenge.departmentId),
                        integrityReason: "department_profile_tenant_user_mismatch",
                        normalizedEmail: challenge.normalizedEmail,
                        tenantUserId: String(tenantUserId),
                    },
                    outcome: audit_1.AUDIT_OUTCOMES.blockedDataIntegrity,
                    targetTenantId: challenge.tenantId,
                }));
                throw new values_1.ConvexError({
                    code: "UNAUTHORIZED",
                    message: department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
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
        const loginAttempt = accessCode === null
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
        await (0, _audit_1.appendAuditLogBestEffort)(ctx, createAuditEntry({
            actorUserId: args.userId,
            event: audit_1.AUDIT_EVENT_NAMES.departmentUserChallengeVerified,
            metadata: {
                accessCodeId: String(challenge.accessCodeId),
                accessMode: challenge.accessMode,
                concurrentSessionCount: concurrentSessions.length,
                departmentId: String(challenge.departmentId),
                highConcurrencyDetected: concurrentSessions.length > 10,
                normalizedEmail: challenge.normalizedEmail,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            targetTenantId: challenge.tenantId,
        }));
        await (0, accessCodes_1.appendDepartmentAccessCodeEventBestEffort)(ctx, {
            accessCodeId: challenge.accessCodeId,
            actorUserId: args.userId,
            departmentId: challenge.departmentId,
            event: "login_success",
            normalizedEmail: challenge.normalizedEmail,
            outcome: "allowed",
            requestOrigin: {
                ipAddress: args.ipAddress,
                requestOriginStatus: args.requestOriginStatus ?? "unavailable",
                userAgent: args.userAgent,
            },
            message: "Department User verification succeeded.",
            tenantId: challenge.tenantId,
        });
        return {
            accessMode: challenge.accessMode,
            departmentId: challenge.departmentId,
            tenantId: challenge.tenantId,
        };
    },
});
exports.bootstrapDepartmentAccessCode = (0, server_2.internalMutation)({
    args: {
        accessCode: values_1.v.string(),
        departmentCode: values_1.v.string(),
        departmentName: values_1.v.string(),
        expiresAt: values_1.v.number(),
        procurementOfficerTenantUserId: values_1.v.id("tenantUsers"),
        submissionEndsAt: values_1.v.number(),
        submissionStartsAt: values_1.v.number(),
        tenantId: values_1.v.id("tenants"),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const normalizedAccessCode = (0, department_user_access_1.normalizeDepartmentUserAccessCode)(args.accessCode);
        const codeHash = await (0, department_user_access_1.hashDepartmentUserAccessCode)(normalizedAccessCode);
        const code = (0, departments_1.normalizeDepartmentCode)(args.departmentCode);
        const name = args.departmentName.trim();
        const departmentId = await ctx.db.insert("departments", {
            code,
            createdAt: now,
            isActive: true,
            name,
            normalizedCode: code,
            normalizedName: (0, departments_1.normalizeDepartmentName)(name),
            procurementOfficerTenantUserId: args.procurementOfficerTenantUserId,
            submissionEndsAt: args.submissionEndsAt,
            submissionStartsAt: args.submissionStartsAt,
            tenantId: args.tenantId,
            updatedAt: now,
        });
        const accessCodeId = await ctx.db.insert("departmentAccessCodes", {
            codeHash,
            codeSuffix: (0, department_user_access_1.getDepartmentUserAccessCodeSuffix)(normalizedAccessCode),
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
exports.startAccessChallenge = (0, server_2.action)({
    args: {
        accessCode: values_1.v.string(),
        email: values_1.v.string(),
        signedRequestContext: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.object({
        accessMode: values_1.v.union(values_1.v.literal("editable"), values_1.v.literal("read_only_grace")),
        challengeId: values_1.v.id("departmentUserAuthChallenges"),
        notice: values_1.v.union(values_1.v.string(), values_1.v.null()),
        verificationExpiresAt: values_1.v.number(),
    }),
    handler: async (ctx, args) => {
        const emailResult = (0, input_1.validateEmailInput)(args.email);
        if (!emailResult.ok) {
            throw new Error(emailResult.issue.message);
        }
        const accessCodeResult = (0, input_1.validateDepartmentUserAccessCodeInput)(args.accessCode);
        if (!accessCodeResult.ok) {
            throw new Error(accessCodeResult.issue.message);
        }
        const normalizedEmail = (0, input_1.normalizeAuthEmail)(emailResult.value);
        const normalizedAccessCode = accessCodeResult.value;
        const requestOrigin = await resolveDepartmentUserRequestOrigin(args.signedRequestContext);
        const attempt = await ctx.runQuery("functions/departmentUserAuth:evaluateAccessAttempt", {
            normalizedAccessCode,
            normalizedEmail,
        });
        if (!attempt.ok) {
            const matchedAccessCode = await ctx.runQuery("functions/departmentUserAuth:getAccessCodeForNormalizedCode", {
                normalizedAccessCode,
            });
            let failureEvent = attempt.auditEvent;
            let failureMessage = attempt.message;
            let failureMetadata = {
                normalizedEmail,
                ...attempt.metadata,
            };
            let failureOutcome = attempt.outcome;
            if (attempt.auditEvent === audit_1.AUDIT_EVENT_NAMES.departmentUserInvalid) {
                const failureState = await ctx.runMutation("functions/departmentUserAuth:recordFailedAttempt", {
                    accessCodeHash: await (0, department_user_access_1.hashDepartmentUserAccessCode)(normalizedAccessCode),
                    normalizedEmail,
                });
                failureMetadata = {
                    ...failureMetadata,
                    failedAttempts: failureState.failedAttempts,
                    lockedUntil: failureState.lockedUntil,
                };
                if (failureState.lockedUntil) {
                    const lockoutState = (0, department_user_access_1.getDepartmentUserLockoutState)({
                        failedAttempts: failureState.failedAttempts,
                        lockedUntil: failureState.lockedUntil,
                    });
                    failureEvent = audit_1.AUDIT_EVENT_NAMES.departmentUserLockedOut;
                    failureMessage = (0, department_user_access_1.formatDepartmentUserLockoutMessage)(lockoutState.remainingMs);
                    failureOutcome = audit_1.AUDIT_OUTCOMES.blockedLockedOut;
                }
            }
            await queueAuditFromAction(ctx, createAuditEntry({
                event: failureEvent,
                metadata: failureMetadata,
                outcome: failureOutcome,
                targetTenantId: attempt.tenantId,
            })).catch(() => undefined);
            if (matchedAccessCode) {
                await ctx.runMutation("functions/accessCodes:appendDepartmentAccessCodeEventFromAction", {
                    accessCodeId: matchedAccessCode.accessCodeId,
                    departmentId: matchedAccessCode.departmentId,
                    event: "login_denied",
                    ipAddress: requestOrigin.ipAddress,
                    message: failureMessage,
                    normalizedEmail,
                    outcome: "blocked",
                    requestOriginStatus: requestOrigin.requestOriginStatus,
                    tenantId: matchedAccessCode.tenantId,
                    userAgent: requestOrigin.userAgent,
                }).catch(() => undefined);
            }
            throw new Error(failureMessage);
        }
        const challengeId = await ctx.runMutation("functions/departmentUserAuth:createChallenge", {
            accessCodeId: attempt.accessCodeId,
            accessMode: attempt.accessMode,
            departmentId: attempt.departmentId,
            normalizedEmail,
            tenantId: attempt.tenantId,
            userIdHint: attempt.userIdHint,
        });
        await ctx.runAction("auth:signIn", {
            calledBy: "department-user-access-start",
            params: {
                challengeId,
                flow: "otp-start",
            },
            provider: department_user_access_1.DEPARTMENT_USER_AUTH_PROVIDER,
        });
        await queueAuditFromAction(ctx, createAuditEntry({
            event: audit_1.AUDIT_EVENT_NAMES.departmentUserChallengeStarted,
            metadata: {
                accessCodeId: String(attempt.accessCodeId),
                accessMode: attempt.accessMode,
                challengeId: String(challengeId),
                departmentId: String(attempt.departmentId),
                normalizedEmail,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            targetTenantId: attempt.tenantId,
        })).catch(() => undefined);
        return {
            accessMode: attempt.accessMode,
            challengeId,
            notice: attempt.notice,
            verificationExpiresAt: Date.now() + department_user_access_1.DEPARTMENT_USER_ACCESS_CHALLENGE_WINDOW_MS,
        };
    },
});
async function startDepartmentUserOtpChallenge(ctx, challengeId) {
    const challenge = await ctx.runQuery("functions/departmentUserAuth:getChallenge", { challengeId });
    if (!challenge) {
        throw new Error("Department User sign-in challenge expired. Start again.");
    }
    let authAccount = challenge.authAccountId
        ? {
            accountId: challenge.authAccountId,
            userId: challenge.authUserId,
        }
        : await ctx.runQuery("functions/departmentUserAuth:getAuthAccountForEmail", {
            normalizedEmail: challenge.normalizedEmail,
        });
    if (!authAccount) {
        const created = await (0, server_1.createAccount)(ctx, {
            account: {
                id: challenge.normalizedEmail,
            },
            profile: {
                email: challenge.normalizedEmail,
            },
            provider: department_user_access_1.DEPARTMENT_USER_AUTH_PROVIDER,
            shouldLinkViaEmail: true,
        });
        authAccount = {
            accountId: created.account._id,
            userId: created.user._id,
        };
    }
    await ctx.runMutation("functions/departmentUserAuth:bindChallengeToAuthAccount", {
        accountId: authAccount.accountId,
        challengeId,
        userId: authAccount.userId,
    });
    await (0, server_1.signInViaProvider)(ctx, ResendOTP_1.ResendOTP, {
        accountId: authAccount.accountId,
        params: {
            email: challenge.normalizedEmail,
        },
    });
    return null;
}
exports.startDepartmentUserOtpChallenge = startDepartmentUserOtpChallenge;
async function verifyDepartmentUserOtpChallenge(ctx, args) {
    const challenge = await ctx.runQuery("functions/departmentUserAuth:getChallenge", { challengeId: args.challengeId });
    if (!challenge || !challenge.authAccountId) {
        throw new Error("Department User sign-in challenge expired. Start again.");
    }
    const attempt = await ctx.runQuery("functions/departmentUserAuth:evaluateAccessAttempt", {
        accessCodeId: challenge.accessCodeId,
        normalizedEmail: challenge.normalizedEmail,
    });
    if (!attempt.ok) {
        const requestOrigin = await resolveDepartmentUserRequestOrigin(args.signedRequestContext);
        await queueAuditFromAction(ctx, createAuditEntry({
            event: attempt.auditEvent,
            metadata: {
                challengeId: String(challenge._id),
                normalizedEmail: challenge.normalizedEmail,
                ...attempt.metadata,
            },
            outcome: attempt.outcome,
            targetTenantId: attempt.tenantId,
        })).catch(() => undefined);
        await ctx.runMutation("functions/accessCodes:appendDepartmentAccessCodeEventFromAction", {
            accessCodeId: challenge.accessCodeId,
            departmentId: challenge.departmentId,
            event: "login_denied",
            ipAddress: requestOrigin.ipAddress,
            message: attempt.message,
            normalizedEmail: challenge.normalizedEmail,
            outcome: "blocked",
            requestOriginStatus: requestOrigin.requestOriginStatus,
            tenantId: challenge.tenantId,
            userAgent: requestOrigin.userAgent,
        }).catch(() => undefined);
        throw new Error(attempt.message);
    }
    let signedIn = null;
    try {
        signedIn = await (0, server_1.signInViaProvider)(ctx, ResendOTP_1.ResendOTP, {
            accountId: challenge.authAccountId,
            params: {
                code: args.code,
                email: challenge.normalizedEmail,
            },
        });
    }
    catch (error) {
        if (!(0, department_user_access_1.isDepartmentUserOtpProviderFailureMessage)(getErrorMessage(error))) {
            throw error;
        }
    }
    if (!signedIn) {
        const requestOrigin = await resolveDepartmentUserRequestOrigin(args.signedRequestContext);
        const failureState = await ctx.runMutation("functions/departmentUserAuth:recordFailedAttempt", {
            accessCodeId: challenge.accessCodeId,
            normalizedEmail: challenge.normalizedEmail,
        });
        await queueAuditFromAction(ctx, createAuditEntry({
            event: failureState.lockedUntil
                ? audit_1.AUDIT_EVENT_NAMES.departmentUserLockedOut
                : audit_1.AUDIT_EVENT_NAMES.departmentUserInvalid,
            metadata: {
                accessCodeId: String(challenge.accessCodeId),
                challengeId: String(challenge._id),
                failedAttempts: failureState.failedAttempts,
                lockedUntil: failureState.lockedUntil,
                normalizedEmail: challenge.normalizedEmail,
            },
            outcome: failureState.lockedUntil
                ? audit_1.AUDIT_OUTCOMES.blockedLockedOut
                : audit_1.AUDIT_OUTCOMES.blockedInvalidAccessCode,
            targetTenantId: challenge.tenantId,
        })).catch(() => undefined);
        await ctx.runMutation("functions/accessCodes:appendDepartmentAccessCodeEventFromAction", {
            accessCodeId: challenge.accessCodeId,
            departmentId: challenge.departmentId,
            event: "login_denied",
            ipAddress: requestOrigin.ipAddress,
            message: failureState.lockedUntil
                ? (0, department_user_access_1.formatDepartmentUserLockoutMessage)((0, department_user_access_1.getDepartmentUserLockoutState)({
                    failedAttempts: failureState.failedAttempts,
                    lockedUntil: failureState.lockedUntil,
                }).remainingMs)
                : department_user_access_1.DEPARTMENT_USER_INVALID_VERIFICATION_CODE_MESSAGE,
            normalizedEmail: challenge.normalizedEmail,
            outcome: "blocked",
            requestOriginStatus: requestOrigin.requestOriginStatus,
            tenantId: challenge.tenantId,
            userAgent: requestOrigin.userAgent,
        }).catch(() => undefined);
        if (failureState.lockedUntil) {
            const lockoutState = (0, department_user_access_1.getDepartmentUserLockoutState)({
                failedAttempts: failureState.failedAttempts,
                lockedUntil: failureState.lockedUntil,
            });
            throw new Error((0, department_user_access_1.formatDepartmentUserLockoutMessage)(lockoutState.remainingMs));
        }
        throw new Error(department_user_access_1.DEPARTMENT_USER_INVALID_VERIFICATION_CODE_MESSAGE);
    }
    const requestOrigin = await resolveDepartmentUserRequestOrigin(args.signedRequestContext);
    await ctx.runMutation("functions/departmentUserAuth:finalizeSuccessfulAccess", {
        challengeId: challenge._id,
        ipAddress: requestOrigin.ipAddress,
        requestOriginStatus: requestOrigin.requestOriginStatus,
        userId: signedIn.userId,
        userAgent: requestOrigin.userAgent,
    });
    return signedIn;
}
exports.verifyDepartmentUserOtpChallenge = verifyDepartmentUserOtpChallenge;
