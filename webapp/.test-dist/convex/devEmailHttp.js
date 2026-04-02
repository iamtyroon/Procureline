"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDevEmailCapture = void 0;
const server_1 = require("./_generated/server");
const api_1 = require("./_generated/api");
const transport_1 = require("../lib/email/transport");
function constantTimeEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }
    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return mismatch === 0;
}
function isDevInboxEnabled() {
    return (0, transport_1.resolveEmailTransportMode)(process.env.AUTH_EMAIL_TRANSPORT) === "dev_inbox";
}
function isAuthorized(request) {
    const expected = process.env.AUTH_DEV_INBOX_SECRET?.trim() ?? "";
    const provided = request.headers.get("x-procureline-dev-email-secret") ?? "";
    return expected.length > 0 && constantTimeEqual(expected, provided);
}
exports.handleDevEmailCapture = (0, server_1.httpAction)(async (ctx, request) => {
    if (!isDevInboxEnabled()) {
        return Response.json({
            success: false,
            error: {
                code: "NOT_FOUND",
                message: "Development inbox capture is disabled.",
            },
        }, { status: 404 });
    }
    if (!isAuthorized(request)) {
        return Response.json({
            success: false,
            error: {
                code: "UNAUTHORIZED",
                message: "Invalid development inbox secret.",
            },
        }, { status: 401 });
    }
    const body = (await request.json());
    if (typeof body.from !== "string" ||
        typeof body.subject !== "string" ||
        typeof body.messageType !== "string" ||
        !Array.isArray(body.to) ||
        body.transport !== "dev_inbox") {
        return Response.json({
            success: false,
            error: {
                code: "VALIDATION_FAILED",
                message: "Development inbox payload is invalid.",
            },
        }, { status: 400 });
    }
    const result = await ctx.runMutation(api_1.internal.functions.devEmail.captureMessage, {
        debugCode: body.debugCode,
        debugLink: body.debugLink,
        from: body.from,
        html: body.html,
        idempotencyKey: body.idempotencyKey,
        messageType: body.messageType,
        metadata: body.metadata,
        subject: body.subject,
        tags: body.tags,
        text: body.text,
        to: body.to,
        transport: "dev_inbox",
    });
    return Response.json({
        success: true,
        data: {
            captureId: String(result.captureId),
        },
    });
});
