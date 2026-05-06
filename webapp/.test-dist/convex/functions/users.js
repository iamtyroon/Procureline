"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignPlatformAdmin = exports.listCurrentActiveTenantMembershipOptions = exports.getAuthContext = exports.isEmailVerified = exports.getCurrentUserTenant = exports.registerWithTenant = void 0;
const server_1 = require("@convex-dev/auth/server");
const values_1 = require("convex/values");
const server_2 = require("../_generated/server");
const audit_1 = require("../../lib/shared/security/audit");
const pricing_1 = require("../../lib/shared/marketing/pricing");
const input_1 = require("../../lib/shared/security/input");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const _tenantGuard_1 = require("./_tenantGuard");
/**
 * Register a new user by creating a tenantUser record and a tenant.
 * Called from the frontend after Convex Auth has created the auth user.
 */
exports.registerWithTenant = (0, server_2.mutation)({
    args: {
        organizationName: values_1.v.string(),
        selectedTier: values_1.v.optional(values_1.v.union(values_1.v.literal("free"), values_1.v.literal("starter"), values_1.v.literal("professional"))),
    },
    returns: values_1.v.object({
        tenantId: values_1.v.id("tenants"),
        tenantUserId: values_1.v.id("tenantUsers"),
    }),
    handler: async (ctx, args) => {
        const userId = await (0, server_1.getAuthUserId)(ctx);
        if (!userId) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "You must be signed in to register",
            });
        }
        const existingUser = await ctx.db.get(userId);
        if (!existingUser) {
            throw new values_1.ConvexError({
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
            throw new values_1.ConvexError({
                code: "ALREADY_EXISTS",
                message: "You already have an application role assignment",
            });
        }
        const organizationNameResult = (0, input_1.validateOrganizationNameInput)(args.organizationName);
        if (!organizationNameResult.ok) {
            await (0, _audit_1.appendAuditLogBestEffort)(ctx, (0, audit_1.buildSecurityInputRejectedEvent)({
                actor: (0, audit_1.createAuthenticatedAuditActor)({
                    role: "unassigned",
                    userId: String(userId),
                }),
                field: organizationNameResult.issue.field,
                flow: "registerWithTenant",
                outcome: organizationNameResult.issue.outcome,
                path: "functions.users.registerWithTenant",
                reason: organizationNameResult.issue.reason,
            }));
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: organizationNameResult.issue.field,
                message: organizationNameResult.issue.message,
            });
        }
        const { normalized: trimmedName, subdomain, } = organizationNameResult.value;
        const existingTenant = await ctx.db
            .query("tenants")
            .withIndex("by_subdomain", (q) => q.eq("subdomain", subdomain))
            .first();
        if (existingTenant) {
            throw new values_1.ConvexError({
                code: "ALREADY_EXISTS",
                field: "organizationName",
                message: "An organization with this name already exists",
            });
        }
        const tenantId = await ctx.db.insert("tenants", {
            name: trimmedName,
            subdomain,
            tier: (0, pricing_1.resolveTenantRegistrationTier)(args.selectedTier),
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
exports.getCurrentUserTenant = (0, server_2.query)({
    args: {},
    returns: values_1.v.object({
        _id: values_1.v.id("tenantUsers"),
        _creationTime: values_1.v.number(),
        userId: values_1.v.id("users"),
        tenantId: values_1.v.id("tenants"),
        role: values_1.v.union(values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user")),
        isActive: values_1.v.boolean(),
    }),
    handler: async (ctx) => {
        const tenantUser = await (0, _tenantGuard_1.getCurrentTenantUserMembership)(ctx);
        if (!tenantUser) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "You do not have an active tenant role",
            });
        }
        return tenantUser;
    },
});
/** Check if current user is email-verified */
exports.isEmailVerified = (0, server_2.query)({
    args: {},
    returns: values_1.v.boolean(),
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return false;
        }
        return identity.emailVerified === true;
    },
});
/** Get canonical auth and authorization context after login */
exports.getAuthContext = (0, server_2.query)({
    args: {},
    returns: values_1.v.union(_roleGuard_1.authContextValidator, values_1.v.null()),
    handler: async (ctx) => await (0, _roleGuard_1.getAuthorizationContext)(ctx),
});
exports.listCurrentActiveTenantMembershipOptions = (0, server_2.query)({
    args: {},
    returns: values_1.v.array(values_1.v.object({
        tenantId: values_1.v.id("tenants"),
        tenantName: values_1.v.string(),
        tenantRole: values_1.v.union(values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user")),
        tenantUserId: values_1.v.id("tenantUsers"),
    })),
    handler: async (ctx) => {
        const userId = await (0, server_1.getAuthUserId)(ctx);
        if (!userId) {
            return [];
        }
        const activeTenantMemberships = (await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .collect()).filter((tenantUser) => tenantUser.isActive);
        const tenantDocuments = await Promise.all(activeTenantMemberships.map(async (tenantUser) => [
            String(tenantUser.tenantId),
            await ctx.db.get(tenantUser.tenantId),
        ]));
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
            .filter((option) => option !== null)
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
exports.assignPlatformAdmin = (0, server_2.internalMutation)({
    args: {
        userId: values_1.v.id("users"),
        isActive: values_1.v.optional(values_1.v.boolean()),
    },
    returns: values_1.v.id("platformUsers"),
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
            throw new values_1.ConvexError({
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
