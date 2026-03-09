import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type { AppConfig } from "@/common/config/app-config";

@Injectable()
export class ResendProvider {
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor(configService: ConfigService<AppConfig, true>) {
    this.resend = new Resend(configService.get("resendApiKey", { infer: true }));
    this.fromEmail = configService.get("resendFromEmail", { infer: true });
  }

  async sendEmail(args: { html: string; idempotencyKey: string; subject: string; to: string }): Promise<Record<string, unknown>> {
    await this.resend.emails.send({
      from: this.fromEmail,
      headers: {
        "X-Idempotency-Key": args.idempotencyKey,
      },
      html: args.html,
      subject: args.subject,
      to: args.to,
    });

    return {
      accepted: true,
      to: args.to,
    };
  }
}
