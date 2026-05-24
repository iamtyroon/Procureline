import { getAuthUserId } from "@convex-dev/auth/server";
import { generateRandomString } from "@oslojs/crypto/random";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { AUDIT_EVENT_NAMES, createAuthenticatedAuditActor } from "../../lib/shared/security/audit";
import { sha256Hex } from "../../lib/backend/platform-admin/risk";
import {
    TENANT_ADMIN_INVITATION_TTL_MS,
    TENANT_ADMIN_VERIFICATION_WINDOW_MS,
    canAutoResendTenantAdminVerification,
    getTenantAdminInvitationAccessMessage,
    invalidateSupersededInvitationStatuses,
} from "../../lib/shared/tenant-admin/invitations";
import {
    normalizeAuthEmail,
    normalizePlainText,
    validateEmailInput,
    validateOrganizationNameInput,
    validatePlainTextInput,
} from "../../lib/shared/security/input";
import { appendAuditLogBestEffort } from "./_audit";
import { requirePlatformAdmin, requireTenantRole } from "./_roleGuard";

type TenantAdminInvitationStatus = Doc<"tenantAdminInvitations">["status"];
type OnboardingMode = "invite" | "self_serve";

const invitationContextValidator = v.object({
    email: v.optional(v.string()),
    isValid: v.boolean(),
    message: v.optional(v.string()),
    tenantId: v.optional(v.id("tenants")),
    tenantName: v.optional(v.string()),
});

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

function invalidInvitation(message: string): never {
    throw new ConvexError({
        code: "INVITATION_INVALID",
        message,
    });
}

async function findInvitationByToken(
    ctx: QueryCtx | MutationCtx,
    inviteToken: string,
): Promise<Doc<"tenantAdminInvitations"> | null> {
    const tokenHash = await sha256Hex(inviteToken);
    return await ctx.db
        .query("tenantAdminInvitations")
        .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
        .first();
}

async function getLatestOnboardingState(
    ctx: QueryCtx | MutationCtx,
    normalizedEmail: string,
): Promise<Doc<"tenantAdminOnboardingStates"> | null> {
    return await ctx.db
        .query("tenantAdminOnboardingStates")
        .withIndex("by_normalizedEmail", (q) =>
            q.eq("normalizedEmail", normalizedEmail),
        )
        .order("desc")
        .first();
}

async function upsertVerificationWindow(args: {
    ctx: MutationCtx;
    invitationId?: Id<"tenantAdminInvitations">;
    mode: OnboardingMode;
    normalizedEmail: string;
    now: number;
    tenantId?: Id<"tenants">;
}): Promise<number> {
    const existingState = await getLatestOnboardingState(
        args.ctx,
        args.normalizedEmail,
    );
    const verificationWindowExpiresAt =
        args.now + TENANT_ADMIN_VERIFICATION_WINDOW_MS;

    if (
        existingState &&
        existingState.completedAt === undefined &&
        existingState.mode === args.mode
    ) {
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

async function ensureNoApplicationRoleAssignment(
    ctx: MutationCtx,
    userId: Id<"users">,
): Promise<void> {
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
        throw new ConvexError({
            code: "ALREADY_EXISTS",
            message:
                "Email already in use. An application role assignment already exists for this user.",
        });
    }
}

function resolveInvitationAccessMessage(args: {
    invitation: Doc<"tenantAdminInvitations">;
    now: number;
    tenant: Doc<"tenants"> | null;
}): string | null {
    if (!args.tenant) {
        return "This invitation is invalid. Request a new link.";
    }

    const effectiveStatus: TenantAdminInvitationStatus =
        args.invitation.status === "pending" && args.invitation.expiresAt <= args.now
            ? "expired"
            : args.invitation.status;

    return getTenantAdminInvitationAccessMessage({
        expiresAt: args.invitation.expiresAt,
        now: args.now,
        status: effectiveStatus,
        tenantIsActive: args.tenant.status === "active" || args.tenant.status === "pending",
    });
}

async function markInvitationExpiredIfNeeded(
    ctx: MutationCtx,
    invitation: Doc<"tenantAdminInvitations">,
    now: number,
): Promise<void> {
    if (invitation.status === "pending" && invitation.expiresAt <= now) {
        await ctx.db.patch(invitation._id, {
            status: "expired",
            updatedAt: now,
        });
    }
}

async function createInvitation(args: {
    ctx: MutationCtx;
    email: string;
    platformUserId: Id<"users">;
    tenantId: Id<"tenants">;
}): Promise<{
    email: string;
    expiresAt: number;
    inviteToken: string;
    inviteUrl: string;
    invitationId: Id<"tenantAdminInvitations">;
    resentCount: number;
}> {
    const emailResult = validateEmailInput(args.email);
    if (!emailResult.ok) {
        throw new ConvexError({
            code: "VALIDATION_FAILED",
            field: emailResult.issue.field,
            message: emailResult.issue.message,
        });
    }

    const tenant = await args.ctx.db.get(args.tenantId);
    if (!tenant || tenant.status !== "active") {
        throw new ConvexError({
            code: "TENANT_INACTIVE",
            message: "Tenant deactivated. Contact Support.",
        });
    }

    const existingInvitations = await args.ctx.db
        .query("tenantAdminInvitations")
        .withIndex("by_tenantId_email", (q) =>
            q.eq("tenantId", args.tenantId).eq("normalizedEmail", emailResult.value),
        )
        .collect();
    const now = Date.now();
    const resentCount =
        Math.max(-1, ...existingInvitations.map((invitation) => invitation.resentCount)) +
        1;

    for (const nextState of invalidateSupersededInvitationStatuses(
        existingInvitations.map((invitation) => ({
            id: String(invitation._id),
            status: invitation.status,
        })),
    )) {
        const invitationId = existingInvitations.find(
            (invitation) => String(invitation._id) === nextState.id,
        )?._id;
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
        expiresAt: now + TENANT_ADMIN_INVITATION_TTL_MS,
        normalizedEmail: emailResult.value,
        resentCount,
        status: "pending",
        tenantId: args.tenantId,
        tokenHash: await sha256Hex(inviteToken),
        updatedAt: now,
    });

    return {
        email: args.email.trim(),
        expiresAt: now + TENANT_ADMIN_INVITATION_TTL_MS,
        inviteToken,
        inviteUrl: `/signup?invite=${encodeURIComponent(inviteToken)}`,
        invitationId,
        resentCount,
    };
}

export async function startVerificationWindowCore(args: {
    ctx: MutationCtx;
    email: string;
    inviteToken?: string;
    mode: OnboardingMode;
}): Promise<{
    verificationWindowExpiresAt: number;
}> {
    const emailResult = validateEmailInput(args.email);
    if (!emailResult.ok) {
        throw new ConvexError({
            code: "VALIDATION_FAILED",
            field: emailResult.issue.field,
            message: emailResult.issue.message,
        });
    }

    const now = Date.now();
    let invitationId: Id<"tenantAdminInvitations"> | undefined;
    let tenantId: Id<"tenants"> | undefined;

    if (args.mode === "invite") {
        const invitation = await findInvitationByToken(
            args.ctx,
            args.inviteToken?.trim() ?? "",
        );
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
            invalidInvitation(
                "Email already in use. Sign in with that account or use the invited email.",
            );
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

export async function registerVerificationResendCore(args: {
    ctx: MutationCtx;
    email: string;
    inviteToken?: string;
    mode: OnboardingMode;
    resendMode: "auto" | "manual";
}): Promise<{
    allowed: boolean;
    message?: string;
    verificationWindowExpiresAt?: number;
}> {
    const emailResult = validateEmailInput(args.email);
    if (!emailResult.ok) {
        throw new ConvexError({
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
        const invitation = await findInvitationByToken(
            args.ctx,
            args.inviteToken?.trim() ?? "",
        );
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

    const allowed =
        args.resendMode === "manual"
            ? true
            : canAutoResendTenantAdminVerification({
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
        autoResendCount:
            args.resendMode === "auto"
                ? state.autoResendCount + 1
                : state.autoResendCount,
        lastVerificationSentAt: now,
        manualResendCount:
            args.resendMode === "manual"
                ? state.manualResendCount + 1
                : state.manualResendCount,
        updatedAt: now,
    });

    return {
        allowed: true,
        verificationWindowExpiresAt: state.verificationWindowExpiresAt,
    };
}

export async function issueInvitationCore(args: {
    ctx: MutationCtx;
    email: string;
    platformUserId: Id<"users">;
    tenantId: Id<"tenants">;
}): Promise<{
    email: string;
    expiresAt: number;
    inviteToken: string;
    inviteUrl: string;
    invitationId: Id<"tenantAdminInvitations">;
    resentCount: number;
}> {
    const result = await createInvitation({
        ctx: args.ctx,
        email: args.email,
        platformUserId: args.platformUserId,
        tenantId: args.tenantId,
    });

    await appendAuditLogBestEffort(args.ctx, {
        action: "issue",
        actor: createAuthenticatedAuditActor({
            role: "platform_admin",
            userId: String(args.platformUserId),
        }),
        entityType: "tenant_admin_invitation",
        event: AUDIT_EVENT_NAMES.tenantAdminInvitationIssued,
        metadata: {
            normalizedEmail: normalizeAuthEmail(args.email),
            resentCount: result.resentCount,
        },
        outcome: "allowed",
        recordId: String(result.invitationId),
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    });

    return result;
}

export async function resendInvitationCore(args: {
    ctx: MutationCtx;
    email: string;
    platformUserId: Id<"users">;
    tenantId: Id<"tenants">;
}): Promise<{
    email: string;
    expiresAt: number;
    inviteToken: string;
    inviteUrl: string;
    invitationId: Id<"tenantAdminInvitations">;
    resentCount: number;
}> {
    const result = await createInvitation({
        ctx: args.ctx,
        email: args.email,
        platformUserId: args.platformUserId,
        tenantId: args.tenantId,
    });

    await appendAuditLogBestEffort(args.ctx, {
        action: "resend",
        actor: createAuthenticatedAuditActor({
            role: "platform_admin",
            userId: String(args.platformUserId),
        }),
        entityType: "tenant_admin_invitation",
        event: AUDIT_EVENT_NAMES.tenantAdminInvitationResent,
        metadata: {
            normalizedEmail: normalizeAuthEmail(args.email),
            resentCount: result.resentCount,
        },
        outcome: "allowed",
        recordId: String(result.invitationId),
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    });

    return result;
}

export async function redeemInvitationCore(args: {
    ctx: MutationCtx;
    inviteToken: string;
    userId: Id<"users">;
}): Promise<{
    tenantId: Id<"tenants">;
    tenantUserId: Id<"tenantUsers">;
}> {
    const user = await args.ctx.db.get(args.userId);
    if (!user || typeof user.email !== "string") {
        throw new ConvexError({
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
        await appendAuditLogBestEffort(args.ctx, {
            action: "redeem",
            actor: createAuthenticatedAuditActor({
                role: "unassigned",
                userId: String(args.userId),
            }),
            entityType: "tenant_admin_invitation",
            event: AUDIT_EVENT_NAMES.tenantAdminOnboardingBlocked,
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

    if (normalizeAuthEmail(user.email) !== invitation.normalizedEmail) {
        invalidInvitation(
            "Email already in use. Sign in with that account or use the invited email.",
        );
    }

    const existingMembership = await args.ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) =>
            q.eq("userId", args.userId).eq("tenantId", invitation.tenantId),
        )
        .first();
    if (
        existingMembership &&
        existingMembership.role === "tenant_admin" &&
        invitation.acceptedByUserId === args.userId
    ) {
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

    const onboardingState = await getLatestOnboardingState(
        args.ctx,
        invitation.normalizedEmail,
    );
    if (onboardingState) {
        await args.ctx.db.patch(onboardingState._id, {
            completedAt: now,
            invitationId: invitation._id,
            tenantId: invitation.tenantId,
            updatedAt: now,
        });
    }

    await appendAuditLogBestEffort(args.ctx, {
        action: "redeem",
        actor: createAuthenticatedAuditActor({
            role: "tenant_admin",
            userId: String(args.userId),
        }),
        entityType: "tenant_admin_invitation",
        event: AUDIT_EVENT_NAMES.tenantAdminInvitationAccepted,
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

export async function completeInstitutionProfileCore(args: {
    authContext: { tenantId: Id<"tenants">; userId: Id<"users"> };
    ctx: MutationCtx;
    fiscalYearStartMonth: number;
    institutionName: string;
    logoUrl?: string;
    primaryContactEmail: string;
    primaryContactName: string;
    primaryContactPhone: string;
}): Promise<{
    profileComplete: boolean;
    tenantId: Id<"tenants">;
}> {
    const tenant = await args.ctx.db.get(args.authContext.tenantId);

    if (!tenant || tenant.status !== "active") {
        await appendAuditLogBestEffort(args.ctx, {
            action: "complete",
            actor: createAuthenticatedAuditActor({
                role: "tenant_admin",
                userId: String(args.authContext.userId),
            }),
            entityType: "tenant",
            event: AUDIT_EVENT_NAMES.tenantAdminOnboardingBlocked,
            metadata: {
                reason: "tenant_inactive",
            },
            outcome: "blocked_subscription_inactive",
            recordId: tenant ? String(tenant._id) : undefined,
            targetTenantId: tenant ? String(tenant._id) : undefined,
            timestamp: Date.now(),
        });
        throw new ConvexError({
            code: "TENANT_INACTIVE",
            message: "Tenant deactivated. Contact Support.",
        });
    }

    const institutionNameResult = validateOrganizationNameInput(
        args.institutionName,
    );
    if (!institutionNameResult.ok) {
        throw new ConvexError({
            code: "VALIDATION_FAILED",
            field: institutionNameResult.issue.field,
            message: institutionNameResult.issue.message,
        });
    }

    const primaryContactNameResult = validatePlainTextInput(
        args.primaryContactName,
        {
            field: "primaryContactName",
            label: "Primary contact name",
            maxLength: 100,
            minLength: 2,
        },
    );
    if (!primaryContactNameResult.ok) {
        throw new ConvexError({
            code: "VALIDATION_FAILED",
            field: primaryContactNameResult.issue.field,
            message: primaryContactNameResult.issue.message,
        });
    }

    const primaryContactPhoneResult = validatePlainTextInput(
        args.primaryContactPhone,
        {
            field: "primaryContactPhone",
            label: "Primary contact phone",
            maxLength: 30,
            minLength: 7,
        },
    );
    if (!primaryContactPhoneResult.ok) {
        throw new ConvexError({
            code: "VALIDATION_FAILED",
            field: primaryContactPhoneResult.issue.field,
            message: primaryContactPhoneResult.issue.message,
        });
    }

    const primaryContactEmailResult = validateEmailInput(
        args.primaryContactEmail,
        "primaryContactEmail",
    );
    if (!primaryContactEmailResult.ok) {
        throw new ConvexError({
            code: "VALIDATION_FAILED",
            field: primaryContactEmailResult.issue.field,
            message: primaryContactEmailResult.issue.message,
        });
    }

    if (
        !Number.isInteger(args.fiscalYearStartMonth) ||
        args.fiscalYearStartMonth < 1 ||
        args.fiscalYearStartMonth > 12
    ) {
        throw new ConvexError({
            code: "VALIDATION_FAILED",
            field: "fiscalYearStartMonth",
            message: "Fiscal year start month must be between 1 and 12.",
        });
    }

    const now = Date.now();
    await args.ctx.db.patch(tenant._id, {
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        logoUrl:
            typeof args.logoUrl === "string" && args.logoUrl.trim().length > 0
                ? args.logoUrl.trim()
                : undefined,
        name: institutionNameResult.value.normalized,
        onboardingCompletedAt: now,
        primaryContactEmail: primaryContactEmailResult.value,
        primaryContactName: normalizePlainText(args.primaryContactName),
        primaryContactPhone: normalizePlainText(args.primaryContactPhone),
        profileComplete: true,
    });

    const onboardingState = await getLatestOnboardingState(
        args.ctx,
        primaryContactEmailResult.value,
    );
    if (onboardingState) {
        await args.ctx.db.patch(onboardingState._id, {
            completedAt: now,
            tenantId: tenant._id,
            updatedAt: now,
        });
    }

    await appendAuditLogBestEffort(args.ctx, {
        action: "complete",
        actor: createAuthenticatedAuditActor({
            role: "tenant_admin",
            userId: String(args.authContext.userId),
        }),
        entityType: "tenant",
        event: AUDIT_EVENT_NAMES.tenantAdminOnboardingCompleted,
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

export const getInvitationContext = query({
    args: {
        inviteToken: v.string(),
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

export const startVerificationWindow = mutation({
    args: {
        email: v.string(),
        inviteToken: v.optional(v.string()),
        mode: v.union(v.literal("invite"), v.literal("self_serve")),
    },
    returns: v.object({
        verificationWindowExpiresAt: v.number(),
    }),
    handler: async (ctx, args) =>
        await startVerificationWindowCore({
            ctx,
            email: args.email,
            inviteToken: args.inviteToken,
            mode: args.mode,
        }),
});

export const registerVerificationResend = mutation({
    args: {
        email: v.string(),
        inviteToken: v.optional(v.string()),
        mode: v.union(v.literal("invite"), v.literal("self_serve")),
        resendMode: v.union(v.literal("auto"), v.literal("manual")),
    },
    returns: v.object({
        allowed: v.boolean(),
        message: v.optional(v.string()),
        verificationWindowExpiresAt: v.optional(v.number()),
    }),
    handler: async (ctx, args) =>
        await registerVerificationResendCore({
            ctx,
            email: args.email,
            inviteToken: args.inviteToken,
            mode: args.mode,
            resendMode: args.resendMode,
        }),
});

export const issueInvitation = mutation({
    args: {
        email: v.string(),
        tenantId: v.id("tenants"),
    },
    returns: v.object({
        email: v.string(),
        expiresAt: v.number(),
        inviteToken: v.string(),
        inviteUrl: v.string(),
        invitationId: v.id("tenantAdminInvitations"),
        resentCount: v.number(),
    }),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        return await issueInvitationCore({
            ctx,
            email: args.email,
            platformUserId: authContext.userId,
            tenantId: args.tenantId,
        });
    },
});

export const resendInvitation = mutation({
    args: {
        email: v.string(),
        tenantId: v.id("tenants"),
    },
    returns: v.object({
        email: v.string(),
        expiresAt: v.number(),
        inviteToken: v.string(),
        inviteUrl: v.string(),
        invitationId: v.id("tenantAdminInvitations"),
        resentCount: v.number(),
    }),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        return await resendInvitationCore({
            ctx,
            email: args.email,
            platformUserId: authContext.userId,
            tenantId: args.tenantId,
        });
    },
});

export const redeemInvitation = mutation({
    args: {
        inviteToken: v.string(),
    },
    returns: v.object({
        tenantId: v.id("tenants"),
        tenantUserId: v.id("tenantUsers"),
    }),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new ConvexError({
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

export const getCurrentOnboardingContext = query({
    args: {},
    returns: v.object({
        fiscalYearStartMonth: v.optional(v.number()),
        institutionName: v.string(),
        logoUrl: v.optional(v.string()),
        primaryContactEmail: v.string(),
        primaryContactName: v.optional(v.string()),
        primaryContactPhone: v.optional(v.string()),
        profileComplete: v.boolean(),
        tenantId: v.id("tenants"),
        tenantName: v.string(),
    }),
    handler: async (ctx) => {
        const authContext = await requireTenantRole(ctx, ["tenant_admin"]);
        const [tenant, user] = await Promise.all([
            ctx.db.get(authContext.tenantId),
            ctx.db.get(authContext.userId),
        ]);

        if (!tenant) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found.",
            });
        }

        if (tenant.status !== "active") {
            throw new ConvexError({
                code: "TENANT_INACTIVE",
                message: "Tenant deactivated. Contact Support.",
            });
        }

        return {
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            institutionName: tenant.name,
            logoUrl: tenant.logoUrl,
            primaryContactEmail:
                tenant.primaryContactEmail ??
                (typeof user?.email === "string" ? user.email : ""),
            primaryContactName: tenant.primaryContactName,
            primaryContactPhone: tenant.primaryContactPhone,
            profileComplete: tenant.profileComplete === true,
            tenantId: tenant._id,
            tenantName: tenant.name,
        };
    },
});

export const completeInstitutionProfile = mutation({
    args: {
        fiscalYearStartMonth: v.number(),
        institutionName: v.string(),
        logoUrl: v.optional(v.string()),
        primaryContactEmail: v.string(),
        primaryContactName: v.string(),
        primaryContactPhone: v.string(),
    },
    returns: v.object({
        profileComplete: v.boolean(),
        tenantId: v.id("tenants"),
    }),
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["tenant_admin"]);
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
