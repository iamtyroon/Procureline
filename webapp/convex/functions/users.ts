import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import {
    buildSecurityInputRejectedEvent,
    createAuthenticatedAuditActor,
} from "../../lib/security/audit";
import { resolveTenantRegistrationTier } from "../../lib/marketing/pricing";
import { validateOrganizationNameInput } from "../../lib/security/input";
import { appendAuditLogBestEffort } from "./_audit";
import {
    authContextValidator,
    getAuthorizationContext,
} from "./_roleGuard";
import { getCurrentTenantUserMembership } from "./_tenantGuard";

/**
 * Register a new user by creating a tenantUser record and a tenant.
 * Called from the frontend after Convex Auth has created the auth user.
 */
export const registerWithTenant = mutation({
    args: {
        organizationName: v.string(),
        selectedTier: v.optional(
            v.union(
                v.literal("free"),
                v.literal("starter"),
                v.literal("professional"),
            ),
        ),
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

        const organizationNameResult = validateOrganizationNameInput(
            args.organizationName,
        );
        if (!organizationNameResult.ok) {
            await appendAuditLogBestEffort(
                ctx,
                buildSecurityInputRejectedEvent({
                    actor: createAuthenticatedAuditActor({
                        role: "unassigned",
                        userId: String(userId),
                    }),
                    field: organizationNameResult.issue.field,
                    flow: "registerWithTenant",
                    outcome: organizationNameResult.issue.outcome,
                    path: "functions.users.registerWithTenant",
                    reason: organizationNameResult.issue.reason,
                }),
            );

            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: organizationNameResult.issue.field,
                message: organizationNameResult.issue.message,
            });
        }

        const {
            normalized: trimmedName,
            subdomain,
        } = organizationNameResult.value;

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
            tier: resolveTenantRegistrationTier(args.selectedTier),
            status: "active",
            profileComplete: false,
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
        const tenantUser = await getCurrentTenantUserMembership(ctx);

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

export const listCurrentActiveTenantMembershipOptions = query({
    args: {},
    returns: v.array(
        v.object({
            tenantId: v.id("tenants"),
            tenantName: v.string(),
            tenantRole: v.union(
                v.literal("tenant_admin"),
                v.literal("procurement_officer"),
                v.literal("department_user"),
            ),
            tenantUserId: v.id("tenantUsers"),
        }),
    ),
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            return [];
        }

        const activeTenantMemberships = (
            await ctx.db
                .query("tenantUsers")
                .withIndex("by_userId", (q) => q.eq("userId", userId))
                .collect()
        ).filter((tenantUser) => tenantUser.isActive);

        const tenantDocuments = await Promise.all(
            activeTenantMemberships.map(async (tenantUser) => [
                String(tenantUser.tenantId),
                await ctx.db.get(tenantUser.tenantId),
            ] as const),
        );
        const tenantMap = new Map(tenantDocuments);

        return activeTenantMemberships
            .map((tenantUser) => {
                const tenant = tenantMap.get(String(tenantUser.tenantId));
                if (!tenant) {
                    return null;
                }

                return {
                    tenantId: tenantUser.tenantId,
                    tenantName: tenant.name,
                    tenantRole: tenantUser.role,
                    tenantUserId: tenantUser._id,
                };
            })
            .filter(
                (
                    option,
                ): option is {
                    tenantId: typeof activeTenantMemberships[number]["tenantId"];
                    tenantName: string;
                    tenantRole: typeof activeTenantMemberships[number]["role"];
                    tenantUserId: typeof activeTenantMemberships[number]["_id"];
                } => option !== null,
            )
            .sort((left, right) => {
                const byTenant = left.tenantName.localeCompare(right.tenantName);
                if (byTenant !== 0) {
                    return byTenant;
                }

                return left.tenantRole.localeCompare(right.tenantRole);
            });
    },
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
