import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestUser } from "@/common/types/request-user";

export const CurrentRole = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
  return request.user?.role;
});
