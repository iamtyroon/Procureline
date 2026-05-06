import { PLATFORM_ADMIN_AUTH_ROUTES } from "../platform-admin/auth";

export const SESSION_EXPIRED_REDIRECT_PATH =
    "/login?reason=session_expired" as const;

export const PUBLIC_ROUTES = [
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
    ...PLATFORM_ADMIN_AUTH_ROUTES,
] as const;

export function isKnownPublicRoute(pathname: string): boolean {
    return PUBLIC_ROUTES.some((route) => route === pathname);
}
