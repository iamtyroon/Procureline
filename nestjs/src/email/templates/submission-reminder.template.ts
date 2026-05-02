import React from "react";

export function SubmissionReminderTemplate(props: {
  deadlineLabel: string;
  departmentName: string;
  fiscalYearLabel: string;
  loginUrl: string;
  statusLabel: string;
}): React.ReactElement {
  return React.createElement(
    "div",
    {
      style: {
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
        lineHeight: "1.6",
      },
    },
    React.createElement("h1", null, "Submission reminder"),
    React.createElement(
      "p",
      null,
      `${props.departmentName} is still open in the ${props.fiscalYearLabel} submission cycle.`,
    ),
    React.createElement(
      "p",
      null,
      `Current status: ${props.statusLabel}. Effective due date: ${props.deadlineLabel}.`,
    ),
    React.createElement(
      "p",
      null,
      React.createElement("a", { href: props.loginUrl }, "Open department entry"),
    ),
    React.createElement(
      "p",
      null,
      "This message confirms the reminder was queued. It does not guarantee delivery or submission completion.",
    ),
  );
}
