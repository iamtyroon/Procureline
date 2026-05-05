import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex min-w-[10.5rem] items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold tracking-[-0.02em] text-foreground">
        {value}
      </div>
    </div>
  );
}

export function ActiveFilterChip(props: {
  label: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-border hover:bg-muted/40"
      onClick={props.onClear}
    >
      <span>{props.label}</span>
      <X className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

export function CatalogPagination(props: {
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalPages: number;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        disabled={!props.hasPreviousPage}
        onClick={props.onPrevious}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        Page {props.currentPage} of {Math.max(props.totalPages, 1)}
      </Badge>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        disabled={!props.hasNextPage}
        onClick={props.onNext}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
