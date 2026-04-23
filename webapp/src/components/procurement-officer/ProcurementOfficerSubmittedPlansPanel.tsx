"use client";

import { useQuery } from "convex/react";
import { Eye } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function getStatusBadgeCopy(status: "approved" | "rejected" | "submitted"): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return "Pending review";
  }
}

function getStatusBadgeClassName(status: "approved" | "rejected" | "submitted"): string {
  switch (status) {
    case "approved":
      return "border-emerald-300/80 bg-emerald-50 text-emerald-900";
    case "rejected":
      return "border-rose-300/80 bg-rose-50 text-rose-900";
    default:
      return "border-amber-300/80 bg-amber-50 text-amber-900";
  }
}

export function ProcurementOfficerSubmittedPlansPanel({
  onOpenReview,
  selectedFiscalYear,
}: {
  onOpenReview: (planId: string) => void;
  selectedFiscalYear?: string;
}): JSX.Element {
  const queueData = useQuery(
    api.functions.procurementOfficerSubmissions.getProcurementOfficerSubmissionQueue,
    selectedFiscalYear ? { selectedFiscalYear } : {},
  );

  if (!queueData) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
        Loading submitted plans...
      </div>
    );
  }

  if (queueData.rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-10 text-center">
        <div className="text-sm font-semibold text-foreground">
          No submitted plans yet
        </div>
        <div className="mt-2 text-sm leading-6 text-muted-foreground">
          Submitted, approved, and rejected plans for the selected fiscal year will appear here as departments move into review.
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background/80">
      <div className="max-h-[22rem] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <TableRow>
              <TableHead>Department</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queueData.rows.map((row) => (
              <TableRow key={row.planId}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">
                      {row.departmentName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.departmentCode ? `Vote: ${row.departmentCode}` : "Vote: --"}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-foreground">
                  {row.submittedAtLabel}
                </TableCell>
                <TableCell className="text-sm text-foreground">
                  {row.itemCount}
                </TableCell>
                <TableCell className="text-sm font-semibold text-emerald-600">
                  {row.totalAmountLabel}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-[0.04em]",
                      getStatusBadgeClassName(row.status),
                    )}
                  >
                    {getStatusBadgeCopy(row.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    className="h-10 rounded-xl px-4"
                    onClick={() => onOpenReview(row.planId)}
                    type="button"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
