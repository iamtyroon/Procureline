import { useEffect, useState } from "react";
import {
    AlertTriangle,
    BellRing,
    Building2,
    Flag,
    LayoutGrid,
    ServerCog,
    Settings,
    Shield,
    Ticket,
    UserCog,
    Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
    PlatformAdminAlertItem,
    PlatformAdminDashboardNavigationGroup,
    PlatformAdminHealthTile,
    PlatformAdminRecentTenantRow,
    PlatformAdminSummaryCard,
} from "@/lib/shared/platform-admin/dashboard-snapshot";
import { getPlatformAdminLocalTimestampLabel } from "@/lib/shared/platform-admin/dashboard";
import { cn } from "@/lib/utils";

type NavigationItemId = PlatformAdminDashboardNavigationGroup["items"][number]["id"];

export function PlatformAdminMobileFallback(): JSX.Element {
    return (
        <div className="px-4 py-8 sm:px-6 lg:hidden">
            <Card className="mx-auto max-w-2xl rounded-[24px] border-border/70 bg-card shadow-sm">
                <CardHeader className="space-y-4">
                    <Badge className="w-fit rounded-md bg-primary text-primary-foreground hover:bg-primary">
                        Desktop required
                    </Badge>
                    <CardTitle className="text-2xl text-foreground">
                        Platform admin dashboards are designed for desktop viewports
                    </CardTitle>
                    <CardDescription className="text-base leading-7 text-muted-foreground">
                        This workspace follows the desktop-only platform strategy from the
                        Procureline UX specification.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
}

export function PlatformAdminDashboardSkeleton(): JSX.Element {
    return (
        <div className="mx-auto hidden w-full max-w-none gap-4 px-4 py-4 lg:flex lg:flex-col xl:px-5">
            <Skeleton className="h-24 rounded-3xl" />
            <div className="grid gap-4 xl:grid-cols-4">
                <Skeleton className="h-48 rounded-3xl" />
                <Skeleton className="h-48 rounded-3xl" />
                <Skeleton className="h-48 rounded-3xl" />
                <Skeleton className="h-48 rounded-3xl" />
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.95fr)]">
                <Skeleton className="h-[28rem] rounded-3xl" />
                <Skeleton className="h-[28rem] rounded-3xl" />
            </div>
            <Skeleton className="h-[24rem] rounded-3xl" />
        </div>
    );
}

export function SidebarIcon({
    itemId,
}: {
    itemId: NavigationItemId;
}): JSX.Element {
    const Icon = resolveSidebarIcon(itemId);
    return <Icon className="h-5 w-5 shrink-0" />;
}

export function SummaryCard({
    card,
}: {
    card: PlatformAdminSummaryCard;
}): JSX.Element {
    return (
        <div className="rounded-[28px] border border-border/70 bg-card/95 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div
                    className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-2xl",
                        card.tone === "positive" &&
                            "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
                        card.tone === "warning" &&
                            "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
                        card.tone === "critical" &&
                            "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
                        card.tone === "neutral" && "bg-muted text-muted-foreground",
                    )}
                >
                    {resolveSummaryCardIcon(card.id)}
                </div>
                <Badge
                    variant="outline"
                    className={cn(
                        "rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.02em]",
                        resolveStatusBadgeClass(card.tone),
                    )}
                >
                    {card.statusLabel}
                </Badge>
            </div>
            <div className="mt-5 text-3xl font-black tracking-[-0.04em] text-foreground">
                {card.value}
            </div>
            <div className="mt-2 text-sm font-semibold text-foreground">{card.label}</div>
            <div className="mt-2 text-sm leading-6 text-foreground/78">{card.helperText}</div>
        </div>
    );
}

export function EmptyPanelState({
    body,
    title,
}: {
    body: string;
    title: string;
}): JSX.Element {
    return (
        <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 p-5">
            <div className="font-semibold text-foreground">{title}</div>
            <div className="mt-2 text-sm leading-6 text-foreground/78">{body}</div>
        </div>
    );
}

export function StatusPill({
    label,
    tone,
}: {
    label: string;
    tone: "critical" | "neutral" | "positive" | "warning";
}): JSX.Element {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize shadow-sm",
                tone === "positive" &&
                    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/20 dark:text-emerald-100",
                tone === "warning" &&
                    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/20 dark:text-amber-100",
                tone === "critical" &&
                    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/20 dark:text-rose-100",
                tone === "neutral" &&
                    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100",
            )}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {label}
        </span>
    );
}

export function TimestampBadge({
    timestamp,
    utcLabel,
}: {
    timestamp: number;
    utcLabel: string;
}): JSX.Element {
    const [localLabel, setLocalLabel] = useState<string | null>(null);

    useEffect(() => {
        setLocalLabel(
            getPlatformAdminLocalTimestampLabel({
                timestamp,
            }),
        );
    }, [timestamp]);

    const resolvedLocalLabel =
        localLabel ?? "Local time will appear after the page loads.";

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className="rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60"
                    aria-label={`UTC time ${utcLabel}. Local time ${resolvedLocalLabel}.`}
                >
                    {utcLabel}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top">{resolvedLocalLabel}</TooltipContent>
        </Tooltip>
    );
}

export function RecentTenantTableRow({
    row,
}: {
    row: PlatformAdminRecentTenantRow;
}): JSX.Element {
    return (
        <tr className="border-t border-border/70 text-sm">
            <td className="px-4 py-4">
                <div className="font-medium text-foreground">{row.name}</div>
                <div className="text-xs text-muted-foreground">
                    {row.activeUserCount ?? 0} active users
                </div>
            </td>
            <td className="px-4 py-4">
                <Badge
                    variant="outline"
                    className="rounded-full border-slate-300 bg-slate-100 px-3 py-1 text-slate-800 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                >
                    {row.tier}
                </Badge>
            </td>
            <td className="px-4 py-4">
                <StatusPill
                    label={row.status}
                    tone={
                        row.status === "active"
                            ? "positive"
                            : row.status === "suspended"
                              ? "critical"
                              : "warning"
                    }
                />
            </td>
            <td className="px-4 py-4 text-muted-foreground">
                {row.departmentCount ?? 0}
            </td>
            <td className="px-4 py-4">
                <TimestampBadge
                    timestamp={row.joinedAt}
                    utcLabel={row.joinedAtLabel}
                />
            </td>
        </tr>
    );
}

export function HealthTileRow({
    tile,
}: {
    tile: PlatformAdminHealthTile;
}): JSX.Element {
    return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background/55 px-4 py-3">
            <div>
                <div className="font-medium text-foreground">{tile.label}</div>
                <div className="text-sm text-foreground/78">{tile.detail}</div>
            </div>
            <StatusPill label={tile.statusLabel} tone={resolveHealthTone(tile.state)} />
        </div>
    );
}

export function AlertRow({
    alert,
}: {
    alert: PlatformAdminAlertItem;
}): JSX.Element {
    return (
        <div className="rounded-2xl border border-border/80 bg-background/50 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-3">
                        <StatusPill
                            label={alert.severity}
                            tone={
                                alert.severity === "critical"
                                    ? "critical"
                                    : alert.severity === "warning"
                                      ? "warning"
                                      : "neutral"
                            }
                        />
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {alert.sourceLabel}
                        </div>
                    </div>
                    <div className="mt-3 font-semibold text-foreground">{alert.title}</div>
                    <div className="mt-1 text-sm leading-6 text-foreground/78">
                        {alert.summary}
                    </div>
                </div>
                <div className="shrink-0">
                    <TimestampBadge
                        timestamp={alert.occurredAt}
                        utcLabel={alert.occurredAtLabel}
                    />
                </div>
            </div>
        </div>
    );
}

function resolveSidebarIcon(
    itemId: NavigationItemId,
): React.ComponentType<{ className?: string }> {
    switch (itemId) {
        case "tenants":
            return Building2;
        case "subscriptions":
            return Wallet;
        case "free_tier":
            return Flag;
        case "tenant_admins":
            return UserCog;
        case "analytics":
            return LayoutGrid;
        case "health":
            return ServerCog;
        case "security":
            return Shield;
        case "configuration":
            return Settings;
        case "support":
            return Ticket;
        case "audit_logs":
            return BellRing;
        case "errors":
            return AlertTriangle;
        default:
            return LayoutGrid;
    }
}

function resolveSummaryCardIcon(
    cardId: PlatformAdminSummaryCard["id"],
): JSX.Element {
    switch (cardId) {
        case "total_tenants":
            return <Building2 className="h-5 w-5" />;
        case "tenant_attention":
            return <UserCog className="h-5 w-5" />;
        case "recurring_revenue":
            return <Wallet className="h-5 w-5" />;
        default:
            return <AlertTriangle className="h-5 w-5" />;
    }
}

function resolveHealthTone(
    state: PlatformAdminHealthTile["state"],
): "critical" | "neutral" | "positive" | "warning" {
    switch (state) {
        case "healthy":
            return "positive";
        case "critical":
            return "critical";
        case "warning":
        case "stale":
        case "partial":
            return "warning";
        default:
            return "neutral";
    }
}

function resolveStatusBadgeClass(
    tone: "critical" | "neutral" | "positive" | "warning",
): string {
    switch (tone) {
        case "positive":
            return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/20 dark:text-emerald-100";
        case "warning":
            return "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/20 dark:text-amber-100";
        case "critical":
            return "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/20 dark:text-rose-100";
        default:
            return "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100";
    }
}
