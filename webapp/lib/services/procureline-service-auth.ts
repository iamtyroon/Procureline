export const PROCURELINE_SERVICE_JWT_ISSUER = "procureline.webapp" as const;
export const PROCURELINE_SERVICE_JWT_AUDIENCE = "procureline.nestjs" as const;
export const PROCURELINE_SERVICE_JWT_TYPE = "service" as const;
export const PROCURELINE_SERVICE_JWT_EXPIRY_SECONDS = 300 as const;
export const DEVELOPMENT_PROCURELINE_CONVEX_SYNC_SECRET =
  "dev-procureline-convex-sync-secret" as const;

export type ProcurelineServiceRole =
  | "platform_admin"
  | "tenant_admin"
  | "procurement_officer"
  | "department_user"
  | "unassigned";

export interface ProcurelineServiceTokenClaims {
  aud: typeof PROCURELINE_SERVICE_JWT_AUDIENCE;
  exp: number;
  iat: number;
  iss: typeof PROCURELINE_SERVICE_JWT_ISSUER;
  jti: string;
  role: ProcurelineServiceRole;
  sub: string;
  tenantId?: string;
  type: typeof PROCURELINE_SERVICE_JWT_TYPE;
}

export class ProcurelineServiceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcurelineServiceConfigurationError";
  }
}

function encodeBase64Url(input: string): string {
  return btoa(input)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function encodeBytesBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
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

export function resolveProcurelineServiceJwtSecret(args?: {
  nodeEnv?: string | undefined;
  secret?: string | undefined;
}): string {
  const secret = args?.secret ?? process.env.PROCURELINE_SERVICE_JWT_SECRET;
  if (typeof secret === "string" && secret.trim().length > 0) {
    return secret.trim();
  }

  throw new ProcurelineServiceConfigurationError(
    "PROCURELINE_SERVICE_JWT_SECRET must be configured for Convex-to-NestJS service calls",
  );
}

export function resolveNestjsUrl(args?: {
  nodeEnv?: string | undefined;
  url?: string | undefined;
}): string {
  const url = args?.url ?? process.env.NESTJS_URL;
  if (typeof url === "string" && url.trim().length > 0) {
    return url.replace(/\/+$/, "");
  }

  throw new ProcurelineServiceConfigurationError(
    "NESTJS_URL must be configured for Convex-to-NestJS service calls",
  );
}

export function resolveProcurelineConvexSyncSecret(args?: {
  nodeEnv?: string | undefined;
  secret?: string | undefined;
}): string {
  const secret = args?.secret ?? process.env.PROCURELINE_CONVEX_SYNC_SECRET;
  const nodeEnv =
    typeof args?.nodeEnv === "string"
      ? args.nodeEnv
      : typeof process.env.NODE_ENV === "string"
        ? process.env.NODE_ENV
        : "development";

  if (typeof secret === "string" && secret.trim().length > 0) {
    return secret.trim();
  }

  if (nodeEnv === "development" || nodeEnv === "test") {
    return DEVELOPMENT_PROCURELINE_CONVEX_SYNC_SECRET;
  }

  throw new ProcurelineServiceConfigurationError(
    "PROCURELINE_CONVEX_SYNC_SECRET must be configured outside development",
  );
}

export async function createProcurelineServiceToken(args: {
  expiresInSeconds?: number;
  issuedAtSeconds?: number;
  jti?: string;
  role: ProcurelineServiceRole;
  secret?: string;
  tenantId?: string;
  userId: string;
}): Promise<string> {
  const issuedAtSeconds = args.issuedAtSeconds ?? Math.floor(Date.now() / 1000);
  const claims: ProcurelineServiceTokenClaims = {
    aud: PROCURELINE_SERVICE_JWT_AUDIENCE,
    exp: issuedAtSeconds + (args.expiresInSeconds ?? PROCURELINE_SERVICE_JWT_EXPIRY_SECONDS),
    iat: issuedAtSeconds,
    iss: PROCURELINE_SERVICE_JWT_ISSUER,
    jti: args.jti ?? crypto.randomUUID(),
    role: args.role,
    sub: args.userId,
    tenantId: args.tenantId,
    type: PROCURELINE_SERVICE_JWT_TYPE,
  };

  const encodedHeader = encodeBase64Url(
    JSON.stringify({
      alg: "HS256",
      typ: "JWT",
    }),
  );
  const encodedPayload = encodeBase64Url(JSON.stringify(claims));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = await signSegment(
    unsignedToken,
    args.secret ?? resolveProcurelineServiceJwtSecret(),
  );

  return `${unsignedToken}.${signature}`;
}

export function buildProcurelineServiceHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}
