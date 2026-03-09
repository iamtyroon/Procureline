import { Injectable } from "@nestjs/common";
import { SendEmailDto } from "@/email/dto/send-email.dto";
import { ResendProvider } from "@/email/resend.provider";
import { EmailTemplateRendererService } from "@/email/template-renderer.service";

@Injectable()
export class EmailDispatchService {
  constructor(
    private readonly resendProvider: ResendProvider,
    private readonly emailTemplateRendererService: EmailTemplateRendererService,
  ) {}

  async send(dto: SendEmailDto): Promise<Record<string, unknown>> {
    const html = await this.emailTemplateRendererService.renderTemplate(dto.template, dto.templateProps);
    return this.resendProvider.sendEmail({
      html,
      idempotencyKey: dto.idempotencyKey,
      subject: dto.subject,
      to: dto.to,
    });
  }
}
