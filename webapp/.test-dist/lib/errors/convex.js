"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicProcurementOfficerAccessErrorMessage = exports.getPublicDepartmentUserAccessErrorMessage = exports.getPublicVerificationErrorMessage = exports.isVerificationCodeFailureMessage = exports.getPublicInquirySubmissionErrorMessage = exports.isOrganizationNameConflictError = exports.isExistingRoleAssignmentError = void 0;
const sales_1 = require("../validators/sales");
const department_user_access_1 = require("../auth/department-user-access");
const invitations_1 = require("../procurement-officer/invitations");
const GENERIC_PUBLIC_ERROR_MESSAGE = "We could not complete your request right now. Please try again.";
const GENERIC_PUBLIC_INQUIRY_ERROR_MESSAGE = "We could not submit your request right now. Please try again.";
const PUBLIC_INQUIRY_RATE_LIMIT_MESSAGE = (0, sales_1.getEnterpriseInquiryCooldownMessage)();
const SAFE_PUBLIC_INQUIRY_VALIDATION_PATTERNS = [
    /^contact name must /i,
    /^organization name must /i,
    /^message must /i,
    /^email must /i,
    /^invalid email format$/i,
    /^please review your inquiry details and try again\.$/i,
];
const SAFE_PUBLIC_VERIFICATION_CODE_PATTERNS = [
    /^invalid or expired verification code\.?$/i,
    /\bverification code\b.*\b(invalid|expired|incorrect)\b/i,
    /\b(invalid|expired|incorrect)\b.*\bverification code\b/i,
    /\b(one-time code|one-time passcode|otp)\b.*\b(invalid|expired|incorrect)\b/i,
    /\b(invalid|expired|incorrect)\b.*\b(one-time code|one-time passcode|otp)\b/i,
    /^code (is )?(invalid|expired|incorrect)\.?$/i,
    /^(invalid|expired|incorrect) code\.?$/i,
];
const SAFE_DEPARTMENT_USER_ACCESS_MESSAGES = [
    department_user_access_1.INVALID_ACCESS_CODE_MESSAGE,
    department_user_access_1.EXPIRED_ACCESS_CODE_MESSAGE,
    department_user_access_1.DEACTIVATED_DEPARTMENT_USER_MESSAGE,
    department_user_access_1.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
    department_user_access_1.SUBSCRIPTION_INACTIVE_MESSAGE,
    department_user_access_1.DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE,
];
const SAFE_PROCUREMENT_OFFICER_ACCESS_MESSAGES = [
    invitations_1.PROCUREMENT_OFFICER_BOUNCED_MESSAGE,
    invitations_1.PROCUREMENT_OFFICER_DUPLICATE_MEMBERSHIP_MESSAGE,
    invitations_1.PROCUREMENT_OFFICER_INVITATION_ACCEPTED_MESSAGE,
    invitations_1.PROCUREMENT_OFFICER_INVITATION_EXPIRED_MESSAGE,
    invitations_1.PROCUREMENT_OFFICER_INVITATION_INVALID_MESSAGE,
    invitations_1.PROCUREMENT_OFFICER_INVITATION_REVOKED_MESSAGE,
    invitations_1.PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE,
];
function getErrorMessage(error) {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message.trim();
    }
    return null;
}
function includesNormalized(message, snippet) {
    return message?.toLowerCase().includes(snippet.toLowerCase()) ?? false;
}
function isExistingRoleAssignmentError(error) {
    const message = getErrorMessage(error);
    return (includesNormalized(message, "application role assignment") ||
        includesNormalized(message, "email already in use"));
}
exports.isExistingRoleAssignmentError = isExistingRoleAssignmentError;
function isOrganizationNameConflictError(error) {
    return includesNormalized(getErrorMessage(error), "organization with this name already exists");
}
exports.isOrganizationNameConflictError = isOrganizationNameConflictError;
function getPublicInquirySubmissionErrorMessage(error) {
    const message = getErrorMessage(error);
    if (!message) {
        return GENERIC_PUBLIC_INQUIRY_ERROR_MESSAGE;
    }
    if (includesNormalized(message, "[convex") ||
        includesNormalized(message, "request id:") ||
        includesNormalized(message, "server error") ||
        includesNormalized(message, "could not find public function")) {
        return GENERIC_PUBLIC_INQUIRY_ERROR_MESSAGE;
    }
    if (includesNormalized(message, "before sending another") ||
        includesNormalized(message, "recently submitted an enterprise inquiry") ||
        includesNormalized(message, "rate limit")) {
        return PUBLIC_INQUIRY_RATE_LIMIT_MESSAGE;
    }
    if (SAFE_PUBLIC_INQUIRY_VALIDATION_PATTERNS.some((pattern) => pattern.test(message))) {
        return message;
    }
    return GENERIC_PUBLIC_INQUIRY_ERROR_MESSAGE;
}
exports.getPublicInquirySubmissionErrorMessage = getPublicInquirySubmissionErrorMessage;
function isVerificationCodeFailureMessage(message) {
    if (!message) {
        return false;
    }
    return SAFE_PUBLIC_VERIFICATION_CODE_PATTERNS.some((pattern) => pattern.test(message));
}
exports.isVerificationCodeFailureMessage = isVerificationCodeFailureMessage;
function getPublicVerificationErrorMessage(error) {
    const message = getErrorMessage(error);
    if (!message) {
        return GENERIC_PUBLIC_ERROR_MESSAGE;
    }
    if (isVerificationCodeFailureMessage(message)) {
        return "Invalid or expired verification code. Please try again.";
    }
    if (includesNormalized(message, "organization with this name already exists")) {
        return "That organization name is already taken. Choose a different name to finish setup.";
    }
    if (includesNormalized(message, "email already in use")) {
        return "Email already in use. Sign in with that account or use a different email.";
    }
    if (includesNormalized(message, "tenant deactivated. contact support.")) {
        return "Tenant deactivated. Contact Support.";
    }
    return GENERIC_PUBLIC_ERROR_MESSAGE;
}
exports.getPublicVerificationErrorMessage = getPublicVerificationErrorMessage;
function getPublicDepartmentUserAccessErrorMessage(error) {
    const message = getErrorMessage(error);
    if (!message) {
        return GENERIC_PUBLIC_ERROR_MESSAGE;
    }
    if (SAFE_DEPARTMENT_USER_ACCESS_MESSAGES.some((safeMessage) => safeMessage === message) || message.startsWith("Submission period has not started yet.")) {
        return message;
    }
    if (message.startsWith("Too many failed attempts. Try again in ")) {
        return message;
    }
    if (isVerificationCodeFailureMessage(message) ||
        (0, department_user_access_1.isDepartmentUserOtpProviderFailureMessage)(message)) {
        return department_user_access_1.DEPARTMENT_USER_INVALID_VERIFICATION_CODE_MESSAGE;
    }
    return GENERIC_PUBLIC_ERROR_MESSAGE;
}
exports.getPublicDepartmentUserAccessErrorMessage = getPublicDepartmentUserAccessErrorMessage;
function getPublicProcurementOfficerAccessErrorMessage(error) {
    const message = getErrorMessage(error);
    if (!message) {
        return GENERIC_PUBLIC_ERROR_MESSAGE;
    }
    if (SAFE_PROCUREMENT_OFFICER_ACCESS_MESSAGES.some((safeMessage) => safeMessage === message)) {
        return message;
    }
    if (isVerificationCodeFailureMessage(message) ||
        (0, department_user_access_1.isDepartmentUserOtpProviderFailureMessage)(message)) {
        return invitations_1.PROCUREMENT_OFFICER_INVALID_VERIFICATION_CODE_MESSAGE;
    }
    return GENERIC_PUBLIC_ERROR_MESSAGE;
}
exports.getPublicProcurementOfficerAccessErrorMessage = getPublicProcurementOfficerAccessErrorMessage;
