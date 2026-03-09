import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";
import { ServiceAuthGuard } from "@/auth/service-auth.guard";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import type { RequestUser } from "@/common/types/request-user";
import { ManualBankTransferVerificationDto } from "@/payments/dto/manual-bank-transfer.dto";
import { CreateSubscriptionDto } from "@/payments/dto/create-subscription.dto";
import { VerifyPaymentDto } from "@/payments/dto/verify-payment.dto";
import { PaymentsService } from "@/payments/payments.service";

@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("subscriptions")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a provider-specific subscription/payment placeholder" })
  @UseGuards(ThrottlerGuard, ServiceAuthGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  createSubscription(
    @Body() dto: CreateSubscriptionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<Record<string, unknown>> {
    return this.paymentsService.createSubscription(dto, user);
  }

  @Post("verification")
  @ApiBearerAuth()
  @UseGuards(ThrottlerGuard, ServiceAuthGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  verifyPayment(
    @Body() dto: VerifyPaymentDto,
    @CurrentUser() user: RequestUser,
  ): Promise<Record<string, unknown>> {
    return this.paymentsService.verifyPayment(dto, user);
  }

  @Post("bank-transfer/verify")
  @ApiBearerAuth()
  @UseGuards(ThrottlerGuard, ServiceAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  verifyManualBankTransfer(
    @Body() dto: ManualBankTransferVerificationDto,
    @CurrentUser() user: RequestUser,
  ): Promise<Record<string, unknown>> {
    return this.paymentsService.verifyManualBankTransfer(dto, user);
  }

  @Post("webhooks/stripe")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ webhook: { limit: 60, ttl: 60_000 } })
  handleStripeWebhook(
    @Headers("stripe-signature") signature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<Record<string, unknown>> {
    return this.paymentsService.handleStripeWebhook(request.rawBody ?? Buffer.alloc(0), signature);
  }

  @Post("webhooks/intasend")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ webhook: { limit: 60, ttl: 60_000 } })
  handleIntaSendWebhook(
    @Headers("x-intasend-signature") signature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
    @Body() payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const rawBody = request.rawBody?.toString("utf8") ?? JSON.stringify(payload);
    return this.paymentsService.handleIntaSendCallback(payload, rawBody, signature);
  }
}
