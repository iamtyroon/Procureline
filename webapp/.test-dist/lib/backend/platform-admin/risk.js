"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePlatformAdminRisk = exports.fingerprintPlatformAdminRequestContext = exports.sha256Hex = exports.DEVELOPMENT_PLATFORM_ADMIN_RISK_HASH_SALT = exports.PLATFORM_ADMIN_RISK_HASH_SALT_ENV_NAME = void 0;
exports.PLATFORM_ADMIN_RISK_HASH_SALT_ENV_NAME = "IP_HASH_SALT";
exports.DEVELOPMENT_PLATFORM_ADMIN_RISK_HASH_SALT = "dev-platform-admin-risk-hash-salt";
function hasNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function resolvePlatformAdminRiskHashSalt(args) {
    const secretSalt = args?.secretSalt ?? process.env[exports.PLATFORM_ADMIN_RISK_HASH_SALT_ENV_NAME];
    const nodeEnv = typeof args?.nodeEnv === "string"
        ? args.nodeEnv
        : typeof process.env.NODE_ENV === "string"
            ? process.env.NODE_ENV
            : "development";
    if (typeof secretSalt === "string" && secretSalt.trim().length > 0) {
        return secretSalt.trim();
    }
    if (nodeEnv === "development") {
        return exports.DEVELOPMENT_PLATFORM_ADMIN_RISK_HASH_SALT;
    }
    throw new Error(`${exports.PLATFORM_ADMIN_RISK_HASH_SALT_ENV_NAME} must be configured before hashing Platform Admin request fingerprints outside development.`);
}
function isPlatformAdminRequestContextObject(context) {
    return Boolean(context) && typeof context === "object" && !Array.isArray(context);
}
function isPlatformAdminPiiHashingAllowed(context) {
    return context.consentFlag === true || context.isPIIAllowed === true;
}
async function sha256Hex(value, args) {
    const normalizedValue = typeof args?.secretSalt === "string" && args.secretSalt.trim().length > 0
        ? `${args.secretSalt.trim()}:${value}`
        : value;
    const encoded = new TextEncoder().encode(normalizedValue);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
        .map((part) => part.toString(16).padStart(2, "0"))
        .join("");
}
exports.sha256Hex = sha256Hex;
/**
 * Fingerprints Platform Admin request context only when PII hashing consent is
 * explicitly present. Without consent, country is preserved and PII-derived
 * hashes are omitted.
 */
async function fingerprintPlatformAdminRequestContext(context) {
    if (!isPlatformAdminRequestContextObject(context)) {
        return {
            country: null,
            ipHash: null,
            userAgentHash: null,
        };
    }
    const country = hasNonEmptyString(context.country) ? context.country.trim() : null;
    if (!isPlatformAdminPiiHashingAllowed(context)) {
        return {
            country,
            ipHash: null,
            userAgentHash: null,
        };
    }
    const secretSalt = resolvePlatformAdminRiskHashSalt();
    return {
        country,
        ipHash: hasNonEmptyString(context.ipAddress)
            ? await sha256Hex(context.ipAddress.trim(), { secretSalt })
            : null,
        userAgentHash: hasNonEmptyString(context.userAgent)
            ? await sha256Hex(context.userAgent.trim(), {
                secretSalt,
            })
            : null,
    };
}
exports.fingerprintPlatformAdminRequestContext = fingerprintPlatformAdminRequestContext;
async function evaluatePlatformAdminRisk(args) {
    if (!args.baseline || !args.current) {
        return {
            level: "normal",
            reasons: [],
        };
    }
    const reasons = [];
    if (args.baseline.country &&
        args.baseline.country !== args.current.country) {
        reasons.push("country_changed");
    }
    if (args.baseline.ipHash &&
        args.baseline.ipHash !== args.current.ipHash) {
        reasons.push("ip_changed");
    }
    if (args.baseline.userAgentHash &&
        args.baseline.userAgentHash !== args.current.userAgentHash) {
        reasons.push("user_agent_changed");
    }
    return {
        level: reasons.length > 0 ? "suspicious" : "normal",
        reasons,
    };
}
exports.evaluatePlatformAdminRisk = evaluatePlatformAdminRisk;
