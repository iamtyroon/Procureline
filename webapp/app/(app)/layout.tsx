"use client";

import { useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Bell, Building2, CheckCircle2, CircleAlert, FileStack, Users2 } from "lucide-react";
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

function ProcurementHeaderPill({
    icon,
    label,
    value,
    tone = "neutral",
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    tone?: "neutral" | "positive" | "warning";
}) {
    return (
        <div
            className={cn(
                "flex min-w-[8.5rem] items-center gap-2 rounded-full border px-2.5 py-1.5",
                tone === "positive" && "border-emerald-500/25 bg-emerald-500/10",
                tone === "warning" && "border-amber-500/25 bg-amber-500/10",
                tone === "neutral" && "border-border/70 bg-muted/20",
            )}
        >
            <div
                className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    tone === "positive" && "bg-emerald-500/15 text-emerald-500",
                    tone === "warning" && "bg-amber-500/15 text-amber-500",
                    tone === "neutral" && "bg-primary/10 text-primary",
                )}
            >
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {label}
                </div>
                <div className="truncate text-[13px] font-semibold text-foreground">
                    {value}
                </div>
            </div>
        </div>
    );
}

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
    const procurementRequestPanel =
        authContext.role === "procurement_officer"
            ? procurementDashboardSnapshot?.futurePanels.find(
                (panel) => panel.id === "request_inbox",
            ) ?? null
            : null;
    const procurementSubmittedDepartments =
        authContext.role === "procurement_officer"
            ? procurementDashboardSnapshot?.submissionProgress
                .submittedDepartmentCount ?? 0
            : 0;
    const procurementDepartmentScope =
        authContext.role === "procurement_officer"
            ? procurementDashboardSnapshot?.submissionProgress
                .totalDepartmentCount ??
              procurementDashboardSnapshot?.meta.selectedDepartmentCount ??
              0
            : 0;
    const procurementStatusValue =
        authContext.role === "procurement_officer"
            ? procurementAlerts.length > 0
                ? "Attention needed"
                : "Online"
            : null;

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    {departmentUserHeroSupport ? (
                        <div className="flex h-16 items-center gap-4">
                            <div className="flex shrink-0 items-center gap-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                                    Procureline Workspace
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Signed in as {getRoleLabel(authContext.role)}
                                </p>
                            </div>

                            <div className="hidden h-8 w-px shrink-0 bg-border/60 lg:block" />

                            <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <Building2 className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="truncate text-sm font-semibold text-foreground">
                                            {departmentUserHeroSupport.departmentName}
                                        </div>
                                        <Badge variant="outline" className="shrink-0 rounded-full">
                                            {departmentUserHeroSupport.departmentCode}
                                        </Badge>
                                    </div>
                                    <div className="truncate text-xs text-muted-foreground">
                                        {departmentUserHeroSupport.tenantName}
                                    </div>
                                </div>
                            </div>

                            <div className="hidden shrink-0 items-center gap-3 rounded-full border border-border/70 bg-muted/20 px-3 py-2 lg:flex">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    {departmentUserHeroSupport.support.initials}
                                </div>
                                <div className="leading-tight">
                                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                        Procurement Officer
                                    </div>
                                    <div className="text-sm font-medium text-foreground">
                                        {departmentUserHeroSupport.support.name}
                                    </div>
                                </div>
                                <Badge
                                    className={cn(
                                        "rounded-full",
                                        departmentUserHeroSupport.support.state === "available"
                                            ? "bg-primary text-primary-foreground hover:bg-primary"
                                            : "bg-muted text-muted-foreground hover:bg-muted",
                                    )}
                                >
                                    {departmentUserHeroSupport.support.pillLabel}
                                </Badge>
                            </div>

                            <div className="ml-auto flex shrink-0 items-center gap-2">
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
                                {authContext.role === "procurement_officer" ? (
                                    <div className="hidden min-w-0 items-center gap-1.5 xl:flex">
                                        <ProcurementHeaderPill
                                            icon={<Users2 className="h-4 w-4" />}
                                            label="Plans submitted"
                                            tone={
                                                procurementDepartmentScope > 0 &&
                                                    procurementSubmittedDepartments === procurementDepartmentScope
                                                    ? "positive"
                                                    : "neutral"
                                            }
                                            value={`${procurementSubmittedDepartments}/${procurementDepartmentScope}`}
                                        />
                                        <ProcurementHeaderPill
                                            icon={<FileStack className="h-4 w-4" />}
                                            label="Pending requests"
                                            tone={
                                                procurementRequestPanel?.state === "available"
                                                    ? "warning"
                                                    : "neutral"
                                            }
                                            value={procurementRequestPanel?.statusLabel ?? "No pending"}
                                        />
                                        <ProcurementHeaderPill
                                            icon={<CheckCircle2 className="h-4 w-4" />}
                                            label="System status"
                                            tone={procurementAlerts.length > 0 ? "warning" : "positive"}
                                            value={procurementStatusValue ?? "Online"}
                                        />
                                    </div>
                                ) : null}
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
            </header>
            <main>
                <RoleGuard authContext={authContext}>{children}</RoleGuard>
            </main>
        </div>
    );
}
