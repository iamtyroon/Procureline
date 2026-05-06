export interface DepartmentUserRequestContext {
    city?: string | null;
    country?: string | null;
    ipAddress?: string | null;
    isPIIAllowed?: boolean | null;
    region?: string | null;
    userAgent?: string | null;
}

export const DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_ENV_NAME =
    "DEPARTMENT_USER_CTX_TOKEN_SECRET" as const;
export const DEVELOPMENT_DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_SECRET =
    "dev-department-user-request-context-token-secret" as const;
export const DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_TTL_MS =
    1000 * 60 * 15;

interface DepartmentUserRequestContextEnvelope {
    context: DepartmentUserRequestContext;
    expiresAt: number;
    issuedAt: number;
}

export class DepartmentUserRequestContextSignatureError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DepartmentUserRequestContextSignatureError";
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

function resolveDepartmentUserRequestContextTokenNodeEnv(
    nodeEnv?: string | undefined,
): string {
    if (typeof nodeEnv === "string") {
        return nodeEnv;
    }

    return typeof process.env.NODE_ENV === "string"
        ? process.env.NODE_ENV
        : "development";
}

export function resolveDepartmentUserRequestContextTokenSecret(args?: {
    nodeEnv?: string | undefined;
    secret?: string | undefined;
}): string {
    const secret =
        args?.secret ??
        process.env[DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_ENV_NAME];
    const nodeEnv = resolveDepartmentUserRequestContextTokenNodeEnv(
        args?.nodeEnv,
    );

    if (typeof secret === "string" && secret.trim().length > 0) {
        return secret.trim();
    }

    if (nodeEnv === "development") {
        console.warn(
            `resolveDepartmentUserRequestContextTokenSecret is falling back to ${DEVELOPMENT_DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_SECRET} because ${DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_ENV_NAME} is not configured in development.`,
        );
        return DEVELOPMENT_DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_SECRET;
    }

    throw new Error(
        `resolveDepartmentUserRequestContextTokenSecret requires ${DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_ENV_NAME} outside development.`,
    );
}

export async function createSignedDepartmentUserRequestContextToken(args: {
    context: DepartmentUserRequestContext;
    now?: number;
    secret?: string;
}): Promise<string> {
    const issuedAt = args.now ?? Date.now();
    const envelope: DepartmentUserRequestContextEnvelope = {
        context: args.context,
        expiresAt: issuedAt + DEPARTMENT_USER_REQUEST_CONTEXT_TOKEN_TTL_MS,
        issuedAt,
    };
    const encodedPayload = encodeTextBase64Url(JSON.stringify(envelope));
    const signature = await signSegment(
        encodedPayload,
        args.secret ?? resolveDepartmentUserRequestContextTokenSecret(),
    );

    return `${encodedPayload}.${signature}`;
}

export async function verifySignedDepartmentUserRequestContextToken(args: {
    now?: number;
    secret?: string;
    token: string;
}): Promise<
    | {
          ok: true;
          value: DepartmentUserRequestContext;
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
        args.secret ?? resolveDepartmentUserRequestContextTokenSecret(),
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
        ) as {
            context?: unknown;
            expiresAt?: unknown;
            issuedAt?: unknown;
        };
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

export async function verifySignedDepartmentUserRequestContext(
    token: string,
): Promise<DepartmentUserRequestContext> {
    const result = await verifySignedDepartmentUserRequestContextToken({ token });

    if (!result.ok) {
        throw new DepartmentUserRequestContextSignatureError(
            result.reason === "expired"
                ? "Department User sign-in context expired. Refresh the page and try again."
                : "Department User sign-in context could not be verified.",
        );
    }

    return result.value;
}
