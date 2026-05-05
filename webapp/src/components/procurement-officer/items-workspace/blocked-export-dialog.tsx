import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProcurementCatalogExportGuardState } from "@/lib/procurement-officer/catalog-filters";

export function BlockedExportDialog(props: {
  blockedExport: ProcurementCatalogExportGuardState | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog
      open={Boolean(props.blockedExport)}
      onOpenChange={props.onOpenChange}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {props.blockedExport?.title ?? "Catalog export unavailable"}
          </DialogTitle>
          <DialogDescription>
            {props.blockedExport?.description ??
              "Catalog export is currently unavailable."}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">
          {props.blockedExport?.kind === "tier_gate"
            ? "Upgrade to Professional or Enterprise to generate the filtered workbook."
            : "Refine the filter set or upgrade to Enterprise, then try the export again."}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => props.onOpenChange(false)}
          >
            Close
          </Button>
          <Button asChild type="button">
            <Link href="/pricing">View Plans</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
