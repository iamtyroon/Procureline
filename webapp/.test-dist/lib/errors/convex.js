"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicVerificationErrorMessage = exports.isVerificationCodeFailureMessage = exports.getPublicInquirySubmissionErrorMessage = exports.isOrganizationNameConflictError = exports.isExistingRoleAssignmentError = void 0;
const GENERIC_PUBLIC_ERROR_MESSAGE = "We could not complete your request right now. Please try again.";
const GENERIC_PUBLIC_INQUIRY_ERROR_MESSAGE = "We could not submit your request right now. Please try again.";
const PUBLIC_INQUIRY_RATE_LIMIT_MESSAGE = "You've recently submitted an enterprise inquiry. Please wait 10 minutes before sending another.";
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
    return includesNormalized(getErrorMessage(error), "application role assignment");
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
    if (includesNormalized(message, "wait 10 minutes before sending another") ||
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
    return GENERIC_PUBLIC_ERROR_MESSAGE;
}
exports.getPublicVerificationErrorMessage = getPublicVerificationErrorMessage;
