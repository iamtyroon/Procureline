export interface AppConfig {
  convexUrl: string;
  emailTransport: "dev_inbox" | "resend";
  emailDevInboxSecret?: string;
  intasendPublishableKey: string;
  intasendSecretKey: string;
  nestjsHost: string;
  nestjsPort: number;
  nestjsUrl: string;
  procurelineConvexSyncSecret: string;
  procurelineServiceJwtSecret: string;
  redisUrl: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  resendWebhookSecret?: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  swaggerEnabled: boolean;
}
