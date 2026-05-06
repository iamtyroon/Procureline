"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isKnownPublicRoute = exports.PUBLIC_ROUTES = exports.SESSION_EXPIRED_REDIRECT_PATH = void 0;
const auth_1 = require("../platform-admin/auth");
exports.SESSION_EXPIRED_REDIRECT_PATH = "/login?reason=session_expired";
exports.PUBLIC_ROUTES = [
    "/",
    "/access",
    "/access/procurement-officer",
    "/access/department-user",
    "/dev/email-inbox",
    "/signup",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/pricing",
    ...auth_1.PLATFORM_ADMIN_AUTH_ROUTES,
];
function isKnownPublicRoute(pathname) {
    return exports.PUBLIC_ROUTES.some((route) => route === pathname);
}
exports.isKnownPublicRoute = isKnownPublicRoute;
