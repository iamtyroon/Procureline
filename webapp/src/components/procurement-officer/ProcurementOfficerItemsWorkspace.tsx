"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAction, useMutation, useQuery } from "convex/react";
import {
    Archive,
    Download,
    FolderTree,
    PackagePlus,
    Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { buildProcurementOfficerWorkspaceModalPath } from "@/lib/procurement-officer/dashboard";
import {
    CATEGORY_DRAFT_STORAGE_KEY,
    parseStoredCategoryDraft,
} from "@/lib/procurement-officer/categories";
import {
    buildProcurementItemEditorCategoryOptions,
    buildProcurementItemTemplateRows,
    buildProcurementItemTierLimitModalContent,
    getProcurementItemCrudErrorMessage,
    getProcurementItemCrudRecoveryHref,
    hasMeaningfulItemDraftValues,
    isProcurementItemCrudAuthorizationError,
    isProcurementItemTierLimitMessage,
    ITEM_DRAFT_STORAGE_KEY,
    parseStoredItemDraft,
    PROCUREMENT_ITEM_COMPLIANCE_FLAGS,
    PROCUREMENT_ITEM_PROCUREMENT_METHODS,
    PROCUREMENT_ITEM_UNITS,
    resolveProcurementItemDraftCategoryId,
    type ProcurementItemComplianceFlag,
    type ProcurementItemProcurementMethod,
    type StoredItemDraft,
} from "@/lib/procurement-officer/items";
import { itemFormSchema, type ItemFormData } from "@/lib/validators/item";

interface ItemCategoryRow {
    activeItemCount: number;
    id: string;
    isActive: boolean;
    limit: {
        atLimit: boolean;
        limit: number | null;
        remainingSlots: number | null;
        tier: "enterprise" | "free" | "professional" | "starter";
        tierLabel: string;
        upgradeHref: string;
    };
    name: string;
    sortOrder: number;
}

interface ItemRow {
    archivedLabel: string | null;
    categoryId: string;
    categoryLimit: ItemCategoryRow["limit"];
    categoryName: string;
    complianceFlags: ProcurementItemComplianceFlag[];
    complianceSummary: string;
    id: string;
    isActive: boolean;
    lastPriceChangedAt: number | null;
    maxQuantity: number | null;
    minQuantity: number | null;
    name: string;
    procurementMethod: string | null;
    revision: number;
    sourceOfFunds: string | null;
    unitOfMeasurement: string | null;
    unitPrice: number | null;
}

interface ItemsWorkspaceData {
    categories: ItemCategoryRow[];
    meta: {
        activeItemCount: number;
        importLimit: {
            rowLimit: number | null;
            tier: "enterprise" | "free" | "professional" | "starter";
            tierLabel: string;
        };
        tier: "enterprise" | "free" | "professional" | "starter";
        totalItemCount: number;
    };
    rows: ItemRow[];
}

interface ItemImportSummary {
    createdCount: number;
    failureCount: number;
    failures: Array<{
        message: string;
        rowNumber: number;
    }>;
    totalRows: number;
}

type ItemEditorSource = "create" | "edit" | "restored-draft" | null;

export function ProcurementOfficerItemsWorkspace(): JSX.Element {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const workspace = useQuery(api.functions.items.getItemsWorkspace, {}) as
        | ItemsWorkspaceData
        | undefined;
    const createItem = useMutation(api.functions.items.createItem);
    const updateItem = useMutation(api.functions.items.updateItem);
    const archiveItem = useMutation(api.functions.items.archiveItem);
    const importItems = useMutation(api.functions.items.importItems);
    const createExcelExport = useAction(api.actions.files.createExcelExport);
    const importWorkbook = useAction(api.actions.files.importWorkbook);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
    const [editingItem, setEditingItem] = useState<ItemRow | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importSummary, setImportSummary] = useState<ItemImportSummary | null>(null);
    const [archiveTarget, setArchiveTarget] = useState<ItemRow | null>(null);
    const [isPendingArchive, setIsPendingArchive] = useState(false);
    const [isTierLimitOpen, setIsTierLimitOpen] = useState(false);
    const [editorSource, setEditorSource] = useState<ItemEditorSource>(null);

    const categoryDraft =
        typeof window === "undefined"
            ? null
            : parseStoredCategoryDraft(window.sessionStorage.getItem(CATEGORY_DRAFT_STORAGE_KEY));

    useEffect(() => {
        if (!workspace || selectedCategoryId !== "all") {
            return;
        }

        if (
            categoryDraft?.id &&
            workspace.categories.some((category) => category.id === categoryDraft.id)
        ) {
            setSelectedCategoryId(categoryDraft.id);
            return;
        }

        const firstActiveCategory = workspace.categories.find((category) => category.isActive);
        if (firstActiveCategory) {
            setSelectedCategoryId(firstActiveCategory.id);
        }
    }, [categoryDraft?.id, selectedCategoryId, workspace]);

    useEffect(() => {
        if (typeof window === "undefined" || !workspace || isEditorOpen) {
            return;
        }

        const draft = parseStoredItemDraft(
            window.sessionStorage.getItem(ITEM_DRAFT_STORAGE_KEY),
        );
        if (!draft || !hasMeaningfulItemDraftValues(draft)) {
            clearDraftStorage();
            return;
        }

        const categoryId =
            resolveProcurementItemDraftCategoryId({
                categories: workspace.categories,
                draftCategoryId: draft.categoryId,
            });
        if (categoryId) {
            setSelectedCategoryId(categoryId);
        }

        setEditingItem(
            categoryId
                ? {
                    archivedLabel: null,
                    categoryId,
                    categoryLimit:
                        workspace.categories.find((category) => category.id === categoryId)?.limit ??
                        workspace.categories[0]!.limit,
                    categoryName:
                        workspace.categories.find((category) => category.id === categoryId)?.name ??
                        draft.categoryName ??
                        "Category",
                    complianceFlags: draft.complianceFlags,
                    complianceSummary: draft.complianceFlags.join(", "),
                    id: draft.id,
                    isActive: true,
                    lastPriceChangedAt: null,
                    maxQuantity: draft.maxQuantity,
                    minQuantity: draft.minQuantity,
                    name: draft.name,
                    procurementMethod: draft.procurementMethod,
                    revision: draft.revision,
                    sourceOfFunds: draft.sourceOfFunds,
                    unitOfMeasurement: draft.customUnit ?? draft.unit,
                    unitPrice: draft.unitPrice,
                }
                : null,
        );
        setEditorSource("restored-draft");
        setIsEditorOpen(true);
    }, [isEditorOpen, workspace]);

    if (!workspace) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-40 rounded-3xl" />
                <Skeleton className="h-24 rounded-3xl" />
                <Skeleton className="h-36 rounded-3xl" />
            </div>
        );
    }

    const filteredRows =
        selectedCategoryId === "all"
            ? workspace.rows
            : workspace.rows.filter((row) => row.categoryId === selectedCategoryId);
    const selectedCategory =
        selectedCategoryId === "all"
            ? null
            : workspace.categories.find((category) => category.id === selectedCategoryId) ?? null;
    const tierLimitContent = buildProcurementItemTierLimitModalContent(
        selectedCategory?.limit ?? {
            limit: null,
            tier: workspace.meta.tier,
            tierLabel: workspace.meta.importLimit.tierLabel,
        },
    );

    function clearDraftStorage(): void {
        if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(ITEM_DRAFT_STORAGE_KEY);
        }
    }

    function saveDraftStorage(draft: StoredItemDraft | null): void {
        if (typeof window === "undefined") {
            return;
        }

        if (!draft || !hasMeaningfulItemDraftValues(draft)) {
            clearDraftStorage();
            return;
        }

        window.sessionStorage.setItem(ITEM_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }

    function resetEditor(): void {
        setEditingItem(null);
        setEditorSource(null);
        setIsEditorOpen(false);
    }

    function redirectToProtectedAccessHandling(): void {
        resetEditor();
        setArchiveTarget(null);
        setIsTierLimitOpen(false);
        router.replace(getProcurementItemCrudRecoveryHref());
    }

    async function onSubmit(values: ItemFormData): Promise<void> {
        setIsSubmitting(true);
        try {
            if (editingItem?.id) {
                await updateItem({
                    categoryId: values.categoryId as never,
                    complianceFlags: values.complianceFlags,
                    customUnit: values.customUnit,
                    expectedRevision: editingItem.revision,
                    itemId: editingItem.id as never,
                    maxQuantity: values.maxQuantity,
                    minQuantity: values.minQuantity,
                    name: values.name,
                    procurementMethod: values.procurementMethod,
                    sourceOfFunds: values.sourceOfFunds,
                    unit: values.unitOption === "custom" ? "custom" : values.unit ?? "",
                    unitPrice: values.unitPrice,
                });
                toast.success("Item updated.");
            } else {
                await createItem({
                    categoryId: values.categoryId as never,
                    complianceFlags: values.complianceFlags,
                    customUnit: values.customUnit,
                    maxQuantity: values.maxQuantity,
                    minQuantity: values.minQuantity,
                    name: values.name,
                    procurementMethod: values.procurementMethod,
                    sourceOfFunds: values.sourceOfFunds,
                    unit: values.unitOption === "custom" ? "custom" : values.unit ?? "",
                    unitPrice: values.unitPrice,
                });
                toast.success("Item created.");
            }
            clearDraftStorage();
            setSelectedCategoryId(values.categoryId);
            resetEditor();
        } catch (error) {
            if (isProcurementItemCrudAuthorizationError(error)) {
                toast.error("Your access changed. Redirecting to refresh your workspace.");
                redirectToProtectedAccessHandling();
                return;
            }
            const message = getProcurementItemCrudErrorMessage(error);
            if (isProcurementItemTierLimitMessage(message)) {
                setIsTierLimitOpen(true);
            }
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function onArchive(): Promise<void> {
        if (!archiveTarget) return;
        setIsPendingArchive(true);
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
                redirectToProtectedAccessHandling();
                return;
            }
            toast.error(getProcurementItemCrudErrorMessage(error));
        } finally {
            setIsPendingArchive(false);
        }
    }

    async function onDownloadTemplate(): Promise<void> {
        setIsDownloadingTemplate(true);
        try {
            const result = (await createExcelExport({
                reportName: "Item Import Template",
                rows: buildProcurementItemTemplateRows(),
            })) as { fileName: string; workbookBase64: string };
            downloadBase64File(result.fileName, result.workbookBase64);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Workbook template failed.");
        } finally {
            setIsDownloadingTemplate(false);
        }
    }

    async function onWorkbookSelected(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setIsImporting(true);
        try {
            const workbookBase64 = await readFileAsBase64(file);
            const parsedWorkbook = (await importWorkbook({
                workbookBase64,
            })) as { rows: unknown[] };
            const result = await importItems({ rows: parsedWorkbook.rows });
            setImportSummary(result);
            if (result.createdCount > 0) {
                toast.success(`Imported ${result.createdCount} items.`);
            }
            if (result.failureCount > 0) {
                toast.error(`${result.failureCount} workbook rows failed validation.`);
            }
        } catch (error) {
            if (isProcurementItemCrudAuthorizationError(error)) {
                toast.error("Your access changed. Redirecting to refresh your workspace.");
                redirectToProtectedAccessHandling();
                return;
            }
            toast.error(error instanceof Error ? error.message : "Workbook import failed.");
        } finally {
            setIsImporting(false);
        }
    }

    function openCreate(): void {
        if (selectedCategory?.limit.atLimit) {
            setIsTierLimitOpen(true);
            return;
        }
        clearDraftStorage();
        setEditingItem(null);
        setEditorSource("create");
        setIsEditorOpen(true);
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                        <PackagePlus className="h-4 w-4" />
                        Item catalog management
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                        Match the prototype flow: add one item quickly, bulk upload a workbook when needed, and keep the category table truthful for live catalog work.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <SummaryPill label="Active items" value={String(workspace.meta.activeItemCount)} />
                    <SummaryPill label="Workbook row cap" value={workspace.meta.importLimit.rowLimit === null ? "Unlimited" : String(workspace.meta.importLimit.rowLimit)} />
                    <SummaryPill label="Total records" value={String(workspace.meta.totalItemCount)} />
                </div>
            </div>

            <input ref={fileInputRef} accept=".xlsx,.xls" className="hidden" type="file" onChange={(event) => void onWorkbookSelected(event)} />

            {categoryDraft ? (
                <div className="rounded-3xl border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="font-medium text-foreground">Category handoff preserved</div>
                            <p>
                                {categoryDraft.id
                                    ? `Working from the Categories flow for ${categoryDraft.name}. Draft category changes stay preserved while you manage items here.`
                                    : `The draft category ${categoryDraft.name || "Untitled category"} is still preserved in the Categories workspace. Save the category there before attaching live items to it.`}
                            </p>
                        </div>
                        <Button asChild type="button" variant="outline">
                            <Link href={buildProcurementOfficerWorkspaceModalPath({ modal: "categories" })}>
                                <FolderTree className="mr-2 h-4 w-4" />
                                Back to Categories
                            </Link>
                        </Button>
                    </div>
                </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
                <Button type="button" variant={selectedCategoryId === "all" ? "default" : "outline"} className="rounded-full" onClick={() => setSelectedCategoryId("all")}>
                    All categories
                </Button>
                {workspace.categories.map((category) => (
                    <Button
                        key={category.id}
                        type="button"
                        variant={selectedCategoryId === category.id ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setSelectedCategoryId(category.id)}
                    >
                        {category.name}
                        <Badge variant="secondary" className="ml-2 rounded-full">{category.activeItemCount}</Badge>
                    </Button>
                ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
                <QuickAddItemCard
                    category={selectedCategory}
                    isSubmitting={isSubmitting}
                    onOpenAdvanced={openCreate}
                    onSubmit={async (values) => {
                        setIsSubmitting(true);
                        try {
                            await createItem({
                                categoryId: values.categoryId as never,
                                complianceFlags: values.complianceFlags,
                                customUnit: values.customUnit,
                                maxQuantity: values.maxQuantity,
                                minQuantity: values.minQuantity,
                                name: values.name,
                                procurementMethod: values.procurementMethod,
                                sourceOfFunds: values.sourceOfFunds,
                                unit: values.unitOption === "custom" ? "custom" : values.unit ?? "",
                                unitPrice: values.unitPrice,
                            });
                            toast.success("Item created.");
                            clearDraftStorage();
                            setSelectedCategoryId(values.categoryId);
                        } catch (error) {
                            if (isProcurementItemCrudAuthorizationError(error)) {
                                toast.error("Your access changed. Redirecting to refresh your workspace.");
                                redirectToProtectedAccessHandling();
                                return;
                            }
                            const message = getProcurementItemCrudErrorMessage(error);
                            if (isProcurementItemTierLimitMessage(message)) {
                                setIsTierLimitOpen(true);
                            }
                            toast.error(message);
                        } finally {
                            setIsSubmitting(false);
                        }
                    }}
                />

                <div className="rounded-3xl border-2 border-dashed border-border/70 bg-background p-5 text-center shadow-sm">
                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-foreground">Bulk Upload Items</div>
                        <p className="text-sm leading-6 text-muted-foreground">
                            Upload the standard template workbook for this tenant-scoped catalog. Valid rows import and invalid rows stay in the summary.
                        </p>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <Button type="button" variant="outline" className="rounded-xl" disabled={isDownloadingTemplate} onClick={() => void onDownloadTemplate()}>
                            <Download className="mr-2 h-4 w-4" />
                            Download Template
                        </Button>
                        <Button type="button" variant="outline" className="rounded-xl" disabled={isImporting} onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-2 h-4 w-4" />
                            Select File
                        </Button>
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">
                        Template columns follow the prototype contract: Item/Service Description, Unit Of Measurement, Unit Price, Proc Method, and Source Of Funds.
                    </p>
                </div>
            </div>

            {filteredRows.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
                    <div className="text-lg font-semibold text-foreground">No catalog items yet</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        No items yet. Add one above or upload the workbook template for this category flow.
                    </p>
                    <Button className="mt-4 rounded-xl" onClick={openCreate} type="button">
                        <PackagePlus className="mr-2 h-4 w-4" />
                        Open Advanced Editor
                    </Button>
                </div>
            ) : (
                <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-foreground">
                                {selectedCategory
                                    ? `Current Items in ${selectedCategory.name}`
                                    : "Current Items"}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Keep this table aligned with the catalog category you are actively managing.
                            </p>
                        </div>
                        <Button type="button" variant="outline" className="rounded-xl" onClick={openCreate}>
                            <PackagePlus className="mr-2 h-4 w-4" />
                            Advanced Editor
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                    <th className="px-3 py-3 font-semibold">Description</th>
                                    <th className="px-3 py-3 font-semibold">Unit</th>
                                    <th className="px-3 py-3 font-semibold">Price</th>
                                    <th className="px-3 py-3 font-semibold">Method</th>
                                    <th className="px-3 py-3 font-semibold">Source</th>
                                    <th className="px-3 py-3 text-right font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row) => (
                                    <tr key={row.id} className="border-b border-border/50 last:border-b-0">
                                        <td className="px-3 py-3 align-top">
                                            <div className="space-y-1">
                                                <div className="font-medium text-foreground">{row.name}</div>
                                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                    {selectedCategory ? null : (
                                                        <Badge variant="outline" className="rounded-full">
                                                            {row.categoryName}
                                                        </Badge>
                                                    )}
                                                    {row.archivedLabel ? (
                                                        <Badge variant="outline" className="rounded-full">
                                                            {row.archivedLabel}
                                                        </Badge>
                                                    ) : null}
                                                    {row.lastPriceChangedAt ? (
                                                        <span>
                                                            Price updated{" "}
                                                            {new Date(row.lastPriceChangedAt).toLocaleDateString()}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 align-top text-muted-foreground">
                                            {row.unitOfMeasurement ?? "Not set"}
                                        </td>
                                        <td className="px-3 py-3 align-top text-muted-foreground">
                                            {formatKesAmount(row.unitPrice ?? 0)}
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <Badge variant="secondary" className="rounded-full">
                                                {row.procurementMethod ?? "RFQ"}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <Badge variant="outline" className="rounded-full">
                                                {row.sourceOfFunds ?? "GOK"}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <div className="flex justify-end gap-2">
                                                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => { clearDraftStorage(); setEditingItem(row); setEditorSource("edit"); setIsEditorOpen(true); }}>
                                                    Edit
                                                </Button>
                                                {row.isActive ? (
                                                    <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setArchiveTarget(row)}>
                                                        <Archive className="mr-2 h-3.5 w-3.5" />
                                                        Remove
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <ItemEditorDialog
                categories={workspace.categories}
                categoryContext={selectedCategory}
                item={editingItem}
                isSubmitting={isSubmitting}
                onDraftChange={saveDraftStorage}
                onOpenChange={(open) => {
                    setIsEditorOpen(open);
                    if (!open) resetEditor();
                }}
                onSubmit={onSubmit}
                onDiscardDraft={clearDraftStorage}
                open={isEditorOpen}
                requiresDiscardConfirmation={editorSource === "restored-draft"}
            />

            <Dialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{archiveTarget ? `Archive ${archiveTarget.name}?` : "Archive item"}</DialogTitle>
                        <DialogDescription>
                            Archived items disappear from new catalog selection while staying resolvable for saved plans.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">
                        Existing DU plans continue to resolve this item by its stable document ID after archival.
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setArchiveTarget(null)}>Cancel</Button>
                        <Button type="button" variant="destructive" disabled={isPendingArchive} onClick={() => void onArchive()}>
                            {isPendingArchive ? "Archiving..." : "Archive item"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(importSummary)} onOpenChange={(open) => !open && setImportSummary(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Item import summary</DialogTitle>
                        <DialogDescription>
                            {importSummary
                                ? `${importSummary.createdCount} created, ${importSummary.failureCount} failed across ${importSummary.totalRows} workbook rows.`
                                : "Review workbook results."}
                        </DialogDescription>
                    </DialogHeader>
                    {importSummary ? (
                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-3">
                                <SummaryPill label="Created" value={String(importSummary.createdCount)} />
                                <SummaryPill label="Failed" value={String(importSummary.failureCount)} />
                                <SummaryPill label="Rows processed" value={String(importSummary.totalRows)} />
                            </div>
                            {importSummary.failures.length > 0 ? (
                                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                                    <div className="text-sm font-semibold text-foreground">Row-level failures</div>
                                    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                                        {importSummary.failures.map((failure) => (
                                            <div key={`${failure.rowNumber}-${failure.message}`} className="rounded-2xl border border-border/60 bg-background px-3 py-2 text-sm">
                                                <div className="font-medium text-foreground">Row {failure.rowNumber}</div>
                                                <div className="text-muted-foreground">{failure.message}</div>
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
                        <Button type="button" onClick={() => setImportSummary(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isTierLimitOpen} onOpenChange={setIsTierLimitOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{tierLimitContent.title}</DialogTitle>
                        <DialogDescription>{tierLimitContent.guidance}</DialogDescription>
                    </DialogHeader>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">
                        {tierLimitContent.body}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsTierLimitOpen(false)}>Close</Button>
                        <Button asChild type="button"><Link href="/pricing">View Plans</Link></Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
    return (
        <div className="inline-flex min-w-[10.5rem] items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            <div className="text-sm font-semibold tracking-[-0.02em] text-foreground">{value}</div>
        </div>
    );
}

function QuickAddItemCard(props: {
    category: ItemCategoryRow | null;
    isSubmitting: boolean;
    onOpenAdvanced: () => void;
    onSubmit: (values: ItemFormData) => Promise<void>;
}) {
    const categoryOptions = buildProcurementItemEditorCategoryOptions({
        categories: props.categories,
        selectedCategoryId: props.item?.categoryId ?? props.categoryContext?.id ?? null,
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
            categoryId: props.category?.id ?? "",
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
            categoryId: props.category?.id ?? "",
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
    }, [form, props.category?.id]);

    return (
        <div className="rounded-3xl border border-border/70 bg-muted/20 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <PackagePlus className="h-4 w-4" />
                        Add Item to Catalog
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {props.category
                            ? `Add items directly into ${props.category.name}. Quantities will be filled later by Departmental Users.`
                            : "Choose a category above to add items into the live catalog, just like the prototype category-items flow."}
                    </p>
                </div>
                <Button type="button" variant="outline" className="rounded-xl" onClick={props.onOpenAdvanced}>
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
                                categoryId: props.category?.id ?? "",
                                complianceFlags: [],
                                customUnit: "",
                                maxQuantity: undefined,
                                minQuantity: undefined,
                                name: "",
                                procurementMethod: values.procurementMethod,
                                sourceOfFunds: values.sourceOfFunds,
                                unit: values.unitOption === "custom" ? "each" : values.unit,
                                unitPrice: 0,
                            });
                        })(event);
                    }}
                >
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Item Description</FormLabel>
                                <FormControl><Input placeholder="Laptop Computer Core i7" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="unit" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unit</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Choose unit" /></SelectTrigger></FormControl>
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
                        )} />
                        <FormField control={form.control} name="unitPrice" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unit Price</FormLabel>
                                <FormControl><Input type="number" min="0" step="0.01" {...field} onChange={(event) => field.onChange(event.target.valueAsNumber)} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    {watchedUnit === "custom" ? (
                        <FormField control={form.control} name="customUnit" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Custom Unit</FormLabel>
                                <FormControl><Input placeholder="service" {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    ) : null}

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <FormField control={form.control} name="procurementMethod" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Proc Method</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? "RFQ"}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Choose method" /></SelectTrigger></FormControl>
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
                        )} />
                        <FormField control={form.control} name="sourceOfFunds" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Source Of Funds</FormLabel>
                                <FormControl><Input placeholder="GOK" {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="flex items-end">
                            <Button
                                type="submit"
                                className="w-full rounded-xl"
                                disabled={props.isSubmitting || !props.category}
                            >
                                {props.isSubmitting ? "Adding..." : "Add Item"}
                            </Button>
                        </div>
                    </div>

                    {props.category?.limit.atLimit ? (
                        <p className="text-xs text-destructive">
                            This category is already at its active-item cap for the current plan tier.
                        </p>
                    ) : null}
                    {!props.category ? (
                        <p className="text-xs text-muted-foreground">
                            The prototype flow is category-first, so quick add unlocks after you choose a category chip above.
                        </p>
                    ) : null}
                    <p className="text-xs italic text-muted-foreground">
                        Quantities will be filled by Departmental Users.
                    </p>
                </form>
            </Form>
        </div>
    );
}

function formatKesAmount(amount: number): string {
    return `KES ${amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function ItemEditorDialog(props: {
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
                    props.item.unitOfMeasurement as (typeof PROCUREMENT_ITEM_UNITS)[number],
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
                    props.item.unitOfMeasurement as (typeof PROCUREMENT_ITEM_UNITS)[number],
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
        if (!props.open) return;
        form.reset({
            categoryId: props.item?.categoryId ?? props.categoryContext?.id ?? "",
            complianceFlags: props.item?.complianceFlags ?? [],
            customUnit:
                props.item?.unitOfMeasurement &&
                !PROCUREMENT_ITEM_UNITS.includes(
                    props.item.unitOfMeasurement as (typeof PROCUREMENT_ITEM_UNITS)[number],
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
                    props.item.unitOfMeasurement as (typeof PROCUREMENT_ITEM_UNITS)[number],
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
    const { categories, item, onDraftChange, open } = props;

    useEffect(() => {
        if (!open) {
            return;
        }

        const category = categories.find((entry) => entry.id === watchedCategoryId);
        const draft: StoredItemDraft = {
            categoryId: watchedCategoryId || null,
            categoryName: category?.name ?? null,
            complianceFlags:
                (watchedComplianceFlags as ProcurementItemComplianceFlag[] | undefined) ?? [],
            customUnit: watchedCustomUnit ?? null,
            id: item?.id ?? "",
            maxQuantity: typeof watchedMaxQuantity === "number" ? watchedMaxQuantity : null,
            minQuantity: typeof watchedMinQuantity === "number" ? watchedMinQuantity : null,
            name: watchedName,
            procurementMethod:
                (watchedMethod as ProcurementItemProcurementMethod | undefined) ?? null,
            revision: item?.revision ?? 0,
            sourceOfFunds: watchedSourceOfFunds ?? null,
            unit: watchedUnit,
            unitPrice: typeof watchedUnitPrice === "number" ? watchedUnitPrice : null,
        };

        onDraftChange(hasMeaningfulItemDraftValues(draft) ? draft : null);
    }, [
        categories,
        item?.id,
        item?.revision,
        onDraftChange,
        open,
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
                        complianceFlags: form.getValues("complianceFlags") as ProcurementItemComplianceFlag[],
                        customUnit: form.getValues("customUnit"),
                        maxQuantity: form.getValues("maxQuantity"),
                        minQuantity: form.getValues("minQuantity"),
                        name: form.getValues("name"),
                        procurementMethod: form.getValues("procurementMethod") as ProcurementItemProcurementMethod | undefined,
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
                    <DialogTitle>{props.item?.id ? `Edit ${props.item.name}` : "Add catalog item"}</DialogTitle>
                    <DialogDescription>
                        Keep item identity stable while setting price, unit, quantity bounds, and compliance defaults.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form className="space-y-4" onSubmit={(event) => { void form.handleSubmit(props.onSubmit)(event); }}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField control={form.control} name="categoryId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
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
                            )} />
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Item Description</FormLabel>
                                    <FormControl><Input placeholder="Laptop Computer Core i7" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <FormField control={form.control} name="unit" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unit</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Choose unit" /></SelectTrigger></FormControl>
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
                            )} />
                            <FormField control={form.control} name="unitPrice" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unit Price</FormLabel>
                                    <FormControl><Input type="number" min="0" step="0.01" {...field} onChange={(event) => field.onChange(event.target.valueAsNumber)} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="procurementMethod" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Proc Method</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? "RFQ"}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Choose method" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {PROCUREMENT_ITEM_PROCUREMENT_METHODS.map((method) => (
                                                <SelectItem key={method} value={method}>{method}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        {watchedUnit === "custom" ? (
                            <FormField control={form.control} name="customUnit" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Custom Unit</FormLabel>
                                    <FormControl><Input placeholder="service" {...field} value={field.value ?? ""} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        ) : null}

                        <div className="grid gap-4 md:grid-cols-3">
                            <FormField control={form.control} name="sourceOfFunds" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Source Of Funds</FormLabel>
                                    <FormControl><Input placeholder="GOK" {...field} value={field.value ?? ""} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="minQuantity" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Min Quantity</FormLabel>
                                    <FormControl><Input type="number" min="0" step="1" {...field} value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value === "" ? undefined : event.target.valueAsNumber)} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="maxQuantity" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Max Quantity</FormLabel>
                                    <FormControl><Input type="number" min="0" step="1" {...field} value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value === "" ? undefined : event.target.valueAsNumber)} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="complianceFlags" render={() => (
                            <FormItem>
                                <FormLabel>Compliance Flags</FormLabel>
                                <div className="grid gap-3 md:grid-cols-3">
                                    {PROCUREMENT_ITEM_COMPLIANCE_FLAGS.map((flag) => (
                                        <FormField
                                            key={flag}
                                            control={form.control}
                                            name="complianceFlags"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center gap-3 rounded-2xl border border-border/70 px-3 py-3">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value.includes(flag)}
                                                            onCheckedChange={(checked) => {
                                                                const currentValues = field.value;
                                                                field.onChange(
                                                                    checked
                                                                        ? [...currentValues, flag]
                                                                        : currentValues.filter((value) => value !== flag),
                                                                );
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="m-0 capitalize">{flag.replace("_", " ")}</FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={requestClose} disabled={props.isSubmitting}>Cancel</Button>
                            <Button type="submit" disabled={props.isSubmitting}>
                                {props.isSubmitting ? "Saving..." : props.item?.id ? "Save changes" : "Create item"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
                <Dialog open={isDiscardDialogOpen} onOpenChange={setIsDiscardDialogOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Discard item draft?</DialogTitle>
                            <DialogDescription>
                                Your unsaved item details will be removed from this flow.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDiscardDialogOpen(false)}>
                                Keep editing
                            </Button>
                            <Button type="button" variant="destructive" onClick={() => {
                                setIsDiscardDialogOpen(false);
                                props.onDiscardDraft();
                                props.onOpenChange(false);
                            }}>
                                Discard draft
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DialogContent>
        </Dialog>
    );
}

async function readFileAsBase64(file: File): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index] as number);
    }
    return window.btoa(binary);
}

function downloadBase64File(fileName: string, payload: string): void {
    const anchor = document.createElement("a");
    anchor.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${payload}`;
    anchor.download = fileName;
    anchor.click();
}
