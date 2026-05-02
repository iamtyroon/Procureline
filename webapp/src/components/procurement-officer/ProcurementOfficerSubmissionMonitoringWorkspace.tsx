"use client";

import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { Download, History, TriangleAlert } from "lucide-react";
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
  const sendReminders = useAction(
    api.functions.procurementOfficerSubmissions.sendSubmissionMonitoringReminders,
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [historyDepartmentId, setHistoryDepartmentId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSending, setIsSending] = useState(false);

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

  async function onSendReminders(departmentIds: string[]): Promise<void> {
    if (!workspace || departmentIds.length === 0) {
      return;
    }

    setIsSending(true);
    try {
      const result = (await sendReminders({
        departmentIds,
        selectedFiscalYear: workspace.meta.selectedFiscalYear,
      })) as {
        failedCount: number;
        queuedCount: number;
        skippedCount: number;
      };
      toast.success(
        `Queued ${result.queuedCount}, skipped ${result.skippedCount}, failed ${result.failedCount}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reminder queueing failed.");
    } finally {
      setIsSending(false);
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
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryPill
          label="Submitted"
          value={workspace.summary.submittedOfTotalLabel}
        />
        <SummaryPill label="Not Started" value={String(workspace.summary.notStarted)} />
        <SummaryPill label="Draft" value={String(workspace.summary.draft)} />
        <SummaryPill label="Submitted" value={String(workspace.summary.submitted)} />
        <SummaryPill label="Rejected" value={String(workspace.summary.rejected)} />
        <SummaryPill label="Approved" value={String(workspace.summary.approved)} />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_10rem_10rem] xl:w-[52rem]">
          <Input
            placeholder="Search department or code"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="not_started">Not started</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
          <Input
            aria-label="Updated from"
            type="date"
            value={updatedFrom}
            onChange={(event) => setUpdatedFrom(event.target.value)}
          />
          <Input
            aria-label="Updated to"
            type="date"
            value={updatedTo}
            onChange={(event) => setUpdatedTo(event.target.value)}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={isExporting || rows.length === 0}
          onClick={onExport}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting..." : "Export report"}
        </Button>
        <Button
          type="button"
          disabled={
            isSending ||
            rows.every((row: any) => row.reminderEligibility.eligible !== true)
          }
          onClick={() =>
            onSendReminders(
              rows
                .filter((row: any) => row.reminderEligibility.eligible === true)
                .map((row: any) => row.departmentId),
            )
          }
        >
          {isSending ? "Queueing..." : "Send eligible reminders"}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-5 py-8 text-center text-sm text-muted-foreground">
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
                <TableHead>Reminder due</TableHead>
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
                  <TableCell>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>{row.dueLabel ?? "Unavailable"}</div>
                      {!row.reminderEligibility.eligible ? (
                        <div className="inline-flex items-center gap-1 text-xs text-amber-700">
                          <TriangleAlert className="h-3.5 w-3.5" />
                          {row.reminderEligibility.reason?.replaceAll("_", " ") ?? "blocked"}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setHistoryDepartmentId(row.departmentId)}
                      >
                        <History className="mr-2 h-4 w-4" />
                        Open history
                      </Button>
                      <Button
                        type="button"
                        disabled={!row.reminderEligibility.eligible || isSending}
                        onClick={() => onSendReminders([row.departmentId])}
                      >
                        Remind
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
              historyRow.timeline.map((item: any) => (
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
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/10 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
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
