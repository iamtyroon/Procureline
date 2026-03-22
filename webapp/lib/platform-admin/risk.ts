import type {
    PlatformAdminRiskLevel,
    PlatformAdminRiskReason,
} from "./auth";

export interface PlatformAdminRiskFingerprint {
    country?: string | null;
    ipHash?: string | null;
    userAgentHash?: string | null;
}

export interface PlatformAdminRequestContext {
    city?: string | null;
    country?: string | null;
    ipAddress?: string | null;
    region?: string | null;
    userAgent?: string | null;
}

export async function sha256Hex(value: string): Promise<string> {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
        .map((part) => part.toString(16).padStart(2, "0"))
        .join("");
}

export async function fingerprintPlatformAdminRequestContext(
    context: PlatformAdminRequestContext,
): Promise<PlatformAdminRiskFingerprint> {
    return {
        country: context.country ?? null,
        ipHash: context.ipAddress ? await sha256Hex(context.ipAddress) : null,
        userAgentHash: context.userAgent
            ? await sha256Hex(context.userAgent)
            : null,
    };
}

export async function evaluatePlatformAdminRisk(args: {
    baseline: PlatformAdminRiskFingerprint | null;
    current: PlatformAdminRiskFingerprint;
}): Promise<{
    level: PlatformAdminRiskLevel;
    reasons: PlatformAdminRiskReason[];
}> {
    if (!args.baseline) {
        return {
            level: "normal",
            reasons: [],
        };
    }

    const reasons: PlatformAdminRiskReason[] = [];

    if (
        args.baseline.country &&
        args.current.country &&
        args.baseline.country !== args.current.country
    ) {
        reasons.push("country_changed");
    }

    if (
        args.baseline.ipHash &&
        args.current.ipHash &&
        args.baseline.ipHash !== args.current.ipHash
    ) {
        reasons.push("ip_changed");
    }

    if (
        args.baseline.userAgentHash &&
        args.current.userAgentHash &&
        args.baseline.userAgentHash !== args.current.userAgentHash
    ) {
        reasons.push("user_agent_changed");
    }

    return {
        level: reasons.length > 0 ? "suspicious" : "normal",
        reasons,
    };
}
