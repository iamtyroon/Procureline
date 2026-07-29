import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProcurementOfficerWorkspaceModalState } from "@/lib/procurement-officer/dashboard";
import { cn } from "@/lib/utils";
import { ProcurementOfficerDeadlinesWorkspace } from "../ProcurementOfficerDeadlinesWorkspace";
import { ProcurementOfficerRequestsWorkspace } from "../ProcurementOfficerRequestsWorkspace";

export function WorkspaceModal({
  activeModal,
  selectedFiscalYear,
  onSelectedFiscalYearChange,
  onClose,
}: {
  activeModal:
    | Extract<
        ProcurementOfficerWorkspaceModalState,
        { modal: "deadlines" | "requests" }
      >
    | null;
  selectedFiscalYear?: string;
  onSelectedFiscalYearChange: (fiscalYear: string) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <Dialog
      open={Boolean(activeModal)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent
        className={cn(
          "border-border/60 p-0 sm:rounded-2xl",
          activeModal?.modal === "deadlines"
            // overflow-visible: lets the absolute-positioned calendar dropdown
            // appear below the date fields without being clipped by the dialog.
            // !top-4 !translate-y-0: anchors modal near top so calendar has room below.
            ? "!top-4 !translate-y-0 max-w-5xl overflow-visible"
            : "max-w-4xl overflow-hidden",
        )}
      >
        <div
          className={cn(
            "border-b border-border/50 bg-muted/20",
            activeModal?.modal === "deadlines" ? "px-5 py-3" : "px-6 py-5",
          )}
        >
          <DialogHeader className="space-y-1.5 text-left">
            <div className="text-[12px] font-medium text-muted-foreground">
              Procurement workspace
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
              {getWorkspaceTitle(activeModal)}
            </DialogTitle>
            <DialogDescription className="max-w-3xl text-[13px] leading-6 text-muted-foreground">
              {getWorkspaceDescription(activeModal)}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div
          className={cn(
            "space-y-5 p-6",
            activeModal?.modal === "deadlines"
              ? "min-h-[6rem] overflow-visible p-4"
              : "max-h-[75vh] overflow-y-auto",
          )}
        >
          {activeModal?.modal === "requests" ? (
            <ProcurementOfficerRequestsWorkspace />
          ) : null}

          {activeModal?.modal === "deadlines" ? (
            <ProcurementOfficerDeadlinesWorkspace
              onSelectedFiscalYearChange={onSelectedFiscalYearChange}
              selectedFiscalYear={selectedFiscalYear}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getWorkspaceTitle(
  activeModal:
    | Extract<
        ProcurementOfficerWorkspaceModalState,
        { modal: "deadlines" | "requests" }
      >
    | null,
): string {
  switch (activeModal?.modal) {
    case "requests":
      return "Requests workspace";
    case "deadlines":
      return "Shared deadline";
    default:
      return "Procurement workspace";
  }
}

function getWorkspaceDescription(
  activeModal:
    | Extract<
        ProcurementOfficerWorkspaceModalState,
        { modal: "deadlines" | "requests" }
      >
    | null,
): string {
  switch (activeModal?.modal) {
    case "requests":
      return "Review item and category requests, approve or deny with audit trails, and track history without leaving the /po shell.";
    case "deadlines":
      return "Set the active fiscal year submission window for all departments.";
    default:
      return "Open a procurement workspace from the dashboard to continue operating inside the /po shell.";
  }
}
