import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import {
    authContextValidator,
    getAuthorizationContext,
    requireTenantRole,
} from "./_roleGuard";

/**
 * Register a new user by creating a tenantUser record and a tenant.
 * Called from the frontend after Convex Auth has created the auth user.
 */
export const registerWithTenant = mutation({
    args: {
        organizationName: v.string(),
    },
    returns: v.object({
        tenantId: v.id("tenants"),
        tenantUserId: v.id("tenantUsers"),
    }),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "You must be signed in to register",
            });
        }

        const existingUser = await ctx.db.get(userId);
        if (!existingUser) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: "User record not found",
            });
        }

        const [existingTenantUsers, existingPlatformUsers] = await Promise.all([
            ctx.db
                .query("tenantUsers")
                .withIndex("by_userId", (q) => q.eq("userId", userId))
                .collect(),
            ctx.db
                .query("platformUsers")
                .withIndex("by_userId", (q) => q.eq("userId", userId))
                .collect(),
        ]);

        if (existingTenantUsers.length > 0 || existingPlatformUsers.length > 0) {
            throw new ConvexError({
                code: "ALREADY_EXISTS",
                message: "You already have an application role assignment",
            });
        }

        const trimmedName = args.organizationName.trim();
        const subdomain = trimmedName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        if (subdomain.length === 0) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: "organizationName",
                message:
                    "Organization name must contain at least one letter or number",
            });
        }

        const existingTenant = await ctx.db
            .query("tenants")
            .withIndex("by_subdomain", (q) => q.eq("subdomain", subdomain))
            .first();

        if (existingTenant) {
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

        const tenantUserId = await ctx.db.insert("tenantUsers", {
            userId,
            tenantId,
            role: "tenant_admin",
            isActive: true,
        });

        return { tenantId, tenantUserId };
    },
});

/** Get the current user's tenant relationship */
export const getCurrentUserTenant = query({
    args: {},
    returns: v.object({
        _id: v.id("tenantUsers"),
        _creationTime: v.number(),
        userId: v.id("users"),
        tenantId: v.id("tenants"),
        role: v.union(
            v.literal("tenant_admin"),
            v.literal("procurement_officer"),
            v.literal("department_user"),
        ),
        isActive: v.boolean(),
    }),
    handler: async (ctx) => {
        const authContext = await requireTenantRole(ctx);
        const tenantUser = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId_tenantId", (q) =>
                q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId),
            )
            .first();

        if (!tenantUser) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "You do not have an active tenant role",
            });
        }

        return tenantUser;
    },
});

/** Check if current user is email-verified */
export const isEmailVerified = query({
    args: {},
    returns: v.boolean(),
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return false;
        }

        return identity.emailVerified === true;
    },
});

/** Get canonical auth and authorization context after login */
export const getAuthContext = query({
    args: {},
    returns: v.union(authContextValidator, v.null()),
    handler: async (ctx) => await getAuthorizationContext(ctx),
});

/**
 * Internal-only bootstrap path for local or seed setup of platform admins.
 * This keeps platform-role assignment outside the public mutation surface.
 */
export const assignPlatformAdmin = internalMutation({
    args: {
        userId: v.id("users"),
        isActive: v.optional(v.boolean()),
    },
    returns: v.id("platformUsers"),
    handler: async (ctx, args) => {
        const [existingTenantUsers, existingPlatformUsers] = await Promise.all([
            ctx.db
                .query("tenantUsers")
                .withIndex("by_userId", (q) => q.eq("userId", args.userId))
                .collect(),
            ctx.db
                .query("platformUsers")
                .withIndex("by_userId", (q) => q.eq("userId", args.userId))
                .collect(),
        ]);

        if (existingPlatformUsers.length > 0 || existingTenantUsers.length > 0) {
            throw new ConvexError({
                code: "ALREADY_EXISTS",
                message: "An application role record already exists for this user",
            });
        }

        return await ctx.db.insert("platformUsers", {
            userId: args.userId,
            isActive: args.isActive ?? true,
            createdAt: Date.now(),
        });
    },
});
