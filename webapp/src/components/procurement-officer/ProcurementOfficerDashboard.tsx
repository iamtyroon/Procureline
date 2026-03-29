"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import {
    AlertTriangle,
    ArrowRight,
    ArrowUpRight,
    Building2,
    CalendarClock,
    CheckCircle2,
    ChevronRight,
    FileStack,
    FolderTree,
    KeyRound,
    Layers3,
    MapPin,
    Users2,
    Zap,
} from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    buildProcurementOfficerWorkspaceModalPath,
    formatProcurementFiscalYearLabel,
    normalizeProcurementOfficerWorkspaceModalState,
    resolveProcurementOfficerWorkspaceNavigation,
    type ProcurementDashboardState,
    type ProcurementOfficerWorkspaceModalState,
    type ProcurementOfficerWorkspaceSection,
} from "@/lib/procurement-officer/dashboard";
import type {
    ProcurementOfficerDashboardDepartmentReadinessItem,
    ProcurementOfficerDashboardFuturePanel,
    ProcurementOfficerDashboardSummaryCard,
} from "@/lib/procurement-officer/dashboard-snapshot";
import { formatDeadlineCountdown } from "@/lib/procurement-officer/deadlines";
import { cn } from "@/lib/utils";
import { ProcurementOfficerAccessCodesWorkspace } from "./ProcurementOfficerAccessCodesWorkspace";
import { ProcurementOfficerDeadlinesWorkspace } from "./ProcurementOfficerDeadlinesWorkspace";
import { ProcurementOfficerDepartmentsWorkspace } from "./ProcurementOfficerDepartmentsWorkspace";

/* ─── Donut Ring ──────────────────────────────────────────────────── */

function DonutRing({
    value,
    size = 120,
    strokeWidth = 10,
    className,
}: {
    value: number;
    size?: number;
    strokeWidth?: number;
    className?: string;
}) {
    const radius = (size - strokeWidth) / 2.5;
    const circumference = 2 * Math.PI * radius;
    const filled = Math.min(value, 100);
    const offset = circumference - (filled / 100) * circumference;

    const color =
        filled >= 100
            ? "stroke-emerald-500"
            : filled >= 60
              ? "stroke-primary"
              : filled >= 30
                ? "stroke-amber-400"
                : "stroke-rose-400";

    return (
        <svg
            className={cn("rotate-[-90deg]", className)}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            width={size}
        >
            <circle
                className="stroke-muted"
                cx={size / 2}
                cy={size / 2}
                fill="none"
                r={radius}
                strokeWidth={strokeWidth}
            />
            <circle
                className={cn("transition-all duration-700 ease-out", color)}
                cx={size / 2}
                cy={size / 2}
                fill="none"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                strokeWidth={strokeWidth}
            />
        </svg>
    );
}

/* ─── State Badge ─────────────────────────────────────────────────── */

function StateBadge({ label, state }: { label?: string; state: ProcurementDashboardState }) {
    const rendered = label ?? humanizeState(state);
    const isPulsing = state === "setup_required" || state === "coming_soon";

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm",
                state === "available" &&
                    "border-emerald-300/80 bg-emerald-200 text-emerald-950 dark:border-emerald-800/80 dark:bg-emerald-950/80 dark:text-emerald-100",
                state === "coming_soon" &&
                    "border-sky-300/80 bg-sky-200 text-sky-950 dark:border-sky-800/80 dark:bg-sky-950/80 dark:text-sky-100",
                state === "empty" &&
                    "border-slate-300/80 bg-slate-200 text-slate-900 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100",
                state === "setup_required" &&
                    "border-amber-300/80 bg-amber-200 text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/80 dark:text-amber-100",
                state === "unavailable" &&
                    "border-slate-300/80 bg-slate-200 text-slate-900 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100",
            )}
        >
            <span
                className={cn(
                    "h-1.5 w-1.5 rounded-full bg-current",
                    isPulsing && "animate-pulse",
                )}
            />
            {rendered}
        </span>
    );
}

/* ─── Bento Card wrapper ──────────────────────────────────────────── */

function BentoCard({
    children,
    className,
    glowColor,
}: {
    children: React.ReactNode;
    className?: string;
    glowColor?: "primary" | "amber" | "emerald";
}) {
    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm backdrop-blur-sm",
                "transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md hover:border-border/80",
                glowColor === "primary" && "hover:border-primary/30",
                glowColor === "amber" && "hover:border-amber-400/30",
                glowColor === "emerald" && "hover:border-emerald-400/30",
                className,
            )}
        >
            {children}
        </div>
    );
}

/* ─── Icon container ──────────────────────────────────────────────── */

function IconBox({
    children,
    tone = "primary",
}: {
    children: React.ReactNode;
    tone?: "primary" | "muted" | "amber" | "emerald" | "info";
}) {
    return (
        <div
            className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm",
                tone === "primary" &&
                    "bg-primary text-primary-foreground shadow-primary/25",
                tone === "muted" &&
                    "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
                tone === "amber" &&
                    "bg-amber-200 text-amber-950 dark:bg-amber-950/80 dark:text-amber-100",
                tone === "emerald" &&
                    "bg-emerald-200 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-100",
                tone === "info" &&
                    "bg-sky-200 text-sky-950 dark:bg-sky-950/80 dark:text-sky-100",
            )}
        >
            {children}
        </div>
    );
}

/* ─── Main component ──────────────────────────────────────────────── */

export function ProcurementOfficerDashboard(): JSX.Element {
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<string | undefined>();
    const [countdownNow, setCountdownNow] = useState(() => Date.now());
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const snapshot = useQuery(
        api.functions.procurementOfficerDashboard.getProcurementOfficerDashboardSnapshot,
        selectedFiscalYear ? { selectedFiscalYear } : {},
    );

    useEffect(() => {
        if (!selectedFiscalYear && snapshot?.fiscalYears.selectedFiscalYear) {
            setSelectedFiscalYear(snapshot.fiscalYears.selectedFiscalYear);
        }
    }, [selectedFiscalYear, snapshot?.fiscalYears.selectedFiscalYear]);

    useEffect(() => {
        if (!snapshot?.deadlineOverview.targetAt) {
            return;
        }

        const interval = window.setInterval(() => {
            setCountdownNow(Date.now());
        }, 30_000);

        return () => window.clearInterval(interval);
    }, [snapshot?.deadlineOverview.targetAt]);

    if (!snapshot) return <ProcurementOfficerDashboardSkeleton />;

    const activeModal = normalizeProcurementOfficerWorkspaceModalState({
        modal: searchParams.get("modal"),
        section: searchParams.get("section"),
    });
    const fiscalYearLabel = snapshot.fiscalYears.selectedFiscalYear
        ? formatProcurementFiscalYearLabel(snapshot.fiscalYears.selectedFiscalYear)
        : "Fiscal year unavailable";
    const departmentsConfiguredCard = findSummaryCard(snapshot.summaryCards, "departments_configured");
    const accessCodeCard = findSummaryCard(snapshot.summaryCards, "access_code_coverage");
    const deadlineCard = findSummaryCard(snapshot.summaryCards, "deadline_readiness");
    const liveDeadlineCard =
        deadlineCard && snapshot.deadlineOverview.targetAt
            ? {
                  ...deadlineCard,
                  value:
                      snapshot.deadlineOverview.state === "available"
                          ? formatDeadlineCountdown({
                                deadlineAt: snapshot.deadlineOverview.targetAt,
                                now: countdownNow,
                            })
                          : deadlineCard.value,
              }
            : deadlineCard;
    const duCoverageCard = findSummaryCard(snapshot.summaryCards, "du_assignment_coverage");
    const requestPanel = findFuturePanel(snapshot.futurePanels, "request_inbox");
    const submissionPanel = findFuturePanel(snapshot.futurePanels, "submission_monitoring");
    const categoriesPanel = findFuturePanel(snapshot.futurePanels, "categories");
    const itemsPanel = findFuturePanel(snapshot.futurePanels, "items");
    const readyDepartmentCount = snapshot.departmentReadiness.items.filter(
        (i) => i.overallState === "available",
    ).length;
    const readinessPercent =
        snapshot.meta.selectedDepartmentCount === 0
            ? 0
            : Math.round((readyDepartmentCount / snapshot.meta.selectedDepartmentCount) * 100);
    const otherFiscalYears = snapshot.fiscalYears.options.filter(
        (y) => y !== snapshot.fiscalYears.selectedFiscalYear,
    );

    function setWorkspaceModal(
        modalState: ProcurementOfficerWorkspaceModalState | null,
        historyMode: "push" | "replace",
    ) {
        const href = modalState ? buildProcurementOfficerWorkspaceModalPath(modalState) : pathname;
        if (historyMode === "push") router.push(href);
        else router.replace(href);
    }

    function handleWorkspaceAction(href: string) {
        const target = resolveProcurementOfficerWorkspaceNavigation(href);
        if (target.type === "route") { router.push(target.href); return; }
        setWorkspaceModal(target.modalState, "push");
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background">
            {/* ── Mobile fallback ── */}
            <div className="px-4 py-8 sm:px-6 lg:hidden">
                <Card className="mx-auto max-w-2xl rounded-[24px] border-border/70 bg-card shadow-sm">
                    <CardHeader className="space-y-4">
                        <Badge className="w-fit rounded-md bg-primary text-primary-foreground hover:bg-primary">
                            Desktop required
                        </Badge>
                        <CardTitle className="text-2xl text-foreground">
                            Procurement Officer dashboards are designed for desktop viewports
                        </CardTitle>
                        <CardDescription className="text-base leading-7 text-muted-foreground">
                            This workspace follows the desktop-only platform strategy from the Procureline UX specification.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>

            {/* ── Desktop bento grid ── */}
            <div className="hidden lg:block">
                <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-none flex-col gap-3 px-4 py-4 xl:px-5">

                    {/* Row 2 — Consolidation Hub + Org Overview + Workflow Panels */}
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.56fr)_minmax(320px,0.9fr)]">

                        {/* Left column */}
                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.38fr)_minmax(280px,0.92fr)]">

                            {/* Consolidation Hub — 2×1 dominant card */}
                            <BentoCard glowColor="primary">
                                <div className="flex flex-col gap-4 p-5">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <IconBox tone="primary">
                                                <Layers3 className="h-4 w-4" />
                                            </IconBox>
                                            <span className="text-[15px] font-bold text-foreground">
                                                Consolidation Hub
                                            </span>
                                        </div>
                                        <StateBadge state={snapshot.hero.state} />
                                    </div>

                                    {/* Donut + stats */}
                                    <div className="flex items-center gap-5 rounded-xl border border-border/60 bg-muted/30 p-4">
                                        <div className="relative shrink-0">
                                            <DonutRing size={108} strokeWidth={9} value={readinessPercent} />
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-2xl font-black leading-none tracking-[-0.06em] text-foreground">
                                                    {readinessPercent}%
                                                </span>
                                                <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                                    Ready
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-3">
                                            <div>
                                                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
                                                    Current Fiscal Year
                                                </div>
                                                <div className="text-base font-bold tracking-[-0.03em] text-foreground">
                                                    {fiscalYearLabel}
                                                </div>
                                                <div className="mt-0.5 text-[12px] text-muted-foreground">
                                                    {readyDepartmentCount} of {snapshot.meta.selectedDepartmentCount} Departments Ready
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-primary via-chart-3 to-chart-4 transition-all duration-700 shadow-[0_0_6px_var(--primary)]"
                                                        style={{ width: `${readinessPercent}%` }}
                                                    />
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    Preparation completion
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CTA */}
                                    <Button asChild className="h-10 w-full rounded-xl text-sm font-semibold shadow-sm shadow-primary/20">
                                        <Link href="/po/consolidation">
                                            <Zap className="mr-2 h-4 w-4" />
                                            Open Consolidation Workspace
                                            <ArrowRight className="ml-auto h-4 w-4" />
                                        </Link>
                                    </Button>

                                    {/* Previous cycles */}
                                    <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
                                        <span className="mr-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                            Previous cycles
                                        </span>
                                        {otherFiscalYears.length === 0 ? (
                                            <span className="text-[12px] text-muted-foreground">None yet</span>
                                        ) : (
                                            otherFiscalYears.slice(0, 3).map((year) => (
                                                <button
                                                    key={year}
                                                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                                                    onClick={() => startTransition(() => setSelectedFiscalYear(year))}
                                                    type="button"
                                                >
                                                    {formatProcurementFiscalYearLabel(year)}
                                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </BentoCard>

                            {/* Organization Overview */}
                            <BentoCard>
                                <div className="flex flex-col gap-3 p-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <IconBox tone="muted">
                                                <Building2 className="h-4 w-4" />
                                            </IconBox>
                                            <span className="text-[14px] font-bold text-foreground">
                                                Organization
                                            </span>
                                        </div>
                                        <StateBadge
                                            state={snapshot.fiscalYears.state}
                                            label={
                                                snapshot.fiscalYears.state === "available"
                                                    ? fiscalYearLabel
                                                    : "Not configured"
                                            }
                                        />
                                    </div>

                                    {/* Tenant */}
                                    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-black tracking-[-0.04em] text-primary-foreground shadow-sm shadow-primary/20">
                                            {getInitials(snapshot.meta.tenantName)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold tracking-[-0.02em] text-foreground">
                                                {snapshot.meta.tenantName}
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                <MapPin className="h-3 w-3" />
                                                Procurement workspace
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[12px] font-semibold text-foreground">
                                                Preparation
                                            </span>
                                            <span className="text-lg font-black tracking-[-0.04em] text-primary">
                                                {readinessPercent}%
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-primary transition-all duration-700"
                                                style={{ width: `${readinessPercent}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>Ready: {readyDepartmentCount} depts</span>
                                            <span>{fiscalYearLabel}</span>
                                        </div>
                                    </div>

                                    {departmentsConfiguredCard && accessCodeCard && deadlineCard ? (
                                        <div className="space-y-2">
                                            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                                Workspace signals
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <OrganizationStatPill
                                                    card={departmentsConfiguredCard}
                                                    icon={<Building2 className="h-3.5 w-3.5" />}
                                                    tone="primary"
                                                />
                                                <OrganizationStatPill
                                                    card={accessCodeCard}
                                                    icon={<KeyRound className="h-3.5 w-3.5" />}
                                                    tone="amber"
                                                />
                                                <OrganizationStatPill
                                                    card={liveDeadlineCard ?? deadlineCard}
                                                    icon={<CalendarClock className="h-3.5 w-3.5" />}
                                                    tone="emerald"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            <MiniStat label="Departments" value={String(snapshot.meta.selectedDepartmentCount)} />
                                            <MiniStat label="DU Coverage" value={duCoverageCard?.value ?? "--"} />
                                            <MiniStat
                                                label="Alerts"
                                                value={String(snapshot.alerts.length)}
                                                highlight={snapshot.alerts.length > 0}
                                            />
                                        </div>
                                    )}
                                </div>
                            </BentoCard>

                            {/* Department Management — full width */}
                            <BentoCard className="xl:col-span-2">
                                <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
                                    <div className="flex items-center gap-2.5">
                                        <IconBox tone="primary">
                                            <Users2 className="h-4 w-4" />
                                        </IconBox>
                                        <div>
                                            <div className="text-[14px] font-bold text-foreground">
                                                Department Management
                                            </div>
                                            <div className="text-[11px] text-muted-foreground">
                                                {snapshot.departmentReadiness.summary}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        className="h-8 rounded-lg text-xs"
                                        onClick={() => handleWorkspaceAction("/po/departments")}
                                        type="button"
                                    >
                                        Open departments
                                    </Button>
                                </div>

                                {snapshot.departmentReadiness.items.length === 0 ? (
                                    <div className="p-5">
                                        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
                                            <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                                            <div className="text-sm font-medium text-muted-foreground">
                                                Department readiness appears here once active departments exist.
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full border-separate border-spacing-0">
                                            <thead>
                                                <tr className="bg-muted/20">
                                                    {["Department", "Vote #", "Readiness", "Coverage", "Actions"].map((h, i) => (
                                                        <th
                                                            key={h}
                                                            className={cn(
                                                                "border-b border-border/60 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground",
                                                                i === 0 && "text-left",
                                                                i === 4 && "text-right",
                                                            )}
                                                        >
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {snapshot.departmentReadiness.items.slice(0, 6).map((item) => (
                                                    <DepartmentReadinessRow
                                                        key={item.id}
                                                        item={item}
                                                        onManageDepartment={() => handleWorkspaceAction("/po/departments")}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </BentoCard>
                        </div>

                        {/* Right column — Workflow Panels */}
                        <BentoCard className="flex flex-col">
                            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
                                <div className="flex items-center gap-2.5">
                                    <IconBox tone="info">
                                        <FileStack className="h-4 w-4" />
                                    </IconBox>
                                    <span className="text-[14px] font-bold text-foreground">
                                        Workflow Panels
                                    </span>
                                </div>
                                {submissionPanel ? (
                                    <StateBadge state={submissionPanel.state} label={submissionPanel.statusLabel} />
                                ) : null}
                            </div>

                            <div className="flex flex-1 flex-col gap-3 p-4">
                                {/* Review Center */}
                                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="text-[13px] font-semibold text-foreground">
                                            Review Center
                                        </div>
                                        {requestPanel ? (
                                            <StateBadge state={requestPanel.state} label={requestPanel.statusLabel} />
                                        ) : null}
                                    </div>
                                    <div className="space-y-2">
                                        {[requestPanel, submissionPanel]
                                            .filter((p): p is ProcurementOfficerDashboardFuturePanel => Boolean(p))
                                            .map((panel) => (
                                                <WorkflowPanelButton
                                                    key={panel.id}
                                                    panel={panel}
                                                    onClick={() => handleWorkspaceAction(panel.cta.href)}
                                                />
                                            ))}
                                    </div>
                                </div>

                                {/* Categories & Items */}
                                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                <FolderTree className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="text-[13px] font-semibold text-foreground">
                                                Categories & Items
                                            </div>
                                        </div>
                                        {categoriesPanel ? (
                                            <StateBadge state={categoriesPanel.state} label={categoriesPanel.statusLabel} />
                                        ) : null}
                                    </div>
                                    <div className="space-y-2">
                                        {categoriesPanel ? (
                                            <WorkflowPanelButton
                                                panel={categoriesPanel}
                                                onClick={() => handleWorkspaceAction(categoriesPanel.cta.href)}
                                            />
                                        ) : null}
                                        {itemsPanel ? (
                                            <WorkflowPanelButton
                                                panel={{ ...itemsPanel, label: "Items" }}
                                                onClick={() => handleWorkspaceAction(itemsPanel.cta.href)}
                                            />
                                        ) : null}
                                    </div>
                                </div>

                                {/* Access Codes quick link */}
                                <div className="mt-auto rounded-xl border border-border/60 bg-muted/20 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-amber-300/70 bg-amber-200 text-amber-950 shadow-sm dark:border-amber-300/25 dark:bg-amber-400/20 dark:text-amber-50">
                                                <KeyRound className="h-3.5 w-3.5" />
                                            </div>
                                            <span className="text-[12px] font-semibold text-foreground">
                                                Access Codes
                                            </span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-[11px] text-primary hover:text-primary"
                                            onClick={() => handleWorkspaceAction("/po/access-codes")}
                                            type="button"
                                        >
                                            Manage
                                            <ArrowRight className="ml-1 h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Deadlines quick link */}
                                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "flex h-7 w-7 items-center justify-center rounded-xl border shadow-sm",
                                                snapshot.alerts.some(a => a.id === "deadline")
                                                    ? "border-rose-300/70 bg-rose-200 text-rose-950 dark:border-rose-300/25 dark:bg-rose-400/20 dark:text-rose-50"
                                                    : "border-emerald-300/70 bg-emerald-200 text-emerald-950 dark:border-emerald-300/25 dark:bg-emerald-400/20 dark:text-emerald-50"
                                            )}>
                                                {snapshot.alerts.some(a => a.id === "deadline")
                                                    ? <AlertTriangle className="h-3.5 w-3.5" />
                                                    : <CheckCircle2 className="h-3.5 w-3.5" />
                                                }
                                            </div>
                                            <span className="text-[12px] font-semibold text-foreground">
                                                Deadlines
                                            </span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-[11px] text-primary hover:text-primary"
                                            onClick={() => handleWorkspaceAction("/po/deadlines")}
                                            type="button"
                                        >
                                            Review
                                            <ArrowRight className="ml-1 h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </BentoCard>
                    </div>
                </div>
            </div>

            {/* Workspace modal */}
                <WorkspaceModal
                    activeModal={activeModal}
                    categoriesPanel={categoriesPanel}
                    itemsPanel={itemsPanel}
                    requestPanel={requestPanel}
                    submissionPanel={submissionPanel}
                    selectedFiscalYear={selectedFiscalYear}
                    onSelectedFiscalYearChange={(fiscalYear) =>
                        startTransition(() => setSelectedFiscalYear(fiscalYear))
                    }
                onCategorySectionChange={(section) =>
                    setWorkspaceModal(
                        { modal: "categories", ...(section ? { section } : {}) },
                        "replace",
                    )
                }
                onClose={() => setWorkspaceModal(null, "replace")}
            />
        </div>
    );
}

/* ─── Organization summary pill ───────────────────────────────────── */

function OrganizationStatPill({
    card,
    icon,
    tone,
}: {
    card: ProcurementOfficerDashboardSummaryCard;
    icon: React.ReactNode;
    tone: "primary" | "amber" | "emerald";
}) {
    return (
        <div className="flex min-w-[11rem] flex-1 items-center gap-2 rounded-full border border-border/60 bg-muted/25 px-3 py-2">
            <div
                className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    tone === "primary" && "bg-primary text-primary-foreground",
                    tone === "amber" &&
                        "bg-amber-200 text-amber-950 dark:bg-amber-950/80 dark:text-amber-100",
                    tone === "emerald" &&
                        "bg-emerald-200 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-100",
                )}
            >
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {card.label}
                </div>
                <div className="truncate text-[12px] font-semibold tracking-[-0.02em] text-foreground">
                    {card.value}
                </div>
            </div>
            <span
                className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    card.state === "available" && "bg-emerald-500",
                    card.state === "coming_soon" && "bg-primary",
                    card.state === "setup_required" && "bg-amber-500",
                    (card.state === "empty" || card.state === "unavailable") && "bg-muted-foreground/50",
                )}
            />
        </div>
    );
}

/* ─── Mini stat cell ──────────────────────────────────────────────── */

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5 text-center">
            <div className={cn("text-lg font-black tracking-[-0.04em]", highlight ? "text-rose-500" : "text-foreground")}>
                {value}
            </div>
            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {label}
            </div>
        </div>
    );
}

/* ─── Workflow panel button ───────────────────────────────────────── */

function WorkflowPanelButton({
    panel,
    onClick,
}: {
    panel: ProcurementOfficerDashboardFuturePanel;
    onClick: () => void;
}) {
    return (
        <button
            className="group flex w-full items-start justify-between gap-3 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-left transition hover:border-primary/30 hover:bg-primary/5"
            onClick={onClick}
            type="button"
        >
            <div className="min-w-0">
                <div className="text-[12px] font-semibold text-foreground">{panel.label}</div>
                <div className="mt-0.5 line-clamp-2 text-[10px] leading-[1.4] text-muted-foreground">
                    {panel.description}
                </div>
            </div>
            <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
        </button>
    );
}

/* ─── Department Readiness Row ────────────────────────────────────── */

function DepartmentReadinessRow({
    item,
    onManageDepartment,
}: {
    item: ProcurementOfficerDashboardDepartmentReadinessItem;
    onManageDepartment: () => void;
}) {
    return (
        <tr className="transition hover:bg-muted/20">
            <td className="border-b border-border/50 px-4 py-2.5 text-left">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-[10px] font-bold uppercase text-muted-foreground">
                        {getInitials(item.name)}
                    </div>
                    <div>
                        <div className="text-[13px] font-semibold text-foreground">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground">{item.blockerSummary}</div>
                    </div>
                </div>
            </td>
            <td className="border-b border-border/50 px-4 py-2.5 text-center">
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {item.code}
                </span>
            </td>
            <td className="border-b border-border/50 px-4 py-2.5 text-center">
                <div className="space-y-1.5">
                    <StateBadge state={item.overallState} />
                    <Progress value={item.progressValue} className="h-1 bg-muted" />
                </div>
            </td>
            <td className="border-b border-border/50 px-4 py-2.5 text-center">
                <div className="space-y-1">
                    <InlineStatePill label="Access" state={item.accessCode.state} value={item.accessCode.label} />
                    <InlineStatePill label="DU" state={item.departmentUser.state} value={item.departmentUser.label} />
                    <InlineStatePill label="Deadline" state={item.deadline.state} value={item.deadline.label} />
                </div>
            </td>
            <td className="border-b border-border/50 px-4 py-2.5 text-right">
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] text-primary hover:text-primary"
                    onClick={onManageDepartment}
                    type="button"
                >
                    Manage
                    <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
            </td>
        </tr>
    );
}

function InlineStatePill({ label, state, value }: { label: string; state: ProcurementDashboardState; value: string }) {
    return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-2 py-1 text-[10px]">
            <span className="text-muted-foreground">{label}</span>
            <StateBadge state={state} label={value} />
        </div>
    );
}

/* ─── Workspace Modal ─────────────────────────────────────────────── */

function WorkspaceModal({
    activeModal,
    categoriesPanel,
    itemsPanel,
    requestPanel,
    selectedFiscalYear,
    submissionPanel,
    onSelectedFiscalYearChange,
    onCategorySectionChange,
    onClose,
}: {
    activeModal: ProcurementOfficerWorkspaceModalState | null;
    categoriesPanel?: ProcurementOfficerDashboardFuturePanel;
    itemsPanel?: ProcurementOfficerDashboardFuturePanel;
    requestPanel?: ProcurementOfficerDashboardFuturePanel;
    selectedFiscalYear?: string;
    submissionPanel?: ProcurementOfficerDashboardFuturePanel;
    onSelectedFiscalYearChange: (fiscalYear: string) => void;
    onCategorySectionChange: (section?: ProcurementOfficerWorkspaceSection) => void;
    onClose: () => void;
}): JSX.Element {
    const activeTab =
        activeModal?.modal === "categories" && activeModal.section === "items" ? "items" : "categories";

    return (
        <Dialog open={Boolean(activeModal)} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl overflow-hidden border-border/70 p-0 sm:rounded-[28px]">
                <div className="border-b border-border/70 bg-muted/35 px-6 py-5">
                    <DialogHeader className="space-y-3 text-left">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                {getWorkspaceIcon(activeModal?.modal ?? "departments")}
                            </div>
                            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-primary">
                                Procurement workspace
                            </Badge>
                        </div>
                        <DialogTitle className="text-2xl tracking-[-0.04em] text-foreground">
                            {getWorkspaceTitle(activeModal)}
                        </DialogTitle>
                        <DialogDescription className="max-w-3xl text-sm leading-7 text-muted-foreground">
                            {getWorkspaceDescription(activeModal)}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
                    {activeModal?.modal === "departments" ? (
                        <ProcurementOfficerDepartmentsWorkspace />
                    ) : null}

                    {activeModal?.modal === "requests" ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {[requestPanel, submissionPanel]
                                .filter((p): p is ProcurementOfficerDashboardFuturePanel => Boolean(p))
                                .map((panel) => (
                                    <div key={panel.id} className="rounded-2xl border border-border/70 bg-card p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="font-semibold text-foreground">{panel.label}</div>
                                                <div className="mt-2 text-sm leading-6 text-muted-foreground">{panel.description}</div>
                                            </div>
                                            <StateBadge state={panel.state} label={panel.statusLabel} />
                                        </div>
                                    </div>
                                ))}
                        </div>
                    ) : null}

                    {activeModal?.modal === "categories" ? (
                        <Tabs value={activeTab} onValueChange={(v) => onCategorySectionChange(v === "items" ? "items" : undefined)}>
                            <TabsList className="h-auto rounded-full border border-border/70 bg-card p-1">
                                <TabsTrigger className="rounded-full px-4 py-2" value="categories">Categories</TabsTrigger>
                                <TabsTrigger className="rounded-full px-4 py-2" value="items">Items</TabsTrigger>
                            </TabsList>
                            <TabsContent className="mt-4 space-y-4" value="categories">
                                <ModalMetricCard label="Status" value={categoriesPanel?.statusLabel ?? "Later story"} />
                                <EmptyWorkspaceState
                                    body={categoriesPanel?.description ?? "Category management stays staged until the catalog story lands."}
                                    title={categoriesPanel?.label ?? "Categories"}
                                />
                            </TabsContent>
                            <TabsContent className="mt-4 space-y-4" value="items">
                                <ModalMetricCard label="Status" value={itemsPanel?.statusLabel ?? "Later story"} />
                                <EmptyWorkspaceState
                                    body={itemsPanel?.description ?? "Items now live under categories."}
                                    title={itemsPanel?.label ?? "Items"}
                                />
                            </TabsContent>
                        </Tabs>
                    ) : null}

                    {activeModal?.modal === "access-codes" ? (
                        <ProcurementOfficerAccessCodesWorkspace />
                    ) : null}

                    {activeModal?.modal === "deadlines" ? (
                        <ProcurementOfficerDeadlinesWorkspace
                            onSelectedFiscalYearChange={onSelectedFiscalYearChange}
                            selectedFiscalYear={selectedFiscalYear}
                        />
                    ) : null}

                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ─── Small sub-components ────────────────────────────────────────── */

function EmptyWorkspaceState({ body, title }: { body: string; title: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5">
            <div className="font-semibold text-foreground">{title}</div>
            <div className="mt-2 text-sm leading-6 text-muted-foreground">{body}</div>
        </div>
    );
}

function ModalMetricCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            <div className="mt-3 text-xl font-black tracking-[-0.04em] text-foreground">{value}</div>
        </div>
    );
}

/* ─── Skeleton ────────────────────────────────────────────────────── */

function ProcurementOfficerDashboardSkeleton() {
    return (
        <div className="mx-auto hidden w-full max-w-none gap-3 px-4 py-4 lg:flex lg:flex-col xl:px-5">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.56fr)_minmax(320px,0.9fr)]">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.38fr)_minmax(280px,0.92fr)]">
                    <Skeleton className="h-72 rounded-2xl" />
                    <Skeleton className="h-72 rounded-2xl" />
                    <Skeleton className="h-56 rounded-2xl xl:col-span-2" />
                </div>
                <Skeleton className="h-[34rem] rounded-2xl" />
            </div>
        </div>
    );
}

/* ─── Utilities ───────────────────────────────────────────────────── */

function findSummaryCard(
    cards: ProcurementOfficerDashboardSummaryCard[],
    id: ProcurementOfficerDashboardSummaryCard["id"],
) {
    return cards.find((c) => c.id === id);
}

function findFuturePanel(
    panels: ProcurementOfficerDashboardFuturePanel[],
    id: ProcurementOfficerDashboardFuturePanel["id"],
) {
    return panels.find((p) => p.id === id);
}

function getWorkspaceIcon(modal: ProcurementOfficerWorkspaceModalState["modal"]) {
    if (modal === "requests") return <FileStack className="h-5 w-5" />;
    if (modal === "categories") return <FolderTree className="h-5 w-5" />;
    if (modal === "access-codes") return <KeyRound className="h-5 w-5" />;
    if (modal === "deadlines") return <CalendarClock className="h-5 w-5" />;
    return <Building2 className="h-5 w-5" />;
}

function getWorkspaceTitle(activeModal: ProcurementOfficerWorkspaceModalState | null): string {
    switch (activeModal?.modal) {
        case "requests": return "Requests workspace";
        case "categories": return activeModal.section === "items" ? "Categories and items workspace" : "Categories workspace";
        case "access-codes": return "Access-code management";
        case "deadlines": return "Deadline readiness";
        default: return "Departments workspace";
    }
}

function getWorkspaceDescription(activeModal: ProcurementOfficerWorkspaceModalState | null): string {
    switch (activeModal?.modal) {
        case "requests": return "Request inbox and submission monitoring now open as a dashboard modal, keeping the PO flow in one place until the live queue stories land.";
        case "categories": return activeModal.section === "items" ? "Items are nested under categories on purpose, so the dashboard stays tighter and the catalog story can grow in one workspace." : "Categories now open inside the dashboard, with items folded into the same workspace instead of taking their own card.";
        case "access-codes": return "Access-code management now runs as a real dashboard workspace, so you can generate, rotate, deactivate, email, and review bounded login history without leaving the /po shell.";
        case "deadlines": return "Deadline warnings now resolve inside the dashboard, keeping fiscal-year signals, alerts, and department readiness in one flow.";
        default: return "Create, edit, and review department readiness inside the dashboard modal.";
    }
}

function humanizeState(state: ProcurementDashboardState): string {
    switch (state) {
        case "available": return "Ready";
        case "coming_soon": return "Coming soon";
        case "empty": return "Empty";
        case "setup_required": return "Setup required";
        default: return "Unavailable";
    }
}

function getInitials(value: string): string {
    const initials = value
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
    return initials || "PO";
}
