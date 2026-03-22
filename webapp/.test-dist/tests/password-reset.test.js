"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPasswordResetTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const password_reset_1 = require("../lib/auth/password-reset");
const auth_1 = require("../lib/validators/auth");
function runPasswordResetTests() {
    const completedTests = [];
    strict_1.default.equal((0, password_reset_1.normalizeAuthEmail)("  ADMIN@University.ac.ke "), "admin@university.ac.ke");
    completedTests.push("normalizeAuthEmail trims and lowercases emails");
    strict_1.default.equal((0, password_reset_1.buildPasswordResetRedirectTo)("Admin@University.ac.ke"), "/reset-password?email=admin%40university.ac.ke");
    completedTests.push("buildPasswordResetRedirectTo preserves the normalized email in the reset link");
    strict_1.default.equal((0, password_reset_1.buildPasswordResetRedirectTo)("Admin@University.ac.ke", {
        continueTo: "/signup?invite=tenant-admin-token",
    }), "/reset-password?email=admin%40university.ac.ke&continueTo=%2Fsignup%3Finvite%3Dtenant-admin-token");
    completedTests.push("buildPasswordResetRedirectTo preserves onboarding continuation routes for invite-based password recovery");
    strict_1.default.equal((0, password_reset_1.buildPasswordResetLink)("https://procureline.app/reset-password?code=12345678&continueTo=%2Fsignup%3Finvite%3Dtenant-admin-token", "Admin@University.ac.ke", new Date("2026-03-09T10:15:00.000Z")), "https://procureline.app/reset-password?code=12345678&continueTo=%2Fsignup%3Finvite%3Dtenant-admin-token&email=admin%40university.ac.ke&expiresAt=1773051300000");
    completedTests.push("buildPasswordResetLink appends normalized email and expiry metadata");
    strict_1.default.equal((0, password_reset_1.getSingleSearchParam)(["first", "second"]), "first");
    strict_1.default.equal((0, password_reset_1.getSingleSearchParam)("single"), "single");
    strict_1.default.equal((0, password_reset_1.getSingleSearchParam)(undefined), undefined);
    completedTests.push("getSingleSearchParam returns the expected value for scalar and array params");
    strict_1.default.equal((0, password_reset_1.parsePasswordResetExpiresAt)("1773051300000"), 1773051300000);
    strict_1.default.equal((0, password_reset_1.parsePasswordResetExpiresAt)(["1773051300000"]), 1773051300000);
    strict_1.default.equal((0, password_reset_1.parsePasswordResetExpiresAt)("invalid"), undefined);
    completedTests.push("parsePasswordResetExpiresAt accepts valid timestamps and ignores invalid input");
    strict_1.default.equal((0, password_reset_1.isPasswordResetLinkExpired)(1000, 1001), true);
    strict_1.default.equal((0, password_reset_1.isPasswordResetLinkExpired)(1000, 1000), true);
    strict_1.default.equal((0, password_reset_1.isPasswordResetLinkExpired)(1001, 1000), false);
    strict_1.default.equal((0, password_reset_1.isPasswordResetLinkExpired)(undefined, 1000), false);
    completedTests.push("isPasswordResetLinkExpired identifies expired and active reset links");
    strict_1.default.equal((0, password_reset_1.matchesInitialPasswordResetAttempt)({
        initialCode: "12345678",
        initialEmail: "Admin@University.ac.ke",
        submittedCode: "12345678",
        submittedEmail: "admin@university.ac.ke",
    }), true);
    strict_1.default.equal((0, password_reset_1.matchesInitialPasswordResetAttempt)({
        initialCode: "12345678",
        initialEmail: "Admin@University.ac.ke",
        submittedCode: "87654321",
        submittedEmail: "admin@university.ac.ke",
    }), false);
    completedTests.push("matchesInitialPasswordResetAttempt only matches the original emailed code and email");
    strict_1.default.equal((0, password_reset_1.isMaskedPasswordResetRequestError)(new Error("InvalidAccountId")), true);
    strict_1.default.equal((0, password_reset_1.isMaskedPasswordResetRequestError)(new Error("Internal Server Error")), false);
    strict_1.default.equal((0, password_reset_1.isMaskedPasswordResetRequestError)("InvalidAccountId"), false);
    completedTests.push("isMaskedPasswordResetRequestError only masks missing-account reset requests");
    const forgotPasswordResult = auth_1.forgotPasswordSchema.safeParse({
        email: "admin@university.ac.ke",
    });
    strict_1.default.equal(forgotPasswordResult.success, true);
    completedTests.push("forgotPasswordSchema accepts valid email input");
    const weakPasswordResult = auth_1.resetPasswordSchema.safeParse({
        email: "admin@university.ac.ke",
        code: "12345678",
        newPassword: "weakpass",
    });
    if (weakPasswordResult.success) {
        strict_1.default.fail("Expected weak password validation to fail");
    }
    strict_1.default.match(weakPasswordResult.error.issues[0]?.message ?? "", /Password must be/);
    completedTests.push("resetPasswordSchema rejects weak passwords");
    const validResetResult = auth_1.resetPasswordSchema.safeParse({
        email: "admin@university.ac.ke",
        code: "12345678",
        newPassword: "StrongPass#2026",
    });
    strict_1.default.equal(validResetResult.success, true);
    completedTests.push("resetPasswordSchema accepts a valid reset payload");
    return completedTests;
}
exports.runPasswordResetTests = runPasswordResetTests;
