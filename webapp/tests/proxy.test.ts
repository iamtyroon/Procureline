import assert from "node:assert/strict";
import { isKnownPublicRoute, PUBLIC_ROUTES } from "../lib/auth/public-routes";

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

    return completedTests;
}
