"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { BlocklyLoadingSkeleton } from "@/src/components/blockly/BlocklyLoadingSkeleton";
import type {
    BlocklyWorkspaceChangePayload,
} from "@/src/components/blockly/BlocklyWorkspace";
import {
    createBlocklyWorkspaceRecord,
    normalizeBlocklyWorkspaceRecord,
    normalizeBlocklyWorkspaceJson,
    type BlocklyWorkspaceRecord,
} from "@/lib/shared/blockly/blockly-serialization";
import type { DepartmentUserCatalogItem } from "@/lib/shared/blockly/workspace-catalog-identity";

const SharedBlocklyWorkspace = dynamic(
    () =>
        import("@/src/components/blockly/BlocklyWorkspace").then((module) => ({
            default: module.BlocklyWorkspace,
        })),
    {
        loading: () => <BlocklyLoadingSkeleton />,
        ssr: false,
    },
);

const EMPTY_WORKSPACE_CATEGORIES: Array<{ id: string; name: string }> = [];
const EMPTY_WORKSPACE_ITEMS: Array<
    DepartmentUserCatalogItem & { lastPriceChangedAt: number | null }
> = [];
const EMPTY_SELECTED_CATEGORY_IDS: string[] = [];
const noopBudgetStateChange = () => {};
const noopWorkspaceStructureChange = () => {};
const noopWorkspaceSummaryChange = () => {};

export interface ConsolidationSourceDepartment {
    departmentId: string;
    departmentName: string;
    estimatedBudgetUsed: number;
    itemCount: number;
    voteNumber: string;
    workspaceState?: unknown;
}

const CURRENT_PO_CONSOLIDATION_BLOCK_TYPES = new Set([
    "actual_timing_block",
    "aggregate_plan_block",
    "category_block",
    "department_block",
    "item_block",
    "planned_timing_block",
    "variance_timing_block",
]);

function workspaceJsonUsesCurrentBlocks(value: unknown): boolean {
    const stack = [value];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current || typeof current !== "object") {
            continue;
        }

        if (!Array.isArray(current)) {
            const type = (current as Record<string, unknown>).type;
            if (
                typeof type === "string" &&
                !CURRENT_PO_CONSOLIDATION_BLOCK_TYPES.has(type)
            ) {
                return false;
            }
        }

        stack.push(
            ...(Array.isArray(current)
                ? current
                : Object.values(current as Record<string, unknown>)),
        );
    }

    return true;
}

function normalizeConsolidationWorkspaceRecord(args: {
    currentUserId: string;
    fiscalYear: string;
    sourceState: unknown;
    sourceDepartments: ConsolidationSourceDepartment[];
}): BlocklyWorkspaceRecord | null {
    const normalized = normalizeBlocklyWorkspaceRecord(args.sourceState, {
        lastSavedByUserId: args.currentUserId,
        saveSource: "workspace_seed",
    });

    if (!workspaceJsonUsesCurrentBlocks(normalized.workspaceJson)) {
        return createBlocklyWorkspaceRecord({
            lastSavedByUserId: args.currentUserId,
            saveSource: "workspace_seed",
            workspaceJson: {
                blocks: {
                    blocks: [
                        {
                            fields: {
                                FINANCIAL_YEAR: args.fiscalYear,
                            },
                            type: "aggregate_plan_block",
                            x: 80,
                            y: 60,
                        },
                    ],
                    languageVersion: 0,
                },
            },
        });
    }

    return createBlocklyWorkspaceRecord({
        lastSavedAt: normalized.editorMetadata.lastSavedAt,
        lastSavedByUserId: normalized.editorMetadata.lastSavedByUserId,
        recoveredAt: normalized.editorMetadata.recoveredAt,
        revision: normalized.editorMetadata.revision,
        saveSource: normalized.editorMetadata.saveSource,
        workspaceJson: hydrateCompactConsolidationWorkspaceJson({
            sourceDepartments: args.sourceDepartments,
            workspaceJson: normalized.workspaceJson,
        }),
    });
}

const COPY_CATEGORY_FIELD_NAMES = [
    "CATEGORY_ID",
    "CATEGORY_NAME",
] as const;
const COPY_ITEM_FIELD_NAMES = [
    "ITEM_ID",
    "ITEM_DESC",
    "ITEM_DESCRIPTION",
    "ITEM_IS_ACTIVE",
    "UNIT_OF_MEASUREMENT",
    "UNIT_PRICE",
    "PROC_METHOD",
    "SOURCE_OF_FUNDS",
    "Q1_QTY",
    "Q2_QTY",
    "Q3_QTY",
    "Q4_QTY",
] as const;
const TIMING_FIELD_NAMES = [
    "FIELD1",
    "FIELD2",
    "FIELD3",
    "FIELD4",
    "FIELD5",
    "FIELD6",
    "FIELD7",
    "FIELD8",
    "FIELD9",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function getNestedBlock(value: unknown): Record<string, unknown> | null {
    const record = asRecord(value);
    return asRecord(record?.block);
}

function copyFields(
    sourceFields: unknown,
    fieldNames: readonly string[],
): Record<string, string> {
    const fields = asRecord(sourceFields);
    const copied: Record<string, string> = {};

    for (const fieldName of fieldNames) {
        const value = fields?.[fieldName];
        if (value !== undefined && value !== null) {
            copied[fieldName] = String(value);
        }
    }

    return copied;
}

function parseToolboxAmount(value: unknown): number {
    const parsed = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function cloneItemChain(sourceItem: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!sourceItem || sourceItem.type !== "item_block") {
        return null;
    }

    const itemFields = copyFields(sourceItem.fields, COPY_ITEM_FIELD_NAMES);
    const unitPrice = parseToolboxAmount(itemFields.UNIT_PRICE);
    const q1 = parseToolboxAmount(itemFields.Q1_QTY);
    const q2 = parseToolboxAmount(itemFields.Q2_QTY);
    const q3 = parseToolboxAmount(itemFields.Q3_QTY);
    const q4 = parseToolboxAmount(itemFields.Q4_QTY);
    const totalQuantity = q1 + q2 + q3 + q4;
    const totalCost = totalQuantity * unitPrice;
    const clonedItem: Record<string, unknown> = {
        fields: {
            ...itemFields,
            ITEM_TOTAL_COST: totalCost.toFixed(2),
            ITEM_TOTAL_QTY: Number.isInteger(totalQuantity)
                ? String(totalQuantity)
                : totalQuantity.toFixed(2),
        },
        type: "item_block",
    };
    const nextItem = cloneItemChain(getNestedBlock(sourceItem.next));
    if (nextItem) {
        clonedItem.next = { block: nextItem };
    }

    return clonedItem;
}

function calculateToolboxItemTotals(
    sourceItem: Record<string, unknown> | null,
): {
    itemCount: number;
    q1Total: number;
    q2Total: number;
    q3Total: number;
    q4Total: number;
    totalCost: number;
} {
    let currentItem = sourceItem;
    const totals = {
        itemCount: 0,
        q1Total: 0,
        q2Total: 0,
        q3Total: 0,
        q4Total: 0,
        totalCost: 0,
    };

    while (currentItem && currentItem.type === "item_block") {
        const fields = asRecord(currentItem.fields);
        const unitPrice = parseToolboxAmount(fields?.UNIT_PRICE);
        const q1 = parseToolboxAmount(fields?.Q1_QTY);
        const q2 = parseToolboxAmount(fields?.Q2_QTY);
        const q3 = parseToolboxAmount(fields?.Q3_QTY);
        const q4 = parseToolboxAmount(fields?.Q4_QTY);
        totals.itemCount += 1;
        totals.q1Total += q1 * unitPrice;
        totals.q2Total += q2 * unitPrice;
        totals.q3Total += q3 * unitPrice;
        totals.q4Total += q4 * unitPrice;
        totals.totalCost += (q1 + q2 + q3 + q4) * unitPrice;
        currentItem = getNestedBlock(currentItem.next);
    }

    return totals;
}

function cloneCategoryChain(
    sourceCategory: Record<string, unknown> | null,
): Record<string, unknown> | null {
    if (!sourceCategory || sourceCategory.type !== "category_block") {
        return null;
    }

    const inputs = asRecord(sourceCategory.inputs);
    const firstSourceItem = getNestedBlock(inputs?.ITEMS);
    const categoryTotals = calculateToolboxItemTotals(firstSourceItem);
    const clonedCategory: Record<string, unknown> = {
        fields: {
            ...copyFields(sourceCategory.fields, COPY_CATEGORY_FIELD_NAMES),
            CATEGORY_EMPTY_STATE: "",
            CATEGORY_GRAND_TOTAL: categoryTotals.totalCost.toFixed(2),
            CAT_Q1_TOTAL: categoryTotals.q1Total.toFixed(2),
            CAT_Q2_TOTAL: categoryTotals.q2Total.toFixed(2),
            CAT_Q3_TOTAL: categoryTotals.q3Total.toFixed(2),
            CAT_Q4_TOTAL: categoryTotals.q4Total.toFixed(2),
        },
        type: "category_block",
    };
    const firstItem = cloneItemChain(firstSourceItem);
    if (firstItem) {
        clonedCategory.inputs = {
            ITEMS: {
                block: firstItem,
            },
        };
    }

    const nextCategory = cloneCategoryChain(getNestedBlock(sourceCategory.next));
    if (nextCategory) {
        clonedCategory.next = { block: nextCategory };
    }

    return clonedCategory;
}

function calculateToolboxDepartmentTotal(
    sourceDepartment: Record<string, unknown> | null,
): number {
    let currentCategory = getNestedBlock(asRecord(sourceDepartment?.inputs)?.CATEGORIES);
    let departmentTotal = 0;

    while (currentCategory && currentCategory.type === "category_block") {
        const firstItem = getNestedBlock(asRecord(currentCategory.inputs)?.ITEMS);
        departmentTotal += calculateToolboxItemTotals(firstItem).totalCost;
        currentCategory = getNestedBlock(currentCategory.next);
    }

    return departmentTotal;
}

function findSubmittedDepartmentBlock(workspaceState: unknown): Record<string, unknown> | null {
    const workspaceJson = normalizeBlocklyWorkspaceJson(
        normalizeBlocklyWorkspaceRecord(workspaceState).workspaceJson,
    );
    const blockList = asRecord(workspaceJson.blocks)?.blocks;
    if (!Array.isArray(blockList)) {
        return null;
    }

    return (
        blockList
            .map((block) => asRecord(block))
            .find((block) => block?.type === "department_block") ?? null
    );
}

function buildSubmittedDepartmentToolboxBlock(
    department: ConsolidationSourceDepartment,
): Record<string, unknown> {
    const block: Record<string, unknown> = {
        fields: {
            BUDGET: String(department.estimatedBudgetUsed),
            DEPARTMENT_ID: department.departmentId,
            DEPT_NAME: department.departmentName,
            DEPT_TOTAL: "0.00",
            VOTE_NUMBER: department.voteNumber,
        },
        kind: "block",
        type: "department_block",
    };
    const submittedDepartment = findSubmittedDepartmentBlock(department.workspaceState);
    const submittedFields = asRecord(submittedDepartment?.fields);
    const submittedVoteNumber = submittedFields?.VOTE_NUMBER;
    const submittedBudget = submittedFields?.BUDGET;
    const calculatedDepartmentTotal = calculateToolboxDepartmentTotal(submittedDepartment);

    if (submittedVoteNumber !== undefined && submittedVoteNumber !== null) {
        (block.fields as Record<string, string>).VOTE_NUMBER = String(submittedVoteNumber);
    }
    if (submittedBudget !== undefined && submittedBudget !== null) {
        (block.fields as Record<string, string>).BUDGET = String(submittedBudget);
    }
    if (calculatedDepartmentTotal > 0) {
        (block.fields as Record<string, string>).DEPT_TOTAL =
            calculatedDepartmentTotal.toFixed(2);
    }

    const firstCategory = cloneCategoryChain(
        getNestedBlock(asRecord(submittedDepartment?.inputs)?.CATEGORIES),
    );
    if (firstCategory) {
        block.inputs = {
            CATEGORIES: {
                block: firstCategory,
            },
        };
    }

    block.next = { block: buildTimingBlockChain(submittedDepartment) };

    return block;
}

function appendBlockAfterChain(
    chainStart: Record<string, unknown>,
    nextBlock: Record<string, unknown>,
): void {
    let currentBlock = chainStart;
    while (getNestedBlock(currentBlock.next)) {
        currentBlock = getNestedBlock(currentBlock.next)!;
    }
    currentBlock.next = { block: nextBlock };
}

function hydrateDepartmentStubChain(args: {
    sourceDepartmentById: Map<string, ConsolidationSourceDepartment>;
    sourceDepartmentBlock: Record<string, unknown> | null;
}): Record<string, unknown> | null {
    if (!args.sourceDepartmentBlock || args.sourceDepartmentBlock.type !== "department_block") {
        return null;
    }

    const departmentId = String(
        asRecord(args.sourceDepartmentBlock.fields)?.DEPARTMENT_ID ?? "",
    );
    const sourceDepartment = args.sourceDepartmentById.get(departmentId);
    const hydratedBlock = sourceDepartment
        ? buildSubmittedDepartmentToolboxBlock(sourceDepartment)
        : args.sourceDepartmentBlock;
    const nextDepartmentBlock = hydrateDepartmentStubChain({
        sourceDepartmentBlock: getNestedBlock(args.sourceDepartmentBlock.next),
        sourceDepartmentById: args.sourceDepartmentById,
    });

    if (nextDepartmentBlock) {
        appendBlockAfterChain(hydratedBlock, nextDepartmentBlock);
    }

    return hydratedBlock;
}

function hydrateCompactConsolidationWorkspaceJson(args: {
    sourceDepartments: ConsolidationSourceDepartment[];
    workspaceJson: unknown;
}): Record<string, unknown> {
    const workspaceJson = normalizeBlocklyWorkspaceJson(args.workspaceJson);
    const blocksContainer = asRecord(workspaceJson.blocks);
    const blocks = Array.isArray(blocksContainer?.blocks)
        ? blocksContainer.blocks.map((block) => asRecord(block) ?? block)
        : [];
    const sourceDepartmentById = new Map(
        args.sourceDepartments.map((department) => [department.departmentId, department]),
    );

    return {
        ...workspaceJson,
        blocks: {
            ...blocksContainer,
            blocks: blocks.map((block) => {
                const aggregateBlock = asRecord(block);
                if (aggregateBlock?.type !== "aggregate_plan_block") {
                    return block;
                }

                const inputs = asRecord(aggregateBlock.inputs);
                const firstDepartmentStub = getNestedBlock(inputs?.DEPARTMENTS);
                const hydratedDepartmentChain = hydrateDepartmentStubChain({
                    sourceDepartmentBlock: firstDepartmentStub,
                    sourceDepartmentById,
                });

                if (!hydratedDepartmentChain) {
                    return block;
                }

                return {
                    ...aggregateBlock,
                    inputs: {
                        ...inputs,
                        DEPARTMENTS: {
                            block: hydratedDepartmentChain,
                        },
                    },
                };
            }),
        },
    };
}

function findTimingBlock(
    departmentBlock: Record<string, unknown> | null,
    blockType: string,
): Record<string, unknown> | null {
    let currentBlock = getNestedBlock(departmentBlock?.next);
    while (currentBlock) {
        if (currentBlock.type === blockType) {
            return currentBlock;
        }
        if (currentBlock.type === "department_block") {
            return null;
        }
        currentBlock = getNestedBlock(currentBlock.next);
    }
    return null;
}

function createToolboxTimingBlock(args: {
    sourceBlock: Record<string, unknown> | null;
    type: "actual_timing_block" | "planned_timing_block" | "variance_timing_block";
}): Record<string, unknown> {
    return {
        extraState: { isCollapsed: true },
        fields: {
            ...Object.fromEntries(TIMING_FIELD_NAMES.map((fieldName) => [fieldName, "_"])),
            ...copyFields(args.sourceBlock?.fields, TIMING_FIELD_NAMES),
        },
        type: args.type,
    };
}

function buildTimingBlockChain(
    sourceDepartmentBlock: Record<string, unknown> | null,
): Record<string, unknown> {
    const varianceBlock = createToolboxTimingBlock({
        sourceBlock: findTimingBlock(sourceDepartmentBlock, "variance_timing_block"),
        type: "variance_timing_block",
    });
    const actualBlock = createToolboxTimingBlock({
        sourceBlock: findTimingBlock(sourceDepartmentBlock, "actual_timing_block"),
        type: "actual_timing_block",
    });
    actualBlock.next = { block: varianceBlock };

    const plannedBlock = createToolboxTimingBlock({
        sourceBlock: findTimingBlock(sourceDepartmentBlock, "planned_timing_block"),
        type: "planned_timing_block",
    });
    plannedBlock.next = { block: actualBlock };

    return plannedBlock;
}

function buildConsolidationToolbox(args: {
    fiscalYear: string;
    sourceDepartments: ConsolidationSourceDepartment[];
}): Record<string, unknown> {
    return {
        contents: [
            {
                colour: "#18b969",
                contents:
                    args.sourceDepartments.length > 0
                        ? args.sourceDepartments.map((department) =>
                              buildSubmittedDepartmentToolboxBlock(department),
                          )
                        : [{ kind: "label", text: "No approved plans" }],
                kind: "category",
                name: "Submitted Plans",
            },
            {
                colour: "#a19448",
                contents: [
                    {
                        fields: {
                            FINANCIAL_YEAR: args.fiscalYear,
                        },
                        kind: "block",
                        type: "aggregate_plan_block",
                    },
                ],
                kind: "category",
                name: "Consolidation",
            },
            {
                colour: "#4a90d9",
                contents: [
                    {
                        kind: "block",
                        ...buildTimingBlockChain(null),
                    },
                ],
                kind: "category",
                name: "Timing",
            },
        ],
        kind: "categoryToolbox",
    };
}

export default function ProcurementOfficerConsolidationBlocklyShell(props: {
    fiscalYear: string;
    initialWorkspaceState: unknown;
    onWorkspaceChange: (state: BlocklyWorkspaceRecord) => void;
    sourceDepartments: ConsolidationSourceDepartment[];
    userId: string;
}): JSX.Element {
    const toolboxDefinition = useMemo(
        () =>
            buildConsolidationToolbox({
                fiscalYear: props.fiscalYear,
                sourceDepartments: props.sourceDepartments,
            }),
        [props.fiscalYear, props.sourceDepartments],
    );
    const workspaceState = useMemo(
        () =>
            normalizeConsolidationWorkspaceRecord({
                currentUserId: props.userId,
                fiscalYear: props.fiscalYear,
                sourceState: props.initialWorkspaceState,
                sourceDepartments: props.sourceDepartments,
            }),
        [
            props.fiscalYear,
            props.initialWorkspaceState,
            props.sourceDepartments,
            props.userId,
        ],
    );

    return (
        <SharedBlocklyWorkspace
            budgetAllocation={null}
            categories={EMPTY_WORKSPACE_CATEGORIES}
            closeToolboxOnBlockUse={false}
            currentUserId={props.userId}
            editorMode="edit"
            items={EMPTY_WORKSPACE_ITEMS}
            onBudgetStateChange={noopBudgetStateChange}
            onWorkspaceChange={(payload: BlocklyWorkspaceChangePayload) => {
                props.onWorkspaceChange(payload.workspaceState);
            }}
            onWorkspaceStructureChange={noopWorkspaceStructureChange}
            onWorkspaceSummaryChange={noopWorkspaceSummaryChange}
            planId={`po-consolidation-${props.fiscalYear}`}
            selectedCategoryIds={EMPTY_SELECTED_CATEGORY_IDS}
            toolboxDefinition={toolboxDefinition}
            workspaceBehavior="consolidation"
            workspaceState={workspaceState}
        />
    );
}

export type { BlocklyWorkspaceRecord as ConsolidationBlocklyState };
