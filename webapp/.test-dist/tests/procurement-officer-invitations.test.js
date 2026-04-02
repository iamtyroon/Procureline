"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcurementOfficerInvitationTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const invitations_1 = require("../lib/procurement-officer/invitations");
const webhook_1 = require("../lib/procurement-officer/webhook");
async function runProcurementOfficerInvitationTests() {
    const completedTests = [];
    strict_1.default.equal((0, invitations_1.normalizeProcurementOfficerActivationCode)(" abcd_efgh  "), "ABCD-EFGH");
    strict_1.default.equal((0, invitations_1.formatProcurementOfficerActivationCode)("abcd efgh1234"), "ABCD-EFGH-1234");
    strict_1.default.equal((0, invitations_1.getProcurementOfficerActivationCodeSuffix)("ABCD-EFGH-1234"), "1234");
    const hashedSecret = await (0, invitations_1.hashProcurementOfficerSecret)("invite-secret");
    strict_1.default.equal(hashedSecret.length, 64);
    strict_1.default.match(hashedSecret, /^[a-f0-9]{64}$/);
    completedTests.push("procurement officer invitation helpers normalize and hash opaque invite credentials deterministically");
    strict_1.default.equal((0, invitations_1.scrubProcurementOfficerHandoffFromUrl)("/access/procurement-officer", "?invite=token-123&role=procurement_officer&activationCode=PO-1234"), "/access/procurement-officer?role=procurement_officer");
    completedTests.push("procurement officer handoff params can be scrubbed from the browser URL after the continuation route consumes them");
    strict_1.default.deepEqual((0, invitations_1.invalidateSupersededProcurementOfficerInvitations)([
        { id: "a", status: "pending" },
        { id: "b", status: "accepted" },
    ]), [
        { id: "a", nextStatus: "revoked" },
        { id: "b", nextStatus: "accepted" },
    ]);
    strict_1.default.equal((0, invitations_1.evaluateProcurementOfficerInvitationStatus)({
        expiresAt: 100,
        now: 101,
        status: "pending",
    }), "expired");
    strict_1.default.equal((0, invitations_1.getProcurementOfficerInvitationAccessMessage)({
        expiresAt: 100,
        now: 101,
        status: "pending",
        tenantIsActive: true,
    }), invitations_1.PROCUREMENT_OFFICER_INVITATION_EXPIRED_MESSAGE);
    strict_1.default.equal((0, invitations_1.getProcurementOfficerInvitationAccessMessage)({
        expiresAt: 100,
        now: 50,
        status: "pending",
        tenantIsActive: false,
    }), invitations_1.PROCUREMENT_OFFICER_TENANT_INACTIVE_MESSAGE);
    completedTests.push("procurement officer invitation state helpers fail closed for superseded, expired, and inactive-tenant cases");
    strict_1.default.equal((0, invitations_1.getProcurementOfficerInvitationAccessMessage)({
        expiresAt: 100,
        now: 50,
        status: "accepted",
        tenantIsActive: true,
    }), null);
    strict_1.default.equal((0, invitations_1.canReuseAcceptedProcurementOfficerInvitation)({
        acceptedByUserId: "user-1",
        acceptedTenantUserId: "tenant-user-1",
        existingUserId: "user-1",
        status: "accepted",
        tenantMembershipId: "tenant-user-1",
        tenantMembershipRole: "procurement_officer",
    }), true);
    strict_1.default.equal((0, invitations_1.canReuseAcceptedProcurementOfficerInvitation)({
        acceptedByUserId: "user-1",
        acceptedTenantUserId: "tenant-user-1",
        existingUserId: "user-1",
        status: "accepted",
        tenantMembershipId: "tenant-user-1",
        tenantMembershipRole: "tenant_admin",
    }), false);
    completedTests.push("accepted procurement officer invitations stay reusable for the originally onboarded procurement officer without reopening access to other roles");
    strict_1.default.equal((0, invitations_1.resolveProcurementOfficerBounceStatus)("pending"), "bounced");
    strict_1.default.equal((0, invitations_1.resolveProcurementOfficerBounceStatus)("accepted"), "accepted");
    strict_1.default.equal((0, invitations_1.resolveProcurementOfficerBounceStatus)("expired"), "expired");
    strict_1.default.equal((0, invitations_1.resolveProcurementOfficerBounceStatus)("revoked"), "revoked");
    completedTests.push("procurement officer bounce handling only marks still-pending invitations as bounced and preserves historical states");
    strict_1.default.deepEqual((0, invitations_1.resolveProcurementOfficerHandoff)({
        activationCode: "ACT-0001",
    }), {
        activationCode: "ACT-0001",
        mode: "activation_code",
    });
    strict_1.default.deepEqual((0, invitations_1.resolveProcurementOfficerHandoff)({
        activationToken: "token-123",
    }), {
        inviteToken: "token-123",
        mode: "invite",
    });
    strict_1.default.deepEqual((0, invitations_1.resolveProcurementOfficerHandoff)({
        activationCode: "ACT-0001",
        invite: "invite-123",
    }), {
        error: invitations_1.PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE,
        mode: null,
    });
    strict_1.default.deepEqual((0, invitations_1.resolveProcurementOfficerHandoff)({
        activationToken: "token-123",
        invite: "invite-123",
    }), {
        error: invitations_1.PROCUREMENT_OFFICER_CONFLICTING_HANDOFF_MESSAGE,
        mode: null,
    });
    completedTests.push("procurement officer handoff resolution accepts exactly one credential family and rejects conflicting invite-link states");
    const webhookEvent = {
        data: {
            email_id: "email_123",
            tags: [
                { name: "invitation_id", value: "po_invite_123" },
                { name: "tenant_id", value: "tenant_456" },
            ],
        },
        type: "email.bounced",
    };
    strict_1.default.equal((0, webhook_1.readInvitationIdFromWebhook)(webhookEvent), "po_invite_123");
    strict_1.default.equal((0, webhook_1.readTenantIdFromWebhook)(webhookEvent), "tenant_456");
    strict_1.default.equal((0, webhook_1.buildWebhookEventKey)(webhookEvent, "po_invite_123"), "email.bounced:email_123:po_invite_123");
    strict_1.default.equal((0, webhook_1.hashWebhookPayload)('{"hello":"world"}').length, 64);
    const payload = JSON.stringify(webhookEvent);
    const secretBytes = Buffer.from("procureline-resend-secret");
    const secret = `whsec_${secretBytes.toString("base64")}`;
    const svixId = "msg_123";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const signature = (0, node_crypto_1.createHmac)("sha256", secretBytes)
        .update(`${svixId}.${svixTimestamp}.${payload}`)
        .digest("base64");
    strict_1.default.equal((0, webhook_1.verifyResendWebhookSignature)({
        payload,
        secret,
        svixId,
        svixSignature: `v1,${signature}`,
        svixTimestamp,
    }), true);
    strict_1.default.equal((0, webhook_1.verifyResendWebhookSignature)({
        payload,
        secret,
        svixId,
        svixSignature: "v1,invalid-signature",
        svixTimestamp,
    }), false);
    completedTests.push("procurement officer webhook helpers extract tagged invitation context and verify signed Resend-style webhook payloads");
    return completedTests;
}
exports.runProcurementOfficerInvitationTests = runProcurementOfficerInvitationTests;
