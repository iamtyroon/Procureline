import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
    ACCOUNT_DEACTIVATED_REASON,
    SESSION_EXPIRED_REASON,
    SUBSCRIPTION_INACTIVE_REASON,
} from "../../lib/auth/session";
import {
    buildDashboardPath,
    FORBIDDEN_ACCESS_REASON,
    getHomePathForRole,
    PENDING_ACCESS_REASON,
    resolveRoleRecords,
    ROLE_MISCONFIGURED_REASON,
    type AccessState,
    type AppRole,
    type AuthContextRole,
    type AuthNavigationReason,
    type AuthScope,
    type TenantScopedRole,
    type TenantStatusValue,
} from "../../lib/auth/roles";
import { loadCurrentSessionState } from "./sessions";

const authContextRoleValidator = v.union(
    v.literal("platform_admin"),
    v.literal("tenant_admin"),
    v.literal("procurement_officer"),
    v.literal("department_user"),
    v.literal("unassigned"),
);

const authScopeValidator = v.union(
    v.literal("platform"),
    v.literal("tenant"),
    v.literal("none"),
);

const accessStateValidator = v.union(
    v.literal("allowed"),
    v.literal("inactive"),
    v.literal("misconfigured"),
    v.literal("pending_access"),
);

const authNavigationReasonValidator = v.union(
    v.literal(ACCOUNT_DEACTIVATED_REASON),
    v.literal(FORBIDDEN_ACCESS_REASON),
    v.literal(PENDING_ACCESS_REASON),
    v.literal(ROLE_MISCONFIGURED_REASON),
    v.literal(SESSION_EXPIRED_REASON),
    v.literal(SUBSCRIPTION_INACTIVE_REASON),
);

const tenantStatusValidator = v.union(
    v.literal("active"),
    v.literal("cancelled"),
    v.literal("not_applicable"),
    v.literal("suspended"),
);

export const authContextValidator = v.object({
    accessState: accessStateValidator,
    homePath: v.string(),
    isActive: v.boolean(),
    isRoleResolved: v.boolean(),
    isSessionValid: v.boolean(),
    redirectPath: v.string(),
    rememberMe: v.boolean(),
    role: authContextRoleValidator,
    scope: authScopeValidator,
    sessionStatus: v.union(
        v.literal("active"),
        v.literal("expired"),
        v.literal("revoked"),
        v.literal("logged_out"),
    ),
    tenantId: v.optional(v.id("tenants")),
    tenantStatus: tenantStatusValidator,
    redirectReason: v.optional(authNavigationReasonValidator),
});

export interface AuthorizationContext {
    accessState: AccessState;
    homePath: string;
    isActive: boolean;
    isRoleResolved: boolean;
    isSessionValid: boolean;
    redirectPath: string;
    rememberMe: boolean;
    role: AuthContextRole;
    scope: AuthScope;
    sessionStatus: "active" | "expired" | "logged_out" | "revoked";
    tenantId?: Id<"tenants">;
    tenantStatus: TenantStatusValue;
    userId: Id<"users">;
    redirectReason?: AuthNavigationReason;
}

function createBaseContext(args: {
    accessState: AccessState;
    homePath: string;
    isActive: boolean;
    isRoleResolved: boolean;
    isSessionValid: boolean;
    redirectPath: string;
    rememberMe: boolean;
    role: AuthContextRole;
    scope: AuthScope;
    sessionStatus: AuthorizationContext["sessionStatus"];
    tenantId?: Id<"tenants">;
    tenantStatus: TenantStatusValue;
    userId: Id<"users">;
    redirectReason?: AuthNavigationReason;
}): AuthorizationContext {
    return args;
}

function unauthorizedError(message: string): never {
    throw new ConvexError({
        code: "UNAUTHORIZED",
        message,
    });
}

function createInactiveAccessContext(args: {
    reason: typeof ACCOUNT_DEACTIVATED_REASON | typeof SUBSCRIPTION_INACTIVE_REASON;
    rememberMe: boolean;
    sessionStatus: AuthorizationContext["sessionStatus"];
    userId: Id<"users">;
}): AuthorizationContext {
    return createBaseContext({
        accessState: "inactive",
        homePath: "/dashboard",
        isActive: false,
        isRoleResolved: false,
        isSessionValid: true,
        redirectPath: `/login?reason=${args.reason}`,
        rememberMe: args.rememberMe,
        role: "unassigned",
        scope: "none",
        sessionStatus: args.sessionStatus,
        tenantStatus: "not_applicable",
        userId: args.userId,
        redirectReason: args.reason,
    });
}

/**
 * Resolve the full authorization context for the current authenticated user.
 *
 * This is the canonical backend entry point consumed by `getAuthContext` (the
 * public query) and by the `require*` guard helpers. It reads the latest
 * role/session state from the database on every call, so role revocations and
 * deactivations take effect immediately without requiring a fresh login.
 *
 * **Guard coverage note (Story 1.6):** All existing Convex data-access paths
 * are appropriately handled:
 * - `getCurrentUserTenant` → guarded by `requireTenantRole`.
 * - `registerWithTenant` → runs pre-role; uses `getAuthUserId` directly.
 * - `isEmailVerified` → identity-level check, no role needed.
 * - `assignPlatformAdmin` → internal-only mutation.
 * - Session mutations → operate at session level, independent of app roles.
 * Future queries/mutations MUST use `requireAnyRole`, `requireTenantRole`,
 * or `requirePlatformAdmin` as appropriate.
 */
export async function getAuthorizationContext(
    ctx: QueryCtx | MutationCtx,
): Promise<AuthorizationContext | null> {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
        return null;
    }

    const currentSession = await loadCurrentSessionState(ctx);
    if (!currentSession) {
        return null;
    }

    if (!currentSession.state.isValid) {
        return createBaseContext({
            accessState: "inactive",
            homePath: "/dashboard",
            isActive: false,
            isRoleResolved: false,
            isSessionValid: false,
            redirectPath: `/login?reason=${SESSION_EXPIRED_REASON}`,
            rememberMe: currentSession.state.rememberMe,
            role: "unassigned",
            scope: "none",
            sessionStatus: currentSession.state.status,
            tenantStatus: "not_applicable",
            userId,
            redirectReason: currentSession.state.redirectReason ?? undefined,
        });
    }

    const [platformUsers, tenantUsers] = await Promise.all([
        ctx.db
            .query("platformUsers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .collect(),
        ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .collect(),
    ]);

    const resolvedRole = resolveRoleRecords({
        platformUsers: platformUsers.map((platformUser) => ({
            isActive: platformUser.isActive,
        })),
        tenantUsers: tenantUsers.map((tenantUser) => ({
            isActive: tenantUser.isActive,
            role: tenantUser.role,
            tenantId: tenantUser.tenantId,
        })),
    });

    if (!resolvedRole.isRoleResolved) {
        if (resolvedRole.accessState === "inactive") {
            return createInactiveAccessContext({
                reason: ACCOUNT_DEACTIVATED_REASON,
                rememberMe: currentSession.state.rememberMe,
                sessionStatus: currentSession.state.status,
                userId,
            });
        }

        const reason =
            resolvedRole.accessState === "misconfigured"
                ? ROLE_MISCONFIGURED_REASON
                : PENDING_ACCESS_REASON;

        return createBaseContext({
            accessState: resolvedRole.accessState,
            homePath: "/dashboard",
            isActive: false,
            isRoleResolved: false,
            isSessionValid: true,
            redirectPath: buildDashboardPath(reason),
            rememberMe: currentSession.state.rememberMe,
            role: "unassigned",
            scope: "none",
            sessionStatus: currentSession.state.status,
            tenantStatus: "not_applicable",
            userId,
            redirectReason: reason,
        });
    }

    if (resolvedRole.role === "platform_admin") {
        return createBaseContext({
            accessState: "allowed",
            homePath: getHomePathForRole("platform_admin"),
            isActive: true,
            isRoleResolved: true,
            isSessionValid: true,
            redirectPath: getHomePathForRole("platform_admin"),
            rememberMe: currentSession.state.rememberMe,
            role: "platform_admin",
            scope: "platform",
            sessionStatus: currentSession.state.status,
            tenantStatus: "not_applicable",
            userId,
        });
    }

    // Safe cast: tenantId originates from a Convex `Id<"tenants">` query
    // result, then passes through the pure `resolveRoleRecords` helper as
    // `string` for portability. The value is validated on the next line via
    // `ctx.db.get(tenantId)`.
    const tenantId = resolvedRole.tenantId as Id<"tenants"> | undefined;
    if (!tenantId) {
        return createBaseContext({
            accessState: "misconfigured",
            homePath: "/dashboard",
            isActive: false,
            isRoleResolved: false,
            isSessionValid: true,
            redirectPath: buildDashboardPath(ROLE_MISCONFIGURED_REASON),
            rememberMe: currentSession.state.rememberMe,
            role: "unassigned",
            scope: "none",
            sessionStatus: currentSession.state.status,
            tenantStatus: "not_applicable",
            userId,
            redirectReason: ROLE_MISCONFIGURED_REASON,
        });
    }

    const tenant = await ctx.db.get(tenantId);
    if (!tenant) {
        return createBaseContext({
            accessState: "misconfigured",
            homePath: "/dashboard",
            isActive: false,
            isRoleResolved: false,
            isSessionValid: true,
            redirectPath: buildDashboardPath(ROLE_MISCONFIGURED_REASON),
            rememberMe: currentSession.state.rememberMe,
            role: "unassigned",
            scope: "none",
            sessionStatus: currentSession.state.status,
            tenantStatus: "not_applicable",
            userId,
            redirectReason: ROLE_MISCONFIGURED_REASON,
        });
    }

    if (tenant.status !== "active") {
        return createInactiveAccessContext({
            reason: SUBSCRIPTION_INACTIVE_REASON,
            rememberMe: currentSession.state.rememberMe,
            sessionStatus: currentSession.state.status,
            userId,
        });
    }

    return createBaseContext({
        accessState: "allowed",
        homePath: getHomePathForRole(resolvedRole.role as AppRole),
        isActive: true,
        isRoleResolved: true,
        isSessionValid: true,
        redirectPath: getHomePathForRole(resolvedRole.role as AppRole),
        rememberMe: currentSession.state.rememberMe,
        role: resolvedRole.role,
        scope: "tenant",
        sessionStatus: currentSession.state.status,
        tenantId,
        tenantStatus: tenant.status,
        userId,
    });
}

export async function requireAuthenticatedUser(
    ctx: QueryCtx | MutationCtx,
): Promise<AuthorizationContext> {
    const authContext = await getAuthorizationContext(ctx);
    if (!authContext || !authContext.isSessionValid) {
        unauthorizedError("You must be signed in to access this resource");
    }

    return authContext;
}

export async function requireAnyRole(
    ctx: QueryCtx | MutationCtx,
    allowedRoles?: readonly AppRole[],
): Promise<AuthorizationContext & { role: AppRole }> {
    const authContext = await requireAuthenticatedUser(ctx);

    if (!authContext.isRoleResolved || authContext.accessState !== "allowed") {
        unauthorizedError("You do not have an active application role");
    }

    if (
        allowedRoles &&
        !allowedRoles.some((allowedRole) => allowedRole === authContext.role)
    ) {
        unauthorizedError("You are not authorized to access this resource");
    }

    return authContext as AuthorizationContext & { role: AppRole };
}

export async function requireTenantRole(
    ctx: QueryCtx | MutationCtx,
    allowedRoles: readonly TenantScopedRole[] = ["tenant_admin", "procurement_officer", "department_user"],
): Promise<AuthorizationContext & { role: TenantScopedRole; scope: "tenant"; tenantId: Id<"tenants"> }> {
    const authContext = await requireAnyRole(ctx, allowedRoles);

    if (authContext.scope !== "tenant" || !authContext.tenantId) {
        unauthorizedError("Tenant-scoped access is required for this resource");
    }

    return authContext as AuthorizationContext & {
        role: TenantScopedRole;
        scope: "tenant";
        tenantId: Id<"tenants">;
    };
}

export async function requirePlatformAdmin(
    ctx: QueryCtx | MutationCtx,
): Promise<AuthorizationContext & { role: "platform_admin"; scope: "platform" }> {
    const authContext = await requireAnyRole(ctx, ["platform_admin"]);

    if (authContext.scope !== "platform") {
        unauthorizedError("Platform administrator access is required");
    }

    return authContext as AuthorizationContext & {
        role: "platform_admin";
        scope: "platform";
    };
}
