"use client";

import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import {
  Archive,
  ClipboardCheck,
  Download,
  Filter,
  History,
  PencilLine,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProcurementOfficerDashboardDepartmentReadinessItem } from "@/lib/procurement-officer/dashboard-snapshot";
import { cn } from "@/lib/utils";
import { ProcurementOfficerPlanReviewSummaryModal } from "./ProcurementOfficerPlanReviewSummaryModal";
import { StateBadge } from "./dashboard/primitives";

const STATUS_FILTER_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Not started", value: "not_started" },
  { label: "Draft", value: "draft" },
  { label: "Submitted", value: "submitted" },
  { label: "Rejected", value: "rejected" },
  { label: "Approved", value: "approved" },
] as const;

function getStatusBadgeClassName(status: string): string {
  switch (status) {
    case "approved":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "rejected":
      return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    case "draft":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "not_started":
      return "border-border/60 bg-muted/30 text-muted-foreground";
    default:
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
}

function isReviewableMonitoringStatus(status: string): boolean {
  return status === "submitted" || status === "approved" || status === "rejected";
}

export function ProcurementOfficerSubmissionMonitoringWorkspace({
  onArchiveDepartment,
  onManageDepartment,
  readinessItems,
  selectedFiscalYear,
}: {
  onArchiveDepartment?: (departmentId: string) => void;
  onManageDepartment?: (departmentId: string) => void;
  readinessItems?: ProcurementOfficerDashboardDepartmentReadinessItem[];
  selectedFiscalYear?: string;
}): JSX.Element {
  const isMerged = readinessItems !== undefined;
  const workspace = useQuery(
    api.functions.procurementOfficerSubmissions
      .getProcurementOfficerSubmissionMonitoringWorkspace,
    selectedFiscalYear ? { selectedFiscalYear } : {},
  );
  const exportReport = useAction(api.actions.files.exportSubmissionMonitoringReport);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [historyDepartmentId, setHistoryDepartmentId] = useState<string | null>(null);
  const [reviewPlanId, setReviewPlanId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const activeFilterCount = [
    searchText.trim().length > 0,
    statusFilter !== "all",
    updatedFrom.length > 0,
    updatedTo.length > 0,
  ].filter(Boolean).length;

  const rows = useMemo(() => {
    if (!workspace) {
      return [];
    }

    const normalizedSearch = searchText.trim().toLowerCase();
    const rawFromTimestamp = updatedFrom ? new Date(`${updatedFrom}T00:00:00`).getTime() : null;
    const rawToTimestamp = updatedTo ? new Date(`${updatedTo}T23:59:59.999`).getTime() : null;
    const fromTimestamp =
      typeof rawFromTimestamp === "number" && Number.isFinite(rawFromTimestamp)
        ? rawFromTimestamp
        : null;
    const toTimestamp =
      typeof rawToTimestamp === "number" && Number.isFinite(rawToTimestamp)
        ? rawToTimestamp
        : null;
    return workspace.rows.filter((row: any) => {
      if (!isMerged && !row.planId) {
        return false;
      }

      if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }

      if (
        typeof fromTimestamp === "number" &&
        (typeof row.lastUpdatedAt !== "number" || row.lastUpdatedAt < fromTimestamp)
      ) {
        return false;
      }

      if (
        typeof toTimestamp === "number" &&
        (typeof row.lastUpdatedAt !== "number" || row.lastUpdatedAt > toTimestamp)
      ) {
        return false;
      }

      if (normalizedSearch.length === 0) {
        return true;
      }

      return (
        row.departmentName.toLowerCase().includes(normalizedSearch) ||
        (row.departmentCode ?? "").toLowerCase().includes(normalizedSearch)
      );
    });
  }, [isMerged, searchText, statusFilter, updatedFrom, updatedTo, workspace]);

  const historyRow = rows.find((row: any) => row.departmentId === historyDepartmentId) ?? null;
  const readinessById = new Map(
    readinessItems.map((item) => [item.id as string, item]),
  );
  const statusBreakdown = workspace
    ? [
        { label: "Not started", value: workspace.summary.notStarted },
        { label: "Draft", value: workspace.summary.draft },
        { label: "Submitted", value: workspace.summary.submitted },
        { label: "Rejected", value: workspace.summary.rejected },
        { label: "Approved", value: workspace.summary.approved },
      ].filter((entry) => entry.value > 0)
    : [];

  function clearFilters(): void {
    setSearchText("");
    setStatusFilter("all");
    setUpdatedFrom("");
    setUpdatedTo("");
  }

  async function onExport(): Promise<void> {
    if (!workspace) {
      return;
    }

    setIsExporting(true);
    try {
      const workbook = (await exportReport({
        departmentIds: rows.map((row: any) => row.departmentId),
        selectedFiscalYear: workspace.meta.selectedFiscalYear,
      })) as { fileName: string; workbookBase64: string };
      downloadBase64File(workbook.fileName, workbook.workbookBase64);
      toast.success("Submission monitoring report exported.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  if (!workspace) {
    return (
      <div className="rounded-2xl border border-border/70 bg-muted/10 p-6 text-sm text-muted-foreground">
        Loading submission monitoring...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="h-8 rounded-lg px-3 text-xs"
              type="button"
              variant="outline"
            >
              <Filter className="mr-2 h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[22rem] rounded-2xl border-border/80 p-3 shadow"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Monitoring filters
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Search, status, and last-updated range.
                  </div>
                </div>
                <Button
                  aria-label="Clear monitoring filters"
                  className="h-7 w-7 rounded-lg"
                  disabled={activeFilterCount === 0}
                  onClick={clearFilters}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-xs"
                  placeholder="Search department or code"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Updated from
                  </div>
                  <Input
                    aria-label="Updated from"
                    className="h-8 text-xs"
                    type="date"
                    value={updatedFrom}
                    onChange={(event) => setUpdatedFrom(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Updated to
                  </div>
                  <Input
                    aria-label="Updated to"
                    className="h-8 text-xs"
                    type="date"
                    value={updatedTo}
                    onChange={(event) => setUpdatedTo(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            className="h-8 rounded-lg px-3 text-xs"
            type="button"
            variant="outline"
            disabled={isExporting || rows.length === 0}
            onClick={() => void onExport()}
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <span className="font-medium text-foreground">
          {workspace.summary.submittedOfTotalLabel}
        </span>
        {statusBreakdown.length > 1
          ? statusBreakdown.map((entry) => (
              <span
                key={entry.label}
                className="rounded-full border border-border/50 bg-muted/20 px-2.5 py-0.5 tabular-nums"
              >
                {entry.label}: {entry.value}
              </span>
            ))
          : statusBreakdown.map((entry) => (
              <span key={entry.label} className="tabular-nums">
                · all {entry.label.toLowerCase()} ({entry.value})
              </span>
            ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-5 py-7 text-center text-sm text-muted-foreground">
          No departments match the current monitoring filters.
        </div>
      ) : (
        <div className="rounded-2xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Plan status</TableHead>
                {isMerged ? (
                  <>
                    <TableHead>Budget</TableHead>
                    <TableHead>Coverage</TableHead>
                  </>
                ) : (
                  <TableHead>DU contact</TableHead>
                )}
                <TableHead>Last updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: any) => {
                const readiness = readinessById.get(row.departmentId);
                const coverageReady =
                  readiness?.departmentUser.state === "available" &&
                  readiness.accessCode.state === "available";
                return (
                  <TableRow key={row.departmentId}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium text-foreground">
                          {row.departmentName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.departmentCode ?? "Code unavailable"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getStatusBadgeClassName(row.status)}
                      >
                        {row.statusLabel}
                      </Badge>
                    </TableCell>
                    {isMerged ? (
                      <>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                readiness?.budgetStatus.state === "available" &&
                                  "bg-emerald-500",
                                readiness?.budgetStatus.state ===
                                  "setup_required" && "bg-rose-500",
                                (!readiness ||
                                  readiness.budgetStatus.state === "empty" ||
                                  readiness.budgetStatus.state ===
                                    "unavailable") &&
                                  "bg-muted-foreground/50",
                              )}
                            />
                            <span className="text-[12px] text-foreground">
                              {readiness?.budgetStatus.label ?? "--"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StateBadge
                            label={coverageReady ? "Ready" : "Setup needed"}
                            state={coverageReady ? "available" : "setup_required"}
                          />
                        </TableCell>
                      </>
                    ) : (
                      <TableCell className="text-sm text-muted-foreground">
                        {row.duContactLabel}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-muted-foreground">
                      {row.lastUpdatedLabel}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {row.planId && isReviewableMonitoringStatus(row.status) ? (
                          <Button
                            className="h-8 rounded-lg px-3 text-xs"
                            size="sm"
                            type="button"
                            onClick={() => setReviewPlanId(row.planId)}
                          >
                            <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                            Review
                          </Button>
                        ) : null}
                        <Button
                          aria-label={`Open history for ${row.departmentName}`}
                          className="h-8 w-8 rounded-lg p-0"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => setHistoryDepartmentId(row.departmentId)}
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        {onManageDepartment ? (
                          <Button
                            aria-label={`Edit ${row.departmentName}`}
                            className="h-8 w-8 rounded-lg p-0"
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => onManageDepartment(row.departmentId)}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {onArchiveDepartment ? (
                          <Button
                            aria-label={`Archive ${row.departmentName}`}
                            className="h-8 w-8 rounded-lg p-0 hover:border-amber-400/40 hover:bg-amber-500/10"
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => onArchiveDepartment(row.departmentId)}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={historyDepartmentId !== null}
        onOpenChange={(open) => !open && setHistoryDepartmentId(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {historyRow?.departmentName ?? "Submission history"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(historyRow?.timeline ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                No canonical submission history is available for this department yet.
              </div>
            ) : (
              (historyRow?.timeline ?? []).map((item: any) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/70 bg-muted/10 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">
                      {item.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.timestampLabel}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {item.description}
                  </div>
                  {item.isFallback ? (
                    <div className="mt-2 text-xs text-amber-700">
                      Timestamp detail unavailable for this historical event.
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ProcurementOfficerPlanReviewSummaryModal
        onClose={() => setReviewPlanId(null)}
        open={reviewPlanId !== null}
        planId={reviewPlanId}
      />
    </div>
  );
}

function downloadBase64File(fileName: string, payload: string): void {
  const binary = window.atob(payload);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(href);
}
