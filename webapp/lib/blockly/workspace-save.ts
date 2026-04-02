import {
    normalizeBlocklyWorkspaceRecord,
    serializeBlocklyWorkspace,
    type BlocklyWorkspaceRecord,
} from "./blockly-serialization";
import type { DepartmentUserDepartmentRollup } from "./du-workspace-calculations";
import { resolveDepartmentUserCategoryCatalogIdentity } from "./workspace-catalog-identity";

type BlocklyModule = typeof import("blockly");
type BlocklyWorkspaceSvg = import("blockly").WorkspaceSvg;

export function buildPersistedDepartmentUserWorkspaceState(args: {
    currentUserId: string;
    savedAt: number;
    workspaceState: unknown;
}) {
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
            saveSource: "workspace_sync" as const,
        },
    };
}

export function buildDepartmentUserWorkspaceDraftSaveInput(args: {
    categories: Array<{
        id: string;
        name: string;
    }>;
    planId: string;
    rollup: DepartmentUserDepartmentRollup | null;
    selectedCategoryIds: string[];
    workspaceState: BlocklyWorkspaceRecord;
}) {
    return {
        categorySummaries:
            args.rollup?.categories.flatMap((category) => {
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
        estimatedBudgetUsed: args.rollup?.departmentTotal ?? 0,
        itemCount: args.rollup?.totalItemCount ?? 0,
        planId: args.planId,
        selectedCategoryIds: args.selectedCategoryIds,
        workspaceState: args.workspaceState,
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
