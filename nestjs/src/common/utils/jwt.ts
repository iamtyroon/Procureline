import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PROCURELINE_SERVICE_JWT_AUDIENCE,
  PROCURELINE_SERVICE_JWT_ISSUER,
  PROCURELINE_SERVICE_JWT_TYPE,
  type ServiceTokenClaims,
} from "@/common/constants/service-auth";

interface JwtHeader {
  alg: "HS256";
  typ: "JWT";
}

function encodeBase64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function signSegment(segment: string, secret: string): string {
  return encodeBase64Url(createHmac("sha256", secret).update(segment).digest());
}

export class JwtValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtValidationError";
  }
}

export function signServiceToken(claims: ServiceTokenClaims, secret: string): string {
  const header: JwtHeader = {
    alg: "HS256",
    typ: "JWT",
  };

  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(claims));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = signSegment(unsignedToken, secret);
  return `${unsignedToken}.${signature}`;
}

export function verifyServiceToken(token: string, secret: string): ServiceTokenClaims {
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new JwtValidationError("Malformed service token");
  }

  const encodedHeader = segments[0]!;
  const encodedPayload = segments[1]!;
  const signature = segments[2]!;
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = signSegment(unsignedToken, secret);

  if (
    Buffer.byteLength(signature) !== Buffer.byteLength(expectedSignature) ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    throw new JwtValidationError("Invalid service token signature");
  }

  const header = JSON.parse(decodeBase64Url(encodedHeader).toString("utf8")) as Partial<JwtHeader>;
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new JwtValidationError("Unsupported service token header");
  }

  const claims = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8")) as Partial<ServiceTokenClaims>;
  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (claims.type !== PROCURELINE_SERVICE_JWT_TYPE) {
    throw new JwtValidationError("Unsupported service token type");
  }
  if (claims.iss !== PROCURELINE_SERVICE_JWT_ISSUER) {
    throw new JwtValidationError("Unexpected service token issuer");
  }
  if (claims.aud !== PROCURELINE_SERVICE_JWT_AUDIENCE) {
    throw new JwtValidationError("Unexpected service token audience");
  }
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new JwtValidationError("Service token subject is missing");
  }
  if (typeof claims.role !== "string" || claims.role.length === 0) {
    throw new JwtValidationError("Service token role is missing");
  }
  if (typeof claims.exp !== "number" || claims.exp <= nowInSeconds) {
    throw new JwtValidationError("Service token has expired");
  }
  if (typeof claims.iat !== "number" || claims.iat > nowInSeconds + 5) {
    throw new JwtValidationError("Service token issue time is invalid");
  }
  if (typeof claims.jti !== "string" || claims.jti.length === 0) {
    throw new JwtValidationError("Service token ID is missing");
  }

  return claims as ServiceTokenClaims;
}
