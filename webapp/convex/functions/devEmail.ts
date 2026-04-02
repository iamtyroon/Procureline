import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "../_generated/server";
import { resolveEmailTransportMode } from "../../lib/email/transport";

const emailTagValidator = v.object({
    name: v.string(),
    value: v.string(),
});

export const captureMessage = internalMutation({
    args: {
        debugCode: v.optional(v.string()),
        debugLink: v.optional(v.string()),
        from: v.string(),
        html: v.optional(v.string()),
        idempotencyKey: v.optional(v.string()),
        messageType: v.string(),
        metadata: v.optional(v.any()),
        subject: v.string(),
        tags: v.optional(v.array(emailTagValidator)),
        text: v.optional(v.string()),
        to: v.array(v.string()),
        transport: v.literal("dev_inbox"),
    },
    returns: v.object({
        captureId: v.id("devEmailMessages"),
    }),
    handler: async (ctx, args) => {
        if (args.to.length === 0) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: "At least one recipient is required.",
            });
        }
        const primaryRecipient = args.to[0];
        if (!primaryRecipient) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: "A primary recipient is required.",
            });
        }

        if (args.idempotencyKey) {
            const existing = await ctx.db
                .query("devEmailMessages")
                .withIndex("by_idempotencyKey", (q) =>
                    q.eq("idempotencyKey", args.idempotencyKey),
                )
                .first();
            if (existing) {
                return {
                    captureId: existing._id,
                };
            }
        }

        const captureId = await ctx.db.insert("devEmailMessages", {
            createdAt: Date.now(),
            debugCode: args.debugCode,
            debugLink: args.debugLink,
            from: args.from,
            html: args.html,
            idempotencyKey: args.idempotencyKey,
            messageType: args.messageType,
            metadata: args.metadata,
            primaryRecipient,
            subject: args.subject,
            tags: args.tags,
            text: args.text,
            to: args.to,
            transport: args.transport,
        });

        return {
            captureId,
        };
    },
});

export const listRecentMessages = query({
    args: {},
    returns: v.array(
        v.object({
            _creationTime: v.number(),
            _id: v.id("devEmailMessages"),
            createdAt: v.number(),
            debugCode: v.optional(v.string()),
            debugLink: v.optional(v.string()),
            from: v.string(),
            html: v.optional(v.string()),
            messageType: v.string(),
            metadata: v.optional(v.any()),
            primaryRecipient: v.string(),
            subject: v.string(),
            text: v.optional(v.string()),
            to: v.array(v.string()),
        }),
    ),
    handler: async (ctx) => {
        if (resolveEmailTransportMode(process.env.AUTH_EMAIL_TRANSPORT) !== "dev_inbox") {
            throw new ConvexError({
                code: "DEV_INBOX_DISABLED",
                message: "The development inbox is only available in dev_inbox mode.",
            });
        }

        const messages = await ctx.db
            .query("devEmailMessages")
            .withIndex("by_createdAt")
            .order("desc")
            .take(50);

        return messages.map((message) => ({
            _creationTime: message._creationTime,
            _id: message._id,
            createdAt: message.createdAt,
            debugCode: message.debugCode,
            debugLink: message.debugLink,
            from: message.from,
            html: message.html,
            messageType: message.messageType,
            metadata: message.metadata,
            primaryRecipient: message.primaryRecipient,
            subject: message.subject,
            text: message.text,
            to: message.to,
        }));
    },
});
