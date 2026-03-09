"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePasswordLength = exports.validateOneTimeCodeInput = exports.validateOrganizationNameInput = exports.validatePlainTextInput = exports.validateEmailInput = exports.detectUnsafePlainTextReason = exports.generateTenantSubdomain = exports.normalizePlainText = exports.normalizeAuthEmail = exports.PASSWORD_PATTERNS = exports.PASSWORD_MIN_LENGTH = exports.AUTH_INPUT_LIMITS = void 0;
const zod_1 = require("zod");
const audit_1 = require("./audit");
exports.AUTH_INPUT_LIMITS = {
    email: 254,
    organizationName: 100,
    otpCodeLength: 8,
    password: 256,
};
exports.PASSWORD_MIN_LENGTH = 12;
exports.PASSWORD_PATTERNS = {
    digit: /[0-9]/,
    lowercase: /[a-z]/,
    special: /[^A-Za-z0-9]/,
    uppercase: /[A-Z]/,
};
const ENCODED_MARKUP_PATTERN = /<|>|&lt;|&gt;|&#0*60;|&#0*62;|&#x0*3c;|&#x0*3e;|%3c|%3e|javascript:/i;
const EMAIL_SCHEMA = zod_1.z.string().email("Invalid email format");
function createIssue(args) {
    return {
        issue: args,
        ok: false,
    };
}
function normalizeAuthEmail(email) {
    return email.trim().toLowerCase();
}
exports.normalizeAuthEmail = normalizeAuthEmail;
function normalizePlainText(input) {
    return input.trim().replace(/\s+/g, " ");
}
exports.normalizePlainText = normalizePlainText;
function generateTenantSubdomain(name) {
    return normalizePlainText(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}
exports.generateTenantSubdomain = generateTenantSubdomain;
function detectUnsafePlainTextReason(value) {
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
exports.detectUnsafePlainTextReason = detectUnsafePlainTextReason;
function validateEmailInput(value, field = "email") {
    const normalized = normalizeAuthEmail(value);
    const unsafeReason = detectUnsafePlainTextReason(normalized);
    if (unsafeReason) {
        return createIssue({
            code: "UNSAFE_PLAIN_TEXT",
            field,
            message: "Email must not contain markup or control characters",
            outcome: audit_1.AUDIT_OUTCOMES.rejectedUnsafePlainText,
            reason: unsafeReason,
        });
    }
    if (normalized.length > exports.AUTH_INPUT_LIMITS.email) {
        return createIssue({
            code: "TOO_LONG",
            field,
            message: `Email must not exceed ${exports.AUTH_INPUT_LIMITS.email} characters`,
            outcome: audit_1.AUDIT_OUTCOMES.rejectedTooLong,
            reason: "email_exceeds_max_length",
        });
    }
    const parseResult = EMAIL_SCHEMA.safeParse(normalized);
    if (!parseResult.success) {
        return createIssue({
            code: "INVALID_EMAIL",
            field,
            message: "Invalid email format",
            outcome: audit_1.AUDIT_OUTCOMES.rejectedInvalidEmail,
            reason: "email_format_invalid",
        });
    }
    return {
        ok: true,
        value: normalized,
    };
}
exports.validateEmailInput = validateEmailInput;
function validatePlainTextInput(value, args) {
    const normalized = normalizePlainText(value);
    const unsafeReason = detectUnsafePlainTextReason(normalized);
    if (unsafeReason) {
        return createIssue({
            code: "UNSAFE_PLAIN_TEXT",
            field: args.field,
            message: "Value must not contain markup or control characters",
            outcome: audit_1.AUDIT_OUTCOMES.rejectedUnsafePlainText,
            reason: unsafeReason,
        });
    }
    if (args.minLength !== undefined && normalized.length < args.minLength) {
        return createIssue({
            code: "REQUIRED",
            field: args.field,
            message: `Organization name must be at least ${args.minLength} characters`,
            outcome: audit_1.AUDIT_OUTCOMES.rejectedInvalidCode,
            reason: "plain_text_below_min_length",
        });
    }
    if (normalized.length > args.maxLength) {
        return createIssue({
            code: "TOO_LONG",
            field: args.field,
            message: `Organization name must be less than ${args.maxLength + 1} characters`,
            outcome: audit_1.AUDIT_OUTCOMES.rejectedTooLong,
            reason: "plain_text_exceeds_max_length",
        });
    }
    return {
        ok: true,
        value: normalized,
    };
}
exports.validatePlainTextInput = validatePlainTextInput;
function validateOrganizationNameInput(value) {
    const normalizedResult = validatePlainTextInput(value, {
        field: "organizationName",
        maxLength: exports.AUTH_INPUT_LIMITS.organizationName,
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
            outcome: audit_1.AUDIT_OUTCOMES.rejectedInvalidCode,
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
exports.validateOrganizationNameInput = validateOrganizationNameInput;
function validateOneTimeCodeInput(value, args) {
    const normalized = value.trim();
    const unsafeReason = detectUnsafePlainTextReason(normalized);
    if (unsafeReason) {
        return createIssue({
            code: "UNSAFE_PLAIN_TEXT",
            field: args.field,
            message: `${args.label} must not contain markup or control characters`,
            outcome: audit_1.AUDIT_OUTCOMES.rejectedUnsafePlainText,
            reason: unsafeReason,
        });
    }
    if (normalized.length !== exports.AUTH_INPUT_LIMITS.otpCodeLength ||
        !/^\d+$/.test(normalized)) {
        return createIssue({
            code: "INVALID_CODE",
            field: args.field,
            message: `${args.label} must be ${exports.AUTH_INPUT_LIMITS.otpCodeLength} digits`,
            outcome: audit_1.AUDIT_OUTCOMES.rejectedInvalidCode,
            reason: "verification_code_invalid",
        });
    }
    return {
        ok: true,
        value: normalized,
    };
}
exports.validateOneTimeCodeInput = validateOneTimeCodeInput;
function validatePasswordLength(value, field = "password") {
    if (value.length > exports.AUTH_INPUT_LIMITS.password) {
        return createIssue({
            code: "TOO_LONG",
            field,
            message: `Password must not exceed ${exports.AUTH_INPUT_LIMITS.password} characters`,
            outcome: audit_1.AUDIT_OUTCOMES.rejectedTooLong,
            reason: "password_exceeds_max_length",
        });
    }
    return {
        ok: true,
        value,
    };
}
exports.validatePasswordLength = validatePasswordLength;
