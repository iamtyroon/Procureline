import React from "react";

interface BillingSupportTemplateProps {
  note?: string;
}

export function BillingSupportTemplate(props: BillingSupportTemplateProps): React.ReactElement {
  return React.createElement(
    "div",
    {
      style: {
        color: "#111827",
        fontFamily: "Georgia, serif",
      },
    },
    React.createElement("h1", null, "Billing and support placeholder"),
    React.createElement(
      "p",
      null,
      props.note ??
        "Procureline will expand this shared billing/support template in later stories without replacing the email module boundary.",
    ),
  );
}
