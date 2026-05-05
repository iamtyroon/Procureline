import { Building2, CalendarClock, FileStack } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
          "border-border/70 p-0 sm:rounded-[28px]",
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
            "border-b border-border/70 bg-muted/35",
            activeModal?.modal === "deadlines" ? "px-5 py-3" : "px-6 py-5",
          )}
        >
          <DialogHeader
            className={cn(
              "text-left",
              activeModal?.modal === "deadlines" ? "space-y-2" : "space-y-3",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex items-center justify-center bg-primary/10 text-primary",
                  activeModal?.modal === "deadlines"
                    ? "h-8 w-8 rounded-lg"
                    : "h-11 w-11 rounded-2xl",
                )}
              >
                {activeModal ? (
                  getWorkspaceIcon(activeModal.modal)
                ) : (
                  <Building2 className="h-5 w-5" />
                )}
              </div>
              <Badge
                variant="outline"
                className="rounded-full border-primary/20 bg-primary/10 text-primary"
              >
                Procurement workspace
              </Badge>
            </div>
            <DialogTitle
              className={cn(
                "tracking-[-0.04em] text-foreground",
                activeModal?.modal === "deadlines" ? "text-xl" : "text-2xl",
              )}
            >
              {getWorkspaceTitle(activeModal)}
            </DialogTitle>
            <DialogDescription
              className={cn(
                "max-w-3xl text-sm text-muted-foreground",
                activeModal?.modal === "deadlines" ? "leading-5" : "leading-7",
              )}
            >
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

function getWorkspaceIcon(
  modal: "deadlines" | "requests",
) {
  switch (modal) {
    case "requests":
      return <FileStack className="h-5 w-5" />;
    case "deadlines":
      return <CalendarClock className="h-5 w-5" />;
  }
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
