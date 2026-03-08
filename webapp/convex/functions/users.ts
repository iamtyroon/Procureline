import { mutation, query } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
    ACCOUNT_DEACTIVATED_REASON,
    SUBSCRIPTION_INACTIVE_REASON,
} from "../../lib/auth/session";
import { loadCurrentSessionState } from "./sessions";

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

        // Verify user exists
        const existingUser = await ctx.db.get(userId);
        if (!existingUser) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: "User record not found",
            });
        }

        // Check if user already has a tenant
        const existingTenantUser = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (existingTenantUser) {
            throw new ConvexError({
                code: "ALREADY_EXISTS",
                message: "You already have an organization",
            });
        }

        const trimmedName = args.organizationName.trim();

        // Generate subdomain
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

        // Check subdomain uniqueness
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

        // Create tenant
        const tenantId = await ctx.db.insert("tenants", {
            name: trimmedName,
            subdomain,
            tier: "free",
            status: "active",
            createdAt: Date.now(),
        });

        // Create tenant-user linkage
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
    returns: v.union(
        v.object({
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
        v.null(),
    ),
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            return null;
        }

        return await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
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

/** Get auth context including tenant status after login */
export const getAuthContext = query({
    args: {},
    returns: v.union(
        v.object({
            role: v.string(),
            isActive: v.boolean(),
            tenantStatus: v.string(),
            redirectPath: v.string(),
            isSessionValid: v.boolean(),
            sessionStatus: v.union(
                v.literal("active"),
                v.literal("expired"),
                v.literal("revoked"),
                v.literal("logged_out"),
            ),
            redirectReason: v.optional(v.string()),
            rememberMe: v.boolean(),
        }),
        v.null()
    ),
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;

        const currentSession = await loadCurrentSessionState(ctx);
        if (!currentSession) {
            return null;
        }

        if (!currentSession.state.isValid) {
            return {
                role: "user",
                isActive: true,
                tenantStatus: "active",
                redirectPath: "/login",
                isSessionValid: false,
                sessionStatus: currentSession.state.status,
                redirectReason: currentSession.state.redirectReason ?? undefined,
                rememberMe: currentSession.state.rememberMe,
            };
        }

        const tenantUser = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (!tenantUser) {
            // User exists but has no tenant linked (e.g., just signed up)
            return {
                role: "user",
                isActive: true,
                tenantStatus: "active", // Default to active so they aren't blocked from onboarding/dashboard
                redirectPath: "/dashboard",
                isSessionValid: true,
                sessionStatus: currentSession.state.status,
                redirectReason: undefined,
                rememberMe: currentSession.state.rememberMe,
            };
        }

        const tenant = await ctx.db.get(tenantUser.tenantId);
        if (!tenant) {
            return {
                role: "user",
                isActive: true,
                tenantStatus: "active",
                redirectPath: "/dashboard",
                isSessionValid: true,
                sessionStatus: currentSession.state.status,
                redirectReason: undefined,
                rememberMe: currentSession.state.rememberMe,
            };
        }

        const redirectPathByRole = {
            tenant_admin: "/tenant-admin",
            procurement_officer: "/po",
            department_user: "/du",
        } as const;

        return {
            role: tenantUser.role,
            isActive: tenantUser.isActive,
            tenantStatus: tenant.status,
            redirectPath: redirectPathByRole[tenantUser.role],
            isSessionValid: true,
            sessionStatus: currentSession.state.status,
            redirectReason:
                !tenantUser.isActive
                    ? ACCOUNT_DEACTIVATED_REASON
                    : tenant.status !== "active"
                        ? SUBSCRIPTION_INACTIVE_REASON
                        : undefined,
            rememberMe: currentSession.state.rememberMe,
        };
    },
});
