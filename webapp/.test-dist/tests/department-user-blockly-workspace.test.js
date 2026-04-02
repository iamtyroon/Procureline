"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDepartmentUserBlocklyWorkspaceTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const blockly_serialization_1 = require("../lib/blockly/blockly-serialization");
const editor_contract_1 = require("../lib/blockly/editor-contract");
const du_plan_routes_1 = require("../lib/blockly/du-plan-routes");
const du_toolbox_1 = require("../lib/blockly/du-toolbox");
const du_workspace_calculations_1 = require("../lib/blockly/du-workspace-calculations");
const workspace_save_1 = require("../lib/blockly/workspace-save");
const workspace_catalog_identity_1 = require("../lib/blockly/workspace-catalog-identity");
class TestBlock {
    type;
    fields = new Map();
    inputs = new Map();
    nextBlock = null;
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
        return {
            connection: {
                targetBlock: () => targetBlock,
            },
        };
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
}
function runDepartmentUserBlocklyWorkspaceTests() {
    const completedTests = [];
    const itemRollup = (0, du_workspace_calculations_1.calculateDepartmentUserItemRollup)({
        itemDescription: "Laptops",
        quantities: {
            q1: 1,
            q2: 2,
            q3: 0,
            q4: 1,
        },
        unitPrice: 50_000,
    });
    strict_1.default.equal(itemRollup.totalQuantity, 4);
    strict_1.default.equal(itemRollup.totalCost, 200_000);
    strict_1.default.deepEqual(itemRollup.quarterTotals, {
        q1: 50_000,
        q2: 100_000,
        q3: 0,
        q4: 50_000,
    });
    completedTests.push("department-user Blockly item rollups keep quarterly totals, total quantity, and total cost aligned with the prototype traversal model");
    const categoryRollup = (0, du_workspace_calculations_1.calculateDepartmentUserCategoryRollup)({
        categoryId: "cat-it",
        categoryName: "ICT Equipment",
        items: [
            {
                itemDescription: "Laptops",
                quantities: { q1: 1, q2: 2, q3: 0, q4: 1 },
                unitPrice: 50_000,
            },
            {
                itemDescription: "Printers",
                quantities: { q1: 0, q2: 1, q3: 1, q4: 0 },
                unitPrice: 25_000,
            },
        ],
    });
    strict_1.default.equal(categoryRollup.itemCount, 2);
    strict_1.default.equal(categoryRollup.totalCost, 250_000);
    strict_1.default.deepEqual(categoryRollup.quarterTotals, {
        q1: 50_000,
        q2: 125_000,
        q3: 25_000,
        q4: 50_000,
    });
    const departmentRollup = (0, du_workspace_calculations_1.calculateDepartmentUserDepartmentRollup)([
        {
            categoryId: "cat-it",
            categoryName: "ICT Equipment",
            items: [
                {
                    itemDescription: "Laptops",
                    quantities: { q1: 1, q2: 2, q3: 0, q4: 1 },
                    unitPrice: 50_000,
                },
            ],
        },
        {
            categoryId: "cat-office",
            categoryName: "Office Supplies",
            items: [
                {
                    itemDescription: "Paper",
                    quantities: { q1: 10, q2: 10, q3: 10, q4: 10 },
                    unitPrice: 500,
                },
            ],
        },
    ]);
    strict_1.default.equal(departmentRollup.totalItemCount, 2);
    strict_1.default.equal(departmentRollup.departmentTotal, 220_000);
    completedTests.push("department-user Blockly category and department rollups aggregate item costs without collapsing quarterly detail");
    strict_1.default.deepEqual((0, du_workspace_calculations_1.mapDepartmentUserBudgetMeterState)({
        totalBudget: null,
        usedAmount: 150_000,
    }), {
        remainingBudget: null,
        state: "unallocated",
        totalBudget: null,
        usedAmount: 150_000,
        usedPercent: null,
    });
    strict_1.default.equal((0, du_workspace_calculations_1.mapDepartmentUserBudgetMeterState)({
        totalBudget: 1_000_000,
        usedAmount: 850_000,
    }).state, "warning");
    strict_1.default.equal((0, du_workspace_calculations_1.mapDepartmentUserBudgetMeterState)({
        totalBudget: 1_000_000,
        usedAmount: 1_150_000,
    }).state, "over_budget");
    completedTests.push("department-user budget meter states distinguish unallocated, warning, and over-budget cases without divide-by-zero math");
    const categorySelection = (0, du_toolbox_1.sanitizeDepartmentUserWorkspaceCategorySelection)({
        categories: [
            { color: "#0B6E4F", icon: "cpu", id: "cat-it", isActive: true, name: "ICT Equipment", sortOrder: 1 },
            { color: "#4A90D9", icon: "boxes", id: "cat-office", isActive: true, name: "Office Supplies", sortOrder: 2 },
            { color: "#7A7A7A", icon: "archive", id: "cat-archived", isActive: false, name: "Archived", sortOrder: 3 },
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
            {
                categoryId: "cat-office",
                description: "Inactive paper",
                id: "item-2",
                isActive: false,
                name: "Paper",
                procurementMethod: "RFQ",
                sortOrder: 2,
                sourceOfFunds: "GOK",
                unitOfMeasurement: "Ream",
                unitPrice: 500,
            },
        ],
        requestedCategoryIds: ["cat-it", "cat-it", "cat-office", "cat-archived", "cat-missing"],
    });
    strict_1.default.deepEqual(categorySelection.sanitizedCategoryIds, ["cat-it"]);
    strict_1.default.deepEqual(categorySelection.unavailableCategories, [
        {
            id: "cat-office",
            name: "Office Supplies",
            reason: "No active catalog items are available in this category yet.",
        },
    ]);
    completedTests.push("department-user workspace category sanitization drops duplicates, inactive ids, missing ids, and empty categories before the toolbox is built");
    const preservedCategorySelection = (0, du_toolbox_1.sanitizeDepartmentUserWorkspaceCategorySelection)({
        categories: [
            { color: "#0B6E4F", icon: "cpu", id: "cat-it", isActive: true, name: "ICT Equipment", sortOrder: 1 },
            { color: "#7A7A7A", icon: "archive", id: "cat-archived", isActive: false, name: "Archived", sortOrder: 2 },
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
        preserveUnavailableRequestedCategories: true,
        requestedCategoryIds: ["cat-it", "cat-archived"],
    });
    strict_1.default.deepEqual(preservedCategorySelection.sanitizedCategoryIds, ["cat-it", "cat-archived"]);
    strict_1.default.match(preservedCategorySelection.unavailableCategories[0]?.reason ?? "", /existing plans/i);
    completedTests.push("department-user workspace selection can preserve archived requested categories for existing plans while still flagging them as unavailable for new planning");
    const toolbox = (0, du_toolbox_1.buildDepartmentUserToolbox)({
        categories: [
            { color: "#0B6E4F", icon: "cpu", id: "cat-it", isActive: true, name: "ICT Equipment", sortOrder: 2 },
            { color: "#4A90D9", icon: "boxes", id: "cat-office", isActive: true, name: "Office Supplies", sortOrder: 1 },
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
                sortOrder: 2,
                sourceOfFunds: "GOK",
                unitOfMeasurement: "Each",
                unitPrice: 50_000,
            },
            {
                categoryId: "cat-office",
                description: "Printer paper",
                id: "item-2",
                isActive: true,
                name: "Paper",
                procurementMethod: "RFQ",
                sortOrder: 1,
                sourceOfFunds: "GOK",
                unitOfMeasurement: "Ream",
                unitPrice: 500,
            },
        ],
        selectedCategoryIds: ["cat-it"],
    });
    const toolboxContents = toolbox.toolboxDefinition.contents;
    strict_1.default.equal(toolboxContents[0]?.name, "Dept Info");
    strict_1.default.equal(toolboxContents[1]?.name, "ICT Equipment");
    strict_1.default.equal(toolboxContents[1]?.colour, "#0B6E4F");
    strict_1.default.equal(toolboxContents[1]?.cssConfig?.container, "pl-toolbox-category pl-toolbox-category--cpu");
    strict_1.default.equal(toolboxContents.length, 2);
    completedTests.push("department-user Blockly toolbox construction keeps the department source block plus only the selected live categories and items while flowing stored category styling metadata into Blockly cssConfig hooks");
    const parsedLaunch = (0, du_plan_routes_1.parseDepartmentUserLaunchContext)(new URLSearchParams("fiscalYear=2026-2027&categories=cat-it,cat-office,cat-it"));
    strict_1.default.equal(parsedLaunch.isValid, true);
    strict_1.default.deepEqual(parsedLaunch.categoryIds, ["cat-it", "cat-office"]);
    strict_1.default.equal((0, du_plan_routes_1.parseDepartmentUserLaunchContext)(new URLSearchParams("categories=cat-it")).isValid, false);
    strict_1.default.match((0, du_plan_routes_1.getDepartmentUserMissingLaunchContextMessage)(), /launchpad/i);
    completedTests.push("department-user launch-context parsing requires both fiscal year and categories so direct links fail closed back to the dashboard flow");
    strict_1.default.equal((0, du_plan_routes_1.resolveDepartmentUserWorkspaceMode)({
        accessMode: "editable",
        requestedMode: "edit",
        status: "draft",
    }), "edit");
    strict_1.default.equal((0, du_plan_routes_1.resolveDepartmentUserWorkspaceMode)({
        accessMode: "editable",
        requestedMode: "edit",
        status: "submitted",
    }), "view");
    strict_1.default.equal((0, du_plan_routes_1.resolveDepartmentUserWorkspaceMode)({
        accessMode: "read_only_grace",
        requestedMode: "edit",
        status: "rejected",
    }), "view");
    completedTests.push("department-user workspace mode resolution keeps edit access limited to editable draft and rejected plans while forcing truthful view mode elsewhere");
    strict_1.default.equal((0, du_plan_routes_1.canDepartmentUserEditWorkspace)({
        accessMode: "editable",
        status: "rejected",
    }), true);
    strict_1.default.equal((0, du_plan_routes_1.canDepartmentUserEditWorkspace)({
        accessMode: "editable",
        status: "submitted",
    }), false);
    strict_1.default.equal((0, du_plan_routes_1.canDepartmentUserEditWorkspace)({
        accessMode: "read_only_grace",
        status: "draft",
    }), false);
    strict_1.default.match((0, du_plan_routes_1.getDepartmentUserWorkspaceEditBlockedMessage)({
        accessMode: "editable",
        status: "approved",
    }), /approved plans are read-only/i);
    strict_1.default.match((0, du_plan_routes_1.getDepartmentUserWorkspaceEditBlockedMessage)({
        accessMode: "read_only_grace",
        status: "draft",
    }), /no longer editable/i);
    completedTests.push("department-user workspace write guards now match the same editability rules used by the route mode resolver so read-only plans cannot still be patched by draft saves");
    strict_1.default.equal((0, workspace_catalog_identity_1.resolveDepartmentUserCategoryCatalogIdentity)({
        categories: [
            { id: "cat-office-east", name: "Office Supplies" },
            { id: "cat-office-west", name: "Office Supplies" },
        ],
        categoryId: "",
        categoryName: "Office Supplies",
    }), null);
    strict_1.default.equal((0, workspace_catalog_identity_1.resolveDepartmentUserItemCatalogIdentity)({
        categoryId: "cat-it",
        itemDescription: "Portable computers",
        itemId: "",
        itemName: "Laptops",
        items: [
            {
                categoryId: "cat-it",
                description: "Portable computers",
                id: "item-laptop",
                name: "Laptops",
                unitPrice: 50_000,
            },
            {
                categoryId: "cat-it",
                description: "Shared lab computers",
                id: "item-lab-laptop",
                name: "Laptops",
                unitPrice: 65_000,
            },
        ],
        unitPrice: 50_000,
    })?.id, "item-laptop");
    completedTests.push("department-user catalog identity resolution now refuses ambiguous duplicate category names and only backfills legacy block ids when the catalog match is unambiguous");
    const departmentBlock = new TestBlock("department_block");
    const categoryBlock = new TestBlock("category_block", {
        CATEGORY_ID: "",
        CATEGORY_NAME: "ICT Equipment",
    });
    const itemBlock = new TestBlock("item_block", {
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
                description: "Portable computers",
                id: "item-laptop",
                name: "Laptops",
                unitPrice: 50_000,
            },
        ],
    });
    strict_1.default.equal(categoryBlock.getFieldValue("CATEGORY_ID"), "cat-it");
    strict_1.default.equal(itemBlock.getFieldValue("ITEM_ID"), "item-laptop");
    completedTests.push("legacy Blockly workspaces now rehydrate missing hidden category and item ids before rollups run so older blocks can still save against stable catalog ids");
    const duPresentation = (0, editor_contract_1.buildPlanningWorkspacePresentation)({
        actor: "department_user",
        actorLabel: "Department User",
        mode: "view",
    });
    strict_1.default.equal(duPresentation.badgeLabel, "DU Blockly Workspace");
    strict_1.default.equal(duPresentation.modeIndicatorLabel, null);
    strict_1.default.match(duPresentation.readOnlyMessage, /current DU session/i);
    const poPresentation = (0, editor_contract_1.buildPlanningWorkspacePresentation)({
        actor: "procurement_officer",
        actorLabel: "Procurement Officer",
        mode: "edit",
    });
    strict_1.default.equal(poPresentation.badgeLabel, "Shared Planning Workspace");
    strict_1.default.equal(poPresentation.modeIndicatorLabel, "(Editing as PO)");
    completedTests.push("shared planning editor presentation now exposes a role-aware header contract so future PO reuse can render a truthful editing-as-PO indicator without forking the editor shell");
    const workspaceState = (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
        lastSavedAt: 100,
        lastSavedByUserId: "old-user",
        revision: 2,
        saveSource: "workspace_sync",
    });
    const persistedWorkspaceState = (0, workspace_save_1.buildPersistedDepartmentUserWorkspaceState)({
        currentUserId: "du-user-1",
        savedAt: 999,
        workspaceState,
    });
    strict_1.default.equal(persistedWorkspaceState.editorMetadata.lastSavedByUserId, "du-user-1");
    strict_1.default.equal(persistedWorkspaceState.editorMetadata.lastSavedAt, 999);
    strict_1.default.equal(persistedWorkspaceState.editorMetadata.revision, 2);
    completedTests.push("department-user plan persistence now stamps workspace metadata with the authenticated saver on the Convex side instead of trusting client-supplied editor ids");
    const draftSaveInput = (0, workspace_save_1.buildDepartmentUserWorkspaceDraftSaveInput)({
        categories: [
            { id: "cat-it", name: "ICT Equipment" },
            { id: "cat-office", name: "Office Supplies" },
        ],
        planId: "plan-123",
        rollup: departmentRollup,
        selectedCategoryIds: ["cat-it", "cat-office"],
        workspaceState,
    });
    strict_1.default.deepEqual(draftSaveInput.categorySummaries, [
        {
            amount: 200_000,
            categoryId: "cat-it",
            categoryName: "ICT Equipment",
            itemCount: 1,
        },
        {
            amount: 20_000,
            categoryId: "cat-office",
            categoryName: "Office Supplies",
            itemCount: 1,
        },
    ]);
    strict_1.default.equal(draftSaveInput.planId, "plan-123");
    completedTests.push("department-user editor save payloads now stay aligned with the live category catalog before the shared Blockly editor calls the draft-save mutation");
    const ambiguousDraftSaveInput = (0, workspace_save_1.buildDepartmentUserWorkspaceDraftSaveInput)({
        categories: [
            { id: "cat-office-east", name: "Office Supplies" },
            { id: "cat-office-west", name: "Office Supplies" },
        ],
        planId: "plan-456",
        rollup: (0, du_workspace_calculations_1.calculateDepartmentUserDepartmentRollup)([
            {
                categoryId: "unknown-category",
                categoryName: "Office Supplies",
                items: [
                    {
                        itemDescription: "Paper",
                        quantities: { q1: 10, q2: 0, q3: 0, q4: 0 },
                        unitPrice: 500,
                    },
                ],
            },
        ]),
        selectedCategoryIds: ["cat-office-east", "cat-office-west"],
        workspaceState,
    });
    strict_1.default.deepEqual(ambiguousDraftSaveInput.categorySummaries, []);
    completedTests.push("department-user save payload normalization now drops ambiguous duplicate-name category fallbacks instead of silently remapping summaries onto the wrong catalog record");
    strict_1.default.equal((0, du_plan_routes_1.getDepartmentUserWorkspaceAccessRefreshKey)(29_999, 10_000), 2);
    strict_1.default.equal((0, du_plan_routes_1.getDepartmentUserWorkspaceAccessRefreshKey)(30_000, 10_000), 3);
    strict_1.default.equal((0, du_plan_routes_1.getDepartmentUserWorkspaceAccessRefreshDelay)(30_000, 10_000), 10_000);
    strict_1.default.equal((0, du_plan_routes_1.getDepartmentUserWorkspaceAccessRefreshDelay)(30_001, 10_000), 9_999);
    completedTests.push("department-user workspace access refresh helpers now roll the query key at deterministic time buckets so edit mode rechecks itself as submission windows expire");
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
    strict_1.default.equal(snapshot.editorMetadata.lastSavedByUserId, "du-user-2");
    strict_1.default.equal(snapshot.editorMetadata.revision, 3);
    completedTests.push("shared Blockly workspace snapshots now serialize with the real authenticated user id so the component-level save path and persisted metadata stay consistent");
    const workspaceRecord = (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
        lastSavedAt: 123,
        lastSavedByUserId: "user-1",
        revision: 4,
        saveSource: "workspace_sync",
        workspaceJson: {
            blocks: {
                blocks: [{ id: "dept-1", type: "department_block" }],
                languageVersion: 0,
            },
        },
    });
    strict_1.default.equal(workspaceRecord.editorMetadata.revision, 4);
    strict_1.default.equal((0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(workspaceRecord).workspaceJson.blocks !== undefined, true);
    strict_1.default.equal((0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)("bad-record").editorMetadata.saveSource, "workspace_seed");
    completedTests.push("department-user Blockly serialization helpers preserve the canonical JSON payload shape and fail closed back to an empty seeded workspace when storage is invalid");
    return completedTests;
}
exports.runDepartmentUserBlocklyWorkspaceTests = runDepartmentUserBlocklyWorkspaceTests;
