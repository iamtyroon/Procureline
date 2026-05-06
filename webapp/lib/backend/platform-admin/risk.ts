import type {
    PlatformAdminRiskLevel,
    PlatformAdminRiskReason,
} from "../../shared/platform-admin/auth";

export interface PlatformAdminRiskFingerprint {
    country?: string | null;
    ipHash?: string | null;
    userAgentHash?: string | null;
}

export interface PlatformAdminRequestContext {
    city?: string | null;
    consentFlag?: boolean | null;
    country?: string | null;
    ipAddress?: string | null;
    isPIIAllowed?: boolean | null;
    region?: string | null;
    userAgent?: string | null;
}

export const PLATFORM_ADMIN_RISK_HASH_SALT_ENV_NAME = "IP_HASH_SALT" as const;
export const DEVELOPMENT_PLATFORM_ADMIN_RISK_HASH_SALT =
    "dev-platform-admin-risk-hash-salt" as const;

function hasNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function resolvePlatformAdminRiskHashSalt(args?: {
    nodeEnv?: string | undefined;
    secretSalt?: string | undefined;
}): string {
    const secretSalt =
        args?.secretSalt ?? process.env[PLATFORM_ADMIN_RISK_HASH_SALT_ENV_NAME];
    const nodeEnv =
        typeof args?.nodeEnv === "string"
            ? args.nodeEnv
            : typeof process.env.NODE_ENV === "string"
                ? process.env.NODE_ENV
                : "development";

    if (typeof secretSalt === "string" && secretSalt.trim().length > 0) {
        return secretSalt.trim();
    }

    if (nodeEnv === "development") {
        return DEVELOPMENT_PLATFORM_ADMIN_RISK_HASH_SALT;
    }

    throw new Error(
        `${PLATFORM_ADMIN_RISK_HASH_SALT_ENV_NAME} must be configured before hashing Platform Admin request fingerprints outside development.`,
    );
}

function isPlatformAdminRequestContextObject(
    context: PlatformAdminRequestContext | null | undefined,
): context is PlatformAdminRequestContext {
    return Boolean(context) && typeof context === "object" && !Array.isArray(context);
}

function isPlatformAdminPiiHashingAllowed(
    context: PlatformAdminRequestContext,
): boolean {
    return context.consentFlag === true || context.isPIIAllowed === true;
}

export async function sha256Hex(
    value: string,
    args?: {
        secretSalt?: string | undefined;
    },
): Promise<string> {
    const normalizedValue =
        typeof args?.secretSalt === "string" && args.secretSalt.trim().length > 0
            ? `${args.secretSalt.trim()}:${value}`
            : value;
    const encoded = new TextEncoder().encode(normalizedValue);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
        .map((part) => part.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Fingerprints Platform Admin request context only when PII hashing consent is
 * explicitly present. Without consent, country is preserved and PII-derived
 * hashes are omitted.
 */
export async function fingerprintPlatformAdminRequestContext(
    context: PlatformAdminRequestContext,
): Promise<PlatformAdminRiskFingerprint> {
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

export async function evaluatePlatformAdminRisk(args: {
    baseline: PlatformAdminRiskFingerprint | null;
    current: PlatformAdminRiskFingerprint | null;
}): Promise<{
    level: PlatformAdminRiskLevel;
    reasons: PlatformAdminRiskReason[];
}> {
    if (!args.baseline || !args.current) {
        return {
            level: "normal",
            reasons: [],
        };
    }

    const reasons: PlatformAdminRiskReason[] = [];

    if (
        args.baseline.country &&
        args.baseline.country !== args.current.country
    ) {
        reasons.push("country_changed");
    }

    if (
        args.baseline.ipHash &&
        args.baseline.ipHash !== args.current.ipHash
    ) {
        reasons.push("ip_changed");
    }

    if (
        args.baseline.userAgentHash &&
        args.baseline.userAgentHash !== args.current.userAgentHash
    ) {
        reasons.push("user_agent_changed");
    }

    return {
        level: reasons.length > 0 ? "suspicious" : "normal",
        reasons,
    };
}
