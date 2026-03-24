"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWebhookEventKey = exports.readTenantIdFromWebhook = exports.readInvitationIdFromWebhook = exports.hashWebhookPayload = exports.verifyResendWebhookSignature = exports.RESEND_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = void 0;
const node_crypto_1 = require("node:crypto");
exports.RESEND_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;
function decodeSecret(secret) {
    const normalized = secret.startsWith("whsec_")
        ? secret.slice("whsec_".length)
        : secret;
    return Buffer.from(normalized, "base64");
}
function readSignatureCandidates(signatureHeader) {
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
function verifyResendWebhookSignature(args) {
    if (!args.svixId || !args.svixSignature || !args.svixTimestamp) {
        return false;
    }
    const timestamp = Number(args.svixTimestamp);
    if (!Number.isFinite(timestamp)) {
        return false;
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) >
        exports.RESEND_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
        return false;
    }
    const signedContent = `${args.svixId}.${args.svixTimestamp}.${args.payload}`;
    const expectedSignature = (0, node_crypto_1.createHmac)("sha256", decodeSecret(args.secret))
        .update(signedContent)
        .digest("base64");
    return readSignatureCandidates(args.svixSignature).some((candidate) => {
        const expected = Buffer.from(expectedSignature);
        const actual = Buffer.from(candidate);
        return expected.length === actual.length && (0, node_crypto_1.timingSafeEqual)(expected, actual);
    });
}
exports.verifyResendWebhookSignature = verifyResendWebhookSignature;
function hashWebhookPayload(payload) {
    return (0, node_crypto_1.createHash)("sha256").update(payload).digest("hex");
}
exports.hashWebhookPayload = hashWebhookPayload;
function readInvitationIdFromWebhook(event) {
    const tag = event.data?.tags?.find((entry) => entry.name === "invitation_id" && typeof entry.value === "string");
    return tag?.value ?? null;
}
exports.readInvitationIdFromWebhook = readInvitationIdFromWebhook;
function readTenantIdFromWebhook(event) {
    const tag = event.data?.tags?.find((entry) => entry.name === "tenant_id" && typeof entry.value === "string");
    return tag?.value ?? null;
}
exports.readTenantIdFromWebhook = readTenantIdFromWebhook;
function buildWebhookEventKey(event, invitationId) {
    return [
        event.type ?? "unknown",
        event.data?.email_id ?? "unknown-email",
        invitationId,
    ].join(":");
}
exports.buildWebhookEventKey = buildWebhookEventKey;
