"use client";

import { useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Bell, Building2, CircleAlert } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
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
} from "@/lib/shared/auth/roles";
import { PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS } from "@/lib/procurement-officer/dashboard-search";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/src/components/mode-toggle";
import { RoleGuard } from "@/src/components/auth/RoleGuard";
import { Spinner } from "@/src/components/ui/Spinner";

const platformAdminOperationsApi = (api as any).functions.platformAdminOperations;

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { signOut } = useAuthActions();
    const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const selectedProcurementFiscalYear =
        searchParams.get(PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear) ?? undefined;
    const authContext = useQuery(
        api.functions.users.getAuthContext,
        isAuthenticated ? {} : "skip",
    );
    const procurementDashboardSnapshot = useQuery(
        api.functions.procurementOfficerDashboard.getProcurementOfficerDashboardSnapshot,
        authContext?.role === "procurement_officer"
            ? {
                ...(selectedProcurementFiscalYear
                    ? {
                        selectedFiscalYear: selectedProcurementFiscalYear,
                    }
                    : {}),
            }
            : "skip",
    );
    const departmentUserDashboardSnapshot = useQuery(
        api.functions.departmentUserDashboard.getDepartmentUserDashboardSnapshot,
        authContext?.role === "department_user" ? {} : "skip",
    );
    const activeMaintenanceWindow = useQuery(
        platformAdminOperationsApi.getActiveMaintenanceWindow,
        isAuthenticated ? {} : "skip",
    );
    const markCurrentSessionLoggedOut = useMutation(
        api.functions.sessions.markCurrentSessionLoggedOut,
    );
    const touchCurrentSession = useMutation(api.functions.sessions.touchCurrentSession);

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
    const departmentUserHeroSupport =
        authContext.role === "department_user"
            ? (departmentUserDashboardSnapshot?.heroSupport ?? null)
            : null;

    return (
        <div className="min-h-screen bg-background">
            {pathname.startsWith("/po/consolidation") ? null : (
            <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    {departmentUserHeroSupport ? (
                        <div className="flex h-16 items-center gap-6">
                            <div className="flex shrink-0 items-center gap-2.5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="/brand/procureline-logo.png"
                                    alt="Procureline"
                                    className="h-8 w-auto"
                                />
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                                        Procureline
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {getRoleLabel(authContext.role)}
                                    </p>
                                </div>
                            </div>

                            <div className="hidden h-8 w-px shrink-0 bg-border/60 lg:block" />

                            <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Building2 className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="truncate text-sm font-semibold text-foreground">
                                            {departmentUserHeroSupport.departmentName}
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="hidden shrink-0 rounded-full font-mono text-[11px] xl:inline-flex"
                                        >
                                            {departmentUserHeroSupport.departmentCode}
                                        </Badge>
                                    </div>
                                    <div className="truncate text-xs text-muted-foreground">
                                        {departmentUserHeroSupport.tenantName}
                                    </div>
                                </div>
                            </div>

                            <div className="ml-auto flex shrink-0 items-center gap-2">
                                <div
                                    className="hidden items-center gap-2.5 rounded-lg border border-border/60 py-1.5 pl-1.5 pr-3 lg:flex"
                                    title={`${departmentUserHeroSupport.support.name} · ${departmentUserHeroSupport.support.email}`}
                                >
                                    <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                                        {departmentUserHeroSupport.support.initials}
                                        <span
                                            className={cn(
                                                "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-background",
                                                departmentUserHeroSupport.support.state === "available"
                                                    ? "bg-primary"
                                                    : "bg-muted-foreground",
                                            )}
                                            aria-hidden="true"
                                        />
                                    </div>
                                    <div className="min-w-0 leading-tight">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                            Procurement Officer
                                        </div>
                                        <div className="max-w-[160px] truncate text-xs font-medium text-foreground">
                                            {departmentUserHeroSupport.support.name}
                                        </div>
                                    </div>
                                </div>
                                <ModeToggle />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void handleLogout()}
                                >
                                    Log out
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex min-h-14 items-center justify-between gap-3 py-2">
                            <div className="min-w-0">
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                                        Procureline Workspace
                                    </p>
                                    <p className="truncate text-sm text-muted-foreground">
                                        Signed in as {getRoleLabel(authContext.role)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                                <div className="flex shrink-0 items-center gap-2">
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
                        </div>
                    )}
                </div>
                {noticeMessage ? (
                    <div
                        className="border-t border-border/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 sm:px-6"
                        role="status"
                    >
                        <div className="mx-auto max-w-6xl">{noticeMessage}</div>
                    </div>
                ) : null}
                {activeMaintenanceWindow ? (
                    <div
                        className="border-t border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-6"
                        role="status"
                    >
                        <div className="mx-auto max-w-6xl">
                            {activeMaintenanceWindow.title}: {activeMaintenanceWindow.message}
                        </div>
                    </div>
                ) : null}
            </header>
            )}
            <main>
                <RoleGuard authContext={authContext}>{children}</RoleGuard>
            </main>
        </div>
    );
}
