import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "@/common/config/app-config";
import type { RequestUser } from "@/common/types/request-user";
import { SendEmailDto } from "@/email/dto/send-email.dto";
import { QueueService } from "@/queue/queue.service";
import { EMAIL_SEND_JOB } from "@/queue/queue.constants";
import { ConvexSyncService } from "@/sync/convex-sync.service";

@Injectable()
export class EmailService {
  private readonly resendWebhookSecret: string;

  constructor(
    private readonly queueService: QueueService,
    private readonly convexSyncService: ConvexSyncService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.resendWebhookSecret = configService.get("resendWebhookSecret", { infer: true });
  }

  async queueEmail(
    dto: SendEmailDto,
    actor: RequestUser,
  ): Promise<{ duplicate?: boolean; eventKey: string; jobId: string | undefined; queued: boolean }> {
    const eventKey = `email:${dto.idempotencyKey}`;
    const claim = await this.convexSyncService.claimSync({
      actor: {
        role: actor.role,
        tenantId: actor.tenantId,
        userId: actor.sub,
      },
      eventKey,
      eventType: "email.send.requested",
      payload: dto,
      provider: "email",
    });

    if (claim.status === "duplicate") {
      return {
        duplicate: true,
        eventKey,
        jobId: undefined,
        queued: false,
      };
    }

    let queuedJob: { id: string | undefined };
    try {
      queuedJob = await this.queueService.enqueue(
        EMAIL_SEND_JOB,
        {
          actor,
          dto,
          eventKey,
        },
        {
          jobId: dto.idempotencyKey,
          priority: 5,
        },
      );
    } catch (error) {
      await this.convexSyncService.failSync({
        error: {
          code: "QUEUE_ENQUEUE_FAILED",
          message: error instanceof Error ? error.message : "Email queueing failed",
        },
        eventKey,
      }).catch(() => undefined);
      throw error;
    }

    return {
      eventKey,
      jobId: queuedJob.id,
      queued: true,
    };
  }

  verifyWebhookSignature(payload: string, signature?: string): void {
    if (!signature) {
      throw new UnauthorizedException({
        error: {
          code: "INVALID_WEBHOOK_SIGNATURE",
          message: "Missing Resend webhook signature",
        },
      });
    }

    const expected = createHmac("sha256", this.resendWebhookSecret)
      .update(payload)
      .digest("hex");

    if (
      Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new UnauthorizedException({
        error: {
          code: "INVALID_WEBHOOK_SIGNATURE",
          message: "Invalid Resend webhook signature",
        },
      });
    }
  }

  async handleWebhook(payload: Record<string, unknown>, rawBody: string, signature?: string): Promise<Record<string, unknown>> {
    this.verifyWebhookSignature(rawBody, signature);
    const payloadData =
      typeof payload.data === "object" && payload.data !== null
        ? (payload.data as Record<string, unknown>)
        : undefined;
    const eventId = String(payloadData?.id ?? payload.id ?? "resend-webhook");
    const eventKey = `resend:${eventId}`;
    const claim = await this.convexSyncService.claimSync({
      eventKey,
      eventType: String(payload.type ?? "email.webhook"),
      payload,
      provider: "email",
    });

    if (claim.status === "duplicate") {
      return {
        duplicate: true,
        eventId,
      };
    }

    try {
      await this.convexSyncService.completeSync({
        durableChanges: [
          {
            changeType: "email.webhook.recorded",
            eventId,
            provider: "resend",
          },
        ],
        eventKey,
        result: {
          eventId,
          processed: true,
        },
      });
    } catch {
      await this.convexSyncService.failSync({
        error: {
          code: "CONVEX_SYNC_FAILED",
          message: "Resend webhook was received but the Convex write-back failed",
        },
        eventKey,
      });
      throw new ServiceUnavailableException({
        error: {
          code: "CONVEX_SYNC_FAILED",
          message: "Resend webhook was received but the Convex write-back failed",
        },
      });
    }

    return {
      eventId,
      processed: true,
    };
  }
}
