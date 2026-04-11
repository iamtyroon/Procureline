import assert from "node:assert/strict";
import { ConvexError } from "convex/values";
import {
  assertProcurementItemAssignmentAllowed,
  assertProcurementItemTierCapacity,
  assertProcurementItemUnique,
  resolveNextProcurementItemSortOrder,
  type ProcurementItemBackendQueryCtx,
  type ProcurementItemBackendRecord,
} from "../lib/procurement-officer/item-backend";
import {
  applyProcurementCatalogBrowseStateToSearchParams,
  createDefaultProcurementCatalogBrowseState,
  getProcurementCatalogExportGuardState,
  hasActiveProcurementCatalogFilters,
  readProcurementCatalogBrowseState,
} from "../lib/procurement-officer/catalog-filters";
import {
  buildProcurementCatalogExportRows,
  buildProcurementItemCatalogSearchText,
  buildProcurementItemEditorCategoryOptions,
  buildProcurementItemImportLimitState,
  buildProcurementItemTierLimitState,
  buildProcurementItemWorkspaceRows,
  categoryAcceptsProcurementItems,
  createProcurementItemDuplicateKey,
  createProcurementItemPriceHistoryEntry,
  filterProcurementCatalogRows,
  getComparableProcurementItemRevision,
  getProcurementItemImportRowFailure,
  getNextProcurementItemSortOrder,
  hasProcurementItemDuplicateConflict,
  normalizeImportedProcurementItemUnit,
  normalizeComplianceFlags,
  paginateProcurementCatalogRows,
  normalizeProcurementItemName,
  parseStoredItemDraft,
  resolveProcurementItemDraftCategoryId,
} from "../lib/procurement-officer/items";

function createMockItemBackendQueryCtx(
  items: ProcurementItemBackendRecordWithScope[],
): ProcurementItemBackendQueryCtx {
  return {
    db: {
      query() {
        return {
          withIndex(
            _indexName: string,
            build: (builder: {
              eq(field: string, value: unknown): unknown;
            }) => unknown,
          ) {
            const values = new Map<string, unknown>();
            const chainBuilder = {
              eq(field: string, value: unknown) {
                values.set(field, value);
                return chainBuilder;
              },
            };
            build(chainBuilder);

            return {
              async collect() {
                return items.filter(
                  (item) =>
                    item.tenantId === values.get("tenantId") &&
                    item.categoryId === values.get("categoryId"),
                );
              },
            };
          },
        };
      },
    },
  } as ProcurementItemBackendQueryCtx;
}

type ProcurementItemBackendRecordWithScope = ProcurementItemBackendRecord & {
  categoryId: string;
  tenantId: string;
};

async function expectConvexError(
  callback: () => unknown,
): Promise<ConvexError<any>> {
  try {
    await callback();
    assert.fail("Expected a ConvexError");
  } catch (error) {
    assert.ok(error instanceof ConvexError);
    return error;
  }
}

export async function runProcurementOfficerItemTests(): Promise<string[]> {
  const completedTests: string[] = [];

  assert.equal(
    normalizeProcurementItemName("  Laptop   Computer  "),
    "laptop computer",
  );
  assert.deepEqual(
    normalizeComplianceFlags(["AGPO", " pwd ", "unsupported", "agpo"]),
    ["agpo", "pwd"],
  );
  completedTests.push(
    "item normalization helpers collapse description whitespace and keep only supported compliance flags in stable lowercase form",
  );

  const browseState = readProcurementCatalogBrowseState(
    new URLSearchParams(
      "itemSearch=  laptops  &itemCategory=cat-it&itemCategory=cat-missing&itemCategory=cat-it&itemCompliance=AGPO&itemCompliance=pwd&itemCompliance=bad&itemMinPrice=-20&itemMaxPrice=900&itemPage=0",
    ),
    {
      availableCategoryIds: ["cat-it", "cat-office"],
    },
  );
  assert.deepEqual(browseState, {
    categoryIds: ["cat-it"],
    complianceFlags: ["agpo", "pwd"],
    maxPrice: 900,
    minPrice: null,
    page: 1,
    searchText: "laptops",
  });
  assert.equal(hasActiveProcurementCatalogFilters(browseState), true);
  assert.deepEqual(createDefaultProcurementCatalogBrowseState(), {
    categoryIds: [],
    complianceFlags: [],
    maxPrice: null,
    minPrice: null,
    page: 1,
    searchText: "",
  });
  assert.equal(
    applyProcurementCatalogBrowseStateToSearchParams({
      searchParams: new URLSearchParams(
        "modal=categories&section=items&itemSearch=stale&itemPage=9&foo=bar",
      ),
      state: browseState,
    }).toString(),
    "modal=categories&section=items&foo=bar&itemSearch=laptops&itemMaxPrice=900&itemCategory=cat-it&itemCompliance=agpo&itemCompliance=pwd",
  );
  completedTests.push(
    "catalog browse query-state helpers normalize stale categories, malformed page and price params, dedupe compliance flags, and preserve only whitelisted item filters when rebuilding the URL",
  );

  assert.deepEqual(
    buildProcurementItemTierLimitState({
      activeItemCount: 50,
      tier: "free",
    }),
    {
      atLimit: true,
      limit: 50,
      remainingSlots: 0,
      tier: "free",
      tierLabel: "Free",
      upgradeHref: "/pricing",
    },
  );
  assert.equal(
    buildProcurementItemImportLimitState({
      tier: "professional",
    }).rowLimit,
    1_000,
  );
  assert.equal(
    buildProcurementItemImportLimitState({
      tier: "enterprise",
    }).rowLimit,
    null,
  );
  completedTests.push(
    "item tier helpers enforce per-category caps and workbook row limits across Free, Professional, and Enterprise without inventing paid caps for enterprise",
  );

  assert.equal(
    getProcurementItemImportRowFailure({
      activeItemCount: 0,
      categoryName: "",
      hasActiveCategory: false,
      limit: 50,
      maxQuantity: null,
      minQuantity: null,
      normalizedName: "",
      price: null,
      rowIndexWithinTierCap: 0,
      rowLimit: 100,
      seenInFile: new Set<string>(),
      unit: "",
    }),
    "Category is required",
  );
  assert.equal(
    getProcurementItemImportRowFailure({
      activeItemCount: 50,
      categoryName: "ICT Equipment",
      hasActiveCategory: true,
      limit: 50,
      maxQuantity: 2,
      minQuantity: 5,
      normalizedName: "cat-it::laptops",
      price: 50_000,
      rowIndexWithinTierCap: 0,
      rowLimit: 100,
      seenInFile: new Set<string>(),
      unit: "each",
    }),
    "Maximum quantity must be greater than or equal to minimum quantity",
  );
  assert.equal(
    getProcurementItemImportRowFailure({
      activeItemCount: 1,
      categoryName: "ICT Equipment",
      hasActiveCategory: true,
      limit: 150,
      maxQuantity: null,
      minQuantity: null,
      normalizedName: "cat-it::laptops",
      price: 50_000,
      rowIndexWithinTierCap: 100,
      rowLimit: 100,
      seenInFile: new Set<string>(),
      unit: "each",
    }),
    "Workbook row limit reached for this plan tier.",
  );
  assert.equal(
    getProcurementItemImportRowFailure({
      activeItemCount: 2,
      categoryName: "ICT Equipment",
      hasActiveCategory: true,
      limit: 150,
      maxQuantity: null,
      minQuantity: null,
      normalizedName: "cat-it::laptops",
      price: 50_000,
      rowIndexWithinTierCap: 0,
      rowLimit: 100,
      seenInFile: new Set<string>(["cat-it::laptops"]),
      unit: "each",
    }),
    "This item appears more than once in the workbook for the same category.",
  );
  completedTests.push(
    "item workbook validation catches blank categories, invalid quantity ranges, tier row overflow, and duplicate workbook rows before import writes begin",
  );

  const parsedDraft = parseStoredItemDraft(
    JSON.stringify({
      categoryId: "cat-it",
      categoryName: "ICT Equipment",
      complianceFlags: ["agpo", "local_content"],
      customUnit: "service",
      id: "item-service",
      maxQuantity: "12",
      minQuantity: "2",
      name: "Maintenance Support",
      procurementMethod: "Framework",
      revision: 3,
      sourceOfFunds: "R&D",
      unit: "custom",
      unitPrice: "15000",
    }),
  );
  assert.deepEqual(parsedDraft, {
    categoryId: "cat-it",
    categoryName: "ICT Equipment",
    complianceFlags: ["agpo", "local_content"],
    customUnit: "service",
    id: "item-service",
    maxQuantity: 12,
    minQuantity: 2,
    name: "Maintenance Support",
    procurementMethod: "Framework",
    revision: 3,
    sourceOfFunds: "R&D",
    unit: "custom",
    unitPrice: 15_000,
  });
  completedTests.push(
    "item draft restoration preserves custom-unit data and numeric bounds so category-to-items handoff can be resumed without silently flattening the operator draft",
  );

  assert.equal(
    resolveProcurementItemDraftCategoryId({
      categories: [
        {
          activeItemCount: 2,
          id: "cat-it",
          isActive: true,
          name: "ICT Equipment",
          sortOrder: 1,
        },
        {
          activeItemCount: 0,
          id: "cat-legacy",
          isActive: false,
          name: "Legacy Assets",
          sortOrder: 2,
        },
      ],
      draftCategoryId: "cat-legacy",
    }),
    "cat-legacy",
  );
  assert.equal(
    resolveProcurementItemDraftCategoryId({
      categories: [
        {
          activeItemCount: 2,
          id: "cat-it",
          isActive: true,
          name: "ICT Equipment",
          sortOrder: 1,
        },
        {
          activeItemCount: 0,
          id: "cat-legacy",
          isActive: false,
          name: "Legacy Assets",
          sortOrder: 2,
        },
      ],
      draftCategoryId: "cat-missing",
    }),
    "cat-it",
  );
  assert.deepEqual(
    buildProcurementItemEditorCategoryOptions({
      categories: [
        {
          activeItemCount: 2,
          id: "cat-it",
          isActive: true,
          name: "ICT Equipment",
          sortOrder: 1,
        },
        {
          activeItemCount: 0,
          id: "cat-legacy",
          isActive: false,
          name: "Legacy Assets",
          sortOrder: 2,
        },
      ],
      selectedCategoryId: "cat-legacy",
    }).map((category) => ({
      id: category.id,
      isPreservedInactiveSelection: category.isPreservedInactiveSelection,
    })),
    [
      { id: "cat-it", isPreservedInactiveSelection: false },
      { id: "cat-legacy", isPreservedInactiveSelection: true },
    ],
  );
  completedTests.push(
    "item handoff helpers preserve a draft or current archived category selection while still defaulting new work back to the first live category when the draft target no longer exists",
  );

  const workspaceRows = buildProcurementItemWorkspaceRows({
    categories: [
      {
        activeItemCount: 1,
        id: "cat-it",
        isActive: true,
        name: "ICT Equipment",
        sortOrder: 1,
      },
    ],
    items: [
      {
        archivedAt: Date.UTC(2026, 3, 2, 8, 0, 0),
        categoryId: "cat-it",
        categoryName: "ICT Equipment",
        complianceFlags: ["pwd"],
        description: "Legacy Printer",
        id: "item-archived",
        isActive: false,
        lastPriceChangedAt: null,
        maxQuantity: null,
        minQuantity: null,
        name: "Legacy Printer",
        procurementMethod: null,
        revision: 1,
        sortOrder: 2,
        sourceOfFunds: null,
        unitOfMeasurement: "each",
        unitPrice: 10_000,
      },
      {
        archivedAt: null,
        categoryId: "cat-it",
        categoryName: "ICT Equipment",
        complianceFlags: ["agpo", "local_content"],
        description: "Laptop",
        id: "item-active",
        isActive: true,
        lastPriceChangedAt: Date.UTC(2026, 3, 1, 8, 0, 0),
        maxQuantity: 10,
        minQuantity: 1,
        name: "Laptop",
        procurementMethod: "RFQ",
        revision: 2,
        sortOrder: 1,
        sourceOfFunds: "GOK",
        unitOfMeasurement: "each",
        unitPrice: 75_000,
      },
    ],
    tier: "starter",
  });
  assert.deepEqual(
    workspaceRows.map((row) => row.id),
    ["item-active", "item-archived"],
  );
  assert.equal(workspaceRows[0]?.complianceSummary, "AGPO, Local Content");
  assert.equal(workspaceRows[1]?.archivedLabel, "Archived");
  completedTests.push(
    "item workspace shaping keeps live records ahead of archived ones while surfacing compliance summaries and archived labels for the PO modal list",
  );

  const filteredRows = filterProcurementCatalogRows({
    filters: {
      categoryIds: ["cat-it"],
      complianceFlags: ["agpo"],
      maxPrice: 80_000,
      minPrice: 70_000,
      searchText: "equipment laptop",
    },
    rows: workspaceRows,
  });
  const reorderedSearchRows = filterProcurementCatalogRows({
    filters: {
      categoryIds: [],
      complianceFlags: [],
      maxPrice: null,
      minPrice: null,
      searchText: "ict laptop",
    },
    rows: workspaceRows,
  });
  assert.deepEqual(
    filteredRows.map((row) => row.id),
    ["item-active"],
  );
  assert.deepEqual(
    reorderedSearchRows.map((row) => row.id),
    ["item-active"],
  );
  assert.equal(
    buildProcurementItemCatalogSearchText({
      categoryName: "ICT Equipment",
      description: "Laptop",
      name: "Laptop",
    }),
    "laptop laptop ict equipment",
  );
  assert.deepEqual(
    paginateProcurementCatalogRows({
      page: 99,
      pageSize: 1,
      rows: workspaceRows,
    }),
    {
      currentPage: 2,
      page: workspaceRows.slice(1, 2),
      pageSize: 1,
      totalCount: 2,
      totalPages: 2,
    },
  );
  assert.deepEqual(buildProcurementCatalogExportRows(filteredRows), [
    {
      Category: "ICT Equipment",
      "Compliance Flags": "AGPO, Local Content",
      Description: "Laptop",
      "Item Name": "Laptop",
      Price: 75_000,
      "Qty Limits": "1 - 10",
      Unit: "each",
    },
  ]);
  completedTests.push(
    "catalog browse helpers match cross-field token search regardless of term order, combined filters, nearest-valid pagination fallback, and export row mapping without depending on the client to scan the full catalog",
  );

  assert.deepEqual(
    getProcurementCatalogExportGuardState({
      filteredCount: 0,
      tier: "professional",
    }),
    {
      description:
        "No rows match the current filters. Clear or refine filters before exporting.",
      kind: "empty",
      title: "No rows to export",
    },
  );
  assert.deepEqual(
    getProcurementCatalogExportGuardState({
      filteredCount: 50,
      tier: "starter",
    }),
    {
      description:
        "Catalog export is available on the Professional and Enterprise plans. Upgrade to generate the filtered workbook.",
      kind: "tier_gate",
      title: "Starter plan required for catalog export",
    },
  );
  assert.deepEqual(
    getProcurementCatalogExportGuardState({
      filteredCount: 10_001,
      tier: "professional",
    }),
    {
      description:
        "This filtered result contains 10,001 rows. Refine the filters or upgrade to Enterprise before exporting.",
      kind: "row_limit",
      title: "Professional export limit exceeded",
    },
  );
  assert.deepEqual(
    getProcurementCatalogExportGuardState({
      filteredCount: 25_000,
      tier: "enterprise",
    }),
    {
      description: "The current filtered catalog can be exported safely.",
      kind: "allowed",
      title: "Export available",
    },
  );
  completedTests.push(
    "catalog export gating distinguishes empty results, Starter or Free plan blocking, Professional row-limit blocking, and Enterprise unlimited export eligibility with deterministic operator copy",
  );

  assert.equal(categoryAcceptsProcurementItems({ isActive: true }), true);
  assert.equal(categoryAcceptsProcurementItems({ isActive: false }), false);
  assert.equal(
    hasProcurementItemDuplicateConflict({
      excludeItemId: "item-keep",
      items: [
        {
          _id: "item-keep",
          isActive: true,
          name: "Laptop",
          normalizedName: "laptop",
        },
        {
          _id: "item-archived",
          isActive: false,
          name: "Laptop",
          normalizedName: "laptop",
        },
        {
          _id: "item-conflict",
          isActive: true,
          name: "Laptop",
          normalizedName: "laptop",
        },
      ],
      normalizedName: "laptop",
    }),
    true,
  );
  assert.equal(
    hasProcurementItemDuplicateConflict({
      excludeItemId: "item-keep",
      items: [
        {
          _id: "item-keep",
          isActive: true,
          name: "Laptop",
          normalizedName: "laptop",
        },
        {
          _id: "item-archived",
          isActive: false,
          name: "Laptop",
          normalizedName: "laptop",
        },
      ],
      normalizedName: "laptop",
    }),
    false,
  );
  assert.equal(getComparableProcurementItemRevision(undefined), 0);
  assert.equal(getComparableProcurementItemRevision(3), 3);
  assert.equal(
    getNextProcurementItemSortOrder([
      { sortOrder: 1 },
      { sortOrder: 4 },
      { sortOrder: null },
    ]),
    5,
  );
  assert.equal(
    createProcurementItemDuplicateKey({
      categoryId: "cat-it",
      normalizedName: "laptop",
    }),
    "cat-it::laptop",
  );
  assert.deepEqual(normalizeImportedProcurementItemUnit("Pieces"), {
    valid: true,
    value: "each",
  });
  assert.deepEqual(normalizeImportedProcurementItemUnit("service"), {
    valid: false,
    value: "service",
  });
  completedTests.push(
    "item backend helpers keep inactive-category checks, same-category duplicate guards, revision comparison, sort ordering, and workbook unit aliases deterministic before Convex mutations write anything",
  );

  assert.doesNotThrow(() => {
    assertProcurementItemAssignmentAllowed({
      categoryIsActive: false,
      currentCategoryId: "cat-legacy",
      nextCategoryId: "cat-legacy",
    });
  });
  const assignmentError = await expectConvexError(() =>
    assertProcurementItemAssignmentAllowed({
      categoryIsActive: false,
      currentCategoryId: "cat-legacy",
      nextCategoryId: "cat-it",
    }),
  );
  assert.equal(
    assignmentError.data?.message,
    "Only active categories can accept new catalog items.",
  );

  const backendCtx = createMockItemBackendQueryCtx([
    {
      _id: "item-1",
      categoryId: "cat-it",
      isActive: true,
      name: "Laptop",
      normalizedName: "laptop",
      sortOrder: 3,
      tenantId: "tenant-1",
    },
    {
      _id: "item-2",
      categoryId: "cat-it",
      isActive: false,
      name: "Printer",
      normalizedName: "printer",
      sortOrder: 1,
      tenantId: "tenant-1",
    },
    {
      _id: "item-3",
      categoryId: "cat-office",
      isActive: true,
      name: "Paper",
      normalizedName: "paper",
      sortOrder: 7,
      tenantId: "tenant-1",
    },
  ]);
  const duplicateError = await expectConvexError(async () =>
    assertProcurementItemUnique(backendCtx, {
      categoryId: "cat-it",
      normalizedName: "laptop",
      tenantId: "tenant-1",
    }),
  );
  assert.equal(
    duplicateError.data?.message,
    "An active item with this description already exists in the selected category.",
  );
  await assertProcurementItemUnique(backendCtx, {
    categoryId: "cat-it",
    excludeItemId: "item-1",
    normalizedName: "laptop",
    tenantId: "tenant-1",
  });
  const capacityError = await expectConvexError(async () =>
    assertProcurementItemTierCapacity(
      createMockItemBackendQueryCtx(
        Array.from({ length: 50 }, (_, index) => ({
          _id: `item-${index}`,
          categoryId: "cat-it",
          isActive: true,
          name: `Item ${index}`,
          normalizedName: `item-${index}`,
          sortOrder: index + 1,
          tenantId: "tenant-1",
        })),
      ),
      {
        categoryId: "cat-it",
        tenantId: "tenant-1",
        tier: "free",
      },
    ),
  );
  assert.equal(
    capacityError.data?.message,
    "Item limit reached for this category on the current plan tier.",
  );
  assert.equal(
    await resolveNextProcurementItemSortOrder({
      categoryId: "cat-office",
      ctx: backendCtx,
      tenantId: "tenant-1",
    }),
    8,
  );
  completedTests.push(
    "item backend query helpers now cover archived-category edit safety, tenant-scoped duplicate checks, per-category tier caps, and next-sort-order resolution without needing a live Convex runtime",
  );

  assert.deepEqual(
    createProcurementItemPriceHistoryEntry({
      changedAt: 123,
      itemId: "item-laptop",
      nextUnitPrice: 85_000,
      previousUnitPrice: 75_000,
    }),
    {
      changedAt: 123,
      itemId: "item-laptop",
      nextUnitPrice: 85_000,
      previousUnitPrice: 75_000,
    },
  );
  completedTests.push(
    "item price-history shaping stays append-only and preserves both previous and next price values for the live catalog audit trail",
  );

  return completedTests;
}
