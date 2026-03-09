import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { ServiceTokenService } from "@/auth/service-token.service";
import type { RequestUser } from "@/common/types/request-user";

type RequestWithUser = Request & { user?: RequestUser };

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly serviceTokenService: ServiceTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    request.user = this.serviceTokenService.verifyAuthorizationHeader(request.header("authorization"));
    return true;
  }
}
