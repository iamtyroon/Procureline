import {
  normalizeComplianceFlags,
  type ProcurementItemComplianceFlag,
} from "./items";
import { normalizePlainText } from "../security/input";

export const PROCUREMENT_CATALOG_PAGE_SIZE = 50;
export const PROCUREMENT_CATALOG_SEARCH_DEBOUNCE_MS = 300;
export const PROCUREMENT_CATALOG_PROFESSIONAL_EXPORT_LIMIT = 10_000;

export const PROCUREMENT_CATALOG_QUERY_PARAM_KEYS = {
  categoryId: "itemCategory",
  complianceFlag: "itemCompliance",
  maxPrice: "itemMaxPrice",
  minPrice: "itemMinPrice",
  page: "itemPage",
  searchText: "itemSearch",
} as const;

export interface ProcurementCatalogBrowseState {
  categoryIds: string[];
  complianceFlags: ProcurementItemComplianceFlag[];
  maxPrice: number | null;
  minPrice: number | null;
  page: number;
  searchText: string;
}

export interface ProcurementCatalogExportGuardState {
  description: string;
  kind: "allowed" | "empty" | "row_limit" | "tier_gate";
  title: string;
}

interface ProcurementCatalogBrowseStateInput {
  categoryIds?: readonly string[] | string[];
  complianceFlags?: readonly string[] | string[];
  maxPrice?: unknown;
  minPrice?: unknown;
  page?: unknown;
  searchText?: string | null;
}

interface SearchParamsReader {
  get(name: string): string | null;
  getAll(name: string): string[];
}

const PROCUREMENT_CATALOG_QUERY_PARAM_NAMES = new Set<string>(
  Object.values(PROCUREMENT_CATALOG_QUERY_PARAM_KEYS),
);

export function createDefaultProcurementCatalogBrowseState(): ProcurementCatalogBrowseState {
  return {
    categoryIds: [],
    complianceFlags: [],
    maxPrice: null,
    minPrice: null,
    page: 1,
    searchText: "",
  };
}

export function normalizeProcurementCatalogSearchText(
  value: string | null | undefined,
): string {
  return normalizePlainText(value ?? "");
}

export function normalizeProcurementCatalogBrowseState(args: {
  availableCategoryIds?: readonly string[];
  state: ProcurementCatalogBrowseStateInput;
}): ProcurementCatalogBrowseState {
  const availableCategoryIds = args.availableCategoryIds
    ? new Set(args.availableCategoryIds)
    : null;
  const categoryIds = dedupeStringValues(args.state.categoryIds).filter(
    (value) => (availableCategoryIds ? availableCategoryIds.has(value) : true),
  );
  const complianceFlags = normalizeComplianceFlags(
    args.state.complianceFlags ?? [],
  );
  const minPrice = normalizeNonNegativeNumber(args.state.minPrice);
  const maxPrice = normalizeNonNegativeNumber(args.state.maxPrice);

  return {
    categoryIds,
    complianceFlags,
    maxPrice:
      minPrice !== null && maxPrice !== null && minPrice > maxPrice
        ? null
        : maxPrice,
    minPrice:
      minPrice !== null && maxPrice !== null && minPrice > maxPrice
        ? null
        : minPrice,
    page: normalizePageValue(args.state.page),
    searchText: normalizeProcurementCatalogSearchText(args.state.searchText),
  };
}

export function readProcurementCatalogBrowseState(
  searchParams: SearchParamsReader,
  args?: {
    availableCategoryIds?: readonly string[];
  },
): ProcurementCatalogBrowseState {
  return normalizeProcurementCatalogBrowseState({
    availableCategoryIds: args?.availableCategoryIds,
    state: {
      categoryIds: searchParams.getAll(
        PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.categoryId,
      ),
      complianceFlags: searchParams.getAll(
        PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.complianceFlag,
      ),
      maxPrice: searchParams.get(PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.maxPrice),
      minPrice: searchParams.get(PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.minPrice),
      page: searchParams.get(PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.page),
      searchText: searchParams.get(
        PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.searchText,
      ),
    },
  });
}

export function stripProcurementCatalogBrowseParams(
  searchParams: URLSearchParams,
): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams.toString());

  PROCUREMENT_CATALOG_QUERY_PARAM_NAMES.forEach((key) => {
    nextSearchParams.delete(key);
  });

  return nextSearchParams;
}

export function applyProcurementCatalogBrowseStateToSearchParams(args: {
  searchParams: URLSearchParams;
  state: ProcurementCatalogBrowseState;
}): URLSearchParams {
  const normalizedState = normalizeProcurementCatalogBrowseState({
    state: args.state,
  });
  const nextSearchParams = stripProcurementCatalogBrowseParams(
    args.searchParams,
  );

  if (normalizedState.searchText.length > 0) {
    nextSearchParams.set(
      PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.searchText,
      normalizedState.searchText,
    );
  }

  if (normalizedState.page > 1) {
    nextSearchParams.set(
      PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.page,
      String(normalizedState.page),
    );
  }

  if (normalizedState.minPrice !== null) {
    nextSearchParams.set(
      PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.minPrice,
      String(normalizedState.minPrice),
    );
  }

  if (normalizedState.maxPrice !== null) {
    nextSearchParams.set(
      PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.maxPrice,
      String(normalizedState.maxPrice),
    );
  }

  for (const categoryId of normalizedState.categoryIds) {
    nextSearchParams.append(
      PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.categoryId,
      categoryId,
    );
  }

  for (const complianceFlag of normalizedState.complianceFlags) {
    nextSearchParams.append(
      PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.complianceFlag,
      complianceFlag,
    );
  }

  return nextSearchParams;
}

export function extractProcurementCatalogBrowseSearchParams(
  searchParams: SearchParamsReader,
  args?: {
    availableCategoryIds?: readonly string[];
  },
): URLSearchParams {
  return applyProcurementCatalogBrowseStateToSearchParams({
    searchParams: new URLSearchParams(),
    state: readProcurementCatalogBrowseState(searchParams, args),
  });
}

export function areProcurementCatalogBrowseStatesEqual(
  left: ProcurementCatalogBrowseState,
  right: ProcurementCatalogBrowseState,
): boolean {
  return (
    left.searchText === right.searchText &&
    left.page === right.page &&
    left.minPrice === right.minPrice &&
    left.maxPrice === right.maxPrice &&
    joinComparableValues(left.categoryIds) ===
      joinComparableValues(right.categoryIds) &&
    joinComparableValues(left.complianceFlags) ===
      joinComparableValues(right.complianceFlags)
  );
}

export function hasActiveProcurementCatalogFilters(
  state: ProcurementCatalogBrowseState,
): boolean {
  return (
    state.searchText.length > 0 ||
    state.categoryIds.length > 0 ||
    state.complianceFlags.length > 0 ||
    state.minPrice !== null ||
    state.maxPrice !== null
  );
}

export function isProcurementCatalogQueryParam(name: string): boolean {
  return PROCUREMENT_CATALOG_QUERY_PARAM_NAMES.has(name);
}

export function getProcurementCatalogExportGuardState(args: {
  filteredCount: number;
  tier: "enterprise" | "free" | "professional" | "starter";
}): ProcurementCatalogExportGuardState {
  if (args.filteredCount <= 0) {
    return {
      description:
        "No rows match the current filters. Clear or refine filters before exporting.",
      kind: "empty",
      title: "No rows to export",
    };
  }

  if (args.tier === "free" || args.tier === "starter") {
    return {
      description:
        "Catalog export is available on the Professional and Enterprise plans. Upgrade to generate the filtered workbook.",
      kind: "tier_gate",
      title: `${capitalize(args.tier)} plan required for catalog export`,
    };
  }

  if (
    args.tier === "professional" &&
    args.filteredCount > PROCUREMENT_CATALOG_PROFESSIONAL_EXPORT_LIMIT
  ) {
    return {
      description: `This filtered result contains ${args.filteredCount.toLocaleString("en-US")} rows. Refine the filters or upgrade to Enterprise before exporting.`,
      kind: "row_limit",
      title: "Professional export limit exceeded",
    };
  }

  return {
    description: "The current filtered catalog can be exported safely.",
    kind: "allowed",
    title: "Export available",
  };
}

function dedupeStringValues(
  values: readonly string[] | string[] | undefined,
): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values ?? []) {
    const normalizedValue = normalizePlainText(value);
    if (normalizedValue.length === 0 || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    deduped.push(normalizedValue);
  }

  return deduped;
}

function normalizeNonNegativeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

function normalizePageValue(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 1) {
      return parsed;
    }
  }

  return 1;
}

function joinComparableValues(values: readonly string[]): string {
  return values.join("::");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
