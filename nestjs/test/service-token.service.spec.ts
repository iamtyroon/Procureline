import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { ServiceTokenService } from "@/auth/service-token.service";
import type { AppConfig } from "@/common/config/app-config";
import {
  PROCURELINE_SERVICE_JWT_AUDIENCE,
  PROCURELINE_SERVICE_JWT_ISSUER,
  PROCURELINE_SERVICE_JWT_TYPE,
} from "@/common/constants/service-auth";
import { signServiceToken } from "@/common/utils/jwt";

describe("ServiceTokenService", () => {
  const secret = "jwt-secret";
  const configService = {
    get: jest.fn().mockReturnValue(secret),
  } as unknown as ConfigService<AppConfig, true>;
  const service = new ServiceTokenService(configService);

  it("accepts a valid Procureline service token", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signServiceToken(
      {
        aud: PROCURELINE_SERVICE_JWT_AUDIENCE,
        exp: now + 300,
        iat: now,
        iss: PROCURELINE_SERVICE_JWT_ISSUER,
        jti: "token-1",
        role: "tenant_admin",
        sub: "user_1",
        tenantId: "tenant_1",
        type: PROCURELINE_SERVICE_JWT_TYPE,
      },
      secret,
    );

    expect(service.verifyAuthorizationHeader(`Bearer ${token}`)).toEqual({
      jti: "token-1",
      role: "tenant_admin",
      sub: "user_1",
      tenantId: "tenant_1",
    });
  });

  it("rejects malformed tokens", () => {
    expect(() => service.verifyAuthorizationHeader("Bearer bad-token")).toThrow(
      UnauthorizedException,
    );
  });
});
