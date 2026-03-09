"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProxyRouteTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const public_routes_1 = require("../lib/auth/public-routes");
const roles_1 = require("../lib/auth/roles");
const proxy_1 = require("../lib/auth/proxy");
function runProxyRouteTests() {
    const completedTests = [];
    strict_1.default.equal((0, public_routes_1.isKnownPublicRoute)("/forgot-password"), true);
    completedTests.push("forgot-password route is public");
    strict_1.default.equal((0, public_routes_1.isKnownPublicRoute)("/reset-password"), true);
    completedTests.push("reset-password route is public");
    strict_1.default.equal((0, public_routes_1.isKnownPublicRoute)("/dashboard"), false);
    completedTests.push("dashboard route is not public");
    strict_1.default.equal((0, public_routes_1.isKnownPublicRoute)("/platform-admin"), false);
    strict_1.default.equal((0, public_routes_1.isKnownPublicRoute)("/tenant-admin"), false);
    strict_1.default.equal((0, public_routes_1.isKnownPublicRoute)("/po"), false);
    strict_1.default.equal((0, public_routes_1.isKnownPublicRoute)("/du"), false);
    completedTests.push("role dashboards remain protected and are never classified as public routes");
    strict_1.default.deepEqual(public_routes_1.PUBLIC_ROUTES.filter((route) => route.includes("password")), ["/forgot-password", "/reset-password"]);
    completedTests.push("public route registry includes the reset flow entry points");
    strict_1.default.equal(public_routes_1.PUBLIC_ROUTES.every((route) => (0, roles_1.getProtectedRouteRole)(route) === null), true);
    completedTests.push("proxy public routes stay separate from the centralized role-based route map");
    strict_1.default.equal(proxy_1.SESSION_EXPIRED_REDIRECT_PATH, "/login?reason=session_expired");
    completedTests.push("protected route redirects preserve the session_expired login reason");
    strict_1.default.equal(proxy_1.PROTECTED_ROUTE_CACHE_HEADERS["Cache-Control"], "private, no-store, no-cache, max-age=0, must-revalidate");
    strict_1.default.equal(proxy_1.PROTECTED_ROUTE_CACHE_HEADERS.Pragma, "no-cache");
    strict_1.default.equal(proxy_1.PROTECTED_ROUTE_CACHE_HEADERS.Expires, "0");
    completedTests.push("protected route cache headers disable replay of authenticated content");
    return completedTests;
}
exports.runProxyRouteTests = runProxyRouteTests;
