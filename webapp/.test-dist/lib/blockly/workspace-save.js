"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSerializedBlocklyWorkspaceSnapshot = exports.buildDepartmentUserWorkspaceDraftSaveInput = exports.buildPersistedDepartmentUserWorkspaceState = void 0;
const blockly_serialization_1 = require("./blockly-serialization");
const workspace_catalog_identity_1 = require("./workspace-catalog-identity");
function buildPersistedDepartmentUserWorkspaceState(args) {
    const normalizedWorkspaceState = (0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(args.workspaceState, {
        lastSavedAt: args.savedAt,
        lastSavedByUserId: args.currentUserId,
        saveSource: "workspace_sync",
    });
    return {
        ...normalizedWorkspaceState,
        editorMetadata: {
            ...normalizedWorkspaceState.editorMetadata,
            lastSavedAt: args.savedAt,
            lastSavedByUserId: args.currentUserId,
            saveSource: "workspace_sync",
        },
    };
}
exports.buildPersistedDepartmentUserWorkspaceState = buildPersistedDepartmentUserWorkspaceState;
function buildDepartmentUserWorkspaceDraftSaveInput(args) {
    return {
        categorySummaries: args.rollup?.categories.flatMap((category) => {
            const resolvedCategory = (0, workspace_catalog_identity_1.resolveDepartmentUserCategoryCatalogIdentity)({
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
exports.buildDepartmentUserWorkspaceDraftSaveInput = buildDepartmentUserWorkspaceDraftSaveInput;
function createSerializedBlocklyWorkspaceSnapshot(args) {
    return (0, blockly_serialization_1.serializeBlocklyWorkspace)({
        Blockly: args.Blockly,
        lastSavedByUserId: args.currentUserId,
        previousRecord: args.previousRecord,
        workspace: args.workspace,
    });
}
exports.createSerializedBlocklyWorkspaceSnapshot = createSerializedBlocklyWorkspaceSnapshot;
