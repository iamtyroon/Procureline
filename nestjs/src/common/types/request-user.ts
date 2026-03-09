import type { ProcurelineRole, ServiceTokenClaims } from "@/common/constants/service-auth";

export interface RequestUser extends Pick<ServiceTokenClaims, "jti" | "sub" | "tenantId"> {
  role: ProcurelineRole;
}
