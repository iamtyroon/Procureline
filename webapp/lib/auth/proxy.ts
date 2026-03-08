export const SESSION_EXPIRED_REDIRECT_PATH =
    "/login?reason=session_expired" as const;

export const PROTECTED_ROUTE_CACHE_HEADERS = {
    "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
} as const;
