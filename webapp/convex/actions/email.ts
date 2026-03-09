"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { callNestService, getServiceActorContext } from "./_helpers";

export const queueTransactionalEmail = action({
  args: {
    idempotencyKey: v.string(),
    subject: v.string(),
    template: v.union(
      v.literal("generic-notification"),
      v.literal("billing-support"),
    ),
    templateProps: v.optional(v.any()),
    to: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    return callNestService(ctx, {
      actor,
      body: args,
      path: "/api/services/email/send",
    });
  },
});
