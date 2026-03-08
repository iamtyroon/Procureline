import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "../_generated/server";
import {
    createLogoutMetadataPatch,
    resolveSessionState,
    type SessionStatus,
} from "../../lib/auth/session";

async function loadCurrentSessionDocuments(
    ctx: QueryCtx | MutationCtx,
) {
    const [sessionId, userId] = await Promise.all([
        getAuthSessionId(ctx),
        getAuthUserId(ctx),
    ]);

    if (!sessionId || !userId) {
        return null;
    }

    const [authSession, metadata] = await Promise.all([
        ctx.db.get(sessionId),
        ctx.db
            .query("sessionMetadata")
            .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
            .first(),
    ]);

    return { sessionId, userId, authSession, metadata };
}

export async function loadCurrentSessionState(
    ctx: QueryCtx | MutationCtx,
): Promise<{
    sessionId: Id<"authSessions">;
    userId: Id<"users">;
    state: ReturnType<typeof resolveSessionState>;
} | null> {
    const currentSession = await loadCurrentSessionDocuments(ctx);
    if (!currentSession) {
        return null;
    }

    return {
        sessionId: currentSession.sessionId,
        userId: currentSession.userId,
        state: resolveSessionState({
            authSession: currentSession.authSession,
            metadata: currentSession.metadata,
        }),
    };
}

export const getCurrentSessionState = query({
    args: {},
    returns: v.union(
        v.object({
            sessionId: v.id("authSessions"),
            userId: v.id("users"),
            isValid: v.boolean(),
            status: v.union(
                v.literal("active"),
                v.literal("expired"),
                v.literal("revoked"),
                v.literal("logged_out"),
            ),
            redirectReason: v.union(v.literal("session_expired"), v.null()),
            rememberMe: v.boolean(),
            inactivityWindowMs: v.number(),
            lastActivityAt: v.union(v.number(), v.null()),
            authSessionExpirationTime: v.union(v.number(), v.null()),
        }),
        v.null(),
    ),
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

export const ensureCurrentSessionMetadata = mutation({
    args: {
        rememberMe: v.optional(v.boolean()),
    },
    returns: v.object({
        sessionId: v.id("authSessions"),
        userId: v.id("users"),
        rememberMe: v.boolean(),
        lastActivityAt: v.number(),
    }),
    handler: async (ctx, args) => {
        const currentSession = await loadCurrentSessionDocuments(ctx);
        if (!currentSession) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "You must be signed in to initialize a session",
            });
        }

        const now = Date.now();
        const rememberMe =
            args.rememberMe ?? currentSession.metadata?.rememberMe ?? false;

        if (currentSession.metadata) {
            await ctx.db.patch(currentSession.metadata._id, {
                rememberMe,
                lastActivityAt: now,
            });
        } else {
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

export const touchCurrentSession = mutation({
    args: {},
    returns: v.union(
        v.object({
            touched: v.boolean(),
            sessionStatus: v.union(
                v.literal("active"),
                v.literal("expired"),
                v.literal("revoked"),
                v.literal("logged_out"),
            ),
            redirectReason: v.union(v.literal("session_expired"), v.null()),
        }),
        v.null(),
    ),
    handler: async (ctx) => {
        const currentSession = await loadCurrentSessionDocuments(ctx);
        if (!currentSession) {
            return null;
        }

        const state = resolveSessionState({
            authSession: currentSession.authSession,
            metadata: currentSession.metadata,
        });

        if (!state.isValid) {
            const result: {
                touched: boolean;
                sessionStatus: SessionStatus;
                redirectReason: "session_expired" | null;
            } = {
                touched: false,
                sessionStatus: state.status,
                redirectReason: state.redirectReason,
            };

            return result;
        }

        if (!currentSession.metadata) {
            // No metadata exists yet — ensureCurrentSessionMetadata has not run.
            // Return without creating a default record to avoid silently
            // downgrading a remember-me session to a 24h inactivity window.
            const result: {
                touched: boolean;
                sessionStatus: SessionStatus;
                redirectReason: "session_expired" | null;
            } = {
                touched: false,
                sessionStatus: "active",
                redirectReason: state.redirectReason,
            };

            return result;
        }

        const now = Date.now();

        await ctx.db.patch(currentSession.metadata._id, {
            lastActivityAt: now,
        });

        const result: {
            touched: boolean;
            sessionStatus: SessionStatus;
            redirectReason: "session_expired" | null;
        } = {
            touched: true,
            sessionStatus: "active",
            redirectReason: state.redirectReason,
        };

        return result;
    },
});

export const markCurrentSessionLoggedOut = mutation({
    args: {},
    returns: v.union(
        v.object({
            marked: v.boolean(),
            sessionId: v.id("authSessions"),
            userId: v.id("users"),
        }),
        v.null(),
    ),
    handler: async (ctx) => {
        const currentSession = await loadCurrentSessionDocuments(ctx);
        if (!currentSession) {
            return null;
        }

        const now = Date.now();
        const patch = createLogoutMetadataPatch(now);

        if (currentSession.metadata) {
            await ctx.db.patch(currentSession.metadata._id, patch);
        } else {
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
