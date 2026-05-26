"use node";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoice = exports.verifyManualBankTransfer = exports.verifyPayment = exports.createSubscriptionCheckout = void 0;
const server_1 = require("../_generated/server");
const values_1 = require("convex/values");
const _helpers_1 = require("./_helpers");
exports.createSubscriptionCheckout = (0, server_1.action)({
    args: {
        amount: values_1.v.number(),
        currency: values_1.v.string(),
        customerReference: values_1.v.string(),
        idempotencyKey: values_1.v.optional(values_1.v.string()),
        planCode: values_1.v.optional(values_1.v.string()),
        provider: values_1.v.union(values_1.v.literal("stripe"), values_1.v.literal("intasend"), values_1.v.literal("bank_transfer")),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/payments/subscriptions",
        });
    },
});
exports.verifyPayment = (0, server_1.action)({
    args: {
        metadata: values_1.v.optional(values_1.v.any()),
        paymentReference: values_1.v.string(),
        provider: values_1.v.union(values_1.v.literal("stripe"), values_1.v.literal("intasend"), values_1.v.literal("bank_transfer")),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/payments/verification",
        });
    },
});
exports.verifyManualBankTransfer = (0, server_1.action)({
    args: {
        amount: values_1.v.number(),
        idempotencyKey: values_1.v.optional(values_1.v.string()),
        notes: values_1.v.optional(values_1.v.string()),
        paymentReference: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/payments/bank-transfer/verify",
        });
    },
});
exports.generateInvoice = (0, server_1.action)({
    args: {
        amount: values_1.v.number(),
        currency: values_1.v.string(),
        idempotencyKey: values_1.v.optional(values_1.v.string()),
        tenantReference: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/payments/invoices",
        });
    },
});
