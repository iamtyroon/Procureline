export const DU_BUDGET_WARNING_THRESHOLD_PERCENT = 80;

export interface DepartmentUserQuarterTotals {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
}

export interface DepartmentUserWorkspaceItem {
    itemDescription: string;
    quantities: DepartmentUserQuarterTotals;
    unitPrice: number;
}

export interface DepartmentUserWorkspaceCategory {
    categoryId: string;
    categoryName: string;
    items: DepartmentUserWorkspaceItem[];
}

export interface DepartmentUserItemRollup {
    itemDescription: string;
    quarterTotals: DepartmentUserQuarterTotals;
    totalCost: number;
    totalQuantity: number;
    unitPrice: number;
}

export interface DepartmentUserCategoryRollup {
    categoryId: string;
    categoryName: string;
    itemCount: number;
    items: DepartmentUserItemRollup[];
    quarterTotals: DepartmentUserQuarterTotals;
    totalCost: number;
}

export interface DepartmentUserDepartmentRollup {
    categories: DepartmentUserCategoryRollup[];
    departmentTotal: number;
    quarterTotals: DepartmentUserQuarterTotals;
    totalItemCount: number;
}

export interface DepartmentUserBudgetMeterState {
    remainingBudget: number | null;
    state: "over_budget" | "safe" | "unallocated" | "warning";
    totalBudget: number | null;
    usedAmount: number;
    usedPercent: number | null;
}

export interface BlocklyConnectionLike {
    targetBlock(): BlocklyWritableBlockLike | null;
}

export interface BlocklyInputLike {
    connection?: BlocklyConnectionLike | null;
}

export interface BlocklyWritableBlockLike {
    getFieldValue(name: string): string;
    getInput(name: string): BlocklyInputLike | null;
    getNextBlock(): BlocklyWritableBlockLike | null;
    setFieldValue(value: string, name: string): void;
    setWarningText?(text: string | null): void;
    type: string;
}

function createEmptyQuarterTotals(): DepartmentUserQuarterTotals {
    return {
        q1: 0,
        q2: 0,
        q3: 0,
        q4: 0,
    };
}

function sumQuarterTotals(
    left: DepartmentUserQuarterTotals,
    right: DepartmentUserQuarterTotals,
): DepartmentUserQuarterTotals {
    return {
        q1: left.q1 + right.q1,
        q2: left.q2 + right.q2,
        q3: left.q3 + right.q3,
        q4: left.q4 + right.q4,
    };
}

export function sanitizeNonNegativeNumber(
    value: number | null | string | undefined,
): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(0, value);
    }

    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return Math.max(0, parsed);
        }
    }

    return 0;
}

export function calculateDepartmentUserItemRollup(
    item: DepartmentUserWorkspaceItem,
): DepartmentUserItemRollup {
    const unitPrice = sanitizeNonNegativeNumber(item.unitPrice);
    const quantities = {
        q1: sanitizeNonNegativeNumber(item.quantities.q1),
        q2: sanitizeNonNegativeNumber(item.quantities.q2),
        q3: sanitizeNonNegativeNumber(item.quantities.q3),
        q4: sanitizeNonNegativeNumber(item.quantities.q4),
    };
    const quarterTotals = {
        q1: quantities.q1 * unitPrice,
        q2: quantities.q2 * unitPrice,
        q3: quantities.q3 * unitPrice,
        q4: quantities.q4 * unitPrice,
    };
    const totalQuantity = quantities.q1 + quantities.q2 + quantities.q3 + quantities.q4;
    const totalCost = quarterTotals.q1 + quarterTotals.q2 + quarterTotals.q3 + quarterTotals.q4;

    return {
        itemDescription: item.itemDescription,
        quarterTotals,
        totalCost,
        totalQuantity,
        unitPrice,
    };
}

export function calculateDepartmentUserCategoryRollup(
    category: DepartmentUserWorkspaceCategory,
): DepartmentUserCategoryRollup {
    const items = category.items.map(calculateDepartmentUserItemRollup);
    const quarterTotals = items.reduce(
        (totals, item) => sumQuarterTotals(totals, item.quarterTotals),
        createEmptyQuarterTotals(),
    );

    return {
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        itemCount: items.length,
        items,
        quarterTotals,
        totalCost: items.reduce((sum, item) => sum + item.totalCost, 0),
    };
}

export function calculateDepartmentUserDepartmentRollup(
    categories: readonly DepartmentUserWorkspaceCategory[],
): DepartmentUserDepartmentRollup {
    const categoryRollups = categories.map(calculateDepartmentUserCategoryRollup);
    const quarterTotals = categoryRollups.reduce(
        (totals, category) => sumQuarterTotals(totals, category.quarterTotals),
        createEmptyQuarterTotals(),
    );

    return {
        categories: categoryRollups,
        departmentTotal: categoryRollups.reduce(
            (sum, category) => sum + category.totalCost,
            0,
        ),
        quarterTotals,
        totalItemCount: categoryRollups.reduce(
            (sum, category) => sum + category.itemCount,
            0,
        ),
    };
}

export function mapDepartmentUserBudgetMeterState(args: {
    totalBudget: number | null | undefined;
    usedAmount: number;
}): DepartmentUserBudgetMeterState {
    const totalBudget = sanitizeNonNegativeNumber(args.totalBudget);
    const usedAmount = sanitizeNonNegativeNumber(args.usedAmount);

    if (totalBudget <= 0) {
        return {
            remainingBudget: null,
            state: "unallocated",
            totalBudget: null,
            usedAmount,
            usedPercent: null,
        };
    }

    const usedPercent = Math.max(0, Math.round((usedAmount / totalBudget) * 100));
    return {
        remainingBudget: totalBudget - usedAmount,
        state:
            usedPercent >= 100
                ? "over_budget"
                : usedPercent >= DU_BUDGET_WARNING_THRESHOLD_PERCENT
                  ? "warning"
                  : "safe",
        totalBudget,
        usedAmount,
        usedPercent,
    };
}

function readQuarterlyItemFromBlock(block: BlocklyWritableBlockLike): DepartmentUserWorkspaceItem {
    return {
        itemDescription: block.getFieldValue("ITEM_DESC") || "Untitled item",
        quantities: {
            q1: sanitizeNonNegativeNumber(block.getFieldValue("Q1_QTY")),
            q2: sanitizeNonNegativeNumber(block.getFieldValue("Q2_QTY")),
            q3: sanitizeNonNegativeNumber(block.getFieldValue("Q3_QTY")),
            q4: sanitizeNonNegativeNumber(block.getFieldValue("Q4_QTY")),
        },
        unitPrice: sanitizeNonNegativeNumber(block.getFieldValue("UNIT_PRICE")),
    };
}

export function applyDepartmentWorkspaceRollup(
    departmentBlock: BlocklyWritableBlockLike | null,
): DepartmentUserDepartmentRollup | null {
    if (!departmentBlock || departmentBlock.type !== "department_block") {
        return null;
    }

    const categories: DepartmentUserWorkspaceCategory[] = [];
    let categoryBlock =
        departmentBlock
            .getInput("CATEGORIES")
            ?.connection?.targetBlock() ?? null;

    while (categoryBlock && categoryBlock.type === "category_block") {
        const items: DepartmentUserWorkspaceItem[] = [];
        let itemBlock = categoryBlock.getInput("ITEMS")?.connection?.targetBlock() ?? null;

        while (itemBlock && itemBlock.type === "item_block") {
            items.push(readQuarterlyItemFromBlock(itemBlock));
            itemBlock = itemBlock.getNextBlock();
        }

        categories.push({
            categoryId: categoryBlock.getFieldValue("CATEGORY_ID") || "unknown-category",
            categoryName: categoryBlock.getFieldValue("CATEGORY_NAME") || "Unnamed category",
            items,
        });
        categoryBlock = categoryBlock.getNextBlock();
    }

    const rollup = calculateDepartmentUserDepartmentRollup(categories);

    let writableCategory =
        departmentBlock
            .getInput("CATEGORIES")
            ?.connection?.targetBlock() ?? null;
    for (const categoryRollup of rollup.categories) {
        if (!writableCategory || writableCategory.type !== "category_block") {
            break;
        }

        writableCategory.setFieldValue(
            categoryRollup.quarterTotals.q1.toFixed(2),
            "CAT_Q1_TOTAL",
        );
        writableCategory.setFieldValue(
            categoryRollup.quarterTotals.q2.toFixed(2),
            "CAT_Q2_TOTAL",
        );
        writableCategory.setFieldValue(
            categoryRollup.quarterTotals.q3.toFixed(2),
            "CAT_Q3_TOTAL",
        );
        writableCategory.setFieldValue(
            categoryRollup.quarterTotals.q4.toFixed(2),
            "CAT_Q4_TOTAL",
        );
        writableCategory.setFieldValue(
            categoryRollup.totalCost.toFixed(2),
            "CATEGORY_GRAND_TOTAL",
        );

        let writableItem = writableCategory.getInput("ITEMS")?.connection?.targetBlock() ?? null;
        for (const itemRollup of categoryRollup.items) {
            if (!writableItem || writableItem.type !== "item_block") {
                break;
            }

            writableItem.setFieldValue(String(itemRollup.totalQuantity), "ITEM_TOTAL_QTY");
            writableItem.setFieldValue(
                itemRollup.totalCost.toFixed(2),
                "ITEM_TOTAL_COST",
            );
            writableItem = writableItem.getNextBlock();
        }

        writableCategory = writableCategory.getNextBlock();
    }

    departmentBlock.setFieldValue(rollup.departmentTotal.toFixed(2), "DEPT_TOTAL");

    const budgetState = mapDepartmentUserBudgetMeterState({
        totalBudget: sanitizeNonNegativeNumber(departmentBlock.getFieldValue("BUDGET")),
        usedAmount: rollup.departmentTotal,
    });

    if (departmentBlock.setWarningText) {
        departmentBlock.setWarningText(
            budgetState.state === "over_budget" && budgetState.totalBudget !== null
                ? `Over budget by KES ${Math.abs(
                      budgetState.remainingBudget ?? 0,
                  ).toLocaleString()}`
                : null,
        );
    }

    return rollup;
}
