import { z } from "zod";

export const passwordSchema = z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character",
    );

export const signupSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: passwordSchema,
    organizationName: z
        .string()
        .min(2, "Organization name must be at least 2 characters")
        .max(100, "Organization name must be less than 100 characters"),
});

export const otpSchema = z.object({
    code: z
        .string()
        .length(8, "Verification code must be 8 digits")
        .regex(/^\d+$/, "Verification code must contain only digits"),
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
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required").max(256, "Password must not exceed 256 characters"),
    rememberMe: z.boolean(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email format"),
});

export const resetPasswordSchema = z.object({
    email: z.string().email("Invalid email format"),
    code: z
        .string()
        .trim()
        .length(8, "Reset code must be 8 digits")
        .regex(/^\d+$/, "Reset code must contain only digits"),
    newPassword: passwordSchema,
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
