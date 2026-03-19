"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import {
    ArrowRight,
    ArrowUpRight,
    Building2,
    CalendarClock,
    ChevronRight,
    FileStack,
    FolderTree,
    KeyRound,
    Layers3,
    MapPin,
    Users2,
} from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    ProcurementOfficerDashboardSnapshot,
    ProcurementOfficerDashboardSummaryCard,
} from "@/lib/procurement-officer/dashboard-snapshot";
import { cn } from "@/lib/utils";

export function ProcurementOfficerDashboard(): JSX.Element {
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<string | undefined>();
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

    if (!snapshot) {
        return <ProcurementOfficerDashboardSkeleton />;
    }

    const activeModal = normalizeProcurementOfficerWorkspaceModalState({
        modal: searchParams.get("modal"),
        section: searchParams.get("section"),
    });
    const fiscalYearLabel = snapshot.fiscalYears.selectedFiscalYear
        ? formatProcurementFiscalYearLabel(snapshot.fiscalYears.selectedFiscalYear)
        : "Fiscal year unavailable";
    const departmentsConfiguredCard = findSummaryCard(
        snapshot.summaryCards,
        "departments_configured",
    );
    const accessCodeCard = findSummaryCard(snapshot.summaryCards, "access_code_coverage");
    const deadlineCard = findSummaryCard(snapshot.summaryCards, "deadline_readiness");
    const duCoverageCard = findSummaryCard(snapshot.summaryCards, "du_assignment_coverage");
    const requestPanel = findFuturePanel(snapshot.futurePanels, "request_inbox");
    const submissionPanel = findFuturePanel(
        snapshot.futurePanels,
        "submission_monitoring",
    );
    const categoriesPanel = findFuturePanel(snapshot.futurePanels, "categories");
    const itemsPanel = findFuturePanel(snapshot.futurePanels, "items");
    const readyDepartmentCount = snapshot.departmentReadiness.items.filter(
        (item) => item.overallState === "available",
    ).length;
    const readinessPercent =
        snapshot.meta.selectedDepartmentCount === 0
            ? 0
            : Math.round(
                  (readyDepartmentCount / snapshot.meta.selectedDepartmentCount) * 100,
              );
    const otherFiscalYears = snapshot.fiscalYears.options.filter(
        (year) => year !== snapshot.fiscalYears.selectedFiscalYear,
    );

    function setWorkspaceModal(
        modalState: ProcurementOfficerWorkspaceModalState | null,
        historyMode: "push" | "replace",
    ): void {
        const href = modalState
            ? buildProcurementOfficerWorkspaceModalPath(modalState)
            : pathname;

        if (historyMode === "push") {
            router.push(href);
            return;
        }

        router.replace(href);
    }

    function handleWorkspaceAction(href: string): void {
        const target = resolveProcurementOfficerWorkspaceNavigation(href);
        if (target.type === "route") {
            router.push(target.href);
            return;
        }
        setWorkspaceModal(target.modalState, "push");
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
                            Procurement Officer dashboards are designed for desktop viewports
                        </CardTitle>
                        <CardDescription className="text-base leading-7 text-muted-foreground">
                            This workspace follows the desktop-only platform strategy from the
                            Procureline UX specification.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>

            <div className="hidden min-h-[calc(100vh-4rem)] overflow-y-auto lg:block">
                <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-none flex-col gap-3 px-3 py-3 xl:px-4">
                    {departmentsConfiguredCard && accessCodeCard && deadlineCard ? (
                        <UnifiedStatsCard
                            sections={[
                                {
                                    card: departmentsConfiguredCard,
                                    icon: <Building2 className="h-5 w-5" />,
                                    meta: `${snapshot.meta.activeDepartmentCount} active across the workspace`,
                                    tone: "primary",
                                },
                                {
                                    card: accessCodeCard,
                                    icon: <KeyRound className="h-5 w-5" />,
                                    meta:
                                        snapshot.meta.selectedDepartmentCount === 0
                                            ? "Available after departments exist"
                                            : `${snapshot.meta.selectedDepartmentCount} department scope in ${fiscalYearLabel}`,
                                    tone: "warning",
                                },
                                {
                                    card: deadlineCard,
                                    icon: <CalendarClock className="h-5 w-5" />,
                                    meta: snapshot.alerts.some((alert) => alert.id === "deadline")
                                        ? "Shared deadline still needs setup"
                                        : "Shared submission window can be trusted",
                                    tone: "success",
                                },
                            ]}
                        />
                    ) : null}

                    <section className="grid gap-3 xl:grid-cols-[minmax(0,1.62fr)_minmax(300px,0.82fr)]">
                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.48fr)_minmax(280px,0.82fr)]">
                            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                                <CardContent className="flex flex-col gap-3 p-4">
                                    <div className="flex items-center justify-between border-b border-border/70 pb-3">
                                        <div className="flex items-center gap-2.5 text-[15px] font-bold text-foreground">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                                                <Layers3 className="h-4 w-4" />
                                            </div>
                                            Consolidation Hub
                                        </div>
                                        <StateBadge state={snapshot.hero.state} />
                                    </div>

                                    <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                                                    Current Fiscal Year
                                                </div>
                                                <div className="mt-1.5 text-lg font-bold text-foreground">
                                                    {fiscalYearLabel}
                                                </div>
                                                <div className="mt-1 text-[13px] text-muted-foreground">
                                                    {readyDepartmentCount} of {snapshot.meta.selectedDepartmentCount} Departments Ready
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-3xl font-black leading-none text-primary">
                                                    {readinessPercent}%
                                                </div>
                                                <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                                    Complete
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-primary to-chart-4 transition-all duration-500"
                                                style={{ width: `${readinessPercent}%` }}
                                            />
                                        </div>
                                        <Button asChild className="mt-3 h-9 w-full rounded-xl text-sm">
                                            <Link href="/po/consolidation">
                                                Open Consolidation Workspace
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </div>

                                    <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-3">
                                        <div className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                            Previous cycles
                                        </div>
                                        {otherFiscalYears.length === 0 ? (
                                            <span className="text-[13px] text-muted-foreground">
                                                None yet
                                            </span>
                                        ) : (
                                            otherFiscalYears.slice(0, 3).map((year) => (
                                                <button
                                                    key={year}
                                                    className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1.5 text-[12px] font-medium text-foreground transition hover:border-primary/30 hover:bg-muted/20"
                                                    onClick={() =>
                                                        startTransition(() => {
                                                            setSelectedFiscalYear(year);
                                                        })
                                                    }
                                                    type="button"
                                                >
                                                    {formatProcurementFiscalYearLabel(year)}
                                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                                <CardContent className="flex flex-col gap-3 p-4">
                                    <div className="flex items-center justify-between border-b border-border/70 pb-3">
                                        <div className="flex items-center gap-2.5 text-[15px] font-bold text-foreground">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shadow-sm">
                                                <Building2 className="h-4 w-4" />
                                            </div>
                                            Organization Overview
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

                                    <div className="flex items-center gap-3 border-b border-border/70 pb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-base font-black tracking-[-0.04em] text-primary-foreground shadow-sm">
                                                {getInitials(snapshot.meta.tenantName)}
                                            </div>
                                            <div>
                                                <div className="text-base font-bold tracking-[-0.03em] text-foreground">
                                                    {snapshot.meta.tenantName}
                                                </div>
                                                <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                                                    <MapPin className="h-3 w-3" />
                                                    Procurement workspace overview
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        <div className="flex items-end justify-between gap-4">
                                            <div className="text-[13px] font-semibold text-foreground">
                                                Preparation completion
                                            </div>
                                            <div className="text-xl font-black tracking-[-0.04em] text-primary">
                                                {readinessPercent}%
                                            </div>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-primary transition-all duration-500"
                                                style={{ width: `${readinessPercent}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                            <span>Ready: {readyDepartmentCount} departments</span>
                                            <span>{fiscalYearLabel}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <OverviewMiniStat label="Departments" value={String(snapshot.meta.selectedDepartmentCount)} />
                                        <OverviewMiniStat label="DU Coverage" value={duCoverageCard?.value ?? "--"} />
                                        <OverviewMiniStat label="Alerts" value={String(snapshot.alerts.length)} />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-2">
                                <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/70 px-4 py-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2.5 text-base font-bold tracking-[-0.03em] text-foreground">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                                                <Users2 className="h-4 w-4" />
                                            </div>
                                            Department Management
                                        </div>
                                        <CardDescription className="text-xs leading-5 text-muted-foreground">
                                            {snapshot.departmentReadiness.summary}
                                        </CardDescription>
                                    </div>
                                    <Button
                                        className="h-9 rounded-lg text-sm"
                                        onClick={() => handleWorkspaceAction("/po/departments")}
                                        type="button"
                                    >
                                        Open departments
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {snapshot.departmentReadiness.items.length === 0 ? (
                                        <div className="p-4">
                                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">
                                                Department readiness appears here once active departments exist.
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full border-separate border-spacing-0">
                                                <thead>
                                                    <tr className="bg-muted/30 text-left">
                                                        <th className="rounded-tl-xl border-b-2 border-border/70 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                                            Department
                                                        </th>
                                                        <th className="border-b-2 border-border/70 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                                            Vote #
                                                        </th>
                                                        <th className="border-b-2 border-border/70 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                                            Readiness
                                                        </th>
                                                        <th className="border-b-2 border-border/70 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                                            Coverage
                                                        </th>
                                                        <th className="rounded-tr-xl border-b-2 border-border/70 px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                                            Actions
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {snapshot.departmentReadiness.items.slice(0, 5).map((item) => (
                                                        <DepartmentReadinessRow
                                                            key={item.id}
                                                            compact
                                                            item={item}
                                                            onManageDepartment={() =>
                                                                handleWorkspaceAction("/po/departments")
                                                            }
                                                        />
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                        </div>

                        <div className="grid">
                            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                                <CardHeader className="space-y-2 border-b border-border/70 px-4 py-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2.5 text-[15px] font-bold text-foreground">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                <FileStack className="h-4 w-4" />
                                            </div>
                                            Workflow Panels
                                        </div>
                                        {submissionPanel ? (
                                            <StateBadge
                                                state={submissionPanel.state}
                                                label={submissionPanel.statusLabel}
                                            />
                                        ) : null}
                                    </div>
                                </CardHeader>
                                <CardContent className="grid gap-2.5 p-3.5">
                                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-3.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="font-semibold text-foreground">
                                                Review Center
                                            </div>
                                            {requestPanel ? (
                                                <StateBadge
                                                    state={requestPanel.state}
                                                    label={requestPanel.statusLabel}
                                                />
                                            ) : null}
                                        </div>
                                        <div className="mt-2.5 space-y-2">
                                            {[requestPanel, submissionPanel]
                                                .filter(
                                                    (
                                                        panel,
                                                    ): panel is ProcurementOfficerDashboardFuturePanel =>
                                                        Boolean(panel),
                                                )
                                                .map((panel) => (
                                                    <button
                                                        key={panel.id}
                                                        className="flex w-full items-start justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left transition hover:border-primary/30 hover:bg-muted/20"
                                                        onClick={() => handleWorkspaceAction(panel.cta.href)}
                                                        type="button"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="text-[13px] font-medium text-foreground">
                                                                {panel.label}
                                                            </div>
                                                            <div className="mt-0.5 text-[11px] leading-4.5 text-muted-foreground">
                                                                {panel.description}
                                                            </div>
                                                        </div>
                                                        <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                    </button>
                                                ))}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-3.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                    <FolderTree className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="text-[13px] font-semibold text-foreground">
                                                    Categories and Items
                                                </div>
                                            </div>
                                            {categoriesPanel ? (
                                                <StateBadge
                                                    state={categoriesPanel.state}
                                                    label={categoriesPanel.statusLabel}
                                                />
                                            ) : null}
                                        </div>
                                        <div className="mt-2.5 space-y-2">
                                            {categoriesPanel ? (
                                                <button
                                                    className="flex w-full items-start justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left transition hover:border-primary/30 hover:bg-muted/20"
                                                    onClick={() => handleWorkspaceAction(categoriesPanel.cta.href)}
                                                    type="button"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-[13px] font-medium text-foreground">
                                                            {categoriesPanel.label}
                                                        </div>
                                                        <div className="mt-0.5 text-[11px] leading-4.5 text-muted-foreground">
                                                            {categoriesPanel.description}
                                                        </div>
                                                    </div>
                                                    <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                </button>
                                            ) : null}
                                            {itemsPanel ? (
                                                <button
                                                    className="flex w-full items-start justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left transition hover:border-primary/30 hover:bg-muted/20"
                                                    onClick={() => handleWorkspaceAction(itemsPanel.cta.href)}
                                                    type="button"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-[13px] font-medium text-foreground">
                                                            Items
                                                        </div>
                                                        <div className="mt-0.5 text-[11px] leading-4.5 text-muted-foreground">
                                                            Open the items section inside categories.
                                                        </div>
                                                    </div>
                                                    <StateBadge
                                                        state={itemsPanel.state}
                                                        label={itemsPanel.statusLabel}
                                                    />
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </section>
                </div>
            </div>

            <WorkspaceModal
                accessCodeCard={accessCodeCard}
                activeModal={activeModal}
                categoriesPanel={categoriesPanel}
                deadlineCard={deadlineCard}
                departmentsConfiguredCard={departmentsConfiguredCard}
                duCoverageCard={duCoverageCard}
                fiscalYearLabel={fiscalYearLabel}
                itemsPanel={itemsPanel}
                readyDepartmentCount={readyDepartmentCount}
                requestPanel={requestPanel}
                snapshot={snapshot}
                submissionPanel={submissionPanel}
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

function WorkspaceModal({
    accessCodeCard,
    activeModal,
    categoriesPanel,
    deadlineCard,
    departmentsConfiguredCard,
    duCoverageCard,
    fiscalYearLabel,
    itemsPanel,
    readyDepartmentCount,
    requestPanel,
    snapshot,
    submissionPanel,
    onCategorySectionChange,
    onClose,
}: {
    accessCodeCard?: ProcurementOfficerDashboardSummaryCard;
    activeModal: ProcurementOfficerWorkspaceModalState | null;
    categoriesPanel?: ProcurementOfficerDashboardFuturePanel;
    deadlineCard?: ProcurementOfficerDashboardSummaryCard;
    departmentsConfiguredCard?: ProcurementOfficerDashboardSummaryCard;
    duCoverageCard?: ProcurementOfficerDashboardSummaryCard;
    fiscalYearLabel: string;
    itemsPanel?: ProcurementOfficerDashboardFuturePanel;
    readyDepartmentCount: number;
    requestPanel?: ProcurementOfficerDashboardFuturePanel;
    snapshot: ProcurementOfficerDashboardSnapshot;
    submissionPanel?: ProcurementOfficerDashboardFuturePanel;
    onCategorySectionChange: (section?: ProcurementOfficerWorkspaceSection) => void;
    onClose: () => void;
}): JSX.Element {
    const topDepartments = snapshot.departmentReadiness.items.slice(0, 4);
    const activeTab =
        activeModal?.modal === "categories" && activeModal.section === "items"
            ? "items"
            : "categories";

    return (
        <Dialog open={Boolean(activeModal)} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl overflow-hidden border-border/70 p-0 sm:rounded-[28px]">
                <div className="border-b border-border/70 bg-muted/35 px-6 py-5">
                    <DialogHeader className="space-y-3 text-left">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                {getWorkspaceIcon(activeModal?.modal ?? "departments")}
                            </div>
                            <Badge
                                variant="outline"
                                className="rounded-full border-primary/20 bg-primary/10 text-primary"
                            >
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
                        <>
                            <div className="grid gap-3 md:grid-cols-4">
                                <ModalMetricCard label="In scope" value={departmentsConfiguredCard?.value ?? "0"} />
                                <ModalMetricCard label="Ready" value={String(readyDepartmentCount)} />
                                <ModalMetricCard label="DU coverage" value={duCoverageCard?.value ?? "--"} />
                                <ModalMetricCard label="Fiscal year" value={fiscalYearLabel} />
                            </div>
                            {topDepartments.length > 0 ? (
                                <div className="space-y-3">
                                    {topDepartments.map((item) => (
                                        <CompactDepartmentCard key={item.id} item={item} />
                                    ))}
                                </div>
                            ) : (
                                <EmptyWorkspaceState
                                    body="No active departments are configured yet, so the dashboard keeps this workspace focused on the first setup step."
                                    title="No departments yet"
                                />
                            )}
                        </>
                    ) : null}

                    {activeModal?.modal === "requests" ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {[requestPanel, submissionPanel]
                                .filter(
                                    (
                                        panel,
                                    ): panel is ProcurementOfficerDashboardFuturePanel =>
                                        Boolean(panel),
                                )
                                .map((panel) => (
                                    <div
                                        key={panel.id}
                                        className="rounded-2xl border border-border/70 bg-card p-5"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="font-semibold text-foreground">
                                                    {panel.label}
                                                </div>
                                                <div className="mt-2 text-sm leading-6 text-muted-foreground">
                                                    {panel.description}
                                                </div>
                                            </div>
                                            <StateBadge state={panel.state} label={panel.statusLabel} />
                                        </div>
                                    </div>
                                ))}
                        </div>
                    ) : null}

                    {activeModal?.modal === "categories" ? (
                        <Tabs value={activeTab} onValueChange={(value) => onCategorySectionChange(value === "items" ? "items" : undefined)}>
                            <TabsList className="h-auto rounded-full border border-border/70 bg-card p-1">
                                <TabsTrigger className="rounded-full px-4 py-2" value="categories">
                                    Categories
                                </TabsTrigger>
                                <TabsTrigger className="rounded-full px-4 py-2" value="items">
                                    Items
                                </TabsTrigger>
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
                                    body={itemsPanel?.description ?? "Items now live under categories so the dashboard does not waste a separate destination on a placeholder flow."}
                                    title={itemsPanel?.label ?? "Items"}
                                />
                            </TabsContent>
                        </Tabs>
                    ) : null}

                    {activeModal?.modal === "access-codes" ? (
                        <>
                            <div className="grid gap-3 md:grid-cols-3">
                                <ModalMetricCard label="Coverage" value={accessCodeCard?.value ?? "--"} />
                                <ModalMetricCard
                                    label="Departments ready"
                                    value={String(
                                        snapshot.departmentReadiness.items.filter(
                                            (item) => item.accessCode.state === "available",
                                        ).length,
                                    )}
                                />
                                <ModalMetricCard label="Fiscal year" value={fiscalYearLabel} />
                            </div>
                            <div className="space-y-3">
                                {snapshot.departmentReadiness.items.length === 0 ? (
                                    <EmptyWorkspaceState
                                        body="Access-code coverage unlocks once departments exist, so there is nothing to audit yet."
                                        title="Waiting for departments"
                                    />
                                ) : (
                                    snapshot.departmentReadiness.items.map((item) => (
                                        <CompactStatusCard
                                            key={item.id}
                                            helper={item.blockerSummary}
                                            label={item.name}
                                            state={item.accessCode.state}
                                            value={item.accessCode.label}
                                        />
                                    ))
                                )}
                            </div>
                        </>
                    ) : null}

                    {activeModal?.modal === "deadlines" ? (
                        <>
                            <div className="grid gap-3 md:grid-cols-3">
                                <ModalMetricCard label="Readiness" value={deadlineCard?.value ?? "--"} />
                                <ModalMetricCard label="Fiscal year" value={fiscalYearLabel} />
                                <ModalMetricCard label="Alerts" value={String(snapshot.alerts.length)} />
                            </div>
                            {snapshot.alerts.length > 0 ? (
                                <div className="space-y-3">
                                    {snapshot.alerts.map((alert) => (
                                        <div
                                            key={alert.id}
                                            className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100"
                                        >
                                            <div className="font-semibold">{alert.title}</div>
                                            <div className="mt-1 text-sm leading-6 opacity-90">
                                                {alert.message}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyWorkspaceState
                                    body="Every in-scope department currently points to a safe shared submission window."
                                    title="Shared deadline looks healthy"
                                />
                            )}
                        </>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 px-5 py-4">
                        <div>
                            <div className="font-semibold text-foreground">
                                Consolidation stays separate
                            </div>
                            <div className="text-sm leading-6 text-muted-foreground">
                                This is the only PO workflow that still opens as its own page.
                            </div>
                        </div>
                        <Button asChild variant="outline" className="rounded-xl">
                            <Link href="/po/consolidation">
                                Open route
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DepartmentReadinessRow({
    compact = false,
    item,
    onManageDepartment,
}: {
    compact?: boolean;
    item: ProcurementOfficerDashboardDepartmentReadinessItem;
    onManageDepartment: () => void;
}): JSX.Element {
    return (
        <tr className="transition hover:bg-muted/30">
            <td
                className={cn(
                    "border-b border-border/70 px-3",
                    compact ? "py-2.5" : "py-4",
                )}
            >
                <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-[10px] font-bold uppercase text-muted-foreground">
                        {getInitials(item.name)}
                    </div>
                    <div>
                        <div className="text-[13px] font-semibold text-foreground">{item.name}</div>
                        <div
                            className={cn(
                                "text-muted-foreground",
                                compact ? "text-[11px]" : "text-sm",
                            )}
                        >
                            {item.blockerSummary}
                        </div>
                    </div>
                </div>
            </td>
            <td className={cn("border-b border-border/70 px-3", compact ? "py-2.5" : "py-4")}>
                <span className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                    {item.code}
                </span>
            </td>
            <td className={cn("border-b border-border/70 px-3", compact ? "py-2.5" : "py-4")}>
                <div className={cn(compact ? "space-y-1.5" : "space-y-2")}>
                    <StateBadge state={item.overallState} />
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>Prep readiness</span>
                        <span>{item.progressValue}%</span>
                    </div>
                    <Progress value={item.progressValue} className="h-1.5 bg-muted" />
                </div>
            </td>
            <td className={cn("border-b border-border/70 px-3", compact ? "py-2.5" : "py-4")}>
                <div className="grid gap-1.5">
                    <InlineState label="Access" state={item.accessCode.state} value={item.accessCode.label} />
                    <InlineState label="DU" state={item.departmentUser.state} value={item.departmentUser.label} />
                    <InlineState label="Deadline" state={item.deadline.state} value={item.deadline.label} />
                </div>
            </td>
            <td
                className={cn(
                    "border-b border-border/70 px-3 text-right",
                    compact ? "py-2.5" : "py-4",
                )}
            >
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs text-primary hover:text-primary"
                    onClick={onManageDepartment}
                    type="button"
                >
                    Manage
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
            </td>
        </tr>
    );
}

function UnifiedStatsCard({
    sections,
}: {
    sections: Array<{
        card: ProcurementOfficerDashboardSummaryCard;
        icon: JSX.Element;
        meta: string;
        tone: "primary" | "success" | "warning";
    }>;
}): JSX.Element {
    return (
        <section className="grid gap-2 xl:grid-cols-3">
            <div className="grid gap-2 xl:col-span-3 xl:grid-cols-3">
                {sections.map((section, index) => (
                    <div
                        key={section.card.id}
                        className={cn(
                            "flex items-start gap-2.5 px-0.5 py-0.5",
                            index < sections.length - 1 &&
                                "xl:border-r xl:border-border/40 xl:pr-3",
                        )}
                    >
                        <div
                            className={cn(
                                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                                section.tone === "primary" &&
                                    "bg-primary text-primary-foreground",
                                section.tone === "success" &&
                                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
                                section.tone === "warning" &&
                                    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
                            )}
                        >
                            {section.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                        {section.card.label}
                                    </div>
                                    <div className="mt-0.5 text-lg font-black tracking-[-0.04em] text-foreground">
                                        {section.card.value}
                                    </div>
                                </div>
                                <StateBadge
                                    state={section.card.state}
                                    label={section.card.statusLabel}
                                />
                            </div>
                            <div className="mt-0.5 text-[12px] text-muted-foreground">
                                {section.meta}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function CompactDepartmentCard({
    item,
}: {
    item: ProcurementOfficerDashboardDepartmentReadinessItem;
}): JSX.Element {
    return (
        <div className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="font-semibold text-foreground">{item.name}</div>
                    <div className="mt-1 text-sm leading-6 text-muted-foreground">
                        {item.blockerSummary}
                    </div>
                </div>
                <StateBadge state={item.overallState} />
            </div>
        </div>
    );
}

function CompactStatusCard({
    helper,
    label,
    state,
    value,
}: {
    helper: string;
    label: string;
    state: ProcurementDashboardState;
    value: string;
}): JSX.Element {
    return (
        <div className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="font-semibold text-foreground">{label}</div>
                    <div className="mt-1 text-sm leading-6 text-muted-foreground">
                        {helper}
                    </div>
                </div>
                <StateBadge state={state} label={value} />
            </div>
        </div>
    );
}

function EmptyWorkspaceState({
    body,
    title,
}: {
    body: string;
    title: string;
}): JSX.Element {
    return (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5">
            <div className="font-semibold text-foreground">{title}</div>
            <div className="mt-2 text-sm leading-6 text-muted-foreground">{body}</div>
        </div>
    );
}

function InlineState({
    label,
    state,
    value,
}: {
    label: string;
    state: ProcurementDashboardState;
    value: string;
}): JSX.Element {
    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <StateBadge state={state} label={value} />
        </div>
    );
}

function ModalMetricCard({
    label,
    value,
}: {
    label: string;
    value: string;
}): JSX.Element {
    return (
        <div className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {label}
            </div>
            <div className="mt-3 text-xl font-black tracking-[-0.04em] text-foreground">
                {value}
            </div>
        </div>
    );
}

function StateBadge({
    label,
    state,
}: {
    label?: string;
    state: ProcurementDashboardState;
}): JSX.Element {
    const renderedLabel = label ?? humanizeState(state);

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                state === "available" &&
                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
                state === "coming_soon" && "bg-primary/10 text-primary",
                state === "empty" && "bg-muted text-muted-foreground",
                state === "setup_required" &&
                    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
                state === "unavailable" && "bg-muted text-muted-foreground",
            )}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {renderedLabel}
        </span>
    );
}

function OverviewMiniStat({
    label,
    value,
}: {
    label: string;
    value: string;
}): JSX.Element {
    return (
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-2.5 text-center">
            <div className="text-lg font-black tracking-[-0.04em] text-foreground">
                {value}
            </div>
            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {label}
            </div>
        </div>
    );
}

function findSummaryCard(
    cards: ProcurementOfficerDashboardSummaryCard[],
    id: ProcurementOfficerDashboardSummaryCard["id"],
): ProcurementOfficerDashboardSummaryCard | undefined {
    return cards.find((card) => card.id === id);
}

function findFuturePanel(
    panels: ProcurementOfficerDashboardFuturePanel[],
    id: ProcurementOfficerDashboardFuturePanel["id"],
): ProcurementOfficerDashboardFuturePanel | undefined {
    return panels.find((panel) => panel.id === id);
}

function getWorkspaceIcon(
    modal: ProcurementOfficerWorkspaceModalState["modal"],
): JSX.Element {
    if (modal === "requests") {
        return <FileStack className="h-5 w-5" />;
    }
    if (modal === "categories") {
        return <FolderTree className="h-5 w-5" />;
    }
    if (modal === "access-codes") {
        return <KeyRound className="h-5 w-5" />;
    }
    if (modal === "deadlines") {
        return <CalendarClock className="h-5 w-5" />;
    }
    return <Building2 className="h-5 w-5" />;
}

function getWorkspaceTitle(
    activeModal: ProcurementOfficerWorkspaceModalState | null,
): string {
    switch (activeModal?.modal) {
        case "requests":
            return "Requests workspace";
        case "categories":
            return activeModal.section === "items"
                ? "Categories and items workspace"
                : "Categories workspace";
        case "access-codes":
            return "Access-code coverage";
        case "deadlines":
            return "Deadline readiness";
        default:
            return "Departments workspace";
    }
}

function getWorkspaceDescription(
    activeModal: ProcurementOfficerWorkspaceModalState | null,
): string {
    switch (activeModal?.modal) {
        case "requests":
            return "Request inbox and submission monitoring now open as a dashboard modal, keeping the PO flow in one place until the live queue stories land.";
        case "categories":
            return activeModal.section === "items"
                ? "Items are nested under categories on purpose, so the dashboard stays tighter and the catalog story can grow in one workspace."
                : "Categories now open inside the dashboard, with items folded into the same workspace instead of taking their own card.";
        case "access-codes":
            return "Access-code follow-up stays attached to the dashboard context, so you can audit missing coverage without bouncing into a placeholder page.";
        case "deadlines":
            return "Deadline warnings now resolve inside the dashboard, keeping fiscal-year signals, alerts, and department readiness in one flow.";
        default:
            return "Department setup and readiness review now happen as a dashboard modal, while consolidation remains the only dedicated PO route.";
    }
}

function humanizeState(state: ProcurementDashboardState): string {
    switch (state) {
        case "available":
            return "Ready";
        case "coming_soon":
            return "Coming soon";
        case "empty":
            return "Empty";
        case "setup_required":
            return "Setup required";
        default:
            return "Unavailable";
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

function ProcurementOfficerDashboardSkeleton(): JSX.Element {
    return (
        <div className="mx-auto hidden w-full max-w-none space-y-4 px-4 py-4 lg:block xl:px-5">
            <div className="grid gap-3 xl:grid-cols-3">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
                    <Skeleton className="h-[18rem] rounded-[28px]" />
                    <Skeleton className="h-[18rem] rounded-[28px]" />
                    <Skeleton className="h-[24rem] rounded-[28px] xl:col-span-2" />
                </div>
                <Skeleton className="h-[24rem] rounded-[28px]" />
            </div>
        </div>
    );
}
