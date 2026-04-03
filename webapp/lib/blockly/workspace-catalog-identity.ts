import type { BlocklyWritableBlockLike } from "./du-workspace-calculations";

export interface DepartmentUserCatalogCategory {
    id: string;
    name: string;
}

export interface DepartmentUserCatalogItem {
    categoryId: string;
    description?: string | null;
    id: string;
    procurementMethod?: string | null;
    sourceOfFunds?: string | null;
    unitOfMeasurement?: string | null;
    unitPrice?: number | null;
    name: string;
}

function normalizeText(value: string | null | undefined): string {
    return value?.trim().toLocaleLowerCase() ?? "";
}

function getFiniteNumber(value: string | number | null | undefined): number | null {
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

export function resolveDepartmentUserCategoryCatalogIdentity(args: {
    categories: DepartmentUserCatalogCategory[];
    categoryId?: string | null;
    categoryName?: string | null;
}): DepartmentUserCatalogCategory | null {
    const normalizedCategoryId = args.categoryId?.trim() ?? "";
    if (normalizedCategoryId.length > 0) {
        const matchingCategory = args.categories.find(
            (category) => category.id === normalizedCategoryId,
        );
        if (matchingCategory) {
            return matchingCategory;
        }
    }

    const normalizedCategoryName = normalizeText(args.categoryName);
    if (normalizedCategoryName.length === 0) {
        return null;
    }

    const matchingCategories = args.categories.filter(
        (category) => normalizeText(category.name) === normalizedCategoryName,
    );
    return matchingCategories.length === 1 ? (matchingCategories[0] ?? null) : null;
}

export function resolveDepartmentUserItemCatalogIdentity(args: {
    categoryId?: string | null;
    itemDescription?: string | null;
    itemId?: string | null;
    itemName?: string | null;
    items: DepartmentUserCatalogItem[];
    unitPrice?: number | string | null;
}): DepartmentUserCatalogItem | null {
    const normalizedCategoryId = args.categoryId?.trim() ?? "";
    const normalizedItemId = args.itemId?.trim() ?? "";
    const normalizedItemName = normalizeText(args.itemName);
    const normalizedItemDescription = normalizeText(args.itemDescription);
    const normalizedUnitPrice = getFiniteNumber(args.unitPrice);

    if (normalizedItemId.length > 0) {
        const matchingItem = args.items.find((item) => item.id === normalizedItemId);
        if (matchingItem) {
            return matchingItem;
        }
    }

    let matchingItems = args.items;
    if (normalizedCategoryId.length > 0) {
        matchingItems = matchingItems.filter(
            (item) => item.categoryId === normalizedCategoryId,
        );
    }

    if (normalizedItemName.length === 0) {
        return null;
    }

    matchingItems = matchingItems.filter(
        (item) => normalizeText(item.name) === normalizedItemName,
    );

    if (matchingItems.length > 1 && normalizedItemDescription.length > 0) {
        const descriptionMatches = matchingItems.filter(
            (item) =>
                normalizeText(item.description ?? item.name) === normalizedItemDescription,
        );
        if (descriptionMatches.length === 1) {
            return descriptionMatches[0] ?? null;
        }
        if (descriptionMatches.length > 0) {
            matchingItems = descriptionMatches;
        }
    }

    if (matchingItems.length > 1 && normalizedUnitPrice !== null) {
        const unitPriceMatches = matchingItems.filter(
            (item) => getFiniteNumber(item.unitPrice) === normalizedUnitPrice,
        );
        if (unitPriceMatches.length === 1) {
            return unitPriceMatches[0] ?? null;
        }
        if (unitPriceMatches.length > 0) {
            matchingItems = unitPriceMatches;
        }
    }

    return matchingItems.length === 1 ? (matchingItems[0] ?? null) : null;
}

export function synchronizeDepartmentUserWorkspaceCatalogIdentity(args: {
    categories: DepartmentUserCatalogCategory[];
    departmentBlock: BlocklyWritableBlockLike | null;
    items: DepartmentUserCatalogItem[];
}): void {
    if (!args.departmentBlock || args.departmentBlock.type !== "department_block") {
        return;
    }

    let categoryBlock =
        args.departmentBlock
            .getInput("CATEGORIES")
            ?.connection?.targetBlock() ?? null;

    while (categoryBlock && categoryBlock.type === "category_block") {
        const resolvedCategory = resolveDepartmentUserCategoryCatalogIdentity({
            categories: args.categories,
            categoryId: categoryBlock.getFieldValue("CATEGORY_ID"),
            categoryName: categoryBlock.getFieldValue("CATEGORY_NAME"),
        });
        let categoryId = resolvedCategory?.id ?? "";

        if (
            resolvedCategory &&
            categoryBlock.getFieldValue("CATEGORY_ID") !== resolvedCategory.id
        ) {
            categoryBlock.setFieldValue(resolvedCategory.id, "CATEGORY_ID");
        }
        if (
            resolvedCategory &&
            categoryBlock.getFieldValue("CATEGORY_NAME") !== resolvedCategory.name
        ) {
            categoryBlock.setFieldValue(resolvedCategory.name, "CATEGORY_NAME");
        }

        let itemBlock = categoryBlock.getInput("ITEMS")?.connection?.targetBlock() ?? null;
        const resolvedItemCategoryIds = new Set<string>();
        while (itemBlock && itemBlock.type === "item_block") {
            const resolvedItem = resolveDepartmentUserItemCatalogIdentity({
                categoryId,
                itemDescription: itemBlock.getFieldValue("ITEM_DESCRIPTION"),
                itemId: itemBlock.getFieldValue("ITEM_ID"),
                itemName: itemBlock.getFieldValue("ITEM_DESC"),
                items: args.items,
                unitPrice: itemBlock.getFieldValue("UNIT_PRICE"),
            });
            if (resolvedItem) {
                resolvedItemCategoryIds.add(resolvedItem.categoryId);
            }

            if (resolvedItem && itemBlock.getFieldValue("ITEM_ID") !== resolvedItem.id) {
                itemBlock.setFieldValue(resolvedItem.id, "ITEM_ID");
            }
            if (resolvedItem && itemBlock.getFieldValue("ITEM_DESC") !== resolvedItem.name) {
                itemBlock.setFieldValue(resolvedItem.name, "ITEM_DESC");
            }
            if (
                resolvedItem &&
                itemBlock.getFieldValue("ITEM_DESCRIPTION") !==
                    (resolvedItem.description ?? resolvedItem.name)
            ) {
                itemBlock.setFieldValue(
                    resolvedItem.description ?? resolvedItem.name,
                    "ITEM_DESCRIPTION",
                );
            }
            if (
                resolvedItem &&
                itemBlock.getFieldValue("UNIT_OF_MEASUREMENT") !==
                    (resolvedItem.unitOfMeasurement ?? "Not set")
            ) {
                itemBlock.setFieldValue(
                    resolvedItem.unitOfMeasurement ?? "Not set",
                    "UNIT_OF_MEASUREMENT",
                );
            }
            if (
                resolvedItem &&
                itemBlock.getFieldValue("UNIT_PRICE") !==
                    String(getFiniteNumber(resolvedItem.unitPrice) ?? 0)
            ) {
                itemBlock.setFieldValue(
                    String(getFiniteNumber(resolvedItem.unitPrice) ?? 0),
                    "UNIT_PRICE",
                );
            }
            if (
                resolvedItem &&
                itemBlock.getFieldValue("PROC_METHOD") !==
                    (resolvedItem.procurementMethod ?? "Not set")
            ) {
                itemBlock.setFieldValue(
                    resolvedItem.procurementMethod ?? "Not set",
                    "PROC_METHOD",
                );
            }
            if (
                resolvedItem &&
                itemBlock.getFieldValue("SOURCE_OF_FUNDS") !==
                    (resolvedItem.sourceOfFunds ?? "Not set")
            ) {
                itemBlock.setFieldValue(
                    resolvedItem.sourceOfFunds ?? "Not set",
                    "SOURCE_OF_FUNDS",
                );
            }

            itemBlock = itemBlock.getNextBlock();
        }

        const resolvedItemCategoryId =
            resolvedItemCategoryIds.size === 1
                ? Array.from(resolvedItemCategoryIds)[0] ?? null
                : null;
        const resolvedItemCategory =
            resolvedItemCategoryId === null
                ? null
                : args.categories.find((category) => category.id === resolvedItemCategoryId) ??
                  null;

        if (resolvedItemCategory) {
            categoryId = resolvedItemCategory.id;

            if (categoryBlock.getFieldValue("CATEGORY_ID") !== resolvedItemCategory.id) {
                categoryBlock.setFieldValue(resolvedItemCategory.id, "CATEGORY_ID");
            }
            if (categoryBlock.getFieldValue("CATEGORY_NAME") !== resolvedItemCategory.name) {
                categoryBlock.setFieldValue(resolvedItemCategory.name, "CATEGORY_NAME");
            }
        }

        categoryBlock = categoryBlock.getNextBlock();
    }
}
