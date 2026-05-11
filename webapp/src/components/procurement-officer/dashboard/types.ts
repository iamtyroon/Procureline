import type { CategoryIconName } from "@/lib/procurement-officer/categories";
import type {
  ProcurementItemTierLimitState,
  ProcurementItemWorkspaceRow,
} from "@/lib/procurement-officer/items";

export interface DashboardDepartmentWorkspaceRow {
  activeDepartmentUserEmails: string[];
  budgetAllocation: number | null;
  canDelete: boolean;
  code: string;
  deleteBlockerMessages: string[];
  hasSentAccessCode: boolean;
  id: string;
  isArchived: boolean;
  name: string;
  permanentDeleteRecordCounts: {
    accessCodeCount: number;
    departmentUserProfileCount: number;
    planCount: number;
  } | null;
  planningImpactWarning: string | null;
  submissionEndsAt: number | null;
  submissionStartsAt: number | null;
  voteNumber: string;
}

export interface DashboardDepartmentWorkspaceData {
  meta: {
    budgetCeiling: number | null;
    timeZone: string;
  };
  rows: DashboardDepartmentWorkspaceRow[];
}

export interface DashboardCategoryWorkspaceData {
  meta: {
    activeCategoryCount: number;
  };
  rows: Array<{
    canDelete: boolean;
    color: string | null;
    deleteBlockerMessages: string[];
    description: string | null;
    id: string;
    icon: CategoryIconName | null;
    isActive: boolean;
    itemCount: number;
    name: string;
    planningImpactWarning: string | null;
    revision: number;
  }>;
}

export interface DashboardItemCategoryOption {
  id: string;
  isActive: boolean;
  limit: ProcurementItemTierLimitState;
  name: string;
}

export interface DashboardItemsWorkspaceData {
  categories: DashboardItemCategoryOption[];
  meta: {
    tier: "enterprise" | "free" | "professional" | "starter";
  };
}

export interface DashboardCategoryItemsBrowseData {
  rows: ProcurementItemWorkspaceRow[];
}
