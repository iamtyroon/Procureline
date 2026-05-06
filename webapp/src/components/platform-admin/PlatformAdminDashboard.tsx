"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
    ArrowDown,
    ArrowUp,
    Eye,
    EyeOff,
    LayoutGrid,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    ShieldAlert,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { PlatformAdminSecurityCard } from "@/src/components/auth/PlatformAdminSecurityCard";
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    filterPlatformAdminAlertsBySeverity,
    getVisiblePlatformAdminWidgetOrder,
    movePlatformAdminWidget,
    type PlatformAdminDashboardWidgetId,
} from "@/lib/shared/platform-admin/dashboard";
import type {
    PlatformAdminDashboardNavigationGroup,
    PlatformAdminDashboardSnapshot,
} from "@/lib/shared/platform-admin/dashboard-snapshot";
import { cn } from "@/lib/utils";
import {
    AlertRow,
    EmptyPanelState,
    HealthTileRow,
    PlatformAdminDashboardSkeleton,
    PlatformAdminMobileFallback,
    RecentTenantTableRow,
    SidebarIcon,
    SummaryCard,
    TimestampBadge,
} from "./PlatformAdminDashboardParts";

const WIDGET_META: Record<PlatformAdminDashboardWidgetId, { label: string }> = {
    recent_alerts: { label: "Recent Alerts" },
    recent_tenants: { label: "Recent Tenants" },
    system_health: { label: "System Health" },
};

const SECONDARY_ACTION_BUTTON_CLASS =
    "border-border bg-background/90 text-foreground shadow-sm hover:bg-muted/60 hover:text-foreground";

export function PlatformAdminDashboard(): JSX.Element {
    const pathname = usePathname();
    const [dashboardAccessError, setDashboardAccessError] = useState<string | null>(
        null,
    );
    const [dashboardAccessToken, setDashboardAccessToken] = useState<string | null>(
        null,
    );
    const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
    const issueDashboardReadAccess = useMutation(
        api.functions.platformAdminDashboard.issuePlatformAdminDashboardReadAccess,
    );
    const snapshot = useQuery(
        api.functions.platformAdminDashboard.getPlatformAdminDashboardSnapshot,
        dashboardAccessToken ? { accessToken: dashboardAccessToken } : "skip",
    );
    const savePreferences = useMutation(
        api.functions.platformAdminDashboard.saveCurrentPlatformAdminDashboardPreferences,
    );

    useEffect(() => {
        let cancelled = false;

        async function loadDashboardAccessToken(): Promise<void> {
            if (dashboardAccessToken || dashboardAccessError) {
                return;
            }

            try {
                const accessToken = await issueDashboardReadAccess({});
                if (!cancelled) {
                    setDashboardAccessToken(accessToken);
                }
            } catch {
                if (!cancelled) {
                    setDashboardAccessError(
                        "Platform dashboard access could not be verified. Retry to re-establish the audited read session.",
                    );
                }
            }
        }

        void loadDashboardAccessToken();

        return () => {
            cancelled = true;
        };
    }, [dashboardAccessError, dashboardAccessToken, issueDashboardReadAccess]);

    function handleRetryDashboardAccess(): void {
        setDashboardAccessError(null);
        setDashboardAccessToken(null);
    }

    if (dashboardAccessError) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-background">
                <PlatformAdminMobileFallback />
                <div className="hidden px-8 py-10 lg:block">
                    <Alert
                        className="mx-auto max-w-2xl rounded-[28px] border-border/70"
                        dismissible
                        dismissKey={dashboardAccessError}
                    >
                        <AlertTitle>Dashboard access needs to be re-established</AlertTitle>
                        <AlertDescription className="mt-2 space-y-4">
                            <p>{dashboardAccessError}</p>
                            <Button type="button" onClick={handleRetryDashboardAccess}>
                                Retry access check
                            </Button>
                        </AlertDescription>
                    </Alert>
                </div>
            </div>
        );
    }

    if (!dashboardAccessToken || !snapshot) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-background">
                <PlatformAdminMobileFallback />
                <PlatformAdminDashboardSkeleton />
            </div>
        );
    }

    const snapshotData = snapshot;
    const visibleWidgetOrder = getVisiblePlatformAdminWidgetOrder(
        snapshotData.preferences,
    );
    const visibleAlerts = filterPlatformAdminAlertsBySeverity(
        snapshotData.alerts.allItems,
        snapshotData.preferences.alertSeverityFilter,
    );

    async function updatePreferences(input: {
        alertSeverityFilter?: "all" | "critical" | "warning";
        hiddenWidgetIds?: PlatformAdminDashboardWidgetId[];
        sidebarCollapsed?: boolean;
        widgetOrder?: PlatformAdminDashboardWidgetId[];
    }): Promise<void> {
        await savePreferences(input);
    }

    async function handleToggleWidget(widgetId: PlatformAdminDashboardWidgetId) {
        const hidden = new Set(snapshotData.preferences.hiddenWidgetIds);
        if (hidden.has(widgetId)) {
            hidden.delete(widgetId);
        } else {
            if (visibleWidgetOrder.length <= 1) {
                return;
            }
            hidden.add(widgetId);
        }
        await updatePreferences({ hiddenWidgetIds: Array.from(hidden) });
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background">
            <PlatformAdminMobileFallback />

            <div className="hidden min-h-[calc(100vh-4rem)] lg:flex">
                <TooltipProvider delayDuration={150}>
                    <aside
                        className={cn(
                            "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
                            snapshotData.preferences.sidebarCollapsed ? "w-[96px]" : "w-[312px]",
                        )}
                    >
                        <div className={cn("space-y-5", snapshotData.preferences.sidebarCollapsed ? "px-4 py-6" : "px-8 py-9")}>
                            <div className={cn("flex items-start", snapshotData.preferences.sidebarCollapsed ? "justify-center" : "justify-between gap-4")}>
                                <div className={cn(snapshotData.preferences.sidebarCollapsed && "hidden")}>
                                    <div className="text-[2.125rem] font-bold tracking-tight text-sidebar-foreground">
                                        Procure<span className="text-primary">line</span>
                                    </div>
                                    <div className="mt-1 text-sm uppercase tracking-[0.14em] text-sidebar-foreground/70">
                                        Platform Admin
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    aria-label={snapshotData.preferences.sidebarCollapsed ? "Expand side panel" : "Collapse side panel"}
                                    onClick={() =>
                                        void updatePreferences({
                                            sidebarCollapsed: !snapshotData.preferences.sidebarCollapsed,
                                        })
                                    }
                                    className="h-10 w-10 rounded-xl border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                >
                                    {snapshotData.preferences.sidebarCollapsed ? (
                                        <PanelLeftOpen className="h-5 w-5" />
                                    ) : (
                                        <PanelLeftClose className="h-5 w-5" />
                                    )}
                                </Button>
                            </div>
                            <Separator />
                        </div>

                        <ScrollArea className={cn("flex-1 py-8", snapshotData.preferences.sidebarCollapsed ? "px-3" : "px-6")}>
                            <div className="space-y-8">
                                {snapshotData.navigation.map((section) => (
                                    <SidebarSection
                                        key={section.label}
                                        collapsed={snapshotData.preferences.sidebarCollapsed}
                                        pathname={pathname}
                                        section={section}
                                    />
                                ))}
                            </div>
                        </ScrollArea>

                        <div className={cn(snapshotData.preferences.sidebarCollapsed ? "p-3" : "p-6")}>
                            <Separator className="mb-6" />
                            <div className={cn("rounded-2xl border border-sidebar-border bg-sidebar-accent/70", snapshotData.preferences.sidebarCollapsed ? "flex justify-center p-3" : "flex items-center gap-3 p-4")}>
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-primary font-bold text-sidebar-primary-foreground shadow-sm">
                                    {snapshotData.currentAdmin.initials}
                                </div>
                                {snapshotData.preferences.sidebarCollapsed ? null : (
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-sidebar-foreground">
                                            {snapshotData.currentAdmin.name}
                                        </div>
                                        <div className="truncate text-xs text-sidebar-foreground/70">
                                            {snapshotData.currentAdmin.email}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    <div className="min-w-0 flex-1 bg-background">
                        <header className="border-b border-border/70 bg-card/70 px-8 py-7 backdrop-blur">
                            <div className="flex items-start justify-between gap-6">
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                        Platform Dashboard
                                    </h1>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Snapshot of current tenant, alert, and health records.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
                                        <DialogTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)}
                                            >
                                                <LayoutGrid className="mr-2 h-4 w-4" />
                                                Customize
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl border-border/70 sm:rounded-[28px]">
                                            <DialogHeader className="space-y-3">
                                                <DialogTitle>Customize dashboard</DialogTitle>
                                                <DialogDescription>
                                                    Sidebar, alert severity, and widget layout preferences save to your profile.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-6">
                                                <div className="space-y-3">
                                                    <div className="text-sm font-semibold text-foreground">Severity filter</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {[
                                                            { label: "All", value: "all" as const },
                                                            { label: "Warnings+", value: "warning" as const },
                                                            { label: "Critical only", value: "critical" as const },
                                                        ].map((option) => (
                                                            <Button
                                                                key={option.value}
                                                                type="button"
                                                                variant={snapshotData.preferences.alertSeverityFilter === option.value ? "default" : "outline"}
                                                                className={cn(
                                                                    "rounded-full",
                                                                    snapshotData.preferences.alertSeverityFilter === option.value
                                                                        ? ""
                                                                        : SECONDARY_ACTION_BUTTON_CLASS,
                                                                )}
                                                                onClick={() => void updatePreferences({ alertSeverityFilter: option.value })}
                                                            >
                                                                {option.label}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="text-sm font-semibold text-foreground">Widget layout</div>
                                                    {snapshotData.preferences.widgetOrder.map((widgetId, index) => {
                                                        const isHidden = snapshotData.preferences.hiddenWidgetIds.includes(widgetId);
                                                        return (
                                                            <div key={widgetId} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                                                                <div>
                                                                    <div className="font-medium text-foreground">{WIDGET_META[widgetId].label}</div>
                                                                    <div className="text-sm text-muted-foreground">
                                                                        {isHidden ? "Hidden from the dashboard" : "Visible on the dashboard"}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="icon"
                                                                        className={cn("h-9 w-9 rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)}
                                                                        disabled={index === 0}
                                                                        onClick={() =>
                                                                            void updatePreferences({
                                                                                widgetOrder: movePlatformAdminWidget({
                                                                                    direction: "backward",
                                                                                    widgetId,
                                                                                    widgetOrder: snapshotData.preferences.widgetOrder,
                                                                                }),
                                                                            })
                                                                        }
                                                                    >
                                                                        <ArrowUp className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="icon"
                                                                        className={cn("h-9 w-9 rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)}
                                                                        disabled={index === snapshotData.preferences.widgetOrder.length - 1}
                                                                        onClick={() =>
                                                                            void updatePreferences({
                                                                                widgetOrder: movePlatformAdminWidget({
                                                                                    direction: "forward",
                                                                                    widgetId,
                                                                                    widgetOrder: snapshotData.preferences.widgetOrder,
                                                                                }),
                                                                            })
                                                                        }
                                                                    >
                                                                        <ArrowDown className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)}
                                                                        onClick={() => void handleToggleWidget(widgetId)}
                                                                    >
                                                                        {isHidden ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                                                                        {isHidden ? "Show" : "Hide"}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>

                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)}
                                            >
                                                <ShieldAlert className="mr-2 h-4 w-4" />
                                                Security controls
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-5xl border-border/70 p-0 sm:rounded-[28px]">
                                            <DialogHeader className="border-b border-border/70 px-6 py-5 text-left">
                                                <DialogTitle>Platform admin security</DialogTitle>
                                                <DialogDescription>
                                                    Security controls remain available here while the dashboard becomes the default home.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="max-h-[80vh] overflow-y-auto p-6">
                                                <PlatformAdminSecurityCard />
                                            </div>
                                        </DialogContent>
                                    </Dialog>

                                    <Button asChild className="rounded-xl shadow-sm shadow-primary/20">
                                        <Link href="/platform-admin/tenants">
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Tenant
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </header>

                        <div className="px-8 py-8">
                            <div className="mx-auto max-w-[1480px] space-y-6">
                                <div className="grid gap-4 xl:grid-cols-4">
                                    {snapshotData.summaryCards.map((card) => (
                                        <SummaryCard key={card.id} card={card} />
                                    ))}
                                </div>

                                {visibleWidgetOrder.length === 0 ? (
                                    <Alert
                                        className="rounded-3xl border-border/70"
                                        dismissible
                                        dismissKey="all-platform-admin-widgets-hidden"
                                    >
                                        <AlertTitle>All widgets are hidden</AlertTitle>
                                        <AlertDescription>
                                            Open Customize to restore Recent Tenants, System Health,
                                            or Recent Alerts.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <DashboardWidgets
                                        alerts={visibleAlerts}
                                        snapshot={snapshotData}
                                        visibleWidgetOrder={visibleWidgetOrder}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </TooltipProvider>
            </div>
        </div>
    );
}

function SidebarSection({
    collapsed,
    pathname,
    section,
}: {
    collapsed: boolean;
    pathname: string;
    section: PlatformAdminDashboardNavigationGroup;
}): JSX.Element {
    return (
        <div className="space-y-3">
            {collapsed ? null : (
                <div className="px-2 text-xs font-bold uppercase tracking-[0.14em] text-sidebar-foreground/60">
                    {section.label}
                </div>
            )}
            <div className="space-y-1">
                {section.items.map((item) => {
                    const active =
                        item.href === "/platform-admin"
                            ? pathname === item.href
                            : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const button = (
                        <Button
                            asChild
                            variant="ghost"
                            className={cn(
                                "w-full rounded-2xl text-base transition-colors",
                                collapsed ? "justify-center px-0" : "justify-start gap-3 px-4",
                                active
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            )}
                        >
                            <Link href={item.href}>
                                <SidebarIcon itemId={item.id} />
                                {collapsed ? null : <span className="truncate">{item.label}</span>}
                            </Link>
                        </Button>
                    );

                    if (!collapsed) {
                        return <div key={item.id}>{button}</div>;
                    }

                    return (
                        <Tooltip key={item.id}>
                            <TooltipTrigger asChild>{button}</TooltipTrigger>
                            <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>
        </div>
    );
}

function DashboardWidgets({
    alerts,
    snapshot,
    visibleWidgetOrder,
}: {
    alerts: PlatformAdminDashboardSnapshot["alerts"]["allItems"];
    snapshot: PlatformAdminDashboardSnapshot;
    visibleWidgetOrder: PlatformAdminDashboardWidgetId[];
}): JSX.Element {
    const renderWidget = (widgetId: PlatformAdminDashboardWidgetId) => {
        if (widgetId === "recent_tenants") {
            return (
                <div className="rounded-[28px] border border-border/70 bg-card/95 shadow-sm">
                    <div className="flex items-center justify-between gap-4 border-b border-border/70 px-6 py-5">
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">Recent Tenants</h3>
                            <p className="text-sm text-muted-foreground">Most recently created tenant records.</p>
                        </div>
                        <Button
                            asChild
                            variant="outline"
                            className={cn("rounded-full", SECONDARY_ACTION_BUTTON_CLASS)}
                        >
                            <Link href="/platform-admin/tenants">View All</Link>
                        </Button>
                    </div>
                    <div className="px-6 py-5">
                        {snapshot.recentTenants.rows.length === 0 ? (
                            <EmptyPanelState
                                title="No tenant records yet"
                                body="Tenant activity will appear here as soon as live institutions are added to the platform."
                            />
                        ) : (
                            <div className="overflow-hidden rounded-2xl border border-border/70">
                                <table className="w-full text-left">
                                    <thead className="bg-muted/30 text-sm text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Institution</th>
                                            <th className="px-4 py-3 font-medium">Plan</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                            <th className="px-4 py-3 font-medium">Departments</th>
                                            <th className="px-4 py-3 font-medium">Joined</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {snapshot.recentTenants.rows.map((row) => (
                                            <RecentTenantTableRow key={row.id} row={row} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (widgetId === "system_health") {
            return (
                <div className="rounded-[28px] border border-border/70 bg-card/95 shadow-sm">
                    <div className="flex items-center justify-between gap-4 border-b border-border/70 px-6 py-5">
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">System Health</h3>
                            <p className="text-sm text-muted-foreground">{snapshot.healthSummary.summaryLabel}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {snapshot.healthSummary.capturedAtLabel ? (
                                <TimestampBadge
                                    timestamp={snapshot.healthSummary.capturedAt ?? 0}
                                    utcLabel={snapshot.healthSummary.capturedAtLabel}
                                />
                            ) : null}
                            <Button
                                asChild
                                variant="outline"
                                className={cn("rounded-full", SECONDARY_ACTION_BUTTON_CLASS)}
                            >
                                <Link href="/platform-admin/health">View Health</Link>
                            </Button>
                        </div>
                    </div>
                    <div className="grid gap-3 px-6 py-5">
                        {snapshot.healthSummary.tiles.map((tile) => (
                            <HealthTileRow key={tile.id} tile={tile} />
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="rounded-[28px] border border-border/70 bg-card/95 shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-border/70 px-6 py-5">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Recent Alerts</h3>
                        <p className="text-sm text-muted-foreground">Live alert signals from audit, isolation, sync, and health data.</p>
                    </div>
                    <Button
                        asChild
                        variant="outline"
                        className={cn("rounded-full", SECONDARY_ACTION_BUTTON_CLASS)}
                    >
                        <Link href="/platform-admin/audit-logs">View All Logs</Link>
                    </Button>
                </div>
                <div className="space-y-3 px-6 py-5">
                    {alerts.length === 0 ? (
                        <EmptyPanelState
                            title="No alerts for this filter"
                            body="No alerts currently match the selected severity filter."
                        />
                    ) : (
                        alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            <div className={cn("grid gap-5", visibleWidgetOrder.length > 1 ? "xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.95fr)]" : "grid-cols-1")}>
                {visibleWidgetOrder.slice(0, 2).map((widgetId) => (
                    <div key={widgetId}>{renderWidget(widgetId)}</div>
                ))}
            </div>
            {visibleWidgetOrder[2] ? <div>{renderWidget(visibleWidgetOrder[2])}</div> : null}
        </>
    );
}
