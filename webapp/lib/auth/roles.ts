import type { SessionRedirectReason, SessionStatus } from "./session";
import {
    isPlatformAdminAuthRoute,
    isPlatformAdminAuthStageVerified,
    PLATFORM_ADMIN_PASSWORD_RESET_REQUIRED_REASON,
    type PlatformAdminAuthStage,
} from "../shared/platform-admin/auth";
import {
    evaluateTenantAdminOnboardingRouteAccess,
    type TenantAdminOnboardingStage,
} from "../shared/tenant-admin/onboarding";

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
    | typeof ROLE_MISCONFIGURED_REASON
    | typeof PLATFORM_ADMIN_PASSWORD_RESET_REQUIRED_REASON;

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
    tenantUserId?: string;
}

export interface ResolvedRoleRecordState {
    accessState: AccessState;
    isActive: boolean;
    isRoleResolved: boolean;
    role: AuthContextRole;
    scope: AuthScope;
    tenantId?: string;
    tenantUserId?: string;
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
    platformAdminAuthStage?: PlatformAdminAuthStage;
    requiresPlatformAdminVerification?: boolean;
    tenantAdminOnboardingStage?: TenantAdminOnboardingStage;
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
    if (isPlatformAdminAuthRoute(pathname)) {
        return null;
    }

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
        case PLATFORM_ADMIN_PASSWORD_RESET_REQUIRED_REASON:
            return "Platform Admin access requires a password reset before you can sign in again.";
        case "subscription_inactive":
            return "Tenant deactivated. Contact Support.";
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
        authContext.redirectReason ===
            PLATFORM_ADMIN_PASSWORD_RESET_REQUIRED_REASON
    );
}

export function resolveRoleRecords(args: {
    platformUsers: PlatformUserRecordInput[];
    selectedTenantId?: string;
    selectedTenantRole?: TenantScopedRole;
    selectedTenantUserId?: string;
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

    const activeTenantUser =
        activeTenantUsers.length > 1
            ? resolveSelectedTenantMembership({
                  activeTenantUsers,
                  selectedTenantId: args.selectedTenantId,
                  selectedTenantRole: args.selectedTenantRole,
                  selectedTenantUserId: args.selectedTenantUserId,
              })
            : activeTenantUsers[0];

    if (activeTenantUsers.length > 1 && !activeTenantUser) {
        return {
            accessState: "pending_access",
            isActive: false,
            isRoleResolved: false,
            role: "unassigned",
            scope: "none",
        };
    }

    if (
        activeTenantUsers.length === 1 &&
        hasStaleTenantSelection({
            activeTenantUser: activeTenantUsers[0],
            selectedTenantId: args.selectedTenantId,
            selectedTenantRole: args.selectedTenantRole,
            selectedTenantUserId: args.selectedTenantUserId,
        })
    ) {
        return {
            accessState: "pending_access",
            isActive: false,
            isRoleResolved: false,
            role: "unassigned",
            scope: "none",
        };
    }

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
            tenantUserId: activeTenantUser.tenantUserId,
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

function matchesSelectedTenantMembership(args: {
    selectedTenantId?: string;
    selectedTenantRole?: TenantScopedRole;
    selectedTenantUserId?: string;
    tenantUser: TenantUserRecordInput;
}): boolean {
    if (
        args.selectedTenantUserId &&
        args.tenantUser.tenantUserId !== args.selectedTenantUserId
    ) {
        return false;
    }

    if (
        args.selectedTenantId &&
        args.tenantUser.tenantId !== args.selectedTenantId
    ) {
        return false;
    }

    if (
        args.selectedTenantRole &&
        args.tenantUser.role !== args.selectedTenantRole
    ) {
        return false;
    }

    return (
        Boolean(args.selectedTenantUserId) ||
        Boolean(args.selectedTenantId) ||
        Boolean(args.selectedTenantRole)
    );
}

function resolveSelectedTenantMembership(args: {
    activeTenantUsers: TenantUserRecordInput[];
    selectedTenantId?: string;
    selectedTenantRole?: TenantScopedRole;
    selectedTenantUserId?: string;
}): TenantUserRecordInput | undefined {
    return args.activeTenantUsers.find((tenantUser) =>
        matchesSelectedTenantMembership({
            selectedTenantId: args.selectedTenantId,
            selectedTenantRole: args.selectedTenantRole,
            selectedTenantUserId: args.selectedTenantUserId,
            tenantUser,
        }),
    );
}

function hasStaleTenantSelection(args: {
    activeTenantUser: TenantUserRecordInput | undefined;
    selectedTenantId?: string;
    selectedTenantRole?: TenantScopedRole;
    selectedTenantUserId?: string;
}): boolean {
    if (
        !args.selectedTenantId &&
        !args.selectedTenantRole &&
        !args.selectedTenantUserId
    ) {
        return false;
    }

    if (!args.activeTenantUser) {
        return true;
    }

    return !matchesSelectedTenantMembership({
        selectedTenantId: args.selectedTenantId,
        selectedTenantRole: args.selectedTenantRole,
        selectedTenantUserId: args.selectedTenantUserId,
        tenantUser: args.activeTenantUser,
    });
}

export function evaluateRoleRouteAccess(args: {
    authContext: AuthContextSnapshot;
    pathname: string;
}): { action: "allow" } | { action: "redirect"; target: string } {
    const platformAdminAuthStage =
        args.authContext.platformAdminAuthStage ?? "not_applicable";
    const requiresPlatformAdminVerification =
        args.authContext.requiresPlatformAdminVerification === true;

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

    if (
        requiredRole === "platform_admin" &&
        !isPlatformAdminAuthStageVerified(platformAdminAuthStage) &&
        requiresPlatformAdminVerification
    ) {
        return {
            action: "redirect",
            target: args.authContext.redirectPath,
        };
    }

    if (requiredRole === "tenant_admin") {
        const tenantAdminDecision = evaluateTenantAdminOnboardingRouteAccess({
            homePath: args.authContext.homePath,
            onboardingStage:
                args.authContext.tenantAdminOnboardingStage ?? "not_applicable",
            pathname: args.pathname,
        });

        if (tenantAdminDecision.action === "redirect") {
            return tenantAdminDecision;
        }
    }

    return { action: "allow" };
}
