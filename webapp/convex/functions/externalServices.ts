import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const claimSyncEvent = internalMutation({
  args: {
    actorRole: v.optional(v.string()),
    actorTenantId: v.optional(v.id("tenants")),
    actorUserId: v.optional(v.id("users")),
    eventKey: v.string(),
    eventType: v.string(),
    metadata: v.any(),
    payloadHash: v.string(),
    provider: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal("claimed"), v.literal("duplicate")),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("externalServiceSyncEvents")
      .withIndex("by_eventKey", (query) => query.eq("eventKey", args.eventKey))
      .first();

    if (existing) {
      return { status: "duplicate" as const };
    }

    await ctx.db.insert("externalServiceSyncEvents", {
      actorRole: args.actorRole,
      actorTenantId: args.actorTenantId,
      actorUserId: args.actorUserId,
      claimedAt: Date.now(),
      durableChanges: [],
      eventKey: args.eventKey,
      eventType: args.eventType,
      metadata: args.metadata,
      payloadHash: args.payloadHash,
      provider: args.provider,
      status: "claimed",
      updatedAt: Date.now(),
    });

    return { status: "claimed" as const };
  },
});

export const completeSyncEvent = internalMutation({
  args: {
    durableChanges: v.array(v.any()),
    eventKey: v.string(),
    result: v.any(),
  },
  returns: v.object({
    status: v.literal("completed"),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("externalServiceSyncEvents")
      .withIndex("by_eventKey", (query) => query.eq("eventKey", args.eventKey))
      .first();

    if (!existing) {
      throw new Error(`No sync event found for ${args.eventKey}`);
    }

    await ctx.db.patch(existing._id, {
      durableChanges: args.durableChanges,
      processedAt: Date.now(),
      result: args.result,
      status: "completed",
      updatedAt: Date.now(),
    });

    return { status: "completed" as const };
  },
});

export const failSyncEvent = internalMutation({
  args: {
    durableChanges: v.optional(v.array(v.any())),
    error: v.object({
      code: v.string(),
      message: v.string(),
    }),
    eventKey: v.string(),
  },
  returns: v.object({
    status: v.literal("failed"),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("externalServiceSyncEvents")
      .withIndex("by_eventKey", (query) => query.eq("eventKey", args.eventKey))
      .first();

    if (!existing) {
      throw new Error(`No sync event found for ${args.eventKey}`);
    }

    await ctx.db.patch(existing._id, {
      durableChanges: args.durableChanges ?? existing.durableChanges,
      lastError: args.error,
      status: "failed",
      updatedAt: Date.now(),
    });

    return { status: "failed" as const };
  },
});
