import { Injectable } from "@nestjs/common";
import { SendEmailDto } from "@/email/dto/send-email.dto";
import { ResendProvider } from "@/email/resend.provider";
import { EmailTemplateRendererService } from "@/email/template-renderer.service";
import { ConvexSyncService } from "@/sync/convex-sync.service";

export interface EmailDispatchResult extends Record<string, unknown> {
  skipReason?: string;
  skipped?: boolean;
}

@Injectable()
export class EmailDispatchService {
  constructor(
    private readonly convexSyncService: ConvexSyncService,
    private readonly resendProvider: ResendProvider,
    private readonly emailTemplateRendererService: EmailTemplateRendererService,
  ) {}

  async send(dto: SendEmailDto): Promise<EmailDispatchResult> {
    if (
      dto.template === "deadline-reminder" &&
      typeof dto.templateProps?.reminderJobId === "string"
    ) {
      const dispatchClaim = await this.convexSyncService.claimReminderDispatch({
        reminderJobId: dto.templateProps.reminderJobId,
      });

      if (!dispatchClaim.allowSend) {
        return {
          skipReason: dispatchClaim.statusMessage ?? dispatchClaim.reason,
          skipped: true,
        };
      }
    }

    const html = await this.emailTemplateRendererService.renderTemplate(dto.template, dto.templateProps);
    return this.resendProvider.sendEmail({
      html,
      idempotencyKey: dto.idempotencyKey,
      metadata: {
        template: dto.template,
        templateProps: dto.templateProps,
      },
      messageType: `transactional_${dto.template}`,
      subject: dto.subject,
      text: dto.templateProps ? JSON.stringify(dto.templateProps, null, 2) : undefined,
      to: dto.to,
    });
  }
}
