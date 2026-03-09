import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map, type Observable } from "rxjs";
import { isEnvelopeResponse, successEnvelope } from "@/common/contracts/envelope";

@Injectable()
export class SuccessEnvelopeInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((value) => {
        if (isEnvelopeResponse(value)) {
          return value;
        }
        return successEnvelope(value);
      }),
    );
  }
}
