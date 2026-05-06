"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireVerifiedPlatformAdmin = exports.requirePlatformAdminSession = exports.requirePlatformAdmin = exports.requireTenantRole = exports.requireAnyRole = exports.requireAuthenticatedUser = exports.getAuthorizationContext = exports.authContextValidator = void 0;
const server_1 = require("@convex-dev/auth/server");
const values_1 = require("convex/values");
const session_1 = require("../../lib/shared/auth/session");
const department_user_access_1 = require("../../lib/shared/auth/department-user-access");
const roles_1 = require("../../lib/shared/auth/roles");
const auth_1 = require("../../lib/shared/platform-admin/auth");
const onboarding_1 = require("../../lib/shared/tenant-admin/onboarding");
const sessions_1 = require("./sessions");
const authContextRoleValidator = values_1.v.union(values_1.v.literal("platform_admin"), values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user"), values_1.v.literal("unassigned"));
const authScopeValidator = values_1.v.union(values_1.v.literal("platform"), values_1.v.literal("tenant"), values_1.v.literal("none"));
const accessStateValidator = values_1.v.union(values_1.v.literal("allowed"), values_1.v.literal("inactive"), values_1.v.literal("misconfigured"), values_1.v.literal("pending_access"));
const authNavigationReasonValidator = values_1.v.union(values_1.v.literal(session_1.ACCOUNT_DEACTIVATED_REASON), values_1.v.literal(roles_1.FORBIDDEN_ACCESS_REASON), values_1.v.literal(roles_1.PENDING_ACCESS_REASON), values_1.v.literal(auth_1.PLATFORM_ADMIN_PASSWORD_RESET_REQUIRED_REASON), values_1.v.literal(roles_1.ROLE_MISCONFIGURED_REASON), values_1.v.literal(session_1.SESSION_EXPIRED_REASON), values_1.v.literal(session_1.SUBSCRIPTION_INACTIVE_REASON));
const tenantStatusValidator = values_1.v.union(values_1.v.literal("active"), values_1.v.literal("cancelled"), values_1.v.literal("not_applicable"), values_1.v.literal("suspended"));
const departmentAccessModeValidator = values_1.v.union(values_1.v.literal("editable"), values_1.v.literal("read_only_grace"));
const platformAdminAuthStageValidator = values_1.v.union(values_1.v.literal("not_applicable"), values_1.v.literal("setup_required"), values_1.v.literal("verification_required"), values_1.v.literal("verified"), values_1.v.literal("reset_required"));
const tenantAdminOnboardingStageValidator = values_1.v.union(values_1.v.literal("required"), values_1.v.literal("complete"), values_1.v.literal("not_applicable"));
exports.authContextValidator = values_1.v.object({
    accessState: accessStateValidator,
    departmentAccessMode: values_1.v.optional(departmentAccessModeValidator),
    departmentId: values_1.v.optional(values_1.v.id("departments")),
    homePath: values_1.v.string(),
    isActive: values_1.v.boolean(),
    isRoleResolved: values_1.v.boolean(),
    isSessionValid: values_1.v.boolean(),
    platformAdminAuthStage: platformAdminAuthStageValidator,
    requiresPlatformAdminVerification: values_1.v.boolean(),
    redirectPath: values_1.v.string(),
    rememberMe: values_1.v.boolean(),
    role: authContextRoleValidator,
    scope: authScopeValidator,
    sessionStatus: values_1.v.union(values_1.v.literal("active"), values_1.v.literal("expired"), values_1.v.literal("revoked"), values_1.v.literal("logged_out")),
    tenantId: values_1.v.optional(values_1.v.id("tenants")),
    tenantAdminOnboardingStage: tenantAdminOnboardingStageValidator,
    tenantStatus: tenantStatusValidator,
    userId: values_1.v.id("users"),
    redirectReason: values_1.v.optional(authNavigationReasonValidator),
});
function createBaseContext(args) {
    return args;
}
function unauthorizedError(message) {
    throw new values_1.ConvexError({
        code: "UNAUTHORIZED",
        message,
    });
}
function createInactiveAccessContext(args) {
    const redirectPath = args.reason === session_1.SUBSCRIPTION_INACTIVE_REASON
        ? (0, roles_1.buildDashboardPath)(args.reason)
        : `/login?reason=${args.reason}`;
    return createBaseContext({
        accessState: "inactive",
        departmentAccessMode: undefined,
        departmentId: undefined,
        homePath: "/dashboard",
        isActive: false,
        isRoleResolved: false,
        isSessionValid: true,
        platformAdminAuthStage: "not_applicable",
        requiresPlatformAdminVerification: false,
        redirectPath,
        rememberMe: args.rememberMe,
        role: "unassigned",
        scope: "none",
        sessionStatus: args.sessionStatus,
        tenantStatus: "not_applicable",
        tenantAdminOnboardingStage: "not_applicable",
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
async function getAuthorizationContext(ctx) {
    const userId = await (0, server_1.getAuthUserId)(ctx);
    if (!userId) {
        return null;
    }
    const currentSessionDocuments = await (0, sessions_1.loadCurrentSessionDocuments)(ctx);
    const currentSession = await (0, sessions_1.loadCurrentSessionState)(ctx);
    if (!currentSession || !currentSessionDocuments) {
        return null;
    }
    if (!currentSession.state.isValid) {
        return createBaseContext({
            accessState: "inactive",
            departmentAccessMode: undefined,
            departmentId: undefined,
            homePath: "/dashboard",
            isActive: false,
            isRoleResolved: false,
            isSessionValid: false,
            platformAdminAuthStage: "not_applicable",
            requiresPlatformAdminVerification: false,
            redirectPath: `/login?reason=${session_1.SESSION_EXPIRED_REASON}`,
            rememberMe: currentSession.state.rememberMe,
            role: "unassigned",
            scope: "none",
            sessionStatus: currentSession.state.status,
            tenantStatus: "not_applicable",
            tenantAdminOnboardingStage: "not_applicable",
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
    const resolvedRole = (0, roles_1.resolveRoleRecords)({
        platformUsers: platformUsers.map((platformUser) => ({
            isActive: platformUser.isActive,
        })),
        selectedTenantId: currentSessionDocuments.metadata?.activeTenantId
            ? String(currentSessionDocuments.metadata.activeTenantId)
            : undefined,
        selectedTenantRole: currentSessionDocuments.metadata?.activeTenantRole,
        selectedTenantUserId: currentSessionDocuments.metadata?.activeTenantUserId
            ? String(currentSessionDocuments.metadata.activeTenantUserId)
            : undefined,
        tenantUsers: tenantUsers.map((tenantUser) => ({
            isActive: tenantUser.isActive,
            role: tenantUser.role,
            tenantId: tenantUser.tenantId,
            tenantUserId: String(tenantUser._id),
        })),
    });
    if (!resolvedRole.isRoleResolved) {
        if (resolvedRole.accessState === "inactive") {
            return createInactiveAccessContext({
                reason: session_1.ACCOUNT_DEACTIVATED_REASON,
                rememberMe: currentSession.state.rememberMe,
                sessionStatus: currentSession.state.status,
                userId,
            });
        }
        const reason = resolvedRole.accessState === "misconfigured"
            ? roles_1.ROLE_MISCONFIGURED_REASON
            : roles_1.PENDING_ACCESS_REASON;
        return createBaseContext({
            accessState: resolvedRole.accessState,
            departmentAccessMode: undefined,
            departmentId: undefined,
            homePath: "/dashboard",
            isActive: false,
            isRoleResolved: false,
            isSessionValid: true,
            platformAdminAuthStage: "not_applicable",
            requiresPlatformAdminVerification: false,
            redirectPath: (0, roles_1.buildDashboardPath)(reason),
            rememberMe: currentSession.state.rememberMe,
            role: "unassigned",
            scope: "none",
            sessionStatus: currentSession.state.status,
            tenantStatus: "not_applicable",
            tenantAdminOnboardingStage: "not_applicable",
            userId,
            redirectReason: reason,
        });
    }
    if (resolvedRole.role === "platform_admin") {
        const securityState = await ctx.db
            .query("platformAdminSecurityStates")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        const platformAdminAuthStage = (0, auth_1.resolvePlatformAdminAuthStage)({
            currentSessionStage: currentSessionDocuments.metadata?.platformAdminAuthStage ?? null,
            hasTwoFactorEnrollment: securityState?.isTwoFactorEnrolled === true,
            passwordResetRequiredAt: securityState?.passwordResetRequiredAt,
            storedBackupCodeCount: securityState
                ? securityState.backupCodes.length
                : 0,
        });
        const requiresPlatformAdminVerification = platformAdminAuthStage !== "verified";
        return createBaseContext({
            accessState: "allowed",
            departmentAccessMode: undefined,
            departmentId: undefined,
            homePath: (0, roles_1.getHomePathForRole)("platform_admin"),
            isActive: true,
            isRoleResolved: true,
            isSessionValid: true,
            platformAdminAuthStage,
            requiresPlatformAdminVerification,
            redirectPath: requiresPlatformAdminVerification
                ? (0, auth_1.getPlatformAdminRedirectPath)(platformAdminAuthStage)
                : (0, roles_1.getHomePathForRole)("platform_admin"),
            rememberMe: currentSession.state.rememberMe,
            role: "platform_admin",
            scope: "platform",
            sessionStatus: currentSession.state.status,
            tenantStatus: "not_applicable",
            tenantAdminOnboardingStage: "not_applicable",
            userId,
            redirectReason: platformAdminAuthStage === "reset_required"
                ? auth_1.PLATFORM_ADMIN_PASSWORD_RESET_REQUIRED_REASON
                : undefined,
        });
    }
    // Safe cast: tenantId originates from a Convex `Id<"tenants">` query
    // result, then passes through the pure `resolveRoleRecords` helper as
    // `string` for portability. The value is validated on the next line via
    // `ctx.db.get(tenantId)`.
    const tenantId = resolvedRole.tenantId;
    if (!tenantId) {
        return createBaseContext({
            accessState: "misconfigured",
            departmentAccessMode: undefined,
            departmentId: undefined,
            homePath: "/dashboard",
            isActive: false,
            isRoleResolved: false,
            isSessionValid: true,
            platformAdminAuthStage: "not_applicable",
            requiresPlatformAdminVerification: false,
            redirectPath: (0, roles_1.buildDashboardPath)(roles_1.ROLE_MISCONFIGURED_REASON),
            rememberMe: currentSession.state.rememberMe,
            role: "unassigned",
            scope: "none",
            sessionStatus: currentSession.state.status,
            tenantStatus: "not_applicable",
            tenantAdminOnboardingStage: "not_applicable",
            userId,
            redirectReason: roles_1.ROLE_MISCONFIGURED_REASON,
        });
    }
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) {
        return createBaseContext({
            accessState: "misconfigured",
            departmentAccessMode: undefined,
            departmentId: undefined,
            homePath: "/dashboard",
            isActive: false,
            isRoleResolved: false,
            isSessionValid: true,
            platformAdminAuthStage: "not_applicable",
            requiresPlatformAdminVerification: false,
            redirectPath: (0, roles_1.buildDashboardPath)(roles_1.ROLE_MISCONFIGURED_REASON),
            rememberMe: currentSession.state.rememberMe,
            role: "unassigned",
            scope: "none",
            sessionStatus: currentSession.state.status,
            tenantStatus: "not_applicable",
            tenantAdminOnboardingStage: "not_applicable",
            userId,
            redirectReason: roles_1.ROLE_MISCONFIGURED_REASON,
        });
    }
    if (tenant.status !== "active") {
        return createInactiveAccessContext({
            reason: session_1.SUBSCRIPTION_INACTIVE_REASON,
            rememberMe: currentSession.state.rememberMe,
            sessionStatus: currentSession.state.status,
            userId,
        });
    }
    let departmentId;
    let departmentAccessMode;
    if (resolvedRole.role === "department_user") {
        const tenantUser = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId_tenantId", (q) => q.eq("userId", userId).eq("tenantId", tenantId))
            .first();
        if (!tenantUser || !tenantUser.isActive || tenantUser.role !== "department_user") {
            return createBaseContext({
                accessState: "misconfigured",
                departmentAccessMode: undefined,
                departmentId: undefined,
                homePath: "/dashboard",
                isActive: false,
                isRoleResolved: false,
                isSessionValid: true,
                platformAdminAuthStage: "not_applicable",
                requiresPlatformAdminVerification: false,
                redirectPath: (0, roles_1.buildDashboardPath)(roles_1.ROLE_MISCONFIGURED_REASON),
                rememberMe: currentSession.state.rememberMe,
                role: "unassigned",
                scope: "none",
                sessionStatus: currentSession.state.status,
                tenantStatus: "not_applicable",
                tenantAdminOnboardingStage: "not_applicable",
                userId,
                redirectReason: roles_1.ROLE_MISCONFIGURED_REASON,
            });
        }
        const profile = await ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", tenantUser._id))
            .first();
        if (!profile) {
            return createBaseContext({
                accessState: "allowed",
                departmentAccessMode: undefined,
                departmentId: undefined,
                homePath: (0, roles_1.getHomePathForRole)("department_user"),
                isActive: true,
                isRoleResolved: true,
                isSessionValid: true,
                platformAdminAuthStage: "not_applicable",
                requiresPlatformAdminVerification: false,
                redirectPath: (0, roles_1.getHomePathForRole)("department_user"),
                rememberMe: currentSession.state.rememberMe,
                role: "department_user",
                scope: "tenant",
                sessionStatus: currentSession.state.status,
                tenantId,
                tenantAdminOnboardingStage: "not_applicable",
                tenantStatus: tenant.status,
                userId,
            });
        }
        if (!profile.isActive) {
            return createInactiveAccessContext({
                reason: session_1.ACCOUNT_DEACTIVATED_REASON,
                rememberMe: currentSession.state.rememberMe,
                sessionStatus: currentSession.state.status,
                userId,
            });
        }
        const department = await ctx.db.get(profile.departmentId);
        if (!department || department.tenantId !== tenantId || !department.isActive) {
            return createBaseContext({
                accessState: "allowed",
                departmentAccessMode: undefined,
                departmentId: undefined,
                homePath: (0, roles_1.getHomePathForRole)("department_user"),
                isActive: true,
                isRoleResolved: true,
                isSessionValid: true,
                platformAdminAuthStage: "not_applicable",
                requiresPlatformAdminVerification: false,
                redirectPath: (0, roles_1.getHomePathForRole)("department_user"),
                rememberMe: currentSession.state.rememberMe,
                role: "department_user",
                scope: "tenant",
                sessionStatus: currentSession.state.status,
                tenantId,
                tenantAdminOnboardingStage: "not_applicable",
                tenantStatus: tenant.status,
                userId,
            });
        }
        departmentId = profile.departmentId;
        if ((0, department_user_access_1.hasConfiguredDepartmentUserSubmissionWindow)({
            submissionEndsAt: department.submissionEndsAt,
            submissionStartsAt: department.submissionStartsAt,
        })) {
            const windowState = (0, department_user_access_1.evaluateDepartmentUserSubmissionWindow)({
                submissionEndsAt: department.submissionEndsAt,
                submissionStartsAt: department.submissionStartsAt,
            });
            departmentAccessMode = windowState.accessMode ?? undefined;
        }
    }
    const tenantAdminOnboardingStage = (0, onboarding_1.resolveTenantAdminOnboardingStage)({
        profileComplete: tenant.profileComplete,
        role: resolvedRole.role,
    });
    const tenantHomePath = resolvedRole.role === "tenant_admin" &&
        tenantAdminOnboardingStage === "required"
        ? onboarding_1.TENANT_ADMIN_ONBOARDING_ROUTE
        : (0, roles_1.getHomePathForRole)(resolvedRole.role);
    return createBaseContext({
        accessState: "allowed",
        departmentAccessMode,
        departmentId,
        homePath: tenantHomePath,
        isActive: true,
        isRoleResolved: true,
        isSessionValid: true,
        platformAdminAuthStage: "not_applicable",
        requiresPlatformAdminVerification: false,
        redirectPath: tenantHomePath,
        rememberMe: currentSession.state.rememberMe,
        role: resolvedRole.role,
        scope: "tenant",
        sessionStatus: currentSession.state.status,
        tenantId,
        tenantAdminOnboardingStage,
        tenantStatus: tenant.status,
        userId,
    });
}
exports.getAuthorizationContext = getAuthorizationContext;
async function requireAuthenticatedUser(ctx) {
    const authContext = await getAuthorizationContext(ctx);
    if (!authContext || !authContext.isSessionValid) {
        unauthorizedError("You must be signed in to access this resource");
    }
    return authContext;
}
exports.requireAuthenticatedUser = requireAuthenticatedUser;
async function requireAnyRole(ctx, allowedRoles) {
    const authContext = await requireAuthenticatedUser(ctx);
    if (!authContext.isRoleResolved || authContext.accessState !== "allowed") {
        unauthorizedError("You do not have an active application role");
    }
    if (allowedRoles &&
        !allowedRoles.some((allowedRole) => allowedRole === authContext.role)) {
        unauthorizedError("You are not authorized to access this resource");
    }
    return authContext;
}
exports.requireAnyRole = requireAnyRole;
async function requireTenantRole(ctx, allowedRoles = ["tenant_admin", "procurement_officer", "department_user"]) {
    const authContext = await requireAnyRole(ctx, allowedRoles);
    if (authContext.scope !== "tenant" || !authContext.tenantId) {
        unauthorizedError("Tenant-scoped access is required for this resource");
    }
    return authContext;
}
exports.requireTenantRole = requireTenantRole;
async function requirePlatformAdmin(ctx) {
    return await requireVerifiedPlatformAdmin(ctx);
}
exports.requirePlatformAdmin = requirePlatformAdmin;
async function requirePlatformAdminSession(ctx) {
    const authContext = await requireAnyRole(ctx, ["platform_admin"]);
    if (authContext.scope !== "platform") {
        unauthorizedError("Platform administrator access is required");
    }
    return authContext;
}
exports.requirePlatformAdminSession = requirePlatformAdminSession;
async function requireVerifiedPlatformAdmin(ctx) {
    const authContext = await requirePlatformAdminSession(ctx);
    if (authContext.requiresPlatformAdminVerification ||
        authContext.platformAdminAuthStage !== "verified") {
        unauthorizedError("Platform administrator verification is required");
    }
    return authContext;
}
exports.requireVerifiedPlatformAdmin = requireVerifiedPlatformAdmin;
