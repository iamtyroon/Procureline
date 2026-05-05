import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SummaryPill } from "./primitives";
import type { ItemImportSummary } from "./types";

export function ImportSummaryDialog(props: {
  summary: ItemImportSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(props.summary)} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Item import summary</DialogTitle>
          <DialogDescription>
            {props.summary
              ? `${props.summary.createdCount} created, ${props.summary.failureCount} failed across ${props.summary.totalRows} workbook rows.`
              : "Review workbook results."}
          </DialogDescription>
        </DialogHeader>
        {props.summary ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryPill
                label="Created"
                value={String(props.summary.createdCount)}
              />
              <SummaryPill
                label="Failed"
                value={String(props.summary.failureCount)}
              />
              <SummaryPill
                label="Rows processed"
                value={String(props.summary.totalRows)}
              />
            </div>
            {props.summary.failures.length > 0 ? (
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="text-sm font-semibold text-foreground">
                  Row-level failures
                </div>
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {props.summary.failures.map((failure) => (
                    <div
                      key={`${failure.rowNumber}-${failure.message}`}
                      className="rounded-2xl border border-border/60 bg-background px-3 py-2 text-sm"
                    >
                      <div className="font-medium text-foreground">
                        Row {failure.rowNumber}
                      </div>
                      <div className="text-muted-foreground">
                        {failure.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                Every workbook row imported successfully.
              </div>
            )}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" onClick={() => props.onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
