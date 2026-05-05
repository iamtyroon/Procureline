import type { ProcurementCatalogBrowseState } from "@/lib/procurement-officer/catalog-filters";
import type {
  ProcurementItemTierLimitState,
  ProcurementItemWorkspaceCategoryRecord,
  ProcurementItemWorkspaceRow,
} from "@/lib/procurement-officer/items";

export interface ItemCategoryRow
  extends ProcurementItemWorkspaceCategoryRecord {
  limit: ProcurementItemTierLimitState;
}

export type ItemRow = ProcurementItemWorkspaceRow;

export interface ItemsWorkspaceData {
  categories: ItemCategoryRow[];
  meta: {
    activeItemCount: number;
    defaultPageSize: number;
    importLimit: {
      rowLimit: number | null;
      tier: "enterprise" | "free" | "professional" | "starter";
      tierLabel: string;
    };
    tier: "enterprise" | "free" | "professional" | "starter";
    totalItemCount: number;
  };
}

export interface ItemsCatalogBrowseData {
  meta: {
    currentPage: number;
    endRow: number;
    filteredCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    normalizedFilters: ProcurementCatalogBrowseState;
    pageSize: number;
    requestedPage: number;
    startRow: number;
    tier: "enterprise" | "free" | "professional" | "starter";
    totalPages: number;
  };
  rows: ItemRow[];
}

export interface ItemImportSummary {
  createdCount: number;
  failureCount: number;
  failures: Array<{
    message: string;
    rowNumber: number;
  }>;
  totalRows: number;
}

export type ItemEditorSource = "create" | "edit" | "restored-draft" | null;
