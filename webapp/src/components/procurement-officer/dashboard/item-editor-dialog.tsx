import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
  PROCUREMENT_ITEM_PROCUREMENT_METHODS,
  PROCUREMENT_ITEM_UNITS,
} from "@/lib/procurement-officer/items";
import { itemFormSchema, type ItemFormData } from "@/lib/validators/item";
import type { DashboardItemCategoryOption } from "./types";

export function DashboardItemEditorDialog(props: {
  categories: DashboardItemCategoryOption[];
  initialCategoryId: string;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ItemFormData) => Promise<void>;
  open: boolean;
}) {
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
      categoryId: props.initialCategoryId,
      complianceFlags: [],
      customUnit: "",
      maxQuantity: undefined,
      minQuantity: undefined,
      name: "",
      procurementMethod: "RFQ",
      sourceOfFunds: "GOK",
      unit: "each",
      unitPrice: 0,
    },
  });

  useEffect(() => {
    if (!props.open) {
      return;
    }

    form.reset({
      categoryId: props.initialCategoryId,
      complianceFlags: [],
      customUnit: "",
      maxQuantity: undefined,
      minQuantity: undefined,
      name: "",
      procurementMethod: "RFQ",
      sourceOfFunds: "GOK",
      unit: "each",
      unitPrice: 0,
    });
  }, [form, props.initialCategoryId, props.open]);

  const watchedCategoryId = form.watch("categoryId");
  const watchedUnit = form.watch("unit");
  const selectedCategory =
    props.categories.find((category) => category.id === watchedCategoryId) ?? null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[min(96vw,52rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add catalog item</DialogTitle>
          <DialogDescription>
            Add an item to the live procurement catalog and attach it to the right
            category immediately.
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
                        {props.categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
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

            {selectedCategory?.limit.atLimit ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                This category is already at its active-item cap for the current
                plan tier.
              </div>
            ) : null}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => props.onOpenChange(false)}
                disabled={props.isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  props.isSubmitting ||
                  props.categories.length === 0 ||
                  selectedCategory?.limit.atLimit
                }
              >
                {props.isSubmitting ? "Saving..." : "Create item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
