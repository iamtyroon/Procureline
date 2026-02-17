import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    subscriptionTiers: defineTable({
        tierName: v.string(),
        slug: v.string(),
        priceUSD: v.number(),
        billingCycle: v.string(),
        description: v.string(),
        features: v.array(v.string()),
        limits: v.object({
            departments: v.union(v.number(), v.string()),
            categories: v.union(v.number(), v.string()),
            itemsPerCategory: v.union(v.number(), v.string()),
            users: v.union(v.number(), v.string()),
            storage: v.string(),
            apiAccess: v.boolean(),
            ssoLdap: v.boolean(),
        }),
        isPopular: v.boolean(),
        displayOrder: v.number(),
        isActive: v.boolean(),
    })
        .index("by_slug", ["slug"])
        .index("by_display_order", ["displayOrder", "isActive"]),
});
