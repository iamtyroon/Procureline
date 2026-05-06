export const TENANT_ADMIN_ONBOARDING_ROUTE =
    "/tenant-admin/onboarding" as const;

export type TenantAdminOnboardingStage =
    | "required"
    | "complete"
    | "not_applicable";

export function isTenantAdminOnboardingRoute(pathname: string): boolean {
    return (
        pathname === TENANT_ADMIN_ONBOARDING_ROUTE ||
        pathname.startsWith(`${TENANT_ADMIN_ONBOARDING_ROUTE}/`)
    );
}

export function resolveTenantAdminOnboardingStage(args: {
    profileComplete?: boolean | null;
    role: string;
}): TenantAdminOnboardingStage {
    if (args.role !== "tenant_admin") {
        return "not_applicable";
    }

    return args.profileComplete === true ? "complete" : "required";
}

export function evaluateTenantAdminOnboardingRouteAccess(args: {
    homePath: string;
    onboardingStage: TenantAdminOnboardingStage;
    pathname: string;
}): { action: "allow" } | { action: "redirect"; target: string } {
    if (args.onboardingStage === "not_applicable") {
        return { action: "allow" };
    }

    if (args.onboardingStage === "required") {
        if (
            args.pathname === "/dashboard" ||
            isTenantAdminOnboardingRoute(args.pathname)
        ) {
            return { action: "allow" };
        }

        return {
            action: "redirect",
            target: TENANT_ADMIN_ONBOARDING_ROUTE,
        };
    }

    if (isTenantAdminOnboardingRoute(args.pathname)) {
        return {
            action: "redirect",
            target: args.homePath,
        };
    }

    return { action: "allow" };
}

export function buildTenantAdminSignupContinuationHref(args?: {
    email?: string | undefined;
    inviteToken?: string | undefined;
    organizationName?: string | undefined;
    tier?: string | undefined;
}): string {
    const params = new URLSearchParams();

    if (typeof args?.tier === "string" && args.tier.trim().length > 0) {
        params.set("tier", args.tier.trim());
    }

    if (
        typeof args?.inviteToken === "string" &&
        args.inviteToken.trim().length > 0
    ) {
        params.set("invite", args.inviteToken.trim());
    }

    if (typeof args?.email === "string" && args.email.trim().length > 0) {
        params.set("email", args.email.trim());
        params.set("step", "verify");
    }

    if (
        typeof args?.organizationName === "string" &&
        args.organizationName.trim().length > 0
    ) {
        params.set("organizationName", args.organizationName.trim());
    }

    const query = params.toString();
    return query.length > 0 ? `/signup?${query}` : "/signup";
}
