import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
    buildWebhookEventKey,
    hashWebhookPayload,
    readInvitationIdFromWebhook,
    type ResendWebhookEnvelope,
    verifyResendWebhookSignature,
} from "@/lib/procurement-officer/webhook";

export const runtime = "nodejs";

function getConvexHttpClient(): ConvexHttpClient {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
        throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
    }

    return new ConvexHttpClient(convexUrl);
}

async function sendBounceNotificationEmail(args: {
    email: string;
    eventKey: string;
    invitationEmail: string;
    invitationName: string;
    reason: string;
    tenantName: string;
}): Promise<void> {
    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) {
        return;
    }

    const fromAddress =
        process.env.AUTH_RESET_RESEND_FROM ??
        "Procureline <onboarding@resend.dev>";
    await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `po-bounce:${args.eventKey}:${args.email}`,
        },
        body: JSON.stringify({
            from: fromAddress,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
                    <h2>Procurement Officer invitation delivery failed</h2>
                    <p>The invitation for <strong>${args.invitationName}</strong> (${args.invitationEmail}) in <strong>${args.tenantName}</strong> needs attention.</p>
                    <p>Reason: ${args.reason}</p>
                    <p>Open the Procurement Officer management page to resend fresh credentials.</p>
                </div>
            `,
            subject: `${args.tenantName}: Procurement Officer invitation delivery failed`,
            tags: [
                { name: "category", value: "po_invitation_bounce" },
                { name: "tenant_name", value: args.tenantName.replace(/\s+/g, "-").toLowerCase() },
            ],
            text: [
                "Procurement Officer invitation delivery failed.",
                `${args.invitationName} (${args.invitationEmail}) in ${args.tenantName} needs attention.`,
                `Reason: ${args.reason}`,
                "Open the Procurement Officer management page to resend fresh credentials.",
            ].join("\n"),
            to: [args.email],
        }),
    }).catch(() => undefined);
}

export async function POST(request: Request): Promise<NextResponse> {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    const proxyToken = process.env.RESEND_WEBHOOK_PROXY_TOKEN;
    if (!webhookSecret || !proxyToken) {
        return NextResponse.json(
            { processed: false, reason: "missing_configuration" },
            { status: 503 },
        );
    }

    const payload = await request.text();
    const isVerified = verifyResendWebhookSignature({
        payload,
        secret: webhookSecret,
        svixId: request.headers.get("svix-id"),
        svixSignature: request.headers.get("svix-signature"),
        svixTimestamp: request.headers.get("svix-timestamp"),
    });
    if (!isVerified) {
        return NextResponse.json(
            { processed: false, reason: "invalid_signature" },
            { status: 401 },
        );
    }

    const event = JSON.parse(payload) as ResendWebhookEnvelope;
    if (event.type !== "email.bounced") {
        return NextResponse.json({ processed: true, ignored: true }, { status: 202 });
    }

    const invitationId = readInvitationIdFromWebhook(event);
    if (!invitationId) {
        return NextResponse.json(
            { processed: true, ignored: true, reason: "missing_invitation_tag" },
            { status: 202 },
        );
    }

    const eventKey = buildWebhookEventKey(event, invitationId);
    const result = await getConvexHttpClient().mutation(
        api.functions.procurementOfficerOnboarding.recordBounceFromWebhook,
        {
            bounceReason:
                event.data?.tags?.find((tag) => tag.name === "bounce_reason")?.value ??
                "email.bounced",
            invitationId: invitationId as any,
            payloadHash: hashWebhookPayload(payload),
            providerEventKey: eventKey,
            providerMessageId: event.data?.email_id,
            proxyToken,
        },
    );

    if (result.status === "processed") {
        await Promise.all(
            result.notificationEmails.map(async (email) =>
                await sendBounceNotificationEmail({
                    email,
                    eventKey,
                    invitationEmail: result.warningContext.invitationEmail,
                    invitationName: result.warningContext.invitationName,
                    reason: result.warningContext.reason,
                    tenantName: result.tenantName,
                }),
            ),
        );
    }

    return NextResponse.json({ processed: true, status: result.status }, { status: 202 });
}
