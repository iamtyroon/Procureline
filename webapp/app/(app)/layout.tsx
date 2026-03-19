"use client";

import { useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Bell, CircleAlert } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    getAuthNoticeMessage,
    getRoleLabel,
    shouldTerminateAuthenticatedSession,
} from "@/lib/auth/roles";
import { ModeToggle } from "@/src/components/mode-toggle";
import { RoleGuard } from "@/src/components/auth/RoleGuard";
import { Spinner } from "@/src/components/ui/Spinner";

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
    const procurementDashboardSnapshot = useQuery(
        api.functions.procurementOfficerDashboard.getProcurementOfficerDashboardSnapshot,
        authContext?.role === "procurement_officer" ? {} : "skip",
    );
    const markCurrentSessionLoggedOut = useMutation(
        api.functions.sessions.markCurrentSessionLoggedOut,
    );
    const touchCurrentSession = useMutation(api.functions.sessions.touchCurrentSession);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

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
            if (currentAuthContext === null || !currentAuthContext.isSessionValid) {
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

            if (shouldTerminateAuthenticatedSession(currentAuthContext)) {
                await signOut();
                router.replace(
                    `/login?reason=${currentAuthContext.redirectReason ?? "session_expired"}`,
                );
            }
        }

        void validateSession();
    }, [
        authContext,
        authLoading,
        isAuthenticated,
        markCurrentSessionLoggedOut,
        router,
        signOut,
    ]);

    useEffect(() => {
        if (
            authLoading ||
            !isAuthenticated ||
            authContext === undefined ||
            authContext === null ||
            shouldTerminateAuthenticatedSession(authContext)
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
                    <Spinner />
                    <p className="text-sm text-muted-foreground">Validating session...</p>
                </div>
            </div>
        );
    }

    if (
        !isAuthenticated ||
        authContext === null ||
        shouldTerminateAuthenticatedSession(authContext)
    ) {
        return null;
    }

    const noticeMessage = getAuthNoticeMessage(searchParams.get("reason"));
    const procurementAlerts =
        authContext.role === "procurement_officer"
            ? (procurementDashboardSnapshot?.alerts ?? [])
            : [];

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                            Procureline Workspace
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Signed in as {getRoleLabel(authContext.role)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {authContext.role === "procurement_officer" ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="relative"
                                    >
                                        <Bell className="h-[1.2rem] w-[1.2rem]" />
                                        {procurementAlerts.length > 0 ? (
                                            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                                                {procurementAlerts.length}
                                            </span>
                                        ) : null}
                                        <span className="sr-only">Open notifications</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[22rem]">
                                    <DropdownMenuLabel className="flex items-center justify-between">
                                        Notifications
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {procurementAlerts.length}
                                        </span>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {procurementAlerts.length === 0 ? (
                                        <div className="px-2 py-3 text-sm text-muted-foreground">
                                            No active procurement alerts.
                                        </div>
                                    ) : (
                                        procurementAlerts.map((alert) => (
                                            <DropdownMenuItem
                                                key={alert.id}
                                                className="items-start gap-3 py-3"
                                                onClick={() => router.push(alert.cta.href)}
                                            >
                                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                                                    <CircleAlert className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-semibold text-foreground">
                                                        {alert.title}
                                                    </div>
                                                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                                        {alert.message}
                                                    </div>
                                                    <div className="mt-2 text-[11px] font-semibold text-primary">
                                                        {alert.cta.label}
                                                    </div>
                                                </div>
                                            </DropdownMenuItem>
                                        ))
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : null}
                        <ModeToggle />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleLogout()}
                        >
                            Log out
                        </Button>
                    </div>
                </div>
                {noticeMessage ? (
                    <div
                        className="border-t border-border/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 sm:px-6"
                        role="status"
                    >
                        <div className="mx-auto max-w-6xl">{noticeMessage}</div>
                    </div>
                ) : null}
            </header>
            <main>
                <RoleGuard authContext={authContext}>{children}</RoleGuard>
            </main>
        </div>
    );
}
