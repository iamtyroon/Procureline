import { randomUUID } from "node:crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Stripe } from "stripe";
import type { RequestUser } from "@/common/types/request-user";
import {
  GenerateInvoiceDto,
  InitiateRefundDto,
  QueueReconciliationDto,
} from "@/payments/dto/billing-operations.dto";
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

  private buildProviderSubscriptionChange(args: {
    amountCents?: number;
    billingCycle?: "annual" | "monthly";
    currency?: string;
    metadata?: Record<string, unknown>;
    paymentReference: string;
    provider: "intasend" | "stripe";
    status?: string;
  }): Record<string, unknown> | null {
    const tenantId = typeof args.metadata?.tenantId === "string" ? args.metadata.tenantId : undefined;
    const tenantReference =
      typeof args.metadata?.tenantReference === "string"
        ? args.metadata.tenantReference
        : typeof args.metadata?.subdomain === "string"
          ? args.metadata.subdomain
          : undefined;

    if (!tenantId && !tenantReference) {
      return null;
    }

    const nextBillingDate =
      typeof args.metadata?.nextBillingDate === "string"
        ? Number(args.metadata.nextBillingDate)
        : typeof args.metadata?.nextBillingDate === "number"
          ? args.metadata.nextBillingDate
          : undefined;

    return {
      amountCents: args.amountCents,
      billingCycle: args.billingCycle ?? "annual",
      changeType: "payment.subscription.provider_updated",
      currency: args.currency ?? "KES",
      nextBillingDate: Number.isFinite(nextBillingDate) ? nextBillingDate : undefined,
      paymentReference: args.paymentReference,
      provider: args.provider,
      subscriptionStatus: args.status ?? "active",
      tenantId,
      tenantReference,
    };
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

  async queueReconciliation(dto: QueueReconciliationDto, actor: RequestUser): Promise<Record<string, unknown>> {
    const eventKey = `billing-reconciliation:${dto.provider}:${dto.idempotencyKey ?? randomUUID()}`;
    const claim = await this.convexSyncService.claimSync({
      actor: {
        role: actor.role,
        tenantId: actor.tenantId,
        userId: actor.sub,
      },
      eventKey,
      eventType: dto.provider === "intasend" ? "payment.mpesa.reconciliation_queued" : "payment.stripe.retry_reconciliation_queued",
      payload: dto,
      provider: dto.provider,
    });

    if (claim.status === "duplicate") {
      return {
        duplicate: true,
        provider: dto.provider,
        status: "queued",
      };
    }

    const result = {
      maxAttempts: 3,
      provider: dto.provider,
      retryPolicy: "daily_retry_up_to_3_attempts",
      status: "queued",
    };
    await this.convexSyncService.completeSync({
      durableChanges: [
        {
          actor,
          changeType: "payment.reconciliation.queued",
          provider: dto.provider,
          maxAttempts: 3,
        },
      ],
      eventKey,
      result,
    });
    return result;
  }

  async initiateRefund(dto: InitiateRefundDto, actor: RequestUser): Promise<Record<string, unknown>> {
    const eventKey = `billing-refund:${dto.paymentReference}:${dto.idempotencyKey ?? randomUUID()}`;
    const claim = await this.convexSyncService.claimSync({
      actor: {
        role: actor.role,
        tenantId: actor.tenantId,
        userId: actor.sub,
      },
      eventKey,
      eventType: "payment.refund.approval_requested",
      payload: dto,
      provider: "custom",
    });

    if (claim.status === "duplicate") {
      return {
        duplicate: true,
        paymentReference: dto.paymentReference,
        status: "pending_approval",
      };
    }

    const elapsedRatio = Math.min(1, Math.max(0, (Date.now() - dto.serviceStartAt) / Math.max(1, dto.serviceEndAt - dto.serviceStartAt)));
    const proratedAmount = Math.max(0, Math.round(dto.amount * (1 - elapsedRatio)));
    const result = {
      paymentReference: dto.paymentReference,
      proratedAmount,
      status: "pending_approval",
    };
    await this.convexSyncService.completeSync({
      durableChanges: [
        {
          actor,
          changeType: "payment.refund.approval_requested",
          paymentReference: dto.paymentReference,
          proratedAmount,
        },
      ],
      eventKey,
      result,
    });
    return result;
  }

  async generateInvoice(dto: GenerateInvoiceDto, actor: RequestUser): Promise<Record<string, unknown>> {
    const eventKey = `billing-invoice:${dto.tenantReference}:${dto.idempotencyKey ?? randomUUID()}`;
    const claim = await this.convexSyncService.claimSync({
      actor: {
        role: actor.role,
        tenantId: actor.tenantId,
        userId: actor.sub,
      },
      eventKey,
      eventType: "payment.invoice.generation_queued",
      payload: dto,
      provider: "custom",
    });

    if (claim.status === "duplicate") {
      return {
        duplicate: true,
        status: "queued",
        tenantReference: dto.tenantReference,
      };
    }

    const result = {
      amount: dto.amount,
      currency: dto.currency,
      maxAttempts: 3,
      status: "queued",
      tenantReference: dto.tenantReference,
    };
    await this.convexSyncService.completeSync({
      durableChanges: [
        {
          actor,
          changeType: "payment.invoice.generation_queued",
          tenantReference: dto.tenantReference,
          maxAttempts: 3,
        },
      ],
      eventKey,
      result,
    });
    return result;
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined): Promise<Record<string, unknown>> {
    const event = this.stripeProvider.constructWebhookEvent(rawBody, signature);
    const stripeObject = event.data.object as Stripe.Event.Data.Object & {
      amount_paid?: number;
      amount_due?: number;
      currency?: string;
      current_period_end?: number;
      id?: string;
      metadata?: Record<string, string>;
      status?: string;
    };
    const providerChange = this.buildProviderSubscriptionChange({
      amountCents: typeof stripeObject.amount_paid === "number" ? stripeObject.amount_paid : stripeObject.amount_due,
      billingCycle: stripeObject.metadata?.billingCycle === "monthly" ? "monthly" : "annual",
      currency: stripeObject.currency?.toUpperCase(),
      metadata: stripeObject.metadata,
      paymentReference: stripeObject.id ?? event.id,
      provider: "stripe",
      status:
        event.type === "invoice.payment_failed"
          ? "past_due"
          : event.type === "customer.subscription.deleted"
            ? "cancelled"
            : "active",
    });
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
          ...(providerChange ? [providerChange] : []),
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
    const metadata = (payload.metadata && typeof payload.metadata === "object" ? payload.metadata : payload) as Record<string, unknown>;
    const providerChange = this.buildProviderSubscriptionChange({
      amountCents: typeof payload.amount === "number" ? Math.round(payload.amount * 100) : undefined,
      billingCycle: metadata.billingCycle === "monthly" ? "monthly" : "annual",
      currency: typeof payload.currency === "string" ? payload.currency.toUpperCase() : "KES",
      metadata,
      paymentReference: callbackId,
      provider: "intasend",
      status: payload.state === "FAILED" || payload.status === "FAILED" ? "past_due" : "active",
    });
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
          ...(providerChange ? [providerChange] : []),
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
