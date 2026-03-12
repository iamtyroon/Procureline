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
] as const;

export function isKnownPublicRoute(pathname: string): boolean {
    return PUBLIC_ROUTES.some((route) => route === pathname);
}
