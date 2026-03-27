import assert from "node:assert/strict";
import {
    createSignedDepartmentUserRequestContextToken,
    verifySignedDepartmentUserRequestContextToken,
} from "../lib/auth/department-user-request-context-token";

export async function runDepartmentUserRequestContextTests(): Promise<string[]> {
    const completedTests: string[] = [];

    const token = await createSignedDepartmentUserRequestContextToken({
        context: {
            ipAddress: "203.0.113.42",
            userAgent: "Unit Test Browser",
        },
        now: 1_000,
        secret: "test-secret",
    });
    const verified = await verifySignedDepartmentUserRequestContextToken({
        now: 1_001,
        secret: "test-secret",
        token,
    });
    if (!verified.ok) {
        assert.fail("expected signed request context verification to succeed");
    }
    assert.equal(verified.value.ipAddress, "203.0.113.42");
    completedTests.push(
        "department-user request-context tokens round-trip trusted origin metadata when the signature is valid",
    );

    const expiredToken = await createSignedDepartmentUserRequestContextToken({
        context: {
            ipAddress: "203.0.113.42",
        },
        now: 1_000,
        secret: "test-secret",
    });
    const expired = await verifySignedDepartmentUserRequestContextToken({
        now: 1_000 + (1000 * 60 * 16),
        secret: "test-secret",
        token: expiredToken,
    });
    assert.deepEqual(expired, {
        ok: false,
        reason: "expired",
    });
    completedTests.push(
        "department-user request-context tokens degrade to an expired result instead of pretending stale browser-supplied origin data is still trusted",
    );

    return completedTests;
}
