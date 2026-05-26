"use node";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelTransactionalEmail = exports.queueTenantBackgroundEmail = exports.queueTransactionalEmail = void 0;
const server_1 = require("../_generated/server");
const values_1 = require("convex/values");
const _helpers_1 = require("./_helpers");
exports.queueTransactionalEmail = (0, server_1.action)({
    args: {
        deliverAt: values_1.v.optional(values_1.v.number()),
        idempotencyKey: values_1.v.string(),
        subject: values_1.v.string(),
        template: values_1.v.union(values_1.v.literal("generic-notification"), values_1.v.literal("billing-support"), values_1.v.literal("access-code-delivery"), values_1.v.literal("catalog-request-status"), values_1.v.literal("catalog-request-submitted"), values_1.v.literal("deadline-extension"), values_1.v.literal("deadline-reminder"), values_1.v.literal("plan-submission-confirmation"), values_1.v.literal("submission-reminder")),
        templateProps: values_1.v.optional(values_1.v.any()),
        to: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/email/send",
        });
    },
});
exports.queueTenantBackgroundEmail = (0, server_1.internalAction)({
    args: {
        idempotencyKey: values_1.v.string(),
        subject: values_1.v.string(),
        template: values_1.v.literal("generic-notification"),
        templateProps: values_1.v.optional(values_1.v.any()),
        tenantId: values_1.v.string(),
        to: values_1.v.string(),
        userId: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { tenantId, userId, ...body } = args;
        return (0, _helpers_1.callNestService)(ctx, {
            actor: {
                role: "tenant_admin",
                tenantId,
                userId,
            },
            body,
            path: "/api/services/email/send",
        });
    },
});
exports.cancelTransactionalEmail = (0, server_1.action)({
    args: {
        idempotencyKey: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/email/cancel",
        });
    },
});
