import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestUser } from "@/common/types/request-user";

function getRequestUser(context: ExecutionContext): RequestUser | undefined {
  const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
  return request.user;
}

export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext) => getRequestUser(context)?.sub);
