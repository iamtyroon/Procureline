import { ConfigModule } from "@nestjs/config";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { AuthModule } from "@/auth/auth.module";
import { HttpExceptionEnvelopeFilter } from "@/common/filters/http-exception.filter";
import { SuccessEnvelopeInterceptor } from "@/common/interceptors/success-envelope.interceptor";
import {
  PROCURELINE_SERVICE_JWT_AUDIENCE,
  PROCURELINE_SERVICE_JWT_ISSUER,
  PROCURELINE_SERVICE_JWT_TYPE,
} from "@/common/constants/service-auth";
import { signServiceToken } from "@/common/utils/jwt";
import { PaymentsController } from "@/payments/payments.controller";
import { PaymentsService } from "@/payments/payments.service";
import { StripeProvider } from "@/payments/providers/stripe.provider";
import { IntaSendProvider } from "@/payments/providers/intasend.provider";
import { BankTransferProvider } from "@/payments/providers/bank-transfer.provider";
import { HealthController } from "@/health/health.controller";
import { RedisProbeService } from "@/queue/redis-probe.service";
import { ConvexSyncService } from "@/sync/convex-sync.service";

describe("NestJS external services integration", () => {
  let app: INestApplication;
  let convexSyncService: {
    claimSync: jest.Mock;
    completeSync: jest.Mock;
    failSync: jest.Mock;
  };
  const jwtSecret = "jwt-secret";

  beforeEach(async () => {
    convexSyncService = {
      claimSync: jest.fn().mockResolvedValue({ status: "claimed" }),
      completeSync: jest.fn().mockResolvedValue({ status: "completed" }),
      failSync: jest.fn().mockResolvedValue({ status: "failed" }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              convexUrl: "https://example.convex.cloud",
              intasendPublishableKey: "publishable",
              intasendSecretKey: "secret",
              nestjsHost: "127.0.0.1",
              nestjsPort: 0,
              nestjsUrl: "http://127.0.0.1",
              procurelineConvexSyncSecret: "sync-secret",
              procurelineServiceJwtSecret: jwtSecret,
              redisUrl: "redis://localhost:6379",
              resendApiKey: "resend",
              resendFromEmail: "notifications@procureline.local",
              resendWebhookSecret: "resend-webhook-secret",
              stripeSecretKey: "stripe",
              stripeWebhookSecret: "whsec",
              swaggerEnabled: true,
            }),
          ],
        }),
        ThrottlerModule.forRoot([
          { limit: 120, name: "default", ttl: 60_000 },
          { limit: 60, name: "webhook", ttl: 60_000 },
          { limit: 30, name: "operations", ttl: 60_000 },
        ]),
        AuthModule,
      ],
      controllers: [PaymentsController, HealthController],
      providers: [
        PaymentsService,
        {
          provide: StripeProvider,
          useValue: {
            constructWebhookEvent: jest.fn().mockImplementation((_raw: Buffer, _signature?: string) => ({
              id: "evt_1",
              livemode: false,
              type: "invoice.payment_succeeded",
            })),
            createSubscription: jest.fn().mockResolvedValue({
              checkoutUrl: "https://checkout.stripe.com/pay/test",
              provider: "stripe",
            }),
          },
        },
        {
          provide: IntaSendProvider,
          useValue: {
            createCheckout: jest.fn().mockResolvedValue({
              checkoutUrl: "https://intasend.example/checkout",
              provider: "intasend",
            }),
            verifyCallback: jest.fn().mockReturnValue("intasend-1"),
          },
        },
        {
          provide: BankTransferProvider,
          useValue: {
            verifyTransfer: jest.fn().mockResolvedValue({
              paymentReference: "bank_1",
              verified: true,
            }),
          },
        },
        {
          provide: ConvexSyncService,
          useValue: convexSyncService,
        },
        {
          provide: RedisProbeService,
          useValue: {
            isAvailable: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication({
      rawBody: true,
    });
    app.setGlobalPrefix("api/services");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionEnvelopeFilter());
    app.useGlobalInterceptors(new SuccessEnvelopeInterceptor());

    const swaggerConfig = new DocumentBuilder()
      .setTitle("Procureline External Services")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/services/docs", app, documentFactory);

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function createAuthorizationHeader(): string {
    const now = Math.floor(Date.now() / 1000);
    const token = signServiceToken(
      {
        aud: PROCURELINE_SERVICE_JWT_AUDIENCE,
        exp: now + 300,
        iat: now,
        iss: PROCURELINE_SERVICE_JWT_ISSUER,
        jti: "token-1",
        role: "tenant_admin",
        sub: "user_1",
        tenantId: "tenant_1",
        type: PROCURELINE_SERVICE_JWT_TYPE,
      },
      jwtSecret,
    );

    return `Bearer ${token}`;
  }

  it("serves authenticated REST entry points behind the service token guard", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/services/payments/subscriptions")
      .set("authorization", createAuthorizationHeader())
      .send({
        amount: 1000,
        currency: "KES",
        customerReference: "cust_1",
        provider: "stripe",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.provider).toBe("stripe");
  });

  it("exposes OpenAPI docs from the live application", async () => {
    const response = await request(app.getHttpServer()).get("/api/services/docs-json");
    expect(response.status).toBe(200);
    expect(response.body.paths["/api/services/payments/subscriptions"]).toBeDefined();
  });

  it("processes the Stripe raw-body webhook path", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/services/payments/webhooks/stripe")
      .set("stripe-signature", "sig")
      .set("content-type", "application/json")
      .send({
        id: "evt_1",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.processed).toBe(true);
    expect(convexSyncService.claimSync).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "stripe:evt_1",
      }),
    );
  });

  it("rejects duplicate webhook delivery idempotently", async () => {
    convexSyncService.claimSync.mockResolvedValueOnce({ status: "duplicate" });
    const response = await request(app.getHttpServer())
      .post("/api/services/payments/webhooks/stripe")
      .set("stripe-signature", "sig")
      .set("content-type", "application/json")
      .send({
        id: "evt_1",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.duplicate).toBe(true);
    expect(convexSyncService.completeSync).not.toHaveBeenCalled();
  });

  it("processes IntaSend callback verification seams", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/services/payments/webhooks/intasend")
      .set("x-intasend-signature", "signature")
      .send({
        invoice_id: "invoice-1",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.callbackId).toBe("intasend-1");
  });

  it("records direct payment verification through the sync claim/complete path", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/services/payments/verification")
      .set("authorization", createAuthorizationHeader())
      .send({
        paymentReference: "pay_1",
        provider: "stripe",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("verified");
    expect(convexSyncService.claimSync).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment-verification:stripe:pay_1",
      }),
    );
    expect(convexSyncService.completeSync).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment-verification:stripe:pay_1",
      }),
    );
  });

  it("records a reconciliation failure when provider success cannot sync back to Convex", async () => {
    convexSyncService.completeSync.mockRejectedValueOnce(new Error("sync failed"));
    const response = await request(app.getHttpServer())
      .post("/api/services/payments/webhooks/stripe")
      .set("stripe-signature", "sig")
      .set("content-type", "application/json")
      .send({
        id: "evt_1",
      });

    expect(response.status).toBe(503);
    expect(convexSyncService.failSync).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "stripe:evt_1",
      }),
    );
  });

  it("returns the operational health endpoint", async () => {
    const response = await request(app.getHttpServer()).get("/api/services/health");
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ok");
  });
});
