import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const RESEND_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

export interface ResendWebhookEnvelope {
    created_at?: string;
    data?: {
        email_id?: string;
        tags?: Array<{
            name?: string;
            value?: string;
        }>;
        to?: string[];
    };
    type?: string;
}

function decodeSecret(secret: string): Buffer {
    const normalized = secret.startsWith("whsec_")
        ? secret.slice("whsec_".length)
        : secret;
    return Buffer.from(normalized, "base64");
}

function readSignatureCandidates(signatureHeader: string): string[] {
    return signatureHeader
        .split(/\s+/)
        .flatMap((part) => part.split(" "))
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part.split(","))
        .filter((parts) => parts.length === 2 && parts[0] === "v1")
        .map((parts) => parts[1] ?? "")
        .filter(Boolean);
}

export function verifyResendWebhookSignature(args: {
    payload: string;
    secret: string;
    svixId: string | null;
    svixSignature: string | null;
    svixTimestamp: string | null;
}): boolean {
    if (!args.svixId || !args.svixSignature || !args.svixTimestamp) {
        return false;
    }

    const timestamp = Number(args.svixTimestamp);
    if (!Number.isFinite(timestamp)) {
        return false;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
        Math.abs(nowSeconds - timestamp) >
        RESEND_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
    ) {
        return false;
    }

    const signedContent = `${args.svixId}.${args.svixTimestamp}.${args.payload}`;
    const expectedSignature = createHmac("sha256", decodeSecret(args.secret))
        .update(signedContent)
        .digest("base64");

    return readSignatureCandidates(args.svixSignature).some((candidate) => {
        const expected = Buffer.from(expectedSignature);
        const actual = Buffer.from(candidate);
        return expected.length === actual.length && timingSafeEqual(expected, actual);
    });
}

export function hashWebhookPayload(payload: string): string {
    return createHash("sha256").update(payload).digest("hex");
}

export function readInvitationIdFromWebhook(
    event: ResendWebhookEnvelope,
): string | null {
    const tag = event.data?.tags?.find(
        (entry) => entry.name === "invitation_id" && typeof entry.value === "string",
    );
    return tag?.value ?? null;
}

export function readTenantIdFromWebhook(
    event: ResendWebhookEnvelope,
): string | null {
    const tag = event.data?.tags?.find(
        (entry) => entry.name === "tenant_id" && typeof entry.value === "string",
    );
    return tag?.value ?? null;
}

export function buildWebhookEventKey(
    event: ResendWebhookEnvelope,
    invitationId: string,
): string {
    return [
        event.type ?? "unknown",
        event.data?.email_id ?? "unknown-email",
        invitationId,
    ].join(":");
}
