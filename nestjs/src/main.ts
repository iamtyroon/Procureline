import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "@/app.module";
import type { AppConfig } from "@/common/config/app-config";
import { AppLogger } from "@/common/logging/app.logger";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const logger = app.get(AppLogger);
  app.useLogger(logger);
  app.setGlobalPrefix("api/services");
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  const configService = app.get(ConfigService<AppConfig, true>);
  if (configService.get("swaggerEnabled", { infer: true })) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Procureline External Services")
      .setDescription("Authenticated external integrations and background processing APIs")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/services/docs", app, documentFactory, {
      jsonDocumentUrl: "api/services/docs/openapi.json",
    });
  }

  await app.listen(configService.get("nestjsPort", { infer: true }), configService.get("nestjsHost", { infer: true }));
  logger.log(`Procureline NestJS services listening on ${configService.get("nestjsUrl", { infer: true })}`, "Bootstrap");
}

void bootstrap();
