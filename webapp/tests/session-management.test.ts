import assert from "node:assert/strict";
import {
    createLogoutMetadataPatch,
    REMEMBER_ME_SESSION_WINDOW_MS,
    resolveSessionState,
    STANDARD_SESSION_INACTIVITY_MS,
} from "../lib/auth/session";

const NOW = new Date("2026-03-08T10:00:00.000Z").getTime();

export function runSessionManagementTests(): string[] {
    const completedTests: string[] = [];

    const activeStandardSession = resolveSessionState({
        authSession: {
            _creationTime: NOW - 1000,
            expirationTime: NOW + REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: false,
            lastActivityAt: NOW - STANDARD_SESSION_INACTIVITY_MS + 60_000,
            createdAt: NOW - STANDARD_SESSION_INACTIVITY_MS + 60_000,
        },
        now: NOW,
    });
    assert.equal(activeStandardSession.isValid, true);
    assert.equal(activeStandardSession.status, "active");
    assert.equal(activeStandardSession.redirectReason, null);
    completedTests.push("standard sessions stay active inside the 15 day inactivity window");

    const expiredStandardSession = resolveSessionState({
        authSession: {
            _creationTime: NOW - REMEMBER_ME_SESSION_WINDOW_MS,
            expirationTime: NOW + REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: false,
            lastActivityAt: NOW - STANDARD_SESSION_INACTIVITY_MS,
            createdAt: NOW - STANDARD_SESSION_INACTIVITY_MS,
        },
        now: NOW,
    });
    assert.equal(expiredStandardSession.isValid, false);
    assert.equal(expiredStandardSession.status, "expired");
    completedTests.push("standard sessions expire exactly at the 15 day inactivity threshold");

    const activeRememberedSession = resolveSessionState({
        authSession: {
            _creationTime: NOW - 1000,
            expirationTime: NOW + REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: true,
            lastActivityAt: NOW - (REMEMBER_ME_SESSION_WINDOW_MS - 60_000),
            createdAt: NOW - (REMEMBER_ME_SESSION_WINDOW_MS - 60_000),
        },
        now: NOW,
    });
    assert.equal(activeRememberedSession.isValid, true);
    assert.equal(activeRememberedSession.inactivityWindowMs, REMEMBER_ME_SESSION_WINDOW_MS);
    completedTests.push("remember-me sessions use the 30 day inactivity window");

    const missingAuthSession = resolveSessionState({
        authSession: null,
        metadata: {
            rememberMe: true,
            lastActivityAt: NOW - 1000,
            createdAt: NOW - 1000,
        },
        now: NOW,
    });
    assert.equal(missingAuthSession.isValid, false);
    assert.equal(missingAuthSession.status, "expired");
    completedTests.push("missing authSessions documents invalidate the current session");

    const revokedSession = resolveSessionState({
        authSession: {
            _creationTime: NOW - 1000,
            expirationTime: NOW + REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: true,
            lastActivityAt: NOW - 1000,
            revokedAt: NOW - 1,
            createdAt: NOW - 1000,
        },
        now: NOW,
    });
    assert.equal(revokedSession.isValid, false);
    assert.equal(revokedSession.status, "revoked");
    completedTests.push("revoked session metadata forces server-authoritative invalidation");

    const logoutPatch = createLogoutMetadataPatch(NOW);
    assert.deepEqual(logoutPatch, {
        lastActivityAt: NOW,
        loggedOutAt: NOW,
    });

    const loggedOutSession = resolveSessionState({
        authSession: {
            _creationTime: NOW - 1000,
            expirationTime: NOW + REMEMBER_ME_SESSION_WINDOW_MS,
        },
        metadata: {
            rememberMe: false,
            ...logoutPatch,
            createdAt: NOW - 1000,
        },
        now: NOW,
    });
    assert.equal(loggedOutSession.isValid, false);
    assert.equal(loggedOutSession.status, "logged_out");
    completedTests.push("logout cleanup metadata makes the current session immediately invalid");

    return completedTests;
}
