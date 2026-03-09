import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Response } from "express";
import type { ErrorEnvelope } from "@/common/contracts/envelope";

@Catch()
@Injectable()
export class HttpExceptionEnvelopeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;

    const error: ErrorEnvelope["error"] =
      typeof exceptionResponse === "object" &&
      exceptionResponse !== null &&
      "error" in exceptionResponse &&
      typeof (exceptionResponse as { error?: unknown }).error === "object"
        ? ((exceptionResponse as ErrorEnvelope).error ?? {
            code: "INTERNAL_SERVER_ERROR",
            message: "Unexpected error",
          })
        : {
            code: status === HttpStatus.UNAUTHORIZED ? "UNAUTHORIZED" : "INTERNAL_SERVER_ERROR",
            message:
              exception instanceof Error
                ? exception.message
                : status === HttpStatus.INTERNAL_SERVER_ERROR
                  ? "Unexpected error"
                  : "Request failed",
          };

    response.status(status).json({
      success: false,
      error,
    } satisfies ErrorEnvelope);
  }
}
