"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSessionManagementTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const session_1 = require("../lib/auth/session");
const NOW = new Date("2026-03-08T10:00:00.000Z").getTime();
function runSessionManagementTests() {
    const completedTests = [];
    const activeStandardSession = (0, session_1.resolveSessionState)({
        authSession: {
            _creationTime: NOW - 1000,
            expirationTime: NOW + session_1.REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: false,
            lastActivityAt: NOW - session_1.STANDARD_SESSION_INACTIVITY_MS + 60_000,
            createdAt: NOW - session_1.STANDARD_SESSION_INACTIVITY_MS + 60_000,
        },
        now: NOW,
    });
    strict_1.default.equal(activeStandardSession.isValid, true);
    strict_1.default.equal(activeStandardSession.status, "active");
    strict_1.default.equal(activeStandardSession.redirectReason, null);
    completedTests.push("standard sessions stay active inside the 24 hour inactivity window");
    const expiredStandardSession = (0, session_1.resolveSessionState)({
        authSession: {
            _creationTime: NOW - session_1.REMEMBER_ME_SESSION_WINDOW_MS,
            expirationTime: NOW + session_1.REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: false,
            lastActivityAt: NOW - session_1.STANDARD_SESSION_INACTIVITY_MS,
            createdAt: NOW - session_1.STANDARD_SESSION_INACTIVITY_MS,
        },
        now: NOW,
    });
    strict_1.default.equal(expiredStandardSession.isValid, false);
    strict_1.default.equal(expiredStandardSession.status, "expired");
    completedTests.push("standard sessions expire exactly at the 24 hour inactivity threshold");
    const activeRememberedSession = (0, session_1.resolveSessionState)({
        authSession: {
            _creationTime: NOW - 1000,
            expirationTime: NOW + session_1.REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: true,
            lastActivityAt: NOW - (session_1.REMEMBER_ME_SESSION_WINDOW_MS - 60_000),
            createdAt: NOW - (session_1.REMEMBER_ME_SESSION_WINDOW_MS - 60_000),
        },
        now: NOW,
    });
    strict_1.default.equal(activeRememberedSession.isValid, true);
    strict_1.default.equal(activeRememberedSession.inactivityWindowMs, session_1.REMEMBER_ME_SESSION_WINDOW_MS);
    completedTests.push("remember-me sessions use the 30 day inactivity window");
    const missingAuthSession = (0, session_1.resolveSessionState)({
        authSession: null,
        metadata: {
            rememberMe: true,
            lastActivityAt: NOW - 1000,
            createdAt: NOW - 1000,
        },
        now: NOW,
    });
    strict_1.default.equal(missingAuthSession.isValid, false);
    strict_1.default.equal(missingAuthSession.status, "expired");
    completedTests.push("missing authSessions documents invalidate the current session");
    const revokedSession = (0, session_1.resolveSessionState)({
        authSession: {
            _creationTime: NOW - 1000,
            expirationTime: NOW + session_1.REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: true,
            lastActivityAt: NOW - 1000,
            revokedAt: NOW - 1,
            createdAt: NOW - 1000,
        },
        now: NOW,
    });
    strict_1.default.equal(revokedSession.isValid, false);
    strict_1.default.equal(revokedSession.status, "revoked");
    completedTests.push("revoked session metadata forces server-authoritative invalidation");
    const logoutPatch = (0, session_1.createLogoutMetadataPatch)(NOW);
    strict_1.default.deepEqual(logoutPatch, {
        lastActivityAt: NOW,
        loggedOutAt: NOW,
    });
    const loggedOutSession = (0, session_1.resolveSessionState)({
        authSession: {
            _creationTime: NOW - 1000,
            expirationTime: NOW + session_1.REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: false,
            ...logoutPatch,
            createdAt: NOW - 1000,
        },
        now: NOW,
    });
    strict_1.default.equal(loggedOutSession.isValid, false);
    strict_1.default.equal(loggedOutSession.status, "logged_out");
    completedTests.push("logout cleanup metadata makes the current session immediately invalid");
    return completedTests;
}
exports.runSessionManagementTests = runSessionManagementTests;
