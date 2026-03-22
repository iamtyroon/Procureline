export const TENANT_ADMIN_INVITATION_TTL_MS = 72 * 60 * 60 * 1000;
export const TENANT_ADMIN_VERIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const TENANT_ADMIN_OTP_MAX_AGE_MS = 15 * 60 * 1000;
export const TENANT_ADMIN_MAX_AUTO_RESENDS = 3;

export type TenantAdminInvitationStatus =
    | "pending"
    | "accepted"
    | "expired"
    | "revoked";

export function getTenantAdminInvitationAccessMessage(args: {
    expiresAt: number;
    now: number;
    status: TenantAdminInvitationStatus;
    tenantIsActive: boolean;
}): string | null {
    if (!args.tenantIsActive) {
        return "Tenant deactivated. Contact Support.";
    }

    if (args.status === "accepted") {
        return "This invitation has already been used.";
    }

    if (args.status === "revoked") {
        return "This invitation has been replaced. Request the latest link.";
    }

    if (args.status === "expired" || args.expiresAt <= args.now) {
        return "This invitation has expired. Request a new link.";
    }

    return null;
}

export function invalidateSupersededInvitationStatuses(
    invitations: ReadonlyArray<{
        id: string;
        status: TenantAdminInvitationStatus;
    }>,
): Array<{
    id: string;
    nextStatus: TenantAdminInvitationStatus;
}> {
    return invitations.map((invitation) => ({
        id: invitation.id,
        nextStatus:
            invitation.status === "pending" ? "revoked" : invitation.status,
    }));
}

export function canAutoResendTenantAdminVerification(args: {
    autoResendCount: number;
    lastSentAt: number;
    now: number;
    verificationWindowExpiresAt: number;
}): boolean {
    return (
        args.autoResendCount < TENANT_ADMIN_MAX_AUTO_RESENDS &&
        args.now <= args.verificationWindowExpiresAt &&
        args.now - args.lastSentAt >= TENANT_ADMIN_OTP_MAX_AGE_MS
    );
}
