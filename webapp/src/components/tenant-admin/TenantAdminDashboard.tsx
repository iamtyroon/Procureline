"use client";

import { formatDistanceStrict } from "date-fns";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    ArrowRight,
    Building2,
    CircleAlert,
    Clock3,
    FileText,
    Landmark,
    LayoutGrid,
    LoaderCircle,
    type LucideIcon,
    MapPin,
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
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    formatFiscalYearLabel,
    type DashboardCycleState,
} from "@/lib/tenant-admin/dashboard";
import {
    readTenantAdminDashboardCache,
    resolveDashboardSnapshotState,
    writeTenantAdminDashboardCache,
    type TenantAdminDashboardCacheEnvelope,
} from "@/lib/tenant-admin/dashboard-cache";
import { cn } from "@/lib/utils";

export function TenantAdminDashboard(): JSX.Element {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const authContext = useQuery(api.functions.users.getAuthContext, {});
    const pathname = usePathname();
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<string | undefined>(
        undefined,
    );
    const [cachedEnvelope, setCachedEnvelope] =
        useState<TenantAdminDashboardCacheEnvelope | null>(null);
    const [countdownNow, setCountdownNow] = useState(() => Date.now());

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

    const procurementOfficerCount = Number(snapshot.summaryCards.totalPOs.value) || 0;
    const sidebarSections = TENANT_ADMIN_SIDEBAR_SECTIONS;

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
                            Dashboard
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Overview of your institution procurement system
                        </p>
                    </header>

                    <div className="px-8 py-8">
                        <div className="mx-auto max-w-[1400px] space-y-6">
                            {resolvedSnapshotState.showStaleBanner ? (
                                <Alert className="rounded-2xl border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
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

                            <section className="grid gap-5 xl:grid-cols-3">
                        <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-2">
                            <CardContent className="space-y-6 p-6">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-2 text-lg font-extrabold text-primary-foreground">
                                        {getInstitutionInitials(snapshot.meta.tenantName)}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-xl font-bold text-foreground">
                                            {snapshot.meta.tenantName}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <MapPin className="h-3.5 w-3.5" />
                                            Tenant-scoped workspace
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                                        <Landmark className="h-3.5 w-3.5" />
                                        {formatFiscalYearLabel(snapshot.meta.selectedFiscalYear)}
                                    </div>
                                    <StatusBadge
                                        tone="success"
                                        value={humanizeTenantStatus(snapshot.meta.tenantStatus)}
                                    />
                                </div>

                                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
                                    <div className="rounded-xl border border-border/70 bg-muted/50 p-4">
                                        <div className="text-sm leading-7 text-muted-foreground">
                                            Keep a quick view of tenant setup, user coverage, and
                                            department submission posture in the same arrangement as
                                            the admin HTML prototype.
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-border/70 bg-background p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                            Fiscal year
                                        </p>
                                        <Select
                                            value={snapshot.meta.selectedFiscalYear}
                                            onValueChange={(nextValue) => {
                                                startTransition(() => {
                                                    setSelectedFiscalYear(nextValue);
                                                });
                                            }}
                                        >
                                            <SelectTrigger className="mt-3 h-10 rounded-lg border-border bg-background">
                                                <SelectValue placeholder="Select fiscal year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {snapshot.meta.availableFiscalYears.map((year) => (
                                                    <SelectItem key={year} value={year}>
                                                        {formatFiscalYearLabel(year)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                                                Tier: {snapshot.meta.tenantTier}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {resolvedSnapshotState.state === "live" ? (
                                                    <LoaderCircle className="h-3.5 w-3.5 text-primary" />
                                                ) : (
                                                    <CircleAlert className="h-3.5 w-3.5 text-amber-500" />
                                                )}
                                                Last updated:{" "}
                                                {formatDashboardTimestamp(
                                                    snapshot.meta.lastUpdatedAt,
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <PrototypeStatCard
                            icon={Users2}
                            iconTone="secondary"
                            label="Total Users"
                            meta={formatUserBreakdownShort(snapshot.userSummary)}
                            value={String(snapshot.userSummary.activeTotal)}
                        />

                        <PrototypeStatCard
                            icon={ShieldCheck}
                            iconTone="primary"
                            label="Submission Progress"
                            meta={snapshot.summaryCards.submissionProgress.helperText}
                            value={snapshot.summaryCards.submissionProgress.value}
                        />

                        <PrototypeStatCard
                            icon={Wallet}
                            iconTone="accent"
                            label="Budget Utilized"
                            meta={snapshot.summaryCards.budgetUtilization.helperText}
                            value={snapshot.summaryCards.budgetUtilization.value}
                        />

                        <PrototypeStatCard
                            icon={Building2}
                            iconTone="tertiary"
                            label="Active Departments"
                            meta={snapshot.summaryCards.departments.helperText}
                            value={snapshot.summaryCards.departments.value}
                        />

                        <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-2">
                            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/70 pb-4">
                                <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                                        <Users2 className="h-4 w-4" />
                                    </div>
                                    Procurement Officer
                                </div>
                                <Link
                                    href="/tenant-admin/po-management"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                >
                                    Manage
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="flex gap-5 rounded-xl border border-border/70 bg-muted/40 p-5">
                                    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground shadow-sm">
                                        {procurementOfficerCount > 0 ? "PO" : "NA"}
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-3">
                                        <div>
                                            <div className="text-lg font-semibold text-foreground">
                                                {procurementOfficerCount > 0
                                                    ? `${pluralize(procurementOfficerCount, "Procurement Officer")} assigned`
                                                    : "No Procurement Officer assigned yet"}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {snapshot.summaryCards.totalPOs.helperText}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <MetaPill icon={Clock3} value={liveCountdownLabel} />
                                            <MetaPill
                                                icon={ShieldCheck}
                                                value={snapshot.summaryCards.totalPOs.trendLabel}
                                            />
                                            <StatusBadge
                                                tone={
                                                    procurementOfficerCount > 0
                                                        ? "success"
                                                        : "warning"
                                                }
                                                value={snapshot.summaryCards.totalPOs.statusLabel}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                            <CardHeader className="space-y-3 pb-4">
                                <CardTitle className="text-sm font-semibold text-foreground">
                                    Procurement Cycle
                                </CardTitle>
                                <CardDescription className="text-sm leading-6 text-muted-foreground">
                                    {snapshot.cycleState.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-2xl font-bold tracking-tight text-foreground">
                                    {snapshot.cycleState.title}
                                </div>
                                <StatusBadge
                                    tone={getCycleTone(snapshot.cycleState.state)}
                                    value={humanizeCycleState(snapshot.cycleState.state)}
                                />
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Cycle signal</span>
                                        <span>{getCycleProgressValue(snapshot.cycleState.state)}%</span>
                                    </div>
                                    <Progress
                                        value={getCycleProgressValue(snapshot.cycleState.state)}
                                        className="h-2 bg-muted"
                                    />
                                </div>
                                <p className="text-sm leading-6 text-muted-foreground">
                                    {liveCountdownLabel}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-3">
                            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/70 pb-4">
                                <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground shadow-sm">
                                        <Building2 className="h-4 w-4" />
                                    </div>
                                    Department Status
                                </div>
                                <span className="text-xs font-medium text-primary">
                                    {snapshot.departmentStatus.length} shown
                                </span>
                            </CardHeader>
                            <CardContent className="p-6">
                                {snapshot.departmentStatus.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                                        <p className="text-sm font-medium text-foreground">
                                            No departments configured yet
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                            Add departments and submission windows to populate this
                                            status grid.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        {snapshot.departmentStatus.map((department) => (
                                            <DepartmentStatusCard
                                                key={department.id}
                                                detail={department.detail}
                                                name={department.name}
                                                progressTone={department.progressTone}
                                                progressValue={department.progressValue}
                                                statusLabel={department.statusLabel}
                                            />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                            </section>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface PrototypeStatCardProps {
    icon: typeof Users2;
    iconTone: "accent" | "primary" | "secondary" | "tertiary";
    label: string;
    meta: string;
    value: string;
}

function PrototypeStatCard({
    icon: Icon,
    iconTone,
    label,
    meta,
    value,
}: PrototypeStatCardProps): JSX.Element {
    return (
        <Card className="relative overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm">
            <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary to-emerald-400 opacity-0 transition-opacity duration-300 hover:opacity-100" />
            <CardContent className="p-6">
                <div
                    className={cn(
                        "mb-4 flex h-11 w-11 items-center justify-center rounded-[10px] shadow-sm",
                        iconTone === "primary" && "bg-primary text-primary-foreground",
                        iconTone === "secondary" &&
                            "bg-secondary text-secondary-foreground",
                        iconTone === "accent" && "bg-accent text-accent-foreground",
                        iconTone === "tertiary" && "bg-muted text-foreground",
                    )}
                >
                    <Icon className="h-5 w-5" />
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {label}
                </div>
                <div className="mt-1 text-[1.75rem] font-bold tracking-tight text-foreground">
                    {value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{meta}</div>
            </CardContent>
        </Card>
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
                disabled: true,
                icon: Users2,
                label: "Departmental Users",
            },
        ],
    },
    {
        title: "Procurement",
        items: [
            {
                disabled: true,
                icon: Building2,
                label: "Departments",
            },
            {
                href: "/tenant-admin/reports",
                icon: FileText,
                label: "Reports",
            },
        ],
    },
    {
        title: "Account",
        items: [
            {
                disabled: true,
                icon: Wallet,
                label: "Billing",
            },
            {
                href: "/tenant-admin/settings",
                icon: ShieldCheck,
                label: "Settings",
            },
            {
                disabled: true,
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

interface DepartmentStatusCardProps {
    detail: string;
    name: string;
    progressTone: "neutral" | "positive" | "warning";
    progressValue: number;
    statusLabel: string;
}

function DepartmentStatusCard({
    detail,
    name,
    progressTone,
    progressValue,
    statusLabel,
}: DepartmentStatusCardProps): JSX.Element {
    return (
        <div className="rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:bg-background">
            <div className="truncate text-sm font-semibold text-foreground">{name}</div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</div>
            <div className="mt-3">
                <Progress
                    value={progressValue}
                    className={cn(
                        "h-1.5 bg-muted",
                        progressTone === "warning" &&
                            "[&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-amber-400",
                        progressTone === "positive" &&
                            "[&>div]:bg-gradient-to-r [&>div]:from-emerald-600 [&>div]:to-emerald-400",
                    )}
                />
            </div>
            <div className="mt-3">
                <StatusBadge tone={getDepartmentTone(progressTone)} value={statusLabel} />
            </div>
        </div>
    );
}

interface MetaPillProps {
    icon: typeof Clock3;
    value: string;
}

function MetaPill({ icon: Icon, value }: MetaPillProps): JSX.Element {
    return (
        <div className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 py-1.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{value}</span>
        </div>
    );
}

interface StatusBadgeProps {
    tone: "danger" | "info" | "neutral" | "success" | "warning";
    value: string;
}

function StatusBadge({ tone, value }: StatusBadgeProps): JSX.Element {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold",
                tone === "success" &&
                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-200 dark:ring-1 dark:ring-emerald-800/70",
                tone === "warning" &&
                    "bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-200 dark:ring-1 dark:ring-amber-800/70",
                tone === "danger" &&
                    "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-200 dark:ring-1 dark:ring-red-800/70",
                tone === "info" &&
                    "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-200 dark:ring-1 dark:ring-blue-800/70",
                tone === "neutral" && "bg-muted text-muted-foreground",
            )}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {value}
        </span>
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

function formatUserBreakdownShort(userSummary: {
    departmentUsers: number;
    procurementOfficers: number;
    tenantAdmins: number;
}): string {
    const parts = [
        `${userSummary.procurementOfficers} PO`,
        `${userSummary.departmentUsers} Department User${userSummary.departmentUsers === 1 ? "" : "s"}`,
    ];

    if (userSummary.tenantAdmins > 0) {
        parts.push(`${userSummary.tenantAdmins} Tenant Admin${userSummary.tenantAdmins === 1 ? "" : "s"}`);
    }

    return parts.join(" + ");
}

function pluralize(count: number, label: string): string {
    return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function humanizeTenantStatus(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function humanizeCycleState(cycleState: DashboardCycleState): string {
    switch (cycleState) {
        case "before_start":
            return "Before start";
        case "active_submission":
            return "Active submission";
        case "cycle_complete":
            return "Cycle complete";
        default:
            return "Setup required";
    }
}

function getCycleTone(
    cycleState: DashboardCycleState,
): "danger" | "info" | "neutral" | "success" | "warning" {
    switch (cycleState) {
        case "before_start":
            return "info";
        case "active_submission":
            return "success";
        case "cycle_complete":
            return "neutral";
        default:
            return "warning";
    }
}

function getDepartmentTone(
    progressTone: "neutral" | "positive" | "warning",
): "neutral" | "success" | "warning" {
    switch (progressTone) {
        case "positive":
            return "success";
        case "warning":
            return "warning";
        default:
            return "neutral";
    }
}

function getCycleProgressValue(cycleState: DashboardCycleState): number {
    switch (cycleState) {
        case "before_start":
            return 30;
        case "active_submission":
            return 68;
        case "cycle_complete":
            return 100;
        default:
            return 12;
    }
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
