import assert from "node:assert/strict";
import {
    PLATFORM_ADMIN_AUTH_ROUTES,
    PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE,
    consumePlatformAdminBackupCode,
} from "../lib/platform-admin/auth";
import {
    createSignedPlatformAdminRequestContextToken,
    DEVELOPMENT_PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_SECRET,
    resolvePlatformAdminRequestContextTokenSecret,
    verifySignedPlatformAdminRequestContextToken,
} from "../lib/platform-admin/request-context-token";
import {
    evaluatePlatformAdminRisk,
    fingerprintPlatformAdminRequestContext,
} from "../lib/platform-admin/risk";
import { maskPlatformAdminEmail } from "../lib/platform-admin/auth";
import {
    PLATFORM_ADMIN_INACTIVITY_WINDOW_MS,
    REMEMBER_ME_SESSION_WINDOW_MS,
    resolveSessionState,
} from "../lib/auth/session";

const NOW = new Date("2026-03-22T10:00:00.000Z").getTime();
const REQUEST_CONTEXT = {
    city: "Nairobi",
    country: "KE",
    ipAddress: "203.0.113.12",
    region: "Nairobi County",
    userAgent: "ProcurelineAdminBrowser/1.0",
};
const REQUEST_CONTEXT_TEST_SECRET = "platform-admin-request-context-test-secret";

export async function runPlatformAdminAuthTests(): Promise<string[]> {
    const completedTests: string[] = [];

    assert.deepEqual(PLATFORM_ADMIN_AUTH_ROUTES, [
        "/platform-admin/login",
        "/platform-admin/setup-2fa",
        "/platform-admin/verify",
    ]);
    completedTests.push(
        "platform admin authentication surfaces are explicitly defined as dedicated routes",
    );

    const activePrivilegedSession = resolveSessionState({
        authSession: {
            _creationTime: NOW - 1000,
            expirationTime: NOW + REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: true,
            isPlatformAdminSession: true,
            lastActivityAt: NOW - (PLATFORM_ADMIN_INACTIVITY_WINDOW_MS - 60_000),
            createdAt: NOW - (PLATFORM_ADMIN_INACTIVITY_WINDOW_MS - 60_000),
        },
        now: NOW,
    });
    assert.equal(activePrivilegedSession.isValid, true);
    assert.equal(
        activePrivilegedSession.inactivityWindowMs,
        PLATFORM_ADMIN_INACTIVITY_WINDOW_MS,
    );
    completedTests.push(
        "platform admin sessions keep the 30 minute idle window even when remember-me metadata exists",
    );

    const expiredPrivilegedSession = resolveSessionState({
        authSession: {
            _creationTime: NOW - 1000,
            expirationTime: NOW + REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: true,
            isPlatformAdminSession: true,
            lastActivityAt: NOW - PLATFORM_ADMIN_INACTIVITY_WINDOW_MS,
            createdAt: NOW - PLATFORM_ADMIN_INACTIVITY_WINDOW_MS,
        },
        now: NOW,
    });
    assert.equal(expiredPrivilegedSession.isValid, false);
    assert.equal(expiredPrivilegedSession.status, "expired");
    completedTests.push(
        "platform admin sessions expire exactly at the privileged idle timeout threshold",
    );

    const suspiciousRisk = await evaluatePlatformAdminRisk({
        baseline: {
            country: "KE",
            ipHash: "old-ip",
            userAgentHash: "old-agent",
        },
        current: {
            country: "UG",
            ipHash: "new-ip",
            userAgentHash: "old-agent",
        },
    });
    assert.equal(suspiciousRisk.level, "suspicious");
    assert.deepEqual(suspiciousRisk.reasons, ["country_changed", "ip_changed"]);
    completedTests.push(
        "platform admin suspicious-login evaluation flags country and ip drift as step-up risks",
    );

    const removedFingerprintRisk = await evaluatePlatformAdminRisk({
        baseline: {
            country: "KE",
            ipHash: "persisted-ip",
            userAgentHash: "persisted-agent",
        },
        current: {
            country: null,
            ipHash: null,
            userAgentHash: null,
        },
    });
    assert.equal(removedFingerprintRisk.level, "suspicious");
    assert.deepEqual(removedFingerprintRisk.reasons, [
        "country_changed",
        "ip_changed",
        "user_agent_changed",
    ]);
    completedTests.push(
        "platform admin suspicious-login evaluation also flags removed request fingerprints as suspicious drift",
    );

    const fallbackSecret = resolvePlatformAdminRequestContextTokenSecret({
        nodeEnv: "development",
        secret: undefined,
    });
    assert.equal(
        fallbackSecret,
        DEVELOPMENT_PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_SECRET,
    );
    completedTests.push(
        "platform admin request-context signing falls back to the documented built-in secret when no override is configured",
    );

    assert.throws(
        () =>
            resolvePlatformAdminRequestContextTokenSecret({
                nodeEnv: "production",
                secret: undefined,
            }),
        /PLATFORM_ADMIN_CTX_TOKEN_SECRET/,
    );
    completedTests.push(
        "platform admin request-context signing now fails fast outside development when no signing secret is configured",
    );

    const signedRequestContext = await createSignedPlatformAdminRequestContextToken({
        context: REQUEST_CONTEXT,
        now: NOW,
        secret: REQUEST_CONTEXT_TEST_SECRET,
    });
    const verifiedRequestContext =
        await verifySignedPlatformAdminRequestContextToken({
            now: NOW + 60_000,
            secret: REQUEST_CONTEXT_TEST_SECRET,
            token: signedRequestContext,
        });
    assert.deepEqual(verifiedRequestContext, {
        ok: true,
        value: REQUEST_CONTEXT,
    });
    completedTests.push(
        "platform admin request-context tokens round-trip only when the server signature is intact",
    );

    const [payload, signature] = signedRequestContext.split(".");
    const tamperedToken = `${payload}.tampered${signature}`;
    const tamperedResult = await verifySignedPlatformAdminRequestContextToken({
        now: NOW + 60_000,
        secret: REQUEST_CONTEXT_TEST_SECRET,
        token: tamperedToken,
    });
    assert.deepEqual(tamperedResult, {
        ok: false,
        reason: "invalid",
    });
    completedTests.push(
        "platform admin request-context verification rejects tampered client submissions",
    );

    const invalidContextToken =
        await createSignedPlatformAdminRequestContextToken({
            context: null as never,
            now: NOW,
            secret: REQUEST_CONTEXT_TEST_SECRET,
        });
    const invalidContextResult =
        await verifySignedPlatformAdminRequestContextToken({
            now: NOW + 1_000,
            secret: REQUEST_CONTEXT_TEST_SECRET,
            token: invalidContextToken,
        });
    assert.deepEqual(invalidContextResult, {
        ok: false,
        reason: "invalid",
    });
    completedTests.push(
        "platform admin request-context verification rejects malformed null contexts",
    );

    const expiredResult = await verifySignedPlatformAdminRequestContextToken({
        now: NOW + 1000 * 60 * 16,
        secret: REQUEST_CONTEXT_TEST_SECRET,
        token: signedRequestContext,
    });
    assert.deepEqual(expiredResult, {
        ok: false,
        reason: "expired",
    });
    completedTests.push(
        "platform admin request-context tokens expire quickly so stale login pages cannot replay trusted metadata",
    );

    assert.deepEqual(
        await fingerprintPlatformAdminRequestContext({
            country: "KE",
            ipAddress: "203.0.113.12",
            userAgent: "ProcurelineAdminBrowser/1.0",
        }),
        {
            country: "KE",
            ipHash: null,
            userAgentHash: null,
        },
    );
    completedTests.push(
        "platform admin request fingerprinting skips PII hashes when explicit consent is absent",
    );

    assert.equal(
        maskPlatformAdminEmail("ops@internal@example.com"),
        "o***s@internal@example.com",
    );
    completedTests.push(
        "platform admin email masking preserves the full domain even when the address contains multiple at symbols",
    );

    const backupCodes = [
        {
            codeHash: "first-code",
            consumedAt: undefined,
            createdAt: NOW - 1000,
            suffix: "ALPHA",
        },
        {
            codeHash: "second-code",
            consumedAt: NOW - 1,
            createdAt: NOW - 1000,
            suffix: "BRAVO",
        },
    ];
    const consumedBackup = consumePlatformAdminBackupCode({
        backupCodes,
        normalizedCodeHash: "first-code",
        now: NOW,
    });
    if (consumedBackup.ok !== true) {
        assert.fail("expected the backup code to be consumed");
    }
    const successfulConsumedBackup = consumedBackup;
    assert.equal(successfulConsumedBackup.updatedBackupCodes[0]?.consumedAt, NOW);

    const replayRejected = consumePlatformAdminBackupCode({
        backupCodes: successfulConsumedBackup.updatedBackupCodes,
        normalizedCodeHash: "first-code",
        now: NOW + 1000,
    });
    assert.deepEqual(replayRejected, {
        ok: false,
        reason: "already_consumed",
    });
    completedTests.push(
        "platform admin backup codes are one-time credentials and reject replay attempts",
    );

    assert.equal(
        PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE,
        "Platform Admin accounts cannot be deleted",
    );
    completedTests.push(
        "platform admin deletion protection exposes the required blocked-account message",
    );

    return completedTests;
}
