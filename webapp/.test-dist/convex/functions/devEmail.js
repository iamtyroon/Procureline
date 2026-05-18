"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMessages = exports.deleteMessage = exports.listRecentMessages = exports.captureMessage = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const transport_1 = require("../../lib/email/transport");
const emailTagValidator = values_1.v.object({
    name: values_1.v.string(),
    value: values_1.v.string(),
});
function ensureDevInboxEnabled() {
    if ((0, transport_1.resolveEmailTransportMode)(process.env.AUTH_EMAIL_TRANSPORT) !== "dev_inbox") {
        throw new values_1.ConvexError({
            code: "DEV_INBOX_DISABLED",
            message: "The development inbox is only available in dev_inbox mode.",
        });
    }
}
exports.captureMessage = (0, server_1.internalMutation)({
    args: {
        debugCode: values_1.v.optional(values_1.v.string()),
        debugLink: values_1.v.optional(values_1.v.string()),
        from: values_1.v.string(),
        html: values_1.v.optional(values_1.v.string()),
        idempotencyKey: values_1.v.optional(values_1.v.string()),
        messageType: values_1.v.string(),
        metadata: values_1.v.optional(values_1.v.any()),
        subject: values_1.v.string(),
        tags: values_1.v.optional(values_1.v.array(emailTagValidator)),
        text: values_1.v.optional(values_1.v.string()),
        to: values_1.v.array(values_1.v.string()),
        transport: values_1.v.literal("dev_inbox"),
    },
    returns: values_1.v.object({
        captureId: values_1.v.id("devEmailMessages"),
    }),
    handler: async (ctx, args) => {
        if (args.to.length === 0) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "At least one recipient is required.",
            });
        }
        const primaryRecipient = args.to[0];
        if (!primaryRecipient) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "A primary recipient is required.",
            });
        }
        if (args.idempotencyKey) {
            const existing = await ctx.db
                .query("devEmailMessages")
                .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
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
exports.listRecentMessages = (0, server_1.query)({
    args: {},
    returns: values_1.v.array(values_1.v.object({
        _creationTime: values_1.v.number(),
        _id: values_1.v.id("devEmailMessages"),
        createdAt: values_1.v.number(),
        debugCode: values_1.v.optional(values_1.v.string()),
        debugLink: values_1.v.optional(values_1.v.string()),
        from: values_1.v.string(),
        html: values_1.v.optional(values_1.v.string()),
        messageType: values_1.v.string(),
        metadata: values_1.v.optional(values_1.v.any()),
        primaryRecipient: values_1.v.string(),
        subject: values_1.v.string(),
        text: values_1.v.optional(values_1.v.string()),
        to: values_1.v.array(values_1.v.string()),
    })),
    handler: async (ctx) => {
        ensureDevInboxEnabled();
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
exports.deleteMessage = (0, server_1.mutation)({
    args: {
        messageId: values_1.v.id("devEmailMessages"),
    },
    returns: values_1.v.object({
        deletedCount: values_1.v.number(),
    }),
    handler: async (ctx, args) => {
        ensureDevInboxEnabled();
        const message = await ctx.db.get(args.messageId);
        if (!message) {
            return {
                deletedCount: 0,
            };
        }
        await ctx.db.delete(args.messageId);
        return {
            deletedCount: 1,
        };
    },
});
exports.deleteMessages = (0, server_1.mutation)({
    args: {
        messageIds: values_1.v.array(values_1.v.id("devEmailMessages")),
    },
    returns: values_1.v.object({
        deletedCount: values_1.v.number(),
    }),
    handler: async (ctx, args) => {
        ensureDevInboxEnabled();
        const uniqueMessageIds = Array.from(new Set(args.messageIds));
        let deletedCount = 0;
        for (const messageId of uniqueMessageIds) {
            const message = await ctx.db.get(messageId);
            if (!message) {
                continue;
            }
            await ctx.db.delete(messageId);
            deletedCount += 1;
        }
        return {
            deletedCount,
        };
    },
});
