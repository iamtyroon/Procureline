"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.passwordRequirements = exports.otpSchema = exports.signupSchema = exports.passwordSchema = void 0;
const zod_1 = require("zod");
const input_1 = require("../security/input");
function validateWithSharedResult(result, ctx) {
    if (result.ok) {
        return;
    }
    ctx.addIssue({
        code: zod_1.z.ZodIssueCode.custom,
        message: result.issue.message,
    });
}
const emailSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validateEmailInput)(value), ctx);
});
const organizationNameSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validateOrganizationNameInput)(value), ctx);
});
const verificationCodeSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validateOneTimeCodeInput)(value, {
        field: "code",
        label: "Verification code",
    }), ctx);
});
const resetCodeSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validateOneTimeCodeInput)(value, {
        field: "code",
        label: "Reset code",
    }), ctx);
});
exports.passwordSchema = zod_1.z
    .string()
    .min(input_1.PASSWORD_MIN_LENGTH, `Password must be at least ${input_1.PASSWORD_MIN_LENGTH} characters`)
    .regex(input_1.PASSWORD_PATTERNS.uppercase, "Password must contain at least one uppercase letter")
    .regex(input_1.PASSWORD_PATTERNS.lowercase, "Password must contain at least one lowercase letter")
    .regex(input_1.PASSWORD_PATTERNS.digit, "Password must contain at least one number")
    .regex(input_1.PASSWORD_PATTERNS.special, "Password must contain at least one special character")
    .superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validatePasswordLength)(value), ctx);
});
exports.signupSchema = zod_1.z.object({
    email: emailSchema,
    password: exports.passwordSchema,
    organizationName: organizationNameSchema,
});
exports.otpSchema = zod_1.z.object({
    code: verificationCodeSchema,
});
/** Password requirement checklist for real-time UI feedback */
exports.passwordRequirements = [
    { label: "At least 12 characters", test: (pw) => pw.length >= 12 },
    { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
    { label: "One lowercase letter", test: (pw) => /[a-z]/.test(pw) },
    { label: "One number", test: (pw) => /[0-9]/.test(pw) },
    {
        label: "One special character",
        test: (pw) => /[^A-Za-z0-9]/.test(pw),
    },
];
exports.loginSchema = zod_1.z.object({
    email: emailSchema,
    password: zod_1.z
        .string()
        .min(1, "Password is required")
        .max(input_1.AUTH_INPUT_LIMITS.password, `Password must not exceed ${input_1.AUTH_INPUT_LIMITS.password} characters`),
    rememberMe: zod_1.z.boolean(),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: emailSchema,
});
exports.resetPasswordSchema = zod_1.z.object({
    email: emailSchema,
    code: resetCodeSchema,
    newPassword: exports.passwordSchema,
});
