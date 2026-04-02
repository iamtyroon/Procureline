"use client";

import { AlertTriangle, CheckCircle2, CircleHelp, Wallet } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { DepartmentUserBudgetMeterState } from "@/lib/blockly/du-workspace-calculations";

export function BlocklyBudgetHeader({
    budgetState,
}: {
    budgetState: DepartmentUserBudgetMeterState;
}): JSX.Element {
    const accentClass =
        budgetState.state === "over_budget"
            ? "text-red-700"
            : budgetState.state === "warning"
              ? "text-amber-700"
              : budgetState.state === "safe"
                ? "text-emerald-700"
                : "text-slate-700";
    const progressClass =
        budgetState.state === "over_budget"
            ? "bg-red-100 [&>div]:bg-red-600"
            : budgetState.state === "warning"
              ? "bg-amber-100 [&>div]:bg-amber-500"
              : budgetState.state === "safe"
                ? "bg-emerald-100 [&>div]:bg-emerald-500"
                : "bg-slate-200 [&>div]:bg-slate-400";

    return (
        <div className="rounded-[26px] border border-border/70 bg-card/95 px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Budget Meter
                    </div>
                    <div className={cn("text-2xl font-black tracking-[-0.06em]", accentClass)}>
                        {budgetState.usedPercent === null ? "Unallocated" : `${budgetState.usedPercent}% used`}
                    </div>
                </div>
                <div
                    className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-2xl",
                        budgetState.state === "over_budget"
                            ? "bg-red-100 text-red-700"
                            : budgetState.state === "warning"
                              ? "bg-amber-100 text-amber-700"
                              : budgetState.state === "safe"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-700",
                    )}
                >
                    {budgetState.state === "over_budget" ? (
                        <AlertTriangle className="h-5 w-5" />
                    ) : budgetState.state === "warning" ? (
                        <Wallet className="h-5 w-5" />
                    ) : budgetState.state === "safe" ? (
                        <CheckCircle2 className="h-5 w-5" />
                    ) : (
                        <CircleHelp className="h-5 w-5" />
                    )}
                </div>
            </div>

            <div className="mt-4 space-y-3">
                <Progress
                    className={cn("h-3 rounded-full", progressClass)}
                    value={Math.max(0, Math.min(100, budgetState.usedPercent ?? 0))}
                />
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                        Used: <strong className="text-foreground">{formatKenyanCurrency(budgetState.usedAmount)}</strong>
                    </span>
                    <span className="text-muted-foreground">
                        Budget:{" "}
                        <strong className="text-foreground">
                            {budgetState.totalBudget === null
                                ? "Not allocated"
                                : formatKenyanCurrency(budgetState.totalBudget)}
                        </strong>
                    </span>
                    <span className="text-muted-foreground">
                        Remaining:{" "}
                        <strong className="text-foreground">
                            {budgetState.remainingBudget === null
                                ? "Unavailable"
                                : formatKenyanCurrency(budgetState.remainingBudget)}
                        </strong>
                    </span>
                </div>
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
