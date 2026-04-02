"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isKnownPublicRoute = exports.PUBLIC_ROUTES = void 0;
const auth_1 = require("../platform-admin/auth");
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
