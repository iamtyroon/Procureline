"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Building2,
    Eye,
    FilterX,
    Loader2,
    Plus,
    Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
    PlatformAdminAttentionFilter,
    PlatformAdminProfileCompletionFilter,
    PlatformAdminTenantListRow,
    PlatformAdminTenantStatus,
    PlatformAdminTenantTier,
} from "@/lib/shared/platform-admin/tenant-list";
import { cn } from "@/lib/utils";
import { PlatformAdminDashboardSkeleton, PlatformAdminMobileFallback } from "./PlatformAdminDashboardParts";

type TierFilter = PlatformAdminTenantTier | "all";
type StatusFilter = PlatformAdminTenantStatus | "all";

const SECONDARY_ACTION_BUTTON_CLASS =
    "border-border bg-background/90 text-foreground shadow-sm hover:bg-muted/60 hover:text-foreground";

export function PlatformAdminTenantList(): JSX.Element {
    const [accessError, setAccessError] = useState<string | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [tier, setTier] = useState<TierFilter>("all");
    const [status, setStatus] = useState<StatusFilter>("all");
    const [profile, setProfile] =
        useState<PlatformAdminProfileCompletionFilter>("all");
    const [attention, setAttention] =
        useState<PlatformAdminAttentionFilter>("all");
    const [page, setPage] = useState(1);
    const issueTenantListReadAccess = useMutation(
        api.functions.platformAdminTenants.issuePlatformAdminTenantListReadAccess,
    );
    const snapshot = useQuery(
        api.functions.platformAdminTenants.getPlatformAdminTenantListSnapshot,
        accessToken
            ? {
                accessToken,
                attention,
                page,
                profile,
                search,
                status,
                tier,
            }
            : "skip",
    );

    useEffect(() => {
        let cancelled = false;

        async function loadTenantListAccessToken(): Promise<void> {
            if (accessToken || accessError) {
                return;
            }

            try {
                const token = await issueTenantListReadAccess({});
                if (!cancelled) {
                    setAccessToken(token);
                }
            } catch {
                if (!cancelled) {
                    setAccessError(
                        "Platform tenant-list access could not be verified. Retry to re-establish the audited read session.",
                    );
                }
            }
        }

        void loadTenantListAccessToken();

        return () => {
            cancelled = true;
        };
    }, [accessError, accessToken, issueTenantListReadAccess]);

    useEffect(() => {
        setPage(1);
    }, [attention, profile, search, status, tier]);

    const hasActiveFilters = useMemo(
        () =>
            search.trim().length > 0 ||
            tier !== "all" ||
            status !== "all" ||
            profile !== "all" ||
            attention !== "all",
        [attention, profile, search, status, tier],
    );

    function clearFilters(): void {
        setSearch("");
        setTier("all");
        setStatus("all");
        setProfile("all");
        setAttention("all");
        setPage(1);
    }

    function retryAccess(): void {
        setAccessError(null);
        setAccessToken(null);
    }

    if (accessError) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-background">
                <PlatformAdminMobileFallback />
                <div className="hidden px-8 py-10 lg:block">
                    <Alert className="mx-auto max-w-2xl rounded-[28px] border-border/70">
                        <AlertTitle>Tenant roster access needs to be re-established</AlertTitle>
                        <AlertDescription className="mt-2 space-y-4">
                            <p>{accessError}</p>
                            <Button type="button" onClick={retryAccess}>
                                Retry access check
                            </Button>
                        </AlertDescription>
                    </Alert>
                </div>
            </div>
        );
    }

    if (!accessToken || !snapshot) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-background">
                <PlatformAdminMobileFallback />
                <PlatformAdminDashboardSkeleton />
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background">
            <PlatformAdminMobileFallback />
            <TooltipProvider delayDuration={150}>
                <main className="hidden px-8 py-8 lg:block">
                    <div className="mx-auto max-w-[1480px] space-y-6">
                        <header className="flex items-start justify-between gap-6 border-b border-border/70 pb-6">
                            <div>
                                <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                                    <Link
                                        href="/platform-admin"
                                        className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        Platform Dashboard
                                    </Link>
                                </div>
                                <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
                                    All Tenants
                                </h1>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Live Convex-backed tenant roster with searchable operational state.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Provisioning reserved for Story 2.4
                            </Button>
                        </header>

                        <section className="grid gap-4 xl:grid-cols-4">
                            <SummaryMetric
                                label="Total tenants"
                                value={snapshot.summary.total}
                                tone="neutral"
                            />
                            <SummaryMetric
                                label="Active"
                                value={snapshot.summary.active}
                                tone="positive"
                            />
                            <SummaryMetric
                                label="Needs attention"
                                value={snapshot.summary.attention}
                                tone={snapshot.summary.attention > 0 ? "warning" : "positive"}
                            />
                            <SummaryMetric
                                label="Incomplete profiles"
                                value={snapshot.summary.incompleteProfiles}
                                tone={snapshot.summary.incompleteProfiles > 0 ? "warning" : "positive"}
                            />
                        </section>

                        <section className="space-y-4">
                            <div className="grid gap-3 xl:grid-cols-[minmax(280px,1.4fr)_repeat(4,minmax(180px,0.8fr))_auto]">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        className="h-11 rounded-xl pl-9"
                                        placeholder="Search name, subdomain, or contact email"
                                    />
                                </div>
                                <FilterSelect
                                    ariaLabel="Filter by tier"
                                    options={snapshot.filters.tier}
                                    value={tier}
                                    onValueChange={(value) => setTier(value as TierFilter)}
                                />
                                <FilterSelect
                                    ariaLabel="Filter by status"
                                    options={snapshot.filters.status}
                                    value={status}
                                    onValueChange={(value) => setStatus(value as StatusFilter)}
                                />
                                <FilterSelect
                                    ariaLabel="Filter by profile completion"
                                    options={snapshot.filters.profile}
                                    value={profile}
                                    onValueChange={(value) =>
                                        setProfile(value as PlatformAdminProfileCompletionFilter)
                                    }
                                />
                                <FilterSelect
                                    ariaLabel="Filter by attention state"
                                    options={snapshot.filters.attention}
                                    value={attention}
                                    onValueChange={(value) =>
                                        setAttention(value as PlatformAdminAttentionFilter)
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className={cn("h-11 rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)}
                                    disabled={!hasActiveFilters}
                                    onClick={clearFilters}
                                >
                                    <FilterX className="mr-2 h-4 w-4" />
                                    Clear
                                </Button>
                            </div>

                            <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card/95 shadow-sm">
                                {snapshot.rows.length === 0 ? (
                                    <EmptyTenantList hasActiveFilters={hasActiveFilters} />
                                ) : (
                                    <Table>
                                        <TableHeader className="bg-muted/35">
                                            <TableRow>
                                                <TableHead>Institution</TableHead>
                                                <TableHead>Tier</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Profile</TableHead>
                                                <TableHead>Counts</TableHead>
                                                <TableHead>Joined</TableHead>
                                                <TableHead>Attention</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {snapshot.rows.map((row) => (
                                                <TenantRosterRow key={row.id} row={row} />
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>

                            <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                                <div>
                                    Showing {snapshot.rows.length} of{" "}
                                    {snapshot.pagination.totalFilteredRows} filtered tenants
                                    {snapshot.meta.totalRows !== snapshot.pagination.totalFilteredRows
                                        ? ` from ${snapshot.meta.totalRows} total`
                                        : ""}
                                    .
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)}
                                        disabled={!snapshot.pagination.hasPreviousPage}
                                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                                    >
                                        <ArrowLeft className="mr-2 h-4 w-4" />
                                        Previous
                                    </Button>
                                    <span className="min-w-24 text-center">
                                        Page {snapshot.pagination.page} of{" "}
                                        {snapshot.pagination.totalPages}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)}
                                        disabled={!snapshot.pagination.hasNextPage}
                                        onClick={() => setPage((current) => current + 1)}
                                    >
                                        Next
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </section>
                    </div>
                </main>
            </TooltipProvider>
        </div>
    );
}

function FilterSelect({
    ariaLabel,
    onValueChange,
    options,
    value,
}: {
    ariaLabel: string;
    onValueChange: (value: string) => void;
    options: readonly { label: string; value: string }[];
    value: string;
}): JSX.Element {
    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger aria-label={ariaLabel} className="h-11 rounded-xl">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function SummaryMetric({
    label,
    tone,
    value,
}: {
    label: string;
    tone: "neutral" | "positive" | "warning";
    value: number;
}): JSX.Element {
    return (
        <div className="rounded-[24px] border border-border/70 bg-card/95 p-5 shadow-sm">
            <div
                className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl",
                    tone === "positive" &&
                        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
                    tone === "warning" &&
                        "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
                    tone === "neutral" && "bg-muted text-muted-foreground",
                )}
            >
                {tone === "warning" ? (
                    <AlertTriangle className="h-5 w-5" />
                ) : (
                    <Building2 className="h-5 w-5" />
                )}
            </div>
            <div className="mt-4 text-3xl font-black tracking-tight text-foreground">
                {value}
            </div>
            <div className="mt-1 text-sm font-medium text-muted-foreground">{label}</div>
        </div>
    );
}

function TenantRosterRow({
    row,
}: {
    row: PlatformAdminTenantListRow;
}): JSX.Element {
    return (
        <TableRow className="align-top">
            <TableCell className="min-w-[280px] py-4">
                <div className="font-semibold text-foreground">{row.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">{row.subdomain}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                    {row.primaryContactName ?? "Contact name unavailable"}
                    {row.primaryContactEmail ? ` / ${row.primaryContactEmail}` : " / Email unavailable"}
                </div>
            </TableCell>
            <TableCell className="py-4">
                <Badge variant="outline" className="rounded-full">
                    {row.tierLabel}
                </Badge>
            </TableCell>
            <TableCell className="py-4">
                <StatusBadge status={row.status} label={row.statusLabel} />
            </TableCell>
            <TableCell className="py-4">
                <Badge
                    variant="outline"
                    className={cn(
                        "rounded-full",
                        row.profileComplete === true
                            ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/20 dark:text-emerald-100"
                            : "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/20 dark:text-amber-100",
                    )}
                >
                    {row.profileLabel}
                </Badge>
            </TableCell>
            <TableCell className="py-4 text-sm text-muted-foreground">
                <div>{row.departmentCount} departments</div>
                <div>{row.activeUserCount} active users</div>
            </TableCell>
            <TableCell className="py-4">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            className="rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60"
                            aria-label={`UTC time ${row.joinedAtUtcLabel}. Local time ${row.joinedAtLocalLabel}.`}
                        >
                            {row.joinedAtUtcLabel}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>{row.joinedAtLocalLabel}</TooltipContent>
                </Tooltip>
            </TableCell>
            <TableCell className="max-w-[260px] py-4">
                {row.attentionIndicators.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Clear</span>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {row.attentionIndicators.map((indicator) => (
                            <Badge
                                key={indicator}
                                variant="outline"
                                className="rounded-full border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/20 dark:text-amber-100"
                            >
                                {indicator}
                            </Badge>
                        ))}
                    </div>
                )}
            </TableCell>
            <TableCell className="py-4 text-right">
                <Button
                    asChild
                    variant="outline"
                    className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)}
                >
                    <Link href={row.detailHref}>
                        <Eye className="mr-2 h-4 w-4" />
                        Reserved detail
                    </Link>
                </Button>
            </TableCell>
        </TableRow>
    );
}

function StatusBadge({
    label,
    status,
}: {
    label: string;
    status: PlatformAdminTenantStatus;
}): JSX.Element {
    return (
        <Badge
            variant="outline"
            className={cn(
                "rounded-full",
                status === "active" &&
                    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/20 dark:text-emerald-100",
                status === "suspended" &&
                    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/20 dark:text-rose-100",
                status === "cancelled" &&
                    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/20 dark:text-amber-100",
                status === "unknown" &&
                    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100",
            )}
        >
            {label}
        </Badge>
    );
}

function EmptyTenantList({
    hasActiveFilters,
}: {
    hasActiveFilters: boolean;
}): JSX.Element {
    return (
        <div className="flex min-h-[22rem] items-center justify-center p-8">
            <div className="max-w-xl text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    {hasActiveFilters ? (
                        <Search className="h-5 w-5" />
                    ) : (
                        <Loader2 className="h-5 w-5" />
                    )}
                </div>
                <h2 className="mt-4 text-lg font-semibold text-foreground">
                    {hasActiveFilters ? "No tenants match these filters" : "No tenant records yet"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {hasActiveFilters
                        ? "The live roster returned no rows for the current search and filter set."
                        : "Tenant records will appear here when live Convex tenant documents exist."}
                </p>
            </div>
        </div>
    );
}
