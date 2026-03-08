"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROTECTED_ROUTE_CACHE_HEADERS = exports.SESSION_EXPIRED_REDIRECT_PATH = void 0;
exports.SESSION_EXPIRED_REDIRECT_PATH = "/login?reason=session_expired";
exports.PROTECTED_ROUTE_CACHE_HEADERS = {
    "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
};
