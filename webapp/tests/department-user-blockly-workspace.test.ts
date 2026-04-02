import assert from "node:assert/strict";
import {
    createBlocklyWorkspaceRecord,
    normalizeBlocklyWorkspaceRecord,
} from "../lib/blockly/blockly-serialization";
import {
    buildPlanningWorkspacePresentation,
} from "../lib/blockly/editor-contract";
import {
    canDepartmentUserEditWorkspace,
    getDepartmentUserWorkspaceAccessRefreshDelay,
    getDepartmentUserWorkspaceAccessRefreshKey,
    getDepartmentUserWorkspaceEditBlockedMessage,
    getDepartmentUserMissingLaunchContextMessage,
    parseDepartmentUserLaunchContext,
    resolveDepartmentUserWorkspaceMode,
} from "../lib/blockly/du-plan-routes";
import {
    buildDepartmentUserToolbox,
    sanitizeDepartmentUserWorkspaceCategorySelection,
} from "../lib/blockly/du-toolbox";
import {
    calculateDepartmentUserCategoryRollup,
    calculateDepartmentUserDepartmentRollup,
    calculateDepartmentUserItemRollup,
    mapDepartmentUserBudgetMeterState,
} from "../lib/blockly/du-workspace-calculations";
import {
    buildDepartmentUserWorkspaceDraftSaveInput,
    buildPersistedDepartmentUserWorkspaceState,
    createSerializedBlocklyWorkspaceSnapshot,
} from "../lib/blockly/workspace-save";
import {
    resolveDepartmentUserCategoryCatalogIdentity,
    resolveDepartmentUserItemCatalogIdentity,
    synchronizeDepartmentUserWorkspaceCatalogIdentity,
} from "../lib/blockly/workspace-catalog-identity";

class TestBlock {
    private readonly fields = new Map<string, string>();
    private readonly inputs = new Map<string, TestBlock | null>();
    private nextBlock: TestBlock | null = null;

    constructor(
        readonly type: string,
        initialFields: Record<string, string> = {},
    ) {
        for (const [key, value] of Object.entries(initialFields)) {
            this.fields.set(key, value);
        }
    }

    getFieldValue(name: string): string {
        return this.fields.get(name) ?? "";
    }

    getInput(name: string) {
        const targetBlock = this.inputs.get(name) ?? null;
        return {
            connection: {
                targetBlock: () => targetBlock,
            },
        };
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
}

export function runDepartmentUserBlocklyWorkspaceTests(): string[] {
    const completedTests: string[] = [];

    const itemRollup = calculateDepartmentUserItemRollup({
        itemDescription: "Laptops",
        quantities: {
            q1: 1,
            q2: 2,
            q3: 0,
            q4: 1,
        },
        unitPrice: 50_000,
    });
    assert.equal(itemRollup.totalQuantity, 4);
    assert.equal(itemRollup.totalCost, 200_000);
    assert.deepEqual(itemRollup.quarterTotals, {
        q1: 50_000,
        q2: 100_000,
        q3: 0,
        q4: 50_000,
    });
    completedTests.push(
        "department-user Blockly item rollups keep quarterly totals, total quantity, and total cost aligned with the prototype traversal model",
    );

    const categoryRollup = calculateDepartmentUserCategoryRollup({
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
    assert.equal(categoryRollup.itemCount, 2);
    assert.equal(categoryRollup.totalCost, 250_000);
    assert.deepEqual(categoryRollup.quarterTotals, {
        q1: 50_000,
        q2: 125_000,
        q3: 25_000,
        q4: 50_000,
    });

    const departmentRollup = calculateDepartmentUserDepartmentRollup([
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
    assert.equal(departmentRollup.totalItemCount, 2);
    assert.equal(departmentRollup.departmentTotal, 220_000);
    completedTests.push(
        "department-user Blockly category and department rollups aggregate item costs without collapsing quarterly detail",
    );

    assert.deepEqual(
        mapDepartmentUserBudgetMeterState({
            totalBudget: null,
            usedAmount: 150_000,
        }),
        {
            remainingBudget: null,
            state: "unallocated",
            totalBudget: null,
            usedAmount: 150_000,
            usedPercent: null,
        },
    );
    assert.equal(
        mapDepartmentUserBudgetMeterState({
            totalBudget: 1_000_000,
            usedAmount: 850_000,
        }).state,
        "warning",
    );
    assert.equal(
        mapDepartmentUserBudgetMeterState({
            totalBudget: 1_000_000,
            usedAmount: 1_150_000,
        }).state,
        "over_budget",
    );
    completedTests.push(
        "department-user budget meter states distinguish unallocated, warning, and over-budget cases without divide-by-zero math",
    );

    const categorySelection = sanitizeDepartmentUserWorkspaceCategorySelection({
        categories: [
            { id: "cat-it", isActive: true, name: "ICT Equipment", sortOrder: 1 },
            { id: "cat-office", isActive: true, name: "Office Supplies", sortOrder: 2 },
            { id: "cat-archived", isActive: false, name: "Archived", sortOrder: 3 },
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
    assert.deepEqual(categorySelection.sanitizedCategoryIds, ["cat-it"]);
    assert.deepEqual(categorySelection.unavailableCategories, [
        {
            id: "cat-office",
            name: "Office Supplies",
            reason: "No active catalog items are available in this category yet.",
        },
    ]);
    completedTests.push(
        "department-user workspace category sanitization drops duplicates, inactive ids, missing ids, and empty categories before the toolbox is built",
    );

    const toolbox = buildDepartmentUserToolbox({
        categories: [
            { id: "cat-it", isActive: true, name: "ICT Equipment", sortOrder: 2 },
            { id: "cat-office", isActive: true, name: "Office Supplies", sortOrder: 1 },
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
    const toolboxContents = toolbox.toolboxDefinition.contents as Array<Record<string, unknown>>;
    assert.equal(toolboxContents[0]?.name, "Dept Info");
    assert.equal(toolboxContents[1]?.name, "ICT Equipment");
    assert.equal(toolboxContents.length, 2);
    completedTests.push(
        "department-user Blockly toolbox construction keeps the department source block plus only the selected live categories and items",
    );

    const parsedLaunch = parseDepartmentUserLaunchContext(
        new URLSearchParams("fiscalYear=2026-2027&categories=cat-it,cat-office,cat-it"),
    );
    assert.equal(parsedLaunch.isValid, true);
    assert.deepEqual(parsedLaunch.categoryIds, ["cat-it", "cat-office"]);
    assert.equal(
        parseDepartmentUserLaunchContext(new URLSearchParams("categories=cat-it")).isValid,
        false,
    );
    assert.match(getDepartmentUserMissingLaunchContextMessage(), /launchpad/i);
    completedTests.push(
        "department-user launch-context parsing requires both fiscal year and categories so direct links fail closed back to the dashboard flow",
    );

    assert.equal(
        resolveDepartmentUserWorkspaceMode({
            accessMode: "editable",
            requestedMode: "edit",
            status: "draft",
        }),
        "edit",
    );
    assert.equal(
        resolveDepartmentUserWorkspaceMode({
            accessMode: "editable",
            requestedMode: "edit",
            status: "submitted",
        }),
        "view",
    );
    assert.equal(
        resolveDepartmentUserWorkspaceMode({
            accessMode: "read_only_grace",
            requestedMode: "edit",
            status: "rejected",
        }),
        "view",
    );
    completedTests.push(
        "department-user workspace mode resolution keeps edit access limited to editable draft and rejected plans while forcing truthful view mode elsewhere",
    );

    assert.equal(
        canDepartmentUserEditWorkspace({
            accessMode: "editable",
            status: "rejected",
        }),
        true,
    );
    assert.equal(
        canDepartmentUserEditWorkspace({
            accessMode: "editable",
            status: "submitted",
        }),
        false,
    );
    assert.equal(
        canDepartmentUserEditWorkspace({
            accessMode: "read_only_grace",
            status: "draft",
        }),
        false,
    );
    assert.match(
        getDepartmentUserWorkspaceEditBlockedMessage({
            accessMode: "editable",
            status: "approved",
        }),
        /approved plans are read-only/i,
    );
    assert.match(
        getDepartmentUserWorkspaceEditBlockedMessage({
            accessMode: "read_only_grace",
            status: "draft",
        }),
        /no longer editable/i,
    );
    completedTests.push(
        "department-user workspace write guards now match the same editability rules used by the route mode resolver so read-only plans cannot still be patched by draft saves",
    );

    assert.equal(
        resolveDepartmentUserCategoryCatalogIdentity({
            categories: [
                { id: "cat-office-east", name: "Office Supplies" },
                { id: "cat-office-west", name: "Office Supplies" },
            ],
            categoryId: "",
            categoryName: "Office Supplies",
        }),
        null,
    );
    assert.equal(
        resolveDepartmentUserItemCatalogIdentity({
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
        })?.id,
        "item-laptop",
    );
    completedTests.push(
        "department-user catalog identity resolution now refuses ambiguous duplicate category names and only backfills legacy block ids when the catalog match is unambiguous",
    );

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

    synchronizeDepartmentUserWorkspaceCatalogIdentity({
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
    assert.equal(categoryBlock.getFieldValue("CATEGORY_ID"), "cat-it");
    assert.equal(itemBlock.getFieldValue("ITEM_ID"), "item-laptop");
    completedTests.push(
        "legacy Blockly workspaces now rehydrate missing hidden category and item ids before rollups run so older blocks can still save against stable catalog ids",
    );

    const duPresentation = buildPlanningWorkspacePresentation({
        actor: "department_user",
        actorLabel: "Department User",
        mode: "view",
    });
    assert.equal(duPresentation.badgeLabel, "DU Blockly Workspace");
    assert.equal(duPresentation.modeIndicatorLabel, null);
    assert.match(duPresentation.readOnlyMessage, /current DU session/i);

    const poPresentation = buildPlanningWorkspacePresentation({
        actor: "procurement_officer",
        actorLabel: "Procurement Officer",
        mode: "edit",
    });
    assert.equal(poPresentation.badgeLabel, "Shared Planning Workspace");
    assert.equal(poPresentation.modeIndicatorLabel, "(Editing as PO)");
    completedTests.push(
        "shared planning editor presentation now exposes a role-aware header contract so future PO reuse can render a truthful editing-as-PO indicator without forking the editor shell",
    );

    const workspaceState = createBlocklyWorkspaceRecord({
        lastSavedAt: 100,
        lastSavedByUserId: "old-user",
        revision: 2,
        saveSource: "workspace_sync",
    });
    const persistedWorkspaceState = buildPersistedDepartmentUserWorkspaceState({
        currentUserId: "du-user-1",
        savedAt: 999,
        workspaceState,
    });
    assert.equal(
        persistedWorkspaceState.editorMetadata.lastSavedByUserId,
        "du-user-1",
    );
    assert.equal(persistedWorkspaceState.editorMetadata.lastSavedAt, 999);
    assert.equal(persistedWorkspaceState.editorMetadata.revision, 2);
    completedTests.push(
        "department-user plan persistence now stamps workspace metadata with the authenticated saver on the Convex side instead of trusting client-supplied editor ids",
    );

    const draftSaveInput = buildDepartmentUserWorkspaceDraftSaveInput({
        categories: [
            { id: "cat-it", name: "ICT Equipment" },
            { id: "cat-office", name: "Office Supplies" },
        ],
        planId: "plan-123",
        rollup: departmentRollup,
        selectedCategoryIds: ["cat-it", "cat-office"],
        workspaceState,
    });
    assert.deepEqual(draftSaveInput.categorySummaries, [
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
    assert.equal(draftSaveInput.planId, "plan-123");
    completedTests.push(
        "department-user editor save payloads now stay aligned with the live category catalog before the shared Blockly editor calls the draft-save mutation",
    );

    const ambiguousDraftSaveInput = buildDepartmentUserWorkspaceDraftSaveInput({
        categories: [
            { id: "cat-office-east", name: "Office Supplies" },
            { id: "cat-office-west", name: "Office Supplies" },
        ],
        planId: "plan-456",
        rollup: calculateDepartmentUserDepartmentRollup([
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
    assert.deepEqual(ambiguousDraftSaveInput.categorySummaries, []);
    completedTests.push(
        "department-user save payload normalization now drops ambiguous duplicate-name category fallbacks instead of silently remapping summaries onto the wrong catalog record",
    );

    assert.equal(getDepartmentUserWorkspaceAccessRefreshKey(29_999, 10_000), 2);
    assert.equal(getDepartmentUserWorkspaceAccessRefreshKey(30_000, 10_000), 3);
    assert.equal(getDepartmentUserWorkspaceAccessRefreshDelay(30_000, 10_000), 10_000);
    assert.equal(getDepartmentUserWorkspaceAccessRefreshDelay(30_001, 10_000), 9_999);
    completedTests.push(
        "department-user workspace access refresh helpers now roll the query key at deterministic time buckets so edit mode rechecks itself as submission windows expire",
    );

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
    assert.equal(snapshot.editorMetadata.lastSavedByUserId, "du-user-2");
    assert.equal(snapshot.editorMetadata.revision, 3);
    completedTests.push(
        "shared Blockly workspace snapshots now serialize with the real authenticated user id so the component-level save path and persisted metadata stay consistent",
    );

    const workspaceRecord = createBlocklyWorkspaceRecord({
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
    assert.equal(workspaceRecord.editorMetadata.revision, 4);
    assert.equal(
        normalizeBlocklyWorkspaceRecord(workspaceRecord).workspaceJson.blocks !== undefined,
        true,
    );
    assert.equal(
        normalizeBlocklyWorkspaceRecord("bad-record").editorMetadata.saveSource,
        "workspace_seed",
    );
    completedTests.push(
        "department-user Blockly serialization helpers preserve the canonical JSON payload shape and fail closed back to an empty seeded workspace when storage is invalid",
    );

    return completedTests;
}
