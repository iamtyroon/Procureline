import {
    createAccount,
    signInViaProvider,
    type GenericActionCtxWithAuthConfig,
} from "@convex-dev/auth/server";
import { generateRandomString } from "@oslojs/crypto/random";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { sendAppEmail } from "../emailTransport";
import {
    action,
    internalMutation,
    internalQuery,
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "../_generated/server";
import {
    PROCUREMENT_OFFICER_ACCESS_ROUTE,
} from "../../lib/shared/auth/public-entry";
import {
    AUDIT_EVENT_NAMES,
    AUDIT_OUTCOMES,
    createAnonymousAuditActor,
    createAuthenticatedAuditActor,
    serializeAuditEvent,
    type AuditEventEntry,
} from "../../lib/shared/security/audit";
import {
    normalizeAuthEmail,
    normalizePlainText,
    validateEmailInput,
    validatePlainTextInput,
} from "../../lib/shared/security/input";
import {
    canReuseAcceptedProcurementOfficerInvitation,
    PROCUREMENT_OFFICER_AUTH_CHALLENGE_WINDOW_MS,
    PROCUREMENT_OFFICER_AUTH_PROVIDER,
    PROCUREMENT_OFFICER_AUTH_START_FLOW,
    PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE,
    PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
    PROCUREMENT_OFFICER_INVALID_VERIFICATION_CODE_MESSAGE,
    PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE,
    PROCUREMENT_OFFICER_INVITATION_TTL_MS,
    PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE,
    formatProcurementOfficerActivationCode,
    getProcurementOfficerActivationCodeSuffix,
    getProcurementOfficerInvitationAccessMessage,
    hashProcurementOfficerSecret,
    invalidateSupersededProcurementOfficerInvitations,
    normalizeProcurementOfficerActivationCode,
    resolveProcurementOfficerBounceStatus,
} from "../../lib/procurement-officer/invitations";
import { appendAuditLogBestEffort } from "./_audit";
import { ResendOTP } from "../ResendOTP";
import { getServiceActorContext } from "../actions/_helpers";

type ReadCtx = QueryCtx | MutationCtx;
type ActionCtx = GenericActionCtxWithAuthConfig<any>;
type ProcurementOfficerInvitation = Doc<"poInvitations">;

interface AccessAttemptSuccess {
    invitationId: Id<"poInvitations">;
    normalizedEmail: string;
    tenantId: Id<"tenants">;
    userIdHint?: Id<"users">;
}

type AccessAttemptFailure = {
    auditEvent:
        | typeof AUDIT_EVENT_NAMES.procurementOfficerInvitationBlocked
        | typeof AUDIT_EVENT_NAMES.procurementOfficerInvitationBounced;
    message: string;
    metadata?: Record<string, unknown>;
    outcome:
        | typeof AUDIT_OUTCOMES.blockedInvalidInvitation
        | typeof AUDIT_OUTCOMES.blockedRoleCollision
        | typeof AUDIT_OUTCOMES.blockedSubscriptionInactive;
    tenantId?: Id<"tenants">;
};

type AccessAttemptResult =
    | ({ ok: true } & AccessAttemptSuccess)
    | ({ ok: false } & AccessAttemptFailure);

function randomReader() {
    return {
        read(bytes: Uint8Array): void {
            crypto.getRandomValues(bytes);
        },
    };
}

function createInvitationToken(): string {
    return generateRandomString(
        randomReader(),
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789",
        48,
    );
}

function createActivationCode(): string {
    const raw = generateRandomString(
        randomReader(),
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
        12,
    );
    return formatProcurementOfficerActivationCode(raw);
}

function getErrorMessage(error: unknown): string | null {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message.trim();
    }

    return null;
}

function invalidInvitation(message: string): never {
    throw new ConvexError({
        code: "INVITATION_INVALID",
        message,
    });
}

function ensureSingleCredentialFamily(args: {
    activationCode?: string;
    inviteToken?: string;
}): void {
    if (args.inviteToken && args.activationCode) {
        invalidInvitation(PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE);
    }

    if (!args.inviteToken && !args.activationCode) {
        invalidInvitation(PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE);
    }
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
                  role: "procurement_officer",
                  userId: String(args.actorUserId),
              })
            : createAnonymousAuditActor(),
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

async function queueAuditFromAction(
    ctx: { runMutation: ActionCtx["runMutation"] },
    entry: AuditEventEntry,
): Promise<void> {
    await ctx.runMutation(
        "functions/auditLogs:appendAuditLogFromAction" as any,
        serializeAuditEvent(entry),
    );
}

function getInvitationEffectiveStatus(args: {
    invitation: ProcurementOfficerInvitation;
    now: number;
}): ProcurementOfficerInvitation["status"] {
    if (args.invitation.status === "pending" && args.invitation.expiresAt <= args.now) {
        return "expired";
    }

    return args.invitation.status;
}

async function markInvitationExpiredIfNeeded(
    ctx: MutationCtx,
    invitation: ProcurementOfficerInvitation,
    now: number,
): Promise<void> {
    if (invitation.status === "pending" && invitation.expiresAt <= now) {
        await ctx.db.patch(invitation._id, {
            status: "expired",
            updatedAt: now,
        });
    }
}

async function findInvitationByInviteToken(
    ctx: ReadCtx,
    inviteToken: string,
): Promise<ProcurementOfficerInvitation | null> {
    const inviteTokenHash = await hashProcurementOfficerSecret(inviteToken);
    return await ctx.db
        .query("poInvitations")
        .withIndex("by_inviteTokenHash", (q) =>
            q.eq("inviteTokenHash", inviteTokenHash),
        )
        .first();
}

async function findInvitationByActivationCode(
    ctx: ReadCtx,
    activationCode: string,
): Promise<ProcurementOfficerInvitation | null> {
    const normalizedActivationCode =
        normalizeProcurementOfficerActivationCode(activationCode);
    const activationCodeHash = await hashProcurementOfficerSecret(
        normalizedActivationCode,
    );

    return await ctx.db
        .query("poInvitations")
        .withIndex("by_activationCodeHash", (q) =>
            q.eq("activationCodeHash", activationCodeHash),
        )
        .first();
}

async function loadInvitationForCredential(args: {
    activationCode?: string;
    ctx: ReadCtx;
    inviteToken?: string;
}): Promise<ProcurementOfficerInvitation | null> {
    ensureSingleCredentialFamily({
        activationCode: args.activationCode,
        inviteToken: args.inviteToken,
    });

    if (args.inviteToken) {
        return await findInvitationByInviteToken(args.ctx, args.inviteToken.trim());
    }

    return await findInvitationByActivationCode(
        args.ctx,
        args.activationCode?.trim() ?? "",
    );
}

async function findUserByNormalizedEmail(
    ctx: ReadCtx,
    normalizedEmail: string,
): Promise<Doc<"users"> | null> {
    const users = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", normalizedEmail))
        .collect();

    if (users.length > 1) {
        throw new ConvexError({
            code: "DATA_INTEGRITY_ERROR",
            message: PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
        });
    }

    return users[0] ?? null;
}

async function resolveInvitationAccessMessage(args: {
    invitation: ProcurementOfficerInvitation;
    now: number;
    tenant: Doc<"tenants"> | null;
}): Promise<string | null> {
    return getProcurementOfficerInvitationAccessMessage({
        expiresAt: args.invitation.expiresAt,
        now: args.now,
        status: args.invitation.status,
        tenantIsActive: args.tenant?.status === "active",
    });
}

async function sendInvitationEmail(args: {
    activationCode: string;
    email: string;
    fullName: string;
    idempotencyKey: string;
    inviteUrl: string;
    invitationId: string;
    tenantId: string;
    tenantName: string;
}): Promise<{ messageId?: string; sent: boolean }> {
    const fromAddress =
        process.env.AUTH_RESET_RESEND_FROM ??
        "Procureline <onboarding@resend.dev>";
    const result = await sendAppEmail({
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

async function evaluateAccessAttemptInternal(
    ctx: ReadCtx,
    args: {
        activationCode?: string;
        inviteToken?: string;
        normalizedEmail: string;
        now?: number;
    },
): Promise<AccessAttemptResult> {
    const now = args.now ?? Date.now();
    const invitation = await loadInvitationForCredential({
        activationCode: args.activationCode,
        ctx,
        inviteToken: args.inviteToken,
    });

    if (!invitation) {
        return {
            ok: false,
            auditEvent: AUDIT_EVENT_NAMES.procurementOfficerInvitationBlocked,
            message: PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE,
            outcome: AUDIT_OUTCOMES.blockedInvalidInvitation,
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
            auditEvent:
                getInvitationEffectiveStatus({ invitation, now }) === "bounced"
                    ? AUDIT_EVENT_NAMES.procurementOfficerInvitationBounced
                    : AUDIT_EVENT_NAMES.procurementOfficerInvitationBlocked,
            message: accessMessage,
            metadata: {
                invitationId: String(invitation._id),
                normalizedEmail: invitation.normalizedEmail,
                status: getInvitationEffectiveStatus({ invitation, now }),
            },
            outcome:
                accessMessage === PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE
                    ? AUDIT_OUTCOMES.blockedSubscriptionInactive
                    : AUDIT_OUTCOMES.blockedInvalidInvitation,
            tenantId: invitation.tenantId,
        };
    }

    if (invitation.normalizedEmail !== args.normalizedEmail) {
        return {
            ok: false,
            auditEvent: AUDIT_EVENT_NAMES.procurementOfficerInvitationBlocked,
            message:
                "Email already in use. Sign in with that account or use the invited email.",
            metadata: {
                invitationId: String(invitation._id),
                normalizedEmail: args.normalizedEmail,
            },
            outcome: AUDIT_OUTCOMES.blockedRoleCollision,
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
            auditEvent: AUDIT_EVENT_NAMES.procurementOfficerInvitationBlocked,
            message: PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
            metadata: {
                invitationId: String(invitation._id),
                userId: String(existingUser._id),
            },
            outcome: AUDIT_OUTCOMES.blockedRoleCollision,
            tenantId: invitation.tenantId,
        };
    }

    const sameTenantMembership = tenantMemberships.find(
        (membership) => membership.tenantId === invitation.tenantId,
    );
    if (sameTenantMembership) {
        if (
            canReuseAcceptedProcurementOfficerInvitation({
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
            })
        ) {
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
            auditEvent: AUDIT_EVENT_NAMES.procurementOfficerInvitationBlocked,
            message: PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
            metadata: {
                invitationId: String(invitation._id),
                tenantUserId: String(sameTenantMembership._id),
                userId: String(existingUser._id),
            },
            outcome: AUDIT_OUTCOMES.blockedRoleCollision,
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

async function getAuthAccountByEmail(
    ctx: ReadCtx,
    normalizedEmail: string,
): Promise<{ accountId: Id<"authAccounts">; userId: Id<"users"> } | null> {
    const account = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
            q.eq("provider", PROCUREMENT_OFFICER_AUTH_PROVIDER).eq(
                "providerAccountId",
                normalizedEmail,
            ),
        )
        .first();

    if (!account) {
        return null;
    }

    return {
        accountId: account._id,
        userId: account.userId,
    };
}

export const getInvitationRecord = internalQuery({
    args: {
        invitationId: v.id("poInvitations"),
    },
    handler: async (ctx, args) => await ctx.db.get(args.invitationId),
});

export const evaluateAccessAttempt = internalQuery({
    args: {
        activationCode: v.optional(v.string()),
        inviteToken: v.optional(v.string()),
        normalizedEmail: v.string(),
        now: v.optional(v.number()),
    },
    handler: async (ctx, args) =>
        await evaluateAccessAttemptInternal(ctx, {
            activationCode: args.activationCode,
            inviteToken: args.inviteToken,
            normalizedEmail: args.normalizedEmail,
            now: args.now,
        }),
});

export const getChallenge = internalQuery({
    args: {
        challengeId: v.id("procurementOfficerAuthChallenges"),
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

export const getAuthAccountForEmail = internalQuery({
    args: {
        normalizedEmail: v.string(),
    },
    handler: async (ctx, args) =>
        await getAuthAccountByEmail(ctx, args.normalizedEmail),
});

export const bindChallengeToAuthAccount = internalMutation({
    args: {
        accountId: v.id("authAccounts"),
        challengeId: v.id("procurementOfficerAuthChallenges"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.challengeId, {
            authAccountId: args.accountId,
            authUserId: args.userId,
            updatedAt: Date.now(),
        });
    },
});

export const createChallenge = internalMutation({
    args: {
        invitationId: v.id("poInvitations"),
        normalizedEmail: v.string(),
        tenantId: v.id("tenants"),
        userIdHint: v.optional(v.id("users")),
    },
    returns: v.id("procurementOfficerAuthChallenges"),
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("procurementOfficerAuthChallenges", {
            authAccountId: undefined,
            authUserId: args.userIdHint,
            consumedAt: undefined,
            createdAt: now,
            expiresAt: now + PROCUREMENT_OFFICER_AUTH_CHALLENGE_WINDOW_MS,
            invitationId: args.invitationId,
            normalizedEmail: args.normalizedEmail,
            tenantId: args.tenantId,
            updatedAt: now,
        });
    },
});

export const markInvitationEmailSent = internalMutation({
    args: {
        invitationId: v.id("poInvitations"),
        providerMessageId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.invitationId, {
            lastEmailSentAt: Date.now(),
            providerMessageId: args.providerMessageId,
            updatedAt: Date.now(),
        });
    },
});

export const createInvitationRecord = internalMutation({
    args: {
        actorUserId: v.id("users"),
        email: v.string(),
        fullName: v.string(),
        phone: v.string(),
        tenantId: v.id("tenants"),
        tenantUserId: v.id("tenantUsers"),
    },
    returns: v.object({
        activationCode: v.string(),
        email: v.string(),
        fullName: v.string(),
        inviteUrl: v.string(),
        invitationId: v.id("poInvitations"),
        tenantId: v.id("tenants"),
        tenantName: v.string(),
    }),
    handler: async (ctx, args) => {
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant || tenant.status !== "active") {
            throw new ConvexError({
                code: "TENANT_INACTIVE",
                message: PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE,
            });
        }

        const emailResult = validateEmailInput(args.email);
        if (!emailResult.ok) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: emailResult.issue.field,
                message: emailResult.issue.message,
            });
        }

        const fullNameResult = validatePlainTextInput(args.fullName, {
            field: "fullName",
            label: "Full name",
            maxLength: 100,
            minLength: 2,
        });
        if (!fullNameResult.ok) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: fullNameResult.issue.field,
                message: fullNameResult.issue.message,
            });
        }

        const phoneResult = validatePlainTextInput(args.phone, {
            field: "phone",
            label: "Phone",
            maxLength: 30,
            minLength: 7,
        });
        if (!phoneResult.ok) {
            throw new ConvexError({
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

            if (
                platformMemberships.some((membership) => membership.isActive) ||
                tenantMemberships.some((membership) => membership.tenantId === args.tenantId)
            ) {
                throw new ConvexError({
                    code: "ALREADY_EXISTS",
                    message: PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
                });
            }
        }

        const existingInvitations = await ctx.db
            .query("poInvitations")
            .withIndex("by_tenantId_email", (q) =>
                q.eq("tenantId", args.tenantId).eq("normalizedEmail", emailResult.value),
            )
            .collect();
        const now = Date.now();
        const hasPendingInvitation = existingInvitations.some(
            (invitation) =>
                getInvitationEffectiveStatus({ invitation, now }) === "pending",
        );
        if (hasPendingInvitation) {
            throw new ConvexError({
                code: "ALREADY_EXISTS",
                message: PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
            });
        }

        for (const nextState of invalidateSupersededProcurementOfficerInvitations(
            existingInvitations.map((invitation) => ({
                id: String(invitation._id),
                status: invitation.status,
            })),
        )) {
            const invitationId = existingInvitations.find(
                (invitation) => String(invitation._id) === nextState.id,
            )?._id;
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
            activationCodeHash: await hashProcurementOfficerSecret(
                normalizeProcurementOfficerActivationCode(activationCode),
            ),
            activationCodeSuffix: getProcurementOfficerActivationCodeSuffix(
                normalizeProcurementOfficerActivationCode(activationCode),
            ),
            bounceNotifiedAt: undefined,
            bounceReason: undefined,
            createdAt: now,
            createdByTenantUserId: args.tenantUserId,
            email: emailResult.value,
            expiresAt: now + PROCUREMENT_OFFICER_INVITATION_TTL_MS,
            fullName: normalizePlainText(fullNameResult.value),
            inviteTokenHash: await hashProcurementOfficerSecret(inviteToken),
            issueVersion:
                Math.max(
                    0,
                    ...existingInvitations.map((invitation) => invitation.issueVersion),
                ) + 1,
            lastEmailSentAt: undefined,
            normalizedEmail: emailResult.value,
            phone: normalizePlainText(phoneResult.value),
            providerMessageId: undefined,
            resentCount: existingInvitations.length,
            status: "pending",
            tenantId: args.tenantId,
            updatedAt: now,
        });

        await appendAuditLogBestEffort(ctx, {
            action: "issue",
            actor: createAuthenticatedAuditActor({
                role: "tenant_admin",
                userId: String(args.actorUserId),
            }),
            entityType: "procurement_officer_invitation",
            event: AUDIT_EVENT_NAMES.procurementOfficerInvitationIssued,
            metadata: {
                normalizedEmail: emailResult.value,
            },
            outcome: AUDIT_OUTCOMES.allowed,
            recordId: String(invitationId),
            targetTenantId: String(args.tenantId),
            timestamp: now,
        });

        return {
            activationCode,
            email: emailResult.value,
            fullName: normalizePlainText(fullNameResult.value),
            inviteUrl: `${PROCUREMENT_OFFICER_ACCESS_ROUTE}?invite=${encodeURIComponent(
                inviteToken,
            )}`,
            invitationId,
            tenantId: args.tenantId,
            tenantName: tenant.name,
        };
    },
});

export const resendInvitationRecord = internalMutation({
    args: {
        actorUserId: v.id("users"),
        invitationId: v.id("poInvitations"),
        tenantId: v.id("tenants"),
        tenantUserId: v.id("tenantUsers"),
    },
    returns: v.object({
        activationCode: v.string(),
        email: v.string(),
        fullName: v.string(),
        inviteUrl: v.string(),
        invitationId: v.id("poInvitations"),
        tenantId: v.id("tenants"),
        tenantName: v.string(),
    }),
    handler: async (ctx, args) => {
        const currentInvitation = await ctx.db.get(args.invitationId);
        if (!currentInvitation || currentInvitation.tenantId !== args.tenantId) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE,
            });
        }

        const existingInvitations = await ctx.db
            .query("poInvitations")
            .withIndex("by_tenantId_email", (q) =>
                q.eq("tenantId", args.tenantId).eq(
                    "normalizedEmail",
                    currentInvitation.normalizedEmail,
                ),
            )
            .collect();
        const now = Date.now();

        for (const nextState of invalidateSupersededProcurementOfficerInvitations(
            existingInvitations.map((invitation) => ({
                id: String(invitation._id),
                status: invitation.status,
            })),
        )) {
            const invitationId = existingInvitations.find(
                (invitation) => String(invitation._id) === nextState.id,
            )?._id;
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
            activationCodeHash: await hashProcurementOfficerSecret(
                normalizeProcurementOfficerActivationCode(activationCode),
            ),
            activationCodeSuffix: getProcurementOfficerActivationCodeSuffix(
                normalizeProcurementOfficerActivationCode(activationCode),
            ),
            bounceNotifiedAt: undefined,
            bounceReason: undefined,
            createdAt: now,
            createdByTenantUserId: args.tenantUserId,
            email: currentInvitation.email,
            expiresAt: now + PROCUREMENT_OFFICER_INVITATION_TTL_MS,
            fullName: currentInvitation.fullName,
            inviteTokenHash: await hashProcurementOfficerSecret(inviteToken),
            issueVersion:
                Math.max(
                    0,
                    ...existingInvitations.map((invitation) => invitation.issueVersion),
                ) + 1,
            lastEmailSentAt: undefined,
            normalizedEmail: currentInvitation.normalizedEmail,
            phone: currentInvitation.phone,
            providerMessageId: undefined,
            resentCount:
                Math.max(
                    -1,
                    ...existingInvitations.map((invitation) => invitation.resentCount),
                ) + 1,
            status: "pending",
            tenantId: args.tenantId,
            updatedAt: now,
        });
        const tenant = await ctx.db.get(args.tenantId);

        await appendAuditLogBestEffort(ctx, {
            action: "resend",
            actor: createAuthenticatedAuditActor({
                role: "tenant_admin",
                userId: String(args.actorUserId),
            }),
            entityType: "procurement_officer_invitation",
            event: AUDIT_EVENT_NAMES.procurementOfficerInvitationResent,
            metadata: {
                normalizedEmail: currentInvitation.normalizedEmail,
            },
            outcome: AUDIT_OUTCOMES.allowed,
            recordId: String(invitationId),
            targetTenantId: String(args.tenantId),
            timestamp: now,
        });

        return {
            activationCode,
            email: currentInvitation.email,
            fullName: currentInvitation.fullName,
            inviteUrl: `${PROCUREMENT_OFFICER_ACCESS_ROUTE}?invite=${encodeURIComponent(
                inviteToken,
            )}`,
            invitationId,
            tenantId: args.tenantId,
            tenantName: tenant?.name ?? "Your institution",
        };
    },
});

export const issueInvitation: ReturnType<typeof action> = action({
    args: {
        email: v.string(),
        fullName: v.string(),
        phone: v.string(),
    },
    returns: v.object({
        activationCode: v.string(),
        deliveryStatus: v.union(v.literal("failed"), v.literal("sent")),
        email: v.string(),
        fullName: v.string(),
        inviteUrl: v.string(),
        invitationId: v.id("poInvitations"),
    }),
    handler: async (ctx, args) => {
        const actor = await getServiceActorContext(ctx);
        if (actor.role !== "tenant_admin" || !actor.tenantId) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Tenant administrator access is required",
            });
        }

        const tenantUser: {
            _id: Id<"tenantUsers">;
            tenantId: Id<"tenants">;
            userId: Id<"users">;
        } = await ctx.runQuery("functions/users:getCurrentUserTenant" as any, {});
        const result: {
            activationCode: string;
            email: string;
            fullName: string;
            invitationId: Id<"poInvitations">;
            inviteUrl: string;
            tenantId: Id<"tenants">;
            tenantName: string;
        } = await ctx.runMutation(
            "functions/procurementOfficerOnboarding:createInvitationRecord" as any,
            {
                actorUserId: tenantUser.userId,
                email: args.email,
                fullName: args.fullName,
                phone: args.phone,
                tenantId: tenantUser.tenantId,
                tenantUserId: tenantUser._id,
            },
        );

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
            await ctx.runMutation(
                internal.functions.procurementOfficerOnboarding.markInvitationEmailSent,
                {
                    invitationId: result.invitationId,
                    providerMessageId: emailResult.messageId,
                },
            );
        }

        return {
            activationCode: result.activationCode,
            deliveryStatus: emailResult.sent ? ("sent" as const) : ("failed" as const),
            email: result.email,
            fullName: result.fullName,
            inviteUrl: result.inviteUrl,
            invitationId: result.invitationId,
        };
    },
});

export const resendInvitation = action({
    args: {
        invitationId: v.id("poInvitations"),
    },
    returns: v.object({
        activationCode: v.string(),
        deliveryStatus: v.union(v.literal("failed"), v.literal("sent")),
        email: v.string(),
        fullName: v.string(),
        inviteUrl: v.string(),
        invitationId: v.id("poInvitations"),
    }),
    handler: async (ctx, args) => {
        const actor = await getServiceActorContext(ctx);
        if (actor.role !== "tenant_admin" || !actor.tenantId) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Tenant administrator access is required",
            });
        }

        const tenantUser: {
            _id: Id<"tenantUsers">;
            tenantId: Id<"tenants">;
            userId: Id<"users">;
        } = await ctx.runQuery("functions/users:getCurrentUserTenant" as any, {});
        const result: {
            activationCode: string;
            email: string;
            fullName: string;
            invitationId: Id<"poInvitations">;
            inviteUrl: string;
            tenantId: Id<"tenants">;
            tenantName: string;
        } = await ctx.runMutation(
            "functions/procurementOfficerOnboarding:resendInvitationRecord" as any,
            {
                actorUserId: tenantUser.userId,
                invitationId: args.invitationId,
                tenantId: tenantUser.tenantId,
                tenantUserId: tenantUser._id,
            },
        );
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
            await ctx.runMutation(
                internal.functions.procurementOfficerOnboarding.markInvitationEmailSent,
                {
                    invitationId: result.invitationId,
                    providerMessageId: emailResult.messageId,
                },
            );
        }

        return {
            activationCode: result.activationCode,
            deliveryStatus: emailResult.sent ? ("sent" as const) : ("failed" as const),
            email: result.email,
            fullName: result.fullName,
            inviteUrl: result.inviteUrl,
            invitationId: result.invitationId,
        };
    },
});

export const startAccessChallenge: ReturnType<typeof action> = action({
    args: {
        activationCode: v.optional(v.string()),
        email: v.string(),
        inviteToken: v.optional(v.string()),
    },
    returns: v.object({
        challengeId: v.id("procurementOfficerAuthChallenges"),
        verificationExpiresAt: v.number(),
    }),
    handler: async (ctx, args) => {
        const emailResult = validateEmailInput(args.email);
        if (!emailResult.ok) {
            throw new Error(emailResult.issue.message);
        }

        const normalizedEmail = normalizeAuthEmail(emailResult.value);
        const attempt: AccessAttemptResult = await ctx.runQuery(
            "functions/procurementOfficerOnboarding:evaluateAccessAttempt" as any,
            {
                activationCode: args.activationCode,
                inviteToken: args.inviteToken,
                normalizedEmail,
            },
        );

        if (!attempt.ok) {
            await queueAuditFromAction(
                ctx,
                createAuditEntry({
                    event: attempt.auditEvent,
                    metadata: {
                        normalizedEmail,
                        ...attempt.metadata,
                    },
                    outcome: attempt.outcome,
                    targetTenantId: attempt.tenantId,
                }),
            ).catch(() => undefined);
            throw new Error(attempt.message);
        }

        const challengeId: Id<"procurementOfficerAuthChallenges"> =
            await ctx.runMutation(
                "functions/procurementOfficerOnboarding:createChallenge" as any,
            {
                invitationId: attempt.invitationId,
                normalizedEmail,
                tenantId: attempt.tenantId,
                userIdHint: attempt.userIdHint,
            },
        );

        await ctx.runAction("auth:signIn" as any, {
            calledBy: "procurement-officer-access-start",
            params: {
                challengeId,
                flow: PROCUREMENT_OFFICER_AUTH_START_FLOW,
            },
            provider: PROCUREMENT_OFFICER_AUTH_PROVIDER,
        });

        await queueAuditFromAction(
            ctx,
            createAuditEntry({
                event: AUDIT_EVENT_NAMES.procurementOfficerChallengeStarted,
                metadata: {
                    challengeId: String(challengeId),
                    invitationId: String(attempt.invitationId),
                    normalizedEmail,
                },
                outcome: AUDIT_OUTCOMES.allowed,
                targetTenantId: attempt.tenantId,
            }),
        ).catch(() => undefined);

        return {
            challengeId,
            verificationExpiresAt:
                Date.now() + PROCUREMENT_OFFICER_AUTH_CHALLENGE_WINDOW_MS,
        };
    },
});

export async function startProcurementOfficerOtpChallenge(
    ctx: ActionCtx,
    challengeId: Id<"procurementOfficerAuthChallenges">,
): Promise<null> {
    const challenge = await ctx.runQuery(
        "functions/procurementOfficerOnboarding:getChallenge" as any,
        { challengeId },
    );
    if (!challenge) {
        throw new Error("Procurement Officer sign-in challenge expired. Start again.");
    }

    let authAccount = challenge.authAccountId
        ? {
              accountId: challenge.authAccountId,
              userId: challenge.authUserId!,
          }
        : await ctx.runQuery(
              "functions/procurementOfficerOnboarding:getAuthAccountForEmail" as any,
              {
                  normalizedEmail: challenge.normalizedEmail,
              },
          );

    if (!authAccount) {
        const created = await createAccount(ctx, {
            account: {
                id: challenge.normalizedEmail,
            },
            profile: {
                email: challenge.normalizedEmail,
            },
            provider: PROCUREMENT_OFFICER_AUTH_PROVIDER,
            shouldLinkViaEmail: true,
        });

        authAccount = {
            accountId: created.account._id,
            userId: created.user._id,
        };
    }

    await ctx.runMutation(
        "functions/procurementOfficerOnboarding:bindChallengeToAuthAccount" as any,
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

export const finalizeSuccessfulAccess = internalMutation({
    args: {
        challengeId: v.id("procurementOfficerAuthChallenges"),
        userId: v.id("users"),
    },
    returns: v.object({
        tenantId: v.id("tenants"),
        tenantUserId: v.id("tenantUsers"),
    }),
    handler: async (ctx, args) => {
        const challenge = await ctx.db.get(args.challengeId);
        if (!challenge || challenge.consumedAt !== undefined || challenge.expiresAt <= Date.now()) {
            invalidInvitation(PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE);
        }

        const invitation = await ctx.db.get(challenge.invitationId);
        if (!invitation) {
            invalidInvitation(PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE);
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
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "You must be signed in to accept this invitation.",
            });
        }

        if (normalizeAuthEmail(user.email) !== invitation.normalizedEmail) {
            invalidInvitation(
                "Email already in use. Sign in with that account or use the invited email.",
            );
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
            throw new ConvexError({
                code: "ALREADY_EXISTS",
                message: PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
            });
        }

        const sameTenantMembership = tenantMemberships.find(
            (membership) => membership.tenantId === invitation.tenantId,
        );
        if (sameTenantMembership) {
            if (
                canReuseAcceptedProcurementOfficerInvitation({
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
                })
            ) {
                return {
                    tenantId: invitation.tenantId,
                    tenantUserId: sameTenantMembership._id,
                };
            }

            throw new ConvexError({
                code: "ALREADY_EXISTS",
                message: PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
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

        await appendAuditLogBestEffort(ctx, {
            action: "redeem",
            actor: createAuthenticatedAuditActor({
                role: "procurement_officer",
                userId: String(args.userId),
            }),
            entityType: "procurement_officer_invitation",
            event: AUDIT_EVENT_NAMES.procurementOfficerInvitationAccepted,
            metadata: {
                normalizedEmail: invitation.normalizedEmail,
            },
            outcome: AUDIT_OUTCOMES.allowed,
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

export async function verifyProcurementOfficerOtpChallenge(
    ctx: ActionCtx,
    args: {
        challengeId: Id<"procurementOfficerAuthChallenges">;
        code: string;
    },
): Promise<{
    sessionId: Id<"authSessions">;
    userId: Id<"users">;
}> {
    const challenge = await ctx.runQuery(
        "functions/procurementOfficerOnboarding:getChallenge" as any,
        { challengeId: args.challengeId },
    );
    if (!challenge || !challenge.authAccountId) {
        throw new Error("Procurement Officer sign-in challenge expired. Start again.");
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
        if (getErrorMessage(error)) {
            throw error;
        }
    }

    if (!signedIn) {
        throw new Error(PROCUREMENT_OFFICER_INVALID_VERIFICATION_CODE_MESSAGE);
    }

    const finalized = await ctx.runMutation(
        "functions/procurementOfficerOnboarding:finalizeSuccessfulAccess" as any,
        {
            challengeId: challenge._id,
            userId: signedIn.userId,
        },
    );
    await ctx.runMutation(internal.functions.sessions.setTenantSelectionForSession, {
        sessionId: signedIn.sessionId,
        tenantId: finalized.tenantId,
        tenantRole: "procurement_officer",
        tenantUserId: finalized.tenantUserId,
        userId: signedIn.userId,
    });
    await queueAuditFromAction(
        ctx,
        createAuditEntry({
            actorUserId: signedIn.userId,
            event: AUDIT_EVENT_NAMES.procurementOfficerChallengeVerified,
            metadata: {
                challengeId: String(challenge._id),
                invitationId: String(challenge.invitationId),
                normalizedEmail: challenge.normalizedEmail,
            },
            outcome: AUDIT_OUTCOMES.allowed,
            targetTenantId: finalized.tenantId,
        }),
    ).catch(() => undefined);

    return signedIn;
}

export const recordBounceFromWebhook = mutation({
    args: {
        bounceReason: v.string(),
        invitationId: v.id("poInvitations"),
        payloadHash: v.string(),
        providerEventKey: v.string(),
        proxyToken: v.string(),
        providerMessageId: v.optional(v.string()),
    },
    returns: v.object({
        notificationEmails: v.array(v.string()),
        status: v.union(v.literal("duplicate"), v.literal("processed")),
        tenantName: v.string(),
        warningContext: v.object({
            invitationEmail: v.string(),
            invitationName: v.string(),
            reason: v.string(),
        }),
    }),
    handler: async (ctx, args) => {
        if (
            !process.env.RESEND_WEBHOOK_PROXY_TOKEN ||
            args.proxyToken !== process.env.RESEND_WEBHOOK_PROXY_TOKEN
        ) {
            throw new ConvexError({
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
            throw new ConvexError({
                code: "NOT_FOUND",
                message: PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE,
            });
        }
        const tenant = await ctx.db.get(invitation.tenantId);

        if (existingEvent) {
            return {
                notificationEmails: [],
                status: "duplicate" as const,
                tenantName: tenant?.name ?? "Your institution",
                warningContext: {
                    invitationEmail: invitation.email,
                    invitationName: invitation.fullName,
                    reason: args.bounceReason,
                },
            };
        }

        const now = Date.now();
        const nextStatus = resolveProcurementOfficerBounceStatus(invitation.status);
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

        await appendAuditLogBestEffort(ctx, {
            action: "bounce",
            actor: createAnonymousAuditActor(),
            entityType: "procurement_officer_invitation",
            event: AUDIT_EVENT_NAMES.procurementOfficerInvitationBounced,
            metadata: {
                normalizedEmail: invitation.normalizedEmail,
                reason: args.bounceReason,
            },
            outcome: AUDIT_OUTCOMES.allowed,
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
        const tenantAdminDocs = await Promise.all(
            tenantAdminIds.map(async (userId) => await ctx.db.get(userId)),
        );

        return {
            notificationEmails:
                nextStatus === "bounced"
                    ? tenantAdminDocs
                          .map((user) =>
                              typeof user?.email === "string" ? user.email : null,
                          )
                          .filter((email): email is string => Boolean(email))
                    : [],
            status: "processed" as const,
            tenantName: tenant?.name ?? "Your institution",
            warningContext: {
                invitationEmail: invitation.email,
                invitationName: invitation.fullName,
                reason: args.bounceReason,
            },
        };
    },
});

export const getInvitationAccessContext = query({
    args: {
        activationCode: v.optional(v.string()),
        inviteToken: v.optional(v.string()),
    },
    returns: v.object({
        email: v.optional(v.string()),
        isValid: v.boolean(),
        message: v.optional(v.string()),
        tenantName: v.optional(v.string()),
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
                    message: PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE,
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
        } catch {
            return {
                isValid: false,
                message: PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE,
            };
        }
    },
});
