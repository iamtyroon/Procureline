import { Injectable } from "@nestjs/common";
import { AccessCodeDeliveryTemplate } from "@/email/templates/access-code-delivery.template";
import { render } from "@react-email/render";
import { BillingSupportTemplate } from "@/email/templates/billing-support.template";
import { DeadlineExtensionTemplate } from "@/email/templates/deadline-extension.template";
import { DeadlineReminderTemplate } from "@/email/templates/deadline-reminder.template";
import { GenericNotificationTemplate } from "@/email/templates/generic-notification.template";
import { SubmissionReminderTemplate } from "@/email/templates/submission-reminder.template";

@Injectable()
export class EmailTemplateRendererService {
  async renderTemplate(
    template:
      | "generic-notification"
      | "billing-support"
      | "access-code-delivery"
      | "catalog-request-status"
      | "catalog-request-submitted"
      | "deadline-extension"
      | "deadline-reminder"
      | "submission-reminder",
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

    if (template === "catalog-request-status") {
      const requestSummary =
        typeof templateProps?.requestSummary === "string"
          ? templateProps.requestSummary
          : "your catalog request";
      const tenantName =
        typeof templateProps?.tenantName === "string"
          ? templateProps.tenantName
          : "Procureline";
      const status =
        typeof templateProps?.status === "string"
          ? templateProps.status
          : "updated";
      const reason =
        typeof templateProps?.reason === "string" ? templateProps.reason : null;
      const normalizedStatus =
        status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

      return render(
        GenericNotificationTemplate({
          heading: `${normalizedStatus} catalog request`,
          message: reason
            ? `${tenantName} marked ${requestSummary} as ${status}. Reason: ${reason}`
            : `${tenantName} marked ${requestSummary} as ${status}.`,
        }),
      );
    }

    if (template === "catalog-request-submitted") {
      const requestSummary =
        typeof templateProps?.requestSummary === "string"
          ? templateProps.requestSummary
          : "a catalog request";
      const requestType =
        typeof templateProps?.requestType === "string"
          ? templateProps.requestType
          : "catalog";
      const tenantName =
        typeof templateProps?.tenantName === "string"
          ? templateProps.tenantName
          : "Procureline";

      return render(
        GenericNotificationTemplate({
          heading: "New catalog request submitted",
          message: `${tenantName} received a new ${requestType} request for ${requestSummary}.`,
        }),
      );
    }

    if (template === "deadline-extension") {
      return render(
        DeadlineExtensionTemplate({
          deadlineLabel:
            typeof templateProps?.deadlineLabel === "string"
              ? templateProps.deadlineLabel
              : "Not configured",
          fiscalYearLabel:
            typeof templateProps?.fiscalYearLabel === "string"
              ? templateProps.fiscalYearLabel
              : "current fiscal year",
          tenantName:
            typeof templateProps?.tenantName === "string"
              ? templateProps.tenantName
              : "Procureline",
        }),
      );
    }

    if (template === "deadline-reminder") {
      return render(
        DeadlineReminderTemplate({
          deadlineLabel:
            typeof templateProps?.deadlineLabel === "string"
              ? templateProps.deadlineLabel
              : "Not configured",
          fiscalYearLabel:
            typeof templateProps?.fiscalYearLabel === "string"
              ? templateProps.fiscalYearLabel
              : "current fiscal year",
          offsetDays:
            typeof templateProps?.offsetDays === "number"
              ? templateProps.offsetDays
              : 1,
          tenantName:
            typeof templateProps?.tenantName === "string"
              ? templateProps.tenantName
              : "Procureline",
        }),
      );
    }

    if (template === "submission-reminder") {
      return render(
        SubmissionReminderTemplate({
          deadlineLabel:
            typeof templateProps?.deadlineLabel === "string"
              ? templateProps.deadlineLabel
              : "Not configured",
          departmentName:
            typeof templateProps?.departmentName === "string"
              ? templateProps.departmentName
              : "Department",
          fiscalYearLabel:
            typeof templateProps?.fiscalYearLabel === "string"
              ? templateProps.fiscalYearLabel
              : "current fiscal year",
          loginUrl:
            typeof templateProps?.loginUrl === "string"
              ? templateProps.loginUrl
              : "/access/department-user",
          statusLabel:
            typeof templateProps?.statusLabel === "string"
              ? templateProps.statusLabel
              : "draft",
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
