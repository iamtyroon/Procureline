"use client";

import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import {
  ClipboardCheck,
  Download,
  Filter,
  History,
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
import { ProcurementOfficerPlanReviewSummaryModal } from "./ProcurementOfficerPlanReviewSummaryModal";

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
      return "border-emerald-300/70 bg-emerald-50 text-emerald-900";
    case "rejected":
      return "border-rose-300/70 bg-rose-50 text-rose-900";
    case "draft":
      return "border-amber-300/70 bg-amber-50 text-amber-900";
    case "not_started":
      return "border-slate-300/70 bg-slate-50 text-slate-900";
    default:
      return "border-sky-300/70 bg-sky-50 text-sky-900";
  }
}

function isReviewableMonitoringStatus(status: string): boolean {
  return status === "submitted" || status === "approved" || status === "rejected";
}

export function ProcurementOfficerSubmissionMonitoringWorkspace({
  selectedFiscalYear,
}: {
  selectedFiscalYear?: string;
}): JSX.Element {
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
      if (!row.planId) {
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
  }, [searchText, statusFilter, updatedFrom, updatedTo, workspace]);

  const historyRow = rows.find((row: any) => row.departmentId === historyDepartmentId) ?? null;

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

      <div className="grid gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryPill
          helper="submitted"
          label="Progress"
          value={workspace.summary.submittedOfTotalLabel.replace(
            " departments submitted",
            "",
          )}
        />
        <SummaryPill label="Not Started" value={String(workspace.summary.notStarted)} />
        <SummaryPill label="Draft" value={String(workspace.summary.draft)} />
        <SummaryPill label="Submitted" value={String(workspace.summary.submitted)} />
        <SummaryPill label="Rejected" value={String(workspace.summary.rejected)} />
        <SummaryPill label="Approved" value={String(workspace.summary.approved)} />
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
                <TableHead>Status</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead>DU contact</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: any) => (
                <TableRow key={row.departmentId}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground">
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
                  <TableCell className="text-sm text-muted-foreground">
                    {row.lastUpdatedLabel}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.duContactLabel}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {row.planId && isReviewableMonitoringStatus(row.status) ? (
                        <Button
                          type="button"
                          onClick={() => setReviewPlanId(row.planId)}
                        >
                          <ClipboardCheck className="mr-2 h-4 w-4" />
                          Review
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setHistoryDepartmentId(row.departmentId)}
                      >
                        <History className="mr-2 h-4 w-4" />
                        Open history
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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

function SummaryPill({
  helper,
  label,
  value,
}: {
  helper?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-h-[3.25rem] rounded-lg border border-border/70 bg-muted/10 px-2.5 py-2">
      <div className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-bold leading-tight text-foreground">
        {value}
      </div>
      {helper ? (
        <div className="truncate text-[10px] leading-tight text-muted-foreground">
          {helper}
        </div>
      ) : null}
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
