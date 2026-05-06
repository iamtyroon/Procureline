"use client";

import { Clock3, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatFiscalYearLabel } from "@/lib/shared/tenant-admin/dashboard";
import type { TenantAdminActivityFeed } from "@/lib/shared/tenant-admin/dashboard-snapshot";
import { cn } from "@/lib/utils";

interface TenantAdminRecentActivityProps {
    activityFeed: TenantAdminActivityFeed;
    className?: string;
    selectedFiscalYear: string;
}

export function TenantAdminRecentActivity({
    activityFeed,
    className,
    selectedFiscalYear,
}: TenantAdminRecentActivityProps): JSX.Element {
    return (
        <Card
            className={cn(
                "rounded-[28px] border border-border/70 bg-card/90 shadow-sm backdrop-blur",
                className,
            )}
        >
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-2">
                    <CardTitle className="text-xl text-foreground">
                        Recent Activity
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
                        Latest tenant-scoped audit events for{" "}
                        {formatFiscalYearLabel(selectedFiscalYear)}.
                    </CardDescription>
                </div>
                <Badge
                    variant="outline"
                    className="rounded-full border-border bg-muted/70 text-foreground"
                >
                    {activityFeed.totalReturned} shown
                </Badge>
            </CardHeader>
            <CardContent>
                {activityFeed.state === "empty" ? (
                    <div className="rounded-3xl border border-dashed border-border bg-muted/40 p-8 text-center">
                        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
                        <p className="mt-4 text-base font-medium text-foreground">
                            No activity recorded yet
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Audit-backed activity will appear here once tenant actions start flowing
                            through the live event stream.
                        </p>
                    </div>
                ) : (
                    <ScrollArea className="h-[30rem] pr-4">
                        <div className="space-y-3">
                            {activityFeed.items.map((item) => (
                                <div
                                    key={item.id}
                                    className="rounded-3xl border border-border/70 bg-muted/35 p-4"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-foreground">
                                                {item.actor}
                                            </p>
                                            <p className="text-sm text-foreground/85">
                                                {item.action}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {item.entity} · {item.outcome}
                                            </p>
                                        </div>
                                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock3 className="h-3.5 w-3.5" />
                                            {item.occurredAtLabel}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
