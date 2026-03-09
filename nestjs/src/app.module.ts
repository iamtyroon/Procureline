import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "@/auth/auth.module";
import { validateEnvironment } from "@/common/config/env.validation";
import { HttpExceptionEnvelopeFilter } from "@/common/filters/http-exception.filter";
import { SuccessEnvelopeInterceptor } from "@/common/interceptors/success-envelope.interceptor";
import { AppLogger } from "@/common/logging/app.logger";
import { CorrelationIdMiddleware } from "@/common/middleware/correlation-id.middleware";
import { EmailModule } from "@/email/email.module";
import { FilesModule } from "@/files/files.module";
import { HealthModule } from "@/health/health.module";
import { PaymentsModule } from "@/payments/payments.module";
import { QueueModule } from "@/queue/queue.module";
import { PlatformWorkersModule } from "@/queue/platform-workers.module";
import { ConvexSyncModule } from "@/sync/convex-sync.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([
      { limit: 120, name: "default", ttl: 60_000 },
      { limit: 60, name: "webhook", ttl: 60_000 },
      { limit: 30, name: "operations", ttl: 60_000 },
    ]),
    AuthModule,
    QueueModule,
    PaymentsModule,
    FilesModule,
    EmailModule,
    PlatformWorkersModule,
    ConvexSyncModule,
    HealthModule,
  ],
  providers: [
    AppLogger,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionEnvelopeFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SuccessEnvelopeInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
