import React from "react";

interface DeadlineReminderTemplateProps {
  deadlineLabel: string;
  fiscalYearLabel: string;
  offsetDays: number;
  tenantName: string;
}

export function DeadlineReminderTemplate(
  props: DeadlineReminderTemplateProps,
): React.ReactElement {
  return React.createElement(
    "div",
    {
      style: {
        color: "#0f172a",
        fontFamily: "Georgia, serif",
        lineHeight: "1.6",
      },
    },
    React.createElement("h1", null, `${props.tenantName} deadline reminder`),
    React.createElement(
      "p",
      null,
      `The shared submission deadline for ${props.fiscalYearLabel} is approaching.`,
    ),
    React.createElement(
      "p",
      null,
      `${props.offsetDays} day${props.offsetDays === 1 ? "" : "s"} remain before submissions close.`,
    ),
    React.createElement("p", null, `Deadline: ${props.deadlineLabel}`),
  );
}
