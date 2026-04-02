"use node";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAppEmail = void 0;
const transport_1 = require("../lib/email/transport");
function resolveTransportMode() {
    return (0, transport_1.resolveEmailTransportMode)(process.env.AUTH_EMAIL_TRANSPORT);
}
function resolveDevInboxSecret() {
    const secret = process.env.AUTH_DEV_INBOX_SECRET?.trim();
    if (!secret) {
        throw new Error("AUTH_DEV_INBOX_SECRET must be configured when AUTH_EMAIL_TRANSPORT=dev_inbox.");
    }
    return secret;
}
async function captureDevEmail(message) {
    const response = await fetch((0, transport_1.resolveDevInboxCaptureUrl)(process.env.CONVEX_SITE_URL, process.env.NEXT_PUBLIC_CONVEX_SITE_URL), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-procureline-dev-email-secret": resolveDevInboxSecret(),
        },
        body: JSON.stringify({
            ...message,
            transport: "dev_inbox",
        }),
    });
    const payload = (await response.json().catch(() => null));
    if (!response.ok) {
        return {
            errorMessage: payload?.error?.message ??
                "Development inbox capture failed.",
            sent: false,
            transport: "dev_inbox",
        };
    }
    return {
        captureId: payload?.data?.captureId,
        sent: true,
        transport: "dev_inbox",
    };
}
async function sendViaResend(message) {
    const apiKey = process.env.AUTH_RESEND_KEY?.trim();
    if (!apiKey) {
        return {
            errorMessage: "AUTH_RESEND_KEY environment variable is not set",
            sent: false,
            transport: "resend",
        };
    }
    const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
    };
    if (message.idempotencyKey) {
        headers["Idempotency-Key"] = message.idempotencyKey;
    }
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers,
        body: JSON.stringify({
            from: message.from,
            html: message.html,
            subject: message.subject,
            tags: message.tags,
            text: message.text,
            to: message.to,
        }),
    });
    const payload = (await response.json().catch(() => null));
    if (!response.ok) {
        return {
            errorMessage: payload?.error !== undefined
                ? JSON.stringify(payload.error)
                : `Resend returned ${response.status}.`,
            sent: false,
            transport: "resend",
        };
    }
    return {
        messageId: payload?.id,
        sent: true,
        transport: "resend",
    };
}
async function sendAppEmail(message) {
    if (message.to.length === 0) {
        return {
            errorMessage: "At least one recipient is required.",
            sent: false,
            transport: resolveTransportMode(),
        };
    }
    if (resolveTransportMode() === "dev_inbox") {
        return await captureDevEmail(message);
    }
    return await sendViaResend(message);
}
exports.sendAppEmail = sendAppEmail;
