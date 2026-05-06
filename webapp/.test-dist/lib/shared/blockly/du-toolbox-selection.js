"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeDepartmentUserWorkspaceCategorySelection = void 0;
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
