"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synchronizeDepartmentUserWorkspaceCatalogIdentity = exports.resolveDepartmentUserItemCatalogIdentity = exports.resolveDepartmentUserCategoryCatalogIdentity = void 0;
function normalizeText(value) {
    return value?.trim().toLocaleLowerCase() ?? "";
}
function getFiniteNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}
function resolveDepartmentUserCategoryCatalogIdentity(args) {
    const normalizedCategoryId = args.categoryId?.trim() ?? "";
    if (normalizedCategoryId.length > 0) {
        const matchingCategory = args.categories.find((category) => category.id === normalizedCategoryId);
        if (matchingCategory) {
            return matchingCategory;
        }
    }
    const normalizedCategoryName = normalizeText(args.categoryName);
    if (normalizedCategoryName.length === 0) {
        return null;
    }
    const matchingCategories = args.categories.filter((category) => normalizeText(category.name) === normalizedCategoryName);
    return matchingCategories.length === 1 ? (matchingCategories[0] ?? null) : null;
}
exports.resolveDepartmentUserCategoryCatalogIdentity = resolveDepartmentUserCategoryCatalogIdentity;
function resolveDepartmentUserItemCatalogIdentity(args) {
    const normalizedCategoryId = args.categoryId?.trim() ?? "";
    const normalizedItemId = args.itemId?.trim() ?? "";
    const normalizedItemName = normalizeText(args.itemName);
    const normalizedItemDescription = normalizeText(args.itemDescription);
    const normalizedUnitPrice = getFiniteNumber(args.unitPrice);
    if (normalizedItemId.length > 0) {
        const matchingItem = args.items.find((item) => item.id === normalizedItemId);
        if (matchingItem && (!normalizedCategoryId || matchingItem.categoryId === normalizedCategoryId)) {
            return matchingItem;
        }
    }
    let matchingItems = args.items;
    if (normalizedCategoryId.length > 0) {
        matchingItems = matchingItems.filter((item) => item.categoryId === normalizedCategoryId);
    }
    if (normalizedItemName.length === 0) {
        return null;
    }
    matchingItems = matchingItems.filter((item) => normalizeText(item.name) === normalizedItemName);
    if (matchingItems.length > 1 && normalizedItemDescription.length > 0) {
        const descriptionMatches = matchingItems.filter((item) => normalizeText(item.description ?? item.name) === normalizedItemDescription);
        if (descriptionMatches.length === 1) {
            return descriptionMatches[0] ?? null;
        }
        if (descriptionMatches.length > 0) {
            matchingItems = descriptionMatches;
        }
    }
    if (matchingItems.length > 1 && normalizedUnitPrice !== null) {
        const unitPriceMatches = matchingItems.filter((item) => getFiniteNumber(item.unitPrice) === normalizedUnitPrice);
        if (unitPriceMatches.length === 1) {
            return unitPriceMatches[0] ?? null;
        }
        if (unitPriceMatches.length > 0) {
            matchingItems = unitPriceMatches;
        }
    }
    return matchingItems.length === 1 ? (matchingItems[0] ?? null) : null;
}
exports.resolveDepartmentUserItemCatalogIdentity = resolveDepartmentUserItemCatalogIdentity;
function synchronizeDepartmentUserWorkspaceCatalogIdentity(args) {
    if (!args.departmentBlock || args.departmentBlock.type !== "department_block") {
        return;
    }
    let categoryBlock = args.departmentBlock
        .getInput("CATEGORIES")
        ?.connection?.targetBlock() ?? null;
    while (categoryBlock && categoryBlock.type === "category_block") {
        const resolvedCategory = resolveDepartmentUserCategoryCatalogIdentity({
            categories: args.categories,
            categoryId: categoryBlock.getFieldValue("CATEGORY_ID"),
            categoryName: categoryBlock.getFieldValue("CATEGORY_NAME"),
        });
        const categoryId = resolvedCategory?.id ?? "";
        if (resolvedCategory &&
            categoryBlock.getFieldValue("CATEGORY_ID") !== resolvedCategory.id) {
            categoryBlock.setFieldValue(resolvedCategory.id, "CATEGORY_ID");
        }
        let itemBlock = categoryBlock.getInput("ITEMS")?.connection?.targetBlock() ?? null;
        while (itemBlock && itemBlock.type === "item_block") {
            const resolvedItem = resolveDepartmentUserItemCatalogIdentity({
                categoryId,
                itemDescription: itemBlock.getFieldValue("ITEM_DESCRIPTION"),
                itemId: itemBlock.getFieldValue("ITEM_ID"),
                itemName: itemBlock.getFieldValue("ITEM_DESC"),
                items: args.items,
                unitPrice: itemBlock.getFieldValue("UNIT_PRICE"),
            });
            if (resolvedItem && itemBlock.getFieldValue("ITEM_ID") !== resolvedItem.id) {
                itemBlock.setFieldValue(resolvedItem.id, "ITEM_ID");
            }
            itemBlock = itemBlock.getNextBlock();
        }
        categoryBlock = categoryBlock.getNextBlock();
    }
}
exports.synchronizeDepartmentUserWorkspaceCatalogIdentity = synchronizeDepartmentUserWorkspaceCatalogIdentity;
