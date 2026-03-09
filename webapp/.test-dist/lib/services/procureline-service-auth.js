"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProcurelineServiceHeaders = exports.createProcurelineServiceToken = exports.resolveProcurelineConvexSyncSecret = exports.resolveNestjsUrl = exports.resolveProcurelineServiceJwtSecret = exports.ProcurelineServiceConfigurationError = exports.DEVELOPMENT_PROCURELINE_CONVEX_SYNC_SECRET = exports.PROCURELINE_SERVICE_JWT_EXPIRY_SECONDS = exports.PROCURELINE_SERVICE_JWT_TYPE = exports.PROCURELINE_SERVICE_JWT_AUDIENCE = exports.PROCURELINE_SERVICE_JWT_ISSUER = void 0;
exports.PROCURELINE_SERVICE_JWT_ISSUER = "procureline.webapp";
exports.PROCURELINE_SERVICE_JWT_AUDIENCE = "procureline.nestjs";
exports.PROCURELINE_SERVICE_JWT_TYPE = "service";
exports.PROCURELINE_SERVICE_JWT_EXPIRY_SECONDS = 300;
exports.DEVELOPMENT_PROCURELINE_CONVEX_SYNC_SECRET = "dev-procureline-convex-sync-secret";
class ProcurelineServiceConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ProcurelineServiceConfigurationError";
    }
}
exports.ProcurelineServiceConfigurationError = ProcurelineServiceConfigurationError;
function encodeBase64Url(input) {
    return btoa(input)
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}
function encodeBytesBase64Url(bytes) {
    return btoa(String.fromCharCode(...Array.from(bytes)))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}
async function signSegment(segment, secret) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
        name: "HMAC",
        hash: "SHA-256",
    }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(segment));
    return encodeBytesBase64Url(new Uint8Array(signature));
}
function resolveProcurelineServiceJwtSecret(args) {
    const secret = args?.secret ?? process.env.PROCURELINE_SERVICE_JWT_SECRET;
    if (typeof secret === "string" && secret.trim().length > 0) {
        return secret.trim();
    }
    throw new ProcurelineServiceConfigurationError("PROCURELINE_SERVICE_JWT_SECRET must be configured for Convex-to-NestJS service calls");
}
exports.resolveProcurelineServiceJwtSecret = resolveProcurelineServiceJwtSecret;
function resolveNestjsUrl(args) {
    const url = args?.url ?? process.env.NESTJS_URL;
    if (typeof url === "string" && url.trim().length > 0) {
        return url.replace(/\/+$/, "");
    }
    throw new ProcurelineServiceConfigurationError("NESTJS_URL must be configured for Convex-to-NestJS service calls");
}
exports.resolveNestjsUrl = resolveNestjsUrl;
function resolveProcurelineConvexSyncSecret(args) {
    const secret = args?.secret ?? process.env.PROCURELINE_CONVEX_SYNC_SECRET;
    const nodeEnv = typeof args?.nodeEnv === "string"
        ? args.nodeEnv
        : typeof process.env.NODE_ENV === "string"
            ? process.env.NODE_ENV
            : "development";
    if (typeof secret === "string" && secret.trim().length > 0) {
        return secret.trim();
    }
    if (nodeEnv === "development" || nodeEnv === "test") {
        return exports.DEVELOPMENT_PROCURELINE_CONVEX_SYNC_SECRET;
    }
    throw new ProcurelineServiceConfigurationError("PROCURELINE_CONVEX_SYNC_SECRET must be configured outside development");
}
exports.resolveProcurelineConvexSyncSecret = resolveProcurelineConvexSyncSecret;
async function createProcurelineServiceToken(args) {
    const issuedAtSeconds = args.issuedAtSeconds ?? Math.floor(Date.now() / 1000);
    const claims = {
        aud: exports.PROCURELINE_SERVICE_JWT_AUDIENCE,
        exp: issuedAtSeconds + (args.expiresInSeconds ?? exports.PROCURELINE_SERVICE_JWT_EXPIRY_SECONDS),
        iat: issuedAtSeconds,
        iss: exports.PROCURELINE_SERVICE_JWT_ISSUER,
        jti: args.jti ?? crypto.randomUUID(),
        role: args.role,
        sub: args.userId,
        tenantId: args.tenantId,
        type: exports.PROCURELINE_SERVICE_JWT_TYPE,
    };
    const encodedHeader = encodeBase64Url(JSON.stringify({
        alg: "HS256",
        typ: "JWT",
    }));
    const encodedPayload = encodeBase64Url(JSON.stringify(claims));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const signature = await signSegment(unsignedToken, args.secret ?? resolveProcurelineServiceJwtSecret());
    return `${unsignedToken}.${signature}`;
}
exports.createProcurelineServiceToken = createProcurelineServiceToken;
function buildProcurelineServiceHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };
}
exports.buildProcurelineServiceHeaders = buildProcurelineServiceHeaders;
