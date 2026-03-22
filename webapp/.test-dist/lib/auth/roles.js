"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRoleRouteAccess = exports.resolveRoleRecords = exports.shouldTerminateAuthenticatedSession = exports.getAuthNoticeMessage = exports.buildForbiddenRedirectPath = exports.buildDashboardPath = exports.getProtectedRouteRole = exports.isSegmentAwarePrefixMatch = exports.getRoleLabel = exports.getHomePathForRole = exports.isTenantScopedRole = exports.isAppRole = exports.ROLE_HOME_PATHS = exports.ROLE_LABELS = exports.ROLE_MISCONFIGURED_REASON = exports.PENDING_ACCESS_REASON = exports.FORBIDDEN_ACCESS_REASON = exports.TENANT_SCOPED_ROLES = exports.APP_ROLES = void 0;
const auth_1 = require("../platform-admin/auth");
const onboarding_1 = require("../tenant-admin/onboarding");
exports.APP_ROLES = [
    "platform_admin",
    "tenant_admin",
    "procurement_officer",
    "department_user",
];
exports.TENANT_SCOPED_ROLES = [
    "tenant_admin",
    "procurement_officer",
    "department_user",
];
exports.FORBIDDEN_ACCESS_REASON = "forbidden_access";
exports.PENDING_ACCESS_REASON = "pending_access";
exports.ROLE_MISCONFIGURED_REASON = "role_misconfigured";
exports.ROLE_LABELS = {
    platform_admin: "Platform Admin",
    tenant_admin: "Tenant Admin",
    procurement_officer: "Procurement Officer",
    department_user: "Department User",
    unassigned: "Pending access",
};
exports.ROLE_HOME_PATHS = {
    platform_admin: "/platform-admin",
    tenant_admin: "/tenant-admin",
    procurement_officer: "/po",
    department_user: "/du",
};
const ROLE_ROUTE_PREFIXES = [
    { path: "/platform-admin", role: "platform_admin" },
    { path: "/tenant-admin", role: "tenant_admin" },
    { path: "/po", role: "procurement_officer" },
    { path: "/du", role: "department_user" },
];
function isAppRole(value) {
    return exports.APP_ROLES.some((role) => role === value);
}
exports.isAppRole = isAppRole;
function isTenantScopedRole(role) {
    return exports.TENANT_SCOPED_ROLES.some((tenantRole) => tenantRole === role);
}
exports.isTenantScopedRole = isTenantScopedRole;
function getHomePathForRole(role) {
    return exports.ROLE_HOME_PATHS[role];
}
exports.getHomePathForRole = getHomePathForRole;
function getRoleLabel(role) {
    return exports.ROLE_LABELS[role];
}
exports.getRoleLabel = getRoleLabel;
function isSegmentAwarePrefixMatch(pathname, routePrefix) {
    return pathname === routePrefix || pathname.startsWith(`${routePrefix}/`);
}
exports.isSegmentAwarePrefixMatch = isSegmentAwarePrefixMatch;
function getProtectedRouteRole(pathname) {
    if ((0, auth_1.isPlatformAdminAuthRoute)(pathname)) {
        return null;
    }
    const matchedRoute = ROLE_ROUTE_PREFIXES.find(({ path }) => isSegmentAwarePrefixMatch(pathname, path));
    return matchedRoute?.role ?? null;
}
exports.getProtectedRouteRole = getProtectedRouteRole;
function buildDashboardPath(reason) {
    if (!reason) {
        return "/dashboard";
    }
    return `/dashboard?${new URLSearchParams({ reason }).toString()}`;
}
exports.buildDashboardPath = buildDashboardPath;
function buildForbiddenRedirectPath(args) {
    const safeHomePath = args.homePath !== args.attemptedPath ? args.homePath : "/dashboard";
    return `${safeHomePath}?${new URLSearchParams({
        reason: exports.FORBIDDEN_ACCESS_REASON,
        from: args.attemptedPath,
    }).toString()}`;
}
exports.buildForbiddenRedirectPath = buildForbiddenRedirectPath;
function getAuthNoticeMessage(reason) {
    switch (reason) {
        case exports.FORBIDDEN_ACCESS_REASON:
            return "You were redirected because that area is not available for your role.";
        case exports.PENDING_ACCESS_REASON:
            return "Your account is authenticated, but access has not been assigned yet.";
        case exports.ROLE_MISCONFIGURED_REASON:
            return "Your account roles are misconfigured. Access is blocked until an administrator fixes the setup.";
        case auth_1.PLATFORM_ADMIN_PASSWORD_RESET_REQUIRED_REASON:
            return "Platform Admin access requires a password reset before you can sign in again.";
        case "subscription_inactive":
            return "Tenant deactivated. Contact Support.";
        default:
            return null;
    }
}
exports.getAuthNoticeMessage = getAuthNoticeMessage;
function shouldTerminateAuthenticatedSession(authContext) {
    return (!authContext.isSessionValid ||
        authContext.accessState === "inactive" ||
        authContext.redirectReason === "account_deactivated" ||
        authContext.redirectReason === "session_expired" ||
        authContext.redirectReason ===
            auth_1.PLATFORM_ADMIN_PASSWORD_RESET_REQUIRED_REASON);
}
exports.shouldTerminateAuthenticatedSession = shouldTerminateAuthenticatedSession;
function resolveRoleRecords(args) {
    const hasUnknownTenantRole = args.tenantUsers.some((tenantUser) => !isAppRole(tenantUser.role));
    if (hasUnknownTenantRole) {
        return {
            accessState: "misconfigured",
            isActive: false,
            isRoleResolved: false,
            role: "unassigned",
            scope: "none",
        };
    }
    const activePlatformUsers = args.platformUsers.filter((platformUser) => platformUser.isActive);
    const inactivePlatformUsers = args.platformUsers.filter((platformUser) => !platformUser.isActive);
    const activeTenantUsers = args.tenantUsers.filter((tenantUser) => tenantUser.isActive);
    const inactiveTenantUsers = args.tenantUsers.filter((tenantUser) => !tenantUser.isActive);
    if (activePlatformUsers.length > 1 ||
        activeTenantUsers.length > 1 ||
        (args.platformUsers.length > 0 && args.tenantUsers.length > 0)) {
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
exports.resolveRoleRecords = resolveRoleRecords;
function evaluateRoleRouteAccess(args) {
    const platformAdminAuthStage = args.authContext.platformAdminAuthStage ?? "not_applicable";
    const requiresPlatformAdminVerification = args.authContext.requiresPlatformAdminVerification === true;
    if (args.pathname === "/dashboard") {
        return { action: "allow" };
    }
    const requiredRole = getProtectedRouteRole(args.pathname);
    if (!requiredRole) {
        return { action: "allow" };
    }
    if (!args.authContext.isSessionValid ||
        !args.authContext.isRoleResolved ||
        args.authContext.accessState !== "allowed") {
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
    if (requiredRole === "platform_admin" &&
        !(0, auth_1.isPlatformAdminAuthStageVerified)(platformAdminAuthStage) &&
        requiresPlatformAdminVerification) {
        return {
            action: "redirect",
            target: args.authContext.redirectPath,
        };
    }
    if (requiredRole === "tenant_admin") {
        const tenantAdminDecision = (0, onboarding_1.evaluateTenantAdminOnboardingRouteAccess)({
            homePath: args.authContext.homePath,
            onboardingStage: args.authContext.tenantAdminOnboardingStage ?? "not_applicable",
            pathname: args.pathname,
        });
        if (tenantAdminDecision.action === "redirect") {
            return tenantAdminDecision;
        }
    }
    return { action: "allow" };
}
exports.evaluateRoleRouteAccess = evaluateRoleRouteAccess;
