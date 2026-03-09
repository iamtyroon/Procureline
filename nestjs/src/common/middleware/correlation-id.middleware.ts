import { Injectable, type NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { requestContextStorage } from "@/common/logging/request-context";

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const correlationId = request.header("x-correlation-id") ?? randomUUID();
    request.headers["x-correlation-id"] = correlationId;
    response.setHeader("x-correlation-id", correlationId);
    requestContextStorage.run(correlationId, next);
  }
}
