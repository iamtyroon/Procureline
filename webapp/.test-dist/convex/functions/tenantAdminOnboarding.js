"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeInstitutionProfile = exports.getCurrentOnboardingContext = exports.redeemInvitation = exports.resendInvitation = exports.issueInvitation = exports.registerVerificationResend = exports.startVerificationWindow = exports.getInvitationContext = exports.completeInstitutionProfileCore = exports.redeemInvitationCore = exports.resendInvitationCore = exports.issueInvitationCore = exports.registerVerificationResendCore = exports.startVerificationWindowCore = void 0;
const server_1 = require("@convex-dev/auth/server");
const random_1 = require("@oslojs/crypto/random");
const values_1 = require("convex/values");
const server_2 = require("../_generated/server");
const audit_1 = require("../../lib/shared/security/audit");
const risk_1 = require("../../lib/backend/platform-admin/risk");
const invitations_1 = require("../../lib/shared/tenant-admin/invitations");
const input_1 = require("../../lib/shared/security/input");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const invitationContextValidator = values_1.v.object({
    email: values_1.v.optional(values_1.v.string()),
    isValid: values_1.v.boolean(),
    message: values_1.v.optional(values_1.v.string()),
    tenantId: values_1.v.optional(values_1.v.id("tenants")),
    tenantName: values_1.v.optional(values_1.v.string()),
});
function randomReader() {
    return {
        read(bytes) {
            crypto.getRandomValues(bytes);
        },
    };
}
function createInvitationToken() {
    return (0, random_1.generateRandomString)(randomReader(), "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", 48);
}
function invalidInvitation(message) {
    throw new values_1.ConvexError({
        code: "INVITATION_INVALID",
        message,
    });
}
async function findInvitationByToken(ctx, inviteToken) {
    const tokenHash = await (0, risk_1.sha256Hex)(inviteToken);
    return await ctx.db
        .query("tenantAdminInvitations")
        .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
        .first();
}
async function getLatestOnboardingState(ctx, normalizedEmail) {
    return await ctx.db
        .query("tenantAdminOnboardingStates")
        .withIndex("by_normalizedEmail", (q) => q.eq("normalizedEmail", normalizedEmail))
        .order("desc")
        .first();
}
async function upsertVerificationWindow(args) {
    const existingState = await getLatestOnboardingState(args.ctx, args.normalizedEmail);
    const verificationWindowExpiresAt = args.now + invitations_1.TENANT_ADMIN_VERIFICATION_WINDOW_MS;
    if (existingState &&
        existingState.completedAt === undefined &&
        existingState.mode === args.mode) {
        await args.ctx.db.patch(existingState._id, {
            invitationId: args.invitationId ?? existingState.invitationId,
            lastVerificationSentAt: args.now,
            tenantId: args.tenantId ?? existingState.tenantId,
            updatedAt: args.now,
            verificationWindowExpiresAt,
        });
        return verificationWindowExpiresAt;
    }
    await args.ctx.db.insert("tenantAdminOnboardingStates", {
        autoResendCount: 0,
        createdAt: args.now,
        invitationId: args.invitationId,
        lastVerificationSentAt: args.now,
        manualResendCount: 0,
        mode: args.mode,
        normalizedEmail: args.normalizedEmail,
        tenantId: args.tenantId,
        updatedAt: args.now,
        verificationWindowExpiresAt,
    });
    return verificationWindowExpiresAt;
}
async function ensureNoApplicationRoleAssignment(ctx, userId) {
    const [tenantUsers, platformUsers] = await Promise.all([
        ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .collect(),
        ctx.db
            .query("platformUsers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .collect(),
    ]);
    if (tenantUsers.length > 0 || platformUsers.length > 0) {
        throw new values_1.ConvexError({
            code: "ALREADY_EXISTS",
            message: "Email already in use. An application role assignment already exists for this user.",
        });
    }
}
function resolveInvitationAccessMessage(args) {
    if (!args.tenant) {
        return "This invitation is invalid. Request a new link.";
    }
    const effectiveStatus = args.invitation.status === "pending" && args.invitation.expiresAt <= args.now
        ? "expired"
        : args.invitation.status;
    return (0, invitations_1.getTenantAdminInvitationAccessMessage)({
        expiresAt: args.invitation.expiresAt,
        now: args.now,
        status: effectiveStatus,
        tenantIsActive: args.tenant.status === "active" || args.tenant.status === "pending",
    });
}
async function markInvitationExpiredIfNeeded(ctx, invitation, now) {
    if (invitation.status === "pending" && invitation.expiresAt <= now) {
        await ctx.db.patch(invitation._id, {
            status: "expired",
            updatedAt: now,
        });
    }
}
async function createInvitation(args) {
    const emailResult = (0, input_1.validateEmailInput)(args.email);
    if (!emailResult.ok) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            field: emailResult.issue.field,
            message: emailResult.issue.message,
        });
    }
    const tenant = await args.ctx.db.get(args.tenantId);
    if (!tenant || tenant.status !== "active") {
        throw new values_1.ConvexError({
            code: "TENANT_INACTIVE",
            message: "Tenant deactivated. Contact Support.",
        });
    }
    const existingInvitations = await args.ctx.db
        .query("tenantAdminInvitations")
        .withIndex("by_tenantId_email", (q) => q.eq("tenantId", args.tenantId).eq("normalizedEmail", emailResult.value))
        .collect();
    const now = Date.now();
    const resentCount = Math.max(-1, ...existingInvitations.map((invitation) => invitation.resentCount)) +
        1;
    for (const nextState of (0, invitations_1.invalidateSupersededInvitationStatuses)(existingInvitations.map((invitation) => ({
        id: String(invitation._id),
        status: invitation.status,
    })))) {
        const invitationId = existingInvitations.find((invitation) => String(invitation._id) === nextState.id)?._id;
        if (!invitationId) {
            continue;
        }
        await args.ctx.db.patch(invitationId, {
            status: nextState.nextStatus,
            updatedAt: now,
        });
    }
    const inviteToken = createInvitationToken();
    const invitationId = await args.ctx.db.insert("tenantAdminInvitations", {
        acceptedAt: undefined,
        acceptedByUserId: undefined,
        createdAt: now,
        createdByPlatformUserId: args.platformUserId,
        email: args.email.trim(),
        expiresAt: now + invitations_1.TENANT_ADMIN_INVITATION_TTL_MS,
        normalizedEmail: emailResult.value,
        resentCount,
        status: "pending",
        tenantId: args.tenantId,
        tokenHash: await (0, risk_1.sha256Hex)(inviteToken),
        updatedAt: now,
    });
    return {
        email: args.email.trim(),
        expiresAt: now + invitations_1.TENANT_ADMIN_INVITATION_TTL_MS,
        inviteToken,
        inviteUrl: `/signup?invite=${encodeURIComponent(inviteToken)}`,
        invitationId,
        resentCount,
    };
}
async function startVerificationWindowCore(args) {
    const emailResult = (0, input_1.validateEmailInput)(args.email);
    if (!emailResult.ok) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            field: emailResult.issue.field,
            message: emailResult.issue.message,
        });
    }
    const now = Date.now();
    let invitationId;
    let tenantId;
    if (args.mode === "invite") {
        const invitation = await findInvitationByToken(args.ctx, args.inviteToken?.trim() ?? "");
        if (!invitation) {
            invalidInvitation("This invitation is invalid. Request a new link.");
        }
        const tenant = await args.ctx.db.get(invitation.tenantId);
        const message = resolveInvitationAccessMessage({
            invitation,
            now,
            tenant,
        });
        if (message) {
            invalidInvitation(message);
        }
        if (invitation.normalizedEmail !== emailResult.value) {
            invalidInvitation("Email already in use. Sign in with that account or use the invited email.");
        }
        invitationId = invitation._id;
        tenantId = invitation.tenantId;
    }
    const verificationWindowExpiresAt = await upsertVerificationWindow({
        ctx: args.ctx,
        invitationId,
        mode: args.mode,
        normalizedEmail: emailResult.value,
        now,
        tenantId,
    });
    return { verificationWindowExpiresAt };
}
exports.startVerificationWindowCore = startVerificationWindowCore;
async function registerVerificationResendCore(args) {
    const emailResult = (0, input_1.validateEmailInput)(args.email);
    if (!emailResult.ok) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            field: emailResult.issue.field,
            message: emailResult.issue.message,
        });
    }
    const state = await getLatestOnboardingState(args.ctx, emailResult.value);
    const now = Date.now();
    if (!state || state.verificationWindowExpiresAt <= now) {
        return {
            allowed: false,
            message: "Verification window expired. Start signup again.",
        };
    }
    if (args.mode === "invite") {
        const invitation = await findInvitationByToken(args.ctx, args.inviteToken?.trim() ?? "");
        if (!invitation) {
            return {
                allowed: false,
                message: "This invitation is invalid. Request a new link.",
            };
        }
        const tenant = await args.ctx.db.get(invitation.tenantId);
        const message = resolveInvitationAccessMessage({
            invitation,
            now,
            tenant,
        });
        if (message) {
            return {
                allowed: false,
                message,
            };
        }
    }
    const allowed = args.resendMode === "manual"
        ? true
        : (0, invitations_1.canAutoResendTenantAdminVerification)({
            autoResendCount: state.autoResendCount,
            lastSentAt: state.lastVerificationSentAt,
            now,
            verificationWindowExpiresAt: state.verificationWindowExpiresAt,
        });
    if (!allowed) {
        return {
            allowed: false,
            verificationWindowExpiresAt: state.verificationWindowExpiresAt,
        };
    }
    await args.ctx.db.patch(state._id, {
        autoResendCount: args.resendMode === "auto"
            ? state.autoResendCount + 1
            : state.autoResendCount,
        lastVerificationSentAt: now,
        manualResendCount: args.resendMode === "manual"
            ? state.manualResendCount + 1
            : state.manualResendCount,
        updatedAt: now,
    });
    return {
        allowed: true,
        verificationWindowExpiresAt: state.verificationWindowExpiresAt,
    };
}
exports.registerVerificationResendCore = registerVerificationResendCore;
async function issueInvitationCore(args) {
    const result = await createInvitation({
        ctx: args.ctx,
        email: args.email,
        platformUserId: args.platformUserId,
        tenantId: args.tenantId,
    });
    await (0, _audit_1.appendAuditLogBestEffort)(args.ctx, {
        action: "issue",
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "platform_admin",
            userId: String(args.platformUserId),
        }),
        entityType: "tenant_admin_invitation",
        event: audit_1.AUDIT_EVENT_NAMES.tenantAdminInvitationIssued,
        metadata: {
            normalizedEmail: (0, input_1.normalizeAuthEmail)(args.email),
            resentCount: result.resentCount,
        },
        outcome: "allowed",
        recordId: String(result.invitationId),
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    });
    return result;
}
exports.issueInvitationCore = issueInvitationCore;
async function resendInvitationCore(args) {
    const result = await createInvitation({
        ctx: args.ctx,
        email: args.email,
        platformUserId: args.platformUserId,
        tenantId: args.tenantId,
    });
    await (0, _audit_1.appendAuditLogBestEffort)(args.ctx, {
        action: "resend",
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "platform_admin",
            userId: String(args.platformUserId),
        }),
        entityType: "tenant_admin_invitation",
        event: audit_1.AUDIT_EVENT_NAMES.tenantAdminInvitationResent,
        metadata: {
            normalizedEmail: (0, input_1.normalizeAuthEmail)(args.email),
            resentCount: result.resentCount,
        },
        outcome: "allowed",
        recordId: String(result.invitationId),
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    });
    return result;
}
exports.resendInvitationCore = resendInvitationCore;
async function redeemInvitationCore(args) {
    const user = await args.ctx.db.get(args.userId);
    if (!user || typeof user.email !== "string") {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "You must be signed in to accept this invitation.",
        });
    }
    const invitation = await findInvitationByToken(args.ctx, args.inviteToken.trim());
    if (!invitation) {
        invalidInvitation("This invitation is invalid. Request a new link.");
    }
    const now = Date.now();
    await markInvitationExpiredIfNeeded(args.ctx, invitation, now);
    const tenant = await args.ctx.db.get(invitation.tenantId);
    const message = resolveInvitationAccessMessage({
        invitation,
        now,
        tenant,
    });
    if (message) {
        await (0, _audit_1.appendAuditLogBestEffort)(args.ctx, {
            action: "redeem",
            actor: (0, audit_1.createAuthenticatedAuditActor)({
                role: "unassigned",
                userId: String(args.userId),
            }),
            entityType: "tenant_admin_invitation",
            event: audit_1.AUDIT_EVENT_NAMES.tenantAdminOnboardingBlocked,
            metadata: {
                reason: message,
            },
            outcome: "blocked_subscription_inactive",
            recordId: String(invitation._id),
            targetTenantId: tenant ? String(tenant._id) : undefined,
            timestamp: now,
        });
        invalidInvitation(message);
    }
    if ((0, input_1.normalizeAuthEmail)(user.email) !== invitation.normalizedEmail) {
        invalidInvitation("Email already in use. Sign in with that account or use the invited email.");
    }
    const existingMembership = await args.ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) => q.eq("userId", args.userId).eq("tenantId", invitation.tenantId))
        .first();
    if (existingMembership &&
        existingMembership.role === "tenant_admin" &&
        invitation.acceptedByUserId === args.userId) {
        return {
            tenantId: invitation.tenantId,
            tenantUserId: existingMembership._id,
        };
    }
    await ensureNoApplicationRoleAssignment(args.ctx, args.userId);
    const tenantUserId = await args.ctx.db.insert("tenantUsers", {
        isActive: true,
        role: "tenant_admin",
        tenantId: invitation.tenantId,
        userId: args.userId,
    });
    await args.ctx.db.patch(invitation._id, {
        acceptedAt: now,
        acceptedByUserId: args.userId,
        status: "accepted",
        updatedAt: now,
    });
    if (tenant?.status === "pending") {
        await args.ctx.db.patch(tenant._id, {
            status: "active",
        });
    }
    const onboardingState = await getLatestOnboardingState(args.ctx, invitation.normalizedEmail);
    if (onboardingState) {
        await args.ctx.db.patch(onboardingState._id, {
            completedAt: now,
            invitationId: invitation._id,
            tenantId: invitation.tenantId,
            updatedAt: now,
        });
    }
    await (0, _audit_1.appendAuditLogBestEffort)(args.ctx, {
        action: "redeem",
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "tenant_admin",
            userId: String(args.userId),
        }),
        entityType: "tenant_admin_invitation",
        event: audit_1.AUDIT_EVENT_NAMES.tenantAdminInvitationAccepted,
        metadata: {
            normalizedEmail: invitation.normalizedEmail,
        },
        outcome: "allowed",
        recordId: String(invitation._id),
        targetTenantId: String(invitation.tenantId),
        timestamp: now,
    });
    return {
        tenantId: invitation.tenantId,
        tenantUserId,
    };
}
exports.redeemInvitationCore = redeemInvitationCore;
async function completeInstitutionProfileCore(args) {
    const tenant = await args.ctx.db.get(args.authContext.tenantId);
    if (!tenant || tenant.status !== "active") {
        await (0, _audit_1.appendAuditLogBestEffort)(args.ctx, {
            action: "complete",
            actor: (0, audit_1.createAuthenticatedAuditActor)({
                role: "tenant_admin",
                userId: String(args.authContext.userId),
            }),
            entityType: "tenant",
            event: audit_1.AUDIT_EVENT_NAMES.tenantAdminOnboardingBlocked,
            metadata: {
                reason: "tenant_inactive",
            },
            outcome: "blocked_subscription_inactive",
            recordId: tenant ? String(tenant._id) : undefined,
            targetTenantId: tenant ? String(tenant._id) : undefined,
            timestamp: Date.now(),
        });
        throw new values_1.ConvexError({
            code: "TENANT_INACTIVE",
            message: "Tenant deactivated. Contact Support.",
        });
    }
    const institutionNameResult = (0, input_1.validateOrganizationNameInput)(args.institutionName);
    if (!institutionNameResult.ok) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            field: institutionNameResult.issue.field,
            message: institutionNameResult.issue.message,
        });
    }
    const primaryContactNameResult = (0, input_1.validatePlainTextInput)(args.primaryContactName, {
        field: "primaryContactName",
        label: "Primary contact name",
        maxLength: 100,
        minLength: 2,
    });
    if (!primaryContactNameResult.ok) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            field: primaryContactNameResult.issue.field,
            message: primaryContactNameResult.issue.message,
        });
    }
    const primaryContactPhoneResult = (0, input_1.validatePlainTextInput)(args.primaryContactPhone, {
        field: "primaryContactPhone",
        label: "Primary contact phone",
        maxLength: 30,
        minLength: 7,
    });
    if (!primaryContactPhoneResult.ok) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            field: primaryContactPhoneResult.issue.field,
            message: primaryContactPhoneResult.issue.message,
        });
    }
    const primaryContactEmailResult = (0, input_1.validateEmailInput)(args.primaryContactEmail, "primaryContactEmail");
    if (!primaryContactEmailResult.ok) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            field: primaryContactEmailResult.issue.field,
            message: primaryContactEmailResult.issue.message,
        });
    }
    if (!Number.isInteger(args.fiscalYearStartMonth) ||
        args.fiscalYearStartMonth < 1 ||
        args.fiscalYearStartMonth > 12) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            field: "fiscalYearStartMonth",
            message: "Fiscal year start month must be between 1 and 12.",
        });
    }
    const now = Date.now();
    await args.ctx.db.patch(tenant._id, {
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        logoUrl: typeof args.logoUrl === "string" && args.logoUrl.trim().length > 0
            ? args.logoUrl.trim()
            : undefined,
        name: institutionNameResult.value.normalized,
        onboardingCompletedAt: now,
        primaryContactEmail: primaryContactEmailResult.value,
        primaryContactName: (0, input_1.normalizePlainText)(args.primaryContactName),
        primaryContactPhone: (0, input_1.normalizePlainText)(args.primaryContactPhone),
        profileComplete: true,
    });
    const onboardingState = await getLatestOnboardingState(args.ctx, primaryContactEmailResult.value);
    if (onboardingState) {
        await args.ctx.db.patch(onboardingState._id, {
            completedAt: now,
            tenantId: tenant._id,
            updatedAt: now,
        });
    }
    await (0, _audit_1.appendAuditLogBestEffort)(args.ctx, {
        action: "complete",
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "tenant_admin",
            userId: String(args.authContext.userId),
        }),
        entityType: "tenant",
        event: audit_1.AUDIT_EVENT_NAMES.tenantAdminOnboardingCompleted,
        metadata: {
            fiscalYearStartMonth: args.fiscalYearStartMonth,
        },
        outcome: "allowed",
        recordId: String(tenant._id),
        targetTenantId: String(tenant._id),
        timestamp: now,
    });
    return {
        profileComplete: true,
        tenantId: tenant._id,
    };
}
exports.completeInstitutionProfileCore = completeInstitutionProfileCore;
exports.getInvitationContext = (0, server_2.query)({
    args: {
        inviteToken: values_1.v.string(),
    },
    returns: invitationContextValidator,
    handler: async (ctx, args) => {
        const inviteToken = args.inviteToken.trim();
        if (!inviteToken) {
            return {
                isValid: false,
                message: "This invitation is invalid. Request a new link.",
            };
        }
        const invitation = await findInvitationByToken(ctx, inviteToken);
        if (!invitation) {
            return {
                isValid: false,
                message: "This invitation is invalid. Request a new link.",
            };
        }
        const tenant = await ctx.db.get(invitation.tenantId);
        const message = resolveInvitationAccessMessage({
            invitation,
            now: Date.now(),
            tenant,
        });
        if (message) {
            return {
                isValid: false,
                message,
                tenantId: tenant?._id,
                tenantName: tenant?.name,
            };
        }
        return {
            email: invitation.email,
            isValid: true,
            tenantId: invitation.tenantId,
            tenantName: tenant?.name,
        };
    },
});
exports.startVerificationWindow = (0, server_2.mutation)({
    args: {
        email: values_1.v.string(),
        inviteToken: values_1.v.optional(values_1.v.string()),
        mode: values_1.v.union(values_1.v.literal("invite"), values_1.v.literal("self_serve")),
    },
    returns: values_1.v.object({
        verificationWindowExpiresAt: values_1.v.number(),
    }),
    handler: async (ctx, args) => await startVerificationWindowCore({
        ctx,
        email: args.email,
        inviteToken: args.inviteToken,
        mode: args.mode,
    }),
});
exports.registerVerificationResend = (0, server_2.mutation)({
    args: {
        email: values_1.v.string(),
        inviteToken: values_1.v.optional(values_1.v.string()),
        mode: values_1.v.union(values_1.v.literal("invite"), values_1.v.literal("self_serve")),
        resendMode: values_1.v.union(values_1.v.literal("auto"), values_1.v.literal("manual")),
    },
    returns: values_1.v.object({
        allowed: values_1.v.boolean(),
        message: values_1.v.optional(values_1.v.string()),
        verificationWindowExpiresAt: values_1.v.optional(values_1.v.number()),
    }),
    handler: async (ctx, args) => await registerVerificationResendCore({
        ctx,
        email: args.email,
        inviteToken: args.inviteToken,
        mode: args.mode,
        resendMode: args.resendMode,
    }),
});
exports.issueInvitation = (0, server_2.mutation)({
    args: {
        email: values_1.v.string(),
        tenantId: values_1.v.id("tenants"),
    },
    returns: values_1.v.object({
        email: values_1.v.string(),
        expiresAt: values_1.v.number(),
        inviteToken: values_1.v.string(),
        inviteUrl: values_1.v.string(),
        invitationId: values_1.v.id("tenantAdminInvitations"),
        resentCount: values_1.v.number(),
    }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        return await issueInvitationCore({
            ctx,
            email: args.email,
            platformUserId: authContext.userId,
            tenantId: args.tenantId,
        });
    },
});
exports.resendInvitation = (0, server_2.mutation)({
    args: {
        email: values_1.v.string(),
        tenantId: values_1.v.id("tenants"),
    },
    returns: values_1.v.object({
        email: values_1.v.string(),
        expiresAt: values_1.v.number(),
        inviteToken: values_1.v.string(),
        inviteUrl: values_1.v.string(),
        invitationId: values_1.v.id("tenantAdminInvitations"),
        resentCount: values_1.v.number(),
    }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        return await resendInvitationCore({
            ctx,
            email: args.email,
            platformUserId: authContext.userId,
            tenantId: args.tenantId,
        });
    },
});
exports.redeemInvitation = (0, server_2.mutation)({
    args: {
        inviteToken: values_1.v.string(),
    },
    returns: values_1.v.object({
        tenantId: values_1.v.id("tenants"),
        tenantUserId: values_1.v.id("tenantUsers"),
    }),
    handler: async (ctx, args) => {
        const userId = await (0, server_1.getAuthUserId)(ctx);
        if (!userId) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "You must be signed in to accept this invitation.",
            });
        }
        return await redeemInvitationCore({
            ctx,
            inviteToken: args.inviteToken,
            userId,
        });
    },
});
exports.getCurrentOnboardingContext = (0, server_2.query)({
    args: {},
    returns: values_1.v.object({
        fiscalYearStartMonth: values_1.v.optional(values_1.v.number()),
        institutionName: values_1.v.string(),
        logoUrl: values_1.v.optional(values_1.v.string()),
        primaryContactEmail: values_1.v.string(),
        primaryContactName: values_1.v.optional(values_1.v.string()),
        primaryContactPhone: values_1.v.optional(values_1.v.string()),
        profileComplete: values_1.v.boolean(),
        tenantId: values_1.v.id("tenants"),
        tenantName: values_1.v.string(),
    }),
    handler: async (ctx) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const [tenant, user] = await Promise.all([
            ctx.db.get(authContext.tenantId),
            ctx.db.get(authContext.userId),
        ]);
        if (!tenant) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found.",
            });
        }
        if (tenant.status !== "active") {
            throw new values_1.ConvexError({
                code: "TENANT_INACTIVE",
                message: "Tenant deactivated. Contact Support.",
            });
        }
        return {
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            institutionName: tenant.name,
            logoUrl: tenant.logoUrl,
            primaryContactEmail: tenant.primaryContactEmail ??
                (typeof user?.email === "string" ? user.email : ""),
            primaryContactName: tenant.primaryContactName,
            primaryContactPhone: tenant.primaryContactPhone,
            profileComplete: tenant.profileComplete === true,
            tenantId: tenant._id,
            tenantName: tenant.name,
        };
    },
});
exports.completeInstitutionProfile = (0, server_2.mutation)({
    args: {
        fiscalYearStartMonth: values_1.v.number(),
        institutionName: values_1.v.string(),
        logoUrl: values_1.v.optional(values_1.v.string()),
        primaryContactEmail: values_1.v.string(),
        primaryContactName: values_1.v.string(),
        primaryContactPhone: values_1.v.string(),
    },
    returns: values_1.v.object({
        profileComplete: values_1.v.boolean(),
        tenantId: values_1.v.id("tenants"),
    }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        return await completeInstitutionProfileCore({
            authContext,
            ctx,
            fiscalYearStartMonth: args.fiscalYearStartMonth,
            institutionName: args.institutionName,
            logoUrl: args.logoUrl,
            primaryContactEmail: args.primaryContactEmail,
            primaryContactName: args.primaryContactName,
            primaryContactPhone: args.primaryContactPhone,
        });
    },
});
