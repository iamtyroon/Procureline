"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatProcurementOfficerInvitationStatusLabel = exports.resolveProcurementOfficerHandoff = exports.invalidateSupersededProcurementOfficerInvitations = exports.getProcurementOfficerInvitationAccessMessage = exports.canReuseAcceptedProcurementOfficerInvitation = exports.resolveProcurementOfficerBounceStatus = exports.evaluateProcurementOfficerInvitationStatus = exports.scrubProcurementOfficerHandoffFromUrl = exports.formatProcurementOfficerActivationCode = exports.getProcurementOfficerActivationCodeSuffix = exports.hashProcurementOfficerSecret = exports.normalizeProcurementOfficerActivationCode = exports.PROCUREMENT_OFFICER_BOUNCED_MESSAGE = exports.PROCUREMENT_OFFICER_INVALID_VERIFICATION_CODE_MESSAGE = exports.PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE = exports.PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE = exports.PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE = exports.PROCUREMENT_OFFICER_INVITATION_ACCEPTED_MESSAGE = exports.PROCUREMENT_OFFICER_INVITATION_REVOKED_MESSAGE = exports.PROCUREMENT_OFFICER_INVITATION_EXPIRED_MESSAGE = exports.PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE = exports.PROCUREMENT_OFFICER_ACTIVATION_CODE_MAX_LENGTH = exports.PROCUREMENT_OFFICER_AUTH_CHALLENGE_WINDOW_MS = exports.PROCUREMENT_OFFICER_INVITATION_TTL_MS = exports.PROCUREMENT_OFFICER_AUTH_VERIFY_FLOW = exports.PROCUREMENT_OFFICER_AUTH_START_FLOW = exports.PROCUREMENT_OFFICER_AUTH_PROVIDER = void 0;
const public_entry_1 = require("../auth/public-entry");
exports.PROCUREMENT_OFFICER_AUTH_PROVIDER = "procurement-officer-access";
exports.PROCUREMENT_OFFICER_AUTH_START_FLOW = "otp-start";
exports.PROCUREMENT_OFFICER_AUTH_VERIFY_FLOW = "otp-verify";
exports.PROCUREMENT_OFFICER_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
exports.PROCUREMENT_OFFICER_AUTH_CHALLENGE_WINDOW_MS = 15 * 60 * 1000;
exports.PROCUREMENT_OFFICER_ACTIVATION_CODE_MAX_LENGTH = 64;
exports.PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE = "This invitation is invalid. Request the latest invitation from your Tenant Admin.";
exports.PROCUREMENT_OFFICER_INVITATION_EXPIRED_MESSAGE = "This invitation has expired. Request a new invitation from your Tenant Admin.";
exports.PROCUREMENT_OFFICER_INVITATION_REVOKED_MESSAGE = "This invitation has been replaced. Use the latest invitation details from your Tenant Admin.";
exports.PROCUREMENT_OFFICER_INVITATION_ACCEPTED_MESSAGE = "This invitation has already been accepted.";
exports.PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE = "Tenant deactivated. Contact Support.";
exports.PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE = "A tenant-scoped membership already exists for this email in this organization.";
exports.PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE = "Use either an invite link or an activation code, not both at the same time.";
exports.PROCUREMENT_OFFICER_INVALID_VERIFICATION_CODE_MESSAGE = "Invalid verification code. Please try again.";
exports.PROCUREMENT_OFFICER_BOUNCED_MESSAGE = "Invitation delivery failed. Ask your Tenant Admin to resend the invitation.";
function normalizeProcurementOfficerActivationCode(input) {
    return input
        .trim()
        .toUpperCase()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-");
}
exports.normalizeProcurementOfficerActivationCode = normalizeProcurementOfficerActivationCode;
async function hashProcurementOfficerSecret(secret) {
    const encoded = new TextEncoder().encode(secret);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
exports.hashProcurementOfficerSecret = hashProcurementOfficerSecret;
function getProcurementOfficerActivationCodeSuffix(normalizedActivationCode) {
    return normalizedActivationCode.slice(-4);
}
exports.getProcurementOfficerActivationCodeSuffix = getProcurementOfficerActivationCodeSuffix;
function formatProcurementOfficerActivationCode(rawCode) {
    const normalized = normalizeProcurementOfficerActivationCode(rawCode).replace(/-/g, "");
    const groups = normalized.match(/.{1,4}/g) ?? [normalized];
    return groups.join("-");
}
exports.formatProcurementOfficerActivationCode = formatProcurementOfficerActivationCode;
function scrubProcurementOfficerHandoffFromUrl(pathname, search) {
    const params = new URLSearchParams(search);
    params.delete("activationCode");
    params.delete("activationToken");
    params.delete("invite");
    const nextSearch = params.toString();
    return nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname;
}
exports.scrubProcurementOfficerHandoffFromUrl = scrubProcurementOfficerHandoffFromUrl;
function evaluateProcurementOfficerInvitationStatus(args) {
    if (args.status === "pending" && args.expiresAt <= args.now) {
        return "expired";
    }
    return args.status;
}
exports.evaluateProcurementOfficerInvitationStatus = evaluateProcurementOfficerInvitationStatus;
function resolveProcurementOfficerBounceStatus(status) {
    return status === "pending" ? "bounced" : status;
}
exports.resolveProcurementOfficerBounceStatus = resolveProcurementOfficerBounceStatus;
function canReuseAcceptedProcurementOfficerInvitation(args) {
    return (args.status === "accepted" &&
        args.acceptedByUserId === args.existingUserId &&
        args.acceptedTenantUserId === args.tenantMembershipId &&
        args.tenantMembershipRole === "procurement_officer");
}
exports.canReuseAcceptedProcurementOfficerInvitation = canReuseAcceptedProcurementOfficerInvitation;
function getProcurementOfficerInvitationAccessMessage(args) {
    if (!args.tenantIsActive) {
        return exports.PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE;
    }
    const effectiveStatus = evaluateProcurementOfficerInvitationStatus({
        expiresAt: args.expiresAt,
        now: args.now,
        status: args.status,
    });
    if (effectiveStatus === "revoked") {
        return exports.PROCUREMENT_OFFICER_INVITATION_REVOKED_MESSAGE;
    }
    if (effectiveStatus === "expired") {
        return exports.PROCUREMENT_OFFICER_INVITATION_EXPIRED_MESSAGE;
    }
    if (effectiveStatus === "bounced") {
        return exports.PROCUREMENT_OFFICER_BOUNCED_MESSAGE;
    }
    return null;
}
exports.getProcurementOfficerInvitationAccessMessage = getProcurementOfficerInvitationAccessMessage;
function invalidateSupersededProcurementOfficerInvitations(invitations) {
    return invitations.map((invitation) => ({
        id: invitation.id,
        nextStatus: invitation.status === "pending" ? "revoked" : invitation.status,
    }));
}
exports.invalidateSupersededProcurementOfficerInvitations = invalidateSupersededProcurementOfficerInvitations;
function resolveProcurementOfficerHandoff(searchParams) {
    const invite = (0, public_entry_1.getTrimmedSearchParam)(searchParams.invite);
    const activationToken = (0, public_entry_1.getTrimmedSearchParam)(searchParams.activationToken);
    const activationCode = (0, public_entry_1.getTrimmedSearchParam)(searchParams.activationCode);
    const inviteToken = invite ?? activationToken;
    if (invite &&
        activationToken &&
        invite !== activationToken) {
        return {
            error: exports.PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE,
            mode: null,
        };
    }
    if (inviteToken && activationCode) {
        return {
            error: exports.PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE,
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
exports.resolveProcurementOfficerHandoff = resolveProcurementOfficerHandoff;
function formatProcurementOfficerInvitationStatusLabel(status) {
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
exports.formatProcurementOfficerInvitationStatusLabel = formatProcurementOfficerInvitationStatusLabel;
