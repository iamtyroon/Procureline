"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isKnownPublicRoute = exports.PUBLIC_ROUTES = void 0;
exports.PUBLIC_ROUTES = [
    "/",
    "/access",
    "/access/procurement-officer",
    "/access/department-user",
    "/signup",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/pricing",
];
function isKnownPublicRoute(pathname) {
    return exports.PUBLIC_ROUTES.some((route) => route === pathname);
}
exports.isKnownPublicRoute = isKnownPublicRoute;
