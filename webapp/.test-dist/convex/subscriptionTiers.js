"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTierBySlug = exports.listPublicTiers = void 0;
const server_1 = require("./_generated/server");
const values_1 = require("convex/values");
/**
 * Public query — no authentication required (for landing page).
 * Returns all active subscription tiers sorted by display order.
 */
exports.listPublicTiers = (0, server_1.query)({
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
exports.getTierBySlug = (0, server_1.query)({
    args: { slug: values_1.v.string() },
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
