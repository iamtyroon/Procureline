export const PUBLIC_ROUTES = [
    "/",
    "/signup",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/pricing",
] as const;

export function isKnownPublicRoute(pathname: string): boolean {
    return PUBLIC_ROUTES.some((route) => route === pathname);
}
