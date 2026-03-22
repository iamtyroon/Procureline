export const PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_ENV_NAME =
    "PA_DASH_ACCESS_TOKEN_SECRET" as const;
export const DEVELOPMENT_PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_SECRET =
    "dev-platform-admin-dashboard-access-token-secret" as const;
export const PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_TTL_MS =
    1000 * 60 * 60 * 8;

interface PlatformAdminDashboardAccessTokenEnvelope {
    expiresAt: number;
    issuedAt: number;
    userId: string;
}

function encodeBytesBase64Url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...Array.from(bytes)))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

function encodeTextBase64Url(value: string): string {
    return encodeBytesBase64Url(new TextEncoder().encode(value));
}

function decodeBase64Url(value: string): string {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const paddingLength = normalized.length % 4;
    const padded =
        paddingLength === 0
            ? normalized
            : `${normalized}${"=".repeat(4 - paddingLength)}`;

    return atob(padded);
}

async function signSegment(segment: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        {
            name: "HMAC",
            hash: "SHA-256",
        },
        false,
        ["sign"],
    );

    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(segment),
    );

    return encodeBytesBase64Url(new Uint8Array(signature));
}

export function resolvePlatformAdminDashboardAccessTokenSecret(args?: {
    secret?: string | undefined;
}): string {
    const secret =
        args?.secret ??
        process.env[PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_ENV_NAME];

    if (typeof secret === "string" && secret.trim().length > 0) {
        return secret.trim();
    }

    return DEVELOPMENT_PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_SECRET;
}

export async function createPlatformAdminDashboardReadAccessToken(args: {
    now?: number;
    secret?: string;
    userId: string;
}): Promise<string> {
    const issuedAt = args.now ?? Date.now();
    const envelope: PlatformAdminDashboardAccessTokenEnvelope = {
        expiresAt: issuedAt + PLATFORM_ADMIN_DASHBOARD_ACCESS_TOKEN_TTL_MS,
        issuedAt,
        userId: args.userId,
    };
    const encodedPayload = encodeTextBase64Url(JSON.stringify(envelope));
    const signature = await signSegment(
        encodedPayload,
        args.secret ?? resolvePlatformAdminDashboardAccessTokenSecret(),
    );

    return `${encodedPayload}.${signature}`;
}

export async function verifyPlatformAdminDashboardReadAccessToken(args: {
    now?: number;
    secret?: string;
    token: string;
    userId: string;
}): Promise<
    | {
          ok: true;
      }
    | {
          ok: false;
          reason: "expired" | "invalid";
      }
> {
    const [encodedPayload, providedSignature] = args.token.split(".");

    if (!encodedPayload || !providedSignature) {
        return {
            ok: false,
            reason: "invalid",
        };
    }

    const expectedSignature = await signSegment(
        encodedPayload,
        args.secret ?? resolvePlatformAdminDashboardAccessTokenSecret(),
    );
    if (providedSignature !== expectedSignature) {
        return {
            ok: false,
            reason: "invalid",
        };
    }

    try {
        const envelope = JSON.parse(
            decodeBase64Url(encodedPayload),
        ) as PlatformAdminDashboardAccessTokenEnvelope;
        const now = args.now ?? Date.now();

        if (
            typeof envelope.issuedAt !== "number" ||
            typeof envelope.expiresAt !== "number" ||
            typeof envelope.userId !== "string"
        ) {
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
    } catch {
        return {
            ok: false,
            reason: "invalid",
        };
    }
}
