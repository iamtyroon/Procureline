"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAction, useMutation, useQuery } from "convex/react";
import {
    AlertTriangle,
    Archive,
    ArrowDown,
    ArrowUp,
    Download,
    FolderTree,
    Plus,
    Trash2,
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
import { Textarea } from "@/components/ui/textarea";
import {
    buildCategoryTierLimitModalContent,
    buildCategoryToolboxStyle,
    CATEGORY_DRAFT_STORAGE_KEY,
    createCategoryTemplateRows,
    getCategoryCrudErrorMessage,
    getCategoryCrudRecoveryHref,
    getCategoryIconOption,
    getCategoryIconOptions,
    getDefaultCategoryIconOption,
    hasMeaningfulCategoryDraftValues,
    isCategoryCrudAuthorizationError,
    isCategoryTierLimitMessage,
    parseStoredCategoryDraft,
    type StoredCategoryDraft,
    type CategoryIconName,
} from "@/lib/procurement-officer/categories";
import { categoryFormSchema, type CategoryFormData } from "@/lib/validators/category";

interface CategoryRow {
    archivedLabel: string | null;
    canDelete: boolean;
    color: string | null;
    deleteBlockerMessages: string[];
    description: string | null;
    icon: CategoryIconName | null;
    id: string;
    isActive: boolean;
    itemCount: number;
    name: string;
    planningImpactWarning: string | null;
    planningStateLabel: string;
    revision: number;
}

interface WorkspaceData {
    meta: {
        activeCategoryCount: number;
        limit: {
            atLimit: boolean;
            limit: number | null;
            remainingSlots: number | null;
            tier: "enterprise" | "free" | "professional" | "starter";
            tierLabel: string;
            upgradeHref: string;
        };
        totalCategoryCount: number;
    };
    rows: CategoryRow[];
}

interface CategoryImportSummary {
    createdCount: number;
    failureCount: number;
    failures: Array<{
        message: string;
        rowNumber: number;
    }>;
    totalRows: number;
}

type CategoryEditorSource = "create" | "edit" | "restored-draft" | null;

export function ProcurementOfficerCategoriesWorkspace(): JSX.Element {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const workspace = useQuery(api.functions.categories.getCategoriesWorkspace, {}) as WorkspaceData | undefined;
    const createCategory = useMutation(api.functions.categories.createCategory);
    const updateCategory = useMutation(api.functions.categories.updateCategory);
    const archiveCategory = useMutation(api.functions.categories.archiveCategory);
    const deleteCategory = useMutation(api.functions.categories.deleteCategory);
    const reorderCategories = useMutation(api.functions.categories.reorderCategories);
    const importCategories = useMutation(api.functions.categories.importCategories);
    const createExcelExport = useAction(api.actions.files.createExcelExport);
    const importWorkbook = useAction(api.actions.files.importWorkbook);
    const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [archiveTarget, setArchiveTarget] = useState<CategoryRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
    const [isPendingArchive, setIsPendingArchive] = useState(false);
    const [isPendingDelete, setIsPendingDelete] = useState(false);
    const [isTierLimitOpen, setIsTierLimitOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
    const [importSummary, setImportSummary] = useState<CategoryImportSummary | null>(null);
    const [editorSource, setEditorSource] = useState<CategoryEditorSource>(null);

    useEffect(() => {
        if (typeof window === "undefined" || !workspace || isEditorOpen) {
            return;
        }

        const draft = parseStoredCategoryDraft(
            window.sessionStorage.getItem(CATEGORY_DRAFT_STORAGE_KEY),
        );
        if (!draft || !hasMeaningfulCategoryDraftValues(draft)) {
            clearDraftStorage();
            return;
        }

        clearDraftStorage();
        setEditingCategory({
            archivedLabel: null,
            canDelete: true,
            color: draft.color ?? null,
            deleteBlockerMessages: [],
            description: draft.description ?? null,
            icon: draft.icon ?? null,
            id: draft.id,
            isActive: true,
            itemCount: 0,
            name: draft.name,
            planningImpactWarning: null,
            planningStateLabel: "No plans yet",
            revision: draft.revision,
        });
        setEditorSource("restored-draft");
        setIsEditorOpen(true);
    }, [isEditorOpen, workspace]);

    if (!workspace) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-44 rounded-3xl" />
                <Skeleton className="h-36 rounded-3xl" />
                <Skeleton className="h-36 rounded-3xl" />
            </div>
        );
    }

    const tierLimitContent = buildCategoryTierLimitModalContent(workspace.meta.limit);
    const activeRows = workspace.rows.filter((row) => row.isActive);

    function resetEditor(): void {
        setEditingCategory(null);
        setEditorSource(null);
        setIsEditorOpen(false);
    }

    function clearDraftStorage(): void {
        if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(CATEGORY_DRAFT_STORAGE_KEY);
        }
    }

    function saveDraftStorage(draft: StoredCategoryDraft | null): void {
        if (typeof window === "undefined") {
            return;
        }

        if (!draft || !hasMeaningfulCategoryDraftValues(draft)) {
            clearDraftStorage();
            return;
        }

        window.sessionStorage.setItem(
            CATEGORY_DRAFT_STORAGE_KEY,
            JSON.stringify(draft),
        );
    }

    function redirectToProtectedAccessHandling(): void {
        resetEditor();
        setArchiveTarget(null);
        setDeleteTarget(null);
        setIsTierLimitOpen(false);
        router.replace(getCategoryCrudRecoveryHref());
    }

    async function onSubmit(values: CategoryFormData): Promise<void> {
        setIsSubmitting(true);
        try {
            if (editingCategory?.id) {
                await updateCategory({
                    categoryId: editingCategory.id as any,
                    color: values.color,
                    description: values.description,
                    expectedRevision: editingCategory.revision,
                    icon: values.icon,
                    name: values.name,
                });
                toast.success("Category updated.");
            } else {
                await createCategory({
                    color: values.color,
                    description: values.description,
                    icon: values.icon,
                    name: values.name,
                });
                toast.success("Category created.");
            }
            clearDraftStorage();
            resetEditor();
        } catch (error) {
            if (isCategoryCrudAuthorizationError(error)) {
                toast.error("Your access changed. Redirecting to refresh your workspace.");
                redirectToProtectedAccessHandling();
                return;
            }
            const message = getCategoryCrudErrorMessage(error);
            if (isCategoryTierLimitMessage(message)) {
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
            await archiveCategory({
                categoryId: archiveTarget.id as any,
                expectedRevision: archiveTarget.revision,
            });
            toast.success("Category archived.");
            setArchiveTarget(null);
        } catch (error) {
            toast.error(getCategoryCrudErrorMessage(error));
        } finally {
            setIsPendingArchive(false);
        }
    }

    async function onDelete(): Promise<void> {
        if (!deleteTarget) return;
        setIsPendingDelete(true);
        try {
            await deleteCategory({
                categoryId: deleteTarget.id as any,
                expectedRevision: deleteTarget.revision,
            });
            toast.success("Category deleted.");
            setDeleteTarget(null);
        } catch (error) {
            toast.error(getCategoryCrudErrorMessage(error));
        } finally {
            setIsPendingDelete(false);
        }
    }

    async function onReorder(rowId: string, direction: "up" | "down"): Promise<void> {
        const currentIndex = activeRows.findIndex((row) => row.id === rowId);
        const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (currentIndex < 0 || swapIndex < 0 || swapIndex >= activeRows.length) {
            return;
        }
        const reordered = [...activeRows];
        const [moved] = reordered.splice(currentIndex, 1);
        if (!moved) {
            return;
        }
        reordered.splice(swapIndex, 0, moved);
        try {
            await reorderCategories({
                expectedRevisions: reordered.map((row) => ({
                    categoryId: row.id,
                    revision: row.revision,
                })),
                orderedCategoryIds: reordered.map((row) => row.id),
            });
        } catch (error) {
            toast.error(getCategoryCrudErrorMessage(error));
        }
    }

    async function onDownloadTemplate(): Promise<void> {
        setIsDownloadingTemplate(true);
        try {
            const result = (await createExcelExport({
                reportName: "Category Import Template",
                rows: createCategoryTemplateRows(),
            })) as { fileName: string; workbookBase64: string };
            downloadBase64File(result.fileName, result.workbookBase64);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Workbook template failed.",
            );
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
            const result = await importCategories({ rows: parsedWorkbook.rows });
            setImportSummary(result);
            if (result.createdCount > 0) {
                toast.success(`Imported ${result.createdCount} categories.`);
            }
            if (result.failureCount > 0) {
                toast.error(`${result.failureCount} workbook rows failed validation.`);
            }
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Workbook import failed.",
            );
        } finally {
            setIsImporting(false);
        }
    }

    function openCreate(): void {
        if (workspace?.meta.limit.atLimit) {
            setIsTierLimitOpen(true);
            return;
        }
        clearDraftStorage();
        setEditingCategory(null);
        setEditorSource("create");
        setIsEditorOpen(true);
    }

    function handoffToItems(values: {
        color?: string;
        description?: string;
        icon?: CategoryIconName;
        name: string;
    }): void {
        saveDraftStorage({
            color: values.color ?? null,
            description: values.description ?? null,
            icon: values.icon ?? null,
            id: editingCategory?.id ?? "",
            name: values.name,
            revision: editingCategory?.revision ?? 0,
        });
        router.push("/po/items");
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                            <FolderTree className="h-4 w-4" />
                            Category management
                        </div>
                        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                            Keep the catalog ordered, unique, and ready for DU launchpad plus Blockly.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="rounded-xl" disabled={isDownloadingTemplate} onClick={() => void onDownloadTemplate()}>
                            <Download className="mr-2 h-4 w-4" />
                            Template
                        </Button>
                        <Button type="button" variant="outline" className="rounded-xl" disabled={isImporting} onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-2 h-4 w-4" />
                            Import
                        </Button>
                        <Button type="button" className="rounded-xl" onClick={openCreate}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Category
                        </Button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <SummaryPill label="Active categories" value={String(workspace.meta.activeCategoryCount)} />
                    <SummaryPill label="Tier limit" value={workspace.meta.limit.limit === null ? "Unlimited" : String(workspace.meta.limit.limit)} />
                    <SummaryPill label="Remaining slots" value={workspace.meta.limit.remainingSlots === null ? "Unlimited" : String(workspace.meta.limit.remainingSlots)} />
                    <SummaryPill label="Total records" value={String(workspace.meta.totalCategoryCount)} />
                </div>
            </div>

            <input ref={fileInputRef} accept=".xlsx,.xls" className="hidden" type="file" onChange={(event) => void onWorkbookSelected(event)} />

            {workspace.rows.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
                    <div className="text-lg font-semibold text-foreground">No categories yet</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Start with your first category so DU selection and Blockly ordering have a truthful source of truth.</p>
                    <Button className="mt-4 rounded-xl" onClick={openCreate} type="button">
                        <Plus className="mr-2 h-4 w-4" />
                        New Category
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {workspace.rows.map((row) => {
                        const preview = buildCategoryToolboxStyle({ color: row.color, icon: row.icon }).preview;
                        const rowIconOption =
                            getCategoryIconOption(row.icon) ?? getDefaultCategoryIconOption();
                        const RowIcon = rowIconOption.icon;
                        const activeIndex = activeRows.findIndex((activeRow) => activeRow.id === row.id);
                        return (
                            <div key={row.id} className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: preview.color }}>
                                            <RowIcon className="h-5 w-5" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="text-base font-semibold text-foreground">{row.name}</div>
                                                {row.archivedLabel ? <Badge variant="outline" className="rounded-full">{row.archivedLabel}</Badge> : null}
                                                <Badge variant="outline" className="rounded-full">{row.itemCount} item{row.itemCount === 1 ? "" : "s"}</Badge>
                                            </div>
                                            <p className="text-sm leading-6 text-muted-foreground">{row.description ?? "No description provided."}</p>
                                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                <span>{row.planningStateLabel}</span>
                                                {row.planningImpactWarning ? <span>{row.planningImpactWarning}</span> : null}
                                            </div>
                                            {row.deleteBlockerMessages.length > 0 ? (
                                                <div className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">{row.deleteBlockerMessages.join(" ")}</div>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        {row.isActive ? (
                                            <>
                                                <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={activeIndex <= 0} onClick={() => void onReorder(row.id, "up")}>
                                                    <ArrowUp className="mr-2 h-3.5 w-3.5" />
                                                    Up
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={activeIndex < 0 || activeIndex >= activeRows.length - 1} onClick={() => void onReorder(row.id, "down")}>
                                                    <ArrowDown className="mr-2 h-3.5 w-3.5" />
                                                    Down
                                                </Button>
                                            </>
                                        ) : null}
                                        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => { clearDraftStorage(); setEditingCategory(row); setEditorSource("edit"); setIsEditorOpen(true); }}>Edit</Button>
                                        {row.isActive ? <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setArchiveTarget(row)}><Archive className="mr-2 h-3.5 w-3.5" />Archive</Button> : null}
                                        <Button type="button" variant="destructive" size="sm" className="rounded-full" disabled={!row.canDelete} onClick={() => setDeleteTarget(row)}><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <CategoryEditorDialog category={editingCategory} isSubmitting={isSubmitting} onCategoryItems={handoffToItems} onDiscardDraft={clearDraftStorage} onDraftChange={saveDraftStorage} onOpenChange={(open) => { setIsEditorOpen(open); if (!open) resetEditor(); }} onSubmit={onSubmit} open={isEditorOpen} requiresDiscardConfirmation={editorSource === "restored-draft"} />
            <ConfirmDialog body="Archived categories disappear from new DU selections and new toolbox seeds, but existing plans keep their saved references." confirmLabel={isPendingArchive ? "Archiving..." : "Archive category"} description={archiveTarget ? `Archive ${archiveTarget.name} from new planning flows.` : ""} isPending={isPendingArchive} onConfirm={() => void onArchive()} onOpenChange={(open) => !open && setArchiveTarget(null)} open={Boolean(archiveTarget)} title={archiveTarget ? `Archive ${archiveTarget.name}?` : "Archive category"} />
            <ConfirmDialog body={deleteTarget?.deleteBlockerMessages.join(" ") || "This permanently removes the category record."} confirmLabel={isPendingDelete ? "Deleting..." : "Delete category"} description={deleteTarget ? `Delete ${deleteTarget.name} from the catalog.` : ""} isPending={isPendingDelete} onConfirm={() => void onDelete()} onOpenChange={(open) => !open && setDeleteTarget(null)} open={Boolean(deleteTarget)} title={deleteTarget ? `Delete ${deleteTarget.name}?` : "Delete category"} />
            <Dialog open={Boolean(importSummary)} onOpenChange={(open) => !open && setImportSummary(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Category import summary</DialogTitle>
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
                        <Button type="button" onClick={() => setImportSummary(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isTierLimitOpen} onOpenChange={setIsTierLimitOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>{tierLimitContent.title}</DialogTitle><DialogDescription>{tierLimitContent.guidance}</DialogDescription></DialogHeader>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">{tierLimitContent.body}</div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsTierLimitOpen(false)}>Close</Button>
                        <Button asChild type="button"><Link href={workspace.meta.limit.upgradeHref}>View Plans</Link></Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CategoryEditorDialog({
    category,
    isSubmitting,
    onCategoryItems,
    onDiscardDraft,
    onDraftChange,
    onOpenChange,
    onSubmit,
    open,
    requiresDiscardConfirmation,
}: {
    category: CategoryRow | null;
    isSubmitting: boolean;
    onCategoryItems: (values: { color?: string; description?: string; icon?: CategoryIconName; name: string }) => void;
    onDiscardDraft: () => void;
    onDraftChange: (draft: StoredCategoryDraft | null) => void;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: CategoryFormData) => Promise<void>;
    open: boolean;
    requiresDiscardConfirmation: boolean;
}) {
    const form = useForm<{ color?: string; description?: string; icon?: string; name: string }, unknown, CategoryFormData>({
        resolver: zodResolver(categoryFormSchema),
        defaultValues: {
            color: category?.color ?? "",
            description: category?.description ?? "",
            icon: category?.icon ?? "",
            name: category?.name ?? "",
        },
    });
    const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        form.reset({
            color: category?.color ?? "",
            description: category?.description ?? "",
            icon: category?.icon ?? "",
            name: category?.name ?? "",
        });
    }, [category, form, open]);

    const preview = buildCategoryToolboxStyle({
        color: form.watch("color") ?? "",
        icon: (form.watch("icon") as CategoryIconName | undefined) ?? undefined,
    }).preview;
    const watchedColor = form.watch("color");
    const watchedDescription = form.watch("description");
    const watchedIcon = form.watch("icon");
    const watchedName = form.watch("name");
    const previewIconOption =
        getCategoryIconOption(form.watch("icon")) ?? getDefaultCategoryIconOption();
    const PreviewIcon = previewIconOption.icon;

    useEffect(() => {
        if (!open) {
            return;
        }

        const draft: StoredCategoryDraft = {
            color: watchedColor ?? null,
            description: watchedDescription ?? null,
            icon: (watchedIcon as CategoryIconName | undefined) ?? null,
            id: category?.id ?? "",
            name: watchedName,
            revision: category?.revision ?? 0,
        };
        onDraftChange(
            hasMeaningfulCategoryDraftValues(draft)
                ? draft
                : null,
        );
    }, [
        category?.id,
        category?.revision,
        onDraftChange,
        open,
        watchedColor,
        watchedDescription,
        watchedIcon,
        watchedName,
    ]);

    function requestClose(): void {
        const shouldConfirm =
            !isSubmitting &&
            (form.formState.isDirty ||
                (requiresDiscardConfirmation &&
                    hasMeaningfulCategoryDraftValues({
                        color: form.getValues("color"),
                        description: form.getValues("description"),
                        icon: form.getValues("icon"),
                        name: form.getValues("name"),
                    })));

        if (shouldConfirm) {
            setIsDiscardDialogOpen(true);
            return;
        }

        onDiscardDraft();
        onOpenChange(false);
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    onOpenChange(true);
                    return;
                }
                requestClose();
            }}
        >
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{category?.id ? `Edit ${category.name}` : "Create Category"}</DialogTitle>
                    <DialogDescription>Configure the category details that shape PO management, DU launchpad counts, and Blockly appearance.</DialogDescription>
                </DialogHeader>
                {category?.planningImpactWarning ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                        <div className="flex items-center gap-2 font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            Active plan impact
                        </div>
                        <p className="mt-1 leading-6">{category.planningImpactWarning}</p>
                    </div>
                ) : null}
                <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Blockly preview</div>
                    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: preview.color }}>
                            <PreviewIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="font-medium text-foreground">{form.watch("name") || "Category preview"}</div>
                            <div className="text-sm text-muted-foreground">{preview.color} with {previewIconOption.label} styling</div>
                        </div>
                    </div>
                </div>
                <Form {...form}>
                    <form className="space-y-4" onSubmit={(event) => { void form.handleSubmit(onSubmit)(event); }}>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category name</FormLabel>
                                <FormControl><Input placeholder="ICT Equipment" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl><Textarea placeholder="Optional guidance for operators and planning surfaces." rows={3} {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField control={form.control} name="color" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Color</FormLabel>
                                    <FormControl><Input placeholder="#4A90D9" {...field} value={field.value ?? ""} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="icon" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Icon</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Choose an icon" /></SelectTrigger></FormControl>
                                        <SelectContent>{getCategoryIconOptions().map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <DialogFooter className="gap-2 sm:justify-between">
                            <Button type="button" variant="outline" onClick={() => onCategoryItems({ color: form.getValues("color"), description: form.getValues("description"), icon: form.getValues("icon") as CategoryIconName | undefined, name: form.getValues("name") })}>Category Items</Button>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={requestClose} disabled={isSubmitting}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : category?.id ? "Save changes" : "Create category"}</Button>
                            </div>
                        </DialogFooter>
                    </form>
                </Form>
                <Dialog open={isDiscardDialogOpen} onOpenChange={setIsDiscardDialogOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Discard category draft?</DialogTitle>
                            <DialogDescription>
                                Your unsaved category details will be removed from this flow.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">
                            Close the dialog only if you are ready to discard the current category draft.
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDiscardDialogOpen(false)}>
                                Keep editing
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => {
                                    setIsDiscardDialogOpen(false);
                                    onDiscardDraft();
                                    onOpenChange(false);
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

function ConfirmDialog(props: {
    body: string;
    confirmLabel: string;
    description: string;
    isPending: boolean;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    title: string;
}) {
    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{props.title}</DialogTitle>
                    <DialogDescription>{props.description}</DialogDescription>
                </DialogHeader>
                <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">{props.body}</div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
                    <Button type="button" variant="destructive" disabled={props.isPending} onClick={props.onConfirm}>{props.confirmLabel}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
