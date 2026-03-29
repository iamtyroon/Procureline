import React from "react";

interface DeadlineExtensionTemplateProps {
  deadlineLabel: string;
  fiscalYearLabel: string;
  tenantName: string;
}

export function DeadlineExtensionTemplate(
  props: DeadlineExtensionTemplateProps,
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
    React.createElement("h1", null, `${props.tenantName} deadline extended`),
    React.createElement(
      "p",
      null,
      `Your Procurement Officer extended the shared submission deadline for ${props.fiscalYearLabel}.`,
    ),
    React.createElement("p", null, `New deadline: ${props.deadlineLabel}`),
  );
}
