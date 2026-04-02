"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markCurrentSessionLoggedOut = exports.setTenantSelectionForSession = exports.setCurrentSessionActiveTenantSelection = exports.touchCurrentSession = exports.ensureCurrentSessionMetadata = exports.getCurrentSessionState = exports.loadCurrentSessionState = exports.loadCurrentSessionDocuments = void 0;
const server_1 = require("@convex-dev/auth/server");
const values_1 = require("convex/values");
const server_2 = require("../_generated/server");
const session_1 = require("../../lib/auth/session");
async function loadLatestSessionMetadata(ctx, sessionId) {
    const metadataRecords = await ctx.db
        .query("sessionMetadata")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect();
    return (metadataRecords.sort((left, right) => {
        if (left.createdAt !== right.createdAt) {
            return right.createdAt - left.createdAt;
        }
        return right._creationTime - left._creationTime;
    })[0] ?? null);
}
async function loadCurrentSessionDocuments(ctx) {
    const [sessionId, userId] = await Promise.all([
        (0, server_1.getAuthSessionId)(ctx),
        (0, server_1.getAuthUserId)(ctx),
    ]);
    if (!sessionId || !userId) {
        return null;
    }
    const [authSession, metadata] = await Promise.all([
        ctx.db.get(sessionId),
        loadLatestSessionMetadata(ctx, sessionId),
    ]);
    return { sessionId, userId, authSession, metadata };
}
exports.loadCurrentSessionDocuments = loadCurrentSessionDocuments;
async function loadCurrentSessionState(ctx) {
    const currentSession = await loadCurrentSessionDocuments(ctx);
    if (!currentSession) {
        return null;
    }
    return {
        sessionId: currentSession.sessionId,
        userId: currentSession.userId,
        state: (0, session_1.resolveSessionState)({
            authSession: currentSession.authSession,
            metadata: currentSession.metadata,
        }),
    };
}
exports.loadCurrentSessionState = loadCurrentSessionState;
async function assertActiveTenantMembershipSelection(ctx, args) {
    const tenantUser = await ctx.db.get(args.tenantUserId);
    if (!tenantUser ||
        !tenantUser.isActive ||
        tenantUser.userId !== args.userId ||
        tenantUser.tenantId !== args.tenantId ||
        tenantUser.role !== args.tenantRole) {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "You can only select one of your active tenant memberships",
        });
    }
}
exports.getCurrentSessionState = (0, server_2.query)({
    args: {},
    returns: values_1.v.union(values_1.v.object({
        sessionId: values_1.v.id("authSessions"),
        userId: values_1.v.id("users"),
        isValid: values_1.v.boolean(),
        status: values_1.v.union(values_1.v.literal("active"), values_1.v.literal("expired"), values_1.v.literal("revoked"), values_1.v.literal("logged_out")),
        redirectReason: values_1.v.union(values_1.v.literal("session_expired"), values_1.v.null()),
        rememberMe: values_1.v.boolean(),
        isPlatformAdminSession: values_1.v.boolean(),
        inactivityWindowMs: values_1.v.number(),
        lastActivityAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        authSessionExpirationTime: values_1.v.union(values_1.v.number(), values_1.v.null()),
    }), values_1.v.null()),
    handler: async (ctx) => {
        const currentSession = await loadCurrentSessionState(ctx);
        if (!currentSession) {
            return null;
        }
        return {
            sessionId: currentSession.sessionId,
            userId: currentSession.userId,
            ...currentSession.state,
        };
    },
});
exports.ensureCurrentSessionMetadata = (0, server_2.mutation)({
    args: {
        rememberMe: values_1.v.optional(values_1.v.boolean()),
    },
    returns: values_1.v.object({
        sessionId: values_1.v.id("authSessions"),
        userId: values_1.v.id("users"),
        rememberMe: values_1.v.boolean(),
        lastActivityAt: values_1.v.number(),
    }),
    handler: async (ctx, args) => {
        const currentSession = await loadCurrentSessionDocuments(ctx);
        if (!currentSession) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "You must be signed in to initialize a session",
            });
        }
        const existingMetadata = currentSession.metadata;
        const now = Date.now();
        const rememberMe = args.rememberMe ?? (existingMetadata ? existingMetadata.rememberMe : false);
        if (existingMetadata) {
            await ctx.db.patch(existingMetadata._id, {
                rememberMe,
                lastActivityAt: now,
            });
        }
        else {
            await ctx.db.insert("sessionMetadata", {
                sessionId: currentSession.sessionId,
                userId: currentSession.userId,
                rememberMe,
                lastActivityAt: now,
                createdAt: now,
            });
        }
        return {
            sessionId: currentSession.sessionId,
            userId: currentSession.userId,
            rememberMe,
            lastActivityAt: now,
        };
    },
});
exports.touchCurrentSession = (0, server_2.mutation)({
    args: {},
    returns: values_1.v.union(values_1.v.object({
        touched: values_1.v.boolean(),
        sessionStatus: values_1.v.union(values_1.v.literal("active"), values_1.v.literal("expired"), values_1.v.literal("revoked"), values_1.v.literal("logged_out")),
        redirectReason: values_1.v.union(values_1.v.literal("session_expired"), values_1.v.null()),
    }), values_1.v.null()),
    handler: async (ctx) => {
        const currentSession = await loadCurrentSessionDocuments(ctx);
        if (!currentSession) {
            return null;
        }
        const state = (0, session_1.resolveSessionState)({
            authSession: currentSession.authSession,
            metadata: currentSession.metadata,
        });
        if (!state.isValid) {
            const result = {
                touched: false,
                sessionStatus: state.status,
                redirectReason: state.redirectReason,
            };
            return result;
        }
        const existingMetadata = currentSession.metadata;
        if (!existingMetadata) {
            const result = {
                touched: false,
                sessionStatus: "active",
                redirectReason: state.redirectReason,
            };
            return result;
        }
        const now = Date.now();
        await ctx.db.patch(existingMetadata._id, {
            lastActivityAt: now,
        });
        const result = {
            touched: true,
            sessionStatus: "active",
            redirectReason: state.redirectReason,
        };
        return result;
    },
});
exports.setCurrentSessionActiveTenantSelection = (0, server_2.mutation)({
    args: {
        tenantId: values_1.v.id("tenants"),
        tenantRole: values_1.v.union(values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user")),
        tenantUserId: values_1.v.id("tenantUsers"),
    },
    returns: values_1.v.object({
        sessionId: values_1.v.id("authSessions"),
        tenantId: values_1.v.id("tenants"),
        tenantRole: values_1.v.union(values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user")),
        tenantUserId: values_1.v.id("tenantUsers"),
    }),
    handler: async (ctx, args) => {
        const currentSession = await loadCurrentSessionDocuments(ctx);
        if (!currentSession) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "You must be signed in to select a tenant membership",
            });
        }
        await assertActiveTenantMembershipSelection(ctx, {
            tenantId: args.tenantId,
            tenantRole: args.tenantRole,
            tenantUserId: args.tenantUserId,
            userId: currentSession.userId,
        });
        const now = Date.now();
        const existingMetadata = currentSession.metadata;
        if (existingMetadata) {
            await ctx.db.patch(existingMetadata._id, {
                activeTenantId: args.tenantId,
                activeTenantRole: args.tenantRole,
                activeTenantUserId: args.tenantUserId,
                lastActivityAt: now,
            });
        }
        else {
            await ctx.db.insert("sessionMetadata", {
                activeTenantId: args.tenantId,
                activeTenantRole: args.tenantRole,
                activeTenantUserId: args.tenantUserId,
                createdAt: now,
                lastActivityAt: now,
                rememberMe: false,
                sessionId: currentSession.sessionId,
                userId: currentSession.userId,
            });
        }
        return {
            sessionId: currentSession.sessionId,
            tenantId: args.tenantId,
            tenantRole: args.tenantRole,
            tenantUserId: args.tenantUserId,
        };
    },
});
exports.setTenantSelectionForSession = (0, server_2.internalMutation)({
    args: {
        sessionId: values_1.v.id("authSessions"),
        tenantId: values_1.v.id("tenants"),
        tenantRole: values_1.v.union(values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user")),
        tenantUserId: values_1.v.id("tenantUsers"),
        userId: values_1.v.id("users"),
    },
    returns: values_1.v.object({
        sessionId: values_1.v.id("authSessions"),
        tenantId: values_1.v.id("tenants"),
        tenantRole: values_1.v.union(values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user")),
        tenantUserId: values_1.v.id("tenantUsers"),
    }),
    handler: async (ctx, args) => {
        await assertActiveTenantMembershipSelection(ctx, args);
        const existingMetadata = await loadLatestSessionMetadata(ctx, args.sessionId);
        const now = Date.now();
        if (existingMetadata) {
            await ctx.db.patch(existingMetadata._id, {
                activeTenantId: args.tenantId,
                activeTenantRole: args.tenantRole,
                activeTenantUserId: args.tenantUserId,
                lastActivityAt: now,
            });
        }
        else {
            await ctx.db.insert("sessionMetadata", {
                activeTenantId: args.tenantId,
                activeTenantRole: args.tenantRole,
                activeTenantUserId: args.tenantUserId,
                createdAt: now,
                lastActivityAt: now,
                rememberMe: false,
                sessionId: args.sessionId,
                userId: args.userId,
            });
        }
        return {
            sessionId: args.sessionId,
            tenantId: args.tenantId,
            tenantRole: args.tenantRole,
            tenantUserId: args.tenantUserId,
        };
    },
});
exports.markCurrentSessionLoggedOut = (0, server_2.mutation)({
    args: {},
    returns: values_1.v.union(values_1.v.object({
        marked: values_1.v.boolean(),
        sessionId: values_1.v.id("authSessions"),
        userId: values_1.v.id("users"),
    }), values_1.v.null()),
    handler: async (ctx) => {
        const currentSession = await loadCurrentSessionDocuments(ctx);
        if (!currentSession) {
            return null;
        }
        const existingMetadata = currentSession.metadata;
        const now = Date.now();
        const patch = (0, session_1.createLogoutMetadataPatch)(now);
        if (existingMetadata) {
            await ctx.db.patch(existingMetadata._id, patch);
        }
        else {
            await ctx.db.insert("sessionMetadata", {
                sessionId: currentSession.sessionId,
                userId: currentSession.userId,
                rememberMe: false,
                createdAt: now,
                ...patch,
            });
        }
        return {
            marked: true,
            sessionId: currentSession.sessionId,
            userId: currentSession.userId,
        };
    },
});
