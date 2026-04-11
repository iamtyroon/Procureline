import {
    isBlocklyWorkspaceRecord,
    normalizeBlocklyWorkspaceRecord,
    serializeBlocklyWorkspace,
    type BlocklyWorkspaceRecord,
} from "./blockly-serialization";
import type {
    DepartmentUserWorkspaceSummary,
} from "./du-workspace-calculations";
import {
    calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord,
} from "./du-workspace-calculations";
import {
    canDepartmentUserEditWorkspace,
    getDepartmentUserWorkspaceEditBlockedMessage,
} from "./du-plan-routes";
import {
    resolveDepartmentUserCategoryCatalogIdentity,
    type DepartmentUserCatalogItem,
} from "./workspace-catalog-identity";

type BlocklyModule = typeof import("blockly");
type BlocklyWorkspaceSvg = import("blockly").WorkspaceSvg;

export interface DepartmentUserWorkspaceCategorySummaryRecord {
    amount: number;
    categoryId: string;
    categoryName: string;
    itemCount: number;
}

export interface DepartmentUserWorkspaceDraftPersistenceSummary {
    categorySummaries: DepartmentUserWorkspaceCategorySummaryRecord[];
    estimatedBudgetUsed: number;
    itemCount: number;
    workspaceSummary: DepartmentUserWorkspaceSummary;
}

export interface DepartmentUserWorkspaceDraftPersistencePatch {
    categorySummaries: DepartmentUserWorkspaceCategorySummaryRecord[];
    estimatedBudgetUsed: number;
    itemCount: number;
    selectedCategoryIds: string[];
    workspaceState: BlocklyWorkspaceRecord;
    workspaceSummary: DepartmentUserWorkspaceSummary;
}

export interface DepartmentUserWorkspaceDraftPlanPersistenceRecord<
    CategoryId = string,
> {
    categorySummaries: Array<{
        amount: number;
        categoryId: CategoryId;
        categoryName: string;
        itemCount: number;
    }>;
    estimatedBudgetUsed: number;
    itemCount: number;
    selectedCategoryIds: CategoryId[];
    updatedAt: number;
    workspaceState: BlocklyWorkspaceRecord;
}

export type DepartmentUserWorkspaceDraftPersistencePreparationResult<
    CategoryId = string,
> =
    | {
          code:
              | "STALE_WORKSPACE_REVISION"
              | "UNAUTHORIZED"
              | "VALIDATION_FAILED";
          message: string;
          ok: false;
      }
    | {
          ok: true;
          patch: DepartmentUserWorkspaceDraftPlanPersistenceRecord<CategoryId>;
      };

export function buildPersistedDepartmentUserWorkspaceState(args: {
    currentUserId: string;
    savedAt: number;
    workspaceState: unknown;
}): BlocklyWorkspaceRecord | null {
    if (!isBlocklyWorkspaceRecord(args.workspaceState)) {
        return null;
    }

    const normalizedWorkspaceState = normalizeBlocklyWorkspaceRecord(
        args.workspaceState,
        {
            lastSavedAt: args.savedAt,
            lastSavedByUserId: args.currentUserId,
            saveSource: "workspace_sync",
        },
    );

    return {
        ...normalizedWorkspaceState,
        editorMetadata: {
            ...normalizedWorkspaceState.editorMetadata,
            lastSavedAt: args.savedAt,
            lastSavedByUserId: args.currentUserId,
        },
    };
}

export function isDepartmentUserWorkspaceDraftStale(args: {
    incomingWorkspaceState: BlocklyWorkspaceRecord;
    persistedWorkspaceState: BlocklyWorkspaceRecord | null | undefined;
}): boolean {
    const persistedWorkspaceState =
        args.persistedWorkspaceState
            ? normalizeBlocklyWorkspaceRecord(args.persistedWorkspaceState)
            : null;
    if (!persistedWorkspaceState) {
        return false;
    }

    const incomingRevision = args.incomingWorkspaceState.editorMetadata.revision;
    const persistedRevision = persistedWorkspaceState.editorMetadata.revision;

    if (incomingRevision < persistedRevision) {
        return true;
    }

    if (incomingRevision > persistedRevision) {
        return false;
    }

    return (
        JSON.stringify(args.incomingWorkspaceState.workspaceJson) !==
            JSON.stringify(persistedWorkspaceState.workspaceJson) ||
        args.incomingWorkspaceState.editorMetadata.saveSource !==
            persistedWorkspaceState.editorMetadata.saveSource ||
        args.incomingWorkspaceState.editorMetadata.recoveredAt !==
            persistedWorkspaceState.editorMetadata.recoveredAt
    );
}

export function buildDepartmentUserWorkspaceDraftSaveInput(args: {
    categories: Array<{
        id: string;
        name: string;
    }>;
    planId: string;
    selectedCategoryIds: string[];
    summary: DepartmentUserWorkspaceSummary | null;
    workspaceState: BlocklyWorkspaceRecord;
}) {
    return {
        categorySummaries:
            args.summary?.categories.flatMap((category) => {
                const resolvedCategory = resolveDepartmentUserCategoryCatalogIdentity({
                    categories: args.categories,
                    categoryId: category.categoryId,
                    categoryName: category.categoryName,
                });

                if (!resolvedCategory) {
                    return [];
                }

                return [
                    {
                        amount: category.totalCost,
                        categoryId: resolvedCategory.id,
                        categoryName: resolvedCategory.name,
                        itemCount: category.itemCount,
                    },
                ];
            }) ?? [],
        estimatedBudgetUsed: args.summary?.departmentTotal ?? 0,
        itemCount: args.summary?.totalItemCount ?? 0,
        planId: args.planId,
        selectedCategoryIds: args.selectedCategoryIds,
        workspaceState: args.workspaceState,
    };
}

export function deriveDepartmentUserWorkspaceDraftPersistenceSummary(args: {
    categories: Array<{
        id: string;
        name: string;
    }>;
    items: readonly DepartmentUserCatalogItem[];
    totalBudget: number | null | undefined;
    workspaceState: BlocklyWorkspaceRecord;
}): DepartmentUserWorkspaceDraftPersistenceSummary | null {
    const workspaceSummary = calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord({
        items: args.items,
        refreshCatalogMetadata: true,
        totalBudget: args.totalBudget,
        workspaceState: args.workspaceState,
    });

    if (!workspaceSummary) {
        return null;
    }

    return {
        categorySummaries: workspaceSummary.categories.flatMap((category) => {
            const resolvedCategory = resolveDepartmentUserCategoryCatalogIdentity({
                categories: args.categories,
                categoryId: category.categoryId,
                categoryName: category.categoryName,
            });

            if (!resolvedCategory) {
                return [];
            }

            return [
                {
                    amount: category.totalCost,
                    categoryId: resolvedCategory.id,
                    categoryName: resolvedCategory.name,
                    itemCount: category.itemCount,
                },
            ];
        }),
        estimatedBudgetUsed: workspaceSummary.departmentTotal,
        itemCount: workspaceSummary.totalItemCount,
        workspaceSummary,
    };
}

export function buildDepartmentUserWorkspaceDraftPersistencePatch(args: {
    categories: Array<{
        id: string;
        name: string;
    }>;
    currentUserId: string;
    existingSelectedCategoryIds: string[];
    items: readonly DepartmentUserCatalogItem[];
    savedAt: number;
    totalBudget: number | null | undefined;
    workspaceState: unknown;
}): DepartmentUserWorkspaceDraftPersistencePatch | null {
    const workspaceState = buildPersistedDepartmentUserWorkspaceState({
        currentUserId: args.currentUserId,
        savedAt: args.savedAt,
        workspaceState: args.workspaceState,
    });

    if (!workspaceState) {
        return null;
    }

    const derivedSummary = deriveDepartmentUserWorkspaceDraftPersistenceSummary({
        categories: args.categories,
        items: args.items,
        totalBudget: args.totalBudget,
        workspaceState,
    });

    if (!derivedSummary) {
        return null;
    }

    return {
        categorySummaries: derivedSummary.categorySummaries,
        estimatedBudgetUsed: derivedSummary.estimatedBudgetUsed,
        itemCount: derivedSummary.itemCount,
        selectedCategoryIds: Array.from(
            new Set([
                ...args.existingSelectedCategoryIds,
                ...derivedSummary.categorySummaries.map(
                    (summary) => summary.categoryId,
                ),
            ]),
        ),
        workspaceState,
        workspaceSummary: derivedSummary.workspaceSummary,
    };
}

export function prepareDepartmentUserWorkspaceDraftPersistence<
    CategoryId = string,
>(args: {
    accessMode: "editable" | "read_only_grace" | null | undefined;
    categories: Array<{
        id: string;
        name: string;
    }>;
    categoryDocs: Array<{
        _id: CategoryId;
        name: string;
    }>;
    currentUserId: string;
    existingSelectedCategoryIds: CategoryId[];
    items: readonly DepartmentUserCatalogItem[];
    planStatus: "approved" | "draft" | "rejected" | "submitted";
    persistedWorkspaceState: BlocklyWorkspaceRecord | null | undefined;
    totalBudget: number | null | undefined;
    workspaceState: unknown;
}): DepartmentUserWorkspaceDraftPersistencePreparationResult<CategoryId> {
    if (
        !canDepartmentUserEditWorkspace({
            accessMode: args.accessMode,
            status: args.planStatus,
        })
    ) {
        return {
            code: "UNAUTHORIZED",
            message: getDepartmentUserWorkspaceEditBlockedMessage({
                accessMode: args.accessMode,
                status: args.planStatus,
            }),
            ok: false,
        };
    }

    const categoryDocIdsByString = new Map(
        args.categoryDocs.map((category) => [String(category._id), category._id] as const),
    );
    const savedAt = Date.now();
    const persistencePatch = buildDepartmentUserWorkspaceDraftPersistencePatch({
        categories: args.categories,
        currentUserId: args.currentUserId,
        existingSelectedCategoryIds: args.existingSelectedCategoryIds.map((categoryId) =>
            String(categoryId),
        ),
        items: args.items,
        savedAt,
        totalBudget: args.totalBudget,
        workspaceState: args.workspaceState,
    });

    if (!persistencePatch) {
        return {
            code: "VALIDATION_FAILED",
            message:
                "Workspace state is malformed and could not be recalculated safely.",
            ok: false,
        };
    }

    if (
        isDepartmentUserWorkspaceDraftStale({
            incomingWorkspaceState: persistencePatch.workspaceState,
            persistedWorkspaceState: args.persistedWorkspaceState,
        })
    ) {
        return {
            code: "STALE_WORKSPACE_REVISION",
            message:
                "A newer workspace draft already exists. Refresh the editor before replaying older local changes.",
            ok: false,
        };
    }

    const categorySummaries = persistencePatch.categorySummaries
        .map((summary) => {
            const resolvedCategory = resolveDepartmentUserCategoryCatalogIdentity({
                categories: args.categories,
                categoryId: summary.categoryId,
                categoryName: summary.categoryName,
            });
            const resolvedCategoryId = resolvedCategory
                ? categoryDocIdsByString.get(resolvedCategory.id) ?? null
                : null;

            if (!resolvedCategoryId || !resolvedCategory) {
                return null;
            }

            return {
                amount: summary.amount,
                categoryId: resolvedCategoryId,
                categoryName: resolvedCategory.name,
                itemCount: summary.itemCount,
            };
        })
        .filter(
            (summary): summary is NonNullable<typeof summary> => Boolean(summary),
        );
    const selectedCategoryIds: CategoryId[] = [];
    for (const categoryId of persistencePatch.selectedCategoryIds) {
        const resolvedCategoryId = categoryDocIdsByString.get(categoryId);
        if (resolvedCategoryId !== undefined) {
            selectedCategoryIds.push(resolvedCategoryId);
        }
    }

    return {
        ok: true,
        patch: {
            categorySummaries,
            estimatedBudgetUsed: Math.max(0, persistencePatch.estimatedBudgetUsed),
            itemCount: Math.max(0, persistencePatch.itemCount),
            selectedCategoryIds,
            updatedAt: savedAt,
            workspaceState: persistencePatch.workspaceState,
        },
    };
}

export function createSerializedBlocklyWorkspaceSnapshot(args: {
    Blockly: BlocklyModule;
    currentUserId: string;
    previousRecord?: BlocklyWorkspaceRecord | null;
    workspace: BlocklyWorkspaceSvg;
}): BlocklyWorkspaceRecord {
    return serializeBlocklyWorkspace({
        Blockly: args.Blockly,
        lastSavedByUserId: args.currentUserId,
        previousRecord: args.previousRecord,
        workspace: args.workspace,
    });
}
