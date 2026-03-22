"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePlatformAdminRisk = exports.fingerprintPlatformAdminRequestContext = exports.sha256Hex = void 0;
async function sha256Hex(value) {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
        .map((part) => part.toString(16).padStart(2, "0"))
        .join("");
}
exports.sha256Hex = sha256Hex;
async function fingerprintPlatformAdminRequestContext(context) {
    return {
        country: context.country ?? null,
        ipHash: context.ipAddress ? await sha256Hex(context.ipAddress) : null,
        userAgentHash: context.userAgent
            ? await sha256Hex(context.userAgent)
            : null,
    };
}
exports.fingerprintPlatformAdminRequestContext = fingerprintPlatformAdminRequestContext;
async function evaluatePlatformAdminRisk(args) {
    if (!args.baseline) {
        return {
            level: "normal",
            reasons: [],
        };
    }
    const reasons = [];
    if (args.baseline.country &&
        args.current.country &&
        args.baseline.country !== args.current.country) {
        reasons.push("country_changed");
    }
    if (args.baseline.ipHash &&
        args.current.ipHash &&
        args.baseline.ipHash !== args.current.ipHash) {
        reasons.push("ip_changed");
    }
    if (args.baseline.userAgentHash &&
        args.current.userAgentHash &&
        args.baseline.userAgentHash !== args.current.userAgentHash) {
        reasons.push("user_agent_changed");
    }
    return {
        level: reasons.length > 0 ? "suspicious" : "normal",
        reasons,
    };
}
exports.evaluatePlatformAdminRisk = evaluatePlatformAdminRisk;
