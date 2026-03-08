export const SESSION_EXPIRED_REASON = "session_expired" as const;
export const ACCOUNT_DEACTIVATED_REASON = "account_deactivated" as const;
export const SUBSCRIPTION_INACTIVE_REASON = "subscription_inactive" as const;
export const REMEMBER_ME_STORAGE_KEY = "pendingRememberMe";

export const STANDARD_SESSION_INACTIVITY_MS = 1000 * 60 * 60 * 24;
export const REMEMBER_ME_SESSION_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;

export type SessionRedirectReason =
    | typeof SESSION_EXPIRED_REASON
    | typeof ACCOUNT_DEACTIVATED_REASON
    | typeof SUBSCRIPTION_INACTIVE_REASON;

export type SessionStatus = "active" | "expired" | "revoked" | "logged_out";

export interface AuthSessionRecordLike {
    _creationTime: number;
    expirationTime: number;
}

export interface SessionMetadataRecordLike {
    rememberMe?: boolean;
    lastActivityAt?: number;
    createdAt?: number;
    revokedAt?: number;
    loggedOutAt?: number;
}

export interface ResolvedSessionState {
    isValid: boolean;
    status: SessionStatus;
    redirectReason: typeof SESSION_EXPIRED_REASON | null;
    rememberMe: boolean;
    inactivityWindowMs: number;
    lastActivityAt: number | null;
    authSessionExpirationTime: number | null;
}

export interface CurrentSessionSnapshot {
    sessionId: string;
    userId: string;
    state: ResolvedSessionState;
}

export function getSessionInactivityWindowMs(rememberMe: boolean): number {
    return rememberMe
        ? REMEMBER_ME_SESSION_WINDOW_MS
        : STANDARD_SESSION_INACTIVITY_MS;
}

export function resolveSessionState(args: {
    authSession: AuthSessionRecordLike | null;
    metadata?: SessionMetadataRecordLike | null;
    now?: number;
}): ResolvedSessionState {
    const { authSession, metadata = null, now = Date.now() } = args;
    const rememberMe = metadata?.rememberMe === true;
    const inactivityWindowMs = getSessionInactivityWindowMs(rememberMe);

    if (authSession === null) {
        return {
            isValid: false,
            status: "expired",
            redirectReason: SESSION_EXPIRED_REASON,
            rememberMe,
            inactivityWindowMs,
            lastActivityAt: metadata?.lastActivityAt ?? null,
            authSessionExpirationTime: null,
        };
    }

    const lastActivityAt =
        metadata?.lastActivityAt ??
        metadata?.createdAt ??
        authSession._creationTime;

    if (metadata?.loggedOutAt !== undefined && metadata.loggedOutAt <= now) {
        return {
            isValid: false,
            status: "logged_out",
            redirectReason: SESSION_EXPIRED_REASON,
            rememberMe,
            inactivityWindowMs,
            lastActivityAt,
            authSessionExpirationTime: authSession.expirationTime,
        };
    }

    if (metadata?.revokedAt !== undefined && metadata.revokedAt <= now) {
        return {
            isValid: false,
            status: "revoked",
            redirectReason: SESSION_EXPIRED_REASON,
            rememberMe,
            inactivityWindowMs,
            lastActivityAt,
            authSessionExpirationTime: authSession.expirationTime,
        };
    }

    if (authSession.expirationTime <= now) {
        return {
            isValid: false,
            status: "expired",
            redirectReason: SESSION_EXPIRED_REASON,
            rememberMe,
            inactivityWindowMs,
            lastActivityAt,
            authSessionExpirationTime: authSession.expirationTime,
        };
    }

    if (lastActivityAt + inactivityWindowMs <= now) {
        return {
            isValid: false,
            status: "expired",
            redirectReason: SESSION_EXPIRED_REASON,
            rememberMe,
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
        inactivityWindowMs,
        lastActivityAt,
        authSessionExpirationTime: authSession.expirationTime,
    };
}

export interface LogoutMetadataPatch {
    lastActivityAt: number;
    loggedOutAt: number;
}

export function createLogoutMetadataPatch(now: number): LogoutMetadataPatch {
    return {
        lastActivityAt: now,
        loggedOutAt: now,
    };
}

export function readRememberMeBootstrapValue(): boolean | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }

    const storedValue = window.sessionStorage.getItem(REMEMBER_ME_STORAGE_KEY);
    if (storedValue === null) {
        return undefined;
    }

    return storedValue === "true";
}

export function writeRememberMeBootstrapValue(rememberMe: boolean): void {
    if (typeof window === "undefined") {
        return;
    }

    window.sessionStorage.setItem(
        REMEMBER_ME_STORAGE_KEY,
        rememberMe ? "true" : "false",
    );
}

export function clearRememberMeBootstrapValue(): void {
    if (typeof window === "undefined") {
        return;
    }

    window.sessionStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
}
