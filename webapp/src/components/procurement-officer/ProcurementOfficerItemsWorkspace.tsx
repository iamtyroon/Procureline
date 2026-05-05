"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
  Download,
  Filter,
  FolderTree,
  PackagePlus,
  Search,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PROCUREMENT_CATALOG_SEARCH_DEBOUNCE_MS,
  applyProcurementCatalogBrowseStateToSearchParams,
  areProcurementCatalogBrowseStatesEqual,
  getProcurementCatalogExportGuardState,
  hasActiveProcurementCatalogFilters,
  readProcurementCatalogBrowseState,
  type ProcurementCatalogBrowseState,
  type ProcurementCatalogExportGuardState,
} from "@/lib/procurement-officer/catalog-filters";
import {
  CATEGORY_DRAFT_STORAGE_KEY,
  parseStoredCategoryDraft,
} from "@/lib/procurement-officer/categories";
import {
  buildProcurementItemTemplateRows,
  buildProcurementItemTierLimitModalContent,
  buildProcurementItemTierLimitState,
  getProcurementItemCrudErrorMessage,
  getProcurementItemCrudRecoveryHref,
  hasMeaningfulItemDraftValues,
  isProcurementItemCrudAuthorizationError,
  isProcurementItemTierLimitMessage,
  ITEM_DRAFT_STORAGE_KEY,
  parseStoredItemDraft,
  PROCUREMENT_ITEM_COMPLIANCE_FLAGS,
  PROCUREMENT_ITEM_EXPORT_GENERIC_ERROR_MESSAGE,
  resolveProcurementItemDraftCategoryId,
  summarizeComplianceFlags,
  type ProcurementItemComplianceFlag,
  type StoredItemDraft,
} from "@/lib/procurement-officer/items";
import type { ItemFormData } from "@/lib/validators/item";
import { formatKesAmount } from "./dashboard/utilities";
import { ArchiveItemDialog } from "./items-workspace/archive-item-dialog";
import { BlockedExportDialog } from "./items-workspace/blocked-export-dialog";
import { ImportSummaryDialog } from "./items-workspace/import-summary-dialog";
import { ItemEditorDialog } from "./items-workspace/item-editor-dialog";
import { ItemsCatalogTable } from "./items-workspace/items-catalog-table";
import {
  ActiveFilterChip,
  CatalogPagination,
  SummaryPill,
} from "./items-workspace/primitives";
import { QuickAddItemCard } from "./items-workspace/quick-add-item-card";
import { TierLimitDialog } from "./items-workspace/tier-limit-dialog";
import type {
  ItemEditorSource,
  ItemImportSummary,
  ItemRow,
  ItemsCatalogBrowseData,
  ItemsWorkspaceData,
} from "./items-workspace/types";
import {
  buildWorkspaceHref,
  downloadBase64File,
  formatComplianceFlagLabel,
  parsePriceInput,
  readFileAsBase64,
  resolveQuickAddCategoryId,
} from "./items-workspace/utilities";

export function ProcurementOfficerItemsWorkspace(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const workspace = useQuery(api.functions.items.getItemsWorkspace, {}) as
    | ItemsWorkspaceData
    | undefined;
  const createItem = useMutation(api.functions.items.createItem);
  const updateItem = useMutation(api.functions.items.updateItem);
  const archiveItem = useMutation(api.functions.items.archiveItem);
  const importItems = useMutation(api.functions.items.importItems);
  const createExcelExport = useAction(api.actions.files.createExcelExport);
  const exportCatalogItems = useAction(api.actions.files.exportCatalogItems);
  const importWorkbook = useAction(api.actions.files.importWorkbook);

  const [quickAddCategoryId, setQuickAddCategoryId] = useState("");
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ItemImportSummary | null>(
    null,
  );
  const [archiveTarget, setArchiveTarget] = useState<ItemRow | null>(null);
  const [isPendingArchive, setIsPendingArchive] = useState(false);
  const [isTierLimitOpen, setIsTierLimitOpen] = useState(false);
  const [editorSource, setEditorSource] = useState<ItemEditorSource>(null);
  const [categoryDraft, setCategoryDraft] =
    useState<ReturnType<typeof parseStoredCategoryDraft>>(null);
  const [blockedExport, setBlockedExport] =
    useState<ProcurementCatalogExportGuardState | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [minPriceInput, setMinPriceInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");

  const availableCategoryIds = useMemo(
    () => workspace?.categories.map((category) => category.id) ?? [],
    [workspace?.categories],
  );
  const browseState = useMemo(
    () =>
      readProcurementCatalogBrowseState(searchParams, {
        availableCategoryIds,
      }),
    [availableCategoryIds, searchParams],
  );
  const browseResult = useQuery(
    api.functions.items.browseItemsCatalog,
    workspace
      ? {
          categoryIds: browseState.categoryIds,
          complianceFlags: browseState.complianceFlags,
          maxPrice: browseState.maxPrice ?? undefined,
          minPrice: browseState.minPrice ?? undefined,
          page: browseState.page,
          pageSize: workspace.meta.defaultPageSize,
          searchText: browseState.searchText,
        }
      : "skip",
  ) as ItemsCatalogBrowseData | undefined;

  const activeCategories =
    workspace?.categories.filter((category) => category.isActive) ?? [];
  const quickAddCategory =
    workspace?.categories.find(
      (category) => category.id === quickAddCategoryId,
    ) ?? null;
  const browseRows = browseResult?.rows ?? [];
  const browseMeta = browseResult?.meta ?? null;
  const hasFilters = hasActiveProcurementCatalogFilters(browseState);
  const categoryNamesById = useMemo(
    () =>
      new Map(
        (workspace?.categories ?? []).map(
          (category) => [category.id, category.name] as const,
        ),
      ),
    [workspace?.categories],
  );
  const tierLimitContent = buildProcurementItemTierLimitModalContent(
    quickAddCategory?.limit ?? {
      limit: null,
      tier: workspace?.meta.tier ?? "free",
      tierLabel: workspace?.meta.importLimit.tierLabel ?? "Free",
    },
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setCategoryDraft(
      parseStoredCategoryDraft(
        window.sessionStorage.getItem(CATEGORY_DRAFT_STORAGE_KEY),
      ),
    );
  }, []);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    const nextCategoryId = resolveQuickAddCategoryId({
      categories: workspace.categories,
      currentCategoryId: quickAddCategoryId,
      draftCategoryId: categoryDraft?.id ?? null,
    });

    if (nextCategoryId !== quickAddCategoryId) {
      setQuickAddCategoryId(nextCategoryId);
    }
  }, [categoryDraft?.id, quickAddCategoryId, workspace]);

  useEffect(() => {
    setSearchInput(browseState.searchText);
  }, [browseState.searchText]);

  useEffect(() => {
    setMinPriceInput(
      browseState.minPrice === null ? "" : String(browseState.minPrice),
    );
  }, [browseState.minPrice]);

  useEffect(() => {
    setMaxPriceInput(
      browseState.maxPrice === null ? "" : String(browseState.maxPrice),
    );
  }, [browseState.maxPrice]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    const normalizedSearchParams =
      applyProcurementCatalogBrowseStateToSearchParams({
        searchParams: new URLSearchParams(searchParams.toString()),
        state: browseState,
      });

    if (normalizedSearchParams.toString() === searchParams.toString()) {
      return;
    }

    startTransition(() => {
      router.replace(buildWorkspaceHref(pathname, normalizedSearchParams), {
        scroll: false,
      });
    });
  }, [browseState, pathname, router, searchParams, workspace]);

  useEffect(() => {
    if (!browseMeta) {
      return;
    }

    const normalizedStateFromBackend: ProcurementCatalogBrowseState = {
      ...browseMeta.normalizedFilters,
      page: browseMeta.currentPage,
    };

    if (
      areProcurementCatalogBrowseStatesEqual(
        normalizedStateFromBackend,
        browseState,
      )
    ) {
      return;
    }

    const normalizedSearchParams =
      applyProcurementCatalogBrowseStateToSearchParams({
        searchParams: new URLSearchParams(searchParams.toString()),
        state: normalizedStateFromBackend,
      });

    if (normalizedSearchParams.toString() === searchParams.toString()) {
      return;
    }

    startTransition(() => {
      router.replace(buildWorkspaceHref(pathname, normalizedSearchParams), {
        scroll: false,
      });
    });
  }, [browseMeta, browseState, pathname, router, searchParams]);

  useEffect(() => {
    if (!workspace || searchInput === browseState.searchText) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextSearchParams = applyProcurementCatalogBrowseStateToSearchParams(
        {
          searchParams: new URLSearchParams(searchParams.toString()),
          state: {
            ...browseState,
            page: 1,
            searchText: searchInput,
          },
        },
      );

      if (nextSearchParams.toString() === searchParams.toString()) {
        return;
      }

      startTransition(() => {
        router.replace(buildWorkspaceHref(pathname, nextSearchParams), {
          scroll: false,
        });
      });
    }, PROCUREMENT_CATALOG_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [browseState, pathname, router, searchInput, searchParams, workspace]);

  useEffect(() => {
    if (typeof window === "undefined" || !workspace || isEditorOpen) {
      return;
    }

    const draft = parseStoredItemDraft(
      window.sessionStorage.getItem(ITEM_DRAFT_STORAGE_KEY),
    );
    if (!draft || !hasMeaningfulItemDraftValues(draft)) {
      clearItemDraftStorage();
      return;
    }

    const categoryId = resolveProcurementItemDraftCategoryId({
      categories: workspace.categories,
      draftCategoryId: draft.categoryId,
    });
    if (categoryId) {
      setQuickAddCategoryId(categoryId);
    }

    const category =
      workspace.categories.find((entry) => entry.id === categoryId) ??
      workspace.categories.find((entry) => entry.isActive) ??
      null;

    setEditingItem({
      archivedLabel: null,
      archivedAt: null,
      categoryId,
      categoryLimit:
        category?.limit ??
        buildProcurementItemTierLimitState({
          activeItemCount: 0,
          tier: workspace.meta.tier,
        }),
      categoryName: category?.name ?? draft.categoryName ?? "Category",
      complianceFlags: draft.complianceFlags,
      complianceSummary: summarizeComplianceFlags(draft.complianceFlags),
      description: draft.name,
      id: draft.id,
      isActive: true,
      lastPriceChangedAt: null,
      maxQuantity: draft.maxQuantity,
      minQuantity: draft.minQuantity,
      name: draft.name,
      procurementMethod: draft.procurementMethod,
      revision: draft.revision,
      sortOrder: Number.MAX_SAFE_INTEGER,
      sourceOfFunds: draft.sourceOfFunds,
      unitOfMeasurement: draft.customUnit ?? draft.unit,
      unitPrice: draft.unitPrice,
    });
    setEditorSource("restored-draft");
    setIsEditorOpen(true);
  }, [isEditorOpen, workspace]);

  if (!workspace) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    );
  }

  function clearItemDraftStorage(): void {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(ITEM_DRAFT_STORAGE_KEY);
    }
  }

  function saveDraftStorage(draft: StoredItemDraft | null): void {
    if (typeof window === "undefined") {
      return;
    }

    if (!draft || !hasMeaningfulItemDraftValues(draft)) {
      clearItemDraftStorage();
      return;
    }

    window.sessionStorage.setItem(
      ITEM_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    );
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
    setBlockedExport(null);
    router.replace(getProcurementItemCrudRecoveryHref());
  }

  function replaceBrowseState(nextState: ProcurementCatalogBrowseState): void {
    const nextSearchParams = applyProcurementCatalogBrowseStateToSearchParams({
      searchParams: new URLSearchParams(searchParams.toString()),
      state: nextState,
    });

    if (nextSearchParams.toString() === searchParams.toString()) {
      return;
    }

    startTransition(() => {
      router.replace(buildWorkspaceHref(pathname, nextSearchParams), {
        scroll: false,
      });
    });
  }

  function commitPriceFilters(): void {
    replaceBrowseState({
      ...browseState,
      maxPrice: parsePriceInput(maxPriceInput),
      minPrice: parsePriceInput(minPriceInput),
      page: 1,
    });
  }

  function clearBrowseFilters(): void {
    setSearchInput("");
    setMinPriceInput("");
    setMaxPriceInput("");
    replaceBrowseState({
      categoryIds: [],
      complianceFlags: [],
      maxPrice: null,
      minPrice: null,
      page: 1,
      searchText: "",
    });
  }

  function handlePriceKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      commitPriceFilters();
    }
  }

  function toggleCategoryFilter(categoryId: string): void {
    const nextCategoryIds = browseState.categoryIds.includes(categoryId)
      ? browseState.categoryIds.filter((value) => value !== categoryId)
      : [...browseState.categoryIds, categoryId];

    replaceBrowseState({
      ...browseState,
      categoryIds: nextCategoryIds,
      page: 1,
    });
  }

  function toggleComplianceFilter(flag: ProcurementItemComplianceFlag): void {
    const nextComplianceFlags = browseState.complianceFlags.includes(flag)
      ? browseState.complianceFlags.filter((value) => value !== flag)
      : [...browseState.complianceFlags, flag];

    replaceBrowseState({
      ...browseState,
      complianceFlags: nextComplianceFlags,
      page: 1,
    });
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
          unit: values.unitOption === "custom" ? "custom" : (values.unit ?? ""),
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
          unit: values.unitOption === "custom" ? "custom" : (values.unit ?? ""),
          unitPrice: values.unitPrice,
        });
        toast.success("Item created.");
      }

      clearItemDraftStorage();
      setQuickAddCategoryId(values.categoryId);
      resetEditor();
    } catch (error) {
      if (isProcurementItemCrudAuthorizationError(error)) {
        toast.error(
          "Your access changed. Redirecting to refresh your workspace.",
        );
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

  async function onQuickAddSubmit(values: ItemFormData): Promise<void> {
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
        unit: values.unitOption === "custom" ? "custom" : (values.unit ?? ""),
        unitPrice: values.unitPrice,
      });
      clearItemDraftStorage();
      setQuickAddCategoryId(values.categoryId);
      toast.success("Item created.");
    } catch (error) {
      if (isProcurementItemCrudAuthorizationError(error)) {
        toast.error(
          "Your access changed. Redirecting to refresh your workspace.",
        );
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
    if (!archiveTarget) {
      return;
    }

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
        toast.error(
          "Your access changed. Redirecting to refresh your workspace.",
        );
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
      toast.error(
        error instanceof Error ? error.message : "Workbook template failed.",
      );
    } finally {
      setIsDownloadingTemplate(false);
    }
  }

  async function onWorkbookSelected(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

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
        toast.error(
          "Your access changed. Redirecting to refresh your workspace.",
        );
        redirectToProtectedAccessHandling();
        return;
      }

      toast.error(
        error instanceof Error ? error.message : "Workbook import failed.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function onExportCatalog(): Promise<void> {
    if (!browseMeta) {
      return;
    }

    const exportGuard = getProcurementCatalogExportGuardState({
      filteredCount: browseMeta.filteredCount,
      tier: browseMeta.tier,
    });

    if (exportGuard.kind === "empty") {
      toast.error(exportGuard.description);
      return;
    }

    if (exportGuard.kind !== "allowed") {
      setBlockedExport(exportGuard);
      return;
    }

    setIsExporting(true);
    try {
      const workbook = (await exportCatalogItems({
        categoryIds: browseMeta.normalizedFilters.categoryIds,
        complianceFlags: browseMeta.normalizedFilters.complianceFlags,
        maxPrice: browseMeta.normalizedFilters.maxPrice ?? undefined,
        minPrice: browseMeta.normalizedFilters.minPrice ?? undefined,
        searchText: browseMeta.normalizedFilters.searchText,
      })) as {
        fileName: string;
        filteredCount: number;
        workbookBase64: string;
      };

      downloadBase64File(workbook.fileName, workbook.workbookBase64);
      toast.success(
        `Exported ${workbook.filteredCount.toLocaleString("en-US")} catalog rows.`,
      );
    } catch (error) {
      if (isProcurementItemCrudAuthorizationError(error)) {
        toast.error(
          "Your access changed. Redirecting to refresh your workspace.",
        );
        redirectToProtectedAccessHandling();
        return;
      }

      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : PROCUREMENT_ITEM_EXPORT_GENERIC_ERROR_MESSAGE;
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  }

  function openCreate(): void {
    if (!quickAddCategory) {
      toast.error(
        "Create or reactivate a category before adding catalog items.",
      );
      return;
    }

    if (quickAddCategory.limit.atLimit) {
      setIsTierLimitOpen(true);
      return;
    }

    clearItemDraftStorage();
    setEditingItem(null);
    setEditorSource("create");
    setIsEditorOpen(true);
  }

  const resultsLabel = browseMeta
    ? browseMeta.filteredCount === 0
      ? "No matching rows"
      : `Showing ${browseMeta.startRow}-${browseMeta.endRow} of ${browseMeta.filteredCount.toLocaleString("en-US")} rows`
    : "Loading catalog rows...";
  const categoryTriggerLabel =
    browseState.categoryIds.length === 0
      ? "All categories"
      : browseState.categoryIds.length === 1
        ? (categoryNamesById.get(browseState.categoryIds[0] ?? "") ??
          "1 category")
        : `${browseState.categoryIds.length} categories`;
  const complianceTriggerLabel =
    browseState.complianceFlags.length === 0
      ? "All compliance"
      : browseState.complianceFlags.length === 1
        ? formatComplianceFlagLabel(browseState.complianceFlags[0] ?? "agpo")
        : `${browseState.complianceFlags.length} flags`;
  const isInitialBrowseLoading = browseResult === undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            <PackagePlus className="h-4 w-4" />
            Item catalog management
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Search the live catalog, narrow large result sets, and export the
            filtered workbook without losing quick add, advanced editing, or
            workbook import.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryPill
            label="Active items"
            value={String(workspace.meta.activeItemCount)}
          />
          <SummaryPill
            label="Filtered rows"
            value={
              browseMeta
                ? browseMeta.filteredCount.toLocaleString("en-US")
                : "..."
            }
          />
          <SummaryPill
            label="Workbook row cap"
            value={
              workspace.meta.importLimit.rowLimit === null
                ? "Unlimited"
                : String(workspace.meta.importLimit.rowLimit)
            }
          />
          <SummaryPill
            label="Total records"
            value={String(workspace.meta.totalItemCount)}
          />
        </div>
      </div>

      <input
        ref={fileInputRef}
        accept=".xlsx,.xls"
        className="hidden"
        type="file"
        onChange={(event) => {
          void onWorkbookSelected(event);
        }}
      />

      {categoryDraft ? (
        <div className="rounded-3xl border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium text-foreground">
                Category handoff preserved
              </div>
              <p>
                {categoryDraft.id
                  ? `Working from the Categories flow for ${categoryDraft.name}. Draft category changes stay preserved while you manage items here.`
                  : `The draft category ${categoryDraft.name || "Untitled category"} is still preserved in the Categories workspace. Save the category there before attaching live items to it.`}
              </p>
            </div>
            <Button asChild type="button" variant="outline">
              <Link href="/po/categories">
                <FolderTree className="mr-2 h-4 w-4" />
                Back to Categories
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <QuickAddItemCard
          categories={activeCategories}
          isSubmitting={isSubmitting}
          selectedCategoryId={quickAddCategoryId}
          onOpenAdvanced={openCreate}
          onSelectedCategoryIdChange={setQuickAddCategoryId}
          onSubmit={onQuickAddSubmit}
        />

        <div className="rounded-3xl border-2 border-dashed border-border/70 bg-background p-5 text-center shadow-sm">
          <div className="space-y-2">
            <div className="text-sm font-semibold text-foreground">
              Bulk Upload Items
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Upload the standard template workbook for this tenant-scoped
              catalog. Valid rows import and invalid rows stay visible in the
              summary.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={isDownloadingTemplate}
              onClick={() => {
                void onDownloadTemplate();
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Select File
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Template columns follow the live contract: Item Name, Category,
            Unit, Price, quantity limits, and compliance flags.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Filter className="h-4 w-4 text-primary" />
                Browse live catalog
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Search by item name, description, or category. Filters stay in
                the URL so the same catalog view can be refreshed or shared
                truthfully.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={openCreate}
              >
                <PackagePlus className="mr-2 h-4 w-4" />
                Advanced Editor
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                disabled={isExporting || isInitialBrowseLoading}
                onClick={() => {
                  void onExportCatalog();
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Exporting..." : "Export to Excel"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search item name, description, or category"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-between rounded-xl"
                >
                  <span>{categoryTriggerLabel}</span>
                  <Badge variant="secondary" className="rounded-full">
                    {browseState.categoryIds.length}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel>Category filters</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {workspace.categories.map((category) => (
                  <DropdownMenuCheckboxItem
                    key={category.id}
                    checked={browseState.categoryIds.includes(category.id)}
                    onCheckedChange={() => toggleCategoryFilter(category.id)}
                  >
                    {category.name}
                    {!category.isActive ? " (Archived)" : ""}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-between rounded-xl"
                >
                  <span>{complianceTriggerLabel}</span>
                  <Badge variant="secondary" className="rounded-full">
                    {browseState.complianceFlags.length}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Compliance filters</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {PROCUREMENT_ITEM_COMPLIANCE_FLAGS.map((flag) => (
                  <DropdownMenuCheckboxItem
                    key={flag}
                    checked={browseState.complianceFlags.includes(flag)}
                    onCheckedChange={() => toggleComplianceFilter(flag)}
                  >
                    {formatComplianceFlagLabel(flag)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Input
              inputMode="decimal"
              min="0"
              placeholder="Min price"
              type="number"
              value={minPriceInput}
              onBlur={commitPriceFilters}
              onChange={(event) => setMinPriceInput(event.target.value)}
              onKeyDown={handlePriceKeyDown}
            />
            <Input
              inputMode="decimal"
              min="0"
              placeholder="Max price"
              type="number"
              value={maxPriceInput}
              onBlur={commitPriceFilters}
              onChange={(event) => setMaxPriceInput(event.target.value)}
              onKeyDown={handlePriceKeyDown}
            />
          </div>

          {hasFilters ? (
            <div className="flex flex-wrap items-center gap-2">
              {browseState.searchText ? (
                <ActiveFilterChip
                  label={`Search: ${browseState.searchText}`}
                  onClear={() => {
                    setSearchInput("");
                    replaceBrowseState({
                      ...browseState,
                      page: 1,
                      searchText: "",
                    });
                  }}
                />
              ) : null}
              {browseState.categoryIds.map((categoryId) => (
                <ActiveFilterChip
                  key={categoryId}
                  label={
                    categoryNamesById.get(categoryId) ?? "Unknown category"
                  }
                  onClear={() => toggleCategoryFilter(categoryId)}
                />
              ))}
              {browseState.complianceFlags.map((flag) => (
                <ActiveFilterChip
                  key={flag}
                  label={formatComplianceFlagLabel(flag)}
                  onClear={() => toggleComplianceFilter(flag)}
                />
              ))}
              {browseState.minPrice !== null ? (
                <ActiveFilterChip
                  label={`Min ${formatKesAmount(browseState.minPrice)}`}
                  onClear={() => {
                    setMinPriceInput("");
                    replaceBrowseState({
                      ...browseState,
                      minPrice: null,
                      page: 1,
                    });
                  }}
                />
              ) : null}
              {browseState.maxPrice !== null ? (
                <ActiveFilterChip
                  label={`Max ${formatKesAmount(browseState.maxPrice)}`}
                  onClear={() => {
                    setMaxPriceInput("");
                    replaceBrowseState({
                      ...browseState,
                      maxPrice: null,
                      page: 1,
                    });
                  }}
                />
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className="rounded-full px-3"
                onClick={clearBrowseFilters}
              >
                Clear all
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">
                {resultsLabel}
              </div>
              <p className="text-xs text-muted-foreground">
                Results update after a short debounce and page fallbacks stay
                truthful when the filtered catalog changes.
              </p>
            </div>
            {browseMeta ? (
              <CatalogPagination
                currentPage={browseMeta.currentPage}
                hasNextPage={browseMeta.hasNextPage}
                hasPreviousPage={browseMeta.hasPreviousPage}
                totalPages={browseMeta.totalPages}
                onNext={() =>
                  replaceBrowseState({
                    ...browseState,
                    page: browseMeta.currentPage + 1,
                  })
                }
                onPrevious={() =>
                  replaceBrowseState({
                    ...browseState,
                    page: Math.max(browseMeta.currentPage - 1, 1),
                  })
                }
              />
            ) : null}
          </div>

          {isInitialBrowseLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 rounded-2xl" />
              <Skeleton className="h-12 rounded-2xl" />
              <Skeleton className="h-12 rounded-2xl" />
            </div>
          ) : browseMeta && browseMeta.filteredCount === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
              <div className="text-lg font-semibold text-foreground">
                {workspace.meta.totalItemCount === 0
                  ? "No catalog items yet"
                  : "No rows match the current filters"}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {workspace.meta.totalItemCount === 0
                  ? "Add one item above or upload the workbook template to start the live catalog."
                  : "Clear or refine the filters to bring matching rows back into view. Export stays blocked until the filtered result set contains rows."}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {hasFilters ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={clearBrowseFilters}
                  >
                    Clear filters
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={openCreate}
                >
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Open Advanced Editor
                </Button>
              </div>
            </div>
          ) : (
            <ItemsCatalogTable
              rows={browseRows}
              onArchive={setArchiveTarget}
              onEdit={(row) => {
                clearItemDraftStorage();
                setEditingItem(row);
                setEditorSource("edit");
                setIsEditorOpen(true);
              }}
            />
          )}
        </div>
      </div>

      <ItemEditorDialog
        categories={workspace.categories}
        categoryContext={quickAddCategory}
        item={editingItem}
        isSubmitting={isSubmitting}
        onDraftChange={saveDraftStorage}
        onDiscardDraft={clearItemDraftStorage}
        onOpenChange={(open) => {
          setIsEditorOpen(open);
          if (!open) {
            resetEditor();
          }
        }}
        onSubmit={onSubmit}
        open={isEditorOpen}
        requiresDiscardConfirmation={editorSource === "restored-draft"}
      />

      <ArchiveItemDialog
        item={archiveTarget}
        isPending={isPendingArchive}
        onConfirm={() => {
          void onArchive();
        }}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
          }
        }}
      />

      <ImportSummaryDialog
        summary={importSummary}
        onOpenChange={(open) => {
          if (!open) {
            setImportSummary(null);
          }
        }}
      />

      <TierLimitDialog
        body={tierLimitContent.body}
        guidance={tierLimitContent.guidance}
        open={isTierLimitOpen}
        title={tierLimitContent.title}
        onOpenChange={setIsTierLimitOpen}
      />

      <BlockedExportDialog
        blockedExport={blockedExport}
        onOpenChange={(open) => {
          if (!open) {
            setBlockedExport(null);
          }
        }}
      />
    </div>
  );
}
