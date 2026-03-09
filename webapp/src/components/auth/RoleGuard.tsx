"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    evaluateRoleRouteAccess,
    type AuthContextSnapshot,
} from "@/lib/auth/roles";

interface RoleGuardProps {
    authContext: AuthContextSnapshot;
    children: React.ReactNode;
}

export function RoleGuard({ authContext, children }: RoleGuardProps) {
    const pathname = usePathname();
    const router = useRouter();

    const routeDecision = evaluateRoleRouteAccess({
        authContext,
        pathname,
    });

    useEffect(() => {
        if (routeDecision.action === "redirect") {
            router.replace(routeDecision.target);
        }
    }, [routeDecision, router]);

    if (routeDecision.action === "redirect") {
        return null;
    }

    return <>{children}</>;
}
