import { getEnterpriseInquiryCooldownMessage } from "../validators/sales";
import {
    DEACTIVATED_DEPARTMENT_USER_MESSAGE,
    DEPARTMENT_USER_INVALID_VERIFICATION_CODE_MESSAGE,
    DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE,
    EXPIRED_ACCESS_CODE_MESSAGE,
    INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
    INVALID_ACCESS_CODE_MESSAGE,
    SUBSCRIPTION_INACTIVE_MESSAGE,
    isDepartmentUserOtpProviderFailureMessage,
} from "../auth/department-user-access";

const GENERIC_PUBLIC_ERROR_MESSAGE =
    "We could not complete your request right now. Please try again.";
const GENERIC_PUBLIC_INQUIRY_ERROR_MESSAGE =
    "We could not submit your request right now. Please try again.";
const PUBLIC_INQUIRY_RATE_LIMIT_MESSAGE =
    getEnterpriseInquiryCooldownMessage();
const SAFE_PUBLIC_INQUIRY_VALIDATION_PATTERNS = [
    /^contact name must /i,
    /^organization name must /i,
    /^message must /i,
    /^email must /i,
    /^invalid email format$/i,
    /^please review your inquiry details and try again\.$/i,
] as const;
const SAFE_PUBLIC_VERIFICATION_CODE_PATTERNS = [
    /^invalid or expired verification code\.?$/i,
    /\bverification code\b.*\b(invalid|expired|incorrect)\b/i,
    /\b(invalid|expired|incorrect)\b.*\bverification code\b/i,
    /\b(one-time code|one-time passcode|otp)\b.*\b(invalid|expired|incorrect)\b/i,
    /\b(invalid|expired|incorrect)\b.*\b(one-time code|one-time passcode|otp)\b/i,
    /^code (is )?(invalid|expired|incorrect)\.?$/i,
    /^(invalid|expired|incorrect) code\.?$/i,
] as const;
const SAFE_DEPARTMENT_USER_ACCESS_MESSAGES = [
    INVALID_ACCESS_CODE_MESSAGE,
    EXPIRED_ACCESS_CODE_MESSAGE,
    DEACTIVATED_DEPARTMENT_USER_MESSAGE,
    INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE,
    SUBSCRIPTION_INACTIVE_MESSAGE,
    DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE,
] as const;

function getErrorMessage(error: unknown): string | null {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message.trim();
    }

    return null;
}

function includesNormalized(
    message: string | null,
    snippet: string,
): boolean {
    return message?.toLowerCase().includes(snippet.toLowerCase()) ?? false;
}

export function isExistingRoleAssignmentError(error: unknown): boolean {
    const message = getErrorMessage(error);
    return (
        includesNormalized(message, "application role assignment") ||
        includesNormalized(message, "email already in use")
    );
}

export function isOrganizationNameConflictError(error: unknown): boolean {
    return includesNormalized(
        getErrorMessage(error),
        "organization with this name already exists",
    );
}

export function getPublicInquirySubmissionErrorMessage(error: unknown): string {
    const message = getErrorMessage(error);

    if (!message) {
        return GENERIC_PUBLIC_INQUIRY_ERROR_MESSAGE;
    }

    if (
        includesNormalized(message, "[convex") ||
        includesNormalized(message, "request id:") ||
        includesNormalized(message, "server error") ||
        includesNormalized(message, "could not find public function")
    ) {
        return GENERIC_PUBLIC_INQUIRY_ERROR_MESSAGE;
    }

    if (
        includesNormalized(message, "before sending another") ||
        includesNormalized(message, "recently submitted an enterprise inquiry") ||
        includesNormalized(message, "rate limit")
    ) {
        return PUBLIC_INQUIRY_RATE_LIMIT_MESSAGE;
    }

    if (SAFE_PUBLIC_INQUIRY_VALIDATION_PATTERNS.some((pattern) => pattern.test(message))) {
        return message;
    }

    return GENERIC_PUBLIC_INQUIRY_ERROR_MESSAGE;
}

export function isVerificationCodeFailureMessage(
    message: string | null,
): boolean {
    if (!message) {
        return false;
    }

    return SAFE_PUBLIC_VERIFICATION_CODE_PATTERNS.some((pattern) =>
        pattern.test(message),
    );
}

export function getPublicVerificationErrorMessage(error: unknown): string {
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

export function getPublicDepartmentUserAccessErrorMessage(
    error: unknown,
): string {
    const message = getErrorMessage(error);

    if (!message) {
        return GENERIC_PUBLIC_ERROR_MESSAGE;
    }

    if (
        SAFE_DEPARTMENT_USER_ACCESS_MESSAGES.some(
            (safeMessage) => safeMessage === message,
        ) || message.startsWith("Submission period has not started yet.")
    ) {
        return message;
    }

    if (message.startsWith("Too many failed attempts. Try again in ")) {
        return message;
    }

    if (
        isVerificationCodeFailureMessage(message) ||
        isDepartmentUserOtpProviderFailureMessage(message)
    ) {
        return DEPARTMENT_USER_INVALID_VERIFICATION_CODE_MESSAGE;
    }

    return GENERIC_PUBLIC_ERROR_MESSAGE;
}
