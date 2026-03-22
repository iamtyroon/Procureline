"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canAutoResendTenantAdminVerification = exports.invalidateSupersededInvitationStatuses = exports.getTenantAdminInvitationAccessMessage = exports.TENANT_ADMIN_MAX_AUTO_RESENDS = exports.TENANT_ADMIN_OTP_MAX_AGE_MS = exports.TENANT_ADMIN_VERIFICATION_WINDOW_MS = exports.TENANT_ADMIN_INVITATION_TTL_MS = void 0;
exports.TENANT_ADMIN_INVITATION_TTL_MS = 72 * 60 * 60 * 1000;
exports.TENANT_ADMIN_VERIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;
exports.TENANT_ADMIN_OTP_MAX_AGE_MS = 15 * 60 * 1000;
exports.TENANT_ADMIN_MAX_AUTO_RESENDS = 3;
function getTenantAdminInvitationAccessMessage(args) {
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
exports.getTenantAdminInvitationAccessMessage = getTenantAdminInvitationAccessMessage;
function invalidateSupersededInvitationStatuses(invitations) {
    return invitations.map((invitation) => ({
        id: invitation.id,
        nextStatus: invitation.status === "pending" ? "revoked" : invitation.status,
    }));
}
exports.invalidateSupersededInvitationStatuses = invalidateSupersededInvitationStatuses;
function canAutoResendTenantAdminVerification(args) {
    return (args.autoResendCount < exports.TENANT_ADMIN_MAX_AUTO_RESENDS &&
        args.now <= args.verificationWindowExpiresAt &&
        args.now - args.lastSentAt >= exports.TENANT_ADMIN_OTP_MAX_AGE_MS);
}
exports.canAutoResendTenantAdminVerification = canAutoResendTenantAdminVerification;
