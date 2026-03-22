"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPlatformAdminAuthTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const auth_1 = require("../lib/platform-admin/auth");
const risk_1 = require("../lib/platform-admin/risk");
const session_1 = require("../lib/auth/session");
const NOW = new Date("2026-03-22T10:00:00.000Z").getTime();
async function runPlatformAdminAuthTests() {
    const completedTests = [];
    strict_1.default.deepEqual(auth_1.PLATFORM_ADMIN_AUTH_ROUTES, [
        "/platform-admin/login",
        "/platform-admin/setup-2fa",
        "/platform-admin/verify",
    ]);
    completedTests.push("platform admin authentication surfaces are explicitly defined as dedicated routes");
    const activePrivilegedSession = (0, session_1.resolveSessionState)({
        authSession: {
            _creationTime: NOW - 1000,
            expirationTime: NOW + session_1.REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: true,
            isPlatformAdminSession: true,
            lastActivityAt: NOW - (session_1.PLATFORM_ADMIN_INACTIVITY_WINDOW_MS - 60_000),
            createdAt: NOW - (session_1.PLATFORM_ADMIN_INACTIVITY_WINDOW_MS - 60_000),
        },
        now: NOW,
    });
    strict_1.default.equal(activePrivilegedSession.isValid, true);
    strict_1.default.equal(activePrivilegedSession.inactivityWindowMs, session_1.PLATFORM_ADMIN_INACTIVITY_WINDOW_MS);
    completedTests.push("platform admin sessions keep the 30 minute idle window even when remember-me metadata exists");
    const expiredPrivilegedSession = (0, session_1.resolveSessionState)({
        authSession: {
            _creationTime: NOW - 1000,
            expirationTime: NOW + session_1.REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: true,
            isPlatformAdminSession: true,
            lastActivityAt: NOW - session_1.PLATFORM_ADMIN_INACTIVITY_WINDOW_MS,
            createdAt: NOW - session_1.PLATFORM_ADMIN_INACTIVITY_WINDOW_MS,
        },
        now: NOW,
    });
    strict_1.default.equal(expiredPrivilegedSession.isValid, false);
    strict_1.default.equal(expiredPrivilegedSession.status, "expired");
    completedTests.push("platform admin sessions expire exactly at the privileged idle timeout threshold");
    const suspiciousRisk = await (0, risk_1.evaluatePlatformAdminRisk)({
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
    strict_1.default.equal(suspiciousRisk.level, "suspicious");
    strict_1.default.deepEqual(suspiciousRisk.reasons, ["country_changed", "ip_changed"]);
    completedTests.push("platform admin suspicious-login evaluation flags country and ip drift as step-up risks");
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
    const consumedBackup = (0, auth_1.consumePlatformAdminBackupCode)({
        backupCodes,
        normalizedCodeHash: "first-code",
        now: NOW,
    });
    if (consumedBackup.ok !== true) {
        strict_1.default.fail("expected the backup code to be consumed");
    }
    const successfulConsumedBackup = consumedBackup;
    strict_1.default.equal(successfulConsumedBackup.updatedBackupCodes[0]?.consumedAt, NOW);
    const replayRejected = (0, auth_1.consumePlatformAdminBackupCode)({
        backupCodes: successfulConsumedBackup.updatedBackupCodes,
        normalizedCodeHash: "first-code",
        now: NOW + 1000,
    });
    strict_1.default.deepEqual(replayRejected, {
        ok: false,
        reason: "already_consumed",
    });
    completedTests.push("platform admin backup codes are one-time credentials and reject replay attempts");
    strict_1.default.equal(auth_1.PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE, "Platform Admin accounts cannot be deleted");
    completedTests.push("platform admin deletion protection exposes the required blocked-account message");
    return completedTests;
}
exports.runPlatformAdminAuthTests = runPlatformAdminAuthTests;
