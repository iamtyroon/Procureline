"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
    catalogCategoryRequestFormSchema,
    catalogItemRequestFormSchema,
    type CatalogCategoryRequestFormValues,
    type CatalogItemRequestFormValues,
} from "@/lib/procurement/catalog-requests";

export interface CatalogRequestCategoryOption {
    id: string;
    name: string;
}

export function CatalogRequestDialog(props: {
    activeTab: "category" | "item";
    categories: CatalogRequestCategoryOption[];
    categoryDefaults: CatalogCategoryRequestFormValues;
    categorySubmitLabel: string;
    itemDefaults: CatalogItemRequestFormValues;
    itemSubmitLabel: string;
    lockedCategoryLabel?: string | null;
    onOpenChange: (open: boolean) => void;
    onSubmitCategory: (values: CatalogCategoryRequestFormValues) => Promise<void>;
    onSubmitItem: (
        values: CatalogItemRequestFormValues,
        categoryDraft: CatalogCategoryRequestFormValues,
    ) => Promise<void>;
    open: boolean;
    readOnly?: boolean;
    title: string;
}) {
    const [activeTab, setActiveTab] = useState<"category" | "item">(props.activeTab);
    const itemForm = useForm<CatalogItemRequestFormValues>({
        defaultValues: props.itemDefaults,
        resolver: zodResolver(catalogItemRequestFormSchema),
    });
    const categoryForm = useForm<CatalogCategoryRequestFormValues>({
        defaultValues: props.categoryDefaults,
        resolver: zodResolver(catalogCategoryRequestFormSchema),
    });

    useEffect(() => {
        if (!props.open) {
            return;
        }

        setActiveTab(props.activeTab);
        itemForm.reset(props.itemDefaults);
        categoryForm.reset(props.categoryDefaults);
    }, [
        categoryForm,
        itemForm,
        props.activeTab,
        props.categoryDefaults,
        props.itemDefaults,
        props.open,
    ]);

    const itemCategoryMode = itemForm.watch("categoryMode");
    const watchedCategoryName = categoryForm.watch("name");
    const handleItemSubmit = itemForm.handleSubmit(async (values) => {
        if (values.categoryMode === "request") {
            const categoryDraftIsValid = await categoryForm.trigger();
            if (!categoryDraftIsValid) {
                setActiveTab("category");
                return;
            }
        }

        await props.onSubmitItem(values, categoryForm.getValues());
    });
    const handleCategorySubmit = categoryForm.handleSubmit((values) =>
        props.onSubmitCategory(values),
    );

    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent className="max-w-3xl rounded-[28px] border-border/70 p-0">
                <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
                    <DialogHeader className="space-y-3 text-left">
                        <Badge variant="outline" className="w-fit rounded-full">
                            Catalog request
                        </Badge>
                        <DialogTitle className="text-2xl tracking-[-0.04em] text-foreground">
                            {props.title}
                        </DialogTitle>
                        <DialogDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
                            Submit missing catalog needs without leaving the current planning workspace. Switching tabs keeps the current drafts in place.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="space-y-5 p-6">
                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "category" | "item")}>
                        <TabsList className="h-auto rounded-full border border-border/70 bg-card p-1">
                            <TabsTrigger className="rounded-full px-4 py-2" value="item">
                                Item request
                            </TabsTrigger>
                            <TabsTrigger className="rounded-full px-4 py-2" value="category">
                                Category request
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent className="mt-5" value="item">
                            <Form {...itemForm}>
                                <form
                                    className="space-y-4"
                                    onSubmit={(event) => {
                                        void handleItemSubmit(event);
                                    }}
                                >
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <FormField
                                            control={itemForm.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Item name</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Laptop docking station" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={itemForm.control}
                                            name="estimatedUnitPrice"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Estimated unit price</FormLabel>
                                                    <FormControl>
                                                        <Input inputMode="decimal" placeholder="25000" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={itemForm.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Description</FormLabel>
                                                <FormControl>
                                                    <Textarea rows={3} placeholder="What should the catalog entry cover?" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={itemForm.control}
                                        name="justification"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Justification</FormLabel>
                                                <FormControl>
                                                    <Textarea rows={3} placeholder="Why is this needed for the procurement plan?" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {props.lockedCategoryLabel ? (
                                        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                                            This pending item request stays anchored to {props.lockedCategoryLabel}.
                                        </div>
                                    ) : (
                                        <>
                                            <FormField
                                                control={itemForm.control}
                                                name="categoryMode"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Category anchor</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Choose how this item should be anchored" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="existing">Existing active category</SelectItem>
                                                                <SelectItem value="request">Category request handoff</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {itemCategoryMode === "existing" ? (
                                                <FormField
                                                    control={itemForm.control}
                                                    name="categoryId"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Existing category</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Choose an active category" />
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
                                            ) : (
                                                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                                                    The item request will link to the category request draft in the next tab.
                                                    {watchedCategoryName.trim()
                                                        ? ` Current category draft: ${watchedCategoryName.trim()}.`
                                                        : " Add the category draft details before submitting."}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div className="flex justify-end gap-2">
                                        <Button onClick={() => props.onOpenChange(false)} type="button" variant="outline">
                                            Close
                                        </Button>
                                        <Button disabled={props.readOnly} type="submit">
                                            {props.itemSubmitLabel}
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </TabsContent>

                        <TabsContent className="mt-5" value="category">
                            <Form {...categoryForm}>
                                <form
                                    className="space-y-4"
                                    onSubmit={(event) => {
                                        void handleCategorySubmit(event);
                                    }}
                                >
                                    <FormField
                                        control={categoryForm.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Category name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Laboratory Equipment" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={categoryForm.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Description</FormLabel>
                                                <FormControl>
                                                    <Textarea rows={3} placeholder="Describe the missing category and what it should cover." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={categoryForm.control}
                                        name="justification"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Justification</FormLabel>
                                                <FormControl>
                                                    <Textarea rows={3} placeholder="Why should this category exist for planning?" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="flex justify-end gap-2">
                                        <Button onClick={() => props.onOpenChange(false)} type="button" variant="outline">
                                            Close
                                        </Button>
                                        <Button disabled={props.readOnly} type="submit">
                                            {props.categorySubmitLabel}
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
