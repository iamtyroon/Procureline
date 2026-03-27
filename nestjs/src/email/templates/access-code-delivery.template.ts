import React from "react";

interface AccessCodeDeliveryTemplateProps {
  accessCode: string;
  departmentName: string;
  expirationLabel: string;
  loginUrl: string;
  tenantName: string;
}

export function AccessCodeDeliveryTemplate(
  props: AccessCodeDeliveryTemplateProps,
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
    React.createElement("h1", null, `${props.tenantName} department access code`),
    React.createElement(
      "p",
      null,
      `A Procurement Officer queued a department access code for ${props.departmentName}.`,
    ),
    React.createElement("p", null, `Access code: ${props.accessCode}`),
    React.createElement("p", null, `Expires: ${props.expirationLabel}`),
    React.createElement(
      "p",
      null,
      React.createElement(
        "a",
        {
          href: props.loginUrl,
          style: {
            color: "#0f172a",
            fontWeight: "bold",
          },
        },
        "Open Department User sign-in",
      ),
    ),
  );
}
