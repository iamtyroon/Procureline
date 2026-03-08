"use client";

import { useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";

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
    const markCurrentSessionLoggedOut = useMutation(
        api.functions.sessions.markCurrentSessionLoggedOut,
    );
    const touchCurrentSession = useMutation(api.functions.sessions.touchCurrentSession);
    const router = useRouter();
    const pathname = usePathname();

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
            if (
                currentAuthContext === null ||
                !currentAuthContext.isSessionValid
            ) {
                try {
                    await markCurrentSessionLoggedOut({});
                } catch {
                    // Best-effort cleanup before sign-out.
                }
                await signOut();
                router.replace(
                    `/login?reason=${currentAuthContext?.redirectReason ?? "session_expired"}`,
                );
                return;
            }

            if (!currentAuthContext.isActive) {
                await signOut();
                router.replace(
                    `/login?reason=${currentAuthContext.redirectReason ?? "account_deactivated"}`,
                );
                return;
            }

            if (currentAuthContext.tenantStatus !== "active") {
                await signOut();
                router.replace(
                    `/login?reason=${currentAuthContext.redirectReason ?? "subscription_inactive"}`,
                );
            }
        }

        void validateSession();
    }, [authContext, authLoading, isAuthenticated, router, signOut]);

    useEffect(() => {
        if (
            authLoading ||
            !isAuthenticated ||
            authContext === undefined ||
            authContext === null ||
            !authContext.isSessionValid ||
            !authContext.isActive ||
            authContext.tenantStatus !== "active"
        ) {
            return;
        }

        async function recordActivity(): Promise<void> {
            const result = await touchCurrentSession({});

            if (result && result.sessionStatus !== "active") {
                await signOut();
                router.replace(`/login?reason=${result.redirectReason}`);
            }
        }

        void recordActivity();
    }, [
        authContext,
        authLoading,
        isAuthenticated,
        pathname,
        router,
        signOut,
        touchCurrentSession,
    ]);

    async function handleLogout(): Promise<void> {
        try {
            await markCurrentSessionLoggedOut({});
        } catch {
            // Sign-out still needs to proceed even if metadata cleanup fails.
        }

        await signOut();
        router.replace("/login");
        router.refresh();
    }

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
        !authContext.isSessionValid ||
        !authContext.isActive ||
        authContext.tenantStatus !== "active"
    ) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                            Procureline Workspace
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Signed in as {authContext.role.replaceAll("_", " ")}
                        </p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => void handleLogout()}>
                        Log out
                    </Button>
                </div>
            </header>
            <main>{children}</main>
        </div>
    );
}
