import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  buildProcurementItemEditorCategoryOptions,
  hasMeaningfulItemDraftValues,
  PROCUREMENT_ITEM_COMPLIANCE_FLAGS,
  PROCUREMENT_ITEM_PROCUREMENT_METHODS,
  PROCUREMENT_ITEM_UNITS,
  type ProcurementItemComplianceFlag,
  type ProcurementItemProcurementMethod,
  type StoredItemDraft,
} from "@/lib/procurement-officer/items";
import { itemFormSchema, type ItemFormData } from "@/lib/validators/item";
import type { ItemCategoryRow, ItemRow } from "./types";
import { formatComplianceFlagLabel } from "./utilities";

export function ItemEditorDialog(props: {
  categories: ItemCategoryRow[];
  categoryContext: ItemCategoryRow | null;
  item: ItemRow | null;
  isSubmitting: boolean;
  onDraftChange: (draft: StoredItemDraft | null) => void;
  onDiscardDraft: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ItemFormData) => Promise<void>;
  open: boolean;
  requiresDiscardConfirmation: boolean;
}) {
  const categoryOptions = buildProcurementItemEditorCategoryOptions({
    categories: props.categories,
    selectedCategoryId:
      props.item?.categoryId ?? props.categoryContext?.id ?? null,
  });
  const form = useForm<
    {
      categoryId: string;
      complianceFlags: string[];
      customUnit?: string;
      maxQuantity?: number;
      minQuantity?: number;
      name: string;
      procurementMethod?: string;
      sourceOfFunds?: string;
      unit: string;
      unitPrice: number;
    },
    unknown,
    ItemFormData
  >({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      categoryId: props.item?.categoryId ?? props.categoryContext?.id ?? "",
      complianceFlags: props.item?.complianceFlags ?? [],
      customUnit:
        props.item?.unitOfMeasurement &&
        !PROCUREMENT_ITEM_UNITS.includes(
          props.item
            .unitOfMeasurement as (typeof PROCUREMENT_ITEM_UNITS)[number],
        )
          ? props.item.unitOfMeasurement
          : "",
      maxQuantity: props.item?.maxQuantity ?? undefined,
      minQuantity: props.item?.minQuantity ?? undefined,
      name: props.item?.name ?? "",
      procurementMethod: props.item?.procurementMethod ?? "RFQ",
      sourceOfFunds: props.item?.sourceOfFunds ?? "GOK",
      unit:
        props.item?.unitOfMeasurement &&
        PROCUREMENT_ITEM_UNITS.includes(
          props.item
            .unitOfMeasurement as (typeof PROCUREMENT_ITEM_UNITS)[number],
        )
          ? props.item.unitOfMeasurement
          : props.item
            ? "custom"
            : "each",
      unitPrice: props.item?.unitPrice ?? 0,
    },
  });
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  useEffect(() => {
    if (!props.open) {
      return;
    }

    form.reset({
      categoryId: props.item?.categoryId ?? props.categoryContext?.id ?? "",
      complianceFlags: props.item?.complianceFlags ?? [],
      customUnit:
        props.item?.unitOfMeasurement &&
        !PROCUREMENT_ITEM_UNITS.includes(
          props.item
            .unitOfMeasurement as (typeof PROCUREMENT_ITEM_UNITS)[number],
        )
          ? props.item.unitOfMeasurement
          : "",
      maxQuantity: props.item?.maxQuantity ?? undefined,
      minQuantity: props.item?.minQuantity ?? undefined,
      name: props.item?.name ?? "",
      procurementMethod: props.item?.procurementMethod ?? "RFQ",
      sourceOfFunds: props.item?.sourceOfFunds ?? "GOK",
      unit:
        props.item?.unitOfMeasurement &&
        PROCUREMENT_ITEM_UNITS.includes(
          props.item
            .unitOfMeasurement as (typeof PROCUREMENT_ITEM_UNITS)[number],
        )
          ? props.item.unitOfMeasurement
          : props.item
            ? "custom"
            : "each",
      unitPrice: props.item?.unitPrice ?? 0,
    });
  }, [form, props.categoryContext?.id, props.item, props.open]);

  const watchedCategoryId = form.watch("categoryId");
  const watchedComplianceFlags = form.watch("complianceFlags");
  const watchedCustomUnit = form.watch("customUnit");
  const watchedMaxQuantity = form.watch("maxQuantity");
  const watchedMinQuantity = form.watch("minQuantity");
  const watchedName = form.watch("name");
  const watchedMethod = form.watch("procurementMethod");
  const watchedSourceOfFunds = form.watch("sourceOfFunds");
  const watchedUnit = form.watch("unit");
  const watchedUnitPrice = form.watch("unitPrice");

  useEffect(() => {
    if (!props.open) {
      return;
    }

    const category = props.categories.find(
      (entry) => entry.id === watchedCategoryId,
    );
    const draft: StoredItemDraft = {
      categoryId: watchedCategoryId || null,
      categoryName: category?.name ?? null,
      complianceFlags:
        (watchedComplianceFlags as
          | ProcurementItemComplianceFlag[]
          | undefined) ?? [],
      customUnit: watchedCustomUnit ?? null,
      id: props.item?.id ?? "",
      maxQuantity:
        typeof watchedMaxQuantity === "number" ? watchedMaxQuantity : null,
      minQuantity:
        typeof watchedMinQuantity === "number" ? watchedMinQuantity : null,
      name: watchedName,
      procurementMethod:
        (watchedMethod as ProcurementItemProcurementMethod | undefined) ?? null,
      revision: props.item?.revision ?? 0,
      sourceOfFunds: watchedSourceOfFunds ?? null,
      unit: watchedUnit,
      unitPrice: typeof watchedUnitPrice === "number" ? watchedUnitPrice : null,
    };

    props.onDraftChange(hasMeaningfulItemDraftValues(draft) ? draft : null);
  }, [
    props,
    props.categories,
    props.item?.id,
    props.item?.revision,
    props.onDraftChange,
    props.open,
    watchedCategoryId,
    watchedComplianceFlags,
    watchedCustomUnit,
    watchedMaxQuantity,
    watchedMethod,
    watchedMinQuantity,
    watchedName,
    watchedSourceOfFunds,
    watchedUnit,
    watchedUnitPrice,
  ]);

  function requestClose(): void {
    const shouldConfirm =
      !props.isSubmitting &&
      (form.formState.isDirty ||
        (props.requiresDiscardConfirmation &&
          hasMeaningfulItemDraftValues({
            categoryId: form.getValues("categoryId"),
            complianceFlags: form.getValues(
              "complianceFlags",
            ) as ProcurementItemComplianceFlag[],
            customUnit: form.getValues("customUnit"),
            maxQuantity: form.getValues("maxQuantity"),
            minQuantity: form.getValues("minQuantity"),
            name: form.getValues("name"),
            procurementMethod: form.getValues("procurementMethod") as
              | ProcurementItemProcurementMethod
              | undefined,
            sourceOfFunds: form.getValues("sourceOfFunds"),
            unit: form.getValues("unit"),
            unitPrice: form.getValues("unitPrice"),
          })));

    if (shouldConfirm) {
      setIsDiscardDialogOpen(true);
      return;
    }

    props.onDiscardDraft();
    props.onOpenChange(false);
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          props.onOpenChange(true);
          return;
        }
        requestClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {props.item?.id ? `Edit ${props.item.name}` : "Add catalog item"}
          </DialogTitle>
          <DialogDescription>
            Keep item identity stable while setting price, unit, quantity
            bounds, and compliance defaults.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              void form.handleSubmit(props.onSubmit)(event);
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.isPreservedInactiveSelection
                              ? `${category.name} (Archived)`
                              : category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Laptop Computer Core i7" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROCUREMENT_ITEM_UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                        onChange={(event) =>
                          field.onChange(event.target.valueAsNumber)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="procurementMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proc Method</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "RFQ"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROCUREMENT_ITEM_PROCUREMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {watchedUnit === "custom" ? (
              <FormField
                control={form.control}
                name="customUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Unit</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="service"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="sourceOfFunds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Of Funds</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="GOK"
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
                name="minQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === ""
                              ? undefined
                              : event.target.valueAsNumber,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === ""
                              ? undefined
                              : event.target.valueAsNumber,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="complianceFlags"
              render={() => (
                <FormItem>
                  <FormLabel>Compliance Flags</FormLabel>
                  <div className="grid gap-3 md:grid-cols-3">
                    {PROCUREMENT_ITEM_COMPLIANCE_FLAGS.map((flag) => (
                      <FormField
                        key={flag}
                        control={form.control}
                        name="complianceFlags"
                        render={({ field }) => {
                          const currentValues = field.value;
                          return (
                            <FormItem className="flex items-center gap-3 rounded-2xl border border-border/70 px-3 py-3">
                              <FormControl>
                                <Checkbox
                                  checked={currentValues.includes(flag)}
                                  onCheckedChange={(checked) => {
                                    field.onChange(
                                      checked
                                        ? [...currentValues, flag]
                                        : currentValues.filter(
                                            (value) => value !== flag,
                                          ),
                                    );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="m-0 capitalize">
                                {formatComplianceFlagLabel(flag)}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={requestClose}
                disabled={props.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={props.isSubmitting}>
                {props.isSubmitting
                  ? "Saving..."
                  : props.item?.id
                    ? "Save changes"
                    : "Create item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        <Dialog
          open={isDiscardDialogOpen}
          onOpenChange={setIsDiscardDialogOpen}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Discard item draft?</DialogTitle>
              <DialogDescription>
                Your unsaved item details will be removed from this flow.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDiscardDialogOpen(false)}
              >
                Keep editing
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setIsDiscardDialogOpen(false);
                  props.onDiscardDraft();
                  props.onOpenChange(false);
                }}
              >
                Discard draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
