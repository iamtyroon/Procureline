"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSecurityAuditProxyToken = exports.SecurityAuditProxyConfigurationError = exports.DEVELOPMENT_SECURITY_AUDIT_PROXY_TOKEN = exports.SECURITY_AUDIT_PROXY_TOKEN_ENV_NAME = void 0;
exports.SECURITY_AUDIT_PROXY_TOKEN_ENV_NAME = "SECURITY_AUDIT_PROXY_TOKEN";
exports.DEVELOPMENT_SECURITY_AUDIT_PROXY_TOKEN = "dev-security-audit-token";
class SecurityAuditProxyConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = "SecurityAuditProxyConfigurationError";
    }
}
exports.SecurityAuditProxyConfigurationError = SecurityAuditProxyConfigurationError;
function resolveSecurityAuditProxyToken(args) {
    const token = args?.token ?? process.env.SECURITY_AUDIT_PROXY_TOKEN;
    const nodeEnv = typeof args?.nodeEnv === "string"
        ? args.nodeEnv
        : typeof process.env.NODE_ENV === "string"
            ? process.env.NODE_ENV
            : "development";
    if (typeof token === "string" && token.trim().length > 0) {
        return token.trim();
    }
    if (nodeEnv === "development" || nodeEnv === "test") {
        return exports.DEVELOPMENT_SECURITY_AUDIT_PROXY_TOKEN;
    }
    throw new SecurityAuditProxyConfigurationError(`${exports.SECURITY_AUDIT_PROXY_TOKEN_ENV_NAME} must be configured outside development`);
}
exports.resolveSecurityAuditProxyToken = resolveSecurityAuditProxyToken;
