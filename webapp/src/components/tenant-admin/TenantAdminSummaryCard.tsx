"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowUpRight, CircleOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardSummaryCard } from "@/lib/tenant-admin/dashboard-snapshot";

interface TenantAdminSummaryCardProps {
    card: DashboardSummaryCard;
    className?: string;
    icon: LucideIcon;
}

const toneClasses: Record<
    DashboardSummaryCard["tone"],
    { badge: string; icon: string; shell: string }
> = {
    neutral: {
        badge: "border-border bg-muted/70 text-foreground",
        icon: "bg-muted text-foreground",
        shell: "border-border/70",
    },
    positive: {
        badge:
            "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200",
        icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
        shell: "border-emerald-200/70 dark:border-emerald-500/20",
    },
    warning: {
        badge:
            "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200",
        icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
        shell: "border-amber-200/80 dark:border-amber-500/20",
    },
};

export function TenantAdminSummaryCard({
    card,
    className,
    icon: Icon,
}: TenantAdminSummaryCardProps): JSX.Element {
    const tone = toneClasses[card.tone];
    const StateIcon =
        card.dataState === "available"
            ? ArrowUpRight
            : card.dataState === "empty"
              ? AlertTriangle
              : CircleOff;

    return (
        <Card
            className={cn(
                "relative overflow-hidden rounded-[28px] border bg-card/90 shadow-sm backdrop-blur",
                "before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-primary/70 before:via-primary before:to-chart-4",
                tone.shell,
                className,
            )}
        >
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
                <div className="space-y-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground">
                        {card.label}
                    </CardTitle>
                    <div className="text-3xl font-semibold tracking-tight text-foreground">
                        {card.value}
                    </div>
                </div>
                <div
                    className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-2xl",
                        tone.icon,
                    )}
                >
                    <Icon className="h-5 w-5" />
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline" className={cn("rounded-full", tone.badge)}>
                        {card.statusLabel}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <StateIcon className="h-3.5 w-3.5" />
                        {card.trendLabel}
                    </span>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{card.helperText}</p>
            </CardContent>
        </Card>
    );
}
