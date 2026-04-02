import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { resolveEmailTransportMode } from "../lib/email/transport";

interface DevEmailCaptureBody {
    debugCode?: string;
    debugLink?: string;
    from?: string;
    html?: string;
    idempotencyKey?: string;
    messageType?: string;
    metadata?: Record<string, unknown>;
    subject?: string;
    tags?: Array<{ name: string; value: string }>;
    text?: string;
    to?: string[];
    transport?: "dev_inbox";
}

function constantTimeEqual(left: string, right: string): boolean {
    if (left.length !== right.length) {
        return false;
    }

    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }

    return mismatch === 0;
}

function isDevInboxEnabled(): boolean {
    return resolveEmailTransportMode(process.env.AUTH_EMAIL_TRANSPORT) === "dev_inbox";
}

function isAuthorized(request: Request): boolean {
    const expected = process.env.AUTH_DEV_INBOX_SECRET?.trim() ?? "";
    const provided = request.headers.get("x-procureline-dev-email-secret") ?? "";
    return expected.length > 0 && constantTimeEqual(expected, provided);
}

export const handleDevEmailCapture = httpAction(async (ctx, request) => {
    if (!isDevInboxEnabled()) {
        return Response.json(
            {
                success: false,
                error: {
                    code: "NOT_FOUND",
                    message: "Development inbox capture is disabled.",
                },
            },
            { status: 404 },
        );
    }

    if (!isAuthorized(request)) {
        return Response.json(
            {
                success: false,
                error: {
                    code: "UNAUTHORIZED",
                    message: "Invalid development inbox secret.",
                },
            },
            { status: 401 },
        );
    }

    const body = (await request.json()) as DevEmailCaptureBody;
    if (
        typeof body.from !== "string" ||
        typeof body.subject !== "string" ||
        typeof body.messageType !== "string" ||
        !Array.isArray(body.to) ||
        body.transport !== "dev_inbox"
    ) {
        return Response.json(
            {
                success: false,
                error: {
                    code: "VALIDATION_FAILED",
                    message: "Development inbox payload is invalid.",
                },
            },
            { status: 400 },
        );
    }

    const result = await ctx.runMutation(internal.functions.devEmail.captureMessage, {
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
