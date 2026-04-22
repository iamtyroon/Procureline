"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearRememberMeBootstrapValue = exports.writeRememberMeBootstrapValue = exports.readRememberMeBootstrapValue = exports.createLogoutMetadataPatch = exports.resolveSessionState = exports.getSessionInactivityWindowMs = exports.REMEMBER_ME_SESSION_WINDOW_MS = exports.STANDARD_SESSION_INACTIVITY_MS = exports.REMEMBER_ME_STORAGE_KEY = exports.SUBSCRIPTION_INACTIVE_REASON = exports.ACCOUNT_DEACTIVATED_REASON = exports.SESSION_EXPIRED_REASON = exports.PLATFORM_ADMIN_INACTIVITY_WINDOW_MS = void 0;
const auth_1 = require("../platform-admin/auth");
Object.defineProperty(exports, "PLATFORM_ADMIN_INACTIVITY_WINDOW_MS", { enumerable: true, get: function () { return auth_1.PLATFORM_ADMIN_INACTIVITY_WINDOW_MS; } });
exports.SESSION_EXPIRED_REASON = "session_expired";
exports.ACCOUNT_DEACTIVATED_REASON = "account_deactivated";
exports.SUBSCRIPTION_INACTIVE_REASON = "subscription_inactive";
exports.REMEMBER_ME_STORAGE_KEY = "pendingRememberMe";
exports.STANDARD_SESSION_INACTIVITY_MS = 1000 * 60 * 60 * 24 * 15;
exports.REMEMBER_ME_SESSION_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;
function getSessionInactivityWindowMs(rememberMe, isPlatformAdminSession = false) {
    if (isPlatformAdminSession) {
        return auth_1.PLATFORM_ADMIN_INACTIVITY_WINDOW_MS;
    }
    return rememberMe
        ? exports.REMEMBER_ME_SESSION_WINDOW_MS
        : exports.STANDARD_SESSION_INACTIVITY_MS;
}
exports.getSessionInactivityWindowMs = getSessionInactivityWindowMs;
function resolveSessionState(args) {
    const { authSession, metadata = null, now = Date.now() } = args;
    const rememberMe = metadata?.rememberMe === true;
    const isPlatformAdminSession = metadata?.isPlatformAdminSession === true;
    const inactivityWindowMs = getSessionInactivityWindowMs(rememberMe, isPlatformAdminSession);
    if (authSession === null) {
        return {
            isValid: false,
            status: "expired",
            redirectReason: exports.SESSION_EXPIRED_REASON,
            rememberMe,
            isPlatformAdminSession,
            inactivityWindowMs,
            lastActivityAt: metadata?.lastActivityAt ?? null,
            authSessionExpirationTime: null,
        };
    }
    const lastActivityAt = metadata?.lastActivityAt ??
        metadata?.createdAt ??
        authSession._creationTime;
    if (metadata?.loggedOutAt !== undefined && metadata.loggedOutAt <= now) {
        return {
            isValid: false,
            status: "logged_out",
            redirectReason: exports.SESSION_EXPIRED_REASON,
            rememberMe,
            isPlatformAdminSession,
            inactivityWindowMs,
            lastActivityAt,
            authSessionExpirationTime: authSession.expirationTime,
        };
    }
    if (metadata?.revokedAt !== undefined && metadata.revokedAt <= now) {
        return {
            isValid: false,
            status: "revoked",
            redirectReason: exports.SESSION_EXPIRED_REASON,
            rememberMe,
            isPlatformAdminSession,
            inactivityWindowMs,
            lastActivityAt,
            authSessionExpirationTime: authSession.expirationTime,
        };
    }
    if (authSession.expirationTime <= now) {
        return {
            isValid: false,
            status: "expired",
            redirectReason: exports.SESSION_EXPIRED_REASON,
            rememberMe,
            isPlatformAdminSession,
            inactivityWindowMs,
            lastActivityAt,
            authSessionExpirationTime: authSession.expirationTime,
        };
    }
    if (lastActivityAt + inactivityWindowMs <= now) {
        return {
            isValid: false,
            status: "expired",
            redirectReason: exports.SESSION_EXPIRED_REASON,
            rememberMe,
            isPlatformAdminSession,
            inactivityWindowMs,
            lastActivityAt,
            authSessionExpirationTime: authSession.expirationTime,
        };
    }
    return {
        isValid: true,
        status: "active",
        redirectReason: null,
        rememberMe,
        isPlatformAdminSession,
        inactivityWindowMs,
        lastActivityAt,
        authSessionExpirationTime: authSession.expirationTime,
    };
}
exports.resolveSessionState = resolveSessionState;
function createLogoutMetadataPatch(now) {
    return {
        lastActivityAt: now,
        loggedOutAt: now,
    };
}
exports.createLogoutMetadataPatch = createLogoutMetadataPatch;
function readRememberMeBootstrapValue() {
    if (typeof window === "undefined") {
        return undefined;
    }
    const storedValue = window.sessionStorage.getItem(exports.REMEMBER_ME_STORAGE_KEY);
    if (storedValue === null) {
        return undefined;
    }
    return storedValue === "true";
}
exports.readRememberMeBootstrapValue = readRememberMeBootstrapValue;
function writeRememberMeBootstrapValue(rememberMe) {
    if (typeof window === "undefined") {
        return;
    }
    window.sessionStorage.setItem(exports.REMEMBER_ME_STORAGE_KEY, rememberMe ? "true" : "false");
}
exports.writeRememberMeBootstrapValue = writeRememberMeBootstrapValue;
function clearRememberMeBootstrapValue() {
    if (typeof window === "undefined") {
        return;
    }
    window.sessionStorage.removeItem(exports.REMEMBER_ME_STORAGE_KEY);
}
exports.clearRememberMeBootstrapValue = clearRememberMeBootstrapValue;
