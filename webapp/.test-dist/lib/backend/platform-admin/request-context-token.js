"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySignedPlatformAdminRequestContext = exports.signPlatformAdminRequestContext = exports.verifySignedPlatformAdminRequestContextToken = exports.createSignedPlatformAdminRequestContextToken = exports.resolvePlatformAdminRequestContextTokenSecret = exports.PlatformAdminRequestContextSignatureError = exports.PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_TTL_MS = exports.DEVELOPMENT_PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_SECRET = exports.PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_ENV_NAME = void 0;
exports.PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_ENV_NAME = "PLATFORM_ADMIN_CTX_TOKEN_SECRET";
exports.DEVELOPMENT_PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_SECRET = "dev-platform-admin-request-context-token-secret";
exports.PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_TTL_MS = 1000 * 60 * 15;
class PlatformAdminRequestContextSignatureError extends Error {
    constructor(message) {
        super(message);
        this.name = "PlatformAdminRequestContextSignatureError";
    }
}
exports.PlatformAdminRequestContextSignatureError = PlatformAdminRequestContextSignatureError;
function encodeBytesBase64Url(bytes) {
    return btoa(String.fromCharCode(...Array.from(bytes)))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}
function encodeTextBase64Url(value) {
    return encodeBytesBase64Url(new TextEncoder().encode(value));
}
function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const paddingLength = normalized.length % 4;
    const padded = paddingLength === 0
        ? normalized
        : `${normalized}${"=".repeat(4 - paddingLength)}`;
    return atob(padded);
}
async function signSegment(segment, secret) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
        name: "HMAC",
        hash: "SHA-256",
    }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(segment));
    return encodeBytesBase64Url(new Uint8Array(signature));
}
function constantTimeEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }
    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return mismatch === 0;
}
function resolvePlatformAdminRequestContextTokenNodeEnv(nodeEnv) {
    if (typeof nodeEnv === "string") {
        return nodeEnv;
    }
    return typeof process.env.NODE_ENV === "string"
        ? process.env.NODE_ENV
        : "development";
}
function resolvePlatformAdminRequestContextTokenSecret(args) {
    const secret = args?.secret ?? process.env[exports.PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_ENV_NAME];
    const nodeEnv = resolvePlatformAdminRequestContextTokenNodeEnv(args?.nodeEnv);
    if (typeof secret === "string" && secret.trim().length > 0) {
        return secret.trim();
    }
    if (nodeEnv === "development") {
        console.warn(`resolvePlatformAdminRequestContextTokenSecret is falling back to ${exports.DEVELOPMENT_PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_SECRET} because ${exports.PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_ENV_NAME} is not configured in development.`);
        return exports.DEVELOPMENT_PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_SECRET;
    }
    throw new Error(`resolvePlatformAdminRequestContextTokenSecret requires ${exports.PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_ENV_NAME} outside development.`);
}
exports.resolvePlatformAdminRequestContextTokenSecret = resolvePlatformAdminRequestContextTokenSecret;
async function createSignedPlatformAdminRequestContextToken(args) {
    const issuedAt = args.now ?? Date.now();
    const envelope = {
        context: args.context,
        expiresAt: issuedAt + exports.PLATFORM_ADMIN_REQUEST_CONTEXT_TOKEN_TTL_MS,
        issuedAt,
    };
    const encodedPayload = encodeTextBase64Url(JSON.stringify(envelope));
    const signature = await signSegment(encodedPayload, args.secret ?? resolvePlatformAdminRequestContextTokenSecret());
    return `${encodedPayload}.${signature}`;
}
exports.createSignedPlatformAdminRequestContextToken = createSignedPlatformAdminRequestContextToken;
async function verifySignedPlatformAdminRequestContextToken(args) {
    const [encodedPayload, providedSignature] = args.token.split(".");
    if (!encodedPayload || !providedSignature) {
        return {
            ok: false,
            reason: "invalid",
        };
    }
    const expectedSignature = await signSegment(encodedPayload, args.secret ?? resolvePlatformAdminRequestContextTokenSecret());
    if (!constantTimeEqual(providedSignature, expectedSignature)) {
        return {
            ok: false,
            reason: "invalid",
        };
    }
    try {
        const envelope = JSON.parse(decodeBase64Url(encodedPayload));
        const now = args.now ?? Date.now();
        if (typeof envelope.issuedAt !== "number" ||
            typeof envelope.expiresAt !== "number" ||
            typeof envelope.context !== "object" ||
            envelope.context === null ||
            Array.isArray(envelope.context)) {
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
    }
    catch {
        return {
            ok: false,
            reason: "invalid",
        };
    }
}
exports.verifySignedPlatformAdminRequestContextToken = verifySignedPlatformAdminRequestContextToken;
async function signPlatformAdminRequestContext(context) {
    return await createSignedPlatformAdminRequestContextToken({
        context,
    });
}
exports.signPlatformAdminRequestContext = signPlatformAdminRequestContext;
async function verifySignedPlatformAdminRequestContext(token) {
    const result = await verifySignedPlatformAdminRequestContextToken({ token });
    if (!result.ok) {
        throw new PlatformAdminRequestContextSignatureError(result.reason === "expired"
            ? "Platform Admin sign-in context expired. Refresh the page and try again."
            : "Platform Admin sign-in context could not be verified.");
    }
    return result.value;
}
exports.verifySignedPlatformAdminRequestContext = verifySignedPlatformAdminRequestContext;
