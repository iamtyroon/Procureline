import { Injectable } from "@nestjs/common";
import { AccessCodeDeliveryTemplate } from "@/email/templates/access-code-delivery.template";
import { render } from "@react-email/render";
import { BillingSupportTemplate } from "@/email/templates/billing-support.template";
import { GenericNotificationTemplate } from "@/email/templates/generic-notification.template";

@Injectable()
export class EmailTemplateRendererService {
  async renderTemplate(
    template: "generic-notification" | "billing-support" | "access-code-delivery",
    templateProps?: Record<string, unknown>,
  ): Promise<string> {
    if (template === "access-code-delivery") {
      return render(
        AccessCodeDeliveryTemplate({
          accessCode:
            typeof templateProps?.accessCode === "string"
              ? templateProps.accessCode
              : "Unavailable",
          departmentName:
            typeof templateProps?.departmentName === "string"
              ? templateProps.departmentName
              : "Department",
          expirationLabel:
            typeof templateProps?.expirationLabel === "string"
              ? templateProps.expirationLabel
              : "Not configured",
          loginUrl:
            typeof templateProps?.loginUrl === "string"
              ? templateProps.loginUrl
              : "/access/department-user",
          tenantName:
            typeof templateProps?.tenantName === "string"
              ? templateProps.tenantName
              : "Procureline",
        }),
      );
    }

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
