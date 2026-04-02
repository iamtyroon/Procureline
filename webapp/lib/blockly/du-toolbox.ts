export interface DepartmentUserWorkspaceDepartmentSource {
    budgetAllocation: number | null;
    departmentId: string;
    departmentName: string;
    voteNumber: string;
}

export interface DepartmentUserWorkspaceCategoryRecord {
    id: string;
    isActive: boolean;
    name: string;
    sortOrder: number;
}

export interface DepartmentUserWorkspaceItemRecord {
    categoryId: string;
    description: string | null;
    id: string;
    isActive: boolean;
    name: string;
    procurementMethod: string | null;
    sortOrder: number;
    sourceOfFunds: string | null;
    unitOfMeasurement: string | null;
    unitPrice: number | null;
}

export interface DepartmentUserUnavailableCategory {
    id: string;
    name: string;
    reason: string;
}

export interface DepartmentUserToolboxBuildResult {
    sanitizedCategoryIds: string[];
    toolboxDefinition: Record<string, unknown>;
    unavailableCategories: DepartmentUserUnavailableCategory[];
}

function sortCategories(
    categories: readonly DepartmentUserWorkspaceCategoryRecord[],
): DepartmentUserWorkspaceCategoryRecord[] {
    return [...categories].sort(
        (left, right) =>
            left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    );
}

function sortItems(
    items: readonly DepartmentUserWorkspaceItemRecord[],
): DepartmentUserWorkspaceItemRecord[] {
    return [...items].sort(
        (left, right) =>
            left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    );
}

export function sanitizeDepartmentUserWorkspaceCategorySelection(args: {
    categories: readonly DepartmentUserWorkspaceCategoryRecord[];
    items: readonly DepartmentUserWorkspaceItemRecord[];
    requestedCategoryIds: readonly string[];
}): {
    sanitizedCategoryIds: string[];
    unavailableCategories: DepartmentUserUnavailableCategory[];
} {
    const categoriesById = new Map(
        args.categories.map((category) => [category.id, category] as const),
    );
    const activeItemCounts = new Map<string, number>();

    for (const item of args.items) {
        if (!item.isActive) {
            continue;
        }

        activeItemCounts.set(
            item.categoryId,
            (activeItemCounts.get(item.categoryId) ?? 0) + 1,
        );
    }

    const sanitizedCategoryIds: string[] = [];
    const unavailableCategories: DepartmentUserUnavailableCategory[] = [];

    for (const categoryId of Array.from(new Set(args.requestedCategoryIds.filter(Boolean)))) {
        const category = categoriesById.get(categoryId);
        if (!category || !category.isActive) {
            continue;
        }

        const activeItemCount = activeItemCounts.get(category.id) ?? 0;
        if (activeItemCount === 0) {
            unavailableCategories.push({
                id: category.id,
                name: category.name,
                reason: "No active catalog items are available in this category yet.",
            });
            continue;
        }

        sanitizedCategoryIds.push(category.id);
    }

    return {
        sanitizedCategoryIds,
        unavailableCategories,
    };
}

function createToolboxBlock(args: {
    fields: Record<string, string>;
    type: string;
}): Record<string, unknown> {
    return {
        fields: args.fields,
        kind: "block",
        type: args.type,
    };
}

export function buildDepartmentUserToolbox(args: {
    categories: readonly DepartmentUserWorkspaceCategoryRecord[];
    department: DepartmentUserWorkspaceDepartmentSource;
    items: readonly DepartmentUserWorkspaceItemRecord[];
    selectedCategoryIds: readonly string[];
}): DepartmentUserToolboxBuildResult {
    const { sanitizedCategoryIds, unavailableCategories } =
        sanitizeDepartmentUserWorkspaceCategorySelection({
            categories: args.categories,
            items: args.items,
            requestedCategoryIds: args.selectedCategoryIds,
        });

    const categoriesById = new Map(
        sortCategories(args.categories).map((category) => [category.id, category] as const),
    );
    const itemsByCategoryId = new Map<string, DepartmentUserWorkspaceItemRecord[]>();

    for (const item of sortItems(args.items)) {
        if (!item.isActive) {
            continue;
        }

        const currentItems = itemsByCategoryId.get(item.categoryId) ?? [];
        currentItems.push(item);
        itemsByCategoryId.set(item.categoryId, currentItems);
    }

    const contents: Array<Record<string, unknown>> = [
        {
            colour: "#18b969",
            contents: [
                createToolboxBlock({
                    fields: {
                        BUDGET: String(args.department.budgetAllocation ?? 0),
                        DEPT_NAME: args.department.departmentName,
                        VOTE_NUMBER: args.department.voteNumber,
                    },
                    type: "department_block",
                }),
            ],
            kind: "category",
            name: "Dept Info",
        },
    ];

    for (const categoryId of sanitizedCategoryIds) {
        const category = categoriesById.get(categoryId);
        if (!category) {
            continue;
        }

        const categoryItems = itemsByCategoryId.get(category.id) ?? [];
        if (categoryItems.length === 0) {
            continue;
        }

        contents.push({
            colour: "#4a90d9",
            contents: [
                createToolboxBlock({
                    fields: {
                        CATEGORY_ID: category.id,
                        CATEGORY_NAME: category.name,
                    },
                    type: "category_block",
                }),
                ...categoryItems.map((item) =>
                    createToolboxBlock({
                        fields: {
                            ITEM_DESC: item.name,
                            ITEM_DESCRIPTION: item.description ?? item.name,
                            ITEM_ID: item.id,
                            PROC_METHOD: item.procurementMethod ?? "Not set",
                            SOURCE_OF_FUNDS: item.sourceOfFunds ?? "Not set",
                            UNIT_OF_MEASUREMENT: item.unitOfMeasurement ?? "Not set",
                            UNIT_PRICE: String(item.unitPrice ?? 0),
                        },
                        type: "item_block",
                    }),
                ),
            ],
            kind: "category",
            name: category.name,
        });
    }

    return {
        sanitizedCategoryIds,
        toolboxDefinition: {
            contents,
            kind: "categoryToolbox",
        },
        unavailableCategories,
    };
}
