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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";
import { ServiceAuthGuard } from "@/auth/service-auth.guard";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import type { RequestUser } from "@/common/types/request-user";
import { SendEmailDto } from "@/email/dto/send-email.dto";
import { EmailService } from "@/email/email.service";

@ApiTags("email")
@Controller("email")
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post("send")
  @ApiBearerAuth()
  @UseGuards(ThrottlerGuard, ServiceAuthGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  queueEmail(
    @Body() dto: SendEmailDto,
    @CurrentUser() user: RequestUser,
  ): Promise<{ duplicate?: boolean; eventKey: string; jobId: string | undefined; queued: boolean }> {
    return this.emailService.queueEmail(dto, user);
  }

  @Post("cancel")
  @ApiBearerAuth()
  @UseGuards(ThrottlerGuard, ServiceAuthGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  cancelEmail(
    @Body("idempotencyKey") idempotencyKey: string,
  ): Promise<{ cancelled: boolean; eventKey: string }> {
    return this.emailService.cancelQueuedEmail(idempotencyKey);
  }

  @Post("webhooks/resend")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ webhook: { limit: 60, ttl: 60_000 } })
  handleWebhook(
    @Headers("x-resend-signature") signature: string | undefined,
    @Body() payload: Record<string, unknown>,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<Record<string, unknown>> {
    const rawBody = request.rawBody?.toString("utf8") ?? JSON.stringify(payload);
    return this.emailService.handleWebhook(payload, rawBody, signature);
  }
}
