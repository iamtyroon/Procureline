import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ItemRow } from "./types";

export function ArchiveItemDialog(props: {
  isPending: boolean;
  item: ItemRow | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(props.item)} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {props.item ? `Archive ${props.item.name}?` : "Archive item"}
          </DialogTitle>
          <DialogDescription>
            Archived items disappear from new catalog selection while staying
            resolvable for saved plans.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">
          Existing DU plans continue to resolve this item by its stable
          document ID after archival.
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => props.onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={props.isPending}
            onClick={props.onConfirm}
          >
            {props.isPending ? "Archiving..." : "Archive item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
