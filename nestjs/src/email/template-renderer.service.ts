import { Injectable } from "@nestjs/common";
import { render } from "@react-email/render";
import { BillingSupportTemplate } from "@/email/templates/billing-support.template";
import { GenericNotificationTemplate } from "@/email/templates/generic-notification.template";

@Injectable()
export class EmailTemplateRendererService {
  async renderTemplate(
    template: "generic-notification" | "billing-support",
    templateProps?: Record<string, unknown>,
  ): Promise<string> {
    if (template === "billing-support") {
      return render(
        BillingSupportTemplate({
          note: typeof templateProps?.note === "string" ? templateProps.note : undefined,
        }),
      );
    }

    return render(
      GenericNotificationTemplate({
        ctaLabel: typeof templateProps?.ctaLabel === "string" ? templateProps.ctaLabel : undefined,
        ctaUrl: typeof templateProps?.ctaUrl === "string" ? templateProps.ctaUrl : undefined,
        heading: typeof templateProps?.heading === "string" ? templateProps.heading : "Procureline notification",
        message: typeof templateProps?.message === "string" ? templateProps.message : "A transactional update is available.",
      }),
    );
  }
}
