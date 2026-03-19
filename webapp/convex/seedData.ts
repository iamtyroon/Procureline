import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Seed subscription tiers with initial data.
 * Idempotent — skips if tiers already exist.
 * Run via Convex dashboard or CLI: npx convex run seedData:seedSubscriptionTiers
 */
export const seedSubscriptionTiers = mutation({
    args: {},
    handler: async (ctx) => {
        const existing = await ctx.db.query("subscriptionTiers").first();
        if (existing) {
            console.log("Tiers already seeded — skipping");
            return { seeded: false, message: "Tiers already exist" };
        }

        const tiers = [
            {
                tierName: "Free",
                slug: "free",
                priceUSD: 0,
                billingCycle: "annual",
                description: "Perfect for pilots and small departments",
                features: [
                    "10 departments",
                    "20 categories",
                    "50 items per category",
                    "Basic Blockly interface",
                    "Limited Excel export",
                    "Email support (48h response)",
                ],
                limits: {
                    departments: 10 as number | string,
                    categories: 20 as number | string,
                    itemsPerCategory: 50 as number | string,
                    users: 5 as number | string,
                    storage: "1GB",
                    apiAccess: false,
                    ssoLdap: false,
                },
                isPopular: false,
                displayOrder: 1,
                isActive: true,
            },
            {
                tierName: "Starter",
                slug: "starter",
                priceUSD: 3850,
                billingCycle: "annual",
                description: "For small to medium universities",
                features: [
                    "30 departments",
                    "60 categories",
                    "150 items per category",
                    "Full Blockly interface",
                    "Bulk import (100 rows)",
                    "Excel export (GOK templates)",
                    "Email support (24h response)",
                    "Quarterly compliance reports",
                ],
                limits: {
                    departments: 30 as number | string,
                    categories: 60 as number | string,
                    itemsPerCategory: 150 as number | string,
                    users: 15 as number | string,
                    storage: "10GB",
                    apiAccess: false,
                    ssoLdap: false,
                },
                isPopular: false,
                displayOrder: 2,
                isActive: true,
            },
            {
                tierName: "Professional",
                slug: "professional",
                priceUSD: 9230,
                billingCycle: "annual",
                description: "For large universities",
                features: [
                    "100 departments",
                    "200 categories",
                    "500 items per category",
                    "Advanced Blockly features",
                    "Unlimited bulk import",
                    "Custom Excel templates",
                    "Audit trail reports",
                    "Plan consolidation",
                    "Priority email support (12h response)",
                    "Monthly compliance reports",
                ],
                limits: {
                    departments: 100 as number | string,
                    categories: 200 as number | string,
                    itemsPerCategory: 500 as number | string,
                    users: 50 as number | string,
                    storage: "50GB",
                    apiAccess: true,
                    ssoLdap: false,
                },
                isPopular: true,
                displayOrder: 3,
                isActive: true,
            },
            {
                tierName: "Enterprise",
                slug: "enterprise",
                priceUSD: 18460,
                billingCycle: "annual",
                description: "For government agencies and consortiums",
                features: [
                    "Unlimited departments",
                    "Unlimited categories",
                    "Unlimited items",
                    "Custom Blockly blocks",
                    "API access",
                    "SSO/LDAP integration",
                    "Custom compliance rules",
                    "White-label options",
                    "Dedicated account manager",
                    "24/7 phone support",
                    "On-premise deployment option",
                ],
                limits: {
                    departments: "Unlimited" as number | string,
                    categories: "Unlimited" as number | string,
                    itemsPerCategory: "Unlimited" as number | string,
                    users: "Unlimited" as number | string,
                    storage: "Unlimited",
                    apiAccess: true,
                    ssoLdap: true,
                },
                isPopular: false,
                displayOrder: 4,
                isActive: true,
            },
        ];

        for (const tier of tiers) {
            await ctx.db.insert("subscriptionTiers", tier);
        }

        console.log("Seeded 4 subscription tiers");
        return { seeded: true, message: "Seeded 4 subscription tiers" };
    },
});

/**
 * List current tenant-scoped role assignments by email to help local/dev setup.
 * Run via CLI: npx convex run seedData:listTenantRoleAssignments
 */
export const listTenantRoleAssignments = query({
    args: {},
    handler: async (ctx) => {
        const tenantUsers = await ctx.db.query("tenantUsers").collect();
        const users = await Promise.all(
            tenantUsers.map(async (tenantUser) => ({
                email:
                    (await ctx.db.get(tenantUser.userId))?.email ??
                    "unknown-email",
                role: tenantUser.role,
                tenantId: String(tenantUser.tenantId),
                tenantUserId: String(tenantUser._id),
                userId: String(tenantUser.userId),
                isActive: tenantUser.isActive,
            })),
        );

        return users.sort((left, right) => left.email.localeCompare(right.email));
    },
});

/**
 * Update an existing tenant-scoped account to a different role for local/dev validation.
 * This intentionally only works when the user has exactly one active tenant role.
 * Run via CLI:
 * npx convex run seedData:setTenantRoleByEmail "{\"email\":\"you@example.com\",\"role\":\"procurement_officer\"}"
 */
export const setTenantRoleByEmail = mutation({
    args: {
        email: v.string(),
        role: v.union(
            v.literal("tenant_admin"),
            v.literal("procurement_officer"),
            v.literal("department_user"),
        ),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();

        if (matchingUsers.length === 0) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: `No auth user found for ${normalizedEmail}.`,
            });
        }

        if (matchingUsers.length > 1) {
            throw new ConvexError({
                code: "DATA_INTEGRITY_ERROR",
                message: `Multiple auth users found for ${normalizedEmail}.`,
            });
        }

        const user = matchingUsers.at(0);
        if (user === undefined) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: `No auth user found for ${normalizedEmail}.`,
            });
        }

        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        const activeTenantUsers = tenantUsers.filter((tenantUser) => tenantUser.isActive);

        if (activeTenantUsers.length !== 1) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    "This helper requires exactly one active tenant role for the target user.",
            });
        }

        const activeTenantUser = activeTenantUsers.at(0);
        if (activeTenantUser === undefined) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    "This helper requires exactly one active tenant role for the target user.",
            });
        }

        await ctx.db.patch(activeTenantUser._id, {
            role: args.role,
        });

        return {
            email: normalizedEmail,
            previousRole: activeTenantUser.role,
            role: args.role,
            tenantId: String(activeTenantUser.tenantId),
            tenantUserId: String(activeTenantUser._id),
        };
    },
});
