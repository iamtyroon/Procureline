"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateOriginPolicy = exports.resolveAllowedOrigins = exports.AllowedOriginsConfigurationError = exports.DEVELOPMENT_ALLOWED_ORIGINS = exports.ALLOWED_ORIGINS_ENV_NAME = void 0;
const audit_1 = require("@/lib/shared/security/audit");
exports.ALLOWED_ORIGINS_ENV_NAME = "ALLOWED_ORIGINS";
exports.DEVELOPMENT_ALLOWED_ORIGINS = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
class AllowedOriginsConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = "AllowedOriginsConfigurationError";
    }
}
exports.AllowedOriginsConfigurationError = AllowedOriginsConfigurationError;
function normalizeOrigin(origin) {
    try {
        const parsed = new URL(origin.trim());
        if (!/^https?:$/.test(parsed.protocol)) {
            return null;
        }
        return `${parsed.protocol}//${parsed.host}`.toLowerCase();
    }
    catch {
        return null;
    }
}
function resolveAllowedOrigins(args) {
    const rawAllowedOrigins = args?.allowedOrigins ?? process.env.ALLOWED_ORIGINS;
    const nodeEnv = typeof args?.nodeEnv === "string"
        ? args.nodeEnv
        : typeof process.env.NODE_ENV === "string"
            ? process.env.NODE_ENV
            : "development";
    const parsedOrigins = rawAllowedOrigins
        ?.split(",")
        .map((origin) => normalizeOrigin(origin))
        .filter((origin) => origin !== null);
    if (parsedOrigins && parsedOrigins.length > 0) {
        return {
            origins: Array.from(new Set(parsedOrigins)).sort(),
            source: "env",
        };
    }
    if (nodeEnv === "development" || nodeEnv === "test") {
        return {
            origins: [...exports.DEVELOPMENT_ALLOWED_ORIGINS],
            source: "development-defaults",
        };
    }
    throw new AllowedOriginsConfigurationError(`${exports.ALLOWED_ORIGINS_ENV_NAME} must be configured outside development`);
}
exports.resolveAllowedOrigins = resolveAllowedOrigins;
function evaluateOriginPolicy(args) {
    const normalizedRequestOrigin = args.requestOrigin !== undefined && args.requestOrigin !== null
        ? normalizeOrigin(args.requestOrigin)
        : null;
    const normalizedOrigin = args.originHeader !== undefined && args.originHeader !== null
        ? normalizeOrigin(args.originHeader)
        : null;
    const normalizedMethod = args.method.toUpperCase();
    if (!normalizedOrigin) {
        const requestIsAllowlisted = normalizedRequestOrigin !== null &&
            args.allowedOrigins.includes(normalizedRequestOrigin);
        if (requestIsAllowlisted) {
            return {
                allowed: true,
                normalizedOrigin: normalizedRequestOrigin,
                reason: "allowed_missing_origin_allowlisted_request",
            };
        }
        if (SAFE_METHODS.has(normalizedMethod)) {
            return {
                allowed: true,
                reason: "allowed_missing_origin",
            };
        }
        return {
            allowed: false,
            auditEvent: (0, audit_1.buildBlockedOriginEvent)({
                allowedOrigins: args.allowedOrigins,
                method: normalizedMethod,
                path: args.path,
                requestOrigin: normalizedRequestOrigin ?? undefined,
            }),
            reason: "blocked_missing_origin",
        };
    }
    if (normalizedRequestOrigin !== null &&
        normalizedOrigin === normalizedRequestOrigin) {
        return {
            allowed: true,
            normalizedOrigin,
            reason: "allowed_same_origin",
        };
    }
    if (args.allowedOrigins.includes(normalizedOrigin)) {
        return {
            allowed: true,
            normalizedOrigin,
            reason: "allowed_allowlisted_origin",
        };
    }
    return {
        allowed: false,
        auditEvent: (0, audit_1.buildBlockedOriginEvent)({
            allowedOrigins: args.allowedOrigins,
            method: normalizedMethod,
            origin: normalizedOrigin,
            path: args.path,
            requestOrigin: normalizedRequestOrigin ?? undefined,
        }),
        normalizedOrigin,
        reason: "blocked_disallowed_origin",
    };
}
exports.evaluateOriginPolicy = evaluateOriginPolicy;
