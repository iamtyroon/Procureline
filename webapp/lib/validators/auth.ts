import { z } from "zod";
import {
    AUTH_INPUT_LIMITS,
    PASSWORD_MIN_LENGTH,
    PASSWORD_PATTERNS,
    validateEmailInput,
    validateOneTimeCodeInput,
    validateOrganizationNameInput,
    validatePasswordLength,
} from "../security/input";

function validateWithSharedResult(
    result:
        | { ok: true }
        | {
            ok: false;
            issue: {
                message: string;
            };
        },
    ctx: z.RefinementCtx,
): void {
    if (result.ok) {
        return;
    }

    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.issue.message,
    });
}

const emailSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(validateEmailInput(value), ctx);
});

const organizationNameSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(validateOrganizationNameInput(value), ctx);
});

const verificationCodeSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(
        validateOneTimeCodeInput(value, {
            field: "code",
            label: "Verification code",
        }),
        ctx,
    );
});

const resetCodeSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(
        validateOneTimeCodeInput(value, {
            field: "code",
            label: "Reset code",
        }),
        ctx,
    );
});

export const passwordSchema = z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .regex(
        PASSWORD_PATTERNS.uppercase,
        "Password must contain at least one uppercase letter",
    )
    .regex(
        PASSWORD_PATTERNS.lowercase,
        "Password must contain at least one lowercase letter",
    )
    .regex(
        PASSWORD_PATTERNS.digit,
        "Password must contain at least one number",
    )
    .regex(
        PASSWORD_PATTERNS.special,
        "Password must contain at least one special character",
    )
    .superRefine((value, ctx) => {
        validateWithSharedResult(validatePasswordLength(value), ctx);
    });

export const signupSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    organizationName: organizationNameSchema,
});

export const otpSchema = z.object({
    code: verificationCodeSchema,
});

export type SignupFormData = z.infer<typeof signupSchema>;
export type OtpFormData = z.infer<typeof otpSchema>;

/** Password requirement checklist for real-time UI feedback */
export const passwordRequirements = [
    { label: "At least 12 characters", test: (pw: string): boolean => pw.length >= 12 },
    { label: "One uppercase letter", test: (pw: string): boolean => /[A-Z]/.test(pw) },
    { label: "One lowercase letter", test: (pw: string): boolean => /[a-z]/.test(pw) },
    { label: "One number", test: (pw: string): boolean => /[0-9]/.test(pw) },
    {
        label: "One special character",
        test: (pw: string): boolean => /[^A-Za-z0-9]/.test(pw),
    },
] as const;

export const loginSchema = z.object({
    email: emailSchema,
    password: z
        .string()
        .min(1, "Password is required")
        .max(
            AUTH_INPUT_LIMITS.password,
            `Password must not exceed ${AUTH_INPUT_LIMITS.password} characters`,
        ),
    rememberMe: z.boolean(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
    email: emailSchema,
});

export const resetPasswordSchema = z.object({
    email: emailSchema,
    code: resetCodeSchema,
    newPassword: passwordSchema,
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
