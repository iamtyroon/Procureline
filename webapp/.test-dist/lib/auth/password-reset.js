"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMaskedPasswordResetRequestError = exports.matchesInitialPasswordResetAttempt = exports.isPasswordResetLinkExpired = exports.parsePasswordResetExpiresAt = exports.buildPasswordResetLink = exports.getSingleSearchParam = exports.buildPasswordResetRedirectTo = exports.normalizeAuthEmail = exports.PASSWORD_RESET_EXPIRES_AT_PARAM = exports.PASSWORD_RESET_TOO_MANY_ATTEMPTS_MESSAGE = exports.PASSWORD_RESET_INVALID_MESSAGE = exports.PASSWORD_RESET_EXPIRED_MESSAGE = exports.PASSWORD_RESET_SUCCESS_MESSAGE = exports.PASSWORD_RESET_REQUEST_ERROR_MESSAGE = exports.PASSWORD_RESET_REQUEST_MESSAGE = exports.PASSWORD_RESET_CONTINUE_TO_PARAM = exports.PASSWORD_RESET_SUCCESS_REASON = void 0;
const input_1 = require("../security/input");
exports.PASSWORD_RESET_SUCCESS_REASON = "password_reset_success";
exports.PASSWORD_RESET_CONTINUE_TO_PARAM = "continueTo";
exports.PASSWORD_RESET_REQUEST_MESSAGE = "If an account exists for that email, a password reset link has been sent.";
exports.PASSWORD_RESET_REQUEST_ERROR_MESSAGE = "We couldn't send a password reset email right now. Please try again.";
exports.PASSWORD_RESET_SUCCESS_MESSAGE = "Your password was updated. Sign in with your new password.";
exports.PASSWORD_RESET_EXPIRED_MESSAGE = "Reset link expired. Please request a new one.";
exports.PASSWORD_RESET_INVALID_MESSAGE = "Invalid reset link or code. Please request a new one.";
exports.PASSWORD_RESET_TOO_MANY_ATTEMPTS_MESSAGE = "Too many attempts. Please request a new reset email and try again.";
exports.PASSWORD_RESET_EXPIRES_AT_PARAM = "expiresAt";
function normalizeAuthEmail(email) {
    return (0, input_1.normalizeAuthEmail)(email);
}
exports.normalizeAuthEmail = normalizeAuthEmail;
function buildPasswordResetRedirectTo(email, args) {
    const params = new URLSearchParams({
        email: normalizeAuthEmail(email),
    });
    if (typeof args?.platformResetToken === "string" &&
        args.platformResetToken.trim().length > 0) {
        params.set("platformResetToken", args.platformResetToken.trim());
    }
    if (typeof args?.continueTo === "string" &&
        args.continueTo.startsWith("/")) {
        params.set(exports.PASSWORD_RESET_CONTINUE_TO_PARAM, args.continueTo);
    }
    return `/reset-password?${params.toString()}`;
}
exports.buildPasswordResetRedirectTo = buildPasswordResetRedirectTo;
function getSingleSearchParam(value) {
    return Array.isArray(value) ? value[0] : value;
}
exports.getSingleSearchParam = getSingleSearchParam;
function buildPasswordResetLink(url, email, expiresAt) {
    const resetUrl = new URL(url);
    resetUrl.searchParams.set("email", normalizeAuthEmail(email));
    resetUrl.searchParams.set(exports.PASSWORD_RESET_EXPIRES_AT_PARAM, expiresAt.getTime().toString());
    return resetUrl.toString();
}
exports.buildPasswordResetLink = buildPasswordResetLink;
function parsePasswordResetExpiresAt(value) {
    const expiresAt = getSingleSearchParam(value);
    if (!expiresAt) {
        return undefined;
    }
    const timestamp = Number(expiresAt);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return undefined;
    }
    return timestamp;
}
exports.parsePasswordResetExpiresAt = parsePasswordResetExpiresAt;
function isPasswordResetLinkExpired(expiresAt, now = Date.now()) {
    return expiresAt !== undefined && expiresAt <= now;
}
exports.isPasswordResetLinkExpired = isPasswordResetLinkExpired;
function matchesInitialPasswordResetAttempt(args) {
    if (!args.initialCode || !args.initialEmail) {
        return false;
    }
    return (args.initialCode.trim() === args.submittedCode.trim() &&
        normalizeAuthEmail(args.initialEmail) ===
            normalizeAuthEmail(args.submittedEmail));
}
exports.matchesInitialPasswordResetAttempt = matchesInitialPasswordResetAttempt;
function isMaskedPasswordResetRequestError(error) {
    return (error instanceof Error &&
        error.message.includes("InvalidAccountId"));
}
exports.isMaskedPasswordResetRequestError = isMaskedPasswordResetRequestError;
