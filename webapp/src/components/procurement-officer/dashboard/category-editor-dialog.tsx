"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Archive, PackagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getProcurementItemCrudErrorMessage,
  getProcurementItemCrudRecoveryHref,
  isProcurementItemCrudAuthorizationError,
  type ProcurementItemWorkspaceRow,
} from "@/lib/procurement-officer/items";
import {
  getCategoryIconOptions,
} from "@/lib/procurement-officer/categories";
import { categoryFormSchema, type CategoryFormData } from "@/lib/validators/category";
import { DashboardConfirmDialog } from "./confirm-dialog";
import type {
  DashboardCategoryItemsBrowseData,
  DashboardCategoryWorkspaceData,
} from "./types";
import { formatKesAmount } from "./utilities";

export function DashboardCategoryEditorDialog({
  category,
  isAddItemPending,
  isSubmitting,
  onAddItem,
  onOpenChange,
  onSubmit,
  open,
}: {
  category: DashboardCategoryWorkspaceData["rows"][number] | null;
  isAddItemPending: boolean;
  isSubmitting: boolean;
  onAddItem: (
    values: CategoryFormData | null,
    categoryId: string | null,
  ) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CategoryFormData) => Promise<void>;
  open: boolean;
}) {
  const router = useRouter();
  const archiveItem = useMutation(api.functions.items.archiveItem);
  const form = useForm<
    { color?: string; description?: string; icon?: string; name: string },
    unknown,
    CategoryFormData
  >({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      color: category?.color ?? "",
      description: category?.description ?? "",
      icon: category?.icon ?? "",
      name: category?.name ?? "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      color: category?.color ?? "",
      description: category?.description ?? "",
      icon: category?.icon ?? "",
      name: category?.name ?? "",
    });
  }, [category, form, open]);
  const categoryItems = useQuery(
    api.functions.items.browseItemsCatalog,
    category?.id
      ? {
          categoryIds: [category.id],
          complianceFlags: [],
          maxPrice: undefined,
          minPrice: undefined,
          page: 1,
          pageSize: 100,
          searchText: "",
        }
      : "skip",
  ) as DashboardCategoryItemsBrowseData | undefined;
  const [archiveTarget, setArchiveTarget] =
    useState<ProcurementItemWorkspaceRow | null>(null);
  const [isArchivingItem, setIsArchivingItem] = useState(false);

  async function handleArchiveItem(): Promise<void> {
    if (!archiveTarget) {
      return;
    }

    setIsArchivingItem(true);
    try {
      await archiveItem({
        expectedRevision: archiveTarget.revision,
        itemId: archiveTarget.id as never,
      });
      toast.success("Item archived.");
      setArchiveTarget(null);
    } catch (error) {
      if (isProcurementItemCrudAuthorizationError(error)) {
        toast.error("Your access changed. Redirecting to refresh your workspace.");
        setArchiveTarget(null);
        router.replace(getProcurementItemCrudRecoveryHref());
        return;
      }

      toast.error(getProcurementItemCrudErrorMessage(error));
    } finally {
      setIsArchivingItem(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setArchiveTarget(null);
        }
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[min(96vw,72rem)] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-12 sm:pr-14">
            <div className="space-y-1.5">
              <DialogTitle>
                {category ? `Edit ${category.name}` : "Create category"}
              </DialogTitle>
              <DialogDescription>
                {category
                  ? "Update the category details used across the procurement dashboard."
                  : "Add a new category to the procurement dashboard catalog."}
              </DialogDescription>
              {category?.planningImpactWarning ? (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="inline-flex w-fit cursor-help items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 transition hover:border-amber-400/60 hover:bg-amber-500/15 dark:border-amber-300/60 dark:text-amber-100"
                        type="button"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Active plan warning
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      align="start"
                      className="max-w-sm border-amber-300/30 bg-slate-950 text-slate-50"
                      side="bottom"
                    >
                      <p className="text-sm leading-5">
                        {category.planningImpactWarning}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 rounded-xl"
              disabled={isSubmitting || isAddItemPending}
              onClick={() => {
                if (category?.id) {
                  void onAddItem(null, category.id);
                  return;
                }

                void form.handleSubmit(async (values) => {
                  await onAddItem(values, null);
                })();
              }}
            >
              <PackagePlus className="mr-2 h-4 w-4" />
              {isAddItemPending ? "Preparing..." : "Add item"}
            </Button>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              void form.handleSubmit(onSubmit)(event);
            }}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category name</FormLabel>
                  <FormControl>
                    <Input placeholder="Stationery" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional guidance for procurement operators."
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="#4A90D9"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an icon" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getCategoryIconOptions().map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/15">
              <div className="border-b border-border/60 px-4 py-3">
                <div className="text-sm font-semibold text-foreground">
                  Current Items in Category
                </div>
              </div>
              {category?.id ? (
                categoryItems?.rows.length ? (
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryItems.rows.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium text-foreground">
                              {item.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.unitOfMeasurement ?? "Not set"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatKesAmount(item.unitPrice ?? 0)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.procurementMethod ?? "Not set"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.sourceOfFunds ?? "Not set"}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                                  aria-label={`Archive ${item.name}`}
                                  onClick={() => setArchiveTarget(item)}
                                >
                                  <Archive className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    No items in this category yet. Use <span className="font-medium text-foreground">Add item</span> to create the first one.
                  </div>
                )
              ) : (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Items will appear here after the category is created.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : category
                    ? "Save changes"
                    : "Create category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        <DashboardConfirmDialog
          body="This archives the item from the live procurement catalog for this category."
          confirmLabel="Archive item"
          description={
            archiveTarget
              ? `Archive ${archiveTarget.name} from this category.`
              : "Archive the selected item."
          }
          isPending={isArchivingItem}
          onConfirm={() => {
            void handleArchiveItem();
          }}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setArchiveTarget(null);
            }
          }}
          open={Boolean(archiveTarget)}
          title={
            archiveTarget
              ? `Archive ${archiveTarget.name}?`
              : "Archive item?"
          }
        />
      </DialogContent>
    </Dialog>
  );
}
