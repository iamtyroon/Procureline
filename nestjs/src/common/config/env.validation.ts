import { z } from "zod";
import type { AppConfig } from "@/common/config/app-config";

const envSchema = z.object({
  AUTH_DEV_INBOX_SECRET: z.string().trim().min(1).optional(),
  AUTH_EMAIL_TRANSPORT: z.enum(["resend", "dev_inbox"]).default("resend"),
  CONVEX_URL: z.string().url(),
  INTASEND_PUBLISHABLE_KEY: z.string().trim().min(1),
  INTASEND_SECRET_KEY: z.string().trim().min(1),
  NESTJS_HOST: z.string().trim().min(1).default("0.0.0.0"),
  NESTJS_PORT: z.coerce.number().int().positive().default(4001),
  NESTJS_URL: z.string().url().default("http://localhost:4001"),
  PROCURELINE_CONVEX_SYNC_SECRET: z.string().trim().min(1),
  PROCURELINE_SERVICE_JWT_SECRET: z.string().trim().min(1),
  REDIS_URL: z.string().trim().min(1),
  RESEND_API_KEY: z.string().trim().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_WEBHOOK_SECRET: z.string().trim().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().trim().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().trim().min(1),
  SWAGGER_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export function validateEnvironment(config: Record<string, unknown>): AppConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid NestJS service environment: ${issues}`);
  }

  if (parsed.data.AUTH_EMAIL_TRANSPORT === "resend") {
    if (!parsed.data.RESEND_API_KEY) {
      throw new Error("Invalid NestJS service environment: RESEND_API_KEY: Required when AUTH_EMAIL_TRANSPORT=resend");
    }
    if (!parsed.data.RESEND_FROM_EMAIL) {
      throw new Error("Invalid NestJS service environment: RESEND_FROM_EMAIL: Required when AUTH_EMAIL_TRANSPORT=resend");
    }
    if (!parsed.data.RESEND_WEBHOOK_SECRET) {
      throw new Error("Invalid NestJS service environment: RESEND_WEBHOOK_SECRET: Required when AUTH_EMAIL_TRANSPORT=resend");
    }
  }

  if (
    parsed.data.AUTH_EMAIL_TRANSPORT === "dev_inbox" &&
    !parsed.data.AUTH_DEV_INBOX_SECRET
  ) {
    throw new Error("Invalid NestJS service environment: AUTH_DEV_INBOX_SECRET: Required when AUTH_EMAIL_TRANSPORT=dev_inbox");
  }

  return {
    emailDevInboxSecret: parsed.data.AUTH_DEV_INBOX_SECRET,
    emailTransport: parsed.data.AUTH_EMAIL_TRANSPORT,
    convexUrl: parsed.data.CONVEX_URL,
    intasendPublishableKey: parsed.data.INTASEND_PUBLISHABLE_KEY,
    intasendSecretKey: parsed.data.INTASEND_SECRET_KEY,
    nestjsHost: parsed.data.NESTJS_HOST,
    nestjsPort: parsed.data.NESTJS_PORT,
    nestjsUrl: parsed.data.NESTJS_URL,
    procurelineConvexSyncSecret: parsed.data.PROCURELINE_CONVEX_SYNC_SECRET,
    procurelineServiceJwtSecret: parsed.data.PROCURELINE_SERVICE_JWT_SECRET,
    redisUrl: parsed.data.REDIS_URL,
    resendApiKey: parsed.data.RESEND_API_KEY,
    resendFromEmail: parsed.data.RESEND_FROM_EMAIL,
    resendWebhookSecret: parsed.data.RESEND_WEBHOOK_SECRET,
    stripeSecretKey: parsed.data.STRIPE_SECRET_KEY,
    stripeWebhookSecret: parsed.data.STRIPE_WEBHOOK_SECRET,
    swaggerEnabled: parsed.data.SWAGGER_ENABLED,
  };
}
