"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDepartmentUserBlocklyWorkspaceTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const blockly_serialization_1 = require("../lib/blockly/blockly-serialization");
const du_toolbox_1 = require("../lib/blockly/du-toolbox");
const workspace_ui_state_1 = require("../lib/blockly/workspace-ui-state");
const workspace_events_1 = require("../lib/blockly/workspace-events");
const workspace_runtime_1 = require("../lib/blockly/workspace-runtime");
const du_workspace_calculations_1 = require("../lib/blockly/du-workspace-calculations");
const workspace_save_1 = require("../lib/blockly/workspace-save");
const workspace_catalog_identity_1 = require("../lib/blockly/workspace-catalog-identity");
const du_editor_fallback_1 = require("../lib/blockly/du-editor-fallback");
class TestBlock {
    type;
    fields = new Map();
    inputs = new Map();
    nextBlock = null;
    __duQuantityFeedback;
    id;
    warningText = null;
    svgGroup_ = {
        classList: {
            classes: new Set(),
            toggle: (className, force) => {
                if (force ?? !this.svgGroup_.classList.classes.has(className)) {
                    this.svgGroup_.classList.classes.add(className);
                    return;
                }
                this.svgGroup_.classList.classes.delete(className);
            },
        },
    };
    constructor(type, initialFields = {}) {
        this.type = type;
        for (const [key, value] of Object.entries(initialFields)) {
            this.fields.set(key, value);
        }
    }
    getFieldValue(name) {
        return this.fields.get(name) ?? "";
    }
    getInput(name) {
        const targetBlock = this.inputs.get(name) ?? null;
        return { connection: { targetBlock: () => targetBlock } };
    }
    getNextBlock() {
        return this.nextBlock;
    }
    linkInput(name, block) {
        this.inputs.set(name, block);
        return this;
    }
    linkNext(block) {
        this.nextBlock = block;
        return this;
    }
    setFieldValue(value, name) {
        this.fields.set(name, value);
    }
    setWarningText(value) {
        this.warningText = value;
    }
}
async function runDepartmentUserBlocklyWorkspaceTests() {
    const completedTests = [];
    const itemRollup = (0, du_workspace_calculations_1.calculateDepartmentUserItemRollup)({
        complianceFlags: ["agpo"],
        itemDescription: "Laptops",
        itemId: "item-1",
        quantities: { q1: 1, q2: 2, q3: 0, q4: 1 },
        unitPrice: 50_000,
    });
    strict_1.default.equal(itemRollup.totalCost, 200_000);
    strict_1.default.equal(itemRollup.totalQuantity, 4);
    completedTests.push("department-user item rollups preserve quarterly quantity and cost totals");
    const departmentRollup = (0, du_workspace_calculations_1.calculateDepartmentUserDepartmentRollup)([
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
    strict_1.default.equal(departmentRollup.departmentTotal, 260_000);
    completedTests.push("department-user department rollups keep category and department totals aligned");
    const unallocatedBudget = (0, du_workspace_calculations_1.mapDepartmentUserBudgetMeterState)({
        totalBudget: null,
        usedAmount: 150_000,
    });
    const overBudget = (0, du_workspace_calculations_1.mapDepartmentUserBudgetMeterState)({
        totalBudget: 1_000_000,
        usedAmount: 1_150_000,
    });
    strict_1.default.equal(unallocatedBudget.state, "unallocated");
    strict_1.default.equal(overBudget.state, "over_budget");
    strict_1.default.equal(overBudget.overBudgetAmount, 150_000);
    strict_1.default.match(overBudget.bannerText ?? "", /Budget exceeded by/i);
    completedTests.push("budget meter state now carries truthful unallocated and over-budget messaging");
    const categorySelection = (0, du_toolbox_1.sanitizeDepartmentUserWorkspaceCategorySelection)({
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
    strict_1.default.deepEqual(categorySelection.sanitizedCategoryIds, ["cat-it"]);
    completedTests.push("workspace category selection still filters out categories without active catalog items");
    const toolbox = (0, du_toolbox_1.buildDepartmentUserToolbox)({
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
    const toolboxContents = toolbox.toolboxDefinition.contents;
    strict_1.default.deepEqual(toolbox.sanitizedCategoryIds, ["cat-office", "cat-it"]);
    strict_1.default.equal(toolboxContents.length, 2);
    strict_1.default.equal(toolboxContents[1]?.name, "Office Supplies");
    strict_1.default.equal(toolbox.categoryStates[0]?.id, "cat-office");
    strict_1.default.equal(toolbox.categoryStates[1]?.isUsedOnWorkspace, true);
    strict_1.default.equal(toolboxContents.some((content) => content.name === "ICT Equipment"), false);
    completedTests.push("department-user toolbox generation now preserves PO-managed category order and hides used item source blocks by stable ids");
    const categorySearchToolbox = (0, du_toolbox_1.buildDepartmentUserToolbox)({
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
    const officeCategory = categorySearchToolbox.toolboxDefinition.contents[1];
    strict_1.default.equal((officeCategory?.contents).length, 1);
    strict_1.default.equal((officeCategory?.contents)[0]?.type, "category_block");
    completedTests.push("category-name toolbox search keeps the source block visible without repopulating non-matching item blocks");
    const itemSearchToolbox = (0, du_toolbox_1.buildDepartmentUserToolbox)({
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
    const searchedCategory = itemSearchToolbox.toolboxDefinition.contents[1];
    strict_1.default.equal(searchedCategory?.contents?.length ?? 0, 0);
    strict_1.default.equal(itemSearchToolbox.categoryStates[0]?.matchingItemCount, 0);
    completedTests.push("toolbox search now stays anchored to item ids so already-used matching items do not leak back into category flyouts");
    const categoryUsage = (0, workspace_catalog_identity_1.collectDepartmentUserWorkspaceSourceUsage)({
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
        workspaceState: (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
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
    strict_1.default.deepEqual(categoryUsage.categoryIds, ["cat-office", "cat-it"]);
    strict_1.default.deepEqual(categoryUsage.itemIds, ["item-office"]);
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
    const liveSourceUsage = (0, workspace_catalog_identity_1.collectDepartmentUserWorkspaceSourceUsageFromDepartmentBlock)({
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
    strict_1.default.deepEqual(liveSourceUsage, {
        categoryIds: ["cat-office"],
        itemIds: ["item-office"],
    });
    completedTests.push("workspace source-usage refresh can now read the live Blockly chain without reserializing the full workspace");
    const resolvedItem = (0, workspace_catalog_identity_1.resolveDepartmentUserItemCatalogIdentity)({
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
    strict_1.default.equal(resolvedItem?.id, "item-laptop");
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
    (0, workspace_catalog_identity_1.synchronizeDepartmentUserWorkspaceCatalogIdentity)({
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
    strict_1.default.equal(itemBlock.getFieldValue("ITEM_ID"), "item-laptop");
    strict_1.default.equal(itemBlock.getFieldValue("COMPLIANCE_FLAGS"), "agpo,pwd");
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
    const liveSummary = (0, du_workspace_calculations_1.applyDepartmentWorkspaceRollup)({
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
    strict_1.default.equal(liveSummary?.budgetState.state, "over_budget");
    strict_1.default.equal(liveRollupDepartment.svgGroup_.classList.classes.has("dept-block-budget-over"), true);
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
    const liveValidationSummary = (0, du_workspace_calculations_1.applyDepartmentWorkspaceRollup)({
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
    strict_1.default.ok(liveValidationSummary);
    strict_1.default.equal(liveValidationItem.warningText, "Maximum quantity is 6");
    strict_1.default.deepEqual(liveValidationSummary.validationState.submitBlockedReasons, []);
    completedTests.push("live Blockly validation feedback now preserves one-cycle inline quantity warnings after the field normalizes bad input");
    const emptyCategoryDepartment = new TestBlock("department_block");
    const emptyCategoryBlock = new TestBlock("category_block", {
        CATEGORY_ID: "cat-empty",
        CATEGORY_NAME: "Empty Category",
    });
    emptyCategoryDepartment.linkInput("CATEGORIES", emptyCategoryBlock);
    const emptyCategorySummary = (0, du_workspace_calculations_1.applyDepartmentWorkspaceRollup)({
        departmentBlock: emptyCategoryDepartment,
        items: [],
        totalBudget: 100_000,
    });
    strict_1.default.ok(emptyCategorySummary);
    strict_1.default.equal(emptyCategoryBlock.getFieldValue("CATEGORY_EMPTY_STATE"), "Drag items here");
    completedTests.push("category rollups now expose the empty-state hint directly on empty category blocks");
    const deletionConfirmation = (0, workspace_events_1.getDepartmentUserCategoryDeletionConfirmation)({
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
    strict_1.default.deepEqual(deletionConfirmation, {
        blockId: "category-block-1",
        categoryId: "cat-it",
        categoryName: "ICT Equipment",
        itemCount: 1,
        message: "Remove ICT Equipment and all its items?",
    });
    strict_1.default.equal((0, workspace_events_1.shouldRefreshDepartmentUserToolboxForEvent)({ type: "move" }), true);
    strict_1.default.equal((0, workspace_events_1.shouldRefreshDepartmentUserToolboxForEvent)({ type: "change" }), false);
    const deleteResolution = (0, workspace_events_1.resolveDepartmentUserWorkspaceEvent)({
        approvedCategoryDeletionIds: new Set(),
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
    strict_1.default.equal(deleteResolution.shouldUndoDelete, true);
    strict_1.default.equal(deleteResolution.shouldPersistSnapshot, false);
    strict_1.default.equal(deleteResolution.shouldRecalculate, false);
    strict_1.default.equal(deleteResolution.categoryDeletionConfirmation?.message, "Remove ICT Equipment and all its items?");
    const approvedDeleteResolution = (0, workspace_events_1.resolveDepartmentUserWorkspaceEvent)({
        approvedCategoryDeletionIds: new Set(["category-block-1"]),
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
    strict_1.default.equal(approvedDeleteResolution.shouldUndoDelete, false);
    strict_1.default.equal(approvedDeleteResolution.shouldPersistSnapshot, true);
    strict_1.default.equal(approvedDeleteResolution.shouldQueueStructureRefresh, true);
    strict_1.default.equal(approvedDeleteResolution.shouldRecalculate, true);
    const finishedLoadingResolution = (0, workspace_events_1.resolveDepartmentUserWorkspaceEvent)({
        editorMode: "edit",
        event: {
            type: "finished_loading",
        },
    });
    strict_1.default.equal(finishedLoadingResolution.shouldRecalculate, true);
    strict_1.default.equal(finishedLoadingResolution.shouldPersistSnapshot, false);
    strict_1.default.equal(finishedLoadingResolution.shouldQueueStructureRefresh, true);
    const viewportResolution = (0, workspace_events_1.resolveDepartmentUserWorkspaceEvent)({
        editorMode: "edit",
        event: {
            scale: 0.95,
            type: "viewport_change",
            viewLeft: 120,
            viewTop: 80,
        },
    });
    strict_1.default.deepEqual(viewportResolution.viewportState, {
        scale: 0.95,
        viewLeft: 120,
        viewTop: 80,
    });
    completedTests.push("workspace event helpers now cover delete-confirmation interception, structural refresh, viewport persistence, and skip no-op hydration saves");
    const viewportStateKey = (0, workspace_ui_state_1.createDepartmentUserWorkspaceUiStateStorageKey)({
        planId: "plan-123",
        userId: "du-user-1",
    });
    strict_1.default.equal(viewportStateKey, "procureline:blockly-ui:du-user-1:plan-123");
    const serializedViewportState = (0, workspace_ui_state_1.serializeDepartmentUserWorkspaceUiState)({
        scale: 0.95,
        viewLeft: 120,
        viewTop: 80,
    });
    strict_1.default.equal((0, workspace_ui_state_1.parseDepartmentUserWorkspaceUiState)(serializedViewportState)?.viewLeft, 120);
    strict_1.default.equal((0, workspace_ui_state_1.parseDepartmentUserWorkspaceUiState)("{bad json}"), null);
    const restoredViewportCalls = [];
    strict_1.default.equal((0, workspace_ui_state_1.restoreDepartmentUserWorkspaceUiState)({
        state: (0, workspace_ui_state_1.parseDepartmentUserWorkspaceUiState)(serializedViewportState),
        workspace: {
            scroll(left, top) {
                restoredViewportCalls.push(["scroll", left, top]);
            },
            setScale(scale) {
                restoredViewportCalls.push(["scale", scale]);
            },
        },
    }), true);
    strict_1.default.deepEqual(restoredViewportCalls, [
        ["scale", 0.95],
        ["scroll", -120, -80],
    ]);
    completedTests.push("plan-local workspace viewport state now round-trips safely, restores the saved canvas position, and fails closed on malformed storage");
    const editInjectionOptions = (0, workspace_runtime_1.buildDepartmentUserBlocklyInjectionOptions)({
        editorMode: "edit",
        toolboxDefinition: { kind: "categoryToolbox" },
    });
    const viewInjectionOptions = (0, workspace_runtime_1.buildDepartmentUserBlocklyInjectionOptions)({
        editorMode: "view",
        toolboxDefinition: { kind: "categoryToolbox" },
    });
    strict_1.default.equal(editInjectionOptions.readOnly, false);
    strict_1.default.equal(editInjectionOptions.trashcan, true);
    strict_1.default.deepEqual(editInjectionOptions.toolbox, { kind: "categoryToolbox" });
    strict_1.default.deepEqual(editInjectionOptions.move, {
        drag: true,
        scrollbars: true,
        wheel: true,
    });
    strict_1.default.equal(editInjectionOptions.zoom.maxScale, 1.8);
    strict_1.default.equal(editInjectionOptions.zoom.minScale, 0.4);
    strict_1.default.equal(viewInjectionOptions.readOnly, true);
    strict_1.default.equal(viewInjectionOptions.trashcan, false);
    strict_1.default.deepEqual(viewInjectionOptions.toolbox, { kind: "categoryToolbox" });
    strict_1.default.deepEqual(viewInjectionOptions.move, {
        drag: true,
        scrollbars: true,
        wheel: true,
    });
    completedTests.push("workspace injection options now keep read-only plans non-destructive while preserving native toolbox browsing and panning affordances");
    const workspaceState = (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
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
    const persistedWorkspaceState = (0, workspace_save_1.buildPersistedDepartmentUserWorkspaceState)({
        currentUserId: "du-user-1",
        savedAt: 999,
        workspaceState,
    });
    strict_1.default.ok(persistedWorkspaceState);
    strict_1.default.equal(persistedWorkspaceState.editorMetadata.lastSavedByUserId, "du-user-1");
    const workspaceSummary = (0, du_workspace_calculations_1.calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord)({
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
    strict_1.default.ok(workspaceSummary);
    strict_1.default.equal(workspaceSummary.departmentTotal, 200_000);
    strict_1.default.equal(workspaceSummary.complianceState.metrics[0]?.percent, 100);
    completedTests.push("saved Blockly JSON now preserves persisted pricing while still reporting the stored compliance posture");
    const refreshedWorkspaceSummary = (0, du_workspace_calculations_1.calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord)({
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
    strict_1.default.ok(refreshedWorkspaceSummary);
    strict_1.default.equal(refreshedWorkspaceSummary.departmentTotal, 260_000);
    completedTests.push("workspace summary recomputation can still refresh against live catalog metadata when save validation needs it");
    const invalidSerializedWorkspaceSummary = (0, du_workspace_calculations_1.calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord)({
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
        workspaceState: (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
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
                                                        ITEM_DESCRIPTION: "Portable computers",
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
    strict_1.default.ok(invalidSerializedWorkspaceSummary);
    strict_1.default.equal(invalidSerializedWorkspaceSummary.departmentTotal, 130_000);
    strict_1.default.equal(invalidSerializedWorkspaceSummary.validationState.issues.some((issue) => issue.code === "maximum_quantity" &&
        issue.message === "Maximum quantity is 2"), true);
    strict_1.default.deepEqual(invalidSerializedWorkspaceSummary.validationState.submitBlockedReasons, []);
    completedTests.push("serialized workspace revalidation now keeps normalization feedback visible after stale quantities are clamped during hydration");
    const draftSaveInput = (0, workspace_save_1.buildDepartmentUserWorkspaceDraftSaveInput)({
        categories: [{ id: "cat-it", name: "ICT Equipment" }],
        planId: "plan-123",
        selectedCategoryIds: ["cat-it"],
        summary: refreshedWorkspaceSummary,
        workspaceState,
    });
    strict_1.default.equal(draftSaveInput.estimatedBudgetUsed, 260_000);
    const derivedPersistenceSummary = (0, workspace_save_1.deriveDepartmentUserWorkspaceDraftPersistenceSummary)({
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
    strict_1.default.ok(derivedPersistenceSummary);
    strict_1.default.equal(derivedPersistenceSummary.estimatedBudgetUsed, 320_000);
    const persistencePatch = (0, workspace_save_1.buildDepartmentUserWorkspaceDraftPersistencePatch)({
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
    strict_1.default.ok(persistencePatch);
    strict_1.default.deepEqual(persistencePatch.selectedCategoryIds, ["cat-legacy", "cat-it"]);
    strict_1.default.equal((0, workspace_save_1.buildDepartmentUserWorkspaceDraftPersistencePatch)({
        categories: [{ id: "cat-it", name: "ICT Equipment" }],
        currentUserId: "du-user-1",
        existingSelectedCategoryIds: ["cat-legacy"],
        items: [],
        savedAt: 1_234,
        totalBudget: 0,
        workspaceState: "bad-record",
    }), null);
    completedTests.push("server-side draft persistence now rejects malformed outer workspace records and rebuilds selected categories from persisted plus derived plan context");
    const persistedPlanFallback = (0, du_workspace_calculations_1.buildDepartmentUserWorkspaceSummaryFromPersistedPlan)({
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
    strict_1.default.equal(persistedPlanFallback.budgetState.usedAmount, 200_000);
    strict_1.default.equal(persistedPlanFallback.complianceState.metrics[0]?.status, "unavailable");
    strict_1.default.equal(persistedPlanFallback.validationState.validationUnavailableReason, "Item-level validation details are unavailable for this saved summary until Blockly workspace data is reloaded.");
    strict_1.default.equal((0, du_workspace_calculations_1.resolveDepartmentUserDisplayedWorkspaceSummary)({
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
        workspaceState: (0, blockly_serialization_1.createBlocklyWorkspaceRecord)(),
        workspaceSummary: (0, du_workspace_calculations_1.calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord)({
            items: [],
            totalBudget: 500_000,
            workspaceState: (0, blockly_serialization_1.createBlocklyWorkspaceRecord)(),
        }),
    })?.budgetState.usedAmount, 200_000);
    strict_1.default.equal((0, du_workspace_calculations_1.resolveDepartmentUserDisplayedWorkspaceSummary)({
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
        workspaceState: (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
            workspaceJson: {
                blocks: {
                    blocks: [{ type: "department_block" }],
                    languageVersion: 0,
                },
            },
        }),
        workspaceSummary: (0, du_workspace_calculations_1.calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord)({
            items: [],
            totalBudget: 500_000,
            workspaceState: (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
                workspaceJson: {
                    blocks: {
                        blocks: [{ type: "department_block" }],
                        languageVersion: 0,
                    },
                },
            }),
        }),
    })?.budgetState.usedAmount, 200_000);
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
    };
    strict_1.default.deepEqual((0, du_editor_fallback_1.getPersistedPlanSummaryForWorkspaceSummaryChange)({
        allowEditModePersistedFallback: true,
        mode: "edit",
        persistedPlanSummary: persistedPlanSummaryForEditor,
    }), persistedPlanSummaryForEditor);
    strict_1.default.equal((0, du_editor_fallback_1.getPersistedPlanSummaryForWorkspaceSummaryChange)({
        allowEditModePersistedFallback: false,
        mode: "edit",
        persistedPlanSummary: persistedPlanSummaryForEditor,
    }), null);
    completedTests.push("editable legacy plans keep persisted totals for the first hydration pass without overriding later live workspace edits");
    const persistencePreparation = (0, workspace_save_1.prepareDepartmentUserWorkspaceDraftPersistence)({
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
                _id: "cat-it",
                name: "ICT Equipment",
            },
            {
                _id: "cat-legacy",
                name: "Legacy Category",
            },
        ],
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
        planStatus: "draft",
        persistedWorkspaceState: (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
            revision: 1,
            saveSource: "workspace_sync",
        }),
        totalBudget: 250_000,
        workspaceState,
    });
    strict_1.default.equal(persistencePreparation.ok, true);
    strict_1.default.equal(persistencePreparation.patch.estimatedBudgetUsed, 320_000);
    strict_1.default.equal(persistencePreparation.patch.itemCount, 1);
    strict_1.default.deepEqual(persistencePreparation.patch.selectedCategoryIds, [
        "cat-legacy",
        "cat-it",
    ]);
    strict_1.default.deepEqual(persistencePreparation.patch.categorySummaries, [
        {
            amount: 320_000,
            categoryId: "cat-it",
            categoryName: "ICT Equipment",
            itemCount: 1,
        },
    ]);
    strict_1.default.deepEqual((0, workspace_save_1.prepareDepartmentUserWorkspaceDraftPersistence)({
        accessMode: null,
        categories: [
            {
                id: "cat-it",
                name: "ICT Equipment",
            },
        ],
        categoryDocs: [
            {
                _id: "cat-it",
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
        persistedWorkspaceState: (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
            revision: 1,
            saveSource: "workspace_sync",
        }),
        totalBudget: 250_000,
        workspaceState,
    }), {
        code: "UNAUTHORIZED",
        message: "This plan is no longer editable from the current Department User session.",
        ok: false,
    });
    completedTests.push("the shared Convex draft-save path now patches recomputed totals and rebuilt category ids instead of trusting stale client payloads");
    const safeAnnouncement = (0, du_workspace_calculations_1.getDepartmentUserWorkspaceAnnouncement)(workspaceSummary);
    const overBudgetAnnouncement = (0, du_workspace_calculations_1.getDepartmentUserWorkspaceAnnouncement)(derivedPersistenceSummary.workspaceSummary);
    const unavailableValidationAnnouncement = (0, du_workspace_calculations_1.getDepartmentUserWorkspaceAnnouncement)(persistedPlanFallback);
    strict_1.default.notEqual(safeAnnouncement.key, overBudgetAnnouncement.key);
    strict_1.default.match(unavailableValidationAnnouncement.message, /Item-level validation details are unavailable/i);
    strict_1.default.equal((0, du_workspace_calculations_1.getDepartmentUserReservedSubmitState)({
        budgetState: overBudget,
        mode: "edit",
    }).label, "Over Budget - Cannot Submit");
    completedTests.push("meaningful announcement keys and truthful reserved submit labels now track budget threshold changes");
    const snapshot = (0, workspace_save_1.createSerializedBlocklyWorkspaceSnapshot)({
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
        },
        currentUserId: "du-user-2",
        previousRecord: workspaceState,
        workspace: {},
    });
    strict_1.default.equal(snapshot.editorMetadata.revision, 3);
    strict_1.default.equal((0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)("bad-record").editorMetadata.saveSource, "workspace_seed");
    completedTests.push("Blockly serialization helpers still preserve revision tracking and fail closed to seeded workspaces");
    return completedTests;
}
exports.runDepartmentUserBlocklyWorkspaceTests = runDepartmentUserBlocklyWorkspaceTests;
