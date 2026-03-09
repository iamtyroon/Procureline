import React from "react";

interface GenericNotificationProps {
  ctaLabel?: string;
  ctaUrl?: string;
  heading: string;
  message: string;
}

export function GenericNotificationTemplate(props: GenericNotificationProps): React.ReactElement {
  return React.createElement(
    "div",
    {
      style: {
        color: "#0f172a",
        fontFamily: "Georgia, serif",
        lineHeight: "1.6",
      },
    },
    React.createElement("h1", null, props.heading),
    React.createElement("p", null, props.message),
    props.ctaUrl
      ? React.createElement(
          "p",
          null,
          React.createElement(
            "a",
            {
              href: props.ctaUrl,
              style: {
                color: "#0f172a",
                fontWeight: "bold",
              },
            },
            props.ctaLabel ?? "Open Procureline",
          ),
        )
      : null,
  );
}
