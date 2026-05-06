"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySignedDepartmentUserRequestContext = exports.verifySignedDepartmentUserRequestContextToken = exports.createSignedDepartmentUserRequestContextToken = exports.resolveDepartmentUserRequestContextTokenSecret = exports.DepartmentUserRequestContextSignatureError = exports.DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_TTL_MS = exports.DEVELOPMENT_DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_SECRET = exports.DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_ENV_NAME = void 0;
exports.DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_ENV_NAME = "DEPARTMENT_USER_CTX_TOKEN_SECRET";
exports.DEVELOPMENT_DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_SECRET = "dev-department-user-request-context-token-secret";
exports.DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_TTL_MS = 1000 * 60 * 15;
class DepartmentUserRequestContextSignatureError extends Error {
    constructor(message) {
        super(message);
        this.name = "DepartmentUserRequestContextSignatureError";
    }
}
exports.DepartmentUserRequestContextSignatureError = DepartmentUserRequestContextSignatureError;
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
function resolveDepartmentUserRequestContextTokenNodeEnv(nodeEnv) {
    if (typeof nodeEnv === "string") {
        return nodeEnv;
    }
    return typeof process.env.NODE_ENV === "string"
        ? process.env.NODE_ENV
        : "development";
}
function resolveDepartmentUserRequestContextTokenSecret(args) {
    const secret = args?.secret ??
        process.env[exports.DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_ENV_NAME];
    const nodeEnv = resolveDepartmentUserRequestContextTokenNodeEnv(args?.nodeEnv);
    if (typeof secret === "string" && secret.trim().length > 0) {
        return secret.trim();
    }
    if (nodeEnv === "development") {
        console.warn(`resolveDepartmentUserRequestContextTokenSecret is falling back to ${exports.DEVELOPMENT_DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_SECRET} because ${exports.DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_ENV_NAME} is not configured in development.`);
        return exports.DEVELOPMENT_DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_SECRET;
    }
    throw new Error(`resolveDepartmentUserRequestContextTokenSecret requires ${exports.DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_ENV_NAME} outside development.`);
}
exports.resolveDepartmentUserRequestContextTokenSecret = resolveDepartmentUserRequestContextTokenSecret;
async function createSignedDepartmentUserRequestContextToken(args) {
    const issuedAt = args.now ?? Date.now();
    const envelope = {
        context: args.context,
        expiresAt: issuedAt + exports.DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_TTL_MS,
        issuedAt,
    };
    const encodedPayload = encodeTextBase64Url(JSON.stringify(envelope));
    const signature = await signSegment(encodedPayload, args.secret ?? resolveDepartmentUserRequestContextTokenSecret());
    return `${encodedPayload}.${signature}`;
}
exports.createSignedDepartmentUserRequestContextToken = createSignedDepartmentUserRequestContextToken;
async function verifySignedDepartmentUserRequestContextToken(args) {
    const [encodedPayload, providedSignature] = args.token.split(".");
    if (!encodedPayload || !providedSignature) {
        return {
            ok: false,
            reason: "invalid",
        };
    }
    const expectedSignature = await signSegment(encodedPayload, args.secret ?? resolveDepartmentUserRequestContextTokenSecret());
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
exports.verifySignedDepartmentUserRequestContextToken = verifySignedDepartmentUserRequestContextToken;
async function verifySignedDepartmentUserRequestContext(token) {
    const result = await verifySignedDepartmentUserRequestContextToken({ token });
    if (!result.ok) {
        throw new DepartmentUserRequestContextSignatureError(result.reason === "expired"
            ? "Department User sign-in context expired. Refresh the page and try again."
            : "Department User sign-in context could not be verified.");
    }
    return result.value;
}
exports.verifySignedDepartmentUserRequestContext = verifySignedDepartmentUserRequestContext;
