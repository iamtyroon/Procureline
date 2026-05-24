"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
    CalendarClock,
    Download,
    FileSearch,
    Link2,
    LoaderCircle,
    RefreshCw,
    ShieldCheck,
    Wallet,
} from "lucide-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { TenantAdminDashboardSnapshot } from "@/lib/shared/tenant-admin/dashboard-snapshot";
import {
    buildDefaultTenantAdminReportParameters,
    type TenantAdminReportParameters,
    type TenantAdminReportType,
} from "@/lib/shared/tenant-admin/report-generation";

export function TenantAdminReportsView({
    snapshot,
}: {
    snapshot: TenantAdminDashboardSnapshot;
}): JSX.Element {
    const defaultParameters = useMemo(
        () =>
            buildDefaultTenantAdminReportParameters({
                fiscalYear: snapshot.meta.selectedFiscalYear,
                now: snapshot.meta.snapshotGeneratedAt,
            }),
        [snapshot.meta.selectedFiscalYear, snapshot.meta.snapshotGeneratedAt],
    );
    const [parameters, setParameters] = useState<TenantAdminReportParameters>(defaultParameters);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const jobs = useQuery(api.functions.tenantAdminReports.listTenantAdminReportJobs);
    const queueReport = useAction(api.actions.files.queueTenantAdminReportGeneration);
    const createShareLink = useMutation(
        api.functions.tenantAdminReports.createTenantAdminReportShareLink,
    );
    const upsertSchedule = useMutation(
        api.functions.tenantAdminReports.upsertTenantAdminReportSchedule,
    );
    const recordDownload = useMutation(
        api.functions.tenantAdminReports.recordTenantAdminReportDownload,
    );
    const activeJob =
        jobs?.find((job: { _id: unknown }) => String(job._id) === activeJobId) ??
        jobs?.[0] ??
        null;

    function updateParameters(next: Partial<TenantAdminReportParameters>): void {
        setParameters((current) => ({
            ...current,
            ...next,
        }));
    }

    function generateReport(): void {
        startTransition(async () => {
            const result = await queueReport({ parameters });
            setActiveJobId(result.jobId);
            setShareUrl(null);
        });
    }

    function shareReport(): void {
        if (!activeJob || activeJob.status !== "ready") {
            return;
        }
        startTransition(async () => {
            const result = await createShareLink({ reportJobId: activeJob._id });
            setShareUrl(result.url);
        });
    }

    function scheduleReport(): void {
        if (parameters.reportType === "audit") {
            return;
        }
        startTransition(async () => {
            const reportType = parameters.reportType;
            if (reportType === "audit") {
                return;
            }
            await upsertSchedule({
                cadence: "weekly",
                enabled: true,
                parameters,
                reportType,
            });
        });
    }

    function downloadReport(): void {
        if (!activeJob || activeJob.status !== "ready") {
            return;
        }
        startTransition(async () => {
            const result = await recordDownload({ reportJobId: activeJob._id });
            window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
        });
    }

    return (
        <div className="grid gap-5 xl:grid-cols-3">
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-2">
                <CardHeader className="border-b border-border/70 pb-4">
                    <CardTitle className="text-base text-foreground">Report Generation</CardTitle>
                    <CardDescription>
                        Generate tenant-scoped Budget, Activity, and Audit reports for leadership review.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                    <div className="grid gap-3 md:grid-cols-3">
                        {REPORT_TYPES.map((report) => {
                            const Icon = report.icon;

                            return (
                            <button
                                key={report.value}
                                className={[
                                    "rounded-xl border p-4 text-left transition-colors",
                                    parameters.reportType === report.value
                                        ? "border-primary bg-primary/10 text-foreground"
                                        : "border-border bg-muted/20 text-muted-foreground hover:bg-background",
                                ].join(" ")}
                                onClick={() => updateParameters({ reportType: report.value })}
                                type="button"
                            >
                                <Icon className="mb-3 h-5 w-5 text-primary" />
                                <div className="text-sm font-semibold">{report.label}</div>
                                <div className="mt-1 text-xs leading-5">{report.description}</div>
                            </button>
                            );
                        })}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <ReportField label="Fiscal year">
                            <Select
                                value={parameters.fiscalYear}
                                onValueChange={(value) =>
                                    updateParameters({
                                        ...buildDefaultTenantAdminReportParameters({
                                            fiscalYear: value,
                                            now: Date.now(),
                                        }),
                                        fiscalYear: value,
                                        reportType: parameters.reportType,
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Fiscal year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {snapshot.meta.availableFiscalYears.map((year) => (
                                        <SelectItem key={year} value={year}>
                                            {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </ReportField>
                        <ReportField label="Output">
                            <Select
                                value={parameters.format}
                                onValueChange={(value) =>
                                    updateParameters({ format: value as TenantAdminReportParameters["format"] })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Output format" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="xlsx">Excel workbook</SelectItem>
                                    <SelectItem value="csv">CSV package</SelectItem>
                                </SelectContent>
                            </Select>
                        </ReportField>
                        <ReportField label="Date from">
                            <Input
                                type="date"
                                value={parameters.dateRange.from}
                                onChange={(event) =>
                                    updateParameters({
                                        dateRange: {
                                            ...parameters.dateRange,
                                            from: event.target.value,
                                        },
                                    })
                                }
                            />
                        </ReportField>
                        <ReportField label="Date to">
                            <Input
                                type="date"
                                value={parameters.dateRange.to}
                                onChange={(event) =>
                                    updateParameters({
                                        dateRange: {
                                            ...parameters.dateRange,
                                            to: event.target.value,
                                        },
                                    })
                                }
                            />
                        </ReportField>
                        <ReportField label="Department">
                            <Select
                                value={parameters.departmentId}
                                onValueChange={(value) => updateParameters({ departmentId: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Department scope" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All departments</SelectItem>
                                    {snapshot.institutionalOverview.rows.map((row) => (
                                        <SelectItem key={row.departmentId} value={row.departmentId}>
                                            {row.departmentName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </ReportField>
                        <ReportField label="Procurement Officer">
                            <Select
                                value={parameters.procurementOfficerId}
                                onValueChange={(value) => updateParameters({ procurementOfficerId: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="PO scope" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Procurement Officers</SelectItem>
                                    {snapshot.institutionalOverview.poRollups.map((po) => (
                                        <SelectItem key={po.id} value={po.id}>
                                            {po.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </ReportField>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button className="gap-2" disabled={isPending} onClick={generateReport}>
                            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
                            Generate report
                        </Button>
                        <Button
                            className="gap-2"
                            disabled={parameters.reportType === "audit" || isPending}
                            onClick={scheduleReport}
                            variant="outline"
                        >
                            <CalendarClock className="h-4 w-4" />
                            Schedule weekly
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                <CardHeader className="border-b border-border/70 pb-4">
                    <CardTitle className="text-base text-foreground">Delivery</CardTitle>
                    <CardDescription>Queued reports update here when the export service responds.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                    {activeJob ? (
                        <>
                            <div className="rounded-xl border border-border bg-muted/20 p-4">
                                <div className="text-sm font-semibold text-foreground">{activeJob.reportName}</div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                    {activeJob.reportType} / {activeJob.outputFormat}
                                </div>
                                <div className="mt-3">
                                    <ReportStatusBadge status={activeJob.status} />
                                </div>
                            </div>
                            <Button
                                className="w-full gap-2"
                                disabled={activeJob.status !== "ready" || !activeJob.downloadUrl}
                                onClick={downloadReport}
                                variant="outline"
                            >
                                <Download className="h-4 w-4" />
                                Download report
                            </Button>
                            <Button
                                className="w-full gap-2"
                                disabled={activeJob.status !== "ready" || isPending}
                                onClick={shareReport}
                                variant="outline"
                            >
                                <Link2 className="h-4 w-4" />
                                Create secure link
                            </Button>
                            {activeJob.status === "failed" ? (
                                <Button className="w-full gap-2" disabled={isPending} onClick={generateReport}>
                                    <RefreshCw className="h-4 w-4" />
                                    Retry
                                </Button>
                            ) : null}
                            {shareUrl ? (
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
                                    {shareUrl}
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm leading-6 text-muted-foreground">
                            Generate a report to see queued, ready, failed, retry, download, and secure-link actions.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

const REPORT_TYPES: Array<{
    description: string;
    icon: typeof Wallet;
    label: string;
    value: TenantAdminReportType;
}> = [
    {
        description: "Department budget, utilization, status, and compliance summary.",
        icon: Wallet,
        label: "Budget",
        value: "budget",
    },
    {
        description: "Tenant activity sourced from the audit trail.",
        icon: FileSearch,
        label: "Activity",
        value: "activity",
    },
    {
        description: "Actor, action, entity, outcome, and timestamp details.",
        icon: ShieldCheck,
        label: "Audit",
        value: "audit",
    },
];

function ReportField({
    children,
    label,
}: {
    children: ReactNode;
    label: string;
}): JSX.Element {
    return (
        <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">{label}</span>
            {children}
        </label>
    );
}

function ReportStatusBadge({
    status,
}: {
    status: "failed" | "queued" | "ready";
}): JSX.Element {
    const className =
        status === "ready"
            ? "bg-emerald-100 text-emerald-700"
            : status === "failed"
              ? "bg-red-100 text-red-700"
              : "bg-amber-100 text-amber-700";

    return (
        <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${className}`}>
            {status === "ready" ? "Ready" : status === "failed" ? "Failed" : "Queued"}
        </span>
    );
}
