import assert from "node:assert/strict";
import {
    PLATFORM_ADMIN_AUTH_ROUTES,
    PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE,
    consumePlatformAdminBackupCode,
} from "../lib/platform-admin/auth";
import { evaluatePlatformAdminRisk } from "../lib/platform-admin/risk";
import {
    PLATFORM_ADMIN_INACTIVITY_WINDOW_MS,
    REMEMBER_ME_SESSION_WINDOW_MS,
    resolveSessionState,
} from "../lib/auth/session";

const NOW = new Date("2026-03-22T10:00:00.000Z").getTime();

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
