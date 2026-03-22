import assert from "node:assert/strict";
import {
    FORBIDDEN_ACCESS_REASON,
    PENDING_ACCESS_REASON,
    ROLE_MISCONFIGURED_REASON,
    buildForbiddenRedirectPath,
    evaluateRoleRouteAccess,
    getHomePathForRole,
    getProtectedRouteRole,
    resolveRoleRecords,
} from "../lib/auth/roles";

const ACTIVE_SESSION_CONTEXT = {
    isSessionValid: true,
    sessionStatus: "active" as const,
    rememberMe: false,
};

export function runRbacTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(getHomePathForRole("platform_admin"), "/platform-admin");
    assert.equal(getHomePathForRole("tenant_admin"), "/tenant-admin");
    assert.equal(getHomePathForRole("procurement_officer"), "/po");
    assert.equal(getHomePathForRole("department_user"), "/du");
    completedTests.push("canonical home routes exist for all four application roles");

    assert.equal(getProtectedRouteRole("/platform-admin"), "platform_admin");
    assert.equal(getProtectedRouteRole("/platform-admin/settings"), "platform_admin");
    assert.equal(getProtectedRouteRole("/platform-admin/login"), null);
    assert.equal(getProtectedRouteRole("/platform-admin/setup-2fa"), null);
    assert.equal(getProtectedRouteRole("/platform-admin/verify"), null);
    assert.equal(getProtectedRouteRole("/tenant-admin"), "tenant_admin");
    assert.equal(getProtectedRouteRole("/tenant-admin/po-management"), "tenant_admin");
    assert.equal(getProtectedRouteRole("/tenant-admin/reports"), "tenant_admin");
    assert.equal(getProtectedRouteRole("/tenant-admin/settings"), "tenant_admin");
    assert.equal(getProtectedRouteRole("/po/requisitions"), "procurement_officer");
    assert.equal(getProtectedRouteRole("/du/plans"), "department_user");
    assert.equal(getProtectedRouteRole("/portal"), null);
    assert.equal(getProtectedRouteRole("/power-users"), null);
    completedTests.push("protected route detection uses segment-aware matching boundaries");

    assert.deepEqual(
        resolveRoleRecords({
            platformUsers: [{ isActive: true }],
            tenantUsers: [],
        }),
        {
            isRoleResolved: true,
            isActive: true,
            accessState: "allowed",
            role: "platform_admin",
            scope: "platform",
        },
    );
    completedTests.push("platform-admin role resolution succeeds from the dedicated global table");

    assert.deepEqual(
        resolveRoleRecords({
            platformUsers: [],
            tenantUsers: [
                {
                    isActive: true,
                    role: "tenant_admin",
                    tenantId: "tenant-1",
                },
            ],
        }),
        {
            isRoleResolved: true,
            isActive: true,
            accessState: "allowed",
            role: "tenant_admin",
            scope: "tenant",
            tenantId: "tenant-1",
        },
    );
    completedTests.push("tenant-scoped roles resolve with their tenant context intact");

    assert.deepEqual(
        resolveRoleRecords({
            platformUsers: [],
            tenantUsers: [],
        }),
        {
            isRoleResolved: false,
            isActive: false,
            accessState: "pending_access",
            role: "unassigned",
            scope: "none",
        },
    );
    completedTests.push("users with no active role fail closed instead of falling back to a dashboard");

    assert.deepEqual(
        resolveRoleRecords({
            platformUsers: [],
            tenantUsers: [
                {
                    isActive: false,
                    role: "tenant_admin",
                    tenantId: "tenant-1",
                },
            ],
        }),
        {
            isRoleResolved: false,
            isActive: false,
            accessState: "inactive",
            role: "unassigned",
            scope: "none",
        },
    );
    completedTests.push("inactive role records immediately remove dashboard access on the next protected request");

    assert.deepEqual(
        resolveRoleRecords({
            platformUsers: [{ isActive: true }],
            tenantUsers: [
                {
                    isActive: true,
                    role: "tenant_admin",
                    tenantId: "tenant-1",
                },
            ],
        }),
        {
            isRoleResolved: false,
            isActive: false,
            accessState: "misconfigured",
            role: "unassigned",
            scope: "none",
        },
    );
    completedTests.push("conflicting active platform and tenant role records fail closed");

    assert.deepEqual(
        resolveRoleRecords({
            platformUsers: [{ isActive: true }],
            tenantUsers: [
                {
                    isActive: false,
                    role: "tenant_admin",
                    tenantId: "tenant-1",
                },
            ],
        }),
        {
            isRoleResolved: false,
            isActive: false,
            accessState: "misconfigured",
            role: "unassigned",
            scope: "none",
        },
    );
    completedTests.push("platform and tenant role records fail closed even when only one side remains inactive");

    assert.deepEqual(
        resolveRoleRecords({
            platformUsers: [],
            tenantUsers: [
                {
                    isActive: true,
                    role: "mystery_role",
                    tenantId: "tenant-1",
                },
            ],
        }),
        {
            isRoleResolved: false,
            isActive: false,
            accessState: "misconfigured",
            role: "unassigned",
            scope: "none",
        },
    );
    completedTests.push("unknown stored role values are treated as a security misconfiguration");

    assert.equal(
        buildForbiddenRedirectPath({
            attemptedPath: "/tenant-admin",
            homePath: "/po",
        }),
        `/po?reason=${FORBIDDEN_ACCESS_REASON}&from=%2Ftenant-admin`,
    );
    assert.equal(
        buildForbiddenRedirectPath({
            attemptedPath: "/po",
            homePath: "/po",
        }),
        `/dashboard?reason=${FORBIDDEN_ACCESS_REASON}&from=%2Fpo`,
    );
    completedTests.push("forbidden redirects send users to their canonical home route with loop-safe fallback");

    assert.deepEqual(
        evaluateRoleRouteAccess({
            pathname: "/tenant-admin/settings",
            authContext: {
                ...ACTIVE_SESSION_CONTEXT,
                accessState: "allowed",
                role: "procurement_officer",
                scope: "tenant",
                isActive: true,
                isRoleResolved: true,
                homePath: "/po",
                redirectPath: "/po",
                tenantStatus: "active",
            },
        }),
        {
            action: "redirect",
            target: `/po?reason=${FORBIDDEN_ACCESS_REASON}&from=%2Ftenant-admin%2Fsettings`,
        },
    );
    completedTests.push("wrong-role route access redirects to the correct dashboard with a forbidden reason");

    assert.deepEqual(
        evaluateRoleRouteAccess({
            pathname: "/po",
            authContext: {
                ...ACTIVE_SESSION_CONTEXT,
                accessState: "pending_access",
                role: "unassigned",
                scope: "none",
                isActive: false,
                isRoleResolved: false,
                homePath: "/dashboard",
                redirectPath: `/dashboard?reason=${PENDING_ACCESS_REASON}`,
                tenantStatus: "not_applicable",
            },
        }),
        {
            action: "redirect",
            target: `/dashboard?reason=${PENDING_ACCESS_REASON}`,
        },
    );
    completedTests.push("protected routes deny access when no active application role is resolved");

    assert.deepEqual(
        evaluateRoleRouteAccess({
            pathname: "/dashboard",
            authContext: {
                ...ACTIVE_SESSION_CONTEXT,
                accessState: "misconfigured",
                role: "unassigned",
                scope: "none",
                isActive: false,
                isRoleResolved: false,
                homePath: "/dashboard",
                redirectPath: `/dashboard?reason=${ROLE_MISCONFIGURED_REASON}`,
                tenantStatus: "not_applicable",
            },
        }),
        {
            action: "allow",
        },
    );
    completedTests.push("the neutral dashboard entry point stays reachable for pending-access and misconfigured users");

    // H1: Multiple active tenant-user rows → misconfigured
    assert.deepEqual(
        resolveRoleRecords({
            platformUsers: [],
            tenantUsers: [
                {
                    isActive: true,
                    role: "tenant_admin",
                    tenantId: "tenant-1",
                },
                {
                    isActive: true,
                    role: "procurement_officer",
                    tenantId: "tenant-2",
                },
            ],
        }),
        {
            isRoleResolved: false,
            isActive: false,
            accessState: "misconfigured",
            role: "unassigned",
            scope: "none",
        },
    );
    completedTests.push("multiple active tenant-user rows across tenants fail closed as misconfigured");

    // H1: Multiple active platform-user rows → misconfigured
    assert.deepEqual(
        resolveRoleRecords({
            platformUsers: [{ isActive: true }, { isActive: true }],
            tenantUsers: [],
        }),
        {
            isRoleResolved: false,
            isActive: false,
            accessState: "misconfigured",
            role: "unassigned",
            scope: "none",
        },
    );
    completedTests.push("multiple active platform-user rows fail closed as misconfigured");

    // M3: Happy-path allow assertions for same-role route access
    assert.deepEqual(
        evaluateRoleRouteAccess({
            pathname: "/platform-admin",
            authContext: {
                ...ACTIVE_SESSION_CONTEXT,
                accessState: "allowed",
                role: "platform_admin",
                scope: "platform",
                isActive: true,
                isRoleResolved: true,
                homePath: "/platform-admin",
                platformAdminAuthStage: "verification_required",
                redirectPath: "/platform-admin/verify",
                requiresPlatformAdminVerification: true,
                tenantStatus: "not_applicable",
            },
        }),
        { action: "redirect", target: "/platform-admin/verify" },
    );
    completedTests.push(
        "platform admin route access still fails closed until admin verification is complete for the current session",
    );

    assert.deepEqual(
        evaluateRoleRouteAccess({
            pathname: "/platform-admin",
            authContext: {
                ...ACTIVE_SESSION_CONTEXT,
                accessState: "allowed",
                role: "platform_admin",
                scope: "platform",
                isActive: true,
                isRoleResolved: true,
                homePath: "/platform-admin",
                platformAdminAuthStage: "verified",
                redirectPath: "/platform-admin",
                requiresPlatformAdminVerification: false,
                tenantStatus: "not_applicable",
            },
        }),
        { action: "allow" },
    );
    completedTests.push("verified platform admin sessions can access protected admin routes");

    assert.deepEqual(
        evaluateRoleRouteAccess({
            pathname: "/tenant-admin/settings",
            authContext: {
                ...ACTIVE_SESSION_CONTEXT,
                accessState: "allowed",
                role: "tenant_admin",
                scope: "tenant",
                isActive: true,
                isRoleResolved: true,
                homePath: "/tenant-admin",
                redirectPath: "/tenant-admin",
                tenantStatus: "active",
            },
        }),
        { action: "allow" },
    );
    completedTests.push("tenant admin is allowed to access their own sub-routes");

    assert.deepEqual(
        evaluateRoleRouteAccess({
            pathname: "/tenant-admin/reports",
            authContext: {
                ...ACTIVE_SESSION_CONTEXT,
                accessState: "allowed",
                role: "procurement_officer",
                scope: "tenant",
                isActive: true,
                isRoleResolved: true,
                homePath: "/po",
                redirectPath: "/po",
                tenantStatus: "active",
            },
        }),
        {
            action: "redirect",
            target: `/po?reason=${FORBIDDEN_ACCESS_REASON}&from=%2Ftenant-admin%2Freports`,
        },
    );
    completedTests.push("reserved tenant-admin sub-routes stay protected by the existing role guard");

    assert.deepEqual(
        evaluateRoleRouteAccess({
            pathname: "/po",
            authContext: {
                ...ACTIVE_SESSION_CONTEXT,
                accessState: "allowed",
                role: "procurement_officer",
                scope: "tenant",
                isActive: true,
                isRoleResolved: true,
                homePath: "/po",
                redirectPath: "/po",
                tenantStatus: "active",
            },
        }),
        { action: "allow" },
    );
    completedTests.push("procurement officer is allowed to access their own dashboard route");

    assert.deepEqual(
        evaluateRoleRouteAccess({
            pathname: "/du/plan",
            authContext: {
                ...ACTIVE_SESSION_CONTEXT,
                accessState: "allowed",
                role: "department_user",
                scope: "tenant",
                isActive: true,
                isRoleResolved: true,
                homePath: "/du",
                redirectPath: "/du",
                tenantStatus: "active",
            },
        }),
        { action: "allow" },
    );
    completedTests.push("department user is allowed to access their own sub-routes");

    return completedTests;
}
