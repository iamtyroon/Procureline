export const SECURITY_AUDIT_PROXY_TOKEN_ENV_NAME =
    "SECURITY_AUDIT_PROXY_TOKEN" as const;
export const DEVELOPMENT_SECURITY_AUDIT_PROXY_TOKEN =
    "dev-security-audit-token" as const;

export class SecurityAuditProxyConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SecurityAuditProxyConfigurationError";
    }
}

export function resolveSecurityAuditProxyToken(args?: {
    nodeEnv?: string | undefined;
    token?: string | undefined;
}): string {
    const token = args?.token ?? process.env.SECURITY_AUDIT_PROXY_TOKEN;
    const nodeEnv =
        typeof args?.nodeEnv === "string"
            ? args.nodeEnv
            : typeof process.env.NODE_ENV === "string"
                ? process.env.NODE_ENV
                : "development";

    if (typeof token === "string" && token.trim().length > 0) {
        return token.trim();
    }

    if (nodeEnv === "development" || nodeEnv === "test") {
        return DEVELOPMENT_SECURITY_AUDIT_PROXY_TOKEN;
    }

    throw new SecurityAuditProxyConfigurationError(
        `${SECURITY_AUDIT_PROXY_TOKEN_ENV_NAME} must be configured outside development`,
    );
}
