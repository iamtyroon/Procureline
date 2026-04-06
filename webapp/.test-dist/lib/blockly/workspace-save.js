"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSerializedBlocklyWorkspaceSnapshot = exports.prepareDepartmentUserWorkspaceDraftPersistence = exports.buildDepartmentUserWorkspaceDraftPersistencePatch = exports.deriveDepartmentUserWorkspaceDraftPersistenceSummary = exports.buildDepartmentUserWorkspaceDraftSaveInput = exports.isDepartmentUserWorkspaceDraftStale = exports.buildPersistedDepartmentUserWorkspaceState = void 0;
const blockly_serialization_1 = require("./blockly-serialization");
const du_workspace_calculations_1 = require("./du-workspace-calculations");
const du_plan_routes_1 = require("./du-plan-routes");
const workspace_catalog_identity_1 = require("./workspace-catalog-identity");
function buildPersistedDepartmentUserWorkspaceState(args) {
    if (!(0, blockly_serialization_1.isBlocklyWorkspaceRecord)(args.workspaceState)) {
        return null;
    }
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
        },
    };
}
exports.buildPersistedDepartmentUserWorkspaceState = buildPersistedDepartmentUserWorkspaceState;
function isDepartmentUserWorkspaceDraftStale(args) {
    return ((0, blockly_serialization_1.compareBlocklyWorkspaceRecords)(args.incomingWorkspaceState, args.persistedWorkspaceState) < 0);
}
exports.isDepartmentUserWorkspaceDraftStale = isDepartmentUserWorkspaceDraftStale;
function buildDepartmentUserWorkspaceDraftSaveInput(args) {
    return {
        categorySummaries: args.summary?.categories.flatMap((category) => {
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
        estimatedBudgetUsed: args.summary?.departmentTotal ?? 0,
        itemCount: args.summary?.totalItemCount ?? 0,
        planId: args.planId,
        selectedCategoryIds: args.selectedCategoryIds,
        workspaceState: args.workspaceState,
    };
}
exports.buildDepartmentUserWorkspaceDraftSaveInput = buildDepartmentUserWorkspaceDraftSaveInput;
function deriveDepartmentUserWorkspaceDraftPersistenceSummary(args) {
    const workspaceSummary = (0, du_workspace_calculations_1.calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord)({
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
        }),
        estimatedBudgetUsed: workspaceSummary.departmentTotal,
        itemCount: workspaceSummary.totalItemCount,
        workspaceSummary,
    };
}
exports.deriveDepartmentUserWorkspaceDraftPersistenceSummary = deriveDepartmentUserWorkspaceDraftPersistenceSummary;
function buildDepartmentUserWorkspaceDraftPersistencePatch(args) {
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
        selectedCategoryIds: Array.from(new Set([
            ...args.existingSelectedCategoryIds,
            ...derivedSummary.categorySummaries.map((summary) => summary.categoryId),
        ])),
        workspaceState,
        workspaceSummary: derivedSummary.workspaceSummary,
    };
}
exports.buildDepartmentUserWorkspaceDraftPersistencePatch = buildDepartmentUserWorkspaceDraftPersistencePatch;
function prepareDepartmentUserWorkspaceDraftPersistence(args) {
    if (!(0, du_plan_routes_1.canDepartmentUserEditWorkspace)({
        accessMode: args.accessMode,
        status: args.planStatus,
    })) {
        return {
            code: "UNAUTHORIZED",
            message: (0, du_plan_routes_1.getDepartmentUserWorkspaceEditBlockedMessage)({
                accessMode: args.accessMode,
                status: args.planStatus,
            }),
            ok: false,
        };
    }
    const categoryDocIdsByString = new Map(args.categoryDocs.map((category) => [String(category._id), category._id]));
    const savedAt = Date.now();
    const persistencePatch = buildDepartmentUserWorkspaceDraftPersistencePatch({
        categories: args.categories,
        currentUserId: args.currentUserId,
        existingSelectedCategoryIds: args.existingSelectedCategoryIds.map((categoryId) => String(categoryId)),
        items: args.items,
        savedAt,
        totalBudget: args.totalBudget,
        workspaceState: args.workspaceState,
    });
    if (!persistencePatch) {
        return {
            code: "VALIDATION_FAILED",
            message: "Workspace state is malformed and could not be recalculated safely.",
            ok: false,
        };
    }
    if (isDepartmentUserWorkspaceDraftStale({
        incomingWorkspaceState: persistencePatch.workspaceState,
        persistedWorkspaceState: args.persistedWorkspaceState,
    })) {
        return {
            code: "STALE_WORKSPACE_REVISION",
            message: "A newer workspace draft already exists. Refresh the editor before replaying older local changes.",
            ok: false,
        };
    }
    const categorySummaries = persistencePatch.categorySummaries
        .map((summary) => {
        const resolvedCategory = (0, workspace_catalog_identity_1.resolveDepartmentUserCategoryCatalogIdentity)({
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
        .filter((summary) => Boolean(summary));
    const selectedCategoryIds = [];
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
exports.prepareDepartmentUserWorkspaceDraftPersistence = prepareDepartmentUserWorkspaceDraftPersistence;
function createSerializedBlocklyWorkspaceSnapshot(args) {
    return (0, blockly_serialization_1.serializeBlocklyWorkspace)({
        Blockly: args.Blockly,
        lastSavedByUserId: args.currentUserId,
        previousRecord: args.previousRecord,
        workspace: args.workspace,
    });
}
exports.createSerializedBlocklyWorkspaceSnapshot = createSerializedBlocklyWorkspaceSnapshot;
