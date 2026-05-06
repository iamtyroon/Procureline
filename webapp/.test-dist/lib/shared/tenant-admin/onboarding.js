"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTenantAdminSignupContinuationHref = exports.evaluateTenantAdminOnboardingRouteAccess = exports.resolveTenantAdminOnboardingStage = exports.isTenantAdminOnboardingRoute = exports.TENANT_ADMIN_ONBOARDING_ROUTE = void 0;
exports.TENANT_ADMIN_ONBOARDING_ROUTE = "/tenant-admin/onboarding";
function isTenantAdminOnboardingRoute(pathname) {
    return (pathname === exports.TENANT_ADMIN_ONBOARDING_ROUTE ||
        pathname.startsWith(`${exports.TENANT_ADMIN_ONBOARDING_ROUTE}/`));
}
exports.isTenantAdminOnboardingRoute = isTenantAdminOnboardingRoute;
function resolveTenantAdminOnboardingStage(args) {
    if (args.role !== "tenant_admin") {
        return "not_applicable";
    }
    return args.profileComplete === true ? "complete" : "required";
}
exports.resolveTenantAdminOnboardingStage = resolveTenantAdminOnboardingStage;
function evaluateTenantAdminOnboardingRouteAccess(args) {
    if (args.onboardingStage === "not_applicable") {
        return { action: "allow" };
    }
    if (args.onboardingStage === "required") {
        if (args.pathname === "/dashboard" ||
            isTenantAdminOnboardingRoute(args.pathname)) {
            return { action: "allow" };
        }
        return {
            action: "redirect",
            target: exports.TENANT_ADMIN_ONBOARDING_ROUTE,
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
exports.evaluateTenantAdminOnboardingRouteAccess = evaluateTenantAdminOnboardingRouteAccess;
function buildTenantAdminSignupContinuationHref(args) {
    const params = new URLSearchParams();
    if (typeof args?.tier === "string" && args.tier.trim().length > 0) {
        params.set("tier", args.tier.trim());
    }
    if (typeof args?.inviteToken === "string" &&
        args.inviteToken.trim().length > 0) {
        params.set("invite", args.inviteToken.trim());
    }
    if (typeof args?.email === "string" && args.email.trim().length > 0) {
        params.set("email", args.email.trim());
        params.set("step", "verify");
    }
    if (typeof args?.organizationName === "string" &&
        args.organizationName.trim().length > 0) {
        params.set("organizationName", args.organizationName.trim());
    }
    const query = params.toString();
    return query.length > 0 ? `/signup?${query}` : "/signup";
}
exports.buildTenantAdminSignupContinuationHref = buildTenantAdminSignupContinuationHref;
