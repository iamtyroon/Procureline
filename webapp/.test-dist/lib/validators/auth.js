"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.passwordRequirements = exports.otpSchema = exports.signupSchema = exports.passwordSchema = void 0;
const zod_1 = require("zod");
exports.passwordSchema = zod_1.z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");
exports.signupSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email format"),
    password: exports.passwordSchema,
    organizationName: zod_1.z
        .string()
        .min(2, "Organization name must be at least 2 characters")
        .max(100, "Organization name must be less than 100 characters"),
});
exports.otpSchema = zod_1.z.object({
    code: zod_1.z
        .string()
        .length(8, "Verification code must be 8 digits")
        .regex(/^\d+$/, "Verification code must contain only digits"),
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
    email: zod_1.z.string().email("Invalid email format"),
    password: zod_1.z.string().min(1, "Password is required").max(256, "Password must not exceed 256 characters"),
    rememberMe: zod_1.z.boolean(),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email format"),
});
exports.resetPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email format"),
    code: zod_1.z
        .string()
        .trim()
        .length(8, "Reset code must be 8 digits")
        .regex(/^\d+$/, "Reset code must contain only digits"),
    newPassword: exports.passwordSchema,
});
