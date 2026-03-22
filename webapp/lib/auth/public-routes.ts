import { PLATFORM_ADMIN_AUTH_ROUTES } from "../platform-admin/auth";

export const PUBLIC_ROUTES = [
    "/",
    "/access",
    "/access/procurement-officer",
    "/access/department-user",
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
