"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { resolveAuthenticatedAccessRedirect } from "@/lib/shared/auth/public-entry";
import { Spinner } from "@/src/components/ui/Spinner";

interface PublicAccessGateProps {
    children: ReactNode;
}

export function PublicAccessGate({
    children,
}: PublicAccessGateProps): JSX.Element {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const authContext = useQuery(
        api.functions.users.getAuthContext,
        isAuthenticated ? {} : "skip",
    );
    const router = useRouter();
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
        if (isLoading || !isAuthenticated || authContext === undefined) {
            return;
        }

        const redirectTarget = resolveAuthenticatedAccessRedirect(authContext);
        if (!redirectTarget) {
            return;
        }

        setIsRedirecting(true);
        router.replace(redirectTarget);
    }, [authContext, isAuthenticated, isLoading, router]);

    if (
        isAuthenticated &&
        (isLoading || authContext === undefined || authContext === null || isRedirecting)
    ) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-6">
                <div className="flex flex-col items-center gap-3 text-center">
                    <Spinner />
                    <p className="text-sm text-muted-foreground">
                        Redirecting you to your workspace...
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
