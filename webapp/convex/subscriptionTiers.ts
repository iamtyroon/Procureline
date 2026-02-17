import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Public query — no authentication required (for landing page).
 * Returns all active subscription tiers sorted by display order.
 */
export const listPublicTiers = query({
    args: {},
    handler: async (ctx) => {
        const tiers = await ctx.db
            .query("subscriptionTiers")
            .withIndex("by_display_order")
            .filter((q) => q.eq(q.field("isActive"), true))
            .collect();

        return tiers;
    },
});

/**
 * Get a single tier by slug (for signup flow later).
 */
export const getTierBySlug = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const tier = await ctx.db
            .query("subscriptionTiers")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .first();

        if (!tier) {
            throw new Error(`Tier not found: ${args.slug}`);
        }

        return tier;
    },
});
