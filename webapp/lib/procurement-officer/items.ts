import { buildDashboardPath, FORBIDDEN_ACCESS_REASON } from "../auth/roles";
import { normalizePlainText } from "../security/input";

export const PROCUREMENT_ITEM_NAME_REQUIRED_MESSAGE =
  "Item description is required";
export const PROCUREMENT_ITEM_CATEGORY_REQUIRED_MESSAGE =
  "Category is required";
export const PROCUREMENT_ITEM_UNIT_REQUIRED_MESSAGE = "Unit is required";
export const PROCUREMENT_ITEM_UNIT_INVALID_MESSAGE = "Choose a supported unit";
export const PROCUREMENT_ITEM_UNIT_CUSTOM_REQUIRED_MESSAGE =
  "Enter a custom unit label";
export const PROCUREMENT_ITEM_PRICE_POSITIVE_MESSAGE =
  "Unit price must be greater than zero";
export const PROCUREMENT_ITEM_MIN_QUANTITY_INVALID_MESSAGE =
  "Minimum quantity must be zero or greater";
export const PROCUREMENT_ITEM_MAX_QUANTITY_INVALID_MESSAGE =
  "Maximum quantity must be zero or greater";
export const PROCUREMENT_ITEM_QUANTITY_RANGE_INVALID_MESSAGE =
  "Maximum quantity must be greater than or equal to minimum quantity";
export const PROCUREMENT_ITEM_DUPLICATE_MESSAGE =
  "An active item with this description already exists in the selected category.";
export const PROCUREMENT_ITEM_NOT_FOUND_MESSAGE = "Item not found";
export const PROCUREMENT_ITEM_CATEGORY_INACTIVE_MESSAGE =
  "Only active categories can accept new catalog items.";
export const PROCUREMENT_ITEM_REFRESH_REQUIRED_MESSAGE =
  "Item data changed. Refresh and try again.";
export const PROCUREMENT_ITEM_LIMIT_MESSAGE =
  "Item limit reached for this category on the current plan tier.";
export const PROCUREMENT_ITEM_IMPORT_FREE_TIER_MESSAGE =
  "Workbook import is unavailable on the Free tier.";
export const PROCUREMENT_ITEM_IMPORT_ROW_LIMIT_MESSAGE =
  "Workbook row limit reached for this plan tier.";
export const PROCUREMENT_ITEM_IMPORT_BLANK_CATEGORY_MESSAGE =
  "Category is required";
export const PROCUREMENT_ITEM_IMPORT_UNKNOWN_CATEGORY_MESSAGE =
  "Category could not be matched to an active catalog category.";
export const PROCUREMENT_ITEM_IMPORT_DUPLICATE_IN_FILE_MESSAGE =
  "This item appears more than once in the workbook for the same category.";
export const PROCUREMENT_ITEM_IMPORT_OVERFLOW_MESSAGE =
  "No remaining active-item slots are available for this category.";
export const PROCUREMENT_ITEM_COMPLIANCE_INVALID_MESSAGE =
  "Choose supported compliance flags only";
export const PROCUREMENT_ITEM_SAVE_GENERIC_ERROR_MESSAGE =
  "We could not save the item right now. Please try again.";
export const PROCUREMENT_ITEM_ARCHIVE_GENERIC_MESSAGE =
  "We could not archive the item right now. Please try again.";
export const PROCUREMENT_ITEM_IMPORT_GENERIC_ERROR_MESSAGE =
  "We could not import the item workbook right now. Please try again.";
export const PROCUREMENT_ITEM_EXPORT_GENERIC_ERROR_MESSAGE =
  "We could not export the catalog right now. Please try again.";
export const PROCUREMENT_ITEM_PRICE_CHANGE_NOTICE =
  "Catalog pricing changed while this workspace was open.";
export const PROCUREMENT_ITEM_VALIDATION_CHANGE_NOTICE =
  "Catalog validation rules changed while this workspace was open.";
export const PROCUREMENT_ITEM_WORKSPACE_DUPLICATE_MESSAGE =
  "Item already in this category";
export const PROCUREMENT_ITEM_WORKSPACE_UNAVAILABLE_MESSAGE =
  "This item is no longer available in the live catalog.";
export const PROCUREMENT_ITEM_WORKSPACE_QUANTITY_NEGATIVE_MESSAGE =
  "Quantity cannot be negative";
export const PROCUREMENT_ITEM_WORKSPACE_QUANTITY_INVALID_MESSAGE =
  "Quantity must be a valid number";
export const PROCUREMENT_ITEM_WORKSPACE_INTEGER_ONLY_MESSAGE =
  "Whole numbers only for this unit";
export const ITEM_DRAFT_STORAGE_KEY = "procureline:po:item-draft";

export const PROCUREMENT_ITEM_UNITS = [
  "each",
  "box",
  "kg",
  "liter",
  "ream",
  "set",
  "pair",
  "custom",
] as const;

export const PROCUREMENT_ITEM_COMPLIANCE_FLAGS = [
  "agpo",
  "pwd",
  "local_content",
] as const;

export const PROCUREMENT_ITEM_PROCUREMENT_METHODS = [
  "RFQ",
  "Open Tender",
  "Direct",
  "Low Value",
  "Framework",
] as const;

export const PROCUREMENT_ITEM_IMPORT_COLUMNS = [
  "Category",
  "Item/Service Description",
  "Unit Of Measurement",
  "Unit Price",
  "Proc Method",
  "Source Of Funds",
  "Min Quantity",
  "Max Quantity",
  "Compliance Flags",
] as const;

export type ProcurementItemTier =
  | "enterprise"
  | "free"
  | "professional"
  | "starter";
export type ProcurementItemUnit = (typeof PROCUREMENT_ITEM_UNITS)[number];
export type ProcurementItemComplianceFlag =
  (typeof PROCUREMENT_ITEM_COMPLIANCE_FLAGS)[number];
export type ProcurementItemProcurementMethod =
  (typeof PROCUREMENT_ITEM_PROCUREMENT_METHODS)[number];

export interface ProcurementItemTierLimitState {
  atLimit: boolean;
  limit: number | null;
  remainingSlots: number | null;
  tier: ProcurementItemTier;
  tierLabel: string;
  upgradeHref: string;
}

export interface ProcurementItemImportLimitState {
  rowLimit: number | null;
  tier: ProcurementItemTier;
  tierLabel: string;
}

export interface ProcurementItemTierLimitModalContent {
  body: string;
  guidance: string;
  title: string;
}

export interface ProcurementItemWorkspaceCategoryRecord {
  activeItemCount: number;
  id: string;
  isActive: boolean;
  name: string;
  sortOrder: number;
}

export interface ProcurementItemEditorCategoryOption extends ProcurementItemWorkspaceCategoryRecord {
  isPreservedInactiveSelection: boolean;
}

export interface ProcurementItemWorkspaceRecord {
  archivedAt: number | null;
  categoryId: string;
  categoryName: string;
  complianceFlags: ProcurementItemComplianceFlag[];
  description: string | null;
  id: string;
  isActive: boolean;
  lastPriceChangedAt: number | null;
  maxQuantity: number | null;
  minQuantity: number | null;
  name: string;
  procurementMethod: string | null;
  revision: number;
  sortOrder: number;
  sourceOfFunds: string | null;
  unitOfMeasurement: string | null;
  unitPrice: number | null;
}

export interface ProcurementItemWorkspaceRow extends ProcurementItemWorkspaceRecord {
  archivedLabel: string | null;
  categoryLimit: ProcurementItemTierLimitState;
  complianceSummary: string;
}

export interface ProcurementCatalogWorkspaceFilters {
  categoryIds: string[];
  complianceFlags: ProcurementItemComplianceFlag[];
  maxPrice: number | null;
  minPrice: number | null;
  searchText: string;
}

export interface ProcurementCatalogPaginationResult<Row> {
  currentPage: number;
  page: Row[];
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ProcurementItemPriceHistoryEntry {
  changedAt: number;
  itemId: string;
  nextUnitPrice: number;
  previousUnitPrice: number | null;
}

export interface StoredItemDraft {
  categoryId: string | null;
  categoryName: string | null;
  complianceFlags: ProcurementItemComplianceFlag[];
  customUnit: string | null;
  id: string;
  maxQuantity: number | null;
  minQuantity: number | null;
  name: string;
  procurementMethod: ProcurementItemProcurementMethod | null;
  revision: number;
  sourceOfFunds: string | null;
  unit: string | null;
  unitPrice: number | null;
}

export interface ProcurementCatalogExportRow {
  Category: string;
  "Compliance Flags": string;
  Description: string;
  "Item Name": string;
  Price: number;
  "Qty Limits": string;
  Unit: string;
}

const PROCUREMENT_ITEM_TIER_LABELS: Record<ProcurementItemTier, string> = {
  enterprise: "Enterprise",
  free: "Free",
  professional: "Professional",
  starter: "Starter",
};

const PROCUREMENT_ITEM_TIER_LIMITS: Record<
  Exclude<ProcurementItemTier, "enterprise">,
  number
> = {
  free: 50,
  professional: 500,
  starter: 150,
};

const PROCUREMENT_ITEM_IMPORT_LIMITS: Record<
  Exclude<ProcurementItemTier, "enterprise">,
  number
> = {
  free: 0,
  professional: 1_000,
  starter: 100,
};

const PROCUREMENT_ITEM_TIER_LIMIT_PATTERN =
  /\b(item limit reached for this category on the current plan tier|no remaining active-item slots are available for this category)\b/i;
const PROCUREMENT_ITEM_CRUD_AUTH_RECOVERY_PATTERNS = [
  /\bprocurement officer access is required for this resource\b/i,
  /\btenant record not found\b/i,
];

const PROCUREMENT_ITEM_UNIT_ALIAS_MAP: Record<string, string> = {
  box: "box",
  boxes: "box",
  each: "each",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  liter: "liter",
  litre: "liter",
  litres: "liter",
  liters: "liter",
  pair: "pair",
  pairs: "pair",
  pcs: "each",
  piece: "each",
  pieces: "each",
  ream: "ream",
  reams: "ream",
  set: "set",
  sets: "set",
};

export function normalizeProcurementItemName(input: string): string {
  return normalizePlainText(input).toLowerCase();
}

export function normalizeProcurementCatalogSearchText(input: string): string {
  return normalizePlainText(
    input.normalize("NFKD").replace(/[\u0300-\u036F]/g, ""),
  ).toLowerCase();
}

export function normalizeProcurementItemDisplayName(input: string): string {
  return normalizePlainText(input);
}

export function normalizeProcurementItemUnit(
  input: string | null | undefined,
): string | undefined {
  const normalized = normalizePlainText(input ?? "");
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeProcurementItemUnitOption(
  input: string | null | undefined,
): ProcurementItemUnit | undefined {
  const normalized = normalizePlainText(input ?? "").toLowerCase();
  return (
    PROCUREMENT_ITEM_UNITS.find((unit) => unit === normalized) ?? undefined
  );
}

export function procurementItemUnitAllowsDecimal(
  input: string | null | undefined,
): boolean {
  const normalizedUnit = normalizeProcurementItemUnitOption(input);
  return normalizedUnit === "kg" || normalizedUnit === "liter";
}

function formatProcurementItemQuantityNumber(limit: number): string {
  return Number.isInteger(limit) ? String(limit) : String(limit);
}

export function formatProcurementItemMaximumQuantityMessage(
  limit: number,
): string {
  return `Maximum quantity is ${formatProcurementItemQuantityNumber(limit)}`;
}

export function formatProcurementItemMinimumQuantityMessage(
  limit: number,
): string {
  return `Minimum catalog quantity is ${formatProcurementItemQuantityNumber(limit)}`;
}

export function normalizeProcurementMethod(
  input: string | null | undefined,
): ProcurementItemProcurementMethod | undefined {
  const normalized = normalizePlainText(input ?? "");
  return (
    PROCUREMENT_ITEM_PROCUREMENT_METHODS.find(
      (method) => method === normalized,
    ) ?? undefined
  );
}

export function normalizeComplianceFlags(
  input: readonly string[] | string | null | undefined,
): ProcurementItemComplianceFlag[] {
  const rawValues = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[;,]/)
      : [];

  return Array.from(
    new Set(
      rawValues
        .map((value) => normalizePlainText(value).toLowerCase())
        .filter((value): value is ProcurementItemComplianceFlag =>
          PROCUREMENT_ITEM_COMPLIANCE_FLAGS.includes(
            value as ProcurementItemComplianceFlag,
          ),
        ),
    ),
  );
}

export function normalizeQuantityLimit(
  input: number | string | null | undefined,
): number | undefined {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }

  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

export function normalizeUnitPrice(
  input: number | string | null | undefined,
): number | undefined {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }

  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

export function getProcurementItemUpgradeHref(): string {
  return "/pricing";
}

export function getProcurementItemCrudRecoveryHref(): string {
  return buildDashboardPath(FORBIDDEN_ACCESS_REASON);
}

export function buildProcurementItemTierLimitState(args: {
  activeItemCount: number;
  tier: ProcurementItemTier;
}): ProcurementItemTierLimitState {
  const limit =
    args.tier === "enterprise" ? null : PROCUREMENT_ITEM_TIER_LIMITS[args.tier];

  return {
    atLimit: limit !== null && args.activeItemCount >= limit,
    limit,
    remainingSlots:
      limit === null ? null : Math.max(limit - args.activeItemCount, 0),
    tier: args.tier,
    tierLabel: PROCUREMENT_ITEM_TIER_LABELS[args.tier],
    upgradeHref: getProcurementItemUpgradeHref(),
  };
}

export function buildProcurementItemImportLimitState(args: {
  tier: ProcurementItemTier;
}): ProcurementItemImportLimitState {
  return {
    rowLimit:
      args.tier === "enterprise"
        ? null
        : PROCUREMENT_ITEM_IMPORT_LIMITS[args.tier],
    tier: args.tier,
    tierLabel: PROCUREMENT_ITEM_TIER_LABELS[args.tier],
  };
}

export function buildProcurementItemTierLimitModalContent(
  args: Pick<ProcurementItemTierLimitState, "limit" | "tier" | "tierLabel">,
): ProcurementItemTierLimitModalContent {
  if (args.tier === "free") {
    return {
      body: "Archive an inactive item or upgrade to keep growing this category.",
      guidance: "Upgrade to Starter (150 items) or Professional (500 items).",
      title: `Free tier limit: ${args.limit ?? 50} active items per category`,
    };
  }

  if (args.tier === "starter") {
    return {
      body: "Archive an inactive item or upgrade to keep growing this category.",
      guidance:
        "Upgrade to Professional (500 items) or Enterprise (unlimited).",
      title: `Starter tier limit: ${args.limit ?? 150} active items per category`,
    };
  }

  if (args.tier === "professional") {
    return {
      body: "Archive an inactive item or upgrade to keep growing this category.",
      guidance: "Upgrade to Enterprise for unlimited category items.",
      title: `Professional tier limit: ${args.limit ?? 500} active items per category`,
    };
  }

  return {
    body: "Your current plan already supports unlimited active items per category.",
    guidance: "No numeric per-category cap applies on Enterprise.",
    title: `${args.tierLabel} tier supports unlimited active items`,
  };
}

export function summarizeComplianceFlags(
  flags: readonly ProcurementItemComplianceFlag[],
): string {
  if (flags.length === 0) {
    return "No compliance flags";
  }

  return flags
    .map((flag) => {
      if (flag === "agpo") {
        return "AGPO";
      }
      if (flag === "pwd") {
        return "PWD";
      }
      return "Local Content";
    })
    .join(", ");
}

export function formatProcurementItemQuantityLimits(args: {
  maxQuantity: number | null;
  minQuantity: number | null;
}): string {
  if (args.minQuantity === null && args.maxQuantity === null) {
    return "No limits";
  }

  if (args.minQuantity !== null && args.maxQuantity !== null) {
    return `${args.minQuantity} - ${args.maxQuantity}`;
  }

  if (args.minQuantity !== null) {
    return `Min ${args.minQuantity}`;
  }

  return `Max ${args.maxQuantity ?? 0}`;
}

export function buildProcurementItemCatalogSearchText(args: {
  categoryName: string;
  description?: string | null;
  name: string;
}): string {
  return normalizeProcurementCatalogSearchText(
    [args.name, args.description ?? args.name, args.categoryName].join(" "),
  );
}

function buildProcurementCatalogSearchTerms(searchText: string): string[] {
  const normalizedSearchText = normalizeProcurementCatalogSearchText(searchText);
  return normalizedSearchText.length === 0
    ? []
    : normalizedSearchText.split(" ").filter((term) => term.length > 0);
}

function matchesProcurementCatalogSearchTerms(args: {
  row: Pick<ProcurementItemWorkspaceRow, "categoryName" | "description" | "name">;
  searchTerms: readonly string[];
}): boolean {
  if (args.searchTerms.length === 0) {
    return true;
  }

  const catalogSearchText = buildProcurementItemCatalogSearchText({
    categoryName: args.row.categoryName,
    description: args.row.description,
    name: args.row.name,
  });

  return args.searchTerms.every((term) => catalogSearchText.includes(term));
}

export function createProcurementCatalogRowMatcher(
  filters: ProcurementCatalogWorkspaceFilters,
): (row: ProcurementItemWorkspaceRow) => boolean {
  const categoryIdSet =
    filters.categoryIds.length > 0 ? new Set(filters.categoryIds) : null;
  const requiredFlags =
    filters.complianceFlags.length > 0
      ? new Set(filters.complianceFlags)
      : null;
  const searchTerms = buildProcurementCatalogSearchTerms(filters.searchText);

  return (row) => {
    if (categoryIdSet && !categoryIdSet.has(row.categoryId)) {
      return false;
    }

    if (
      filters.minPrice !== null &&
      (row.unitPrice ?? Number.NEGATIVE_INFINITY) < filters.minPrice
    ) {
      return false;
    }

    if (
      filters.maxPrice !== null &&
      (row.unitPrice ?? Number.POSITIVE_INFINITY) > filters.maxPrice
    ) {
      return false;
    }

    if (
      requiredFlags &&
      !Array.from(requiredFlags).every((flag) =>
        row.complianceFlags.includes(flag),
      )
    ) {
      return false;
    }

    return matchesProcurementCatalogSearchTerms({
      row,
      searchTerms,
    });
  };
}

export function createProcurementItemWorkspaceRow(args: {
  category?: ProcurementItemWorkspaceCategoryRecord;
  item: ProcurementItemWorkspaceRecord;
  tier: ProcurementItemTier;
}): ProcurementItemWorkspaceRow {
  return {
    ...args.item,
    archivedLabel:
      args.item.isActive || args.item.archivedAt === null ? null : "Archived",
    categoryLimit: buildProcurementItemTierLimitState({
      activeItemCount: args.category?.activeItemCount ?? 0,
      tier: args.tier,
    }),
    complianceSummary: summarizeComplianceFlags(args.item.complianceFlags),
  };
}

export function buildProcurementItemWorkspaceRows(args: {
  categories: readonly ProcurementItemWorkspaceCategoryRecord[];
  items: readonly ProcurementItemWorkspaceRecord[];
  tier: ProcurementItemTier;
}): ProcurementItemWorkspaceRow[] {
  const categoriesById = new Map(
    args.categories.map((category) => [category.id, category] as const),
  );

  return [...args.items]
    .sort((left, right) => {
      const leftCategory = categoriesById.get(left.categoryId);
      const rightCategory = categoriesById.get(right.categoryId);
      const leftSort = leftCategory?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const rightSort = rightCategory?.sortOrder ?? Number.MAX_SAFE_INTEGER;

      return (
        Number(right.isActive) - Number(left.isActive) ||
        leftSort - rightSort ||
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name)
      );
    })
    .map((item) => {
      const category = categoriesById.get(item.categoryId);
      return createProcurementItemWorkspaceRow({
        category,
        item,
        tier: args.tier,
      });
    });
}

export function resolveProcurementItemDraftCategoryId(args: {
  categories: readonly ProcurementItemWorkspaceCategoryRecord[];
  draftCategoryId?: string | null;
}): string {
  const normalizedDraftCategoryId = args.draftCategoryId?.trim() ?? "";
  if (
    normalizedDraftCategoryId.length > 0 &&
    args.categories.some(
      (category) => category.id === normalizedDraftCategoryId,
    )
  ) {
    return normalizedDraftCategoryId;
  }

  return args.categories.find((category) => category.isActive)?.id ?? "";
}

export function buildProcurementItemEditorCategoryOptions(args: {
  categories: readonly ProcurementItemWorkspaceCategoryRecord[];
  selectedCategoryId?: string | null;
}): ProcurementItemEditorCategoryOption[] {
  const normalizedSelectedCategoryId = args.selectedCategoryId?.trim() ?? "";
  const options = args.categories
    .filter((category) => category.isActive)
    .map((category) => ({
      ...category,
      isPreservedInactiveSelection: false,
    }));

  if (normalizedSelectedCategoryId.length === 0) {
    return options;
  }

  const selectedCategory = args.categories.find(
    (category) => category.id === normalizedSelectedCategoryId,
  );
  if (!selectedCategory || selectedCategory.isActive) {
    return options;
  }

  return [
    ...options,
    {
      ...selectedCategory,
      isPreservedInactiveSelection: true,
    },
  ];
}

export function createProcurementItemPriceHistoryEntry(args: {
  changedAt: number;
  itemId: string;
  nextUnitPrice: number;
  previousUnitPrice: number | null;
}): ProcurementItemPriceHistoryEntry {
  return {
    changedAt: args.changedAt,
    itemId: args.itemId,
    nextUnitPrice: args.nextUnitPrice,
    previousUnitPrice: args.previousUnitPrice,
  };
}

export function filterProcurementCatalogRows(args: {
  filters: ProcurementCatalogWorkspaceFilters;
  rows: readonly ProcurementItemWorkspaceRow[];
}): ProcurementItemWorkspaceRow[] {
  if (
    args.filters.searchText.length === 0 &&
    args.filters.categoryIds.length === 0 &&
    args.filters.complianceFlags.length === 0 &&
    args.filters.minPrice === null &&
    args.filters.maxPrice === null
  ) {
    return [...args.rows];
  }

  const matchesRow = createProcurementCatalogRowMatcher(args.filters);
  return args.rows.filter((row) => matchesRow(row));
}

export function paginateProcurementCatalogRows<Row>(args: {
  page: number;
  pageSize: number;
  rows: readonly Row[];
}): ProcurementCatalogPaginationResult<Row> {
  const safePageSize =
    Number.isInteger(args.pageSize) && args.pageSize > 0 ? args.pageSize : 50;
  const totalCount = args.rows.length;
  const totalPages =
    totalCount === 0 ? 0 : Math.ceil(totalCount / safePageSize);
  const currentPage =
    totalPages === 0
      ? 1
      : Math.min(Math.max(Math.trunc(args.page), 1), totalPages);
  const startIndex = totalPages === 0 ? 0 : (currentPage - 1) * safePageSize;

  return {
    currentPage,
    page: args.rows.slice(startIndex, startIndex + safePageSize),
    pageSize: safePageSize,
    totalCount,
    totalPages,
  };
}

export function buildProcurementCatalogExportRows(
  rows: readonly ProcurementItemWorkspaceRow[],
): ProcurementCatalogExportRow[] {
  return rows.map((row) => ({
    Category: row.categoryName,
    "Compliance Flags": row.complianceSummary,
    Description: row.description ?? row.name,
    "Item Name": row.name,
    Price: row.unitPrice ?? 0,
    "Qty Limits": formatProcurementItemQuantityLimits({
      maxQuantity: row.maxQuantity,
      minQuantity: row.minQuantity,
    }),
    Unit: row.unitOfMeasurement ?? "",
  }));
}

export function hasMeaningfulItemDraftValues(
  args: Partial<StoredItemDraft>,
): boolean {
  return (
    normalizePlainText(args.name ?? "").length > 0 ||
    normalizePlainText(args.categoryName ?? "").length > 0 ||
    normalizePlainText(args.unit ?? "").length > 0 ||
    normalizePlainText(args.customUnit ?? "").length > 0 ||
    normalizePlainText(args.sourceOfFunds ?? "").length > 0 ||
    typeof args.unitPrice === "number" ||
    typeof args.minQuantity === "number" ||
    typeof args.maxQuantity === "number" ||
    (args.complianceFlags?.length ?? 0) > 0
  );
}

export function parseStoredItemDraft(
  raw: string | null | undefined,
): StoredItemDraft | null {
  if (!raw) {
    return null;
  }

  try {
    const record = JSON.parse(raw) as Record<string, unknown>;
    const maxQuantityInput =
      typeof record.maxQuantity === "number" ||
      typeof record.maxQuantity === "string"
        ? record.maxQuantity
        : null;
    const minQuantityInput =
      typeof record.minQuantity === "number" ||
      typeof record.minQuantity === "string"
        ? record.minQuantity
        : null;
    const unitPriceInput =
      typeof record.unitPrice === "number" ||
      typeof record.unitPrice === "string"
        ? record.unitPrice
        : null;

    return {
      categoryId:
        typeof record.categoryId === "string" &&
        normalizePlainText(record.categoryId).length > 0
          ? record.categoryId
          : null,
      categoryName:
        typeof record.categoryName === "string" &&
        normalizePlainText(record.categoryName).length > 0
          ? record.categoryName
          : null,
      complianceFlags: normalizeComplianceFlags(
        Array.isArray(record.complianceFlags)
          ? (record.complianceFlags as string[])
          : [],
      ),
      customUnit:
        typeof record.customUnit === "string" &&
        normalizePlainText(record.customUnit).length > 0
          ? normalizePlainText(record.customUnit)
          : null,
      id: typeof record.id === "string" ? record.id : "",
      maxQuantity: normalizeQuantityLimit(maxQuantityInput) ?? null,
      minQuantity: normalizeQuantityLimit(minQuantityInput) ?? null,
      name:
        typeof record.name === "string" ? normalizePlainText(record.name) : "",
      procurementMethod:
        normalizeProcurementMethod(
          typeof record.procurementMethod === "string"
            ? record.procurementMethod
            : null,
        ) ?? null,
      revision:
        typeof record.revision === "number" && Number.isFinite(record.revision)
          ? record.revision
          : 0,
      sourceOfFunds:
        typeof record.sourceOfFunds === "string" &&
        normalizePlainText(record.sourceOfFunds).length > 0
          ? normalizePlainText(record.sourceOfFunds)
          : null,
      unit:
        typeof record.unit === "string" &&
        normalizePlainText(record.unit).length > 0
          ? normalizePlainText(record.unit)
          : null,
      unitPrice: normalizeUnitPrice(unitPriceInput) ?? null,
    };
  } catch {
    return null;
  }
}

export function hasStoredItemDraft(raw: string | null | undefined): boolean {
  const draft = parseStoredItemDraft(raw);
  return draft ? hasMeaningfulItemDraftValues(draft) : false;
}

export function categoryAcceptsProcurementItems(args: {
  isActive: boolean;
}): boolean {
  return args.isActive;
}

export function getComparableProcurementItemRevision(
  revision: number | null | undefined,
): number {
  if (typeof revision !== "number" || !Number.isFinite(revision)) {
    return 0;
  }

  return revision;
}

export function hasProcurementItemDuplicateConflict(args: {
  excludeItemId?: string | null;
  items: ReadonlyArray<{
    _id?: string | null;
    isActive: boolean;
    name: string;
    normalizedName?: string | null;
  }>;
  normalizedName: string;
}): boolean {
  return args.items.some((item) => {
    if (!item.isActive) {
      return false;
    }
    if (args.excludeItemId && item._id === args.excludeItemId) {
      return false;
    }

    return (
      (item.normalizedName ?? normalizeProcurementItemName(item.name)) ===
      args.normalizedName
    );
  });
}

export function getNextProcurementItemSortOrder(
  items: ReadonlyArray<{
    sortOrder?: number | null;
  }>,
): number {
  return Math.max(0, ...items.map((item) => item.sortOrder ?? 0)) + 1;
}

export function createProcurementItemDuplicateKey(args: {
  categoryId: string;
  normalizedName: string;
}): string {
  return `${args.categoryId}::${args.normalizedName}`;
}

export function normalizeImportedProcurementItemUnit(value: string): {
  valid: boolean;
  value: string;
} {
  const normalized = normalizeProcurementItemDisplayName(value).toLowerCase();
  const mappedValue = PROCUREMENT_ITEM_UNIT_ALIAS_MAP[normalized];
  if (mappedValue) {
    return { valid: true, value: mappedValue };
  }

  return { valid: false, value: value.trim() };
}

export function buildProcurementItemTemplateRows(): Array<
  Record<(typeof PROCUREMENT_ITEM_IMPORT_COLUMNS)[number], string>
> {
  return [
    {
      Category: "",
      "Compliance Flags": "",
      "Item/Service Description": "",
      "Max Quantity": "",
      "Min Quantity": "",
      "Proc Method": "",
      "Source Of Funds": "",
      "Unit Of Measurement": "",
      "Unit Price": "",
    },
  ];
}

export function getProcurementItemImportRowFailure(args: {
  activeItemCount: number;
  categoryName: string;
  hasActiveCategory: boolean;
  limit: number | null;
  maxQuantity: number | null;
  minQuantity: number | null;
  normalizedName: string;
  price: number | null;
  rowIndexWithinTierCap: number;
  rowLimit: number | null;
  seenInFile: ReadonlySet<string>;
  unit: string;
}): string | null {
  if (args.categoryName.length === 0) {
    return PROCUREMENT_ITEM_IMPORT_BLANK_CATEGORY_MESSAGE;
  }

  if (!args.hasActiveCategory) {
    return PROCUREMENT_ITEM_IMPORT_UNKNOWN_CATEGORY_MESSAGE;
  }

  if (args.normalizedName.length === 0) {
    return PROCUREMENT_ITEM_NAME_REQUIRED_MESSAGE;
  }

  if (args.seenInFile.has(args.normalizedName)) {
    return PROCUREMENT_ITEM_IMPORT_DUPLICATE_IN_FILE_MESSAGE;
  }

  if (!normalizeProcurementItemUnit(args.unit)) {
    return PROCUREMENT_ITEM_UNIT_REQUIRED_MESSAGE;
  }

  if (!Number.isFinite(args.price ?? NaN) || (args.price ?? 0) <= 0) {
    return PROCUREMENT_ITEM_PRICE_POSITIVE_MESSAGE;
  }

  if (args.minQuantity !== null && args.minQuantity < 0) {
    return PROCUREMENT_ITEM_MIN_QUANTITY_INVALID_MESSAGE;
  }

  if (args.maxQuantity !== null && args.maxQuantity < 0) {
    return PROCUREMENT_ITEM_MAX_QUANTITY_INVALID_MESSAGE;
  }

  if (
    args.minQuantity !== null &&
    args.maxQuantity !== null &&
    args.maxQuantity < args.minQuantity
  ) {
    return PROCUREMENT_ITEM_QUANTITY_RANGE_INVALID_MESSAGE;
  }

  if (args.rowLimit !== null && args.rowIndexWithinTierCap >= args.rowLimit) {
    return PROCUREMENT_ITEM_IMPORT_ROW_LIMIT_MESSAGE;
  }

  if (args.limit !== null && args.activeItemCount >= args.limit) {
    return PROCUREMENT_ITEM_IMPORT_OVERFLOW_MESSAGE;
  }

  return null;
}

export function getProcurementItemCrudErrorMessage(error: unknown): string {
  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : null;

  if (!message) {
    return PROCUREMENT_ITEM_SAVE_GENERIC_ERROR_MESSAGE;
  }

  if (
    [
      PROCUREMENT_ITEM_CATEGORY_INACTIVE_MESSAGE,
      PROCUREMENT_ITEM_CATEGORY_REQUIRED_MESSAGE,
      PROCUREMENT_ITEM_DUPLICATE_MESSAGE,
      PROCUREMENT_ITEM_IMPORT_FREE_TIER_MESSAGE,
      PROCUREMENT_ITEM_COMPLIANCE_INVALID_MESSAGE,
      PROCUREMENT_ITEM_IMPORT_OVERFLOW_MESSAGE,
      PROCUREMENT_ITEM_IMPORT_ROW_LIMIT_MESSAGE,
      PROCUREMENT_ITEM_MAX_QUANTITY_INVALID_MESSAGE,
      PROCUREMENT_ITEM_MIN_QUANTITY_INVALID_MESSAGE,
      PROCUREMENT_ITEM_NAME_REQUIRED_MESSAGE,
      PROCUREMENT_ITEM_NOT_FOUND_MESSAGE,
      PROCUREMENT_ITEM_PRICE_POSITIVE_MESSAGE,
      PROCUREMENT_ITEM_QUANTITY_RANGE_INVALID_MESSAGE,
      PROCUREMENT_ITEM_REFRESH_REQUIRED_MESSAGE,
      PROCUREMENT_ITEM_UNIT_CUSTOM_REQUIRED_MESSAGE,
      PROCUREMENT_ITEM_UNIT_INVALID_MESSAGE,
      PROCUREMENT_ITEM_UNIT_REQUIRED_MESSAGE,
    ].includes(message)
  ) {
    return message;
  }

  if (isProcurementItemTierLimitMessage(message)) {
    return message;
  }

  return PROCUREMENT_ITEM_SAVE_GENERIC_ERROR_MESSAGE;
}

export function isProcurementItemTierLimitMessage(
  message: string | null,
): boolean {
  return message ? PROCUREMENT_ITEM_TIER_LIMIT_PATTERN.test(message) : false;
}

export function isProcurementItemCrudAuthorizationError(
  error: unknown,
): boolean {
  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : null;

  if (!message) {
    return false;
  }

  return PROCUREMENT_ITEM_CRUD_AUTH_RECOVERY_PATTERNS.some((pattern) =>
    pattern.test(message),
  );
}
