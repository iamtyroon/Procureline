"use node";

import { resolveDevInboxCaptureUrl, resolveEmailTransportMode, type EmailTransportMode } from "../lib/email/transport";

export interface EmailTag {
    name: string;
    value: string;
}

export interface AppEmailMessage {
    debugCode?: string;
    debugLink?: string;
    from: string;
    html?: string;
    idempotencyKey?: string;
    messageType: string;
    metadata?: Record<string, unknown>;
    subject: string;
    tags?: EmailTag[];
    text?: string;
    to: string[];
}

export interface AppEmailResult {
    captureId?: string;
    errorMessage?: string;
    messageId?: string;
    sent: boolean;
    transport: EmailTransportMode;
}

function resolveTransportMode(): EmailTransportMode {
    return resolveEmailTransportMode(process.env.AUTH_EMAIL_TRANSPORT);
}

function resolveDevInboxSecret(): string {
    const secret = process.env.AUTH_DEV_INBOX_SECRET?.trim();
    if (!secret) {
        throw new Error(
            "AUTH_DEV_INBOX_SECRET must be configured when AUTH_EMAIL_TRANSPORT=dev_inbox.",
        );
    }

    return secret;
}

async function captureDevEmail(message: AppEmailMessage): Promise<AppEmailResult> {
    const response = await fetch(
        resolveDevInboxCaptureUrl(
            process.env.CONVEX_SITE_URL,
            process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
        ),
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-procureline-dev-email-secret": resolveDevInboxSecret(),
            },
            body: JSON.stringify({
                ...message,
                transport: "dev_inbox",
            }),
        },
    );

    const payload = (await response.json().catch(() => null)) as
        | {
              data?: {
                  captureId?: string;
              };
              error?: {
                  message?: string;
              };
          }
        | null;

    if (!response.ok) {
        return {
            errorMessage:
                payload?.error?.message ??
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

async function sendViaResend(message: AppEmailMessage): Promise<AppEmailResult> {
    const apiKey = process.env.AUTH_RESEND_KEY?.trim();
    if (!apiKey) {
        return {
            errorMessage: "AUTH_RESEND_KEY environment variable is not set",
            sent: false,
            transport: "resend",
        };
    }

    const headers: Record<string, string> = {
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

    const payload = (await response.json().catch(() => null)) as
        | {
              error?: unknown;
              id?: string;
          }
        | null;

    if (!response.ok) {
        return {
            errorMessage:
                payload?.error !== undefined
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

export async function sendAppEmail(
    message: AppEmailMessage,
): Promise<AppEmailResult> {
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
