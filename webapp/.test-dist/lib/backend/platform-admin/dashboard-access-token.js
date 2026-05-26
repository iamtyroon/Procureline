"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPlatformAdminDashboardReadAccessToken = exports.createPlatformAdminDashboardReadAccessToken = exports.resolvePlatformAdminDashboardAccessTokenSecret = exports.PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_TTL_MS = exports.DEVELOPMENT_PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_SECRET = exports.PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_ENV_NAME = void 0;
exports.PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_ENV_NAME = "PA_DASH_ACCESS_TOKEN_SECRET";
exports.DEVELOPMENT_PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_SECRET = "dev-platform-admin-dashboard-access-token-secret";
exports.PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_TTL_MS = 1000 * 60 * 60 * 8;
function encodeBytesBase64Url(bytes) {
    return btoa(String.fromCharCode(...Array.from(bytes)))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}
function encodeTextBase64Url(value) {
    return encodeBytesBase64Url(new TextEncoder().encode(value));
}
function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const paddingLength = normalized.length % 4;
    const padded = paddingLength === 0
        ? normalized
        : `${normalized}${"=".repeat(4 - paddingLength)}`;
    return atob(padded);
}
async function signSegment(segment, secret) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
        name: "HMAC",
        hash: "SHA-256",
    }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(segment));
    return encodeBytesBase64Url(new Uint8Array(signature));
}
function constantTimeEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }
    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return mismatch === 0;
}
function resolvePlatformAdminDashboardAccessTokenNodeEnv(nodeEnv) {
    if (typeof nodeEnv === "string") {
        return nodeEnv;
    }
    return typeof process.env.NODE_ENV === "string"
        ? process.env.NODE_ENV
        : "development";
}
function resolvePlatformAdminDashboardAccessTokenSecret(args) {
    const secret = args?.secret ??
        process.env[exports.PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_ENV_NAME];
    const nodeEnv = resolvePlatformAdminDashboardAccessTokenNodeEnv(args?.nodeEnv);
    if (typeof secret === "string" && secret.trim().length > 0) {
        return secret.trim();
    }
    if (nodeEnv === "development") {
        return exports.DEVELOPMENT_PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_SECRET;
    }
    throw new Error(`resolvePlatformAdminDashboardAccessTokenSecret requires ${exports.PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_ENV_NAME} outside development.`);
}
exports.resolvePlatformAdminDashboardAccessTokenSecret = resolvePlatformAdminDashboardAccessTokenSecret;
async function createPlatformAdminDashboardReadAccessToken(args) {
    const issuedAt = args.now ?? Date.now();
    const envelope = {
        expiresAt: issuedAt + exports.PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_TTL_MS,
        issuedAt,
        scope: args.scope ?? "dashboard",
        userId: args.userId,
    };
    const encodedPayload = encodeTextBase64Url(JSON.stringify(envelope));
    const signature = await signSegment(encodedPayload, args.secret ?? resolvePlatformAdminDashboardAccessTokenSecret());
    return `${encodedPayload}.${signature}`;
}
exports.createPlatformAdminDashboardReadAccessToken = createPlatformAdminDashboardReadAccessToken;
async function verifyPlatformAdminDashboardReadAccessToken(args) {
    const [encodedPayload, providedSignature] = args.token.split(".");
    if (!encodedPayload || !providedSignature) {
        return {
            ok: false,
            reason: "invalid",
        };
    }
    const expectedSignature = await signSegment(encodedPayload, args.secret ?? resolvePlatformAdminDashboardAccessTokenSecret());
    if (!constantTimeEqual(providedSignature, expectedSignature)) {
        return {
            ok: false,
            reason: "invalid",
        };
    }
    try {
        const envelope = JSON.parse(decodeBase64Url(encodedPayload));
        const now = args.now ?? Date.now();
        if (typeof envelope.issuedAt !== "number" ||
            typeof envelope.expiresAt !== "number" ||
            (typeof envelope.scope !== "undefined" &&
                typeof envelope.scope !== "string") ||
            typeof envelope.userId !== "string") {
            return {
                ok: false,
                reason: "invalid",
            };
        }
        if ((envelope.scope ?? "dashboard") !== (args.scope ?? "dashboard")) {
            return {
                ok: false,
                reason: "invalid",
            };
        }
        if (envelope.userId !== args.userId) {
            return {
                ok: false,
                reason: "invalid",
            };
        }
        if (envelope.expiresAt <= now) {
            return {
                ok: false,
                reason: "expired",
            };
        }
        return {
            ok: true,
        };
    }
    catch {
        return {
            ok: false,
            reason: "invalid",
        };
    }
}
exports.verifyPlatformAdminDashboardReadAccessToken = verifyPlatformAdminDashboardReadAccessToken;
