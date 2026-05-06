"use client";

import { Layers3, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { DepartmentUserToolboxCategoryState } from "@/lib/frontend/blockly/du-toolbox";

interface BlocklyToolboxRailProps {
    categories: DepartmentUserToolboxCategoryState[];
    department: {
        budgetAllocation: number | null;
        name: string;
        voteNumber: string;
    };
    mode: "edit" | "view";
    onSearchQueryChange: (value: string) => void;
    searchQuery: string;
}

function formatKenyanCurrency(amount: number): string {
    return new Intl.NumberFormat("en-KE", {
        currency: "KES",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        style: "currency",
    }).format(amount);
}

function matchesCategorySearch(category: DepartmentUserToolboxCategoryState, searchQuery: string): boolean {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
        return true;
    }

    return (
        category.name.toLocaleLowerCase().includes(normalizedQuery) ||
        category.matchingItemCount > 0
    );
}

export function BlocklyToolboxRail({
    categories,
    department,
    mode,
    onSearchQueryChange,
    searchQuery,
}: BlocklyToolboxRailProps): JSX.Element {
    const visibleCategories = categories.filter((category) =>
        matchesCategorySearch(category, searchQuery),
    );

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-background/90 px-4 py-3 text-sm text-muted-foreground">
                {mode === "edit"
                    ? "Search stays scoped to the selected categories and the live toolbox hides duplicate category source blocks once they are already on the canvas."
                    : "Read-only mode keeps search and category context visible for review, even though block insertion and destructive actions stay disabled."}
            </div>

            <div className="space-y-2">
                <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="blockly-toolbox-search"
                >
                    Toolbox search
                </label>
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        id="blockly-toolbox-search"
                        onChange={(event) => onSearchQueryChange(event.target.value)}
                        placeholder="Search items, units, methods, or prices"
                        value={searchQuery}
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {visibleCategories.length === 0 ? (
                    <Badge variant="secondary" className="rounded-full">
                        No categories match this search
                    </Badge>
                ) : (
                    visibleCategories.map((category) => {
                        const statusLabel = category.isUnavailable
                            ? "Unavailable"
                            : category.isUsedOnWorkspace
                              ? "Already on canvas"
                              : mode === "view"
                                ? "Read-only context"
                                : "Available to add";

                        const itemCountLabel = searchQuery.trim().length > 0
                            ? `${category.matchingItemCount} matching item${category.matchingItemCount === 1 ? "" : "s"}`
                            : `${category.itemCount} active item${category.itemCount === 1 ? "" : "s"}`;

                        return (
                            <div
                                key={category.id}
                                className="w-full rounded-2xl border border-border/60 bg-background/90 px-4 py-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span
                                                aria-hidden="true"
                                                className="h-3 w-3 rounded-full border border-black/10"
                                                style={{ backgroundColor: category.previewColor }}
                                            />
                                            <span className="text-sm font-semibold text-foreground">
                                                {category.name}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {category.unavailableReason ?? itemCountLabel}
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="rounded-full">
                                        <Layers3 className="mr-1 h-3.5 w-3.5" />
                                        {statusLabel}
                                    </Badge>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/90 px-4 py-4 text-sm">
                <div className="font-semibold text-foreground">
                    Department source
                </div>
                <div className="mt-2 space-y-1 text-muted-foreground">
                    <div>{department.name}</div>
                    <div>Vote: {department.voteNumber}</div>
                    <div>
                        Budget:{" "}
                        {department.budgetAllocation === null
                            ? "Not allocated"
                            : formatKenyanCurrency(department.budgetAllocation)}
                    </div>
                </div>
            </div>
        </div>
    );
}
