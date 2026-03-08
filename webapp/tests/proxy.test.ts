import assert from "node:assert/strict";
import { isKnownPublicRoute, PUBLIC_ROUTES } from "../lib/auth/public-routes";
import {
    PROTECTED_ROUTE_CACHE_HEADERS,
    SESSION_EXPIRED_REDIRECT_PATH,
} from "../lib/auth/proxy";

export function runProxyRouteTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(isKnownPublicRoute("/forgot-password"), true);
    completedTests.push("forgot-password route is public");

    assert.equal(isKnownPublicRoute("/reset-password"), true);
    completedTests.push("reset-password route is public");

    assert.equal(isKnownPublicRoute("/dashboard"), false);
    completedTests.push("dashboard route is not public");

    assert.deepEqual(
        PUBLIC_ROUTES.filter((route) => route.includes("password")),
        ["/forgot-password", "/reset-password"],
    );
    completedTests.push(
        "public route registry includes the reset flow entry points",
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

    return completedTests;
}
