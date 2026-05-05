import type { ProcurementDashboardState } from "@/lib/procurement-officer/dashboard";
import type {
  ProcurementOfficerDashboardFuturePanel,
  ProcurementOfficerDashboardSummaryCard,
} from "@/lib/procurement-officer/dashboard-snapshot";
import type { DashboardDepartmentWorkspaceRow } from "./types";

export function formatKesAmount(amount: number): string {
  return `KES ${amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

export function formatDashboardPermanentDeleteRecordSummary(
  counts: DashboardDepartmentWorkspaceRow["permanentDeleteRecordCounts"],
): string {
  const accessCodeCount = counts?.accessCodeCount ?? 0;
  const departmentUserProfileCount = counts?.departmentUserProfileCount ?? 0;
  const planCount = counts?.planCount ?? 0;

  return `This removes ${planCount} plan${planCount === 1 ? "" : "s"}, ${accessCodeCount} department code record${accessCodeCount === 1 ? "" : "s"}, and ${departmentUserProfileCount} DU profile${departmentUserProfileCount === 1 ? "" : "s"}.`;
}

export function findSummaryCard(
  cards: ProcurementOfficerDashboardSummaryCard[],
  id: ProcurementOfficerDashboardSummaryCard["id"],
) {
  return cards.find((c) => c.id === id);
}

export function findFuturePanel(
  panels: ProcurementOfficerDashboardFuturePanel[],
  id: ProcurementOfficerDashboardFuturePanel["id"],
) {
  return panels.find((p) => p.id === id);
}

export function humanizeState(state: ProcurementDashboardState): string {
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

export function getInitials(value: string): string {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "PO";
}
