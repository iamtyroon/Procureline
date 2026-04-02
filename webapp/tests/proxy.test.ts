import assert from "node:assert/strict";
import { isKnownPublicRoute, PUBLIC_ROUTES } from "../lib/auth/public-routes";
import { getProtectedRouteRole } from "../lib/auth/roles";
import {
    PROTECTED_ROUTE_CACHE_HEADERS,
    PROTECTED_ROUTE_SECURITY_HEADERS,
    SESSION_EXPIRED_REDIRECT_PATH,
} from "../lib/auth/proxy";

export function runProxyRouteTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(isKnownPublicRoute("/forgot-password"), true);
    completedTests.push("forgot-password route is public");

    assert.equal(isKnownPublicRoute("/reset-password"), true);
    completedTests.push("reset-password route is public");

    assert.equal(isKnownPublicRoute("/access"), true);
    completedTests.push("access hub route is public");

    assert.equal(isKnownPublicRoute("/access/procurement-officer"), true);
    completedTests.push("procurement-officer placeholder route is public");

    assert.equal(isKnownPublicRoute("/access/department-user"), true);
    completedTests.push("department-user continuation route is public");

    assert.equal(isKnownPublicRoute("/dev/email-inbox"), true);
    completedTests.push("development email inbox route is public");

    assert.equal(isKnownPublicRoute("/platform-admin/login"), true);
    assert.equal(isKnownPublicRoute("/platform-admin/setup-2fa"), true);
    assert.equal(isKnownPublicRoute("/platform-admin/verify"), true);
    completedTests.push(
        "platform-admin login and 2FA routes remain public even though the rest of the platform-admin namespace is protected",
    );

    assert.equal(isKnownPublicRoute("/dashboard"), false);
    completedTests.push("dashboard route is not public");

    assert.equal(isKnownPublicRoute("/platform-admin"), false);
    assert.equal(isKnownPublicRoute("/tenant-admin"), false);
    assert.equal(isKnownPublicRoute("/po"), false);
    assert.equal(isKnownPublicRoute("/du"), false);
    completedTests.push("role dashboards remain protected and are never classified as public routes");

    assert.deepEqual(
        PUBLIC_ROUTES.filter((route) => route.includes("password")),
        ["/forgot-password", "/reset-password"],
    );
    completedTests.push(
        "public route registry includes the reset flow entry points",
    );

    assert.equal(PUBLIC_ROUTES.includes("/access"), true);
    assert.equal(PUBLIC_ROUTES.includes("/access/procurement-officer"), true);
    assert.equal(PUBLIC_ROUTES.includes("/access/department-user"), true);
    assert.equal(PUBLIC_ROUTES.includes("/dev/email-inbox"), true);
    assert.equal(PUBLIC_ROUTES.includes("/platform-admin/login"), true);
    assert.equal(PUBLIC_ROUTES.includes("/platform-admin/setup-2fa"), true);
    assert.equal(PUBLIC_ROUTES.includes("/platform-admin/verify"), true);
    completedTests.push(
        "public route registry includes the role-aware access hub plus the reserved PO and DU role-entry surfaces without broadening protected role prefixes",
    );

    assert.equal(PUBLIC_ROUTES.every((route) => getProtectedRouteRole(route) === null), true);
    completedTests.push(
        "proxy public routes stay separate from the centralized role-based route map",
    );

    assert.equal(
        SESSION_EXPIRED_REDIRECT_PATH,
        "/login?reason=session_expired",
    );
    completedTests.push(
        "protected route redirects preserve the session_expired login reason",
    );

    assert.equal(
        PROTECTED_ROUTE_CACHE_HEADERS["Cache-Control"],
        "private, no-store, no-cache, max-age=0, must-revalidate",
    );
    assert.equal(PROTECTED_ROUTE_CACHE_HEADERS.Pragma, "no-cache");
    assert.equal(PROTECTED_ROUTE_CACHE_HEADERS.Expires, "0");
    completedTests.push(
        "protected route cache headers disable replay of authenticated content",
    );

    assert.equal(PROTECTED_ROUTE_SECURITY_HEADERS["X-Frame-Options"], "DENY");
    assert.equal(
        PROTECTED_ROUTE_SECURITY_HEADERS["X-Content-Type-Options"],
        "nosniff",
    );
    assert.equal(
        PROTECTED_ROUTE_SECURITY_HEADERS["Referrer-Policy"],
        "same-origin",
    );
    completedTests.push(
        "protected route security headers apply baseline clickjacking, sniffing, and referrer hardening",
    );

    return completedTests;
}
