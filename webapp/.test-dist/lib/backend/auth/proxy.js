"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROTECTED_ROUTE_SECURITY_HEADERS = exports.PROTECTED_ROUTE_CACHE_HEADERS = exports.SESSION_EXPIRED_REDIRECT_PATH = void 0;
var public_routes_1 = require("@/lib/shared/auth/public-routes");
Object.defineProperty(exports, "SESSION_EXPIRED_REDIRECT_PATH", { enumerable: true, get: function () { return public_routes_1.SESSION_EXPIRED_REDIRECT_PATH; } });
exports.PROTECTED_ROUTE_CACHE_HEADERS = {
    "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
};
exports.PROTECTED_ROUTE_SECURITY_HEADERS = {
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Referrer-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
};
