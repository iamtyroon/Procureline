import { PencilLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildCategoryToolboxStyle,
  getCategoryIconOption,
  getDefaultCategoryIconOption,
} from "@/lib/procurement-officer/categories";
import { cn } from "@/lib/utils";
import type { DashboardCategoryWorkspaceData } from "./types";

export function CategoryManagementRow({
  category,
  density,
  onDelete,
  onEdit,
}: {
  category: DashboardCategoryWorkspaceData["rows"][number];
  density: "compact" | "comfortable";
  onDelete: (category: DashboardCategoryWorkspaceData["rows"][number]) => void;
  onEdit: (category: DashboardCategoryWorkspaceData["rows"][number]) => void;
}) {
  const iconOption =
    getCategoryIconOption(category.icon) ?? getDefaultCategoryIconOption();
  const Icon = iconOption.icon;
  const preview = buildCategoryToolboxStyle({
    color: category.color ?? "",
    icon: category.icon ?? undefined,
  }).preview;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background",
        density === "compact" ? "px-3 py-2" : "px-4 py-3",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl text-white",
            density === "compact" ? "h-8 w-8" : "h-9 w-9",
          )}
          style={{ backgroundColor: preview.color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              "truncate font-medium text-foreground",
              density === "compact" ? "text-sm" : "text-[15px]",
            )}
          >
            {category.name}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border border-border/60 bg-muted/35 text-muted-foreground",
            density === "compact"
              ? "px-2.5 py-1 text-[11px]"
              : "px-3 py-1 text-[12px]",
          )}
        >
          {category.itemCount} item{category.itemCount === 1 ? "" : "s"}
        </span>
        <Button
          aria-label={`Edit ${category.name}`}
          className={cn(
            "border-border/60 bg-background hover:border-primary/30 hover:bg-primary/5",
            density === "compact"
              ? "h-8 w-8 rounded-lg p-0"
              : "h-9 w-9 rounded-xl p-0",
          )}
          onClick={() => onEdit(category)}
          size="sm"
          type="button"
          variant="outline"
        >
          <PencilLine className="h-4 w-4" />
        </Button>
        <Button
          aria-label={`Delete ${category.name}`}
          className={cn(
            "border-border/60 bg-background",
            category.canDelete
              ? "text-rose-500 hover:border-rose-300/60 hover:bg-rose-500/10 hover:text-rose-500"
              : "text-muted-foreground hover:text-muted-foreground",
            density === "compact"
              ? "h-8 w-8 rounded-lg p-0"
              : "h-9 w-9 rounded-xl p-0",
          )}
          onClick={() => onDelete(category)}
          size="sm"
          title={
            category.canDelete
              ? `Delete ${category.name}`
              : category.deleteBlockerMessages[0] ??
                "Category cannot be deleted."
          }
          type="button"
          variant="outline"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
