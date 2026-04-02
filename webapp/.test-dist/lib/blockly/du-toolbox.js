"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDepartmentUserToolbox = exports.sanitizeDepartmentUserWorkspaceCategorySelection = void 0;
const categories_1 = require("../procurement-officer/categories");
function sortCategories(categories) {
    return [...categories].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}
function sortItems(items) {
    return [...items].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}
function sanitizeDepartmentUserWorkspaceCategorySelection(args) {
    const categoriesById = new Map(args.categories.map((category) => [category.id, category]));
    const activeItemCounts = new Map();
    for (const item of args.items) {
        if (!item.isActive) {
            continue;
        }
        activeItemCounts.set(item.categoryId, (activeItemCounts.get(item.categoryId) ?? 0) + 1);
    }
    const sanitizedCategoryIds = [];
    const unavailableCategories = [];
    for (const categoryId of Array.from(new Set(args.requestedCategoryIds.filter(Boolean)))) {
        const category = categoriesById.get(categoryId);
        if (!category) {
            continue;
        }
        const activeItemCount = activeItemCounts.get(category.id) ?? 0;
        if (!category.isActive) {
            if (args.preserveUnavailableRequestedCategories) {
                sanitizedCategoryIds.push(category.id);
                unavailableCategories.push({
                    id: category.id,
                    name: category.name,
                    reason: "This category is archived for new planning but still visible on existing plans.",
                });
            }
            continue;
        }
        if (activeItemCount === 0) {
            if (args.preserveUnavailableRequestedCategories) {
                sanitizedCategoryIds.push(category.id);
            }
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
exports.sanitizeDepartmentUserWorkspaceCategorySelection = sanitizeDepartmentUserWorkspaceCategorySelection;
function createToolboxBlock(args) {
    return {
        fields: args.fields,
        kind: "block",
        type: args.type,
    };
}
function buildDepartmentUserToolbox(args) {
    const { sanitizedCategoryIds, unavailableCategories } = sanitizeDepartmentUserWorkspaceCategorySelection({
        categories: args.categories,
        items: args.items,
        preserveUnavailableRequestedCategories: args.preserveUnavailableRequestedCategories,
        requestedCategoryIds: args.selectedCategoryIds,
    });
    const categoriesById = new Map(sortCategories(args.categories).map((category) => [category.id, category]));
    const itemsByCategoryId = new Map();
    for (const item of sortItems(args.items)) {
        if (!item.isActive) {
            continue;
        }
        const currentItems = itemsByCategoryId.get(item.categoryId) ?? [];
        currentItems.push(item);
        itemsByCategoryId.set(item.categoryId, currentItems);
    }
    const contents = [
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
        const toolboxStyle = (0, categories_1.buildCategoryToolboxStyle)({
            color: category.color ?? null,
            icon: category.icon ?? null,
        });
        contents.push({
            colour: toolboxStyle.colour,
            contents: [
                createToolboxBlock({
                    fields: {
                        CATEGORY_ID: category.id,
                        CATEGORY_NAME: category.name,
                    },
                    type: "category_block",
                }),
                ...categoryItems.map((item) => createToolboxBlock({
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
                })),
            ],
            cssConfig: toolboxStyle.cssConfig,
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
exports.buildDepartmentUserToolbox = buildDepartmentUserToolbox;
