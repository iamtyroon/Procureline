"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { callNestService, getServiceActorContext } from "./_helpers";

export const createSubscriptionCheckout = action({
  args: {
    amount: v.number(),
    currency: v.string(),
    customerReference: v.string(),
    idempotencyKey: v.optional(v.string()),
    planCode: v.optional(v.string()),
    provider: v.union(
      v.literal("stripe"),
      v.literal("intasend"),
      v.literal("bank_transfer"),
    ),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    return callNestService(ctx, {
      actor,
      body: args,
      path: "/api/services/payments/subscriptions",
    });
  },
});

export const verifyPayment = action({
  args: {
    metadata: v.optional(v.any()),
    paymentReference: v.string(),
    provider: v.union(
      v.literal("stripe"),
      v.literal("intasend"),
      v.literal("bank_transfer"),
    ),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    return callNestService(ctx, {
      actor,
      body: args,
      path: "/api/services/payments/verification",
    });
  },
});

export const verifyManualBankTransfer = action({
  args: {
    amount: v.number(),
    idempotencyKey: v.optional(v.string()),
    notes: v.optional(v.string()),
    paymentReference: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    return callNestService(ctx, {
      actor,
      body: args,
      path: "/api/services/payments/bank-transfer/verify",
    });
  },
});
