import { Archive, PencilLine, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProcurementOfficerDashboardDepartmentReadinessItem } from "@/lib/procurement-officer/dashboard-snapshot";
import { cn } from "@/lib/utils";
import { StateBadge } from "./primitives";
import type { DashboardDepartmentWorkspaceRow } from "./types";

export function DepartmentReadinessRow({
  department,
  item,
  onArchiveDepartment,
  onDeleteDepartment,
  onManageDepartment,
  showCoverage = false,
}: {
  department?: DashboardDepartmentWorkspaceRow | null;
  item?: ProcurementOfficerDashboardDepartmentReadinessItem;
  onArchiveDepartment?: () => void;
  onDeleteDepartment?: () => void;
  onManageDepartment: () => void;
  showCoverage?: boolean;
}) {
  const isArchived = department?.isArchived === true;
  const name = department?.name ?? item?.name ?? "Department";
  const voteNumber = department?.code ?? item?.code ?? department?.voteNumber ?? item?.voteNumber ?? "--";
  const blockerSummary = isArchived
    ? "Archived department"
    : item?.blockerSummary ?? "Readiness details are loading.";
  const budgetState = isArchived
    ? "empty"
    : item?.budgetStatus.state ?? "unavailable";
  const budgetLabel = isArchived
    ? "Archived"
    : item?.budgetStatus.label ?? "Budget status loading";

  return (
    <tr
      className={cn(
        "transition hover:bg-muted/20",
        isArchived && "bg-muted/30 text-muted-foreground",
      )}
    >
      <td className="border-b border-border/50 px-3 py-3 text-left">
        <div>
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 text-[13px] font-semibold",
              isArchived ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {name}
            {isArchived ? (
              <Badge
                variant="outline"
                className="rounded-full border-muted-foreground/30 bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Archived
              </Badge>
            ) : null}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {blockerSummary}
          </div>
        </div>
      </td>
      <td className="border-b border-border/50 px-3 py-3 text-left">
        <span className="inline-flex rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground">
          {voteNumber || "--"}
        </span>
      </td>
      <td className="border-b border-border/50 px-3 py-3 text-left">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              budgetState === "available" && "bg-emerald-500",
              budgetState === "setup_required" && "bg-rose-500",
              (budgetState === "empty" || budgetState === "unavailable") &&
                "bg-muted-foreground/50",
            )}
          />
          <span
            className={cn(
              "text-[12px] font-medium",
              isArchived ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {budgetLabel}
          </span>
        </div>
      </td>
      {showCoverage ? (
        <td className="border-b border-border/50 px-3 py-3 text-left">
          <div className="flex flex-wrap gap-1.5">
            <StateBadge
              label={isArchived ? "Archived" : item?.departmentUser.label ?? "DU"}
              state={isArchived ? "empty" : item?.departmentUser.state ?? "unavailable"}
            />
            <StateBadge
              label={isArchived ? "Archived" : item?.accessCode.label ?? "Code"}
              state={isArchived ? "empty" : item?.accessCode.state ?? "unavailable"}
            />
          </div>
        </td>
      ) : null}
      <td className="border-b border-border/50 px-3 py-3 text-right">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-9 rounded-xl border-border/60 bg-background p-0 hover:border-primary/30 hover:bg-primary/5"
            aria-label={`Manage ${name}`}
            disabled={isArchived}
            onClick={onManageDepartment}
            type="button"
          >
            <PencilLine className="h-4 w-4" />
          </Button>
          {department ? (
            <Button
              size="sm"
              variant={isArchived ? "destructive" : "outline"}
              className={cn(
                "h-9 w-9 rounded-xl p-0",
                isArchived
                  ? "border-destructive/70"
                  : "border-border/60 bg-background hover:border-amber-400/40 hover:bg-amber-500/10",
              )}
              aria-label={isArchived ? `Delete ${name}` : `Archive ${name}`}
              onClick={isArchived ? onDeleteDepartment : onArchiveDepartment}
              type="button"
            >
              {isArchived ? (
                <Trash2 className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
