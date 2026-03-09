import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import {
    readTenantByIdForCurrentTenant,
    readTenantByIdWithPlatformAdminBypass,
} from "./_tenantGuard";

const tenantRecordValidator = v.object({
    _id: v.id("tenants"),
    _creationTime: v.number(),
    name: v.string(),
    subdomain: v.string(),
    tier: v.union(
        v.literal("free"),
        v.literal("starter"),
        v.literal("professional"),
        v.literal("enterprise"),
    ),
    status: v.union(
        v.literal("active"),
        v.literal("suspended"),
        v.literal("cancelled"),
    ),
    createdAt: v.number(),
});

/**
 * Generate a URL-safe subdomain from organization name.
 * Lowercases, replaces non-alphanumeric runs with hyphens, trims hyphens.
 */
function generateSubdomain(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * Create a new tenant with Free tier status.
 * Validates subdomain uniqueness to prevent collisions.
 *
 * Internal-only: public tenant creation is handled through
 * `registerWithTenant` in `users.ts`, which authenticates the caller
 * and creates the tenant + tenantUser atomically.
 */
export const create = internalMutation({
    args: {
        name: v.string(),
    },
    returns: v.id("tenants"),
    handler: async (ctx, args) => {
        const trimmedName = args.name.trim();

        if (trimmedName.length < 2) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: "organizationName",
                message: "Organization name must be at least 2 characters",
            });
        }

        if (trimmedName.length > 100) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: "organizationName",
                message: "Organization name must be less than 100 characters",
            });
        }

        const subdomain = generateSubdomain(trimmedName);

        if (subdomain.length === 0) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: "organizationName",
                message:
                    "Organization name must contain at least one letter or number",
            });
        }

        // Check subdomain uniqueness
        const existing = await ctx.db
            .query("tenants")
            .withIndex("by_subdomain", (q) => q.eq("subdomain", subdomain))
            .first();

        if (existing) {
            throw new ConvexError({
                code: "ALREADY_EXISTS",
                field: "organizationName",
                message: "An organization with this name already exists",
            });
        }

        const tenantId = await ctx.db.insert("tenants", {
            name: trimmedName,
            subdomain,
            tier: "free",
            status: "active",
            createdAt: Date.now(),
        });

        return tenantId;
    },
});

/**
 * Get tenant by ID for the current authenticated tenant user.
 *
 * Query-safe: enforces same-tenant isolation without writing audit events.
 * Cross-tenant probes return `null` (safe not-found semantics).
 */
export const getById = query({
    args: { tenantId: v.id("tenants") },
    returns: v.union(tenantRecordValidator, v.null()),
    handler: async (ctx, args) =>
        await readTenantByIdForCurrentTenant(ctx, args.tenantId),
});

/** Read a tenant by ID through the explicit audited platform-admin bypass path */
export const getByIdForPlatformAdmin = mutation({
    args: { tenantId: v.id("tenants") },
    returns: v.union(tenantRecordValidator, v.null()),
    handler: async (ctx, args) =>
        await readTenantByIdWithPlatformAdminBypass(ctx, args.tenantId),
});
