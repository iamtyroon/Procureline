"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    evaluateRoleRouteAccess,
    type AuthContextSnapshot,
} from "@/lib/auth/roles";
import { isTenantAdminOnboardingRoute } from "@/lib/shared/tenant-admin/onboarding";

interface RoleGuardProps {
    authContext: AuthContextSnapshot;
    children: React.ReactNode;
}

export function RoleGuard({ authContext, children }: RoleGuardProps) {
    const pathname = usePathname();
    const router = useRouter();
    const allowInactiveTenantOnboardingMessage =
        authContext.redirectReason === "subscription_inactive" &&
        isTenantAdminOnboardingRoute(pathname);

    const routeDecision = evaluateRoleRouteAccess({
        authContext,
        pathname,
    });

    useEffect(() => {
        if (!allowInactiveTenantOnboardingMessage && routeDecision.action === "redirect") {
            router.replace(routeDecision.target);
        }
    }, [allowInactiveTenantOnboardingMessage, routeDecision, router]);

    if (!allowInactiveTenantOnboardingMessage && routeDecision.action === "redirect") {
        return null;
    }

    return <>{children}</>;
}
