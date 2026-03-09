import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import type { AppConfig } from "@/common/config/app-config";
import type { CreateSubscriptionDto } from "@/payments/dto/create-subscription.dto";

@Injectable()
export class StripeProvider {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(configService: ConfigService<AppConfig, true>) {
    this.stripe = new Stripe(configService.get("stripeSecretKey", { infer: true }));
    this.webhookSecret = configService.get("stripeWebhookSecret", { infer: true });
  }

  // TODO: Replace with real Stripe Checkout Session creation via this.stripe.checkout.sessions.create()
  // This placeholder returns a mock URL - later stories should wire up actual Stripe API calls.
  async createSubscription(dto: CreateSubscriptionDto): Promise<Record<string, unknown>> {
    return {
      checkoutUrl: `https://checkout.stripe.com/pay/${dto.customerReference}`,
      customerReference: dto.customerReference,
      mode: "subscription",
      provider: "stripe",
    };
  }

  constructWebhookEvent(rawBody: Buffer, signature?: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawBody, signature ?? "", this.webhookSecret);
  }
}
