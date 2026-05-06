export { SESSION_EXPIRED_REDIRECT_PATH } from "@/lib/shared/auth/public-routes";

export const PROTECTED_ROUTE_CACHE_HEADERS = {
    "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
} as const;

export const PROTECTED_ROUTE_SECURITY_HEADERS = {
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Referrer-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
} as const;
