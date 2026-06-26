"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvitationAccessContext = exports.recordBounceFromWebhook = exports.verifyProcurementOfficerOtpChallenge = exports.finalizeSuccessfulAccess = exports.startProcurementOfficerOtpChallenge = exports.startAccessChallenge = exports.resendInvitation = exports.bulkIssueInvitations = exports.issueInvitation = exports.resendInvitationRecord = exports.createInvitationRecord = exports.markInvitationEmailSent = exports.createChallenge = exports.bindChallengeToAuthAccount = exports.getAuthAccountForEmail = exports.getChallenge = exports.evaluateAccessAttempt = exports.getInvitationRecord = void 0;
const server_1 = require("@convex-dev/auth/server");
const random_1 = require("@oslojs/crypto/random");
const values_1 = require("convex/values");
const api_1 = require("../_generated/api");
const emailTransport_1 = require("../emailTransport");
const server_2 = require("../_generated/server");
const public_entry_1 = require("../../lib/shared/auth/public-entry");
const audit_1 = require("../../lib/shared/security/audit");
const input_1 = require("../../lib/shared/security/input");
const invitations_1 = require("../../lib/procurement-officer/invitations");
const _audit_1 = require("./_audit");
const ResendOTP_1 = require("../ResendOTP");
const _helpers_1 = require("../actions/_helpers");
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
function createActivationCode() {
    const raw = (0, random_1.generateRandomString)(randomReader(), "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 12);
    return (0, invitations_1.formatProcurementOfficerActivationCode)(raw);
}
function getErrorMessage(error) {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message.trim();
    }
    return null;
}
function invalidInvitation(message) {
    throw new values_1.ConvexError({
        code: "INVITATION_INVALID",
        message,
    });
}
function ensureSingleCredentialFamily(args) {
    if (args.inviteToken && args.activationCode) {
        invalidInvitation(invitations_1.PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE);
    }
    if (!args.inviteToken && !args.activationCode) {
        invalidInvitation(invitations_1.PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE);
    }
}
function createAuditEntry(args) {
    return {
        action: "authenticate",
        actor: args.actorUserId
            ? (0, audit_1.createAuthenticatedAuditActor)({
                role: "procurement_officer",
                userId: String(args.actorUserId),
            })
            : (0, audit_1.createAnonymousAuditActor)(),
        entityType: "procurement_officer_invitation",
        event: args.event,
        metadata: args.metadata,
        outcome: args.outcome,
        targetTenantId: args.targetTenantId
            ? String(args.targetTenantId)
            : undefined,
        timestamp: Date.now(),
    };
}
async function queueAuditFromAction(ctx, entry) {
    await ctx.runMutation("functions/auditLogs:appendAuditLogFromAction", (0, audit_1.serializeAuditEvent)(entry));
}
function getInvitationEffectiveStatus(args) {
    if (args.invitation.status === "pending" && args.invitation.expiresAt <= args.now) {
        return "expired";
    }
    return args.invitation.status;
}
async function markInvitationExpiredIfNeeded(ctx, invitation, now) {
    if (invitation.status === "pending" && invitation.expiresAt <= now) {
        await ctx.db.patch(invitation._id, {
            status: "expired",
            updatedAt: now,
        });
    }
}
async function findInvitationByInviteToken(ctx, inviteToken) {
    const inviteTokenHash = await (0, invitations_1.hashProcurementOfficerSecret)(inviteToken);
    return await ctx.db
        .query("poInvitations")
        .withIndex("by_inviteTokenHash", (q) => q.eq("inviteTokenHash", inviteTokenHash))
        .first();
}
async function findInvitationByActivationCode(ctx, activationCode) {
    const normalizedActivationCode = (0, invitations_1.normalizeProcurementOfficerActivationCode)(activationCode);
    const activationCodeHash = await (0, invitations_1.hashProcurementOfficerSecret)(normalizedActivationCode);
    return await ctx.db
        .query("poInvitations")
        .withIndex("by_activationCodeHash", (q) => q.eq("activationCodeHash", activationCodeHash))
        .first();
}
async function loadInvitationForCredential(args) {
    ensureSingleCredentialFamily({
        activationCode: args.activationCode,
        inviteToken: args.inviteToken,
    });
    if (args.inviteToken) {
        return await findInvitationByInviteToken(args.ctx, args.inviteToken.trim());
    }
    return await findInvitationByActivationCode(args.ctx, args.activationCode?.trim() ?? "");
}
async function findUserByNormalizedEmail(ctx, normalizedEmail) {
    const users = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", normalizedEmail))
        .collect();
    if (users.length > 1) {
        throw new values_1.ConvexError({
            code: "DATA_INTEGRITY_ERROR",
            message: invitations_1.PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
        });
    }
    return users[0] ?? null;
}
async function resolveInvitationAccessMessage(args) {
    return (0, invitations_1.getProcurementOfficerInvitationAccessMessage)({
        expiresAt: args.invitation.expiresAt,
        now: args.now,
        status: args.invitation.status,
        tenantIsActive: args.tenant?.status === "active",
    });
}
async function sendInvitationEmail(args) {
    const fromAddress = process.env.AUTH_RESET_RESEND_FROM ??
        "Procureline <onboarding@resend.dev>";
    const result = await (0, emailTransport_1.sendAppEmail)({
        debugCode: args.activationCode,
        debugLink: args.inviteUrl,
        from: fromAddress,
        html: `
                <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
                    <h2 style="margin-bottom: 12px;">You're invited to Procureline</h2>
                    <p>Hello ${args.fullName},</p>
                    <p>Your Tenant Admin invited you to manage procurement activities for <strong>${args.tenantName}</strong>.</p>
                    <p>Use your secure invite link or activation code below to continue.</p>
                    <p><a href="${args.inviteUrl}" style="display: inline-block; padding: 12px 18px; background: #0f766e; color: #ffffff; text-decoration: none; border-radius: 8px;">Open Procurement Officer access</a></p>
                    <p style="margin-top: 18px;"><strong>Activation code:</strong> ${args.activationCode}</p>
                    <p>This invitation expires in 7 days. Only the latest invitation remains valid after a resend.</p>
                </div>
            `,
        idempotencyKey: args.idempotencyKey,
        messageType: "procurement_officer_invitation",
        metadata: {
            invitationId: args.invitationId,
            tenantId: args.tenantId,
            tenantName: args.tenantName,
        },
        subject: `${args.tenantName} invited you to Procureline`,
        tags: [
            { name: "category", value: "po_invitation" },
            { name: "invitation_id", value: args.invitationId },
            { name: "tenant_id", value: args.tenantId },
        ],
        text: [
            `Hello ${args.fullName},`,
            "",
            `Your Tenant Admin invited you to Procureline for ${args.tenantName}.`,
            `Invite link: ${args.inviteUrl}`,
            `Activation code: ${args.activationCode}`,
            "",
            "This invitation expires in 7 days. Only the latest invitation remains valid after a resend.",
        ].join("\n"),
        to: [args.email],
    });
    return {
        messageId: result.messageId,
        sent: result.sent,
    };
}
async function evaluateAccessAttemptInternal(ctx, args) {
    const now = args.now ?? Date.now();
    const invitation = await loadInvitationForCredential({
        activationCode: args.activationCode,
        ctx,
        inviteToken: args.inviteToken,
    });
    if (!invitation) {
        return {
            ok: false,
            auditEvent: audit_1.AUDIT_EVENT_NAMES.procurementOfficerInvitationBlocked,
            message: invitations_1.PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE,
            outcome: audit_1.AUDIT_OUTCOMES.blockedInvalidInvitation,
        };
    }
    const tenant = await ctx.db.get(invitation.tenantId);
    const accessMessage = await resolveInvitationAccessMessage({
        invitation,
        now,
        tenant,
    });
    if (accessMessage) {
        return {
            ok: false,
            auditEvent: getInvitationEffectiveStatus({ invitation, now }) === "bounced"
                ? audit_1.AUDIT_EVENT_NAMES.procurementOfficerInvitationBounced
                : audit_1.AUDIT_EVENT_NAMES.procurementOfficerInvitationBlocked,
            message: accessMessage,
            metadata: {
                invitationId: String(invitation._id),
                normalizedEmail: invitation.normalizedEmail,
                status: getInvitationEffectiveStatus({ invitation, now }),
            },
            outcome: accessMessage === invitations_1.PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE
                ? audit_1.AUDIT_OUTCOMES.blockedSubscriptionInactive
                : audit_1.AUDIT_OUTCOMES.blockedInvalidInvitation,
            tenantId: invitation.tenantId,
        };
    }
    if (invitation.normalizedEmail !== args.normalizedEmail) {
        return {
            ok: false,
            auditEvent: audit_1.AUDIT_EVENT_NAMES.procurementOfficerInvitationBlocked,
            message: "Email already in use. Sign in with that account or use the invited email.",
            metadata: {
                invitationId: String(invitation._id),
                normalizedEmail: args.normalizedEmail,
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedRoleCollision,
            tenantId: invitation.tenantId,
        };
    }
    const existingUser = await findUserByNormalizedEmail(ctx, args.normalizedEmail);
    if (!existingUser) {
        return {
            ok: true,
            invitationId: invitation._id,
            normalizedEmail: args.normalizedEmail,
            tenantId: invitation.tenantId,
        };
    }
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
    if (platformMemberships.some((membership) => membership.isActive)) {
        return {
            ok: false,
            auditEvent: audit_1.AUDIT_EVENT_NAMES.procurementOfficerInvitationBlocked,
            message: invitations_1.PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
            metadata: {
                invitationId: String(invitation._id),
                userId: String(existingUser._id),
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedRoleCollision,
            tenantId: invitation.tenantId,
        };
    }
    const sameTenantMembership = tenantMemberships.find((membership) => membership.tenantId === invitation.tenantId);
    if (sameTenantMembership) {
        if ((0, invitations_1.canReuseAcceptedProcurementOfficerInvitation)({
            acceptedByUserId: invitation.acceptedByUserId
                ? String(invitation.acceptedByUserId)
                : undefined,
            acceptedTenantUserId: invitation.acceptedTenantUserId
                ? String(invitation.acceptedTenantUserId)
                : undefined,
            existingUserId: String(existingUser._id),
            status: invitation.status,
            tenantMembershipId: String(sameTenantMembership._id),
            tenantMembershipRole: sameTenantMembership.role,
        })) {
            return {
                ok: true,
                invitationId: invitation._id,
                normalizedEmail: args.normalizedEmail,
                tenantId: invitation.tenantId,
                userIdHint: existingUser._id,
            };
        }
        return {
            ok: false,
            auditEvent: audit_1.AUDIT_EVENT_NAMES.procurementOfficerInvitationBlocked,
            message: invitations_1.PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
            metadata: {
                invitationId: String(invitation._id),
                tenantUserId: String(sameTenantMembership._id),
                userId: String(existingUser._id),
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedRoleCollision,
            tenantId: invitation.tenantId,
        };
    }
    return {
        ok: true,
        invitationId: invitation._id,
        normalizedEmail: args.normalizedEmail,
        tenantId: invitation.tenantId,
        userIdHint: existingUser._id,
    };
}
async function getAuthAccountByEmail(ctx, normalizedEmail) {
    const account = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) => q.eq("provider", invitations_1.PROCUREMENT_OFFICER_AUTH_PROVIDER).eq("providerAccountId", normalizedEmail))
        .first();
    if (!account) {
        return null;
    }
    return {
        accountId: account._id,
        userId: account.userId,
    };
}
exports.getInvitationRecord = (0, server_2.internalQuery)({
    args: {
        invitationId: values_1.v.id("poInvitations"),
    },
    handler: async (ctx, args) => await ctx.db.get(args.invitationId),
});
exports.evaluateAccessAttempt = (0, server_2.internalQuery)({
    args: {
        activationCode: values_1.v.optional(values_1.v.string()),
        inviteToken: values_1.v.optional(values_1.v.string()),
        normalizedEmail: values_1.v.string(),
        now: values_1.v.optional(values_1.v.number()),
    },
    handler: async (ctx, args) => await evaluateAccessAttemptInternal(ctx, {
        activationCode: args.activationCode,
        inviteToken: args.inviteToken,
        normalizedEmail: args.normalizedEmail,
        now: args.now,
    }),
});
exports.getChallenge = (0, server_2.internalQuery)({
    args: {
        challengeId: values_1.v.id("procurementOfficerAuthChallenges"),
    },
    handler: async (ctx, args) => {
        const challenge = await ctx.db.get(args.challengeId);
        if (!challenge) {
            return null;
        }
        if (challenge.consumedAt !== undefined || challenge.expiresAt <= Date.now()) {
            return null;
        }
        return challenge;
    },
});
exports.getAuthAccountForEmail = (0, server_2.internalQuery)({
    args: {
        normalizedEmail: values_1.v.string(),
    },
    handler: async (ctx, args) => await getAuthAccountByEmail(ctx, args.normalizedEmail),
});
exports.bindChallengeToAuthAccount = (0, server_2.internalMutation)({
    args: {
        accountId: values_1.v.id("authAccounts"),
        challengeId: values_1.v.id("procurementOfficerAuthChallenges"),
        userId: values_1.v.id("users"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.challengeId, {
            authAccountId: args.accountId,
            authUserId: args.userId,
            updatedAt: Date.now(),
        });
    },
});
exports.createChallenge = (0, server_2.internalMutation)({
    args: {
        invitationId: values_1.v.id("poInvitations"),
        normalizedEmail: values_1.v.string(),
        tenantId: values_1.v.id("tenants"),
        userIdHint: values_1.v.optional(values_1.v.id("users")),
    },
    returns: values_1.v.id("procurementOfficerAuthChallenges"),
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("procurementOfficerAuthChallenges", {
            authAccountId: undefined,
            authUserId: args.userIdHint,
            consumedAt: undefined,
            createdAt: now,
            expiresAt: now + invitations_1.PROCUREMENT_OFFICER_AUTH_CHALLENGE_WINDOW_MS,
            invitationId: args.invitationId,
            normalizedEmail: args.normalizedEmail,
            tenantId: args.tenantId,
            updatedAt: now,
        });
    },
});
exports.markInvitationEmailSent = (0, server_2.internalMutation)({
    args: {
        invitationId: values_1.v.id("poInvitations"),
        providerMessageId: values_1.v.optional(values_1.v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.invitationId, {
            lastEmailSentAt: Date.now(),
            providerMessageId: args.providerMessageId,
            updatedAt: Date.now(),
        });
    },
});
exports.createInvitationRecord = (0, server_2.internalMutation)({
    args: {
        actorUserId: values_1.v.id("users"),
        email: values_1.v.string(),
        fullName: values_1.v.string(),
        phone: values_1.v.string(),
        tenantId: values_1.v.id("tenants"),
        tenantUserId: values_1.v.id("tenantUsers"),
    },
    returns: values_1.v.object({
        activationCode: values_1.v.string(),
        email: values_1.v.string(),
        fullName: values_1.v.string(),
        inviteUrl: values_1.v.string(),
        invitationId: values_1.v.id("poInvitations"),
        tenantId: values_1.v.id("tenants"),
        tenantName: values_1.v.string(),
    }),
    handler: async (ctx, args) => {
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant || tenant.status !== "active") {
            throw new values_1.ConvexError({
                code: "TENANT_INACTIVE",
                message: invitations_1.PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE,
            });
        }
        const now = Date.now();
        const [existingPoMemberships, tenantInvitations] = await Promise.all([
            ctx.db
                .query("tenantUsers")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
                .filter((q) => q.eq(q.field("role"), "procurement_officer"))
                .collect(),
            ctx.db
                .query("poInvitations")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
                .collect(),
        ]);
        if (existingPoMemberships.length > 0 ||
            tenantInvitations.some((invitation) => getInvitationEffectiveStatus({ invitation, now }) === "pending")) {
            throw new values_1.ConvexError({
                code: "PO_SEAT_OCCUPIED",
                message: "This institution already has a Procurement Officer assignment or pending invitation.",
            });
        }
        const emailResult = (0, input_1.validateEmailInput)(args.email);
        if (!emailResult.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: emailResult.issue.field,
                message: emailResult.issue.message,
            });
        }
        const fullNameResult = (0, input_1.validatePlainTextInput)(args.fullName, {
            field: "fullName",
            label: "Full name",
            maxLength: 100,
            minLength: 2,
        });
        if (!fullNameResult.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: fullNameResult.issue.field,
                message: fullNameResult.issue.message,
            });
        }
        const phoneResult = (0, input_1.validatePlainTextInput)(args.phone, {
            field: "phone",
            label: "Phone",
            maxLength: 30,
            minLength: 7,
        });
        if (!phoneResult.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: phoneResult.issue.field,
                message: phoneResult.issue.message,
            });
        }
        const existingUser = await findUserByNormalizedEmail(ctx, emailResult.value);
        if (existingUser) {
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
            if (platformMemberships.some((membership) => membership.isActive) ||
                tenantMemberships.some((membership) => membership.tenantId === args.tenantId)) {
                throw new values_1.ConvexError({
                    code: "ALREADY_EXISTS",
                    message: invitations_1.PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
                });
            }
        }
        const existingInvitations = await ctx.db
            .query("poInvitations")
            .withIndex("by_tenantId_email", (q) => q.eq("tenantId", args.tenantId).eq("normalizedEmail", emailResult.value))
            .collect();
        const hasPendingInvitation = existingInvitations.some((invitation) => getInvitationEffectiveStatus({ invitation, now }) === "pending");
        if (hasPendingInvitation) {
            throw new values_1.ConvexError({
                code: "ALREADY_EXISTS",
                message: invitations_1.PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
            });
        }
        for (const nextState of (0, invitations_1.invalidateSupersededProcurementOfficerInvitations)(existingInvitations.map((invitation) => ({
            id: String(invitation._id),
            status: invitation.status,
        })))) {
            const invitationId = existingInvitations.find((invitation) => String(invitation._id) === nextState.id)?._id;
            if (invitationId) {
                await ctx.db.patch(invitationId, {
                    status: nextState.nextStatus,
                    updatedAt: now,
                });
            }
        }
        const inviteToken = createInvitationToken();
        const activationCode = createActivationCode();
        const invitationId = await ctx.db.insert("poInvitations", {
            acceptedAt: undefined,
            acceptedByUserId: undefined,
            acceptedTenantUserId: undefined,
            activationCodeHash: await (0, invitations_1.hashProcurementOfficerSecret)((0, invitations_1.normalizeProcurementOfficerActivationCode)(activationCode)),
            activationCodeSuffix: (0, invitations_1.getProcurementOfficerActivationCodeSuffix)((0, invitations_1.normalizeProcurementOfficerActivationCode)(activationCode)),
            bounceNotifiedAt: undefined,
            bounceReason: undefined,
            createdAt: now,
            createdByTenantUserId: args.tenantUserId,
            email: emailResult.value,
            expiresAt: now + invitations_1.PROCUREMENT_OFFICER_INVITATION_TTL_MS,
            fullName: (0, input_1.normalizePlainText)(fullNameResult.value),
            inviteTokenHash: await (0, invitations_1.hashProcurementOfficerSecret)(inviteToken),
            issueVersion: Math.max(0, ...existingInvitations.map((invitation) => invitation.issueVersion)) + 1,
            lastEmailSentAt: undefined,
            normalizedEmail: emailResult.value,
            phone: (0, input_1.normalizePlainText)(phoneResult.value),
            providerMessageId: undefined,
            resentCount: existingInvitations.length,
            status: "pending",
            tenantId: args.tenantId,
            updatedAt: now,
        });
        await (0, _audit_1.appendAuditLogBestEffort)(ctx, {
            action: "issue",
            actor: (0, audit_1.createAuthenticatedAuditActor)({
                role: "tenant_admin",
                userId: String(args.actorUserId),
            }),
            entityType: "procurement_officer_invitation",
            event: audit_1.AUDIT_EVENT_NAMES.procurementOfficerInvitationIssued,
            metadata: {
                normalizedEmail: emailResult.value,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            recordId: String(invitationId),
            targetTenantId: String(args.tenantId),
            timestamp: now,
        });
        return {
            activationCode,
            email: emailResult.value,
            fullName: (0, input_1.normalizePlainText)(fullNameResult.value),
            inviteUrl: `${public_entry_1.PROCUREMENT_OFFICER_ACCESS_ROUTE}?invite=${encodeURIComponent(inviteToken)}`,
            invitationId,
            tenantId: args.tenantId,
            tenantName: tenant.name,
        };
    },
});
exports.resendInvitationRecord = (0, server_2.internalMutation)({
    args: {
        actorUserId: values_1.v.id("users"),
        invitationId: values_1.v.id("poInvitations"),
        tenantId: values_1.v.id("tenants"),
        tenantUserId: values_1.v.id("tenantUsers"),
    },
    returns: values_1.v.object({
        activationCode: values_1.v.string(),
        email: values_1.v.string(),
        fullName: values_1.v.string(),
        inviteUrl: values_1.v.string(),
        invitationId: values_1.v.id("poInvitations"),
        tenantId: values_1.v.id("tenants"),
        tenantName: values_1.v.string(),
    }),
    handler: async (ctx, args) => {
        const currentInvitation = await ctx.db.get(args.invitationId);
        if (!currentInvitation || currentInvitation.tenantId !== args.tenantId) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: invitations_1.PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE,
            });
        }
        const existingInvitations = await ctx.db
            .query("poInvitations")
            .withIndex("by_tenantId_email", (q) => q.eq("tenantId", args.tenantId).eq("normalizedEmail", currentInvitation.normalizedEmail))
            .collect();
        const now = Date.now();
        for (const nextState of (0, invitations_1.invalidateSupersededProcurementOfficerInvitations)(existingInvitations.map((invitation) => ({
            id: String(invitation._id),
            status: invitation.status,
        })))) {
            const invitationId = existingInvitations.find((invitation) => String(invitation._id) === nextState.id)?._id;
            if (invitationId) {
                await ctx.db.patch(invitationId, {
                    status: nextState.nextStatus,
                    updatedAt: now,
                });
            }
        }
        const inviteToken = createInvitationToken();
        const activationCode = createActivationCode();
        const invitationId = await ctx.db.insert("poInvitations", {
            acceptedAt: undefined,
            acceptedByUserId: undefined,
            acceptedTenantUserId: undefined,
            activationCodeHash: await (0, invitations_1.hashProcurementOfficerSecret)((0, invitations_1.normalizeProcurementOfficerActivationCode)(activationCode)),
            activationCodeSuffix: (0, invitations_1.getProcurementOfficerActivationCodeSuffix)((0, invitations_1.normalizeProcurementOfficerActivationCode)(activationCode)),
            bounceNotifiedAt: undefined,
            bounceReason: undefined,
            createdAt: now,
            createdByTenantUserId: args.tenantUserId,
            email: currentInvitation.email,
            expiresAt: now + invitations_1.PROCUREMENT_OFFICER_INVITATION_TTL_MS,
            fullName: currentInvitation.fullName,
            inviteTokenHash: await (0, invitations_1.hashProcurementOfficerSecret)(inviteToken),
            issueVersion: Math.max(0, ...existingInvitations.map((invitation) => invitation.issueVersion)) + 1,
            lastEmailSentAt: undefined,
            normalizedEmail: currentInvitation.normalizedEmail,
            phone: currentInvitation.phone,
            providerMessageId: undefined,
            resentCount: Math.max(-1, ...existingInvitations.map((invitation) => invitation.resentCount)) + 1,
            status: "pending",
            tenantId: args.tenantId,
            updatedAt: now,
        });
        const tenant = await ctx.db.get(args.tenantId);
        await (0, _audit_1.appendAuditLogBestEffort)(ctx, {
            action: "resend",
            actor: (0, audit_1.createAuthenticatedAuditActor)({
                role: "tenant_admin",
                userId: String(args.actorUserId),
            }),
            entityType: "procurement_officer_invitation",
            event: audit_1.AUDIT_EVENT_NAMES.procurementOfficerInvitationResent,
            metadata: {
                normalizedEmail: currentInvitation.normalizedEmail,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            recordId: String(invitationId),
            targetTenantId: String(args.tenantId),
            timestamp: now,
        });
        return {
            activationCode,
            email: currentInvitation.email,
            fullName: currentInvitation.fullName,
            inviteUrl: `${public_entry_1.PROCUREMENT_OFFICER_ACCESS_ROUTE}?invite=${encodeURIComponent(inviteToken)}`,
            invitationId,
            tenantId: args.tenantId,
            tenantName: tenant?.name ?? "Your institution",
        };
    },
});
exports.issueInvitation = (0, server_2.action)({
    args: {
        email: values_1.v.string(),
        fullName: values_1.v.string(),
        phone: values_1.v.string(),
    },
    returns: values_1.v.object({
        activationCode: values_1.v.string(),
        deliveryStatus: values_1.v.union(values_1.v.literal("failed"), values_1.v.literal("sent")),
        email: values_1.v.string(),
        fullName: values_1.v.string(),
        inviteUrl: values_1.v.string(),
        invitationId: values_1.v.id("poInvitations"),
    }),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        if (actor.role !== "tenant_admin" || !actor.tenantId) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Tenant administrator access is required",
            });
        }
        const tenantUser = await ctx.runQuery("functions/users:getCurrentUserTenant", {});
        const result = await ctx.runMutation("functions/procurementOfficerOnboarding:createInvitationRecord", {
            actorUserId: tenantUser.userId,
            email: args.email,
            fullName: args.fullName,
            phone: args.phone,
            tenantId: tenantUser.tenantId,
            tenantUserId: tenantUser._id,
        });
        const emailResult = await sendInvitationEmail({
            activationCode: result.activationCode,
            email: result.email,
            fullName: result.fullName,
            idempotencyKey: `po-invitation:${result.invitationId}:issue`,
            invitationId: String(result.invitationId),
            inviteUrl: result.inviteUrl,
            tenantId: String(result.tenantId),
            tenantName: result.tenantName,
        });
        if (emailResult.sent) {
            await ctx.runMutation(api_1.internal.functions.procurementOfficerOnboarding.markInvitationEmailSent, {
                invitationId: result.invitationId,
                providerMessageId: emailResult.messageId,
            });
        }
        return {
            activationCode: result.activationCode,
            deliveryStatus: emailResult.sent ? "sent" : "failed",
            email: result.email,
            fullName: result.fullName,
            inviteUrl: result.inviteUrl,
            invitationId: result.invitationId,
        };
    },
});
exports.bulkIssueInvitations = (0, server_2.action)({
    args: {
        rows: values_1.v.array(values_1.v.object({
            email: values_1.v.string(),
            fullName: values_1.v.string(),
            phone: values_1.v.string(),
            rowNumber: values_1.v.number(),
        })),
    },
    returns: values_1.v.object({
        accepted: values_1.v.number(),
        errors: values_1.v.array(values_1.v.object({ message: values_1.v.string(), rowNumber: values_1.v.number() })),
    }),
    handler: async (ctx, _args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        if (actor.role !== "tenant_admin" || !actor.tenantId) {
            throw new values_1.ConvexError({ code: "UNAUTHORIZED", message: "Tenant administrator access is required" });
        }
        throw new values_1.ConvexError({
            code: "PO_SINGLE_SEAT_POLICY",
            message: "Bulk Procurement Officer invitations are disabled because each institution has one Procurement Officer assignment.",
        });
    },
});
exports.resendInvitation = (0, server_2.action)({
    args: {
        invitationId: values_1.v.id("poInvitations"),
    },
    returns: values_1.v.object({
        activationCode: values_1.v.string(),
        deliveryStatus: values_1.v.union(values_1.v.literal("failed"), values_1.v.literal("sent")),
        email: values_1.v.string(),
        fullName: values_1.v.string(),
        inviteUrl: values_1.v.string(),
        invitationId: values_1.v.id("poInvitations"),
    }),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        if (actor.role !== "tenant_admin" || !actor.tenantId) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Tenant administrator access is required",
            });
        }
        const tenantUser = await ctx.runQuery("functions/users:getCurrentUserTenant", {});
        const result = await ctx.runMutation("functions/procurementOfficerOnboarding:resendInvitationRecord", {
            actorUserId: tenantUser.userId,
            invitationId: args.invitationId,
            tenantId: tenantUser.tenantId,
            tenantUserId: tenantUser._id,
        });
        const emailResult = await sendInvitationEmail({
            activationCode: result.activationCode,
            email: result.email,
            fullName: result.fullName,
            idempotencyKey: `po-invitation:${result.invitationId}:resend`,
            invitationId: String(result.invitationId),
            inviteUrl: result.inviteUrl,
            tenantId: String(result.tenantId),
            tenantName: result.tenantName,
        });
        if (emailResult.sent) {
            await ctx.runMutation(api_1.internal.functions.procurementOfficerOnboarding.markInvitationEmailSent, {
                invitationId: result.invitationId,
                providerMessageId: emailResult.messageId,
            });
        }
        return {
            activationCode: result.activationCode,
            deliveryStatus: emailResult.sent ? "sent" : "failed",
            email: result.email,
            fullName: result.fullName,
            inviteUrl: result.inviteUrl,
            invitationId: result.invitationId,
        };
    },
});
exports.startAccessChallenge = (0, server_2.action)({
    args: {
        activationCode: values_1.v.optional(values_1.v.string()),
        email: values_1.v.string(),
        inviteToken: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.object({
        challengeId: values_1.v.id("procurementOfficerAuthChallenges"),
        verificationExpiresAt: values_1.v.number(),
    }),
    handler: async (ctx, args) => {
        const emailResult = (0, input_1.validateEmailInput)(args.email);
        if (!emailResult.ok) {
            throw new Error(emailResult.issue.message);
        }
        const normalizedEmail = (0, input_1.normalizeAuthEmail)(emailResult.value);
        const attempt = await ctx.runQuery("functions/procurementOfficerOnboarding:evaluateAccessAttempt", {
            activationCode: args.activationCode,
            inviteToken: args.inviteToken,
            normalizedEmail,
        });
        if (!attempt.ok) {
            await queueAuditFromAction(ctx, createAuditEntry({
                event: attempt.auditEvent,
                metadata: {
                    normalizedEmail,
                    ...attempt.metadata,
                },
                outcome: attempt.outcome,
                targetTenantId: attempt.tenantId,
            })).catch(() => undefined);
            throw new Error(attempt.message);
        }
        const challengeId = await ctx.runMutation("functions/procurementOfficerOnboarding:createChallenge", {
            invitationId: attempt.invitationId,
            normalizedEmail,
            tenantId: attempt.tenantId,
            userIdHint: attempt.userIdHint,
        });
        await ctx.runAction("auth:signIn", {
            calledBy: "procurement-officer-access-start",
            params: {
                challengeId,
                flow: invitations_1.PROCUREMENT_OFFICER_AUTH_START_FLOW,
            },
            provider: invitations_1.PROCUREMENT_OFFICER_AUTH_PROVIDER,
        });
        await queueAuditFromAction(ctx, createAuditEntry({
            event: audit_1.AUDIT_EVENT_NAMES.procurementOfficerChallengeStarted,
            metadata: {
                challengeId: String(challengeId),
                invitationId: String(attempt.invitationId),
                normalizedEmail,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            targetTenantId: attempt.tenantId,
        })).catch(() => undefined);
        return {
            challengeId,
            verificationExpiresAt: Date.now() + invitations_1.PROCUREMENT_OFFICER_AUTH_CHALLENGE_WINDOW_MS,
        };
    },
});
async function startProcurementOfficerOtpChallenge(ctx, challengeId) {
    const challenge = await ctx.runQuery("functions/procurementOfficerOnboarding:getChallenge", { challengeId });
    if (!challenge) {
        throw new Error("Procurement Officer sign-in challenge expired. Start again.");
    }
    let authAccount = challenge.authAccountId
        ? {
            accountId: challenge.authAccountId,
            userId: challenge.authUserId,
        }
        : await ctx.runQuery("functions/procurementOfficerOnboarding:getAuthAccountForEmail", {
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
            provider: invitations_1.PROCUREMENT_OFFICER_AUTH_PROVIDER,
            shouldLinkViaEmail: true,
        });
        authAccount = {
            accountId: created.account._id,
            userId: created.user._id,
        };
    }
    await ctx.runMutation("functions/procurementOfficerOnboarding:bindChallengeToAuthAccount", {
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
exports.startProcurementOfficerOtpChallenge = startProcurementOfficerOtpChallenge;
exports.finalizeSuccessfulAccess = (0, server_2.internalMutation)({
    args: {
        challengeId: values_1.v.id("procurementOfficerAuthChallenges"),
        userId: values_1.v.id("users"),
    },
    returns: values_1.v.object({
        tenantId: values_1.v.id("tenants"),
        tenantUserId: values_1.v.id("tenantUsers"),
    }),
    handler: async (ctx, args) => {
        const challenge = await ctx.db.get(args.challengeId);
        if (!challenge || challenge.consumedAt !== undefined || challenge.expiresAt <= Date.now()) {
            invalidInvitation(invitations_1.PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE);
        }
        const invitation = await ctx.db.get(challenge.invitationId);
        if (!invitation) {
            invalidInvitation(invitations_1.PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE);
        }
        const now = Date.now();
        await markInvitationExpiredIfNeeded(ctx, invitation, now);
        const tenant = await ctx.db.get(invitation.tenantId);
        const accessMessage = await resolveInvitationAccessMessage({
            invitation,
            now,
            tenant,
        });
        if (accessMessage) {
            invalidInvitation(accessMessage);
        }
        const user = await ctx.db.get(args.userId);
        if (!user || typeof user.email !== "string") {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "You must be signed in to accept this invitation.",
            });
        }
        if ((0, input_1.normalizeAuthEmail)(user.email) !== invitation.normalizedEmail) {
            invalidInvitation("Email already in use. Sign in with that account or use the invited email.");
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
        if (platformMemberships.some((membership) => membership.isActive)) {
            throw new values_1.ConvexError({
                code: "ALREADY_EXISTS",
                message: invitations_1.PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
            });
        }
        const sameTenantMembership = tenantMemberships.find((membership) => membership.tenantId === invitation.tenantId);
        if (sameTenantMembership) {
            if ((0, invitations_1.canReuseAcceptedProcurementOfficerInvitation)({
                acceptedByUserId: invitation.acceptedByUserId
                    ? String(invitation.acceptedByUserId)
                    : undefined,
                acceptedTenantUserId: invitation.acceptedTenantUserId
                    ? String(invitation.acceptedTenantUserId)
                    : undefined,
                existingUserId: String(args.userId),
                status: invitation.status,
                tenantMembershipId: String(sameTenantMembership._id),
                tenantMembershipRole: sameTenantMembership.role,
            })) {
                return {
                    tenantId: invitation.tenantId,
                    tenantUserId: sameTenantMembership._id,
                };
            }
            throw new values_1.ConvexError({
                code: "ALREADY_EXISTS",
                message: invitations_1.PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
            });
        }
        const tenantUserId = await ctx.db.insert("tenantUsers", {
            isActive: true,
            role: "procurement_officer",
            tenantId: invitation.tenantId,
            userId: args.userId,
        });
        await ctx.db.patch(invitation._id, {
            acceptedAt: now,
            acceptedByUserId: args.userId,
            acceptedTenantUserId: tenantUserId,
            status: "accepted",
            updatedAt: now,
        });
        await ctx.db.patch(challenge._id, {
            consumedAt: now,
            updatedAt: now,
        });
        await (0, _audit_1.appendAuditLogBestEffort)(ctx, {
            action: "redeem",
            actor: (0, audit_1.createAuthenticatedAuditActor)({
                role: "procurement_officer",
                userId: String(args.userId),
            }),
            entityType: "procurement_officer_invitation",
            event: audit_1.AUDIT_EVENT_NAMES.procurementOfficerInvitationAccepted,
            metadata: {
                normalizedEmail: invitation.normalizedEmail,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            recordId: String(invitation._id),
            targetTenantId: String(invitation.tenantId),
            timestamp: now,
        });
        return {
            tenantId: invitation.tenantId,
            tenantUserId,
        };
    },
});
async function verifyProcurementOfficerOtpChallenge(ctx, args) {
    const challenge = await ctx.runQuery("functions/procurementOfficerOnboarding:getChallenge", { challengeId: args.challengeId });
    if (!challenge || !challenge.authAccountId) {
        throw new Error("Procurement Officer sign-in challenge expired. Start again.");
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
        if (getErrorMessage(error)) {
            throw error;
        }
    }
    if (!signedIn) {
        throw new Error(invitations_1.PROCUREMENT_OFFICER_INVALID_VERIFICATION_CODE_MESSAGE);
    }
    const finalized = await ctx.runMutation("functions/procurementOfficerOnboarding:finalizeSuccessfulAccess", {
        challengeId: challenge._id,
        userId: signedIn.userId,
    });
    await ctx.runMutation(api_1.internal.functions.sessions.setTenantSelectionForSession, {
        sessionId: signedIn.sessionId,
        tenantId: finalized.tenantId,
        tenantRole: "procurement_officer",
        tenantUserId: finalized.tenantUserId,
        userId: signedIn.userId,
    });
    await queueAuditFromAction(ctx, createAuditEntry({
        actorUserId: signedIn.userId,
        event: audit_1.AUDIT_EVENT_NAMES.procurementOfficerChallengeVerified,
        metadata: {
            challengeId: String(challenge._id),
            invitationId: String(challenge.invitationId),
            normalizedEmail: challenge.normalizedEmail,
        },
        outcome: audit_1.AUDIT_OUTCOMES.allowed,
        targetTenantId: finalized.tenantId,
    })).catch(() => undefined);
    return signedIn;
}
exports.verifyProcurementOfficerOtpChallenge = verifyProcurementOfficerOtpChallenge;
exports.recordBounceFromWebhook = (0, server_2.mutation)({
    args: {
        bounceReason: values_1.v.string(),
        invitationId: values_1.v.id("poInvitations"),
        payloadHash: values_1.v.string(),
        providerEventKey: values_1.v.string(),
        proxyToken: values_1.v.string(),
        providerMessageId: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.object({
        notificationEmails: values_1.v.array(values_1.v.string()),
        status: values_1.v.union(values_1.v.literal("duplicate"), values_1.v.literal("processed")),
        tenantName: values_1.v.string(),
        warningContext: values_1.v.object({
            invitationEmail: values_1.v.string(),
            invitationName: values_1.v.string(),
            reason: values_1.v.string(),
        }),
    }),
    handler: async (ctx, args) => {
        if (!process.env.RESEND_WEBHOOK_PROXY_TOKEN ||
            args.proxyToken !== process.env.RESEND_WEBHOOK_PROXY_TOKEN) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Invalid webhook proxy token",
            });
        }
        const existingEvent = await ctx.db
            .query("externalServiceSyncEvents")
            .withIndex("by_eventKey", (q) => q.eq("eventKey", args.providerEventKey))
            .first();
        const invitation = await ctx.db.get(args.invitationId);
        if (!invitation) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: invitations_1.PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE,
            });
        }
        const tenant = await ctx.db.get(invitation.tenantId);
        if (existingEvent) {
            return {
                notificationEmails: [],
                status: "duplicate",
                tenantName: tenant?.name ?? "Your institution",
                warningContext: {
                    invitationEmail: invitation.email,
                    invitationName: invitation.fullName,
                    reason: args.bounceReason,
                },
            };
        }
        const now = Date.now();
        const nextStatus = (0, invitations_1.resolveProcurementOfficerBounceStatus)(invitation.status);
        if (nextStatus === "bounced") {
            await ctx.db.patch(invitation._id, {
                bounceNotifiedAt: invitation.bounceNotifiedAt ?? now,
                bounceReason: args.bounceReason,
                providerMessageId: args.providerMessageId ?? invitation.providerMessageId,
                status: "bounced",
                updatedAt: now,
            });
        }
        await ctx.db.insert("externalServiceSyncEvents", {
            actorRole: "system",
            actorTenantId: invitation.tenantId,
            actorUserId: undefined,
            claimedAt: now,
            durableChanges: [
                {
                    invitationId: String(invitation._id),
                    status: nextStatus,
                },
            ],
            eventKey: args.providerEventKey,
            eventType: "email.bounced",
            metadata: {
                invitationId: String(invitation._id),
                providerMessageId: args.providerMessageId,
            },
            payloadHash: args.payloadHash,
            processedAt: now,
            provider: "resend",
            result: {
                invitationId: String(invitation._id),
                status: nextStatus,
            },
            status: "completed",
            updatedAt: now,
        });
        await (0, _audit_1.appendAuditLogBestEffort)(ctx, {
            action: "bounce",
            actor: (0, audit_1.createAnonymousAuditActor)(),
            entityType: "procurement_officer_invitation",
            event: audit_1.AUDIT_EVENT_NAMES.procurementOfficerInvitationBounced,
            metadata: {
                normalizedEmail: invitation.normalizedEmail,
                reason: args.bounceReason,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            recordId: String(invitation._id),
            targetTenantId: String(invitation.tenantId),
            timestamp: now,
        });
        const tenantAdminMemberships = await ctx.db
            .query("tenantUsers")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", invitation.tenantId))
            .collect();
        const tenantAdminIds = tenantAdminMemberships
            .filter((membership) => membership.isActive && membership.role === "tenant_admin")
            .map((membership) => membership.userId);
        const tenantAdminDocs = await Promise.all(tenantAdminIds.map(async (userId) => await ctx.db.get(userId)));
        return {
            notificationEmails: nextStatus === "bounced"
                ? tenantAdminDocs
                    .map((user) => typeof user?.email === "string" ? user.email : null)
                    .filter((email) => Boolean(email))
                : [],
            status: "processed",
            tenantName: tenant?.name ?? "Your institution",
            warningContext: {
                invitationEmail: invitation.email,
                invitationName: invitation.fullName,
                reason: args.bounceReason,
            },
        };
    },
});
exports.getInvitationAccessContext = (0, server_2.query)({
    args: {
        activationCode: values_1.v.optional(values_1.v.string()),
        inviteToken: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.object({
        email: values_1.v.optional(values_1.v.string()),
        isValid: values_1.v.boolean(),
        message: values_1.v.optional(values_1.v.string()),
        tenantName: values_1.v.optional(values_1.v.string()),
    }),
    handler: async (ctx, args) => {
        try {
            const invitation = await loadInvitationForCredential({
                activationCode: args.activationCode,
                ctx,
                inviteToken: args.inviteToken,
            });
            if (!invitation) {
                return {
                    isValid: false,
                    message: invitations_1.PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE,
                };
            }
            const tenant = await ctx.db.get(invitation.tenantId);
            const message = await resolveInvitationAccessMessage({
                invitation,
                now: Date.now(),
                tenant,
            });
            return {
                email: invitation.email,
                isValid: !message,
                message: message ?? undefined,
                tenantName: tenant?.name,
            };
        }
        catch {
            return {
                isValid: false,
                message: invitations_1.PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE,
            };
        }
    },
});
