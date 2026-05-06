"use client";

import { formatDistanceStrict } from "date-fns";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Building2,
    CircleAlert,
    Clock3,
    LayoutGrid,
    type LucideIcon,
    PanelLeftClose,
    PanelLeftOpen,
    ShieldCheck,
    Users2,
    Wallet,
} from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    formatDashboardTimestamp,
} from "@/lib/shared/tenant-admin/dashboard";
import {
    readTenantAdminDashboardCache,
    resolveDashboardSnapshotState,
    writeTenantAdminDashboardCache,
    type TenantAdminDashboardCacheEnvelope,
} from "@/lib/frontend/tenant-admin/dashboard-cache";
import {
    renderTenantAdminView,
    TENANT_ADMIN_VIEW_META,
    type TenantAdminView,
} from "@/src/components/tenant-admin/TenantAdminViewContent";
import { ProcurementOfficerManagementView } from "@/src/components/tenant-admin/po-management/ProcurementOfficerManagementView";
import { cn } from "@/lib/utils";

export function TenantAdminDashboard({
    view = "dashboard",
}: {
    view?: TenantAdminView;
}): JSX.Element {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const authContext = useQuery(api.functions.users.getAuthContext, {});
    const pathname = usePathname();
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<string | undefined>(
        undefined,
    );
    const [cachedEnvelope, setCachedEnvelope] =
        useState<TenantAdminDashboardCacheEnvelope | null>(null);
    const [countdownNow, setCountdownNow] = useState(() => Date.now());
    const [directoryQuery, setDirectoryQuery] = useState("");

    const liveSnapshot = useQuery(
        api.functions.tenantAdminDashboard.getTenantAdminDashboardSnapshot,
        selectedFiscalYear ? { selectedFiscalYear } : {},
    );

    const cacheTenantId =
        authContext && authContext.scope === "tenant" ? String(authContext.tenantId) : null;
    const cacheFiscalYear =
        selectedFiscalYear ?? liveSnapshot?.meta.selectedFiscalYear ?? null;

    useEffect(() => {
        if (!selectedFiscalYear && liveSnapshot?.meta.selectedFiscalYear) {
            setSelectedFiscalYear(liveSnapshot.meta.selectedFiscalYear);
        }
    }, [liveSnapshot?.meta.selectedFiscalYear, selectedFiscalYear]);

    useEffect(() => {
        if (!cacheTenantId || !cacheFiscalYear) {
            setCachedEnvelope(null);
            return;
        }

        setCachedEnvelope(
            readTenantAdminDashboardCache({
                fiscalYear: cacheFiscalYear,
                storage: typeof window === "undefined" ? null : window.localStorage,
                tenantId: cacheTenantId,
            }),
        );
    }, [cacheFiscalYear, cacheTenantId]);

    useEffect(() => {
        if (!liveSnapshot || !cacheTenantId) {
            return;
        }

        writeTenantAdminDashboardCache({
            fiscalYear: liveSnapshot.meta.selectedFiscalYear,
            snapshot: liveSnapshot,
            storage: typeof window === "undefined" ? null : window.localStorage,
            tenantId: cacheTenantId,
        });

        setCachedEnvelope(
            readTenantAdminDashboardCache({
                fiscalYear: liveSnapshot.meta.selectedFiscalYear,
                storage: typeof window === "undefined" ? null : window.localStorage,
                tenantId: cacheTenantId,
            }),
        );
    }, [cacheTenantId, liveSnapshot]);

    useEffect(() => {
        const countdownTarget = liveSnapshot?.cycleState.countdown.targetAt;
        const countdownMode = liveSnapshot?.cycleState.countdown.mode;

        if (
            !countdownTarget ||
            (countdownMode !== "until_deadline" && countdownMode !== "until_start")
        ) {
            return;
        }

        const timer = window.setInterval(() => {
            setCountdownNow(Date.now());
        }, 1000);

        return () => window.clearInterval(timer);
    }, [liveSnapshot?.cycleState.countdown.mode, liveSnapshot?.cycleState.countdown.targetAt]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const storedValue = window.localStorage.getItem(
            "procureline.tenant-admin-sidebar-collapsed",
        );
        setIsSidebarCollapsed(storedValue === "true");
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(
            "procureline.tenant-admin-sidebar-collapsed",
            String(isSidebarCollapsed),
        );
    }, [isSidebarCollapsed]);

    const resolvedSnapshotState = resolveDashboardSnapshotState({
        cachedEnvelope,
        liveSnapshot,
    });
    const snapshot = resolvedSnapshotState.snapshot;

    const liveCountdownLabel = useMemo(() => {
        if (!snapshot?.cycleState.countdown.targetAt) {
            return snapshot?.cycleState.countdown.label ?? "";
        }

        if (
            snapshot.cycleState.countdown.mode !== "until_deadline" &&
            snapshot.cycleState.countdown.mode !== "until_start"
        ) {
            return snapshot.cycleState.countdown.label;
        }

        const prefix =
            snapshot.cycleState.countdown.mode === "until_start"
                ? "Submission opens"
                : "Deadline closes";

        return `${prefix} ${formatDistanceStrict(
            new Date(snapshot.cycleState.countdown.targetAt),
            new Date(countdownNow),
            { addSuffix: true },
        )}`;
    }, [countdownNow, snapshot]);

    if (!snapshot) {
        return <TenantAdminDashboardSkeleton />;
    }

    const procurementOfficerCount = snapshot.directory.procurementOfficers.length;
    const sidebarSections = TENANT_ADMIN_SIDEBAR_SECTIONS;
    const viewMeta = TENANT_ADMIN_VIEW_META[view];
    const normalizedDirectoryQuery = directoryQuery.trim().toLowerCase();
    const visibleDepartmentUsers = snapshot.directory.departmentUsers.filter((member) =>
        normalizedDirectoryQuery.length === 0
            ? true
            : `${member.name} ${member.email} ${member.departmentName}`
                  .toLowerCase()
                  .includes(normalizedDirectoryQuery),
    );
    const visibleProcurementOfficers = snapshot.directory.procurementOfficers.filter((member) =>
        normalizedDirectoryQuery.length === 0
            ? true
            : `${member.name} ${member.email}`.toLowerCase().includes(normalizedDirectoryQuery),
    );
    const visibleAuditItems = snapshot.activityFeed.items.filter((item) =>
        normalizedDirectoryQuery.length === 0
            ? true
            : `${item.action} ${item.actor} ${item.entity} ${item.outcome}`
                  .toLowerCase()
                  .includes(normalizedDirectoryQuery),
    );

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background">
            <div className="lg:hidden px-4 py-8 sm:px-6">
                <Card className="mx-auto max-w-2xl rounded-[24px] border-border/70 bg-card shadow-sm">
                    <CardHeader className="space-y-4">
                        <Badge className="w-fit rounded-md bg-primary text-primary-foreground hover:bg-primary">
                            Desktop required
                        </Badge>
                        <CardTitle className="text-2xl text-foreground">
                            Tenant admin dashboards are designed for desktop viewports
                        </CardTitle>
                        <CardDescription className="text-base leading-7 text-muted-foreground">
                            This workspace follows the desktop-only tenant-admin layout from the
                            product prototype.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>

            <div className="hidden min-h-[calc(100vh-4rem)] lg:flex">
                <aside
                    className={cn(
                        "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
                        isSidebarCollapsed ? "w-[92px]" : "w-[300px]",
                    )}
                >
                    <div
                        className={cn(
                            "space-y-5",
                            isSidebarCollapsed ? "px-4 py-6" : "px-8 py-9",
                        )}
                    >
                        <div
                            className={cn(
                                "flex items-start",
                                isSidebarCollapsed
                                    ? "justify-center"
                                    : "justify-between gap-4",
                            )}
                        >
                            <div className={cn(isSidebarCollapsed && "hidden")}>
                                <div className="text-[2.125rem] font-bold tracking-tight text-sidebar-foreground">
                                    Procure<span className="text-primary">line</span>
                                </div>
                                <div className="mt-1 text-sm uppercase tracking-[0.14em] text-sidebar-foreground/70">
                                    Tenant Admin Portal
                                </div>
                            </div>
                            <div
                                className={cn(
                                    "flex items-center",
                                    isSidebarCollapsed && "w-full justify-center",
                                )}
                            >
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    aria-label={
                                        isSidebarCollapsed
                                            ? "Expand side panel"
                                            : "Collapse side panel"
                                    }
                                    onClick={() =>
                                        setIsSidebarCollapsed((current) => !current)
                                    }
                                    className="h-10 w-10 rounded-xl border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                >
                                    {isSidebarCollapsed ? (
                                        <PanelLeftOpen className="h-5 w-5" />
                                    ) : (
                                        <PanelLeftClose className="h-5 w-5" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        {isSidebarCollapsed ? (
                            <div className="mt-5 flex justify-center">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-primary font-bold text-sidebar-primary-foreground shadow-sm">
                                    {getInstitutionInitials(snapshot.meta.tenantName)}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <ScrollArea
                        className={cn(
                            "flex-1 py-8",
                            isSidebarCollapsed ? "px-3" : "px-6",
                        )}
                    >
                        <TooltipProvider delayDuration={150}>
                            <div className="space-y-8">
                                {sidebarSections.map((section) => (
                                    <TenantAdminSidebarSection
                                        key={section.title}
                                        collapsed={isSidebarCollapsed}
                                        pathname={pathname}
                                        section={section}
                                    />
                                ))}
                            </div>
                        </TooltipProvider>
                    </ScrollArea>

                    <div className={cn(isSidebarCollapsed ? "p-3" : "p-6")}>
                        <Separator className="mb-6" />
                        <div
                            className={cn(
                                "rounded-2xl border border-sidebar-border bg-sidebar-accent/70",
                                isSidebarCollapsed
                                    ? "flex justify-center p-3"
                                    : "flex items-center gap-3 p-4",
                            )}
                        >
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-primary font-bold text-sidebar-primary-foreground shadow-sm">
                                {getInstitutionInitials(snapshot.meta.tenantName)}
                            </div>
                            {isSidebarCollapsed ? null : (
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-sidebar-foreground">
                                        Tenant Admin
                                    </div>
                                    <div className="truncate text-xs text-sidebar-foreground/70">
                                        {snapshot.meta.tenantName}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                <div className="min-w-0 flex-1 bg-background">
                    <header className="border-b border-border/70 bg-card/70 px-8 py-7 backdrop-blur">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            {viewMeta.title}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {viewMeta.subtitle}
                        </p>
                    </header>

                    <div className="px-8 py-8">
                        <div className="mx-auto max-w-[1400px] space-y-6">
                            {resolvedSnapshotState.showStaleBanner ? (
                                <Alert
                                    className="rounded-2xl border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                                    dismissible
                                    dismissKey={
                                        resolvedSnapshotState.lastUpdatedAt
                                            ? `tenant-admin-stale-${resolvedSnapshotState.lastUpdatedAt}`
                                            : "tenant-admin-stale-unknown"
                                    }
                                >
                                    <CircleAlert className="h-4 w-4" />
                                    <AlertTitle>Showing cached dashboard data</AlertTitle>
                                    <AlertDescription>
                                        Real-time sync is temporarily unavailable. Last updated:{" "}
                                        {resolvedSnapshotState.lastUpdatedAt
                                            ? formatDashboardTimestamp(
                                                  resolvedSnapshotState.lastUpdatedAt,
                                              )
                                            : "Unknown"}
                                        .
                                    </AlertDescription>
                                </Alert>
                            ) : null}
                            {view === "po-management" ? (
                                <ProcurementOfficerManagementView snapshot={snapshot} />
                            ) : (
                                renderTenantAdminView({
                                    liveCountdownLabel,
                                    onDirectoryQueryChange: setDirectoryQuery,
                                    onFiscalYearChange: (nextValue) =>
                                        startTransition(() => {
                                            setSelectedFiscalYear(nextValue);
                                        }),
                                    procurementOfficerCount,
                                    resolvedSnapshotState,
                                    snapshot,
                                    view,
                                    visibleAuditItems,
                                    visibleDepartmentUsers,
                                    visibleProcurementOfficers,
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface TenantAdminSidebarItem {
    disabled?: boolean;
    href?: string;
    icon: LucideIcon;
    label: string;
    matchPrefixes?: string[];
}

interface TenantAdminSidebarSectionConfig {
    items: TenantAdminSidebarItem[];
    title: string;
}

const TENANT_ADMIN_SIDEBAR_SECTIONS: TenantAdminSidebarSectionConfig[] = [
    {
        title: "Overview",
        items: [
            {
                href: "/tenant-admin",
                icon: LayoutGrid,
                label: "Dashboard",
            },
        ],
    },
    {
        title: "User Management",
        items: [
            {
                href: "/tenant-admin/po-management",
                icon: Users2,
                label: "Procurement Officer",
            },
            {
                href: "/tenant-admin/department-users",
                icon: Users2,
                label: "Departmental Users",
            },
        ],
    },
    {
        title: "Procurement",
        items: [
            {
                href: "/tenant-admin/departments",
                icon: Building2,
                label: "Departments",
            },
        ],
    },
    {
        title: "Account",
        items: [
            {
                href: "/tenant-admin/billing",
                icon: Wallet,
                label: "Billing",
            },
            {
                href: "/tenant-admin/settings",
                icon: ShieldCheck,
                label: "Settings",
            },
            {
                href: "/tenant-admin/audit-log",
                icon: Clock3,
                label: "Audit Log",
            },
        ],
    },
];

function TenantAdminSidebarSection({
    collapsed,
    pathname,
    section,
}: {
    collapsed: boolean;
    pathname: string;
    section: TenantAdminSidebarSectionConfig;
}): JSX.Element {
    return (
        <div className="space-y-3">
            {collapsed ? null : (
                <div className="px-2 text-xs font-bold uppercase tracking-[0.14em] text-sidebar-foreground/60">
                    {section.title}
                </div>
            )}
            <div className="space-y-1">
                {section.items.map((item) => (
                    <TenantAdminSidebarItemButton
                        key={item.label}
                        collapsed={collapsed}
                        item={item}
                        pathname={pathname}
                    />
                ))}
            </div>
        </div>
    );
}

function TenantAdminSidebarItemButton({
    collapsed,
    item,
    pathname,
}: {
    collapsed: boolean;
    item: TenantAdminSidebarItem;
    pathname: string;
}): JSX.Element {
    const active = isTenantAdminSidebarItemActive(pathname, item);
    const content = (
        <>
            <item.icon className="h-5 w-5 shrink-0" />
            {collapsed ? null : <span className="truncate">{item.label}</span>}
        </>
    );
    const className = cn(
        "w-full rounded-2xl text-base transition-colors",
        collapsed
            ? "justify-center px-0"
            : "justify-start gap-3 px-4",
        active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : item.disabled
              ? "text-sidebar-foreground/45"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    );

    const button = item.href && !item.disabled ? (
        <Button asChild variant="ghost" className={className}>
            <Link href={item.href}>{content}</Link>
        </Button>
    ) : (
        <Button
            type="button"
            variant="ghost"
            disabled
            className={cn(className, "disabled:opacity-100")}
        >
            {content}
        </Button>
    );

    if (!collapsed) {
        return button;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
    );
}

function isTenantAdminSidebarItemActive(
    pathname: string,
    item: TenantAdminSidebarItem,
): boolean {
    if (!item.href) {
        return false;
    }

    const prefixes = item.matchPrefixes ?? [item.href];

    return prefixes.some((prefix) =>
        prefix === "/tenant-admin"
            ? pathname === prefix
            : pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}

function getInstitutionInitials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 3)
        .map((part) => part[0] ?? "")
        .join("")
        .toUpperCase();
}

function TenantAdminDashboardSkeleton(): JSX.Element {
    return (
        <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 sm:px-6">
            <Skeleton className="h-12 w-56 rounded-xl" />
            <div className="grid gap-5 xl:grid-cols-3">
                <Skeleton className="h-[17rem] rounded-2xl xl:col-span-2" />
                <Skeleton className="h-[12rem] rounded-2xl" />
                <Skeleton className="h-[12rem] rounded-2xl" />
                <Skeleton className="h-[12rem] rounded-2xl" />
                <Skeleton className="h-[12rem] rounded-2xl" />
                <Skeleton className="h-[16rem] rounded-2xl xl:col-span-2" />
                <Skeleton className="h-[16rem] rounded-2xl" />
                <Skeleton className="h-[18rem] rounded-2xl xl:col-span-3" />
            </div>
        </div>
    );
}
