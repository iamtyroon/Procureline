import { zodResolver } from "@hookform/resolvers/zod";
import { PackagePlus } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
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
import type { ItemCategoryRow } from "./types";

export function QuickAddItemCard(props: {
  categories: ItemCategoryRow[];
  isSubmitting: boolean;
  selectedCategoryId: string;
  onOpenAdvanced: () => void;
  onSelectedCategoryIdChange: (categoryId: string) => void;
  onSubmit: (values: ItemFormData) => Promise<void>;
}) {
  const selectedCategory =
    props.categories.find(
      (category) => category.id === props.selectedCategoryId,
    ) ?? null;
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
      categoryId: props.selectedCategoryId,
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
  const watchedUnit = form.watch("unit");

  useEffect(() => {
    form.reset({
      categoryId: props.selectedCategoryId,
      complianceFlags: [],
      customUnit: "",
      maxQuantity: undefined,
      minQuantity: undefined,
      name: "",
      procurementMethod: form.getValues("procurementMethod") ?? "RFQ",
      sourceOfFunds: form.getValues("sourceOfFunds") ?? "GOK",
      unit: "each",
      unitPrice: 0,
    });
  }, [form, props.selectedCategoryId]);

  return (
    <div className="rounded-3xl border border-border/70 bg-muted/20 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <PackagePlus className="h-4 w-4" />
            Add Item to Catalog
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Stay in the operator flow: pick the target category, add the live
            catalog row, and leave the heavier edits for the advanced dialog
            only when needed.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={props.onOpenAdvanced}
        >
          Advanced Editor
        </Button>
      </div>

      <Form {...form}>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            void form.handleSubmit(async (values) => {
              await props.onSubmit(values);
              form.reset({
                categoryId: values.categoryId,
                complianceFlags: [],
                customUnit: "",
                maxQuantity: undefined,
                minQuantity: undefined,
                name: "",
                procurementMethod: values.procurementMethod,
                sourceOfFunds: values.sourceOfFunds,
                unit:
                  values.unitOption === "custom"
                    ? "each"
                    : (values.unit ?? "each"),
                unitPrice: 0,
              });
            })(event);
          }}
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      props.onSelectedCategoryIdChange(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose category" />
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

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
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
            <div className="flex items-end">
              <Button
                type="submit"
                className="w-full rounded-xl"
                disabled={
                  props.isSubmitting ||
                  !selectedCategory ||
                  selectedCategory.limit.atLimit
                }
              >
                {props.isSubmitting ? "Adding..." : "Add Item"}
              </Button>
            </div>
          </div>

          {selectedCategory?.limit.atLimit ? (
            <p className="text-xs text-destructive">
              This category is already at its active-item cap for the current
              plan tier.
            </p>
          ) : null}
          {!selectedCategory ? (
            <p className="text-xs text-muted-foreground">
              Create an active category first, then quick add unlocks here.
            </p>
          ) : null}
        </form>
      </Form>
    </div>
  );
}
