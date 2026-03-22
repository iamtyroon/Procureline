import type { PlatformAdminRequestContext } from "./risk";

export const PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_ENV_NAME =
    "PLATFORM_ADMIN_CTX_TOKEN_SECRET" as const;
export const DEVELOPMENT_PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_SECRET =
    "dev-platform-admin-request-context-token-secret" as const;
export const PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_TTL_MS =
    1000 * 60 * 15;

interface PlatformAdminRequestContextEnvelope {
    context: PlatformAdminRequestContext;
    expiresAt: number;
    issuedAt: number;
}

export class PlatformAdminRequestContextSignatureError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PlatformAdminRequestContextSignatureError";
    }
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

function constantTimeEqual(left: string, right: string): boolean {
    if (left.length !== right.length) {
        return false;
    }

    let mismatch = 0;

    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }

    return mismatch === 0;
}

function resolvePlatformAdminRequestContextTokenNodeEnv(
    nodeEnv?: string | undefined,
): string {
    if (typeof nodeEnv === "string") {
        return nodeEnv;
    }

    return typeof process.env.NODE_ENV === "string"
        ? process.env.NODE_ENV
        : "development";
}

export function resolvePlatformAdminRequestContextTokenSecret(args?: {
    nodeEnv?: string | undefined;
    secret?: string | undefined;
}): string {
    const secret =
        args?.secret ?? process.env[PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_ENV_NAME];
    const nodeEnv = resolvePlatformAdminRequestContextTokenNodeEnv(
        args?.nodeEnv,
    );

    if (typeof secret === "string" && secret.trim().length > 0) {
        return secret.trim();
    }

    if (nodeEnv === "development") {
        console.warn(
            `resolvePlatformAdminRequestContextTokenSecret is falling back to ${DEVELOPMENT_PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_SECRET} because ${PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_ENV_NAME} is not configured in development.`,
        );
        return DEVELOPMENT_PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_SECRET;
    }

    throw new Error(
        `resolvePlatformAdminRequestContextTokenSecret requires ${PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_ENV_NAME} outside development.`,
    );
}

export async function createSignedPlatformAdminRequestContextToken(args: {
    context: PlatformAdminRequestContext;
    now?: number;
    secret?: string;
}): Promise<string> {
    const issuedAt = args.now ?? Date.now();
    const envelope: PlatformAdminRequestContextEnvelope = {
        context: args.context,
        expiresAt: issuedAt + PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_TTL_MS,
        issuedAt,
    };
    const encodedPayload = encodeTextBase64Url(JSON.stringify(envelope));
    const signature = await signSegment(
        encodedPayload,
        args.secret ?? resolvePlatformAdminRequestContextTokenSecret(),
    );

    return `${encodedPayload}.${signature}`;
}

export async function verifySignedPlatformAdminRequestContextToken(args: {
    now?: number;
    secret?: string;
    token: string;
}): Promise<
    | {
          ok: true;
          value: PlatformAdminRequestContext;
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
        args.secret ?? resolvePlatformAdminRequestContextTokenSecret(),
    );
    if (!constantTimeEqual(providedSignature, expectedSignature)) {
        return {
            ok: false,
            reason: "invalid",
        };
    }

    try {
        const envelope = JSON.parse(
            decodeBase64Url(encodedPayload),
        ) as PlatformAdminRequestContextEnvelope;
        const now = args.now ?? Date.now();

        if (
            typeof envelope.issuedAt !== "number" ||
            typeof envelope.expiresAt !== "number" ||
            typeof envelope.context !== "object" ||
            envelope.context === null ||
            Array.isArray(envelope.context)
        ) {
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
            value: envelope.context,
        };
    } catch {
        return {
            ok: false,
            reason: "invalid",
        };
    }
}

export async function signPlatformAdminRequestContext(
    context: PlatformAdminRequestContext,
): Promise<string> {
    return await createSignedPlatformAdminRequestContextToken({
        context,
    });
}

export async function verifySignedPlatformAdminRequestContext(
    token: string,
): Promise<PlatformAdminRequestContext> {
    const result = await verifySignedPlatformAdminRequestContextToken({ token });

    if (!result.ok) {
        throw new PlatformAdminRequestContextSignatureError(
            result.reason === "expired"
                ? "Platform Admin sign-in context expired. Refresh the page and try again."
                : "Platform Admin sign-in context could not be verified.",
        );
    }

    return result.value;
}
