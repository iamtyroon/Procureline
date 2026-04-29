"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    CircleHelp,
    ClipboardList,
    Clock3,
    Eye,
    Layers3,
    Megaphone,
    RefreshCcw,
    Trophy,
    XCircle,
} from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    selectAllCategories,
    toggleCategorySelection,
} from "@/lib/department-user/dashboard";
import { formatDeadlineCountdown } from "@/lib/procurement-officer/deadlines";
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
    const [isBudgetOpen, setIsBudgetOpen] = useState(false);
    const [countdownNow, setCountdownNow] = useState(() => Date.now());
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

    useEffect(() => {
        if (!snapshot?.quickStats.deadline.targetAt) {
            return;
        }

        const interval = window.setInterval(() => {
            setCountdownNow(Date.now());
        }, 30_000);

        return () => window.clearInterval(interval);
    }, [snapshot?.quickStats.deadline.targetAt]);

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

                    <div className="grid gap-4 xl:grid-cols-3">
                        <BudgetCard
                            budget={dashboardSnapshot.quickStats.budget}
                            isBudgetOpen={isBudgetOpen}
                            setIsBudgetOpen={setIsBudgetOpen}
                        />
                        <PlanStatCard
                            isWithdrawing={isWithdrawSubmitting}
                            onWithdrawSubmission={() => void handleWithdrawSubmission()}
                            plan={dashboardSnapshot.quickStats.plan}
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
                        />
                        <DeadlineCard countdownNow={countdownNow} deadline={dashboardSnapshot.quickStats.deadline} />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                        <LaunchpadCard
                            categories={dashboardSnapshot.launchpad.categories}
                            canSelectCategories={dashboardSnapshot.launchpad.canSelectCategories}
                            disabledReason={launchpadInteractivity.disabledReason}
                            launchpadActionLabel={launchpadActionLabel}
                            launchpadDisabled={launchpadInteractivity.disabled}
                            onAction={handleLaunchpadAction}
                            selectedCategoryIds={effectiveSelectedCategoryIds}
                            setSelectedCategoryIds={setSelectedCategoryIds}
                            statusLabel={launchpadInteractivity.statusLabel}
                            subtitle={dashboardSnapshot.launchpad.subtitle}
                            title={dashboardSnapshot.launchpad.title}
                        />
                        <PlansCard
                            emptyMessage={dashboardSnapshot.plans.emptyMessage}
                            rows={dashboardSnapshot.plans.rows}
                            title={dashboardSnapshot.plans.title}
                        />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <InfoPanel
                            badgeLabel={dashboardSnapshot.leaderboard.state === "available" ? "Live" : "Unavailable"}
                            description={dashboardSnapshot.leaderboard.emptyMessage}
                            emptyLabel="No leaderboard data"
                            icon={<Trophy className="h-4 w-4" />}
                            items={dashboardSnapshot.leaderboard.items}
                            title={dashboardSnapshot.leaderboard.title}
                        />
                        <InfoPanel
                            badgeLabel={dashboardSnapshot.announcements.state === "available" ? "Live" : "Unavailable"}
                            description={dashboardSnapshot.announcements.emptyMessage}
                            emptyLabel="No announcements"
                            icon={<Megaphone className="h-4 w-4" />}
                            items={dashboardSnapshot.announcements.items}
                            title={dashboardSnapshot.announcements.title}
                            trailing={
                                <Button type="button" variant="ghost" size="sm" disabled className="rounded-full">
                                    View All
                                </Button>
                            }
                        />
                    </div>
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

function BudgetCard({
    budget,
    isBudgetOpen,
    setIsBudgetOpen,
}: {
    budget: DepartmentUserDashboardSnapshot["quickStats"]["budget"];
    isBudgetOpen: boolean;
    setIsBudgetOpen: (value: boolean) => void;
}) {
    return (
        <Card className="rounded-[26px] border-border/70 shadow-sm">
            <CardHeader className="space-y-3 pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Budget Utilization
                    </CardTitle>
                    <Badge variant="outline" className="rounded-full">
                        {budget.state === "available" ? `${budget.utilizationPercent}%` : "Unavailable"}
                    </Badge>
                </div>
                <div className="text-5xl font-black tracking-[-0.08em] text-foreground">
                    {budget.state === "available" ? `${budget.utilizationPercent}%` : "--"}
                </div>
                <CardDescription className="text-base text-muted-foreground">
                    {budget.usedBudgetLabel} / {budget.totalBudgetLabel}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Collapsible open={isBudgetOpen} onOpenChange={setIsBudgetOpen}>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-left">
                        <div>
                            <div className="font-medium text-foreground">Budget by category</div>
                            <div className="text-sm text-muted-foreground">{budget.helperText}</div>
                        </div>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isBudgetOpen && "rotate-180")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                        {budget.breakdown.items.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                                {budget.breakdown.emptyMessage}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {budget.breakdown.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3"
                                    >
                                        <div>
                                            <div className="font-medium text-foreground">{item.categoryName}</div>
                                            <div className="text-sm text-muted-foreground">{item.itemCountLabel}</div>
                                        </div>
                                        <div className="font-semibold text-foreground">{item.amountLabel}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CollapsibleContent>
                </Collapsible>
            </CardContent>
        </Card>
    );
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

function DeadlineCard({
    countdownNow,
    deadline,
}: {
    countdownNow: number;
    deadline: DepartmentUserDashboardSnapshot["quickStats"]["deadline"];
}) {
    const liveGaugeLabel =
        deadline.targetAt &&
        (deadline.state === "available" || deadline.state === "coming_soon")
            ? formatDeadlineCountdown({
                  deadlineAt: deadline.targetAt,
                  now: countdownNow,
              })
            : deadline.gaugeLabel;

    return (
        <Card className="rounded-[26px] border-border/70 shadow-sm">
            <CardHeader className="space-y-3 pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {deadline.label}
                    </CardTitle>
                    <Badge
                        variant="outline"
                        className={cn(
                            "rounded-full",
                            deadline.state === "read_only" &&
                                "border-border/70 bg-muted text-muted-foreground",
                            deadline.state === "coming_soon" &&
                                "border-primary/20 bg-primary/10 text-primary",
                            deadline.state === "available" &&
                                deadline.isUrgent &&
                                "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
                        )}
                    >
                        {liveGaugeLabel}
                    </Badge>
                </div>
                <div className="flex items-center gap-4">
                    <ThemedDeadlineRing
                        label={liveGaugeLabel}
                        percent={deadline.gaugePercent}
                        state={deadline.state}
                        urgent={deadline.isUrgent}
                    />
                    <div className="min-w-0">
                        <div className="text-3xl font-black tracking-[-0.06em] text-foreground">
                            {deadline.deadlineDateLabel}
                        </div>
                        <CardDescription className="mt-1 text-sm font-medium text-foreground">
                            {deadline.note}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{deadline.helperText}</span>
                        <span className="shrink-0 font-medium text-foreground">
                            {deadline.fiscalYearLabel}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ThemedDeadlineRing({
    label,
    percent,
    state,
    urgent,
}: {
    label: string;
    percent: number;
    state: string;
    urgent: boolean;
}) {
    const safePercent = Math.max(0, Math.min(100, percent));
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - (safePercent / 100) * circumference;
    const progressClass =
        state === "read_only"
            ? "stroke-muted-foreground/35"
            : urgent
              ? "stroke-amber-500"
              : "stroke-primary";
    const iconClass =
        state === "read_only"
            ? "text-muted-foreground"
            : urgent
              ? "text-amber-700 dark:text-amber-100"
              : "text-primary";

    return (
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted/20">
            <svg className="-rotate-90" height="72" viewBox="0 0 72 72" width="72">
                <circle
                    className="stroke-border/70"
                    cx="36"
                    cy="36"
                    fill="none"
                    r={radius}
                    strokeWidth="6"
                />
                <circle
                    className={cn("transition-all duration-500 ease-out", progressClass)}
                    cx="36"
                    cy="36"
                    fill="none"
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={progressOffset}
                    strokeLinecap="round"
                    strokeWidth="6"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Clock3 className={cn("h-4 w-4", iconClass)} />
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {label}
                </div>
            </div>
        </div>
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

function LaunchpadCard({
    categories,
    canSelectCategories,
    disabledReason,
    launchpadActionLabel,
    launchpadDisabled,
    onAction,
    selectedCategoryIds,
    setSelectedCategoryIds,
    statusLabel,
    subtitle,
    title,
}: {
    categories: Array<{
        disabled: boolean;
        disabledReason: string | null;
        id: string;
        itemCountLabel: string;
        name: string;
    }>;
    canSelectCategories: boolean;
    disabledReason: string | null;
    launchpadActionLabel: string;
    launchpadDisabled: boolean;
    onAction: () => void;
    selectedCategoryIds: string[];
    setSelectedCategoryIds: React.Dispatch<React.SetStateAction<string[]>>;
    statusLabel: string;
    subtitle: string;
    title: string;
}) {
    return (
        <Card className="rounded-[28px] border-border/70 shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl tracking-[-0.04em] text-foreground">
                            {title}
                        </CardTitle>
                        <CardDescription className="mt-2 text-sm leading-6">
                            {subtitle}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!canSelectCategories || categories.length === 0}
                            className="rounded-full"
                            onClick={() =>
                                setSelectedCategoryIds(
                                    selectAllCategories(categories.map((category) => category.id)),
                                )
                            }
                        >
                            Select All
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!canSelectCategories || selectedCategoryIds.length === 0}
                            className="rounded-full"
                            onClick={() => setSelectedCategoryIds([])}
                        >
                            Clear All
                        </Button>
                        <Button
                            type="button"
                            className="rounded-full"
                            disabled={launchpadDisabled}
                            onClick={() => startTransition(onAction)}
                        >
                            {launchpadActionLabel}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-3">
                    {categories.length === 0 ? (
                        <div className="w-full rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                            {disabledReason ?? "Setup in progress. Your Procurement Officer is preparing the catalog."}
                        </div>
                    ) : (
                        categories.map((category) => {
                            const isSelected = selectedCategoryIds.includes(category.id);
                            return (
                                <button
                                    key={category.id}
                                    type="button"
                                    aria-pressed={isSelected}
                                    disabled={!canSelectCategories || category.disabled}
                                    className={cn(
                                        "flex min-w-[180px] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                                        isSelected
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border/70 bg-background text-foreground",
                                        (!canSelectCategories || category.disabled) &&
                                            "cursor-not-allowed opacity-70",
                                    )}
                                    onClick={() =>
                                        setSelectedCategoryIds((current) =>
                                            toggleCategorySelection({
                                                categoryId: category.id,
                                                selectedCategoryIds: current,
                                            }),
                                        )
                                    }
                                >
                                    <div>
                                        <div className="font-medium">{category.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {category.disabledReason ?? category.itemCountLabel}
                                        </div>
                                    </div>
                                    <Layers3 className="h-4 w-4" />
                                </button>
                            );
                        })
                    )}
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                    <div className="text-sm text-muted-foreground">
                        {selectedCategoryIds.length} categories selected
                    </div>
                    <div className="text-sm font-medium text-foreground">
                        {statusLabel}
                    </div>
                </div>

                {disabledReason ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                        {disabledReason}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
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

function InfoPanel({
    badgeLabel,
    description,
    emptyLabel,
    icon,
    items,
    title,
    trailing,
}: {
    badgeLabel: string;
    description: string;
    emptyLabel: string;
    icon: React.ReactNode;
    items:
        | DepartmentUserDashboardSnapshot["announcements"]["items"]
        | DepartmentUserDashboardSnapshot["leaderboard"]["items"];
    title: string;
    trailing?: React.ReactNode;
}) {
    return (
        <Card className="rounded-[28px] border-border/70 shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            {icon}
                        </div>
                        <div>
                            <CardTitle className="text-xl tracking-[-0.04em] text-foreground">{title}</CardTitle>
                            <CardDescription className="mt-1">{description}</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {trailing}
                        <Badge variant="outline" className="rounded-full">
                            {badgeLabel}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-5 py-12 text-center">
                        <div className="text-base font-medium text-foreground">{emptyLabel}</div>
                        <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4"
                            >
                                {"rank" in item ? (
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-medium text-foreground">{item.label}</div>
                                            <div className="mt-1 text-sm text-muted-foreground">
                                                Rank #{item.rank}
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="rounded-full">
                                            {item.score}
                                        </Badge>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="font-medium text-foreground">{item.title}</div>
                                        <div className="mt-2 text-sm leading-6 text-muted-foreground">
                                            {item.message}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
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
