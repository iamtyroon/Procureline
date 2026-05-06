import {
    buildBlockedOriginEvent,
    type AuditEventEntry,
} from "@/lib/shared/security/audit";

export const ALLOWED_ORIGINS_ENV_NAME = "ALLOWED_ORIGINS" as const;
export const DEVELOPMENT_ALLOWED_ORIGINS = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
] as const;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class AllowedOriginsConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AllowedOriginsConfigurationError";
    }
}

export interface AllowedOriginsConfig {
    origins: string[];
    source: "development-defaults" | "env";
}

export interface OriginPolicyDecision {
    allowed: boolean;
    auditEvent?: AuditEventEntry;
    reason:
        | "allowed_allowlisted_origin"
        | "allowed_missing_origin_allowlisted_request"
        | "allowed_missing_origin"
        | "allowed_same_origin"
        | "blocked_disallowed_origin"
        | "blocked_missing_origin";
    normalizedOrigin?: string;
}

function normalizeOrigin(origin: string): string | null {
    try {
        const parsed = new URL(origin.trim());
        if (!/^https?:$/.test(parsed.protocol)) {
            return null;
        }

        return `${parsed.protocol}//${parsed.host}`.toLowerCase();
    } catch {
        return null;
    }
}

export function resolveAllowedOrigins(args?: {
    allowedOrigins?: string | undefined;
    nodeEnv?: string | undefined;
}): AllowedOriginsConfig {
    const rawAllowedOrigins = args?.allowedOrigins ?? process.env.ALLOWED_ORIGINS;
    const nodeEnv =
        typeof args?.nodeEnv === "string"
            ? args.nodeEnv
            : typeof process.env.NODE_ENV === "string"
                ? process.env.NODE_ENV
                : "development";
    const parsedOrigins = rawAllowedOrigins
        ?.split(",")
        .map((origin) => normalizeOrigin(origin))
        .filter((origin): origin is string => origin !== null);

    if (parsedOrigins && parsedOrigins.length > 0) {
        return {
            origins: Array.from(new Set(parsedOrigins)).sort(),
            source: "env",
        };
    }

    if (nodeEnv === "development" || nodeEnv === "test") {
        return {
            origins: [...DEVELOPMENT_ALLOWED_ORIGINS],
            source: "development-defaults",
        };
    }

    throw new AllowedOriginsConfigurationError(
        `${ALLOWED_ORIGINS_ENV_NAME} must be configured outside development`,
    );
}

export function evaluateOriginPolicy(args: {
    allowedOrigins: readonly string[];
    method: string;
    originHeader?: string | null;
    path: string;
    requestOrigin?: string | null;
}): OriginPolicyDecision {
    const normalizedRequestOrigin =
        args.requestOrigin !== undefined && args.requestOrigin !== null
            ? normalizeOrigin(args.requestOrigin)
            : null;
    const normalizedOrigin =
        args.originHeader !== undefined && args.originHeader !== null
            ? normalizeOrigin(args.originHeader)
            : null;
    const normalizedMethod = args.method.toUpperCase();

    if (!normalizedOrigin) {
        const requestIsAllowlisted =
            normalizedRequestOrigin !== null &&
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
            auditEvent: buildBlockedOriginEvent({
                allowedOrigins: args.allowedOrigins,
                method: normalizedMethod,
                path: args.path,
                requestOrigin: normalizedRequestOrigin ?? undefined,
            }),
            reason: "blocked_missing_origin",
        };
    }

    if (
        normalizedRequestOrigin !== null &&
        normalizedOrigin === normalizedRequestOrigin
    ) {
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
        auditEvent: buildBlockedOriginEvent({
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
