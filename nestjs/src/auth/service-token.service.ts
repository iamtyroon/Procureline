import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "@/common/config/app-config";
import type { RequestUser } from "@/common/types/request-user";
import { JwtValidationError, verifyServiceToken } from "@/common/utils/jwt";

@Injectable()
export class ServiceTokenService {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  verifyAuthorizationHeader(authorizationHeader?: string): RequestUser {
    if (!authorizationHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException({
        error: {
          code: "UNAUTHENTICATED",
          message: "Missing Procureline service token",
        },
      });
    }

    const token = authorizationHeader.slice("Bearer ".length);

    try {
      const claims = verifyServiceToken(token, this.configService.get("procurelineServiceJwtSecret", { infer: true }));
      return {
        jti: claims.jti,
        role: claims.role,
        sub: claims.sub,
        tenantId: claims.tenantId,
      };
    } catch (error) {
      if (error instanceof JwtValidationError) {
        throw new UnauthorizedException({
          error: {
            code: "UNAUTHORIZED",
            message: error.message,
          },
        });
      }
      throw error;
    }
  }
}
