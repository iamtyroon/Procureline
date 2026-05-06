import type { CategoryIconName } from "@/lib/shared/procurement/categories";

export interface DepartmentUserWorkspaceCategoryRecord {
    color?: string | null;
    id: string;
    icon?: CategoryIconName | null;
    isActive: boolean;
    name: string;
    sortOrder: number;
}

export interface DepartmentUserWorkspaceItemRecord {
    complianceFlags?: readonly string[] | null;
    categoryId: string;
    description: string | null;
    id: string;
    isActive: boolean;
    lastPriceChangedAt?: number | null;
    maxQuantity?: number | null;
    minQuantity?: number | null;
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

export function sanitizeDepartmentUserWorkspaceCategorySelection(args: {
    categories: readonly DepartmentUserWorkspaceCategoryRecord[];
    items: readonly DepartmentUserWorkspaceItemRecord[];
    preserveUnavailableRequestedCategories?: boolean;
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
