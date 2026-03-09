/**
 * Service-to-service JWT constants shared between the NestJS microservice and
 * the Convex webapp. These values are duplicated in
 * `webapp/lib/services/procureline-service-auth.ts` and MUST be kept in sync.
 * A future shared-packages workspace would de-duplicate them.
 */
export const PROCURELINE_SERVICE_JWT_ISSUER = "procureline.webapp";
export const PROCURELINE_SERVICE_JWT_AUDIENCE = "procureline.nestjs";
export const PROCURELINE_SERVICE_JWT_TYPE = "service";
export const PROCURELINE_SERVICE_JWT_EXPIRY_SECONDS = 300;

export type ProcurelineRole =
  | "platform_admin"
  | "tenant_admin"
  | "procurement_officer"
  | "department_user"
  | "unassigned";

export interface ServiceTokenClaims {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  role: ProcurelineRole;
  sub: string;
  tenantId?: string;
  type: typeof PROCURELINE_SERVICE_JWT_TYPE;
}
