import type { SessionRedirectReason, SessionStatus } from "./session";

export const APP_ROLES = [
    "platform_admin",
    "tenant_admin",
    "procurement_officer",
    "department_user",
] as const;

export const TENANT_SCOPED_ROLES = [
    "tenant_admin",
    "procurement_officer",
    "department_user",
] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type TenantScopedRole = (typeof TENANT_SCOPED_ROLES)[number];
export type AuthContextRole = AppRole | "unassigned";
export type AuthScope = "platform" | "tenant" | "none";
export type AccessState =
    | "allowed"
    | "inactive"
    | "misconfigured"
    | "pending_access";
export type TenantStatusValue =
    | "active"
    | "cancelled"
    | "not_applicable"
    | "suspended";

export const FORBIDDEN_ACCESS_REASON = "forbidden_access" as const;
export const PENDING_ACCESS_REASON = "pending_access" as const;
export const ROLE_MISCONFIGURED_REASON = "role_misconfigured" as const;

export type AuthNavigationReason =
    | SessionRedirectReason
    | typeof FORBIDDEN_ACCESS_REASON
    | typeof PENDING_ACCESS_REASON
    | typeof ROLE_MISCONFIGURED_REASON;

export const ROLE_LABELS: Record<AuthContextRole, string> = {
    platform_admin: "Platform Admin",
    tenant_admin: "Tenant Admin",
    procurement_officer: "Procurement Officer",
    department_user: "Department User",
    unassigned: "Pending access",
};

export const ROLE_HOME_PATHS: Record<AppRole, string> = {
    platform_admin: "/platform-admin",
    tenant_admin: "/tenant-admin",
    procurement_officer: "/po",
    department_user: "/du",
};

const ROLE_ROUTE_PREFIXES: ReadonlyArray<{
    path: string;
    role: AppRole;
}> = [
    { path: "/platform-admin", role: "platform_admin" },
    { path: "/tenant-admin", role: "tenant_admin" },
    { path: "/po", role: "procurement_officer" },
    { path: "/du", role: "department_user" },
];

export interface PlatformUserRecordInput {
    isActive: boolean;
}

export interface TenantUserRecordInput {
    isActive: boolean;
    role: string;
    tenantId: string;
}

export interface ResolvedRoleRecordState {
    accessState: AccessState;
    isActive: boolean;
    isRoleResolved: boolean;
    role: AuthContextRole;
    scope: AuthScope;
    tenantId?: string;
}

export interface AuthContextSnapshot {
    accessState: AccessState;
    homePath: string;
    isActive: boolean;
    isRoleResolved: boolean;
    isSessionValid: boolean;
    redirectPath: string;
    rememberMe: boolean;
    role: AuthContextRole;
    scope: AuthScope;
    sessionStatus: SessionStatus;
    tenantId?: string;
    tenantStatus: TenantStatusValue;
    redirectReason?: AuthNavigationReason;
}

export function isAppRole(value: string): value is AppRole {
    return APP_ROLES.some((role) => role === value);
}

export function isTenantScopedRole(role: AppRole): role is TenantScopedRole {
    return TENANT_SCOPED_ROLES.some((tenantRole) => tenantRole === role);
}

export function getHomePathForRole(role: AppRole): string {
    return ROLE_HOME_PATHS[role];
}

export function getRoleLabel(role: AuthContextRole): string {
    return ROLE_LABELS[role];
}

export function isSegmentAwarePrefixMatch(
    pathname: string,
    routePrefix: string,
): boolean {
    return pathname === routePrefix || pathname.startsWith(`${routePrefix}/`);
}

export function getProtectedRouteRole(pathname: string): AppRole | null {
    const matchedRoute = ROLE_ROUTE_PREFIXES.find(({ path }) =>
        isSegmentAwarePrefixMatch(pathname, path),
    );

    return matchedRoute?.role ?? null;
}

export function buildDashboardPath(reason?: AuthNavigationReason): string {
    if (!reason) {
        return "/dashboard";
    }

    return `/dashboard?${new URLSearchParams({ reason }).toString()}`;
}

export function buildForbiddenRedirectPath(args: {
    attemptedPath: string;
    homePath: string;
}): string {
    const safeHomePath =
        args.homePath !== args.attemptedPath ? args.homePath : "/dashboard";

    return `${safeHomePath}?${new URLSearchParams({
        reason: FORBIDDEN_ACCESS_REASON,
        from: args.attemptedPath,
    }).toString()}`;
}

export function getAuthNoticeMessage(reason?: string | null): string | null {
    switch (reason) {
        case FORBIDDEN_ACCESS_REASON:
            return "You were redirected because that area is not available for your role.";
        case PENDING_ACCESS_REASON:
            return "Your account is authenticated, but access has not been assigned yet.";
        case ROLE_MISCONFIGURED_REASON:
            return "Your account roles are misconfigured. Access is blocked until an administrator fixes the setup.";
        default:
            return null;
    }
}

export function shouldTerminateAuthenticatedSession(
    authContext: Pick<
        AuthContextSnapshot,
        "accessState" | "isSessionValid" | "redirectReason"
    >,
): boolean {
    return (
        !authContext.isSessionValid ||
        authContext.accessState === "inactive" ||
        authContext.redirectReason === "account_deactivated" ||
        authContext.redirectReason === "session_expired" ||
        authContext.redirectReason === "subscription_inactive"
    );
}

export function resolveRoleRecords(args: {
    platformUsers: PlatformUserRecordInput[];
    tenantUsers: TenantUserRecordInput[];
}): ResolvedRoleRecordState {
    const hasUnknownTenantRole = args.tenantUsers.some(
        (tenantUser) => !isAppRole(tenantUser.role),
    );

    if (hasUnknownTenantRole) {
        return {
            accessState: "misconfigured",
            isActive: false,
            isRoleResolved: false,
            role: "unassigned",
            scope: "none",
        };
    }

    const activePlatformUsers = args.platformUsers.filter(
        (platformUser) => platformUser.isActive,
    );
    const inactivePlatformUsers = args.platformUsers.filter(
        (platformUser) => !platformUser.isActive,
    );
    const activeTenantUsers = args.tenantUsers.filter((tenantUser) => tenantUser.isActive);
    const inactiveTenantUsers = args.tenantUsers.filter(
        (tenantUser) => !tenantUser.isActive,
    );

    if (
        activePlatformUsers.length > 1 ||
        activeTenantUsers.length > 1 ||
        (args.platformUsers.length > 0 && args.tenantUsers.length > 0)
    ) {
        return {
            accessState: "misconfigured",
            isActive: false,
            isRoleResolved: false,
            role: "unassigned",
            scope: "none",
        };
    }

    const activeTenantUser = activeTenantUsers[0];
    if (activeTenantUser) {
        const activeTenantRole = activeTenantUser.role;
        if (!isAppRole(activeTenantRole) || !isTenantScopedRole(activeTenantRole)) {
            return {
                accessState: "misconfigured",
                isActive: false,
                isRoleResolved: false,
                role: "unassigned",
                scope: "none",
            };
        }

        return {
            accessState: "allowed",
            isActive: true,
            isRoleResolved: true,
            role: activeTenantRole,
            scope: "tenant",
            tenantId: activeTenantUser.tenantId,
        };
    }

    if (activePlatformUsers.length === 1) {
        return {
            accessState: "allowed",
            isActive: true,
            isRoleResolved: true,
            role: "platform_admin",
            scope: "platform",
        };
    }

    if (inactivePlatformUsers.length > 0 || inactiveTenantUsers.length > 0) {
        return {
            accessState: "inactive",
            isActive: false,
            isRoleResolved: false,
            role: "unassigned",
            scope: "none",
        };
    }

    return {
        accessState: "pending_access",
        isActive: false,
        isRoleResolved: false,
        role: "unassigned",
        scope: "none",
    };
}

export function evaluateRoleRouteAccess(args: {
    authContext: AuthContextSnapshot;
    pathname: string;
}): { action: "allow" } | { action: "redirect"; target: string } {
    if (args.pathname === "/dashboard") {
        return { action: "allow" };
    }

    const requiredRole = getProtectedRouteRole(args.pathname);
    if (!requiredRole) {
        return { action: "allow" };
    }

    if (
        !args.authContext.isSessionValid ||
        !args.authContext.isRoleResolved ||
        args.authContext.accessState !== "allowed"
    ) {
        return {
            action: "redirect",
            target: args.authContext.redirectPath,
        };
    }

    if (args.authContext.role !== requiredRole) {
        return {
            action: "redirect",
            target: buildForbiddenRedirectPath({
                attemptedPath: args.pathname,
                homePath: args.authContext.homePath,
            }),
        };
    }

    return { action: "allow" };
}
