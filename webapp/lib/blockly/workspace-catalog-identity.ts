import { serializeProcurementComplianceFlags } from "../procurement/compliance";

interface BlocklyConnectionLike {
    targetBlock(): BlocklyWritableBlockLike | null;
}

interface BlocklyInputLike {
    connection?: BlocklyConnectionLike | null;
}

interface BlocklyWritableBlockLike {
    getFieldValue(name: string): string;
    getInput(name: string): BlocklyInputLike | null;
    getNextBlock(): BlocklyWritableBlockLike | null;
    setFieldValue(value: string, name: string): void;
    type: string;
}

export interface DepartmentUserCatalogCategory {
    id: string;
    name: string;
}

export interface DepartmentUserCatalogItem {
    categoryId: string;
    complianceFlags?: readonly string[] | null;
    description?: string | null;
    id: string;
    isActive?: boolean;
    maxQuantity?: number | null;
    minQuantity?: number | null;
    procurementMethod?: string | null;
    sourceOfFunds?: string | null;
    unitOfMeasurement?: string | null;
    unitPrice?: number | null;
    name: string;
}

export interface DepartmentUserWorkspaceSourceUsage {
    categoryIds: string[];
    itemIds: string[];
}

interface SerializedBlocklyBlock {
    fields?: Record<string, unknown>;
    inputs?: Record<
        string,
        {
            block?: SerializedBlocklyBlock | null;
        }
    >;
    next?: {
        block?: SerializedBlocklyBlock | null;
    };
    type?: unknown;
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

function serializeOptionalNumericField(
    value: string | number | null | undefined,
): string {
    const finiteValue = getFiniteNumber(value);
    return finiteValue === null ? "" : String(finiteValue);
}

function getSerializedFieldValue(
    block: SerializedBlocklyBlock,
    fieldName: string,
): string {
    const value = block.fields?.[fieldName];

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }

    return "";
}

function getSerializedInputBlock(
    block: SerializedBlocklyBlock,
    inputName: string,
): SerializedBlocklyBlock | null {
    const input = block.inputs?.[inputName];
    const childBlock = input?.block;

    return childBlock && typeof childBlock === "object" ? childBlock : null;
}

function getSerializedNextBlock(
    block: SerializedBlocklyBlock,
): SerializedBlocklyBlock | null {
    const nextBlock = block.next?.block;
    return nextBlock && typeof nextBlock === "object" ? nextBlock : null;
}

function getSerializedTopBlocks(
    workspaceJson: Record<string, unknown> | null | undefined,
): SerializedBlocklyBlock[] {
    const blocksRecord =
        workspaceJson && typeof workspaceJson.blocks === "object" && workspaceJson.blocks !== null
            ? (workspaceJson.blocks as Record<string, unknown>)
            : null;
    const blocks = blocksRecord?.blocks;

    if (!Array.isArray(blocks)) {
        return [];
    }

    return blocks.filter(
        (block): block is SerializedBlocklyBlock =>
            Boolean(block) && typeof block === "object",
    );
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

export function collectDepartmentUserWorkspaceSourceUsage(args: {
    categories: DepartmentUserCatalogCategory[];
    items: DepartmentUserCatalogItem[];
    workspaceState: {
        workspaceJson?: Record<string, unknown> | null;
    } | null | undefined;
}): DepartmentUserWorkspaceSourceUsage {
    const topBlocks = getSerializedTopBlocks(args.workspaceState?.workspaceJson);
    const departmentBlock =
        topBlocks.find((block) => block.type === "department_block") ?? null;

    if (!departmentBlock) {
        return {
            categoryIds: [],
            itemIds: [],
        };
    }

    return collectDepartmentUserWorkspaceSourceUsageFromSerializedDepartmentBlock({
        categories: args.categories,
        departmentBlock,
        items: args.items,
    });
}

export function collectDepartmentUserWorkspaceSourceUsageFromDepartmentBlock(args: {
    categories: DepartmentUserCatalogCategory[];
    departmentBlock: BlocklyWritableBlockLike | null;
    items: DepartmentUserCatalogItem[];
}): DepartmentUserWorkspaceSourceUsage {
    if (!args.departmentBlock || args.departmentBlock.type !== "department_block") {
        return {
            categoryIds: [],
            itemIds: [],
        };
    }

    const categoryIds = new Set<string>();
    const itemIds = new Set<string>();
    let categoryBlock =
        args.departmentBlock.getInput("CATEGORIES")?.connection?.targetBlock() ?? null;
    while (categoryBlock && categoryBlock.type === "category_block") {
        const resolvedCategory = resolveDepartmentUserCategoryCatalogIdentity({
            categories: args.categories,
            categoryId: categoryBlock.getFieldValue("CATEGORY_ID"),
            categoryName: categoryBlock.getFieldValue("CATEGORY_NAME"),
        });

        if (resolvedCategory) {
            categoryIds.add(resolvedCategory.id);
        }

        let itemBlock = categoryBlock.getInput("ITEMS")?.connection?.targetBlock() ?? null;
        while (itemBlock && itemBlock.type === "item_block") {
            const resolvedItem = resolveDepartmentUserItemCatalogIdentity({
                categoryId: resolvedCategory?.id ?? categoryBlock.getFieldValue("CATEGORY_ID"),
                itemDescription: itemBlock.getFieldValue("ITEM_DESCRIPTION"),
                itemId: itemBlock.getFieldValue("ITEM_ID"),
                itemName: itemBlock.getFieldValue("ITEM_DESC"),
                items: args.items,
                unitPrice: itemBlock.getFieldValue("UNIT_PRICE"),
            });

            if (resolvedItem) {
                itemIds.add(resolvedItem.id);
            }

            itemBlock = itemBlock.getNextBlock();
        }

        categoryBlock = categoryBlock.getNextBlock();
    }

    return {
        categoryIds: Array.from(categoryIds),
        itemIds: Array.from(itemIds),
    };
}

function collectDepartmentUserWorkspaceSourceUsageFromSerializedDepartmentBlock(args: {
    categories: DepartmentUserCatalogCategory[];
    departmentBlock: SerializedBlocklyBlock;
    items: DepartmentUserCatalogItem[];
}): DepartmentUserWorkspaceSourceUsage {
    const categoryIds = new Set<string>();
    const itemIds = new Set<string>();
    let categoryBlock = getSerializedInputBlock(args.departmentBlock, "CATEGORIES");

    while (categoryBlock && categoryBlock.type === "category_block") {
        const resolvedCategory = resolveDepartmentUserCategoryCatalogIdentity({
            categories: args.categories,
            categoryId: getSerializedFieldValue(categoryBlock, "CATEGORY_ID"),
            categoryName: getSerializedFieldValue(categoryBlock, "CATEGORY_NAME"),
        });

        if (resolvedCategory) {
            categoryIds.add(resolvedCategory.id);
        }

        let itemBlock = getSerializedInputBlock(categoryBlock, "ITEMS");
        while (itemBlock && itemBlock.type === "item_block") {
            const resolvedItem = resolveDepartmentUserItemCatalogIdentity({
                categoryId: resolvedCategory?.id ?? getSerializedFieldValue(categoryBlock, "CATEGORY_ID"),
                itemDescription: getSerializedFieldValue(itemBlock, "ITEM_DESCRIPTION"),
                itemId: getSerializedFieldValue(itemBlock, "ITEM_ID"),
                itemName: getSerializedFieldValue(itemBlock, "ITEM_DESC"),
                items: args.items,
                unitPrice: getSerializedFieldValue(itemBlock, "UNIT_PRICE"),
            });

            if (resolvedItem) {
                itemIds.add(resolvedItem.id);
            }

            itemBlock = getSerializedNextBlock(itemBlock);
        }

        categoryBlock = getSerializedNextBlock(categoryBlock);
    }

    return {
        categoryIds: Array.from(categoryIds),
        itemIds: Array.from(itemIds),
    };
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
                itemBlock.getFieldValue("COMPLIANCE_FLAGS") !==
                    serializeProcurementComplianceFlags(
                        resolvedItem.complianceFlags,
                    )
            ) {
                itemBlock.setFieldValue(
                    serializeProcurementComplianceFlags(
                        resolvedItem.complianceFlags,
                    ),
                    "COMPLIANCE_FLAGS",
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
                itemBlock.getFieldValue("ITEM_IS_ACTIVE") !==
                String(resolvedItem?.isActive ?? false)
            ) {
                itemBlock.setFieldValue(
                    String(resolvedItem?.isActive ?? false),
                    "ITEM_IS_ACTIVE",
                );
            }
            if (
                itemBlock.getFieldValue("MAX_QUANTITY") !==
                serializeOptionalNumericField(resolvedItem?.maxQuantity ?? null)
            ) {
                itemBlock.setFieldValue(
                    serializeOptionalNumericField(resolvedItem?.maxQuantity ?? null),
                    "MAX_QUANTITY",
                );
            }
            if (
                itemBlock.getFieldValue("MIN_QUANTITY") !==
                serializeOptionalNumericField(resolvedItem?.minQuantity ?? null)
            ) {
                itemBlock.setFieldValue(
                    serializeOptionalNumericField(resolvedItem?.minQuantity ?? null),
                    "MIN_QUANTITY",
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
