export const PASSWORD_RESET_SUCCESS_REASON = "password_reset_success";
export const PASSWORD_RESET_REQUEST_MESSAGE =
    "If an account exists for that email, a password reset link has been sent.";
export const PASSWORD_RESET_REQUEST_ERROR_MESSAGE =
    "We couldn't send a password reset email right now. Please try again.";
export const PASSWORD_RESET_SUCCESS_MESSAGE =
    "Your password was updated. Sign in with your new password.";
export const PASSWORD_RESET_EXPIRED_MESSAGE =
    "Reset link expired. Please request a new one.";
export const PASSWORD_RESET_INVALID_MESSAGE =
    "Invalid reset link or code. Please request a new one.";
export const PASSWORD_RESET_TOO_MANY_ATTEMPTS_MESSAGE =
    "Too many attempts. Please request a new reset email and try again.";
export const PASSWORD_RESET_EXPIRES_AT_PARAM = "expiresAt";

export function normalizeAuthEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function buildPasswordResetRedirectTo(email: string): string {
    const params = new URLSearchParams({
        email: normalizeAuthEmail(email),
    });
    return `/reset-password?${params.toString()}`;
}

export function getSingleSearchParam(
    value: string | string[] | undefined,
): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export function buildPasswordResetLink(
    url: string,
    email: string,
    expiresAt: Date,
): string {
    const resetUrl = new URL(url);
    resetUrl.searchParams.set("email", normalizeAuthEmail(email));
    resetUrl.searchParams.set(
        PASSWORD_RESET_EXPIRES_AT_PARAM,
        expiresAt.getTime().toString(),
    );
    return resetUrl.toString();
}

export function parsePasswordResetExpiresAt(
    value: string | string[] | undefined,
): number | undefined {
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

export function isPasswordResetLinkExpired(
    expiresAt: number | undefined,
    now: number = Date.now(),
): boolean {
    return expiresAt !== undefined && expiresAt <= now;
}

export function matchesInitialPasswordResetAttempt(args: {
    initialCode?: string;
    initialEmail?: string;
    submittedCode: string;
    submittedEmail: string;
}): boolean {
    if (!args.initialCode || !args.initialEmail) {
        return false;
    }

    return (
        args.initialCode.trim() === args.submittedCode.trim() &&
        normalizeAuthEmail(args.initialEmail) ===
            normalizeAuthEmail(args.submittedEmail)
    );
}

export function isMaskedPasswordResetRequestError(error: unknown): boolean {
    return (
        error instanceof Error &&
        error.message.includes("InvalidAccountId")
    );
}
