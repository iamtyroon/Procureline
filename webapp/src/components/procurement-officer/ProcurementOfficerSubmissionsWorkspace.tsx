"use client";

import { startTransition, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  formatProcurementFiscalYearLabel,
} from "@/lib/procurement-officer/dashboard";
import {
  buildProcurementOfficerSubmissionModalPath,
  buildProcurementOfficerSubmissionReviewHref,
  buildProcurementOfficerSubmissionSearchParams,
  collectProcurementOfficerSubmissionNotifications,
  deriveProcurementOfficerSubmissionEmptyState,
  filterProcurementOfficerSubmissionRows,
  hasActiveProcurementOfficerSubmissionFilters,
  normalizeProcurementOfficerSubmissionFilters,
  PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS,
  sortProcurementOfficerSubmissionRows,
  type ProcurementOfficerSubmissionFilterInput,
  type ProcurementOfficerSubmissionSortDirection,
  type ProcurementOfficerSubmissionSortField,
  type ProcurementOfficerSubmissionStatus,
} from "@/lib/procurement-officer/submissions";
import { cn } from "@/lib/utils";

function getSubmissionNoticeCopy(notice: string | null): string | null {
  if (notice === "review-target-unavailable") {
    return "That plan is no longer available for review. It may have been withdrawn, moved back to draft, or removed from your current queue scope.";
  }

  return null;
}

function getSubmissionBadgeClassName(status: string): string {
  switch (status) {
    case "approved":
      return "border-emerald-300/70 bg-emerald-50 text-emerald-900";
    case "rejected":
      return "border-rose-300/70 bg-rose-50 text-rose-900";
    default:
      return "border-sky-300/70 bg-sky-50 text-sky-900";
  }
}

export function ProcurementOfficerSubmissionsWorkspace({
  selectedFiscalYear,
}: {
  selectedFiscalYear?: string;
}): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queueData = useQuery(
    api.functions.procurementOfficerSubmissions.getProcurementOfficerSubmissionQueue,
    selectedFiscalYear ? { selectedFiscalYear } : {},
  );
  const hasHydratedQueueRef = useRef(false);
  const knownPlanIdsRef = useRef<Set<string>>(new Set());
  const previousVisiblePlanIdsRef = useRef<Set<string>>(new Set());
  const notifiedPlanIdsRef = useRef<Set<string>>(new Set());
  const rawNotice = searchParams.get(
    PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.notice,
  );
  const rawSortBy = searchParams.get(
    PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.sortBy,
  );
  const rawSortDirection = searchParams.get(
    PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.direction,
  );
  const rawStatus = searchParams.get(
    PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.status,
  );

  const filters = useMemo(
    () =>
      normalizeProcurementOfficerSubmissionFilters(
        {
          departmentId: searchParams.get(
            PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.departmentId,
          ),
          endDate: searchParams.get(
            PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.endDate,
          ),
          notice:
            rawNotice === "review-target-unavailable"
              ? rawNotice
              : null,
          sortBy:
            rawSortBy === "submittedAt" ||
            rawSortBy === "departmentName" ||
            rawSortBy === "estimatedBudgetUsed" ||
            rawSortBy === "status"
              ? rawSortBy
              : null,
          sortDirection:
            rawSortDirection === "asc" || rawSortDirection === "desc"
              ? rawSortDirection
              : null,
          startDate: searchParams.get(
            PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.startDate,
          ),
          status:
            rawStatus === "submitted" ||
            rawStatus === "approved" ||
            rawStatus === "rejected"
              ? rawStatus
              : null,
        },
        {
          tenantTimeZone: queueData?.meta.tenantTimeZone,
        },
      ),
    [queueData?.meta.tenantTimeZone, rawNotice, rawSortBy, rawSortDirection, rawStatus, searchParams],
  );

  const visibleRows = useMemo(() => {
    if (!queueData) {
      return [];
    }

    return sortProcurementOfficerSubmissionRows(
      filterProcurementOfficerSubmissionRows(queueData.rows, filters),
      {
        direction: filters.sortDirection,
        sortBy: filters.sortBy,
      },
    );
  }, [filters, queueData]);

  useEffect(() => {
    if (!queueData) {
      return;
    }

    const nextKnownPlanIds = new Set(queueData.rows.map((row) => row.planId));

    if (!hasHydratedQueueRef.current) {
      hasHydratedQueueRef.current = true;
      knownPlanIdsRef.current = nextKnownPlanIds;
      previousVisiblePlanIdsRef.current = new Set(
        visibleRows.map((row) => row.planId),
      );
      return;
    }

    const notificationResult = collectProcurementOfficerSubmissionNotifications({
      nextRows: visibleRows,
      notifiedPlanIds: notifiedPlanIdsRef.current,
      previousKnownPlanIds: knownPlanIdsRef.current,
      previousVisiblePlanIds: previousVisiblePlanIdsRef.current,
    });

    notificationResult.notifications.forEach((row) => {
      toast.success(`New submission from ${row.departmentName}`);
    });

    notifiedPlanIdsRef.current = notificationResult.notifiedPlanIds;
    knownPlanIdsRef.current = nextKnownPlanIds;
    previousVisiblePlanIdsRef.current = new Set(
      visibleRows.map((row) => row.planId),
    );
  }, [queueData, visibleRows]);

  function replaceSearchParams(
    nextState: ProcurementOfficerSubmissionFilterInput,
  ): void {
    const href = buildProcurementOfficerSubmissionModalPath({
      submissionWorkspaceSearchParams: buildProcurementOfficerSubmissionSearchParams(
        nextState,
      ),
    });

    startTransition(() => router.replace(href));
  }

  function clearNotice(): void {
    replaceSearchParams({
      departmentId: filters.departmentId,
      endDate: filters.endDate,
      notice: null,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
      startDate: filters.startDate,
      status: filters.status,
    });
  }

  function clearFilters(): void {
    replaceSearchParams({
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
    });
  }

  if (!queueData) {
    return (
      <div className="rounded-2xl border border-border/70 bg-muted/10 p-6 text-sm text-muted-foreground">
        Loading submission queue...
      </div>
    );
  }

  const noticeCopy = getSubmissionNoticeCopy(filters.notice);
  const emptyState =
    visibleRows.length === 0
      ? deriveProcurementOfficerSubmissionEmptyState({
          filteredCount: visibleRows.length,
          hasActiveFilters: hasActiveProcurementOfficerSubmissionFilters(filters),
          selectedFiscalYearCount: queueData.meta.selectedFiscalYearCount,
          selectedFiscalYearLabel: queueData.meta.selectedFiscalYearLabel,
          totalCount: queueData.meta.totalCount,
        })
      : null;

  return (
    <div className="space-y-5">
      {noticeCopy ? (
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="leading-6">{noticeCopy}</p>
          <Button type="button" variant="outline" onClick={clearNotice}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">
              Submission queue
            </div>
            <div className="text-sm text-muted-foreground">
              Live plan states for{" "}
              {selectedFiscalYear
                ? formatProcurementFiscalYearLabel(selectedFiscalYear)
                : queueData.meta.selectedFiscalYearLabel}
              . Draft plans stay excluded.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{queueData.meta.selectedFiscalYearCount} in scope</span>
            <span>{queueData.meta.totalCount} tenant-wide</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-6">
          <Select
            value={filters.status ?? "all"}
            onValueChange={(value) =>
              replaceSearchParams({
                departmentId: filters.departmentId,
                endDate: filters.endDate,
                notice: null,
                sortBy: filters.sortBy,
                sortDirection: filters.sortDirection,
                startDate: filters.startDate,
                status: value as ProcurementOfficerSubmissionStatus | "all",
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.departmentId ?? "all"}
            onValueChange={(value) =>
              replaceSearchParams({
                departmentId: value === "all" ? null : value,
                endDate: filters.endDate,
                notice: null,
                sortBy: filters.sortBy,
                sortDirection: filters.sortDirection,
                startDate: filters.startDate,
                status: filters.status,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {queueData.departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filters.startDate ?? ""}
            onChange={(event) =>
              replaceSearchParams({
                departmentId: filters.departmentId,
                endDate: filters.endDate,
                notice: null,
                sortBy: filters.sortBy,
                sortDirection: filters.sortDirection,
                startDate: event.target.value || null,
                status: filters.status,
              })
            }
          />

          <Input
            type="date"
            value={filters.endDate ?? ""}
            onChange={(event) =>
              replaceSearchParams({
                departmentId: filters.departmentId,
                endDate: event.target.value || null,
                notice: null,
                sortBy: filters.sortBy,
                sortDirection: filters.sortDirection,
                startDate: filters.startDate,
                status: filters.status,
              })
            }
          />

          <Select
            value={filters.sortBy}
            onValueChange={(value) =>
              replaceSearchParams({
                departmentId: filters.departmentId,
                endDate: filters.endDate,
                notice: null,
                sortBy: value as ProcurementOfficerSubmissionSortField,
                sortDirection: filters.sortDirection,
                startDate: filters.startDate,
                status: filters.status,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="submittedAt">Submission date</SelectItem>
              <SelectItem value="departmentName">Department</SelectItem>
              <SelectItem value="estimatedBudgetUsed">Amount</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.sortDirection}
            onValueChange={(value) =>
              replaceSearchParams({
                departmentId: filters.departmentId,
                endDate: filters.endDate,
                notice: null,
                sortBy: filters.sortBy,
                sortDirection: value as ProcurementOfficerSubmissionSortDirection,
                startDate: filters.startDate,
                status: filters.status,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {emptyState ? (
          <div className="mt-4 rounded-2xl border border-border/70 bg-muted/10 px-5 py-6">
            <div className="text-base font-semibold text-foreground">
              {emptyState.title}
            </div>
            <div className="mt-2 text-sm leading-6 text-muted-foreground">
              {emptyState.description}
            </div>
            {emptyState.showClearFilters ? (
              <div className="mt-4">
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.planId}>
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
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {row.submittedAtLabel}
                        </div>
                        {row.urgencyLabel ? (
                          <Badge
                            variant="outline"
                            className="border-amber-300/70 bg-amber-50 text-amber-900"
                          >
                            {row.urgencyLabel}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-border/70 text-xs",
                          getSubmissionBadgeClassName(row.status),
                        )}
                      >
                        {row.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.itemCount}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">
                      {row.totalAmountLabel}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          router.push(
                            buildProcurementOfficerSubmissionReviewHref({
                              planId: row.planId,
                              returnToSearchParams: searchParams,
                            }),
                          )
                        }
                      >
                        Open review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
