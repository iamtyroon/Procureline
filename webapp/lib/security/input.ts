import { z } from "zod";
import { AUDIT_OUTCOMES } from "./audit";

export const AUTH_INPUT_LIMITS = {
    email: 254,
    organizationName: 100,
    otpCodeLength: 8,
    password: 256,
} as const;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_PATTERNS = {
    digit: /[0-9]/,
    lowercase: /[a-z]/,
    special: /[^A-Za-z0-9]/,
    uppercase: /[A-Z]/,
} as const;

const ENCODED_MARKUP_PATTERN =
    /<|>|&lt;|&gt;|&#0*60;|&#0*62;|&#x0*3c;|&#x0*3e;|%3c|%3e|javascript:/i;
const EMAIL_SCHEMA = z.string().email("Invalid email format");

export interface SecurityValidationIssue {
    code:
        | "INVALID_CODE"
        | "INVALID_EMAIL"
        | "REQUIRED"
        | "TOO_LONG"
        | "UNSAFE_PLAIN_TEXT";
    field: string;
    message: string;
    outcome:
        | typeof AUDIT_OUTCOMES.rejectedInvalidCode
        | typeof AUDIT_OUTCOMES.rejectedInvalidEmail
        | typeof AUDIT_OUTCOMES.rejectedTooLong
        | typeof AUDIT_OUTCOMES.rejectedUnsafePlainText;
    reason: string;
}

export type SecurityValidationResult<T> =
    | { ok: true; value: T }
    | { issue: SecurityValidationIssue; ok: false };

function createIssue(args: {
    code: SecurityValidationIssue["code"];
    field: string;
    message: string;
    outcome: SecurityValidationIssue["outcome"];
    reason: string;
}): SecurityValidationResult<never> {
    return {
        issue: args,
        ok: false,
    };
}

export function normalizeAuthEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function normalizePlainText(input: string): string {
    return input.trim().replace(/\s+/g, " ");
}

export function generateTenantSubdomain(name: string): string {
    return normalizePlainText(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export function detectUnsafePlainTextReason(
    value: string,
): "control_characters" | "encoded_or_markup_like_content" | null {
    for (const character of value) {
        const characterCode = character.charCodeAt(0);
        if (characterCode <= 31 || characterCode === 127) {
            return "control_characters";
        }
    }

    if (ENCODED_MARKUP_PATTERN.test(value)) {
        return "encoded_or_markup_like_content";
    }

    return null;
}

export function validateEmailInput(
    value: string,
    field: string = "email",
): SecurityValidationResult<string> {
    const normalized = normalizeAuthEmail(value);
    const unsafeReason = detectUnsafePlainTextReason(normalized);
    if (unsafeReason) {
        return createIssue({
            code: "UNSAFE_PLAIN_TEXT",
            field,
            message: "Email must not contain markup or control characters",
            outcome: AUDIT_OUTCOMES.rejectedUnsafePlainText,
            reason: unsafeReason,
        });
    }

    if (normalized.length > AUTH_INPUT_LIMITS.email) {
        return createIssue({
            code: "TOO_LONG",
            field,
            message: `Email must not exceed ${AUTH_INPUT_LIMITS.email} characters`,
            outcome: AUDIT_OUTCOMES.rejectedTooLong,
            reason: "email_exceeds_max_length",
        });
    }

    const parseResult = EMAIL_SCHEMA.safeParse(normalized);
    if (!parseResult.success) {
        return createIssue({
            code: "INVALID_EMAIL",
            field,
            message: "Invalid email format",
            outcome: AUDIT_OUTCOMES.rejectedInvalidEmail,
            reason: "email_format_invalid",
        });
    }

    return {
        ok: true,
        value: normalized,
    };
}

export function validatePlainTextInput(
    value: string,
    args: {
        field: string;
        maxLength: number;
        minLength?: number;
    },
): SecurityValidationResult<string> {
    const normalized = normalizePlainText(value);
    const unsafeReason = detectUnsafePlainTextReason(normalized);
    if (unsafeReason) {
        return createIssue({
            code: "UNSAFE_PLAIN_TEXT",
            field: args.field,
            message: "Value must not contain markup or control characters",
            outcome: AUDIT_OUTCOMES.rejectedUnsafePlainText,
            reason: unsafeReason,
        });
    }

    if (args.minLength !== undefined && normalized.length < args.minLength) {
        return createIssue({
            code: "REQUIRED",
            field: args.field,
            message: `Organization name must be at least ${args.minLength} characters`,
            outcome: AUDIT_OUTCOMES.rejectedInvalidCode,
            reason: "plain_text_below_min_length",
        });
    }

    if (normalized.length > args.maxLength) {
        return createIssue({
            code: "TOO_LONG",
            field: args.field,
            message: `Organization name must be less than ${args.maxLength + 1} characters`,
            outcome: AUDIT_OUTCOMES.rejectedTooLong,
            reason: "plain_text_exceeds_max_length",
        });
    }

    return {
        ok: true,
        value: normalized,
    };
}

export function validateOrganizationNameInput(
    value: string,
): SecurityValidationResult<{ normalized: string; subdomain: string }> {
    const normalizedResult = validatePlainTextInput(value, {
        field: "organizationName",
        maxLength: AUTH_INPUT_LIMITS.organizationName,
        minLength: 2,
    });
    if (!normalizedResult.ok) {
        return normalizedResult;
    }

    const subdomain = generateTenantSubdomain(normalizedResult.value);
    if (subdomain.length === 0) {
        return createIssue({
            code: "INVALID_CODE",
            field: "organizationName",
            message: "Organization name must contain at least one letter or number",
            outcome: AUDIT_OUTCOMES.rejectedInvalidCode,
            reason: "organization_name_missing_alphanumeric_content",
        });
    }

    return {
        ok: true,
        value: {
            normalized: normalizedResult.value,
            subdomain,
        },
    };
}

export function validateOneTimeCodeInput(
    value: string,
    args: {
        field: "code";
        label: "Reset code" | "Verification code";
    },
): SecurityValidationResult<string> {
    const normalized = value.trim();
    const unsafeReason = detectUnsafePlainTextReason(normalized);
    if (unsafeReason) {
        return createIssue({
            code: "UNSAFE_PLAIN_TEXT",
            field: args.field,
            message: `${args.label} must not contain markup or control characters`,
            outcome: AUDIT_OUTCOMES.rejectedUnsafePlainText,
            reason: unsafeReason,
        });
    }

    if (
        normalized.length !== AUTH_INPUT_LIMITS.otpCodeLength ||
        !/^\d+$/.test(normalized)
    ) {
        return createIssue({
            code: "INVALID_CODE",
            field: args.field,
            message: `${args.label} must be ${AUTH_INPUT_LIMITS.otpCodeLength} digits`,
            outcome: AUDIT_OUTCOMES.rejectedInvalidCode,
            reason: "verification_code_invalid",
        });
    }

    return {
        ok: true,
        value: normalized,
    };
}

export function validatePasswordLength(
    value: string,
    field: "newPassword" | "password" = "password",
): SecurityValidationResult<string> {
    if (value.length > AUTH_INPUT_LIMITS.password) {
        return createIssue({
            code: "TOO_LONG",
            field,
            message: `Password must not exceed ${AUTH_INPUT_LIMITS.password} characters`,
            outcome: AUDIT_OUTCOMES.rejectedTooLong,
            reason: "password_exceeds_max_length",
        });
    }

    return {
        ok: true,
        value,
    };
}
