"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { BlocklyLoadingSkeleton } from "@/src/components/blockly/BlocklyLoadingSkeleton";
import type {
    BlocklyWorkspaceChangePayload,
    BlocklyWorkspaceSelectedBlockLike,
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
    categories?: ConsolidationSourceCategory[];
    categoryCount?: number;
    departmentId: string;
    departmentName: string;
    estimatedBudgetUsed: number;
    items?: ConsolidationSourceItem[];
    itemCount: number;
    quarterTotals?: ConsolidationQuarterTotals;
    timingSections?: ConsolidationTimingSection[];
    totalCost?: number;
    voteNumber: string;
    workspaceState?: unknown;
}

export interface ConsolidationQuarterTotals {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
}

export interface ConsolidationSourceCategory {
    categoryId: string;
    categoryName: string;
    itemCount: number;
    quarterTotals: ConsolidationQuarterTotals;
    totalCost: number;
}

export interface ConsolidationSourceItem {
    categoryId: string;
    categoryName: string;
    itemDescription: string;
    itemId: string;
    procurementMethod: string;
    q1Qty: number;
    q1Total: number;
    q2Qty: number;
    q2Total: number;
    q3Qty: number;
    q3Total: number;
    q4Qty: number;
    q4Total: number;
    sourceOfFunds: string;
    totalCost: number;
    totalQty: number;
    unitOfMeasurement: string;
    unitPrice: number;
}

export interface ConsolidationTimingSection {
    fields: Array<{
        label: string;
        value: string;
    }>;
    label: string;
    type: ConsolidationTimingBlockType;
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

function workspaceJsonHasAggregateBlock(value: unknown): boolean {
    const blocks = asRecord(asRecord(value)?.blocks)?.blocks;
    return Array.isArray(blocks)
        ? blocks.some((block) => asRecord(block)?.type === "aggregate_plan_block")
        : false;
}

function createSeedConsolidationWorkspaceRecord(args: {
    currentUserId: string;
    fiscalYear: string;
}): BlocklyWorkspaceRecord {
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

    if (
        !workspaceJsonUsesCurrentBlocks(normalized.workspaceJson) ||
        !workspaceJsonHasAggregateBlock(normalized.workspaceJson)
    ) {
        return createSeedConsolidationWorkspaceRecord({
            currentUserId: args.currentUserId,
            fiscalYear: args.fiscalYear,
        });
    }

    return createBlocklyWorkspaceRecord({
        lastSavedAt: normalized.editorMetadata.lastSavedAt,
        lastSavedByUserId: normalized.editorMetadata.lastSavedByUserId,
        recoveredAt: normalized.editorMetadata.recoveredAt,
        revision: normalized.editorMetadata.revision,
        saveSource: normalized.editorMetadata.saveSource,
        workspaceJson: hydrateCompactConsolidationWorkspaceJson({
            fiscalYear: args.fiscalYear,
            sourceDepartments: args.sourceDepartments,
            workspaceJson: normalized.workspaceJson,
        }),
    });
}

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
const TIMING_FIELD_LABELS = [
    "Time process days",
    "Invite/Advertisement",
    "Bid Opening",
    "Bid Evaluation",
    "Tender Award",
    "Notification of Award",
    "Contract Signing",
    "Total Time for Contract",
    "Date of Completion",
] as const;
const TIMING_BLOCK_LABELS: Record<ConsolidationTimingBlockType, string> = {
    actual_timing_block: "Actual timing",
    planned_timing_block: "Planned timing",
    variance_timing_block: "Variance timing",
};
type ConsolidationTimingBlockType =
    | "actual_timing_block"
    | "planned_timing_block"
    | "variance_timing_block";

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function getNestedBlock(value: unknown): Record<string, unknown> | null {
    const record = asRecord(value);
    return asRecord(record?.block);
}

function parseToolboxAmount(value: unknown): number {
    const parsed = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
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

function addQuarterTotals(
    left: ConsolidationQuarterTotals,
    right: ConsolidationQuarterTotals,
): ConsolidationQuarterTotals {
    return {
        q1: left.q1 + right.q1,
        q2: left.q2 + right.q2,
        q3: left.q3 + right.q3,
        q4: left.q4 + right.q4,
    };
}

function readSourceItemsFromCategory(args: {
    categoryBlock: Record<string, unknown>;
    categoryId: string;
    categoryName: string;
}): ConsolidationSourceItem[] {
    const items: ConsolidationSourceItem[] = [];
    let currentItem = getNestedBlock(asRecord(args.categoryBlock.inputs)?.ITEMS);

    while (currentItem && currentItem.type === "item_block") {
        const fields = asRecord(currentItem.fields);
        const unitPrice = parseToolboxAmount(fields?.UNIT_PRICE);
        const q1Qty = parseToolboxAmount(fields?.Q1_QTY);
        const q2Qty = parseToolboxAmount(fields?.Q2_QTY);
        const q3Qty = parseToolboxAmount(fields?.Q3_QTY);
        const q4Qty = parseToolboxAmount(fields?.Q4_QTY);
        const totalQty = q1Qty + q2Qty + q3Qty + q4Qty;
        const q1Total = q1Qty * unitPrice;
        const q2Total = q2Qty * unitPrice;
        const q3Total = q3Qty * unitPrice;
        const q4Total = q4Qty * unitPrice;

        items.push({
            categoryId: args.categoryId,
            categoryName: args.categoryName,
            itemDescription: String(fields?.ITEM_DESC ?? fields?.ITEM_DESCRIPTION ?? "Item"),
            itemId: String(fields?.ITEM_ID ?? ""),
            procurementMethod: String(fields?.PROC_METHOD ?? ""),
            q1Qty,
            q1Total,
            q2Qty,
            q2Total,
            q3Qty,
            q3Total,
            q4Qty,
            q4Total,
            sourceOfFunds: String(fields?.SOURCE_OF_FUNDS ?? ""),
            totalCost: q1Total + q2Total + q3Total + q4Total,
            totalQty,
            unitOfMeasurement: String(fields?.UNIT_OF_MEASUREMENT ?? ""),
            unitPrice,
        });

        currentItem = getNestedBlock(currentItem.next);
    }

    return items;
}

function readTimingSections(
    sourceDepartmentBlock: Record<string, unknown> | null,
): ConsolidationTimingSection[] {
    const sections: ConsolidationTimingSection[] = [];
    const blockTypes: ConsolidationTimingBlockType[] = [
        "planned_timing_block",
        "actual_timing_block",
        "variance_timing_block",
    ];

    for (const blockType of blockTypes) {
        const timingBlock = findTimingBlock(sourceDepartmentBlock, blockType);
        const fields = asRecord(timingBlock?.fields);
        sections.push({
            fields: TIMING_FIELD_NAMES.map((fieldName, index) => ({
                label: TIMING_FIELD_LABELS[index] ?? fieldName,
                value: String(fields?.[fieldName] ?? "_"),
            })),
            label: TIMING_BLOCK_LABELS[blockType],
            type: blockType,
        });
    }

    return sections;
}

export function enrichConsolidationSourceDepartment(
    department: ConsolidationSourceDepartment,
): ConsolidationSourceDepartment {
    if (
        department.items &&
        department.categories &&
        department.quarterTotals &&
        department.timingSections
    ) {
        return department;
    }

    const submittedDepartment = findSubmittedDepartmentBlock(department.workspaceState);
    const categories: ConsolidationSourceCategory[] = [];
    const items: ConsolidationSourceItem[] = [];
    let quarterTotals: ConsolidationQuarterTotals = { q1: 0, q2: 0, q3: 0, q4: 0 };
    let currentCategory = getNestedBlock(asRecord(submittedDepartment?.inputs)?.CATEGORIES);

    while (currentCategory && currentCategory.type === "category_block") {
        const categoryFields = asRecord(currentCategory.fields);
        const sourceCategoryId = String(categoryFields?.CATEGORY_ID ?? "").trim();
        const categoryName = String(categoryFields?.CATEGORY_NAME ?? "Category");
        const categoryId =
            sourceCategoryId || `category-${categories.length}-${categoryName}`;
        const categoryItems = readSourceItemsFromCategory({
            categoryBlock: currentCategory,
            categoryId,
            categoryName,
        });
        const categoryQuarterTotals = categoryItems.reduce<ConsolidationQuarterTotals>(
            (totals, item) => ({
                q1: totals.q1 + item.q1Total,
                q2: totals.q2 + item.q2Total,
                q3: totals.q3 + item.q3Total,
                q4: totals.q4 + item.q4Total,
            }),
            { q1: 0, q2: 0, q3: 0, q4: 0 },
        );
        const categoryTotalCost =
            categoryQuarterTotals.q1 +
            categoryQuarterTotals.q2 +
            categoryQuarterTotals.q3 +
            categoryQuarterTotals.q4;

        categories.push({
            categoryId,
            categoryName,
            itemCount: categoryItems.length,
            quarterTotals: categoryQuarterTotals,
            totalCost: categoryTotalCost,
        });
        items.push(...categoryItems);
        quarterTotals = addQuarterTotals(quarterTotals, categoryQuarterTotals);
        currentCategory = getNestedBlock(currentCategory.next);
    }

    const submittedFields = asRecord(submittedDepartment?.fields);
    const submittedVoteNumber = submittedFields?.VOTE_NUMBER;
    const submittedBudget = submittedFields?.BUDGET;
    const totalCost =
        quarterTotals.q1 + quarterTotals.q2 + quarterTotals.q3 + quarterTotals.q4;

    return {
        ...department,
        categoryCount: categories.length,
        categories,
        estimatedBudgetUsed:
            submittedBudget !== undefined && submittedBudget !== null
                ? parseToolboxAmount(submittedBudget)
                : department.estimatedBudgetUsed,
        itemCount: items.length || department.itemCount,
        items,
        quarterTotals,
        timingSections: readTimingSections(submittedDepartment),
        totalCost,
        voteNumber:
            submittedVoteNumber !== undefined && submittedVoteNumber !== null
                ? String(submittedVoteNumber)
                : department.voteNumber,
    };
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
    const summary = enrichConsolidationSourceDepartment(department);
    const submittedDepartment = findSubmittedDepartmentBlock(summary.workspaceState);
    const quarterTotals = summary.quarterTotals ?? { q1: 0, q2: 0, q3: 0, q4: 0 };
    const totalCost = summary.totalCost ?? calculateToolboxDepartmentTotal(
        submittedDepartment,
    );
    const block: Record<string, unknown> = {
        extraState: {
            isCollapsed: true,
            isSummaryOnly: true,
        },
        fields: {
            BUDGET: String(summary.estimatedBudgetUsed),
            CATEGORY_COUNT: String(summary.categoryCount ?? 0),
            DEPARTMENT_ID: summary.departmentId,
            DEPT_NAME: summary.departmentName,
            DEPT_Q1_TOTAL: quarterTotals.q1.toFixed(2),
            DEPT_Q2_TOTAL: quarterTotals.q2.toFixed(2),
            DEPT_Q3_TOTAL: quarterTotals.q3.toFixed(2),
            DEPT_Q4_TOTAL: quarterTotals.q4.toFixed(2),
            DEPT_TOTAL: totalCost.toFixed(2),
            ITEM_COUNT: String(summary.itemCount),
            SUMMARY_ONLY: "true",
            VOTE_NUMBER: summary.voteNumber,
        },
        kind: "block",
        type: "department_block",
    };

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
    fiscalYear: string;
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
                const fields = {
                    ...(asRecord(aggregateBlock.fields) ?? {}),
                    FINANCIAL_YEAR: args.fiscalYear,
                };
                const firstDepartmentStub = getNestedBlock(inputs?.DEPARTMENTS);
                const hydratedDepartmentChain = hydrateDepartmentStubChain({
                    sourceDepartmentBlock: firstDepartmentStub,
                    sourceDepartmentById,
                });

                if (!hydratedDepartmentChain) {
                    return {
                        ...aggregateBlock,
                        fields,
                    };
                }

                return {
                    ...aggregateBlock,
                    fields,
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
    let currentBlock = getNestedBlock(asRecord(departmentBlock?.inputs)?.TIMING);
    while (currentBlock) {
        if (currentBlock.type === blockType) {
            return currentBlock;
        }
        currentBlock = getNestedBlock(currentBlock.next);
    }

    currentBlock = getNestedBlock(departmentBlock?.next);
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
        ],
        kind: "categoryToolbox",
    };
}

function findSelectedDepartmentId(
    block: BlocklyWorkspaceSelectedBlockLike | null,
): string | null {
    let currentBlock = block;
    while (currentBlock) {
        if (currentBlock.type === "department_block") {
            const departmentId = currentBlock.getFieldValue("DEPARTMENT_ID").trim();
            return departmentId || null;
        }
        currentBlock = currentBlock.getParent?.() ?? null;
    }
    return null;
}

export default function ProcurementOfficerConsolidationBlocklyShell(props: {
    fiscalYear: string;
    initialWorkspaceState: unknown;
    onSelectedDepartmentChange?: (departmentId: string | null) => void;
    onWorkspaceChange: (state: BlocklyWorkspaceRecord) => void;
    readOnly?: boolean;
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
            editorMode={props.readOnly ? "view" : "edit"}
            items={EMPTY_WORKSPACE_ITEMS}
            onBudgetStateChange={noopBudgetStateChange}
            onSelectedBlockChange={(block) => {
                if (!block) {
                    return;
                }
                props.onSelectedDepartmentChange?.(findSelectedDepartmentId(block));
            }}
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
