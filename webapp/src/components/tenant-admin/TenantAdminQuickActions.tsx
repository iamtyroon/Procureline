"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TenantAdminDashboardSnapshot } from "@/lib/shared/tenant-admin/dashboard-snapshot";

interface TenantAdminQuickActionsProps {
    className?: string;
    onboardingChecklist: TenantAdminDashboardSnapshot["onboardingChecklist"];
    quickActions: TenantAdminDashboardSnapshot["quickActions"];
}

const quickActionTone: Record<
    TenantAdminDashboardSnapshot["quickActions"][number]["status"],
    string
> = {
    coming_soon: "border-border bg-muted/70 text-foreground",
    ready:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200",
    setup_required:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200",
};

export function TenantAdminQuickActions({
    className,
    onboardingChecklist,
    quickActions,
}: TenantAdminQuickActionsProps): JSX.Element {
    return (
        <Card
            className={cn(
                "rounded-[28px] border border-border/70 bg-card/90 shadow-sm backdrop-blur",
                className,
            )}
        >
            <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl text-foreground">
                            Quick Actions
                        </CardTitle>
                        <CardDescription className="mt-2 text-sm leading-6 text-muted-foreground">
                            Keep the next action obvious without pretending unfinished workflows
                            are already shipped.
                        </CardDescription>
                    </div>
                    <Sparkles className="h-5 w-5 text-primary" />
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-3">
                    {quickActions.map((action) => (
                        <div
                            key={action.id}
                            className={cn(
                                "rounded-3xl border p-4 transition-colors",
                                action.highlighted
                                    ? "border-primary/30 bg-primary/10"
                                    : "border-border/70 bg-muted/35",
                            )}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-foreground">
                                            {action.label}
                                        </p>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "rounded-full",
                                                quickActionTone[action.status],
                                            )}
                                        >
                                            {action.status.replaceAll("_", " ")}
                                        </Badge>
                                    </div>
                                    <p className="text-sm leading-6 text-muted-foreground">
                                        {action.description}
                                    </p>
                                </div>
                                <Button
                                    asChild
                                    variant={action.highlighted ? "default" : "outline"}
                                    size="sm"
                                    className="shrink-0 rounded-full"
                                >
                                    <Link href={action.href}>
                                        Open
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="rounded-3xl border border-border/70 bg-muted/40 p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-foreground">
                                Onboarding Checklist
                            </p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                Blockers are called out separately from softer follow-up
                                recommendations.
                            </p>
                        </div>
                        <Clock3 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-4 space-y-3">
                        {onboardingChecklist.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 bg-background/70 p-3"
                            >
                                <div className="flex items-start gap-3">
                                    <CheckCircle2
                                        className={cn(
                                            "mt-0.5 h-4 w-4",
                                            item.status === "complete"
                                                ? "text-emerald-600"
                                                : item.status === "blocked"
                                                  ? "text-amber-600"
                                                  : "text-muted-foreground",
                                        )}
                                    />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-foreground">
                                                {item.label}
                                            </p>
                                            {item.isPriority ? (
                                                <Badge className="rounded-full bg-primary text-primary-foreground hover:bg-primary">
                                                    Priority
                                                </Badge>
                                            ) : null}
                                            {item.availability === "coming_soon" ? (
                                                <Badge
                                                    variant="outline"
                                                    className="rounded-full border-border bg-muted/70 text-muted-foreground"
                                                >
                                                    Coming soon
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "rounded-full capitalize",
                                        item.status === "complete"
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200"
                                            : item.status === "blocked"
                                              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200"
                                              : "border-border bg-muted/70 text-foreground",
                                    )}
                                >
                                    {item.status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
