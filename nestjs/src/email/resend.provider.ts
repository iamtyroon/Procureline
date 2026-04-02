import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type { AppConfig } from "@/common/config/app-config";

@Injectable()
export class ResendProvider {
  private readonly convexUrl: string;
  private readonly devInboxSecret?: string;
  private readonly fromEmail?: string;
  private readonly resend?: Resend;
  private readonly transport: AppConfig["emailTransport"];

  constructor(configService: ConfigService<AppConfig, true>) {
    this.convexUrl = configService.get("convexUrl", { infer: true });
    this.devInboxSecret = configService.get("emailDevInboxSecret", { infer: true });
    this.transport = configService.get("emailTransport", { infer: true });
    this.fromEmail = configService.get("resendFromEmail", { infer: true });
    const resendApiKey = configService.get("resendApiKey", { infer: true });
    this.resend = resendApiKey ? new Resend(resendApiKey) : undefined;
  }

  async sendEmail(args: {
    html: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    messageType?: string;
    subject: string;
    text?: string;
    to: string;
  }): Promise<Record<string, unknown>> {
    if (this.transport === "dev_inbox") {
      return this.captureDevInboxEmail(args);
    }

    if (!this.resend || !this.fromEmail) {
      throw new Error("Resend transport is not configured.");
    }

    await this.resend.emails.send({
      from: this.fromEmail,
      headers: {
        "X-Idempotency-Key": args.idempotencyKey,
      },
      html: args.html,
      subject: args.subject,
      text: args.text,
      to: args.to,
    });

    return {
      accepted: true,
      provider: "resend",
      to: args.to,
    };
  }

  private async captureDevInboxEmail(args: {
    html: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    messageType?: string;
    subject: string;
    text?: string;
    to: string;
  }): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.convexUrl}/api/dev-email/capture`, {
      body: JSON.stringify({
        from: this.fromEmail ?? "Procureline <onboarding@resend.dev>",
        html: args.html,
        idempotencyKey: args.idempotencyKey,
        messageType: args.messageType ?? "transactional_email",
        metadata: args.metadata,
        subject: args.subject,
        text: args.text,
        to: [args.to],
        transport: "dev_inbox",
      }),
      headers: {
        "content-type": "application/json",
        "x-procureline-dev-email-secret": this.devInboxSecret ?? "",
      },
      method: "POST",
    });

    const result = (await response.json().catch(() => null)) as
      | {
          data?: {
            captureId?: string;
          };
          error?: {
            message?: string;
          };
        }
      | null;

    if (!response.ok) {
      throw new Error(
        result?.error?.message ?? "Development inbox capture failed",
      );
    }

    return {
      accepted: true,
      captureId: result?.data?.captureId,
      provider: "dev_inbox",
      to: args.to,
    };
  }
}
