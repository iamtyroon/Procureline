import { AUDIT_EVENT_NAMES } from "../../security/audit";
import {
    normalizeAuthEmail,
    normalizePlainText,
    validateEmailInput,
    validateOrganizationNameInput,
    validatePlainTextInput,
} from "../../security/input";
import { sha256Hex } from "../platform-admin/risk";
import {
    TENANT_ADMIN_INVITATION_TTL_MS,
    TENANT_ADMIN_VERIFICATION_WINDOW_MS,
    canAutoResendTenantAdminVerification,
    getTenantAdminInvitationAccessMessage,
    invalidateSupersededInvitationStatuses,
} from "../../shared/tenant-admin/invitations";

type QueryTableName =
    | "auditLogs"
    | "platformUsers"
    | "tenantAdminInvitations"
    | "tenantAdminOnboardingStates"
    | "tenantUsers"
    | "tenants"
    | "users";

type OnboardingMode = "invite" | "self_serve";

interface QueryBuilderLike {
    withIndex(
        indexName: string,
        build: (builder: IndexBuilderLike) => unknown,
    ): QueryBuilderLike;
    order(direction: "asc" | "desc"): QueryBuilderLike;
    collect(): Promise<Array<Record<string, unknown>>>;
    first(): Promise<Record<string, unknown> | null>;
}

interface IndexBuilderLike {
    eq(field: string, value: unknown): IndexBuilderLike;
}

export interface BackendMutationCtxLike {
    db: {
        get(id: string): Promise<Record<string, unknown> | null>;
        insert(
            tableName: QueryTableName,
            value: Record<string, unknown>,
        ): Promise<string>;
        patch(id: string, value: Record<string, unknown>): Promise<void>;
        query(tableName: QueryTableName): QueryBuilderLike;
    };
}

export class TenantAdminOnboardingBackendError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly field?: string,
    ) {
        super(message);
        this.name = "TenantAdminOnboardingBackendError";
    }
}

function asNumber(value: unknown): number | undefined {
    return typeof value === "number" ? value : undefined;
}

function requiredString(value: unknown): string {
    if (typeof value !== "string") {
        throw new Error("Expected string value");
    }

    return value;
}

function backendError(code: string, message: string, field?: string): never {
    throw new TenantAdminOnboardingBackendError(code, message, field);
}

function resolveInvitationAccessMessage(args: {
    invitation: Record<string, unknown>;
    now: number;
    tenant: Record<string, unknown> | null;
}): string | null {
    if (!args.tenant) {
        return "This invitation is invalid. Request a new link.";
    }

    const invitationStatus = requiredString(args.invitation.status);
    const expiresAt = asNumber(args.invitation.expiresAt) ?? 0;
    const effectiveStatus =
        invitationStatus === "pending" && expiresAt <= args.now
            ? "expired"
            : invitationStatus;

    return getTenantAdminInvitationAccessMessage({
        expiresAt,
        now: args.now,
        status: effectiveStatus as Parameters<
            typeof getTenantAdminInvitationAccessMessage
        >[0]["status"],
        tenantIsActive: requiredString(args.tenant.status) === "active",
    });
}

async function appendAuditLog(
    ctx: BackendMutationCtxLike,
    entry: Record<string, unknown>,
): Promise<void> {
    await ctx.db.insert("auditLogs", entry);
}

async function findInvitationByToken(
    ctx: BackendMutationCtxLike,
    inviteToken: string,
): Promise<Record<string, unknown> | null> {
    const tokenHash = await sha256Hex(inviteToken);
    return await ctx.db
        .query("tenantAdminInvitations")
        .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
        .first();
}

async function getLatestOnboardingState(
    ctx: BackendMutationCtxLike,
    normalizedEmail: string,
): Promise<Record<string, unknown> | null> {
    return await ctx.db
        .query("tenantAdminOnboardingStates")
        .withIndex("by_normalizedEmail", (q) =>
            q.eq("normalizedEmail", normalizedEmail),
        )
        .order("desc")
        .first();
}

async function createInvitationToken(now: number, email: string): Promise<string> {
    return `invite-${now}-${await sha256Hex(`${email}:${now}`)}`;
}

async function createInvitation(args: {
    ctx: BackendMutationCtxLike;
    email: string;
    now: number;
    platformUserId: string;
    tenantId: string;
}): Promise<{
    email: string;
    expiresAt: number;
    inviteToken: string;
    inviteUrl: string;
    invitationId: string;
    resentCount: number;
}> {
    const emailResult = validateEmailInput(args.email);
    if (!emailResult.ok) {
        backendError(
            "VALIDATION_FAILED",
            emailResult.issue.message,
            emailResult.issue.field,
        );
    }

    const tenant = await args.ctx.db.get(args.tenantId);
    if (!tenant || requiredString(tenant.status) !== "active") {
        backendError("TENANT_INACTIVE", "Tenant deactivated. Contact Support.");
    }

    const existingInvitations = await args.ctx.db
        .query("tenantAdminInvitations")
        .withIndex("by_tenantId_email", (q) =>
            q.eq("tenantId", args.tenantId).eq("normalizedEmail", emailResult.value),
        )
        .collect();

    const resentCount =
        Math.max(
            -1,
            ...existingInvitations.map((invitation) =>
                asNumber(invitation.resentCount) ?? -1,
            ),
        ) + 1;

    for (const nextState of invalidateSupersededInvitationStatuses(
        existingInvitations.map((invitation) => ({
            id: requiredString(invitation._id),
            status: requiredString(invitation.status) as Parameters<
                typeof invalidateSupersededInvitationStatuses
            >[0][number]["status"],
        })),
    )) {
        await args.ctx.db.patch(nextState.id, {
            status: nextState.nextStatus,
            updatedAt: args.now,
        });
    }

    const inviteToken = await createInvitationToken(args.now, args.email);
    const invitationId = await args.ctx.db.insert("tenantAdminInvitations", {
        createdAt: args.now,
        createdByPlatformUserId: args.platformUserId,
        email: args.email.trim(),
        expiresAt: args.now + TENANT_ADMIN_INVITATION_TTL_MS,
        normalizedEmail: emailResult.value,
        resentCount,
        status: "pending",
        tenantId: args.tenantId,
        tokenHash: await sha256Hex(inviteToken),
        updatedAt: args.now,
    });

    return {
        email: args.email.trim(),
        expiresAt: args.now + TENANT_ADMIN_INVITATION_TTL_MS,
        inviteToken,
        inviteUrl: `/signup?invite=${encodeURIComponent(inviteToken)}`,
        invitationId,
        resentCount,
    };
}

export async function issueInvitationForBackendTests(args: {
    ctx: BackendMutationCtxLike;
    email: string;
    now: number;
    platformUserId: string;
    tenantId: string;
}) {
    const result = await createInvitation(args);
    await appendAuditLog(args.ctx, {
        action: "issue",
        actorRole: "platform_admin",
        actorState: "authenticated",
        actorUserId: args.platformUserId,
        entityType: "tenant_admin_invitation",
        event: AUDIT_EVENT_NAMES.tenantAdminInvitationIssued,
        metadata: {
            normalizedEmail: normalizeAuthEmail(args.email),
            resentCount: result.resentCount,
        },
        outcome: "allowed",
        recordId: result.invitationId,
        targetTenantId: args.tenantId,
        timestamp: args.now,
    });
    return result;
}

export async function resendInvitationForBackendTests(args: {
    ctx: BackendMutationCtxLike;
    email: string;
    now: number;
    platformUserId: string;
    tenantId: string;
}) {
    const result = await createInvitation(args);
    await appendAuditLog(args.ctx, {
        action: "resend",
        actorRole: "platform_admin",
        actorState: "authenticated",
        actorUserId: args.platformUserId,
        entityType: "tenant_admin_invitation",
        event: AUDIT_EVENT_NAMES.tenantAdminInvitationResent,
        metadata: {
            normalizedEmail: normalizeAuthEmail(args.email),
            resentCount: result.resentCount,
        },
        outcome: "allowed",
        recordId: result.invitationId,
        targetTenantId: args.tenantId,
        timestamp: args.now,
    });
    return result;
}

export async function startVerificationWindowForBackendTests(args: {
    ctx: BackendMutationCtxLike;
    email: string;
    inviteToken?: string;
    mode: OnboardingMode;
    now: number;
}) {
    const emailResult = validateEmailInput(args.email);
    if (!emailResult.ok) {
        backendError(
            "VALIDATION_FAILED",
            emailResult.issue.message,
            emailResult.issue.field,
        );
    }

    let invitationId: string | undefined;
    let tenantId: string | undefined;

    if (args.mode === "invite") {
        const invitation = await findInvitationByToken(
            args.ctx,
            args.inviteToken?.trim() ?? "",
        );
        if (!invitation) {
            backendError(
                "INVITATION_INVALID",
                "This invitation is invalid. Request a new link.",
            );
        }

        const tenant = await args.ctx.db.get(requiredString(invitation.tenantId));
        const message = resolveInvitationAccessMessage({
            invitation,
            now: args.now,
            tenant,
        });
        if (message) {
            backendError("INVITATION_INVALID", message);
        }

        if (requiredString(invitation.normalizedEmail) !== emailResult.value) {
            backendError(
                "INVITATION_INVALID",
                "Email already in use. Sign in with that account or use the invited email.",
            );
        }

        invitationId = requiredString(invitation._id);
        tenantId = requiredString(invitation.tenantId);
    }

    const existingState = await getLatestOnboardingState(args.ctx, emailResult.value);
    const verificationWindowExpiresAt =
        args.now + TENANT_ADMIN_VERIFICATION_WINDOW_MS;

    if (
        existingState &&
        existingState.completedAt === undefined &&
        requiredString(existingState.mode) === args.mode
    ) {
        await args.ctx.db.patch(requiredString(existingState._id), {
            invitationId: invitationId ?? existingState.invitationId,
            lastVerificationSentAt: args.now,
            tenantId: tenantId ?? existingState.tenantId,
            updatedAt: args.now,
            verificationWindowExpiresAt,
        });
        return { verificationWindowExpiresAt };
    }

    await args.ctx.db.insert("tenantAdminOnboardingStates", {
        autoResendCount: 0,
        createdAt: args.now,
        invitationId,
        lastVerificationSentAt: args.now,
        manualResendCount: 0,
        mode: args.mode,
        normalizedEmail: emailResult.value,
        tenantId,
        updatedAt: args.now,
        verificationWindowExpiresAt,
    });

    return { verificationWindowExpiresAt };
}

export async function registerVerificationResendForBackendTests(args: {
    ctx: BackendMutationCtxLike;
    email: string;
    inviteToken?: string;
    mode: OnboardingMode;
    now: number;
    resendMode: "auto" | "manual";
}) {
    const emailResult = validateEmailInput(args.email);
    if (!emailResult.ok) {
        backendError(
            "VALIDATION_FAILED",
            emailResult.issue.message,
            emailResult.issue.field,
        );
    }

    const state = await getLatestOnboardingState(args.ctx, emailResult.value);
    if (!state || (asNumber(state.verificationWindowExpiresAt) ?? 0) <= args.now) {
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

        const tenant = await args.ctx.db.get(requiredString(invitation.tenantId));
        const message = resolveInvitationAccessMessage({
            invitation,
            now: args.now,
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
                  autoResendCount: asNumber(state.autoResendCount) ?? 0,
                  lastSentAt: asNumber(state.lastVerificationSentAt) ?? 0,
                  now: args.now,
                  verificationWindowExpiresAt:
                      asNumber(state.verificationWindowExpiresAt) ?? 0,
              });

    if (!allowed) {
        return {
            allowed: false,
            verificationWindowExpiresAt: asNumber(
                state.verificationWindowExpiresAt,
            ),
        };
    }

    await args.ctx.db.patch(requiredString(state._id), {
        autoResendCount:
            args.resendMode === "auto"
                ? (asNumber(state.autoResendCount) ?? 0) + 1
                : state.autoResendCount,
        lastVerificationSentAt: args.now,
        manualResendCount:
            args.resendMode === "manual"
                ? (asNumber(state.manualResendCount) ?? 0) + 1
                : state.manualResendCount,
        updatedAt: args.now,
    });

    return {
        allowed: true,
        verificationWindowExpiresAt: asNumber(state.verificationWindowExpiresAt),
    };
}

export async function completeInstitutionProfileForBackendTests(args: {
    authTenantId: string;
    authUserId: string;
    ctx: BackendMutationCtxLike;
    fiscalYearStartMonth: number;
    institutionName: string;
    logoUrl?: string;
    now: number;
    primaryContactEmail: string;
    primaryContactName: string;
    primaryContactPhone: string;
}) {
    const tenant = await args.ctx.db.get(args.authTenantId);
    if (!tenant || requiredString(tenant.status) !== "active") {
        await appendAuditLog(args.ctx, {
            action: "complete",
            actorRole: "tenant_admin",
            actorState: "authenticated",
            actorUserId: args.authUserId,
            entityType: "tenant",
            event: AUDIT_EVENT_NAMES.tenantAdminOnboardingBlocked,
            metadata: {
                reason: "tenant_inactive",
            },
            outcome: "blocked_subscription_inactive",
            recordId: tenant ? tenant._id : undefined,
            targetTenantId: tenant ? tenant._id : undefined,
            timestamp: args.now,
        });
        backendError("TENANT_INACTIVE", "Tenant deactivated. Contact Support.");
    }

    const institutionNameResult = validateOrganizationNameInput(args.institutionName);
    if (!institutionNameResult.ok) {
        backendError(
            "VALIDATION_FAILED",
            institutionNameResult.issue.message,
            institutionNameResult.issue.field,
        );
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
        backendError(
            "VALIDATION_FAILED",
            primaryContactNameResult.issue.message,
            primaryContactNameResult.issue.field,
        );
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
        backendError(
            "VALIDATION_FAILED",
            primaryContactPhoneResult.issue.message,
            primaryContactPhoneResult.issue.field,
        );
    }

    const primaryContactEmailResult = validateEmailInput(
        args.primaryContactEmail,
        "primaryContactEmail",
    );
    if (!primaryContactEmailResult.ok) {
        backendError(
            "VALIDATION_FAILED",
            primaryContactEmailResult.issue.message,
            primaryContactEmailResult.issue.field,
        );
    }

    if (
        !Number.isInteger(args.fiscalYearStartMonth) ||
        args.fiscalYearStartMonth < 1 ||
        args.fiscalYearStartMonth > 12
    ) {
        backendError(
            "VALIDATION_FAILED",
            "Fiscal year start month must be between 1 and 12.",
            "fiscalYearStartMonth",
        );
    }

    await args.ctx.db.patch(args.authTenantId, {
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        logoUrl:
            typeof args.logoUrl === "string" && args.logoUrl.trim().length > 0
                ? args.logoUrl.trim()
                : undefined,
        name: institutionNameResult.value.normalized,
        onboardingCompletedAt: args.now,
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
        await args.ctx.db.patch(requiredString(onboardingState._id), {
            completedAt: args.now,
            tenantId: args.authTenantId,
            updatedAt: args.now,
        });
    }

    await appendAuditLog(args.ctx, {
        action: "complete",
        actorRole: "tenant_admin",
        actorState: "authenticated",
        actorUserId: args.authUserId,
        entityType: "tenant",
        event: AUDIT_EVENT_NAMES.tenantAdminOnboardingCompleted,
        metadata: {
            fiscalYearStartMonth: args.fiscalYearStartMonth,
        },
        outcome: "allowed",
        recordId: args.authTenantId,
        targetTenantId: args.authTenantId,
        timestamp: args.now,
    });

    return {
        profileComplete: true,
        tenantId: args.authTenantId,
    };
}

export async function redeemInvitationForBackendTests(args: {
    ctx: BackendMutationCtxLike;
    inviteToken: string;
    now: number;
    userId: string;
}) {
    const user = await args.ctx.db.get(args.userId);
    if (!user || typeof user.email !== "string") {
        backendError(
            "UNAUTHORIZED",
            "You must be signed in to accept this invitation.",
        );
    }

    const invitation = await findInvitationByToken(args.ctx, args.inviteToken.trim());
    if (!invitation) {
        backendError(
            "INVITATION_INVALID",
            "This invitation is invalid. Request a new link.",
        );
    }

    const expiresAt = asNumber(invitation.expiresAt) ?? 0;
    if (requiredString(invitation.status) === "pending" && expiresAt <= args.now) {
        await args.ctx.db.patch(requiredString(invitation._id), {
            status: "expired",
            updatedAt: args.now,
        });
    }

    const tenant = await args.ctx.db.get(requiredString(invitation.tenantId));
    const message = resolveInvitationAccessMessage({
        invitation,
        now: args.now,
        tenant,
    });
    if (message) {
        await appendAuditLog(args.ctx, {
            action: "redeem",
            actorRole: "unassigned",
            actorState: "authenticated",
            actorUserId: args.userId,
            entityType: "tenant_admin_invitation",
            event: AUDIT_EVENT_NAMES.tenantAdminOnboardingBlocked,
            metadata: {
                reason: message,
            },
            outcome: "blocked_subscription_inactive",
            recordId: invitation._id,
            targetTenantId: tenant ? tenant._id : undefined,
            timestamp: args.now,
        });
        backendError("INVITATION_INVALID", message);
    }

    if (normalizeAuthEmail(requiredString(user.email)) !== requiredString(invitation.normalizedEmail)) {
        backendError(
            "INVITATION_INVALID",
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
        requiredString(existingMembership.role) === "tenant_admin" &&
        existingMembership.userId === args.userId &&
        invitation.acceptedByUserId === args.userId
    ) {
        return {
            tenantId: requiredString(invitation.tenantId),
            tenantUserId: requiredString(existingMembership._id),
        };
    }

    const [tenantUsers, platformUsers] = await Promise.all([
        args.ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect(),
        args.ctx.db
            .query("platformUsers")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect(),
    ]);

    if (tenantUsers.length > 0 || platformUsers.length > 0) {
        backendError(
            "ALREADY_EXISTS",
            "Email already in use. An application role assignment already exists for this user.",
        );
    }

    const tenantUserId = await args.ctx.db.insert("tenantUsers", {
        isActive: true,
        role: "tenant_admin",
        tenantId: invitation.tenantId,
        userId: args.userId,
    });

    await args.ctx.db.patch(requiredString(invitation._id), {
        acceptedAt: args.now,
        acceptedByUserId: args.userId,
        status: "accepted",
        updatedAt: args.now,
    });

    const onboardingState = await getLatestOnboardingState(
        args.ctx,
        requiredString(invitation.normalizedEmail),
    );
    if (onboardingState) {
        await args.ctx.db.patch(requiredString(onboardingState._id), {
            completedAt: args.now,
            invitationId: invitation._id,
            tenantId: invitation.tenantId,
            updatedAt: args.now,
        });
    }

    await appendAuditLog(args.ctx, {
        action: "redeem",
        actorRole: "tenant_admin",
        actorState: "authenticated",
        actorUserId: args.userId,
        entityType: "tenant_admin_invitation",
        event: AUDIT_EVENT_NAMES.tenantAdminInvitationAccepted,
        metadata: {
            normalizedEmail: invitation.normalizedEmail,
        },
        outcome: "allowed",
        recordId: invitation._id,
        targetTenantId: invitation.tenantId,
        timestamp: args.now,
    });

    return {
        tenantId: requiredString(invitation.tenantId),
        tenantUserId,
    };
}
