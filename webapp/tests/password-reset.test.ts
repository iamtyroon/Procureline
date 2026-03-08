import assert from "node:assert/strict";
import {
    buildPasswordResetLink,
    buildPasswordResetRedirectTo,
    getSingleSearchParam,
    isMaskedPasswordResetRequestError,
    isPasswordResetLinkExpired,
    matchesInitialPasswordResetAttempt,
    normalizeAuthEmail,
    parsePasswordResetExpiresAt,
} from "../lib/auth/password-reset";
import {
    forgotPasswordSchema,
    resetPasswordSchema,
} from "../lib/validators/auth";

export function runPasswordResetTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(
        normalizeAuthEmail("  ADMIN@University.ac.ke "),
        "admin@university.ac.ke",
    );
    completedTests.push("normalizeAuthEmail trims and lowercases emails");

    assert.equal(
        buildPasswordResetRedirectTo("Admin@University.ac.ke"),
        "/reset-password?email=admin%40university.ac.ke",
    );
    completedTests.push(
        "buildPasswordResetRedirectTo preserves the normalized email in the reset link",
    );

    assert.equal(
        buildPasswordResetLink(
            "https://procureline.app/reset-password?code=12345678",
            "Admin@University.ac.ke",
            new Date("2026-03-09T10:15:00.000Z"),
        ),
        "https://procureline.app/reset-password?code=12345678&email=admin%40university.ac.ke&expiresAt=1773051300000",
    );
    completedTests.push(
        "buildPasswordResetLink appends normalized email and expiry metadata",
    );

    assert.equal(getSingleSearchParam(["first", "second"]), "first");
    assert.equal(getSingleSearchParam("single"), "single");
    assert.equal(getSingleSearchParam(undefined), undefined);
    completedTests.push(
        "getSingleSearchParam returns the expected value for scalar and array params",
    );

    assert.equal(parsePasswordResetExpiresAt("1773051300000"), 1773051300000);
    assert.equal(parsePasswordResetExpiresAt(["1773051300000"]), 1773051300000);
    assert.equal(parsePasswordResetExpiresAt("invalid"), undefined);
    completedTests.push(
        "parsePasswordResetExpiresAt accepts valid timestamps and ignores invalid input",
    );

    assert.equal(isPasswordResetLinkExpired(1000, 1001), true);
    assert.equal(isPasswordResetLinkExpired(1000, 1000), true);
    assert.equal(isPasswordResetLinkExpired(1001, 1000), false);
    assert.equal(isPasswordResetLinkExpired(undefined, 1000), false);
    completedTests.push(
        "isPasswordResetLinkExpired identifies expired and active reset links",
    );

    assert.equal(
        matchesInitialPasswordResetAttempt({
            initialCode: "12345678",
            initialEmail: "Admin@University.ac.ke",
            submittedCode: "12345678",
            submittedEmail: "admin@university.ac.ke",
        }),
        true,
    );
    assert.equal(
        matchesInitialPasswordResetAttempt({
            initialCode: "12345678",
            initialEmail: "Admin@University.ac.ke",
            submittedCode: "87654321",
            submittedEmail: "admin@university.ac.ke",
        }),
        false,
    );
    completedTests.push(
        "matchesInitialPasswordResetAttempt only matches the original emailed code and email",
    );

    assert.equal(
        isMaskedPasswordResetRequestError(new Error("InvalidAccountId")),
        true,
    );
    assert.equal(
        isMaskedPasswordResetRequestError(new Error("Internal Server Error")),
        false,
    );
    assert.equal(isMaskedPasswordResetRequestError("InvalidAccountId"), false);
    completedTests.push(
        "isMaskedPasswordResetRequestError only masks missing-account reset requests",
    );

    const forgotPasswordResult = forgotPasswordSchema.safeParse({
        email: "admin@university.ac.ke",
    });
    assert.equal(forgotPasswordResult.success, true);
    completedTests.push("forgotPasswordSchema accepts valid email input");

    const weakPasswordResult = resetPasswordSchema.safeParse({
        email: "admin@university.ac.ke",
        code: "12345678",
        newPassword: "weakpass",
    });
    if (weakPasswordResult.success) {
        assert.fail("Expected weak password validation to fail");
    }
    assert.match(
        weakPasswordResult.error.issues[0]?.message ?? "",
        /Password must be/,
    );
    completedTests.push("resetPasswordSchema rejects weak passwords");

    const validResetResult = resetPasswordSchema.safeParse({
        email: "admin@university.ac.ke",
        code: "12345678",
        newPassword: "StrongPass#2026",
    });
    assert.equal(validResetResult.success, true);
    completedTests.push("resetPasswordSchema accepts a valid reset payload");

    return completedTests;
}
