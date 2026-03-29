import React from "react";
import { AccessCodeDeliveryTemplate } from "@/email/templates/access-code-delivery.template";
import { DeadlineExtensionTemplate } from "@/email/templates/deadline-extension.template";
import { DeadlineReminderTemplate } from "@/email/templates/deadline-reminder.template";

describe("AccessCodeDeliveryTemplate", () => {
  it("builds the access-code delivery element with an absolute DU login url", () => {
    const element = AccessCodeDeliveryTemplate({
      accessCode: "2025-CS-A7K9",
      departmentName: "Computer Science",
      expirationLabel: "20 Aug 2026 12:00",
      loginUrl: "https://procureline.example.com/access/department-user",
      tenantName: "Procureline Test University",
    });

    const serialized = JSON.stringify(element);
    expect(React.isValidElement(element)).toBe(true);
    expect(serialized).toContain("2025-CS-A7K9");
    expect(serialized).toContain("Computer Science");
    expect(serialized).toContain("https://procureline.example.com/access/department-user");
  });
});

describe("DeadlineReminderTemplate", () => {
  it("renders the reminder offset and deadline label", () => {
    const element = DeadlineReminderTemplate({
      deadlineLabel: "20 Aug 2026, 15:00 GMT+3",
      fiscalYearLabel: "2026-2027",
      offsetDays: 3,
      tenantName: "Procureline Test University",
    });

    const serialized = JSON.stringify(element);
    expect(React.isValidElement(element)).toBe(true);
    expect(serialized).toContain("2026-2027");
    expect(serialized).toContain("3 day");
    expect(serialized).toContain("20 Aug 2026, 15:00 GMT+3");
  });
});

describe("DeadlineExtensionTemplate", () => {
  it("renders the extended deadline label", () => {
    const element = DeadlineExtensionTemplate({
      deadlineLabel: "25 Aug 2026, 15:00 GMT+3",
      fiscalYearLabel: "2026-2027",
      tenantName: "Procureline Test University",
    });

    const serialized = JSON.stringify(element);
    expect(React.isValidElement(element)).toBe(true);
    expect(serialized).toContain("2026-2027");
    expect(serialized).toContain("25 Aug 2026, 15:00 GMT+3");
  });
});
