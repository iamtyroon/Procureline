import { validateEnvironment } from "@/common/config/env.validation";

describe("validateEnvironment", () => {
  const baseEnvironment = {
    CONVEX_URL: "https://example.convex.cloud",
    INTASEND_PUBLISHABLE_KEY: "publishable",
    INTASEND_SECRET_KEY: "secret",
    NESTJS_HOST: "0.0.0.0",
    NESTJS_PORT: "4001",
    NESTJS_URL: "http://localhost:4001",
    PROCURELINE_CONVEX_SYNC_SECRET: "sync-secret",
    PROCURELINE_SERVICE_JWT_SECRET: "jwt-secret",
    REDIS_URL: "redis://localhost:6379",
    RESEND_API_KEY: "resend-key",
    RESEND_FROM_EMAIL: "notifications@procureline.local",
    RESEND_WEBHOOK_SECRET: "resend-webhook-secret",
    STRIPE_SECRET_KEY: "stripe-key",
    STRIPE_WEBHOOK_SECRET: "whsec",
    SWAGGER_ENABLED: "true",
  };

  it("parses the required Procureline NestJS env contract", () => {
    const config = validateEnvironment(baseEnvironment);
    expect(config.nestjsPort).toBe(4001);
    expect(config.swaggerEnabled).toBe(true);
  });

  it("fails fast when required secrets are missing", () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        PROCURELINE_SERVICE_JWT_SECRET: "",
      }),
    ).toThrow("PROCURELINE_SERVICE_JWT_SECRET");
  });
});
