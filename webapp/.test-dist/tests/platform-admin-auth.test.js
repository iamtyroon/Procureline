"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPlatformAdminAuthTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const auth_1 = require("../lib/shared/platform-admin/auth");
const request_context_token_1 = require("../lib/backend/platform-admin/request-context-token");
const risk_1 = require("../lib/backend/platform-admin/risk");
const auth_2 = require("../lib/shared/platform-admin/auth");
const session_1 = require("../lib/shared/auth/session");
const NOW = new Date("2026-03-22T10:00:00.000Z").getTime();
const REQUEST_CONTEXT = {
    city: "Nairobi",
    country: "KE",
    ipAddress: "203.0.113.12",
    region: "Nairobi County",
    userAgent: "ProcurelineAdminBrowser/1.0",
};
const REQUEST_CONTEXT_TEST_SECRET = "platform-admin-request-context-test-secret";
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
    const removedFingerprintRisk = await (0, risk_1.evaluatePlatformAdminRisk)({
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
    strict_1.default.equal(removedFingerprintRisk.level, "suspicious");
    strict_1.default.deepEqual(removedFingerprintRisk.reasons, [
        "country_changed",
        "ip_changed",
        "user_agent_changed",
    ]);
    completedTests.push("platform admin suspicious-login evaluation also flags removed request fingerprints as suspicious drift");
    const fallbackSecret = (0, request_context_token_1.resolvePlatformAdminRequestContextTokenSecret)({
        nodeEnv: "development",
        secret: undefined,
    });
    strict_1.default.equal(fallbackSecret, request_context_token_1.DEVELOPMENT_PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_SECRET);
    completedTests.push("platform admin request-context signing falls back to the documented built-in secret when no override is configured");
    strict_1.default.throws(() => (0, request_context_token_1.resolvePlatformAdminRequestContextTokenSecret)({
        nodeEnv: "production",
        secret: undefined,
    }), /PLATFORM_ADMIN_CTX_TOKEN_SECRET/);
    completedTests.push("platform admin request-context signing now fails fast outside development when no signing secret is configured");
    const signedRequestContext = await (0, request_context_token_1.createSignedPlatformAdminRequestContextToken)({
        context: REQUEST_CONTEXT,
        now: NOW,
        secret: REQUEST_CONTEXT_TEST_SECRET,
    });
    const verifiedRequestContext = await (0, request_context_token_1.verifySignedPlatformAdminRequestContextToken)({
        now: NOW + 60_000,
        secret: REQUEST_CONTEXT_TEST_SECRET,
        token: signedRequestContext,
    });
    strict_1.default.deepEqual(verifiedRequestContext, {
        ok: true,
        value: REQUEST_CONTEXT,
    });
    completedTests.push("platform admin request-context tokens round-trip only when the server signature is intact");
    const [payload, signature] = signedRequestContext.split(".");
    const tamperedToken = `${payload}.tampered${signature}`;
    const tamperedResult = await (0, request_context_token_1.verifySignedPlatformAdminRequestContextToken)({
        now: NOW + 60_000,
        secret: REQUEST_CONTEXT_TEST_SECRET,
        token: tamperedToken,
    });
    strict_1.default.deepEqual(tamperedResult, {
        ok: false,
        reason: "invalid",
    });
    completedTests.push("platform admin request-context verification rejects tampered client submissions");
    const invalidContextToken = await (0, request_context_token_1.createSignedPlatformAdminRequestContextToken)({
        context: null,
        now: NOW,
        secret: REQUEST_CONTEXT_TEST_SECRET,
    });
    const invalidContextResult = await (0, request_context_token_1.verifySignedPlatformAdminRequestContextToken)({
        now: NOW + 1_000,
        secret: REQUEST_CONTEXT_TEST_SECRET,
        token: invalidContextToken,
    });
    strict_1.default.deepEqual(invalidContextResult, {
        ok: false,
        reason: "invalid",
    });
    completedTests.push("platform admin request-context verification rejects malformed null contexts");
    const expiredResult = await (0, request_context_token_1.verifySignedPlatformAdminRequestContextToken)({
        now: NOW + 1000 * 60 * 16,
        secret: REQUEST_CONTEXT_TEST_SECRET,
        token: signedRequestContext,
    });
    strict_1.default.deepEqual(expiredResult, {
        ok: false,
        reason: "expired",
    });
    completedTests.push("platform admin request-context tokens expire quickly so stale login pages cannot replay trusted metadata");
    strict_1.default.deepEqual(await (0, risk_1.fingerprintPlatformAdminRequestContext)({
        country: "KE",
        ipAddress: "203.0.113.12",
        userAgent: "ProcurelineAdminBrowser/1.0",
    }), {
        country: "KE",
        ipHash: null,
        userAgentHash: null,
    });
    completedTests.push("platform admin request fingerprinting skips PII hashes when explicit consent is absent");
    strict_1.default.equal((0, auth_2.maskPlatformAdminEmail)("ops@internal@example.com"), "o***s@internal@example.com");
    completedTests.push("platform admin email masking preserves the full domain even when the address contains multiple at symbols");
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
