"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import {
    AlertTriangle,
    Building2,
    Download,
    Search,
    ShieldCheck,
    Users2,
    Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    filterInstitutionalOverviewRows,
    summarizeInstitutionalOverview,
    type InstitutionalOverviewStatus,
    type TenantAdminInstitutionalOverview,
} from "@/lib/shared/tenant-admin/institutional-visibility";
import { formatDashboardTimestamp, formatFiscalYearLabel } from "@/lib/shared/tenant-admin/dashboard";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";

const STATUS_OPTIONS: Array<{ label: string; value: InstitutionalOverviewStatus | "all" }> = [
    { label: "All statuses", value: "all" },
    { label: "Not Started", value: "not_started" },
    { label: "Draft", value: "draft" },
    { label: "Submitted", value: "submitted" },
    { label: "Rejected", value: "rejected" },
    { label: "Approved", value: "approved" },
];
const INITIAL_VISIBLE_ROW_COUNT = 75;
const ROW_INCREMENT = 75;

export function InstitutionalOverviewView({
    overview,
}: {
    overview: TenantAdminInstitutionalOverview;
}): JSX.Element {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<InstitutionalOverviewStatus | "all">("all");
    const [procurementOfficerId, setProcurementOfficerId] = useState<string | "all">("all");
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
    const [isExportQueued, setIsExportQueued] = useState(false);
    const [visibleRowCount, setVisibleRowCount] = useState(INITIAL_VISIBLE_ROW_COUNT);
    const requestExport = useAction(
        api.actions.files.queueTenantAdminInstitutionalExport,
    );
    const filteredRows = useMemo(
        () =>
            filterInstitutionalOverviewRows(overview.rows, {
                procurementOfficerId,
                query,
                status,
            }),
        [overview.rows, procurementOfficerId, query, status],
    );
    const filteredDepartmentIds = useMemo(
        () => new Set(filteredRows.map((row) => row.departmentId)),
        [filteredRows],
    );
    const filteredAnomalies = useMemo(
        () =>
            overview.anomalies.filter((anomaly) =>
                filteredDepartmentIds.has(anomaly.departmentId),
            ),
        [filteredDepartmentIds, overview.anomalies],
    );
    const filteredSummary = useMemo(
        () => summarizeInstitutionalOverview(filteredRows, filteredAnomalies),
        [filteredAnomalies, filteredRows],
    );
    const visibleRows = filteredRows.slice(0, visibleRowCount);
    const selectedRow =
        filteredRows.find((row) => row.departmentId === selectedDepartmentId) ??
        visibleRows[0] ??
        null;
    const selectedAnomalies = selectedRow
        ? overview.anomalies.filter(
              (anomaly) => anomaly.departmentId === selectedRow.departmentId,
          )
        : [];

    useEffect(() => {
        setVisibleRowCount(INITIAL_VISIBLE_ROW_COUNT);
    }, [procurementOfficerId, query, status, overview.fiscalYear]);

    return (
        <div className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-5">
                <OverviewMetricCard
                    icon={Building2}
                    label="Departments"
                    meta={`${filteredRows.length} visible in ${formatFiscalYearLabel(overview.fiscalYear)}`}
                    value={String(filteredSummary.totalDepartments)}
                />
                <OverviewMetricCard
                    icon={Wallet}
                    label="Allocated"
                    meta="Positive department budgets only"
                    value={filteredSummary.totalAllocatedLabel}
                />
                <OverviewMetricCard
                    icon={Wallet}
                    label="Utilized"
                    meta={filteredSummary.totalUtilizationLabel}
                    value={filteredSummary.totalUtilizedLabel}
                />
                <OverviewMetricCard
                    icon={ShieldCheck}
                    label="Coverage"
                    meta="Submitted or approved"
                    value={filteredSummary.approvedOrSubmittedLabel}
                />
                <OverviewMetricCard
                    icon={AlertTriangle}
                    label="Anomalies"
                    meta="Needs tenant-admin attention"
                    value={String(filteredSummary.anomalyCount)}
                />
            </div>

            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                <CardHeader className="gap-4 border-b border-border/70 pb-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <CardTitle className="text-base text-foreground">
                            Institutional Overview
                        </CardTitle>
                        <CardDescription>
                            Read-only visibility for {formatFiscalYearLabel(overview.fiscalYear)}.
                            Export requests are queued as of{" "}
                            {formatDashboardTimestamp(overview.exportRequest.asOf)}.
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={isExportQueued}
                        onClick={async () => {
                            setIsExportQueued(true);
                            try {
                                const result = await requestExport({
                                    fiscalYear: overview.fiscalYear,
                                    query,
                                    status,
                                    ...(procurementOfficerId === "all"
                                        ? {}
                                        : { procurementOfficerId }),
                                });
                                toast.success(
                                    result.state === "export_ready"
                                        ? `Institutional export ready: ${result.requestId}`
                                        : `Institutional export queued: ${result.requestId}`,
                                );
                            } catch (error) {
                                setIsExportQueued(false);
                                toast.error(
                                    error instanceof Error
                                        ? error.message
                                        : "Export request failed.",
                                );
                            }
                        }}
                    >
                        <Download className="h-4 w-4" />
                        {isExportQueued ? "Export queued" : "Queue export"}
                    </Button>
                </CardHeader>
                <CardContent className="space-y-5 p-5">
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="pl-9"
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search department name or code"
                                value={query}
                            />
                        </div>
                        <Select
                            value={procurementOfficerId}
                            onValueChange={(value) => setProcurementOfficerId(value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Procurement Officer" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Procurement Officers</SelectItem>
                                {overview.poRollups.map((po) => (
                                    <SelectItem key={po.id} value={po.id}>
                                        {po.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={status}
                            onValueChange={(value) =>
                                setStatus(value as InstitutionalOverviewStatus | "all")
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Submission status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {filteredRows.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                            <p className="text-sm font-medium text-foreground">
                                No departments match this view
                            </p>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Filters are applied to the full tenant-shaped dataset for this fiscal year.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                            <div className="overflow-hidden rounded-xl border border-border/70">
                                <div className="max-h-[640px] overflow-auto">
                                    <table className="min-w-full table-fixed text-sm">
                                        <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted text-left text-xs font-semibold uppercase text-muted-foreground">
                                            <tr>
                                                <th className="w-[24%] px-4 py-3">Department</th>
                                                <th className="w-[20%] px-4 py-3">Procurement Officer</th>
                                                <th className="w-[16%] px-4 py-3">Status</th>
                                                <th className="w-[16%] px-4 py-3">Allocated</th>
                                                <th className="w-[16%] px-4 py-3">Used</th>
                                                <th className="w-[8%] px-4 py-3">Risk</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleRows.map((row) => (
                                                <tr
                                                    key={row.departmentId}
                                                    className={cn(
                                                        "h-[76px] cursor-pointer border-b border-border/60 bg-background transition-colors hover:bg-muted/40",
                                                        selectedRow?.departmentId === row.departmentId &&
                                                            "bg-primary/5",
                                                    )}
                                                    onClick={() => setSelectedDepartmentId(row.departmentId)}
                                                >
                                                    <td className="px-4 py-3">
                                                        <div className="truncate font-medium text-foreground">
                                                            {row.departmentName}
                                                        </div>
                                                        <div className="truncate text-xs text-muted-foreground">
                                                            {row.departmentCode ?? "Code unavailable"}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="truncate text-foreground">
                                                            {row.procurementOfficer.name}
                                                        </div>
                                                        <div className="truncate text-xs text-muted-foreground">
                                                            {row.procurementOfficer.state}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <StatusPill status={row.status} label={row.statusLabel} />
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground">
                                                        {row.budget.allocationLabel}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-1">
                                                            <div className="text-muted-foreground">
                                                                {row.budget.usedLabel}
                                                            </div>
                                                            <Progress
                                                                value={row.budget.utilizationPercent ?? 0}
                                                                className="h-1.5 bg-muted"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={cn(
                                                            "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-xs font-semibold",
                                                            row.anomalyCount > 0
                                                                ? "bg-amber-100 text-amber-700"
                                                                : "bg-muted text-muted-foreground",
                                                        )}>
                                                            {row.anomalyCount}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {filteredRows.length > visibleRows.length ? (
                                    <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                                        <span>
                                            Showing {visibleRows.length} of {filteredRows.length} filtered departments.
                                        </span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setVisibleRowCount((current) =>
                                                    Math.min(
                                                        filteredRows.length,
                                                        current + ROW_INCREMENT,
                                                    ),
                                                )
                                            }
                                        >
                                            Load more
                                        </Button>
                                    </div>
                                ) : null}
                            </div>

                            <DepartmentDetailPanel
                                anomalies={selectedAnomalies}
                                row={selectedRow}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-3">
                {overview.poRollups.map((po) => (
                    <Card key={po.id} className="rounded-2xl border-border/70 bg-card shadow-sm">
                        <CardContent className="space-y-3 p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="font-semibold text-foreground">{po.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {po.departmentCount} departments
                                    </div>
                                </div>
                                <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                                    {po.statusLabel}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                <RollupCount label="Not Started" value={po.notStarted} />
                                <RollupCount label="In Progress" value={po.inProgress} />
                                <RollupCount label="Complete" value={po.complete} />
                                <RollupCount label="Attention" value={po.attentionNeeded} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function OverviewMetricCard({
    icon: Icon,
    label,
    meta,
    value,
}: {
    icon: typeof Building2;
    label: string;
    meta: string;
    value: string;
}): JSX.Element {
    return (
        <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
                <div className="truncate text-2xl font-bold tracking-tight text-foreground">{value}</div>
                <div className="line-clamp-2 text-xs text-muted-foreground">{meta}</div>
            </CardContent>
        </Card>
    );
}

function DepartmentDetailPanel({
    anomalies,
    row,
}: {
    anomalies: TenantAdminInstitutionalOverview["anomalies"];
    row: TenantAdminInstitutionalOverview["rows"][number] | null;
}): JSX.Element {
    if (!row) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
                Select a department to review read-only details.
            </div>
        );
    }

    return (
        <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-5">
            <div>
                <div className="text-base font-semibold text-foreground">{row.departmentName}</div>
                <div className="text-sm text-muted-foreground">
                    {row.departmentCode ?? "Department code unavailable"}
                </div>
            </div>
            <div className="grid gap-3 text-sm">
                <DetailLine label="Procurement Officer" value={row.procurementOfficer.name} />
                <DetailLine
                    label="DU contacts"
                    value={
                        row.duContacts.length > 0
                            ? row.duContacts.map((contact) => contact.email).join(", ")
                            : "No active safe DU coverage"
                    }
                />
                <DetailLine label="Plan status" value={row.statusLabel} />
                <DetailLine label="Budget allocated" value={row.budget.allocationLabel} />
                <DetailLine label="Budget used" value={row.budget.usedLabel} />
                <DetailLine label="Utilization" value={row.budget.utilizationLabel} />
                <DetailLine label="Item total" value={String(row.itemTotal)} />
            </div>
            <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Categories</div>
                {row.categorySummaries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No submitted or approved snapshot categories.</p>
                ) : (
                    row.categorySummaries.map((category) => (
                        <div key={category.categoryId} className="rounded-lg bg-background px-3 py-2 text-sm">
                            <div className="font-medium text-foreground">{category.categoryName}</div>
                            <div className="text-xs text-muted-foreground">
                                {category.itemCount} items · KES {category.amount.toLocaleString("en-KE")}
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">History</div>
                {row.timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No plan history for this fiscal year.</p>
                ) : (
                    row.timeline.map((item) => (
                        <div key={item.id} className="rounded-lg bg-background px-3 py-2 text-sm">
                            <div className="font-medium text-foreground">{item.title}</div>
                            <div className="text-xs text-muted-foreground">{item.timestampLabel}</div>
                        </div>
                    ))
                )}
            </div>
            {anomalies.length > 0 ? (
                <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Anomalies</div>
                    {anomalies.map((anomaly) => (
                        <div key={`${anomaly.type}:${anomaly.departmentId}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            {anomaly.description}
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function DetailLine({ label, value }: { label: string; value: string }): JSX.Element {
    return (
        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
            <div className="text-muted-foreground">{label}</div>
            <div className="break-words font-medium text-foreground">{value}</div>
        </div>
    );
}

function RollupCount({ label, value }: { label: string; value: number }): JSX.Element {
    return (
        <div className="rounded-lg bg-muted/50 p-2">
            <div className="font-semibold text-foreground">{value}</div>
            <div className="mt-1 truncate text-muted-foreground">{label}</div>
        </div>
    );
}

function StatusPill({
    label,
    status,
}: {
    label: string;
    status: InstitutionalOverviewStatus;
}): JSX.Element {
    return (
        <span
            className={cn(
                "inline-flex rounded-md px-2 py-1 text-xs font-semibold",
                status === "approved" && "bg-emerald-100 text-emerald-700",
                status === "submitted" && "bg-blue-100 text-blue-700",
                status === "rejected" && "bg-red-100 text-red-700",
                status === "draft" && "bg-amber-100 text-amber-700",
                status === "not_started" && "bg-muted text-muted-foreground",
            )}
        >
            {label}
        </span>
    );
}
