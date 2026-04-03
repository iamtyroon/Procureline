"use client";

import { AlertTriangle, CheckCircle2, CircleHelp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ProcurementComplianceSnapshot } from "@/lib/procurement/compliance";

export function BlocklyComplianceSummary({
    complianceState,
}: {
    complianceState: ProcurementComplianceSnapshot;
}): JSX.Element {
    return (
        <div className="rounded-[26px] border border-border/70 bg-card/95 px-5 py-4 shadow-sm">
            <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Compliance Summary
                </div>
                <div className="text-2xl font-black tracking-[-0.06em] text-foreground">
                    Live target posture
                </div>
                <p className="text-sm text-muted-foreground">
                    {complianceState.multiFlagNotice}
                </p>
            </div>

            <div className="mt-4 space-y-3">
                {complianceState.metrics.map((metric) => {
                    const accentClass =
                        metric.status === "met"
                            ? "text-emerald-700"
                            : metric.status === "unmet"
                              ? "text-amber-700"
                              : metric.status === "unavailable"
                                ? "text-slate-700"
                              : "text-slate-700";
                    const progressClass =
                        metric.status === "met"
                            ? "bg-emerald-100 [&>div]:bg-emerald-500"
                            : metric.status === "unmet"
                              ? "bg-amber-100 [&>div]:bg-amber-500"
                              : metric.status === "unavailable"
                                ? "bg-slate-200 [&>div]:bg-slate-400"
                              : "bg-slate-200 [&>div]:bg-slate-400";

                    return (
                        <div
                            key={metric.flag}
                            className="rounded-2xl border border-border/60 bg-background/80 p-4"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-foreground">
                                            {metric.label}
                                        </span>
                                        <Badge variant="outline" className="rounded-full">
                                            {metric.targetPercentLabel}
                                        </Badge>
                                    </div>
                                    <p className={cn("text-sm font-medium", accentClass)}>
                                        {metric.status === "empty"
                                            ? "Awaiting plan total"
                                            : metric.status === "met"
                                              ? "Target met"
                                              : metric.status === "unmet"
                                                ? "Target unmet"
                                                : "Saved details unavailable"}
                                    </p>
                                </div>
                                <div
                                    className={cn(
                                        "flex h-10 w-10 items-center justify-center rounded-2xl",
                                        metric.status === "met"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : metric.status === "unmet"
                                              ? "bg-amber-100 text-amber-700"
                                              : metric.status === "unavailable"
                                                ? "bg-slate-100 text-slate-700"
                                              : "bg-slate-100 text-slate-700",
                                    )}
                                >
                                    {metric.status === "met" ? (
                                        <CheckCircle2 className="h-5 w-5" />
                                    ) : metric.status === "unmet" ? (
                                        <AlertTriangle className="h-5 w-5" />
                                    ) : (
                                        <CircleHelp className="h-5 w-5" />
                                    )}
                                </div>
                            </div>

                            <div className="mt-3 space-y-2">
                                <Progress
                                    aria-label={`${metric.label} compliance progress`}
                                    aria-valuetext={`${metric.label} is currently ${metric.percentLabel}`}
                                    className={cn("h-2.5 rounded-full", progressClass)}
                                    value={Math.max(0, Math.min(100, metric.percent ?? 0))}
                                />
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                                    <span className="text-muted-foreground">
                                        Allocation:{" "}
                                        <strong className="text-foreground">
                                            {formatKenyanCurrency(metric.amount)}
                                        </strong>
                                    </span>
                                    <span className="text-muted-foreground">
                                        Share:{" "}
                                        <strong className="text-foreground">
                                            {metric.percentLabel}
                                        </strong>
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function formatKenyanCurrency(amount: number): string {
    return new Intl.NumberFormat("en-KE", {
        currency: "KES",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        style: "currency",
    }).format(amount);
}
