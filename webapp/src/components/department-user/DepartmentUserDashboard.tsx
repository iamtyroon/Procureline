"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    Boxes,
    CalendarClock,
    CheckCircle2,
    CircleHelp,
    ClipboardList,
    Clock3,
    Eye,
    FileClock,
    NotebookPen,
    RefreshCcw,
    XCircle,
} from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
    deriveLaunchpadInteractivity,
    sanitizeCategorySelection,
} from "@/lib/department-user/dashboard";
import type { DepartmentUserDashboardSnapshot } from "@/lib/department-user/dashboard-snapshot";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function DepartmentUserDashboard(): JSX.Element {
    const router = useRouter();
    const snapshot = useQuery(
        api.functions.departmentUserDashboard.getDepartmentUserDashboardSnapshot,
        {},
    );
    const requestRedraft = useMutation(
        api.functions.planRedrafts.requestDepartmentUserPlanRedraft,
    );
    const withdrawSubmission = useMutation(
        api.functions.plans.withdrawDepartmentUserPlanSubmission,
    );
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
    const [redraftPlanId, setRedraftPlanId] = useState<string | null>(null);
    const [redraftReason, setRedraftReason] = useState("");
    const [isRedraftSubmitting, setIsRedraftSubmitting] = useState(false);
    const [isWithdrawSubmitting, setIsWithdrawSubmitting] = useState(false);

    useEffect(() => {
        if (!snapshot) {
            return;
        }

        const availableCategoryIds = snapshot.launchpad.categories
            .filter((category) => !category.disabled)
            .map((category) => category.id);
        if (!snapshot.launchpad.canSelectCategories) {
            setSelectedCategoryIds(snapshot.launchpad.selectedCategoryIds);
            return;
        }

        setSelectedCategoryIds((current) =>
            sanitizeCategorySelection({
                availableCategoryIds,
                selectedCategoryIds: current,
            }),
        );
    }, [snapshot]);

    if (!snapshot) {
        return <DepartmentUserDashboardSkeleton />;
    }

    if (snapshot.meta.viewState === "blocked") {
        return <DepartmentUserBlockedState message={snapshot.meta.blockedMessage} title={snapshot.meta.blockedTitle} />;
    }

    const dashboardSnapshot = snapshot;
    const effectiveSelectedCategoryIds = dashboardSnapshot.launchpad.canSelectCategories
        ? selectedCategoryIds
        : dashboardSnapshot.launchpad.selectedCategoryIds;
    const launchpadInteractivity = deriveLaunchpadInteractivity({
        canSelectCategories: dashboardSnapshot.launchpad.canSelectCategories,
        disabledReason: dashboardSnapshot.launchpad.disabledReason,
        primaryAction: dashboardSnapshot.launchpad.primaryAction,
        selectedCategoryCount: effectiveSelectedCategoryIds.length,
        state: dashboardSnapshot.launchpad.state,
    });
    const launchpadActionLabel =
        dashboardSnapshot.launchpad.primaryAction.kind === "create"
            ? "+ New Plan"
            : dashboardSnapshot.launchpad.primaryAction.label;

    function handleLaunchpadAction(): void {
        if (launchpadInteractivity.disabled) {
            return;
        }

        if (dashboardSnapshot.launchpad.primaryAction.kind === "create") {
            const params = new URLSearchParams();
            params.set("fiscalYear", dashboardSnapshot.meta.fiscalYearKey);
            if (effectiveSelectedCategoryIds.length > 0) {
                params.set("categories", effectiveSelectedCategoryIds.join(","));
            }
            router.push(`/du/plans/new?${params.toString()}`);
            return;
        }

        router.push(dashboardSnapshot.launchpad.primaryAction.href);
    }

    function handleCategorySelectionChange(categoryId: string, checked: boolean): void {
        const availableCategoryIds = dashboardSnapshot.launchpad.categories
            .filter((category) => !category.disabled)
            .map((category) => category.id);

        setSelectedCategoryIds((current) =>
            checked
                ? sanitizeCategorySelection({
                      availableCategoryIds,
                      selectedCategoryIds: [...current, categoryId],
                  })
                : current.filter((id) => id !== categoryId),
        );
    }

    async function handleSubmitRedraftRequest(): Promise<void> {
        if (!redraftPlanId || isRedraftSubmitting) {
            return;
        }

        setIsRedraftSubmitting(true);
        try {
            await requestRedraft({
                planId: redraftPlanId,
                reason: redraftReason,
            });
            toast.success("Reopen request sent to your Procurement Officer for approval.");
            setRedraftPlanId(null);
            setRedraftReason("");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "The redraft request could not be sent.",
            );
        } finally {
            setIsRedraftSubmitting(false);
        }
    }

    async function handleWithdrawSubmission(): Promise<void> {
        const currentRow = dashboardSnapshot.plans.rows.find((row) => row.isCurrentFiscalYear);
        if (!currentRow || isWithdrawSubmitting || !dashboardSnapshot.quickStats.plan.canWithdraw) {
            return;
        }

        setIsWithdrawSubmitting(true);
        try {
            await withdrawSubmission({
                planId: currentRow.id,
            });
            toast.success("Submission withdrawn. This draft is editable again.");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "The submission could not be withdrawn right now.",
            );
        } finally {
            setIsWithdrawSubmitting(false);
        }
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background">
            <div className="px-4 py-8 sm:px-6 lg:hidden">
                <Card className="mx-auto max-w-2xl rounded-[24px] border-border/70 bg-card shadow-sm">
                    <CardHeader className="space-y-4">
                        <Badge className="w-fit rounded-md bg-primary text-primary-foreground hover:bg-primary">
                            Desktop required
                        </Badge>
                        <CardTitle className="text-2xl text-foreground">
                            Department User dashboards are designed for desktop viewports
                        </CardTitle>
                        <CardDescription className="text-base leading-7 text-muted-foreground">
                            This workspace follows the desktop-only DU planning layout from the Procureline UX specification.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>

            <div className="hidden lg:block">
                <div className="mx-auto flex w-full max-w-none flex-col gap-4 px-4 py-4 xl:px-5">
                    {dashboardSnapshot.rejectionNotice ? (
                        <Alert
                            className="rounded-2xl border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                            dismissible
                            dismissKey={`${dashboardSnapshot.rejectionNotice.title}-${dashboardSnapshot.rejectionNotice.message}-${dashboardSnapshot.rejectionNotice.action.href}`}
                        >
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>{dashboardSnapshot.rejectionNotice.title}</AlertTitle>
                            <AlertDescription className="flex items-center justify-between gap-4">
                                <span>{dashboardSnapshot.rejectionNotice.message}</span>
                                <Button asChild size="sm" className="rounded-full">
                                    <Link href={dashboardSnapshot.rejectionNotice.action.href}>
                                        {dashboardSnapshot.rejectionNotice.action.label}
                                    </Link>
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    <OperationalOverview
                        isWithdrawing={isWithdrawSubmitting}
                        launchpadActionLabel={launchpadActionLabel}
                        launchpadDisabled={launchpadInteractivity.disabled}
                        launchpadStatusLabel={launchpadInteractivity.statusLabel}
                        onLaunchpadAction={handleLaunchpadAction}
                        onSelectionChange={handleCategorySelectionChange}
                        onRequestRedraft={() => {
                            const approvedRow = dashboardSnapshot.plans.rows.find(
                                (row) =>
                                    row.isCurrentFiscalYear &&
                                    row.statusLabel === "Approved",
                            );
                            if (approvedRow) {
                                setRedraftPlanId(approvedRow.id);
                            }
                        }}
                        onWithdrawSubmission={() => void handleWithdrawSubmission()}
                        selectedCategoryIds={effectiveSelectedCategoryIds}
                        snapshot={dashboardSnapshot}
                    />
                </div>
            </div>
            <Dialog
                open={redraftPlanId !== null}
                onOpenChange={(open) => {
                    if (!open && !isRedraftSubmitting) {
                        setRedraftPlanId(null);
                        setRedraftReason("");
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Request approved plan reopen</DialogTitle>
                        <DialogDescription>
                            Send a request to your Procurement Officer to approve reopening this plan for editing. This does not unlock the plan immediately.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={redraftReason}
                        onChange={(event) => setRedraftReason(event.target.value)}
                        placeholder="Explain what needs to change in the approved plan."
                    />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isRedraftSubmitting}
                            onClick={() => {
                                setRedraftPlanId(null);
                                setRedraftReason("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={isRedraftSubmitting || redraftReason.trim().length < 8}
                            onClick={() => void handleSubmitRedraftRequest()}
                        >
                            {isRedraftSubmitting ? "Sending..." : "Send request"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function OperationalOverview({
    isWithdrawing,
    launchpadActionLabel,
    launchpadDisabled,
    launchpadStatusLabel,
    onLaunchpadAction,
    onSelectionChange,
    onRequestRedraft,
    onWithdrawSubmission,
    selectedCategoryIds,
    snapshot,
}: {
    isWithdrawing: boolean;
    launchpadActionLabel: string;
    launchpadDisabled: boolean;
    launchpadStatusLabel: string;
    onLaunchpadAction: () => void;
    onSelectionChange: (categoryId: string, checked: boolean) => void;
    onRequestRedraft: () => void;
    onWithdrawSubmission: () => void;
    selectedCategoryIds: string[];
    snapshot: DepartmentUserDashboardSnapshot;
}) {
    const budget = snapshot.quickStats.budget;
    const plan = snapshot.quickStats.plan;
    const deadline = snapshot.quickStats.deadline;
    const categories = budget.breakdown.items;
    const currentPlan = snapshot.plans.rows.find((row) => row.isCurrentFiscalYear);
    const pendingApprovals =
        plan.statusLabel === "Submitted" || plan.statusLabel === "Under Review" ? 1 : 0;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">Overview</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {snapshot.heroSupport.departmentName} procurement workspace
                    </p>
                </div>
                <Button
                    type="button"
                    className="rounded-full"
                    disabled={launchpadDisabled}
                    onClick={() => startTransition(onLaunchpadAction)}
                >
                    {launchpadActionLabel}
                </Button>
            </div>

            <div className="grid gap-3 xl:grid-cols-5">
                <MetricTile
                    icon={<BarChart3 className="h-4 w-4" />}
                    label="Plan Utilization"
                    value={budget.state === "available" ? `${budget.utilizationPercent}%` : "--"}
                    detail={`${budget.usedBudgetLabel} of ${budget.totalBudgetLabel}`}
                    accent="emerald"
                    progress={budget.utilizationPercent}
                />
                <MetricTile
                    icon={<Boxes className="h-4 w-4" />}
                    label="Budgeted Amount"
                    value={budget.totalBudgetLabel}
                    detail={`FY ${snapshot.meta.fiscalYearKey}`}
                    accent="blue"
                />
                <MetricTile
                    icon={<ClipboardList className="h-4 w-4" />}
                    label="Total Items"
                    value={String(plan.itemCount)}
                    detail={`Across ${categories.length} categories`}
                    accent="emerald"
                />
                <MetricTile
                    icon={<FileClock className="h-4 w-4" />}
                    label="Pending Approvals"
                    value={String(pendingApprovals)}
                    detail={plan.statusLabel}
                    accent="violet"
                />
                <MetricTile
                    icon={<CalendarClock className="h-4 w-4" />}
                    label="Submission Deadline"
                    value={deadline.deadlineDateLabel}
                    detail={deadline.note}
                    accent="emerald"
                />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,2.3fr)_minmax(280px,0.9fr)]">
                <PlanSummaryCard
                    budget={budget}
                    categories={categories}
                    primaryHref={plan.primaryActionHref}
                />
                <TimelineCard timeline={plan.timeline} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,2.7fr)_minmax(280px,0.95fr)]">
                <PlanCategoriesCard
                    canSelectCategories={snapshot.launchpad.canSelectCategories}
                    categories={snapshot.launchpad.categories}
                    launchpadStatusLabel={launchpadStatusLabel}
                    onSelectionChange={onSelectionChange}
                    selectedCategoryIds={selectedCategoryIds}
                />
                <DepartmentNotesCard
                    currentPlan={currentPlan}
                    isWithdrawing={isWithdrawing}
                    onRequestRedraft={onRequestRedraft}
                    onWithdrawSubmission={onWithdrawSubmission}
                    plan={plan}
                    snapshot={snapshot}
                />
            </div>
        </div>
    );
}

function MetricTile({
    accent,
    detail,
    icon,
    label,
    progress,
    value,
}: {
    accent: "blue" | "emerald" | "violet";
    detail: string;
    icon: React.ReactNode;
    label: string;
    progress?: number;
    value: string;
}) {
    const accentClass = {
        blue: "bg-blue-500/10 text-blue-300",
        emerald: "bg-emerald-500/10 text-emerald-300",
        violet: "bg-violet-500/10 text-violet-300",
    }[accent];

    return (
        <Card className="rounded-xl border-border/60 bg-card/95 shadow-sm">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {label}
                        </div>
                        <div className="mt-2 break-words text-2xl font-black text-foreground">
                            {value}
                        </div>
                        <div className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</div>
                    </div>
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", accentClass)}>
                        {icon}
                    </div>
                </div>
                {typeof progress === "number" ? (
                    <div className="mt-4 h-2 rounded-full bg-muted">
                        <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                        />
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}

function PlanSummaryCard({
    budget,
    categories,
    primaryHref,
}: {
    budget: DepartmentUserDashboardSnapshot["quickStats"]["budget"];
    categories: DepartmentUserDashboardSnapshot["quickStats"]["budget"]["breakdown"]["items"];
    primaryHref: string;
}) {
    return (
        <Card className="rounded-xl border-border/60 bg-card/95 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold">Annual Procurement Plan Summary</CardTitle>
                <Button asChild size="sm" variant="outline" className="rounded-lg">
                    <Link href={primaryHref}>View Full Plan</Link>
                </Button>
            </CardHeader>
            <CardContent>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                            <th className="py-3 font-medium">Category</th>
                            <th className="py-3 text-right font-medium">Items</th>
                            <th className="py-3 text-right font-medium">Total</th>
                            <th className="py-3 text-right font-medium">% of Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((category) => {
                            const percent = budget.totalBudget > 0 ? (category.amount / budget.totalBudget) * 100 : 0;
                            return (
                                <tr key={category.id} className="border-b border-border/40 last:border-b-0">
                                    <td className="py-3 font-medium text-foreground">{category.categoryName}</td>
                                    <td className="py-3 text-right text-muted-foreground">
                                        {category.itemCountLabel.replace(/ items?/, "")}
                                    </td>
                                    <td className="py-3 text-right font-medium text-foreground">{category.amountLabel}</td>
                                    <td className="py-3">
                                        <div className="flex items-center justify-end gap-3">
                                            <span className="w-12 text-right font-medium text-foreground">
                                                {formatPercent(percent)}
                                            </span>
                                            <ProgressBar value={percent} />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        <tr>
                            <td className="py-3 font-semibold text-foreground">Total</td>
                            <td className="py-3 text-right font-semibold text-foreground">
                                {categories.reduce((total, item) => total + parseItemCount(item.itemCountLabel), 0)}
                            </td>
                            <td className="py-3 text-right font-semibold text-foreground">{budget.totalBudgetLabel}</td>
                            <td className="py-3 text-right font-semibold text-foreground">100%</td>
                        </tr>
                    </tbody>
                </table>
            </CardContent>
        </Card>
    );
}

function TimelineCard({
    timeline,
}: {
    timeline: DepartmentUserDashboardSnapshot["quickStats"]["plan"]["timeline"];
}) {
    const steps = timeline.length > 0
        ? timeline
        : [
              { description: "--", id: "created", timestampLabel: "--", title: "Plan Created" },
              { description: "--", id: "planning", timestampLabel: "--", title: "In Planning" },
              { description: "--", id: "approval", timestampLabel: "--", title: "For Approval" },
              { description: "--", id: "approved", timestampLabel: "--", title: "Approved" },
              { description: "--", id: "implementation", timestampLabel: "--", title: "Implementation" },
              { description: "--", id: "completed", timestampLabel: "--", title: "Completed" },
          ];

    return (
        <Card className="rounded-xl border-border/60 bg-card/95 shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Plan Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {steps.map((item, index) => (
                    <div key={item.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <div
                                className={cn(
                                    "flex h-6 w-6 items-center justify-center rounded-full border",
                                    index < timeline.length
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-muted text-muted-foreground",
                                )}
                            >
                                {index < timeline.length ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                            </div>
                            {index < steps.length - 1 ? <div className="mt-2 h-7 w-px bg-border" /> : null}
                        </div>
                        <div className="min-w-0 pb-1">
                            <div className="font-medium text-foreground">{item.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{item.timestampLabel}</div>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function PlanCategoriesCard({
    canSelectCategories,
    categories,
    launchpadStatusLabel,
    onSelectionChange,
    selectedCategoryIds,
}: {
    canSelectCategories: boolean;
    categories: DepartmentUserDashboardSnapshot["launchpad"]["categories"];
    launchpadStatusLabel: string;
    onSelectionChange: (categoryId: string, checked: boolean) => void;
    selectedCategoryIds: string[];
}) {
    const selectedCount = selectedCategoryIds.length;

    return (
        <Card className="rounded-xl border-border/60 bg-card/95 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                    <CardTitle className="text-base font-semibold">Plan Categories</CardTitle>
                    <CardDescription>
                        Select the categories your department will use in this fiscal-year plan.
                    </CardDescription>
                </div>
                <Badge variant="outline" className="rounded-lg">
                    {selectedCount > 0 ? `${selectedCount} selected` : launchpadStatusLabel}
                </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
                {categories.length > 0 ? (
                    <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                            <th className="w-12 py-3 font-medium">Use</th>
                            <th className="py-3 font-medium">Category</th>
                            <th className="py-3 font-medium">Availability</th>
                            <th className="py-3 text-right font-medium">Items</th>
                            <th className="py-3 text-right font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((category) => {
                            const checked = selectedCategoryIds.includes(category.id);
                            const disabled = !canSelectCategories || category.disabled;
                            return (
                                <tr
                                    key={category.id}
                                    className={cn(
                                        "border-b border-border/40 last:border-b-0",
                                        checked ? "bg-primary/5" : null,
                                        disabled ? "text-muted-foreground" : null,
                                    )}
                                >
                                    <td className="py-4 align-top">
                                        <Checkbox
                                            aria-label={`Use ${category.name} in this departmental plan`}
                                            checked={checked}
                                            disabled={disabled}
                                            onCheckedChange={(value) =>
                                                onSelectionChange(category.id, value === true)
                                            }
                                        />
                                    </td>
                                    <td className="py-4 align-top">
                                        <div className="font-semibold text-foreground">{category.name}</div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            {category.itemCountLabel} available for planning
                                        </div>
                                    </td>
                                    <td className="max-w-[340px] py-4 align-top text-muted-foreground">
                                        {category.disabledReason ??
                                            (canSelectCategories
                                                ? "Available for this departmental plan."
                                                : "Category selection is locked for this plan state.")}
                                    </td>
                                    <td className="py-4 text-right align-top text-foreground">
                                        {category.itemCount}
                                    </td>
                                    <td className="py-4 text-right align-top">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "rounded-full",
                                                checked
                                                    ? "border-primary/30 text-primary"
                                                    : "text-muted-foreground",
                                            )}
                                        >
                                            {checked ? "Selected" : disabled ? "Unavailable" : "Optional"}
                                        </Badge>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    </table>
                ) : (
                    <EmptyOperationalState label="No plan categories are available for this department yet." />
                )}
            </CardContent>
        </Card>
    );
}

function DepartmentNotesCard({
    currentPlan,
    isWithdrawing,
    onRequestRedraft,
    onWithdrawSubmission,
    plan,
    snapshot,
}: {
    currentPlan: DepartmentUserDashboardSnapshot["plans"]["rows"][number] | undefined;
    isWithdrawing: boolean;
    onRequestRedraft: () => void;
    onWithdrawSubmission: () => void;
    plan: DepartmentUserDashboardSnapshot["quickStats"]["plan"];
    snapshot: DepartmentUserDashboardSnapshot;
}) {
    return (
        <Card className="rounded-xl border-border/60 bg-card/95 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold">Department Notes</CardTitle>
                <Button type="button" size="sm" variant="outline" disabled className="rounded-lg">
                    Edit
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
                    <NotebookPen className="mx-auto h-5 w-5 text-muted-foreground" />
                    <div className="mt-3 font-medium text-foreground">No notes added</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        Add notes to keep track of important information.
                    </div>
                </div>
                <div className="space-y-2 text-sm">
                    <InfoLine label="Department" value={snapshot.heroSupport.departmentName} />
                    <InfoLine label="Fiscal year" value={snapshot.meta.fiscalYearKey} />
                    <InfoLine label="Plan status" value={plan.statusLabel} />
                    {currentPlan?.submissionReference ? (
                        <InfoLine label="Reference" value={currentPlan.submissionReference} />
                    ) : null}
                </div>
                {plan.canWithdraw ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-lg"
                        disabled={isWithdrawing}
                        onClick={onWithdrawSubmission}
                    >
                        {isWithdrawing ? "Withdrawing..." : "Withdraw submission"}
                    </Button>
                ) : null}
                {plan.redraftRequest.canRequest ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-lg"
                        onClick={onRequestRedraft}
                    >
                        Request reopen approval
                    </Button>
                ) : null}
            </CardContent>
        </Card>
    );
}

function InfoLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium text-foreground">{value}</span>
        </div>
    );
}

function EmptyOperationalState({ label }: { label: string }) {
    return (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            {label}
        </div>
    );
}

function ProgressBar({ value }: { value: number }) {
    return (
        <div className="h-2 w-24 rounded-full bg-muted">
            <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
            />
        </div>
    );
}

function parseItemCount(label: string): number {
    return Number.parseInt(label, 10) || 0;
}

function formatPercent(value: number): string {
    if (!Number.isFinite(value)) {
        return "0%";
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

export function PlanStatCard({
    isWithdrawing,
    onRequestRedraft,
    onWithdrawSubmission,
    plan,
}: {
    isWithdrawing: boolean;
    onRequestRedraft: () => void;
    onWithdrawSubmission: () => void;
    plan: DepartmentUserDashboardSnapshot["quickStats"]["plan"];
}) {
    return (
        <Card className="rounded-[26px] border-border/70 shadow-sm">
            <CardHeader className="space-y-3 pb-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Items in Plan
                </CardTitle>
                <div className="text-5xl font-black tracking-[-0.08em] text-foreground">
                    {plan.itemCount}
                </div>
                <CardDescription className="text-base text-muted-foreground">
                    {plan.statusLabel}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
                    {plan.helperText}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    {plan.statusDateLabel ? (
                        <div className="rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Latest update
                            </div>
                            <div className="mt-1 font-medium text-foreground">
                                {plan.statusDateLabel}
                            </div>
                        </div>
                    ) : null}
                    {plan.reviewerLabel || plan.reviewerState === "unavailable" ? (
                        <div className="rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Reviewer
                            </div>
                            <div className="mt-1 font-medium text-foreground">
                                {plan.reviewerLabel ?? "Procurement Officer review in progress"}
                            </div>
                        </div>
                    ) : null}
                </div>
                {plan.submissionReference ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
                        Submission reference: <span className="font-semibold">{plan.submissionReference}</span>
                    </div>
                ) : null}
                {plan.historySummary ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900">
                        {plan.historySummary}
                    </div>
                ) : null}
                {plan.redraftRequest.pendingRequestId ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900">
                        Redraft request pending PO approval.
                    </div>
                ) : null}
                {plan.timeline.length > 0 ? (
                    <div className="rounded-2xl border border-border/60 bg-background px-4 py-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-foreground">Status history</div>
                            <Badge variant="outline" className="rounded-full">
                                {plan.timeline.length} events
                            </Badge>
                        </div>
                        <div className="space-y-3">
                            {plan.timeline.map((item) => (
                                <div key={item.id} className="flex gap-3">
                                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium text-foreground">{item.title}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {item.timestampLabel}
                                            </span>
                                        </div>
                                        <div className="text-sm leading-6 text-muted-foreground">
                                            {item.description}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
                {plan.statusLabel !== "No Plan" ? (
                    <Button asChild className="w-full rounded-2xl">
                        <Link href={plan.primaryActionHref}>
                            {plan.primaryActionLabel}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                ) : null}
                {plan.canWithdraw ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-2xl"
                        disabled={isWithdrawing}
                        onClick={onWithdrawSubmission}
                    >
                        {isWithdrawing ? "Withdrawing..." : "Withdraw submission"}
                    </Button>
                ) : null}
                {plan.redraftRequest.canRequest ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-2xl"
                        onClick={onRequestRedraft}
                    >
                        Request reopen approval
                    </Button>
                ) : null}
            </CardContent>
        </Card>
    );
}

function StatusIcon({ statusLabel }: { statusLabel: string }) {
    if (statusLabel === "Approved") {
        return <CheckCircle2 className="h-3.5 w-3.5" />;
    }
    if (statusLabel === "Rejected") {
        return <XCircle className="h-3.5 w-3.5" />;
    }
    if (statusLabel === "Under Review") {
        return <Eye className="h-3.5 w-3.5" />;
    }
    if (statusLabel === "Submitted") {
        return <RefreshCcw className="h-3.5 w-3.5" />;
    }

    return <Clock3 className="h-3.5 w-3.5" />;
}

export function PlansCard({
    emptyMessage,
    rows,
    title,
}: {
    emptyMessage: string;
    rows: Array<{
        action: { href: string; label: string };
        fiscalYear: string;
        id: string;
        itemCountLabel: string;
        rejectionComment: string | null;
        reviewerLabel: string | null;
        statusDateLabel: string | null;
        statusDetail: string;
        statusHistorySummary: string | null;
        statusLabel: string;
        submissionReference: string | null;
        viewHref: string;
    }>;
    title: string;
}) {
    return (
        <Card className="rounded-[28px] border-border/70 shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-xl tracking-[-0.04em] text-foreground">
                            {title}
                        </CardTitle>
                        <CardDescription className="mt-2">
                            One canonical plan per fiscal year.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <div className="space-y-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-5 py-8 text-center">
                        <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
                        <div className="text-lg font-semibold text-foreground">Start Your Plan</div>
                        <div className="text-sm leading-6 text-muted-foreground">
                            {emptyMessage || "Use the Plan Launchpad to start your first procurement plan."}
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="h-[360px]">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-card">
                                <tr className="border-b border-border/70 text-left text-muted-foreground">
                                    <th className="pb-3 font-medium">Fiscal Year</th>
                                    <th className="pb-3 font-medium">Status</th>
                                    <th className="pb-3 font-medium">Items</th>
                                    <th className="pb-3 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id} className="border-b border-border/50 align-top last:border-b-0">
                                        <td className="py-4 font-medium text-foreground">{row.fiscalYear}</td>
                                        <td className="py-4">
                                            <Badge variant="outline" className="rounded-full">
                                                <span className="inline-flex items-center gap-2">
                                                    <StatusIcon statusLabel={row.statusLabel} />
                                                    {row.statusLabel}
                                                </span>
                                            </Badge>
                                            {row.submissionReference ? (
                                                <div className="mt-2 text-xs font-medium text-emerald-700">
                                                    Ref: {row.submissionReference}
                                                </div>
                                            ) : null}
                                            {row.statusDateLabel ? (
                                                <div className="mt-2 text-xs text-muted-foreground">
                                                    {row.statusDateLabel}
                                                </div>
                                            ) : null}
                                            {row.reviewerLabel ? (
                                                <div className="mt-2 text-xs text-muted-foreground">
                                                    Reviewer: {row.reviewerLabel}
                                                </div>
                                            ) : null}
                                            <div className="mt-2 max-w-[260px] text-xs leading-5 text-muted-foreground">
                                                {row.statusDetail}
                                            </div>
                                            {row.rejectionComment ? (
                                                <div className="mt-2 max-w-[220px] text-xs leading-5 text-muted-foreground">
                                                    {row.rejectionComment}
                                                </div>
                                            ) : null}
                                            {row.statusHistorySummary ? (
                                                <div className="mt-2 max-w-[220px] text-xs leading-5 text-amber-700">
                                                    {row.statusHistorySummary}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="py-4 text-muted-foreground">{row.itemCountLabel}</td>
                                        <td className="py-4">
                                            <div className="flex justify-end gap-2">
                                                <Button asChild size="sm" variant="outline" className="rounded-full">
                                                    <Link href={row.viewHref}>View</Link>
                                                </Button>
                                                <Button asChild size="sm" className="rounded-full">
                                                    <Link href={row.action.href}>{row.action.label}</Link>
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}

function DepartmentUserBlockedState({
    message,
    title,
}: {
    message: string | null;
    title: string | null;
}) {
    return (
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
            <Card className="w-full rounded-[32px] border-border/70 bg-card/95 shadow-sm">
                <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 text-amber-800">
                            Setup blocked
                        </Badge>
                        <CircleHelp className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-3xl tracking-tight text-foreground">
                            {title ?? "Department setup incomplete"}
                        </CardTitle>
                        <CardDescription className="text-base leading-7 text-muted-foreground">
                            {message ?? "Department setup is incomplete. Contact your Procurement Officer to finish linking your account."}
                        </CardDescription>
                    </div>
                </CardHeader>
            </Card>
        </div>
    );
}

function DepartmentUserDashboardSkeleton(): JSX.Element {
    return (
        <div className="mx-auto hidden w-full max-w-none gap-4 px-4 py-4 lg:flex lg:flex-col xl:px-5">
            <div className="grid gap-4 xl:grid-cols-3">
                <Skeleton className="h-72 rounded-[28px]" />
                <Skeleton className="h-72 rounded-[28px]" />
                <Skeleton className="h-72 rounded-[28px]" />
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <Skeleton className="h-[28rem] rounded-[28px]" />
                <Skeleton className="h-[28rem] rounded-[28px]" />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
                <Skeleton className="h-64 rounded-[28px]" />
                <Skeleton className="h-64 rounded-[28px]" />
            </div>
        </div>
    );
}
