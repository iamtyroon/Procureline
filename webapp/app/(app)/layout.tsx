"use client";

import { useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { signOut } = useAuthActions();
    const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
    const authContext = useQuery(
        api.functions.users.getAuthContext,
        isAuthenticated ? {} : "skip",
    );
    const router = useRouter();

    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (!isAuthenticated) {
            router.replace("/login?reason=session_expired");
            return;
        }

        if (authContext === undefined) {
            return;
        }

        const currentAuthContext = authContext;

        async function validateSession(): Promise<void> {
            if (currentAuthContext === null) {
                await signOut();
                router.replace("/login?reason=session_expired");
                return;
            }

            if (!currentAuthContext.isActive) {
                await signOut();
                router.replace("/login?reason=account_deactivated");
                return;
            }

            if (currentAuthContext.tenantStatus !== "active") {
                await signOut();
                router.replace("/login?reason=subscription_inactive");
            }
        }

        void validateSession();
    }, [authContext, authLoading, isAuthenticated, router, signOut]);

    if (authLoading || authContext === undefined) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <svg
                        className="h-8 w-8 animate-spin text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                    </svg>
                    <p className="text-sm text-muted-foreground">Validating session…</p>
                </div>
            </div>
        );
    }

    if (
        !isAuthenticated ||
        authContext === null ||
        !authContext.isActive ||
        authContext.tenantStatus !== "active"
    ) {
        return null;
    }

    return <>{children}</>;
}
