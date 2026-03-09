import { randomUUID } from "node:crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Stripe } from "stripe";
import type { RequestUser } from "@/common/types/request-user";
import { ManualBankTransferVerificationDto } from "@/payments/dto/manual-bank-transfer.dto";
import { CreateSubscriptionDto } from "@/payments/dto/create-subscription.dto";
import { VerifyPaymentDto } from "@/payments/dto/verify-payment.dto";
import { BankTransferProvider } from "@/payments/providers/bank-transfer.provider";
import { IntaSendProvider } from "@/payments/providers/intasend.provider";
import { StripeProvider } from "@/payments/providers/stripe.provider";
import { ConvexSyncService } from "@/sync/convex-sync.service";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly stripeProvider: StripeProvider,
    private readonly intaSendProvider: IntaSendProvider,
    private readonly bankTransferProvider: BankTransferProvider,
    private readonly convexSyncService: ConvexSyncService,
  ) {}

  private buildSubscriptionEventKey(dto: CreateSubscriptionDto): string {
    return `subscription-create:${dto.provider}:${dto.idempotencyKey ?? randomUUID()}`;
  }

  async createSubscription(dto: CreateSubscriptionDto, actor: RequestUser): Promise<Record<string, unknown>> {
    const eventKey = this.buildSubscriptionEventKey(dto);
    const claim = await this.convexSyncService.claimSync({
      actor: {
        role: actor.role,
        tenantId: actor.tenantId,
        userId: actor.sub,
      },
      eventKey,
      eventType: "payment.subscription.create_requested",
      payload: dto,
      provider: dto.provider,
    });

    if (claim.status === "duplicate") {
      return {
        customerReference: dto.customerReference,
        duplicate: true,
        provider: dto.provider,
      };
    }

    let result: Record<string, unknown>;
    try {
      if (dto.provider === "stripe") {
        result = await this.stripeProvider.createSubscription(dto);
      } else if (dto.provider === "intasend") {
        result = await this.intaSendProvider.createCheckout(dto);
      } else {
        // bank_transfer: return instructions for manual payment, not a verification call
        result = {
          customerReference: dto.customerReference,
          instructions: "Transfer the invoiced amount and submit the bank reference for manual verification",
          provider: "bank_transfer",
        };
      }
    } catch (error) {
      await this.convexSyncService.failSync({
        error: {
          code: "PAYMENT_PROVIDER_FAILED",
          message: error instanceof Error ? error.message : "Subscription checkout creation failed",
        },
        eventKey,
      }).catch(() => undefined);
      throw error;
    }

    try {
      await this.convexSyncService.completeSync({
        durableChanges: [
          {
            actor,
            changeType: "payment.subscription.checkout_created",
            customerReference: dto.customerReference,
            provider: dto.provider,
          },
        ],
        eventKey,
        result,
      });
    } catch {
      await this.convexSyncService.failSync({
        error: {
          code: "CONVEX_SYNC_FAILED",
          message: "Subscription checkout created but the Convex write-back failed",
        },
        eventKey,
      }).catch(() => undefined);
      throw new ServiceUnavailableException({
        error: {
          code: "CONVEX_SYNC_FAILED",
          message: "Subscription checkout created but the Convex write-back failed",
        },
      });
    }

    return result;
  }

  async verifyPayment(dto: VerifyPaymentDto, actor: RequestUser): Promise<Record<string, unknown>> {
    const eventKey = `payment-verification:${dto.provider}:${dto.paymentReference}`;
    const claim = await this.convexSyncService.claimSync({
      actor: {
        role: actor.role,
        tenantId: actor.tenantId,
        userId: actor.sub,
      },
      eventKey,
      eventType: "payment.verification.recorded",
      payload: dto,
      provider: dto.provider,
    });

    if (claim.status === "duplicate") {
      return {
        duplicate: true,
        paymentReference: dto.paymentReference,
        status: "verified",
      };
    }

    try {
      await this.convexSyncService.completeSync({
        durableChanges: [
          {
            actor,
            changeType: "payment.verification.recorded",
            paymentReference: dto.paymentReference,
            provider: dto.provider,
          },
        ],
        eventKey,
        result: {
          actor,
          metadata: dto.metadata ?? {},
          status: "verified",
        },
      });
    } catch {
      await this.convexSyncService.failSync({
        error: {
          code: "CONVEX_SYNC_FAILED",
          message: "Payment verification was recorded but the Convex write-back failed",
        },
        eventKey,
      }).catch(() => undefined);
      throw new ServiceUnavailableException({
        error: {
          code: "CONVEX_SYNC_FAILED",
          message: "Payment verification was recorded but the Convex write-back failed",
        },
      });
    }

    return {
      paymentReference: dto.paymentReference,
      status: "verified",
    };
  }

  async verifyManualBankTransfer(dto: ManualBankTransferVerificationDto, actor: RequestUser): Promise<Record<string, unknown>> {
    const eventKey = `bank-transfer:${dto.paymentReference}`;
    const claim = await this.convexSyncService.claimSync({
      actor: {
        role: actor.role,
        tenantId: actor.tenantId,
        userId: actor.sub,
      },
      eventKey,
      eventType: "bank_transfer.manual_verification",
      payload: dto,
      provider: "bank_transfer",
    });

    if (claim.status === "duplicate") {
      return {
        duplicate: true,
        paymentReference: dto.paymentReference,
      };
    }

    let verification: Record<string, unknown>;
    try {
      verification = await this.bankTransferProvider.verifyTransfer(dto);
    } catch (error) {
      await this.convexSyncService.failSync({
        error: {
          code: "BANK_TRANSFER_VERIFICATION_FAILED",
          message: error instanceof Error ? error.message : "Bank transfer verification failed",
        },
        eventKey,
      }).catch(() => undefined);
      throw error;
    }

    try {
      await this.convexSyncService.completeSync({
        durableChanges: [
          {
            actor,
            changeType: "payment.bank_transfer.verified",
            paymentReference: dto.paymentReference,
          },
        ],
        eventKey,
        result: verification,
      });
    } catch {
      await this.convexSyncService.failSync({
        error: {
          code: "CONVEX_SYNC_FAILED",
          message: "Bank transfer verification succeeded but the Convex write-back failed",
        },
        eventKey,
      }).catch(() => undefined);
      throw new ServiceUnavailableException({
        error: {
          code: "CONVEX_SYNC_FAILED",
          message: "Bank transfer verification succeeded but the Convex write-back failed",
        },
      });
    }

    return verification;
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined): Promise<Record<string, unknown>> {
    const event = this.stripeProvider.constructWebhookEvent(rawBody, signature);
    const eventKey = `stripe:${event.id}`;
    const claim = await this.convexSyncService.claimSync({
      eventKey,
      eventType: event.type,
      metadata: {
        livemode: event.livemode,
      },
      payload: event,
      provider: "stripe",
    });

    if (claim.status === "duplicate") {
      return {
        duplicate: true,
        eventId: event.id,
      };
    }

    try {
      await this.convexSyncService.completeSync({
        durableChanges: [
          {
            changeType: "payment.provider_event.recorded",
            eventId: event.id,
            provider: "stripe",
            type: event.type,
          },
        ],
        eventKey,
        result: {
          eventId: event.id,
          status: "processed",
          type: event.type,
        },
      });
    } catch (error) {
      await this.convexSyncService.failSync({
        error: {
          code: "CONVEX_SYNC_FAILED",
          message: "Stripe event was received but the Convex write-back failed",
        },
        eventKey,
      });
      throw new ServiceUnavailableException({
        error: {
          code: "CONVEX_SYNC_FAILED",
          message: "Stripe event was received but the Convex write-back failed",
        },
      });
    }

    return {
      eventId: event.id,
      processed: true,
      type: event.type,
    };
  }

  async handleIntaSendCallback(payload: Record<string, unknown>, rawBody: string, signature: string | undefined): Promise<Record<string, unknown>> {
    const callbackId = this.intaSendProvider.verifyCallback(payload, rawBody, signature);
    const eventKey = `intasend:${callbackId}`;
    const claim = await this.convexSyncService.claimSync({
      eventKey,
      eventType: "payment.callback",
      payload,
      provider: "intasend",
    });

    if (claim.status === "duplicate") {
      return {
        callbackId,
        duplicate: true,
      };
    }

    try {
      await this.convexSyncService.completeSync({
        durableChanges: [
          {
            callbackId,
            changeType: "payment.provider_event.recorded",
            provider: "intasend",
          },
        ],
        eventKey,
        result: {
          callbackId,
          processed: true,
        },
      });
    } catch {
      await this.convexSyncService.failSync({
        error: {
          code: "CONVEX_SYNC_FAILED",
          message: "IntaSend callback was received but the Convex write-back failed",
        },
        eventKey,
      });
      throw new ServiceUnavailableException({
        error: {
          code: "CONVEX_SYNC_FAILED",
          message: "IntaSend callback was received but the Convex write-back failed",
        },
      });
    }

    return {
      callbackId,
      processed: true,
    };
  }
}
