import { Module } from "@nestjs/common";
import { ServiceAuthGuard } from "@/auth/service-auth.guard";
import { ServiceTokenService } from "@/auth/service-token.service";

@Module({
  providers: [ServiceAuthGuard, ServiceTokenService],
  exports: [ServiceAuthGuard, ServiceTokenService],
})
export class AuthModule {}
