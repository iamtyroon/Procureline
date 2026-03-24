import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
    PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE,
    PROCUREMENT_OFFICER_INVITATION_EXPIRED_MESSAGE,
    PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE,
    evaluateProcurementOfficerInvitationStatus,
    formatProcurementOfficerActivationCode,
    getProcurementOfficerActivationCodeSuffix,
    getProcurementOfficerInvitationAccessMessage,
    hashProcurementOfficerSecret,
    invalidateSupersededProcurementOfficerInvitations,
    normalizeProcurementOfficerActivationCode,
    resolveProcurementOfficerBounceStatus,
    resolveProcurementOfficerHandoff,
    scrubProcurementOfficerHandoffFromUrl,
} from "../lib/procurement-officer/invitations";
import {
    buildWebhookEventKey,
    hashWebhookPayload,
    readInvitationIdFromWebhook,
    readTenantIdFromWebhook,
    verifyResendWebhookSignature,
    type ResendWebhookEnvelope,
} from "../lib/procurement-officer/webhook";

export async function runProcurementOfficerInvitationTests(): Promise<string[]> {
    const completedTests: string[] = [];

    assert.equal(
        normalizeProcurementOfficerActivationCode(" abcd_efgh  "),
        "ABCD-EFGH",
    );
    assert.equal(
        formatProcurementOfficerActivationCode("abcd efgh1234"),
        "ABCD-EFGH-1234",
    );
    assert.equal(
        getProcurementOfficerActivationCodeSuffix("ABCD-EFGH-1234"),
        "1234",
    );
    const hashedSecret = await hashProcurementOfficerSecret("invite-secret");
    assert.equal(hashedSecret.length, 64);
    assert.match(hashedSecret, /^[a-f0-9]{64}$/);
    completedTests.push(
        "procurement officer invitation helpers normalize and hash opaque invite credentials deterministically",
    );

    assert.equal(
        scrubProcurementOfficerHandoffFromUrl(
            "/access/procurement-officer",
            "?invite=token-123&role=procurement_officer&activationCode=PO-1234",
        ),
        "/access/procurement-officer?role=procurement_officer",
    );
    completedTests.push(
        "procurement officer handoff params can be scrubbed from the browser URL after the continuation route consumes them",
    );

    assert.deepEqual(
        invalidateSupersededProcurementOfficerInvitations([
            { id: "a", status: "pending" },
            { id: "b", status: "accepted" },
        ]),
        [
            { id: "a", nextStatus: "revoked" },
            { id: "b", nextStatus: "accepted" },
        ],
    );
    assert.equal(
        evaluateProcurementOfficerInvitationStatus({
            expiresAt: 100,
            now: 101,
            status: "pending",
        }),
        "expired",
    );
    assert.equal(
        getProcurementOfficerInvitationAccessMessage({
            expiresAt: 100,
            now: 101,
            status: "pending",
            tenantIsActive: true,
        }),
        PROCUREMENT_OFFICER_INVITATION_EXPIRED_MESSAGE,
    );
    assert.equal(
        getProcurementOfficerInvitationAccessMessage({
            expiresAt: 100,
            now: 50,
            status: "pending",
            tenantIsActive: false,
        }),
        PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE,
    );
    completedTests.push(
        "procurement officer invitation state helpers fail closed for superseded, expired, and inactive-tenant cases",
    );

    assert.equal(resolveProcurementOfficerBounceStatus("pending"), "bounced");
    assert.equal(resolveProcurementOfficerBounceStatus("accepted"), "accepted");
    assert.equal(resolveProcurementOfficerBounceStatus("expired"), "expired");
    assert.equal(resolveProcurementOfficerBounceStatus("revoked"), "revoked");
    completedTests.push(
        "procurement officer bounce handling only marks still-pending invitations as bounced and preserves historical states",
    );

    assert.deepEqual(
        resolveProcurementOfficerHandoff({
            activationCode: "ACT-0001",
        }),
        {
            activationCode: "ACT-0001",
            mode: "activation_code",
        },
    );
    assert.deepEqual(
        resolveProcurementOfficerHandoff({
            activationToken: "token-123",
        }),
        {
            inviteToken: "token-123",
            mode: "invite",
        },
    );
    assert.deepEqual(
        resolveProcurementOfficerHandoff({
            activationCode: "ACT-0001",
            invite: "invite-123",
        }),
        {
            error: PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE,
            mode: null,
        },
    );
    assert.deepEqual(
        resolveProcurementOfficerHandoff({
            activationToken: "token-123",
            invite: "invite-123",
        }),
        {
            error: PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE,
            mode: null,
        },
    );
    completedTests.push(
        "procurement officer handoff resolution accepts exactly one credential family and rejects conflicting invite-link states",
    );

    const webhookEvent: ResendWebhookEnvelope = {
        data: {
            email_id: "email_123",
            tags: [
                { name: "invitation_id", value: "po_invite_123" },
                { name: "tenant_id", value: "tenant_456" },
            ],
        },
        type: "email.bounced",
    };
    assert.equal(readInvitationIdFromWebhook(webhookEvent), "po_invite_123");
    assert.equal(readTenantIdFromWebhook(webhookEvent), "tenant_456");
    assert.equal(
        buildWebhookEventKey(webhookEvent, "po_invite_123"),
        "email.bounced:email_123:po_invite_123",
    );
    assert.equal(hashWebhookPayload('{"hello":"world"}').length, 64);

    const payload = JSON.stringify(webhookEvent);
    const secretBytes = Buffer.from("procureline-resend-secret");
    const secret = `whsec_${secretBytes.toString("base64")}`;
    const svixId = "msg_123";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", secretBytes)
        .update(`${svixId}.${svixTimestamp}.${payload}`)
        .digest("base64");

    assert.equal(
        verifyResendWebhookSignature({
            payload,
            secret,
            svixId,
            svixSignature: `v1,${signature}`,
            svixTimestamp,
        }),
        true,
    );
    assert.equal(
        verifyResendWebhookSignature({
            payload,
            secret,
            svixId,
            svixSignature: "v1,invalid-signature",
            svixTimestamp,
        }),
        false,
    );
    completedTests.push(
        "procurement officer webhook helpers extract tagged invitation context and verify signed Resend-style webhook payloads",
    );

    return completedTests;
}
