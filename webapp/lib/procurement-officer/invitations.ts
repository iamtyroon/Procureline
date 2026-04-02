import { getTrimmedSearchParam, type PublicEntrySearchParams } from "../auth/public-entry";

export const PROCUREMENT_OFFICER_AUTH_PROVIDER =
    "procurement-officer-access" as const;
export const PROCUREMENT_OFFICER_AUTH_START_FLOW = "otp-start" as const;
export const PROCUREMENT_OFFICER_AUTH_VERIFY_FLOW = "otp-verify" as const;

export const PROCUREMENT_OFFICER_INVITATION_TTL_MS =
    7 * 24 * 60 * 60 * 1000;
export const PROCUREMENT_OFFICER_AUTH_CHALLENGE_WINDOW_MS =
    15 * 60 * 1000;
export const PROCUREMENT_OFFICER_ACTIVATION_CODE_MAX_LENGTH = 64;

export const PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE =
    "This invitation is invalid. Request the latest invitation from your Tenant Admin.";
export const PROCUREMENT_OFFICER_INVITATION_EXPIRED_MESSAGE =
    "This invitation has expired. Request a new invitation from your Tenant Admin.";
export const PROCUREMENT_OFFICER_INVITATION_REVOKED_MESSAGE =
    "This invitation has been replaced. Use the latest invitation details from your Tenant Admin.";
export const PROCUREMENT_OFFICER_INVITATION_ACCEPTED_MESSAGE =
    "This invitation has already been accepted.";
export const PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE =
    "Tenant deactivated. Contact Support.";
export const PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE =
    "A tenant-scoped membership already exists for this email in this organization.";
export const PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE =
    "Use either an invite link or an activation code, not both at the same time.";
export const PROCUREMENT_OFFICER_INVALID_VERIFICATION_CODE_MESSAGE =
    "Invalid verification code. Please try again.";
export const PROCUREMENT_OFFICER_BOUNCED_MESSAGE =
    "Invitation delivery failed. Ask your Tenant Admin to resend the invitation.";

export type ProcurementOfficerInvitationStatus =
    | "accepted"
    | "bounced"
    | "expired"
    | "pending"
    | "revoked";

export type ProcurementOfficerAccessMode = "activation_code" | "invite";

export interface ResolvedProcurementOfficerHandoff {
    activationCode?: string;
    error?: string;
    inviteToken?: string;
    mode: ProcurementOfficerAccessMode | null;
}

export function normalizeProcurementOfficerActivationCode(input: string): string {
    return input
        .trim()
        .toUpperCase()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-");
}

export async function hashProcurementOfficerSecret(
    secret: string,
): Promise<string> {
    const encoded = new TextEncoder().encode(secret);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest), (value) =>
        value.toString(16).padStart(2, "0"),
    ).join("");
}

export function getProcurementOfficerActivationCodeSuffix(
    normalizedActivationCode: string,
): string {
    return normalizedActivationCode.slice(-4);
}

export function formatProcurementOfficerActivationCode(
    rawCode: string,
): string {
    const normalized = normalizeProcurementOfficerActivationCode(rawCode).replace(
        /-/g,
        "",
    );
    const groups = normalized.match(/.{1,4}/g) ?? [normalized];
    return groups.join("-");
}

export function scrubProcurementOfficerHandoffFromUrl(
    pathname: string,
    search: string,
): string {
    const params = new URLSearchParams(search);
    params.delete("activationCode");
    params.delete("activationToken");
    params.delete("invite");

    const nextSearch = params.toString();
    return nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname;
}

export function evaluateProcurementOfficerInvitationStatus(args: {
    expiresAt: number;
    now: number;
    status: ProcurementOfficerInvitationStatus;
}): ProcurementOfficerInvitationStatus {
    if (args.status === "pending" && args.expiresAt <= args.now) {
        return "expired";
    }

    return args.status;
}

export function resolveProcurementOfficerBounceStatus(
    status: ProcurementOfficerInvitationStatus,
): ProcurementOfficerInvitationStatus {
    return status === "pending" ? "bounced" : status;
}

export function canReuseAcceptedProcurementOfficerInvitation(args: {
    acceptedByUserId?: string;
    acceptedTenantUserId?: string;
    existingUserId?: string;
    status: ProcurementOfficerInvitationStatus;
    tenantMembershipId?: string;
    tenantMembershipRole?: string;
}): boolean {
    return (
        args.status === "accepted" &&
        args.acceptedByUserId === args.existingUserId &&
        args.acceptedTenantUserId === args.tenantMembershipId &&
        args.tenantMembershipRole === "procurement_officer"
    );
}

export function getProcurementOfficerInvitationAccessMessage(args: {
    expiresAt: number;
    now: number;
    status: ProcurementOfficerInvitationStatus;
    tenantIsActive: boolean;
}): string | null {
    if (!args.tenantIsActive) {
        return PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE;
    }

    const effectiveStatus = evaluateProcurementOfficerInvitationStatus({
        expiresAt: args.expiresAt,
        now: args.now,
        status: args.status,
    });

    if (effectiveStatus === "revoked") {
        return PROCUREMENT_OFFICER_INVITATION_REVOKED_MESSAGE;
    }

    if (effectiveStatus === "expired") {
        return PROCUREMENT_OFFICER_INVITATION_EXPIRED_MESSAGE;
    }

    if (effectiveStatus === "bounced") {
        return PROCUREMENT_OFFICER_BOUNCED_MESSAGE;
    }

    return null;
}

export function invalidateSupersededProcurementOfficerInvitations(
    invitations: ReadonlyArray<{
        id: string;
        status: ProcurementOfficerInvitationStatus;
    }>,
): Array<{
    id: string;
    nextStatus: ProcurementOfficerInvitationStatus;
}> {
    return invitations.map((invitation) => ({
        id: invitation.id,
        nextStatus:
            invitation.status === "pending" ? "revoked" : invitation.status,
    }));
}

export function resolveProcurementOfficerHandoff(
    searchParams: PublicEntrySearchParams,
): ResolvedProcurementOfficerHandoff {
    const invite = getTrimmedSearchParam(searchParams.invite);
    const activationToken = getTrimmedSearchParam(searchParams.activationToken);
    const activationCode = getTrimmedSearchParam(searchParams.activationCode);
    const inviteToken = invite ?? activationToken;

    if (
        invite &&
        activationToken &&
        invite !== activationToken
    ) {
        return {
            error: PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE,
            mode: null,
        };
    }

    if (inviteToken && activationCode) {
        return {
            error: PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE,
            mode: null,
        };
    }

    if (inviteToken) {
        return {
            inviteToken,
            mode: "invite",
        };
    }

    if (activationCode) {
        return {
            activationCode,
            mode: "activation_code",
        };
    }

    return {
        mode: null,
    };
}

export function formatProcurementOfficerInvitationStatusLabel(
    status: ProcurementOfficerInvitationStatus,
): string {
    switch (status) {
        case "accepted":
            return "Accepted";
        case "bounced":
            return "Delivery failed";
        case "expired":
            return "Expired";
        case "revoked":
            return "Superseded";
        default:
            return "Pending";
    }
}
