import assert from "node:assert/strict";
import {
    createBlocklyWorkspaceRecord,
    normalizeBlocklyWorkspaceRecord,
} from "../lib/shared/blockly/blockly-serialization";
import {
    buildDepartmentUserToolbox,
} from "../lib/frontend/blockly/du-toolbox";
import { sanitizeDepartmentUserWorkspaceCategorySelection } from "../lib/shared/blockly/du-toolbox-selection";
import {
    createDepartmentUserWorkspaceUiStateStorageKey,
    parseDepartmentUserWorkspaceUiState,
    restoreDepartmentUserWorkspaceUiState,
    serializeDepartmentUserWorkspaceUiState,
} from "../lib/frontend/blockly/workspace-ui-state";
import {
    getDepartmentUserCategoryDeletionConfirmation,
    resolveDepartmentUserWorkspaceEvent,
    shouldRefreshDepartmentUserToolboxForEvent,
} from "../lib/frontend/blockly/workspace-events";
import { buildDepartmentUserBlocklyInjectionOptions } from "../lib/frontend/blockly/workspace-runtime";
import {
    applyDepartmentWorkspaceRollup,
    buildDepartmentUserWorkspaceSummaryFromPersistedPlan,
    calculateDepartmentUserDepartmentRollup,
    calculateDepartmentUserItemRollup,
    calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord,
    getDepartmentUserReservedSubmitState,
    getDepartmentUserWorkspaceAnnouncement,
    mapDepartmentUserBudgetMeterState,
    resolveDepartmentUserDisplayedWorkspaceSummary,
} from "../lib/shared/blockly/du-workspace-calculations";
import {
    buildDepartmentUserWorkspaceDraftPersistencePatch,
    buildDepartmentUserWorkspaceDraftSaveInput,
    buildPersistedDepartmentUserWorkspaceState,
    deriveDepartmentUserWorkspaceDraftPersistenceSummary,
    prepareDepartmentUserWorkspaceDraftPersistence,
} from "../lib/shared/blockly/workspace-save";
import { createSerializedBlocklyWorkspaceSnapshot } from "../lib/frontend/blockly/workspace-serialization";
import {
    collectDepartmentUserWorkspaceSourceUsage,
    collectDepartmentUserWorkspaceSourceUsageFromDepartmentBlock,
    resolveDepartmentUserItemCatalogIdentity,
    synchronizeDepartmentUserWorkspaceCatalogIdentity,
} from "../lib/shared/blockly/workspace-catalog-identity";
import { getPersistedPlanSummaryForWorkspaceSummaryChange } from "../lib/frontend/blockly/du-editor-fallback";

class TestBlock {
    private readonly fields = new Map<string, string>();
    private readonly inputs = new Map<string, TestBlock | null>();
    private nextBlock: TestBlock | null = null;
    __duQuantityFeedback?: Partial<Record<string, string>>;
    id?: string;
    warningText: string | null = null;
    svgGroup_ = {
        classList: {
            classes: new Set<string>(),
            toggle: (className: string, force?: boolean) => {
                if (force ?? !this.svgGroup_.classList.classes.has(className)) {
                    this.svgGroup_.classList.classes.add(className);
                    return;
                }

                this.svgGroup_.classList.classes.delete(className);
            },
        },
    };

    constructor(readonly type: string, initialFields: Record<string, string> = {}) {
        for (const [key, value] of Object.entries(initialFields)) {
            this.fields.set(key, value);
        }
    }

    getFieldValue(name: string): string {
        return this.fields.get(name) ?? "";
    }

    getInput(name: string) {
        const targetBlock = this.inputs.get(name) ?? null;
        return { connection: { targetBlock: () => targetBlock } };
    }

    getNextBlock(): TestBlock | null {
        return this.nextBlock;
    }

    linkInput(name: string, block: TestBlock | null): TestBlock {
        this.inputs.set(name, block);
        return this;
    }

    linkNext(block: TestBlock | null): TestBlock {
        this.nextBlock = block;
        return this;
    }

    setFieldValue(value: string, name: string): void {
        this.fields.set(name, value);
    }

    setWarningText(value: string | null): void {
        this.warningText = value;
    }
}

export async function runDepartmentUserBlocklyWorkspaceTests(): Promise<string[]> {
    const completedTests: string[] = [];

    const itemRollup = calculateDepartmentUserItemRollup({
        complianceFlags: ["agpo"],
        itemDescription: "Laptops",
        itemId: "item-1",
        quantities: { q1: 1, q2: 2, q3: 0, q4: 1 },
        unitPrice: 50_000,
    });
    assert.equal(itemRollup.totalCost, 200_000);
    assert.equal(itemRollup.totalQuantity, 4);
    completedTests.push("department-user item rollups preserve quarterly quantity and cost totals");

    const departmentRollup = calculateDepartmentUserDepartmentRollup([
        {
            categoryId: "cat-it",
            categoryName: "ICT Equipment",
            items: [
                {
                    complianceFlags: ["agpo", "pwd"],
                    itemDescription: "Laptops",
                    itemId: "item-1",
                    quantities: { q1: 1, q2: 1, q3: 1, q4: 1 },
                    unitPrice: 65_000,
                },
            ],
        },
    ]);
    assert.equal(departmentRollup.departmentTotal, 260_000);
    completedTests.push("department-user department rollups keep category and department totals aligned");

    const unallocatedBudget = mapDepartmentUserBudgetMeterState({
        totalBudget: null,
        usedAmount: 150_000,
    });
    const overBudget = mapDepartmentUserBudgetMeterState({
        totalBudget: 1_000_000,
        usedAmount: 1_150_000,
    });
    const underBudget = mapDepartmentUserBudgetMeterState({
        totalBudget: 25_000,
        usedAmount: 19_000,
    });
    const nearFullUnderBudget = mapDepartmentUserBudgetMeterState({
        totalBudget: 25_000,
        usedAmount: 24_999.99,
    });
    const exactBudget = mapDepartmentUserBudgetMeterState({
        totalBudget: 25_000,
        usedAmount: 25_000,
    });
    const subCentOverBudget = mapDepartmentUserBudgetMeterState({
        totalBudget: 25_000,
        usedAmount: 25_000.004,
    });
    const oneCentOverBudget = mapDepartmentUserBudgetMeterState({
        totalBudget: 25_000,
        usedAmount: 25_000.01,
    });
    assert.equal(unallocatedBudget.state, "unallocated");
    assert.equal(overBudget.state, "over_budget");
    assert.equal(overBudget.overBudgetAmount, 150_000);
    assert.match(overBudget.bannerText ?? "", /Budget exceeded by/i);
    assert.equal(underBudget.state, "under_budget");
    assert.equal(underBudget.canSubmitByBudget, false);
    assert.equal(underBudget.remainingBudget, 6_000);
    assert.match(underBudget.bannerText ?? "", /Budget not fully utilized/i);
    assert.equal(nearFullUnderBudget.state, "warning");
    assert.equal(nearFullUnderBudget.canSubmitByBudget, false);
    assert.equal(nearFullUnderBudget.remainingBudget, 0.01);
    assert.equal(exactBudget.canSubmitByBudget, true);
    assert.equal(exactBudget.overBudgetAmount, 0);
    assert.equal(exactBudget.remainingBudget, 0);
    assert.equal(subCentOverBudget.canSubmitByBudget, true);
    assert.equal(subCentOverBudget.overBudgetAmount, 0);
    assert.equal(oneCentOverBudget.state, "over_budget");
    assert.equal(oneCentOverBudget.overBudgetAmount, 0.01);
    completedTests.push("budget meter state now carries truthful unallocated and over-budget messaging");

    const categorySelection = sanitizeDepartmentUserWorkspaceCategorySelection({
        categories: [
            { color: "#0B6E4F", icon: "cpu", id: "cat-it", isActive: true, name: "ICT Equipment", sortOrder: 1 },
            { color: "#4A90D9", icon: "boxes", id: "cat-office", isActive: true, name: "Office Supplies", sortOrder: 2 },
        ],
        items: [
            {
                categoryId: "cat-it",
                description: "Laptop devices",
                id: "item-1",
                isActive: true,
                name: "Laptops",
                procurementMethod: "RFQ",
                sortOrder: 1,
                sourceOfFunds: "GOK",
                unitOfMeasurement: "Each",
                unitPrice: 50_000,
            },
        ],
        requestedCategoryIds: ["cat-it", "cat-office"],
    });
    assert.deepEqual(categorySelection.sanitizedCategoryIds, ["cat-it"]);
    completedTests.push("workspace category selection still filters out categories without active catalog items");

    const toolbox = buildDepartmentUserToolbox({
        categories: [
            { color: "#0B6E4F", icon: "cpu", id: "cat-it", isActive: true, name: "ICT Equipment", sortOrder: 2 },
            { color: "#B45309", icon: "boxes", id: "cat-office", isActive: true, name: "Office Supplies", sortOrder: 1 },
        ],
        department: {
            budgetAllocation: 2_500_000,
            departmentId: "department-1",
            departmentName: "Computer Science",
            voteNumber: "CS-2026",
        },
        items: [
            {
                categoryId: "cat-it",
                description: "Laptop devices",
                id: "item-1",
                isActive: true,
                name: "Laptops",
                procurementMethod: "RFQ",
                sortOrder: 1,
                sourceOfFunds: "GOK",
                unitOfMeasurement: "Each",
                unitPrice: 50_000,
            },
            {
                categoryId: "cat-office",
                description: "All-purpose paper",
                id: "item-2",
                isActive: true,
                name: "Printer Paper",
                procurementMethod: "Shopping",
                sortOrder: 1,
                sourceOfFunds: "GOK",
                unitOfMeasurement: "Ream",
                unitPrice: 1_500,
            },
        ],
        selectedCategoryIds: ["cat-it", "cat-office"],
        sourceUsage: {
            categoryIds: ["cat-it"],
            itemIds: ["item-1"],
        },
    });
    const toolboxContents = toolbox.toolboxDefinition.contents as Array<Record<string, unknown>>;
    assert.deepEqual(toolbox.sanitizedCategoryIds, ["cat-office", "cat-it"]);
    assert.equal(toolboxContents.length, 2);
    assert.equal(toolboxContents[1]?.name, "Office Supplies");
    assert.equal(toolbox.categoryStates[0]?.id, "cat-office");
    assert.equal(toolbox.categoryStates[1]?.isUsedOnWorkspace, true);
    assert.equal(
        toolboxContents.some((content) => content.name === "ICT Equipment"),
        false,
    );
    completedTests.push("department-user toolbox generation now preserves PO-managed category order and hides used item source blocks by stable ids");

    const categorySearchToolbox = buildDepartmentUserToolbox({
        categories: [
            { color: "#B45309", icon: "boxes", id: "cat-office", isActive: true, name: "Office Supplies", sortOrder: 2 },
        ],
        department: {
            budgetAllocation: 2_500_000,
            departmentId: "department-1",
            departmentName: "Computer Science",
            voteNumber: "CS-2026",
        },
        items: [
            {
                categoryId: "cat-office",
                description: "All-purpose paper",
                id: "item-2",
                isActive: true,
                name: "Printer Paper",
                procurementMethod: "Shopping",
                sortOrder: 1,
                sourceOfFunds: "GOK",
                unitOfMeasurement: "Ream",
                unitPrice: 1_500,
            },
        ],
        searchQuery: "office",
        selectedCategoryIds: ["cat-office"],
    });
    const officeCategory = (categorySearchToolbox.toolboxDefinition.contents as Array<Record<string, unknown>>)[1];
    assert.equal((officeCategory?.contents as Array<Record<string, unknown>>).length, 1);
    assert.equal((officeCategory?.contents as Array<Record<string, unknown>>)[0]?.type, "category_block");
    completedTests.push("category-name toolbox search keeps the source block visible without repopulating non-matching item blocks");

    const itemSearchToolbox = buildDepartmentUserToolbox({
        categories: [
            { color: "#B45309", icon: "boxes", id: "cat-office", isActive: true, name: "Office Supplies", sortOrder: 1 },
        ],
        department: {
            budgetAllocation: 2_500_000,
            departmentId: "department-1",
            departmentName: "Computer Science",
            voteNumber: "CS-2026",
        },
        items: [
            {
                categoryId: "cat-office",
                description: "All-purpose paper",
                id: "item-paper",
                isActive: true,
                name: "Printer Paper",
                procurementMethod: "Shopping",
                sortOrder: 1,
                sourceOfFunds: "GOK",
                unitOfMeasurement: "Ream",
                unitPrice: 1_500,
            },
            {
                categoryId: "cat-office",
                description: "Staples for binders",
                id: "item-staples",
                isActive: true,
                name: "Staples",
                procurementMethod: "Shopping",
                sortOrder: 2,
                sourceOfFunds: "GOK",
                unitOfMeasurement: "Box",
                unitPrice: 800,
            },
        ],
        searchQuery: "paper",
        selectedCategoryIds: ["cat-office"],
        sourceUsage: {
            categoryIds: ["cat-office"],
            itemIds: ["item-paper"],
        },
    });
    const searchedCategory = (itemSearchToolbox.toolboxDefinition.contents as Array<Record<string, unknown>>)[1];
    assert.equal(
        (searchedCategory?.contents as Array<Record<string, unknown>> | undefined)?.length ?? 0,
        0,
    );
    assert.equal(itemSearchToolbox.categoryStates[0]?.matchingItemCount, 0);
    completedTests.push("toolbox search now stays anchored to item ids so already-used matching items do not leak back into category flyouts");

    const categoryUsage = collectDepartmentUserWorkspaceSourceUsage({
        categories: [
            { id: "cat-it", name: "ICT Equipment" },
            { id: "cat-office", name: "Office Supplies" },
        ],
        items: [
            {
                categoryId: "cat-it",
                description: "Shared name",
                id: "item-it",
                name: "Shared Item",
                unitPrice: 1_000,
            },
            {
                categoryId: "cat-office",
                description: "Shared name",
                id: "item-office",
                name: "Shared Item",
                unitPrice: 2_000,
            },
        ],
        workspaceState: createBlocklyWorkspaceRecord({
            workspaceJson: {
                blocks: {
                    blocks: [
                        {
                            type: "department_block",
                            inputs: {
                                CATEGORIES: {
                                    block: {
                                        fields: {
                                            CATEGORY_ID: "cat-office",
                                            CATEGORY_NAME: "Office Supplies",
                                        },
                                        inputs: {
                                            ITEMS: {
                                                block: {
                                                    fields: {
                                                        ITEM_DESC: "Shared Item",
                                                        ITEM_DESCRIPTION: "Shared name",
                                                        ITEM_ID: "item-office",
                                                        UNIT_PRICE: 2000,
                                                    },
                                                    type: "item_block",
                                                },
                                            },
                                        },
                                        next: {
                                            block: {
                                                fields: {
                                                    CATEGORY_ID: "cat-it",
                                                    CATEGORY_NAME: "ICT Equipment",
                                                },
                                                type: "category_block",
                                            },
                                        },
                                        type: "category_block",
                                    },
                                },
                            },
                        },
                    ],
                    languageVersion: 0,
                },
            },
        }),
    });
    assert.deepEqual(categoryUsage.categoryIds, ["cat-office", "cat-it"]);
    assert.deepEqual(categoryUsage.itemIds, ["item-office"]);
    completedTests.push("workspace source-usage tracking stays anchored to stable category and item ids even when names collide");

    const liveUsageDepartment = new TestBlock("department_block");
    const liveUsageOffice = new TestBlock("category_block", {
        CATEGORY_ID: "cat-office",
        CATEGORY_NAME: "Office Supplies",
    });
    const liveUsageItem = new TestBlock("item_block", {
        ITEM_DESC: "Shared Item",
        ITEM_DESCRIPTION: "Shared name",
        ITEM_ID: "item-office",
        UNIT_PRICE: "2000",
    });
    liveUsageDepartment.linkInput("CATEGORIES", liveUsageOffice);
    liveUsageOffice.linkInput("ITEMS", liveUsageItem);
    const liveSourceUsage = collectDepartmentUserWorkspaceSourceUsageFromDepartmentBlock({
        categories: [
            { id: "cat-it", name: "ICT Equipment" },
            { id: "cat-office", name: "Office Supplies" },
        ],
        departmentBlock: liveUsageDepartment,
        items: [
            {
                categoryId: "cat-it",
                description: "Shared name",
                id: "item-it",
                name: "Shared Item",
                unitPrice: 1_000,
            },
            {
                categoryId: "cat-office",
                description: "Shared name",
                id: "item-office",
                name: "Shared Item",
                unitPrice: 2_000,
            },
        ],
    });
    assert.deepEqual(liveSourceUsage, {
        categoryIds: ["cat-office"],
        itemIds: ["item-office"],
    });
    completedTests.push("workspace source-usage refresh can now read the live Blockly chain without reserializing the full workspace");

    const resolvedItem = resolveDepartmentUserItemCatalogIdentity({
        categoryId: "cat-it",
        itemDescription: "Portable computers",
        itemId: "",
        itemName: "Laptops",
        items: [
            {
                categoryId: "cat-it",
                complianceFlags: ["agpo"],
                description: "Portable computers",
                id: "item-laptop",
                name: "Laptops",
                unitPrice: 50_000,
            },
        ],
        unitPrice: 50_000,
    });
    assert.equal(resolvedItem?.id, "item-laptop");

    const departmentBlock = new TestBlock("department_block");
    const categoryBlock = new TestBlock("category_block", {
        CATEGORY_ID: "",
        CATEGORY_NAME: "ICT Equipment",
    });
    const itemBlock = new TestBlock("item_block", {
        COMPLIANCE_FLAGS: "",
        ITEM_DESC: "Laptops",
        ITEM_DESCRIPTION: "Portable computers",
        ITEM_ID: "",
        UNIT_PRICE: "50000",
    });
    departmentBlock.linkInput("CATEGORIES", categoryBlock);
    categoryBlock.linkInput("ITEMS", itemBlock);

    synchronizeDepartmentUserWorkspaceCatalogIdentity({
        categories: [{ id: "cat-it", name: "ICT Equipment" }],
        departmentBlock,
        items: [
            {
                categoryId: "cat-it",
                complianceFlags: ["agpo", "pwd"],
                description: "Portable computers",
                id: "item-laptop",
                name: "Laptops",
                procurementMethod: "RFQ",
                sourceOfFunds: "GOK",
                unitOfMeasurement: "each",
                unitPrice: 50_000,
            },
        ],
    });
    assert.equal(itemBlock.getFieldValue("ITEM_ID"), "item-laptop");
    assert.equal(itemBlock.getFieldValue("COMPLIANCE_FLAGS"), "agpo,pwd");
    completedTests.push("workspace identity synchronization now refreshes hidden compliance flags alongside catalog metadata");

    const liveRollupDepartment = new TestBlock("department_block");
    const liveRollupCategory = new TestBlock("category_block", {
        CATEGORY_ID: "cat-it",
        CATEGORY_NAME: "ICT Equipment",
    });
    const liveRollupItem = new TestBlock("item_block", {
        COMPLIANCE_FLAGS: "agpo,pwd",
        ITEM_DESC: "Laptops",
        ITEM_ID: "item-laptop",
        Q1_QTY: "2",
        Q2_QTY: "2",
        Q3_QTY: "2",
        Q4_QTY: "2",
        UNIT_PRICE: "150000",
    });
    liveRollupDepartment.linkInput("CATEGORIES", liveRollupCategory);
    liveRollupCategory.linkInput("ITEMS", liveRollupItem);
    const liveSummary = applyDepartmentWorkspaceRollup({
        departmentBlock: liveRollupDepartment,
        items: [
            {
                categoryId: "cat-it",
                complianceFlags: ["agpo", "pwd"],
                description: "Portable computers",
                id: "item-laptop",
                name: "Laptops",
                unitPrice: 150_000,
            },
        ],
        totalBudget: 1_000_000,
    });
    assert.equal(liveSummary?.budgetState.state, "over_budget");
    assert.equal(
        liveRollupDepartment.svgGroup_.classList.classes.has("dept-block-budget-over"),
        true,
    );
    completedTests.push("live Blockly rollups now share one budget-aware summary path for visuals and warnings");

    const liveValidationDepartment = new TestBlock("department_block");
    const liveValidationCategory = new TestBlock("category_block", {
        CATEGORY_ID: "cat-office",
        CATEGORY_NAME: "Office Supplies",
    });
    const liveValidationItem = new TestBlock("item_block", {
        COMPLIANCE_FLAGS: "",
        ITEM_DESC: "Printer Paper",
        ITEM_DESCRIPTION: "Printer Paper",
        ITEM_ID: "item-paper",
        ITEM_IS_ACTIVE: "true",
        MAX_QUANTITY: "6",
        MIN_QUANTITY: "",
        Q1_QTY: "6",
        Q2_QTY: "0",
        Q3_QTY: "0",
        Q4_QTY: "0",
        UNIT_OF_MEASUREMENT: "each",
        UNIT_PRICE: "1200",
    });
    liveValidationItem.id = "item-paper-block";
    liveValidationItem.__duQuantityFeedback = {
        Q1_QTY: "Maximum quantity is 6",
    };
    liveValidationDepartment.linkInput("CATEGORIES", liveValidationCategory);
    liveValidationCategory.linkInput("ITEMS", liveValidationItem);
    const liveValidationSummary = applyDepartmentWorkspaceRollup({
        departmentBlock: liveValidationDepartment,
        items: [
            {
                categoryId: "cat-office",
                description: "Printer Paper",
                id: "item-paper",
                isActive: true,
                maxQuantity: 6,
                minQuantity: null,
                name: "Printer Paper",
                unitOfMeasurement: "each",
                unitPrice: 1_200,
            },
        ],
        totalBudget: 50_000,
    });
    assert.ok(liveValidationSummary);
    assert.equal(liveValidationItem.warningText, "Maximum quantity is 6");
    assert.equal(liveValidationSummary.validationState.submitBlockedReasons.length, 1);
    assert.match(
        liveValidationSummary.validationState.submitBlockedReasons[0] ?? "",
        /Budget not fully utilized/i,
    );
    completedTests.push("live Blockly validation feedback now preserves one-cycle inline quantity warnings after the field normalizes bad input");

    const emptyCategoryDepartment = new TestBlock("department_block");
    const emptyCategoryBlock = new TestBlock("category_block", {
        CATEGORY_ID: "cat-empty",
        CATEGORY_NAME: "Empty Category",
    });
    emptyCategoryDepartment.linkInput("CATEGORIES", emptyCategoryBlock);
    const emptyCategorySummary = applyDepartmentWorkspaceRollup({
        departmentBlock: emptyCategoryDepartment,
        items: [],
        totalBudget: 100_000,
    });
    assert.ok(emptyCategorySummary);
    assert.equal(emptyCategoryBlock.getFieldValue("CATEGORY_EMPTY_STATE"), "Drag items here");
    completedTests.push("category rollups now expose the empty-state hint directly on empty category blocks");

    const deletionConfirmation = getDepartmentUserCategoryDeletionConfirmation({
        blockId: "category-block-1",
        oldJson: {
            fields: {
                CATEGORY_ID: "cat-it",
                CATEGORY_NAME: "ICT Equipment",
            },
            inputs: {
                ITEMS: {
                    block: {
                        type: "item_block",
                    },
                },
            },
            type: "category_block",
        },
        type: "delete",
    });
    assert.deepEqual(deletionConfirmation, {
        blockId: "category-block-1",
        categoryId: "cat-it",
        categoryName: "ICT Equipment",
        itemCount: 1,
        message: "Remove ICT Equipment and all its items?",
    });
    assert.equal(
        shouldRefreshDepartmentUserToolboxForEvent({ type: "move" }),
        true,
    );
    assert.equal(
        shouldRefreshDepartmentUserToolboxForEvent({ type: "change" }),
        false,
    );
    const deleteResolution = resolveDepartmentUserWorkspaceEvent({
        approvedCategoryDeletionIds: new Set<string>(),
        editorMode: "edit",
        event: {
            blockId: "category-block-1",
            oldJson: {
                fields: {
                    CATEGORY_ID: "cat-it",
                    CATEGORY_NAME: "ICT Equipment",
                },
                inputs: {
                    ITEMS: {
                        block: {
                            type: "item_block",
                        },
                    },
                },
                type: "category_block",
            },
            run: () => undefined,
            type: "delete",
        },
    });
    assert.equal(deleteResolution.shouldUndoDelete, true);
    assert.equal(deleteResolution.shouldPersistSnapshot, false);
    assert.equal(deleteResolution.shouldRecalculate, false);
    assert.equal(
        deleteResolution.categoryDeletionConfirmation?.message,
        "Remove ICT Equipment and all its items?",
    );
    const approvedDeleteResolution = resolveDepartmentUserWorkspaceEvent({
        approvedCategoryDeletionIds: new Set<string>(["category-block-1"]),
        editorMode: "edit",
        event: {
            blockId: "category-block-1",
            oldJson: {
                fields: {
                    CATEGORY_ID: "cat-it",
                    CATEGORY_NAME: "ICT Equipment",
                },
                inputs: {
                    ITEMS: {
                        block: {
                            type: "item_block",
                        },
                    },
                },
                type: "category_block",
            },
            run: () => undefined,
            type: "delete",
        },
    });
    assert.equal(approvedDeleteResolution.shouldUndoDelete, false);
    assert.equal(approvedDeleteResolution.shouldPersistSnapshot, true);
    assert.equal(approvedDeleteResolution.shouldQueueStructureRefresh, true);
    assert.equal(approvedDeleteResolution.shouldRecalculate, true);
    const finishedLoadingResolution = resolveDepartmentUserWorkspaceEvent({
        editorMode: "edit",
        event: {
            type: "finished_loading",
        },
    });
    assert.equal(finishedLoadingResolution.shouldRecalculate, true);
    assert.equal(finishedLoadingResolution.shouldPersistSnapshot, false);
    assert.equal(finishedLoadingResolution.shouldQueueStructureRefresh, true);
    const viewportResolution = resolveDepartmentUserWorkspaceEvent({
        editorMode: "edit",
        event: {
            scale: 0.95,
            type: "viewport_change",
            viewLeft: 120,
            viewTop: 80,
        },
    });
    assert.deepEqual(viewportResolution.viewportState, {
        scale: 0.95,
        viewLeft: 120,
        viewTop: 80,
    });
    completedTests.push("workspace event helpers now cover delete-confirmation interception, structural refresh, viewport persistence, and skip no-op hydration saves");

    const viewportStateKey = createDepartmentUserWorkspaceUiStateStorageKey({
        planId: "plan-123",
        userId: "du-user-1",
    });
    assert.equal(
        viewportStateKey,
        "procureline:blockly-ui:du-user-1:plan-123",
    );
    const serializedViewportState = serializeDepartmentUserWorkspaceUiState({
        scale: 0.95,
        viewLeft: 120,
        viewTop: 80,
    });
    assert.equal(
        parseDepartmentUserWorkspaceUiState(serializedViewportState)?.viewLeft,
        120,
    );
    assert.equal(parseDepartmentUserWorkspaceUiState("{bad json}"), null);
    const restoredViewportCalls: Array<[string, number, number?]> = [];
    assert.equal(
        restoreDepartmentUserWorkspaceUiState({
            state: parseDepartmentUserWorkspaceUiState(serializedViewportState),
            workspace: {
                scroll(left, top) {
                    restoredViewportCalls.push(["scroll", left, top]);
                },
                setScale(scale) {
                    restoredViewportCalls.push(["scale", scale]);
                },
            },
        }),
        true,
    );
    assert.deepEqual(restoredViewportCalls, [
        ["scale", 0.95],
        ["scroll", -120, -80],
    ]);
    completedTests.push("plan-local workspace viewport state now round-trips safely, restores the saved canvas position, and fails closed on malformed storage");

    const editInjectionOptions = buildDepartmentUserBlocklyInjectionOptions({
        editorMode: "edit",
        toolboxDefinition: { kind: "categoryToolbox" },
    });
    const viewInjectionOptions = buildDepartmentUserBlocklyInjectionOptions({
        editorMode: "view",
        toolboxDefinition: { kind: "categoryToolbox" },
    });
    assert.equal(editInjectionOptions.readOnly, false);
    assert.equal(editInjectionOptions.trashcan, true);
    assert.deepEqual(editInjectionOptions.toolbox, { kind: "categoryToolbox" });
    assert.deepEqual(editInjectionOptions.move, {
        drag: true,
        scrollbars: true,
        wheel: false,
    });
    assert.equal(editInjectionOptions.zoom.maxScale, 1.8);
    assert.equal(editInjectionOptions.zoom.minScale, 0.4);
    assert.equal(viewInjectionOptions.readOnly, true);
    assert.equal(viewInjectionOptions.trashcan, false);
    assert.deepEqual(viewInjectionOptions.toolbox, { kind: "categoryToolbox" });
    assert.deepEqual(viewInjectionOptions.move, {
        drag: true,
        scrollbars: true,
        wheel: false,
    });
    completedTests.push("workspace injection options now keep read-only plans non-destructive while preventing wheel-driven canvas jumps that made the editor feel unstable");

    const workspaceState = createBlocklyWorkspaceRecord({
        lastSavedAt: 100,
        lastSavedByUserId: "old-user",
        revision: 2,
        saveSource: "workspace_sync",
        workspaceJson: {
            blocks: {
                blocks: [
                    {
                        type: "department_block",
                        inputs: {
                            CATEGORIES: {
                                block: {
                                    type: "category_block",
                                    fields: {
                                        CATEGORY_ID: "cat-it",
                                        CATEGORY_NAME: "ICT Equipment",
                                    },
                                    inputs: {
                                        ITEMS: {
                                            block: {
                                                type: "item_block",
                                                fields: {
                                                    COMPLIANCE_FLAGS: "agpo,pwd",
                                                    ITEM_DESC: "Laptops",
                                                    ITEM_ID: "item-laptop",
                                                    Q1_QTY: 1,
                                                    Q2_QTY: 1,
                                                    Q3_QTY: 1,
                                                    Q4_QTY: 1,
                                                    UNIT_PRICE: 50_000,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
                languageVersion: 0,
            },
        },
    });
    const persistedWorkspaceState = buildPersistedDepartmentUserWorkspaceState({
        currentUserId: "du-user-1",
        savedAt: 999,
        workspaceState,
    });
    assert.ok(persistedWorkspaceState);
    assert.equal(persistedWorkspaceState.editorMetadata.lastSavedByUserId, "du-user-1");

    const workspaceSummary = calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord({
        items: [
            {
                categoryId: "cat-it",
                complianceFlags: ["agpo", "pwd"],
                description: "Portable computers",
                id: "item-laptop",
                name: "Laptops",
                procurementMethod: "RFQ",
                sourceOfFunds: "GOK",
                unitOfMeasurement: "each",
                unitPrice: 65_000,
            },
        ],
        totalBudget: 500_000,
        workspaceState,
    });
    assert.ok(workspaceSummary);
    assert.equal(workspaceSummary.departmentTotal, 200_000);
    assert.equal(workspaceSummary.complianceState.metrics[0]?.percent, 100);
    completedTests.push("saved Blockly JSON now preserves persisted pricing while still reporting the stored compliance posture");

    const refreshedWorkspaceSummary =
        calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord({
            items: [
                {
                    categoryId: "cat-it",
                    complianceFlags: ["agpo", "pwd"],
                    description: "Portable computers",
                    id: "item-laptop",
                    name: "Laptops",
                    procurementMethod: "RFQ",
                    sourceOfFunds: "GOK",
                    unitOfMeasurement: "each",
                    unitPrice: 65_000,
                },
            ],
            refreshCatalogMetadata: true,
            totalBudget: 500_000,
            workspaceState,
        });
    assert.ok(refreshedWorkspaceSummary);
    assert.equal(refreshedWorkspaceSummary.departmentTotal, 260_000);
    completedTests.push("workspace summary recomputation can still refresh against live catalog metadata when save validation needs it");

    const invalidSerializedWorkspaceSummary =
        calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord({
            items: [
                {
                    categoryId: "cat-it",
                    complianceFlags: ["agpo", "pwd"],
                    description: "Portable computers",
                    id: "item-laptop",
                    isActive: true,
                    maxQuantity: 2,
                    minQuantity: null,
                    name: "Laptops",
                    procurementMethod: "RFQ",
                    sourceOfFunds: "GOK",
                    unitOfMeasurement: "each",
                    unitPrice: 65_000,
                },
            ],
            refreshCatalogMetadata: true,
            totalBudget: 500_000,
            workspaceState: createBlocklyWorkspaceRecord({
                workspaceJson: {
                    blocks: {
                        blocks: [
                            {
                                type: "department_block",
                                inputs: {
                                    CATEGORIES: {
                                        block: {
                                            type: "category_block",
                                            fields: {
                                                CATEGORY_ID: "cat-it",
                                                CATEGORY_NAME: "ICT Equipment",
                                            },
                                            inputs: {
                                                ITEMS: {
                                                    block: {
                                                        type: "item_block",
                                                        fields: {
                                                            COMPLIANCE_FLAGS: "agpo,pwd",
                                                            ITEM_DESC: "Laptops",
                                                            ITEM_DESCRIPTION:
                                                                "Portable computers",
                                                            ITEM_ID: "item-laptop",
                                                            ITEM_IS_ACTIVE: "true",
                                                            MAX_QUANTITY: "2",
                                                            MIN_QUANTITY: "",
                                                            Q1_QTY: "9",
                                                            Q2_QTY: "0",
                                                            Q3_QTY: "0",
                                                            Q4_QTY: "0",
                                                            UNIT_OF_MEASUREMENT: "each",
                                                            UNIT_PRICE: 65_000,
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        ],
                        languageVersion: 0,
                    },
                },
            }),
        });
    assert.ok(invalidSerializedWorkspaceSummary);
    assert.equal(invalidSerializedWorkspaceSummary.departmentTotal, 130_000);
    assert.equal(
        invalidSerializedWorkspaceSummary.validationState.issues.some(
            (issue) =>
                issue.code === "maximum_quantity" &&
                issue.message === "Maximum quantity is 2",
        ),
        true,
    );
    assert.equal(
        invalidSerializedWorkspaceSummary.validationState.submitBlockedReasons.length,
        1,
    );
    assert.match(
        invalidSerializedWorkspaceSummary.validationState.submitBlockedReasons[0] ?? "",
        /Budget not fully utilized/i,
    );
    completedTests.push("serialized workspace revalidation now keeps normalization feedback visible after stale quantities are clamped during hydration");

    const draftSaveInput = buildDepartmentUserWorkspaceDraftSaveInput({
        categories: [{ id: "cat-it", name: "ICT Equipment" }],
        expectedWorkspaceVersion: 1,
        planId: "plan-123",
        selectedCategoryIds: ["cat-it"],
        summary: refreshedWorkspaceSummary,
        workspaceState,
    });
    assert.equal(draftSaveInput.estimatedBudgetUsed, 260_000);
    assert.equal(draftSaveInput.expectedWorkspaceVersion, 1);
    assert.equal(typeof draftSaveInput.workspaceState.workspaceJson, "string");

    const derivedPersistenceSummary = deriveDepartmentUserWorkspaceDraftPersistenceSummary({
        categories: [{ id: "cat-it", name: "ICT Equipment" }],
        items: [
            {
                categoryId: "cat-it",
                complianceFlags: ["agpo", "pwd"],
                description: "Portable computers",
                id: "item-laptop",
                name: "Laptops",
                procurementMethod: "RFQ",
                sourceOfFunds: "GOK",
                unitOfMeasurement: "each",
                unitPrice: 80_000,
            },
        ],
        totalBudget: 250_000,
        workspaceState,
    });
    assert.ok(derivedPersistenceSummary);
    assert.equal(derivedPersistenceSummary.estimatedBudgetUsed, 320_000);
    const persistencePatch = buildDepartmentUserWorkspaceDraftPersistencePatch({
        categories: [{ id: "cat-it", name: "ICT Equipment" }],
        currentUserId: "du-user-1",
        existingSelectedCategoryIds: ["cat-legacy"],
        items: [
            {
                categoryId: "cat-it",
                complianceFlags: ["agpo", "pwd"],
                description: "Portable computers",
                id: "item-laptop",
                name: "Laptops",
                procurementMethod: "RFQ",
                sourceOfFunds: "GOK",
                unitOfMeasurement: "each",
                unitPrice: 80_000,
            },
        ],
        savedAt: 1_234,
        totalBudget: 250_000,
        workspaceState,
    });
    assert.ok(persistencePatch);
    assert.deepEqual(persistencePatch.selectedCategoryIds, ["cat-legacy", "cat-it"]);
    assert.equal(
        buildDepartmentUserWorkspaceDraftPersistencePatch({
            categories: [{ id: "cat-it", name: "ICT Equipment" }],
            currentUserId: "du-user-1",
            existingSelectedCategoryIds: ["cat-legacy"],
            items: [],
            savedAt: 1_234,
            totalBudget: 0,
            workspaceState: "bad-record",
        }),
        null,
    );
    completedTests.push("server-side draft persistence now rejects malformed outer workspace records and rebuilds selected categories from persisted plus derived plan context");

    const persistedPlanFallback = buildDepartmentUserWorkspaceSummaryFromPersistedPlan({
        persistedPlanSummary: {
            categorySummaries: [
                {
                    amount: 200_000,
                    categoryId: "cat-it",
                    categoryName: "ICT Equipment",
                    itemCount: 1,
                },
            ],
            estimatedBudgetUsed: 200_000,
            itemCount: 1,
        },
        totalBudget: 500_000,
    });
    assert.equal(persistedPlanFallback.budgetState.usedAmount, 200_000);
    assert.equal(
        persistedPlanFallback.complianceState.metrics[0]?.status,
        "unavailable",
    );
    assert.equal(
        persistedPlanFallback.validationState.validationUnavailableReason,
        "Item-level validation details are unavailable for this saved summary until Blockly workspace data is reloaded.",
    );
    assert.equal(
        resolveDepartmentUserDisplayedWorkspaceSummary({
            persistedPlanSummary: {
                categorySummaries: [
                    {
                        amount: 200_000,
                        categoryId: "cat-it",
                        categoryName: "ICT Equipment",
                        itemCount: 1,
                    },
                ],
                estimatedBudgetUsed: 200_000,
                itemCount: 1,
            },
            totalBudget: 500_000,
            workspaceState: createBlocklyWorkspaceRecord(),
            workspaceSummary: calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord({
                items: [],
                totalBudget: 500_000,
                workspaceState: createBlocklyWorkspaceRecord(),
            }),
        })?.budgetState.usedAmount,
        200_000,
    );
    assert.equal(
        resolveDepartmentUserDisplayedWorkspaceSummary({
            persistedPlanSummary: {
                categorySummaries: [
                    {
                        amount: 200_000,
                        categoryId: "cat-it",
                        categoryName: "ICT Equipment",
                        itemCount: 1,
                    },
                ],
                estimatedBudgetUsed: 200_000,
                itemCount: 1,
            },
            totalBudget: 500_000,
            workspaceState: createBlocklyWorkspaceRecord({
                workspaceJson: {
                    blocks: {
                        blocks: [{ type: "department_block" }],
                        languageVersion: 0,
                    },
                },
            }),
            workspaceSummary: calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord({
                items: [],
                totalBudget: 500_000,
                workspaceState: createBlocklyWorkspaceRecord({
                    workspaceJson: {
                        blocks: {
                            blocks: [{ type: "department_block" }],
                            languageVersion: 0,
                        },
                    },
                }),
            }),
        })?.budgetState.usedAmount,
        200_000,
    );
    completedTests.push("persisted plan fallbacks now keep reopened read-only budget totals truthful when Blockly workspace structure is missing");

    const persistedPlanSummaryForEditor = {
        categorySummaries: [
            {
                amount: 200_000,
                categoryId: "cat-it",
                categoryName: "ICT Equipment",
                itemCount: 1,
            },
        ],
        estimatedBudgetUsed: 200_000,
        itemCount: 1,
    } as const;
    assert.deepEqual(
        getPersistedPlanSummaryForWorkspaceSummaryChange({
            allowEditModePersistedFallback: true,
            mode: "edit",
            persistedPlanSummary: persistedPlanSummaryForEditor,
        }),
        persistedPlanSummaryForEditor,
    );
    assert.equal(
        getPersistedPlanSummaryForWorkspaceSummaryChange({
            allowEditModePersistedFallback: false,
            mode: "edit",
            persistedPlanSummary: persistedPlanSummaryForEditor,
        }),
        null,
    );
    completedTests.push("editable legacy plans keep persisted totals for the first hydration pass without overriding later live workspace edits");

    const persistencePreparation = prepareDepartmentUserWorkspaceDraftPersistence({
        accessMode: "editable",
        categories: [
            {
                id: "cat-it",
                name: "ICT Equipment",
            },
            {
                id: "cat-legacy",
                name: "Legacy Category",
            },
        ],
        categoryDocs: [
            {
                _id: "cat-it" as never,
                name: "ICT Equipment",
            },
            {
                _id: "cat-legacy" as never,
                name: "Legacy Category",
            },
        ],
        currentUserId: "du-user-1",
        existingSelectedCategoryIds: ["cat-legacy" as never],
        items: [
            {
                categoryId: "cat-it",
                complianceFlags: ["agpo", "pwd"],
                description: "Portable computers",
                id: "item-laptop",
                name: "Laptops",
                procurementMethod: "RFQ",
                sourceOfFunds: "GOK",
                unitOfMeasurement: "each",
                unitPrice: 80_000,
            },
        ],
        planStatus: "draft",
        persistedWorkspaceState: createBlocklyWorkspaceRecord({
            revision: 1,
            saveSource: "workspace_sync",
        }),
        totalBudget: 250_000,
        workspaceState,
    });
    assert.equal(persistencePreparation.ok, true);
    assert.equal(persistencePreparation.patch.estimatedBudgetUsed, 320_000);
    assert.equal(persistencePreparation.patch.itemCount, 1);
    assert.deepEqual(persistencePreparation.patch.selectedCategoryIds, [
        "cat-legacy",
        "cat-it",
    ]);
    assert.deepEqual(persistencePreparation.patch.categorySummaries, [
        {
            amount: 320_000,
            categoryId: "cat-it",
            categoryName: "ICT Equipment",
            itemCount: 1,
        },
    ]);
    assert.deepEqual(
        prepareDepartmentUserWorkspaceDraftPersistence({
            accessMode: null,
            categories: [
                {
                    id: "cat-it",
                    name: "ICT Equipment",
                },
            ],
            categoryDocs: [
                {
                    _id: "cat-it" as never,
                    name: "ICT Equipment",
                },
            ],
            currentUserId: "du-user-1",
            existingSelectedCategoryIds: [],
            items: [
                {
                    categoryId: "cat-it",
                    complianceFlags: ["agpo", "pwd"],
                    description: "Portable computers",
                    id: "item-laptop",
                    name: "Laptops",
                    procurementMethod: "RFQ",
                    sourceOfFunds: "GOK",
                    unitOfMeasurement: "each",
                    unitPrice: 80_000,
                },
            ],
            planStatus: "submitted",
            persistedWorkspaceState: createBlocklyWorkspaceRecord({
                revision: 1,
                saveSource: "workspace_sync",
            }),
            totalBudget: 250_000,
            workspaceState,
        }),
        {
            code: "UNAUTHORIZED",
            message:
                "This plan is no longer editable from the current Department User session.",
            ok: false,
        },
    );
    completedTests.push("the shared Convex draft-save path now patches recomputed totals and rebuilt category ids instead of trusting stale client payloads");

    const safeAnnouncement = getDepartmentUserWorkspaceAnnouncement(workspaceSummary);
    const overBudgetAnnouncement = getDepartmentUserWorkspaceAnnouncement(
        derivedPersistenceSummary.workspaceSummary,
    );
    const unavailableValidationAnnouncement = getDepartmentUserWorkspaceAnnouncement(
        persistedPlanFallback,
    );
    assert.notEqual(safeAnnouncement.key, overBudgetAnnouncement.key);
    assert.match(
        unavailableValidationAnnouncement.message,
        /Item-level validation details are unavailable/i,
    );
    assert.equal(
        getDepartmentUserReservedSubmitState({
            budgetState: overBudget,
            mode: "edit",
        }).label,
        "Over Budget - Cannot Submit",
    );
    completedTests.push("meaningful announcement keys and truthful reserved submit labels now track budget threshold changes");

    const snapshot = createSerializedBlocklyWorkspaceSnapshot({
        Blockly: {
            serialization: {
                workspaces: {
                    save() {
                        return {
                            blocks: {
                                blocks: [{ id: "dept-1", type: "department_block" }],
                                languageVersion: 0,
                            },
                        };
                    },
                },
            },
        } as never,
        currentUserId: "du-user-2",
        previousRecord: workspaceState,
        workspace: {} as never,
    });
    assert.equal(snapshot.editorMetadata.revision, 3);
    assert.equal(
        normalizeBlocklyWorkspaceRecord("bad-record").editorMetadata.saveSource,
        "workspace_seed",
    );
    completedTests.push("Blockly serialization helpers still preserve revision tracking and fail closed to seeded workspaces");

    return completedTests;
}
