import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "@/common/config/app-config";
import type { CreateSubscriptionDto } from "@/payments/dto/create-subscription.dto";

@Injectable()
export class IntaSendProvider {
  private readonly publishableKey: string;
  private readonly secretKey: string;

  constructor(configService: ConfigService<AppConfig, true>) {
    this.publishableKey = configService.get("intasendPublishableKey", { infer: true });
    this.secretKey = configService.get("intasendSecretKey", { infer: true });
  }

  async createCheckout(dto: CreateSubscriptionDto): Promise<Record<string, unknown>> {
    return {
      checkoutUrl: `https://payment.intasend.com/checkout/${dto.customerReference}`,
      provider: "intasend",
      publicKey: this.publishableKey,
    };
  }

  verifyCallback(body: Record<string, unknown>, rawBody: string, signature?: string): string {
    const expected = createHmac("sha256", this.secretKey).update(rawBody).digest("hex");

    if (
      !signature ||
      Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new UnauthorizedException({
        error: {
          code: "INVALID_WEBHOOK_SIGNATURE",
          message: "Invalid IntaSend callback signature",
        },
      });
    }

    return String(body.invoice_id ?? body.tracking_id ?? "intasend-event");
  }
}
