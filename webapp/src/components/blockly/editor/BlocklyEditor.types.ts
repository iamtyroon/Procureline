import type { CategoryIconName } from "@/lib/procurement-officer/categories";
import type { DepartmentUserPersistedPlanSummary } from "@/lib/shared/blockly/du-workspace-calculations";
import type { BlocklyWorkspaceRecord } from "@/lib/shared/blockly/blockly-serialization";

export type BlocklyEditorProps = {
    accessMode: "editable" | "read_only_grace" | null;
    actor: "department_user" | "procurement_officer";
    actorLabel: string;
    categories: Array<{
        color?: string | null;
        id: string;
        icon?: CategoryIconName | null;
        isActive: boolean;
        name: string;
        sortOrder: number;
    }>;
    department: {
        budgetAllocation: number | null;
        code: string;
        id: string;
        name: string;
        voteNumber: string;
    };
    currentUserId: string;
    fiscalYear: string;
    items: Array<{
        categoryId: string;
        complianceFlags?: readonly string[] | null;
        description: string | null;
        id: string;
        isActive: boolean;
        lastPriceChangedAt: number | null;
        maxQuantity: number | null;
        minQuantity: number | null;
        name: string;
        procurementMethod: string | null;
        sortOrder: number;
        sourceOfFunds: string | null;
        unitOfMeasurement: string | null;
        unitPrice: number | null;
    }>;
    mode: "edit" | "view";
    modeIndicatorLabel: string | null;
    planId: string;
    planMeta: {
        canWithdraw: boolean;
        reviewStartedAt: number | null;
        revisionContext: {
            activeDecision: ReviewDecision | null;
            effectiveDeadlineExpired: boolean;
            history: Array<{
                detail: string;
                id: string;
                kind: "approved" | "rejected" | "revision_requested" | "submitted" | "withdrawn";
                timestamp: number | null;
                timestampLabel: string;
                title: string;
            }>;
            inconsistentStateMessage: string | null;
            reviewDecisions: ReviewDecision[];
        } | null;
        status: "approved" | "draft" | "rejected" | "submitted";
        submissionEmailErrorMessage: string | null;
        submissionEmailStatus: "failed" | "queued" | null;
        submissionReference: string | null;
        submittedAt: number | null;
        timeZone: string;
    };
    persistedPlanSummary: DepartmentUserPersistedPlanSummary;
    selectedCategoryIds: string[];
    subtitle: string;
    unavailableCategories: Array<{
        id: string;
        name: string;
        reason: string;
    }>;
    workspaceState: BlocklyWorkspaceRecord | null;
    workspaceVersion: number;
};

type ReviewDecision = {
    comment: string;
    decidedAt: number;
    decisionType: "approved" | "rejected" | "revision_requested";
    effectiveRevisionDeadlineAt: number | null;
    flaggedTargets: Array<{
        categoryId: string;
        id: string;
        itemId: string | null;
        label: string;
        type: "category" | "item";
    }>;
    id: string;
    lifecycleStatus: "active" | "superseded" | "undone" | null;
    revisionDeadlineAt: number | null;
    submissionReference: string | null;
};

export type DepartmentUserCatalogRequestRecord = {
    canCancel: boolean;
    canEdit: boolean;
    categoryId?: string | null;
    categoryName?: string | null;
    categoryReferenceMode?: "existing" | "request";
    categoryRequest?: {
        description: string;
        id: string;
        justification: string;
        name: string;
        revision: number;
    } | null;
    createdAt: number;
    description: string;
    estimatedUnitPrice?: number;
    id: string;
    justification: string;
    linkedCategoryRequestId?: string | null;
    name: string;
    reason: string | null;
    revision: number;
    status: "approved" | "cancelled" | "denied" | "expired" | "pending";
    submittedAt: number;
    type: "category" | "item";
    updatedAt: number;
};

export type DepartmentUserCatalogRequestData = {
    meta: {
        accessMode: "editable" | "read_only_grace" | null;
        canCreate: boolean;
    };
    requests: DepartmentUserCatalogRequestRecord[];
    summary: {
        pendingCategoryCount: number;
        pendingItemCount: number;
        totalCount: number;
        totalPendingCount: number;
    };
};
