"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlocklyToolboxRail = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
const badge_1 = require("@/components/ui/badge");
const input_1 = require("@/components/ui/input");
function formatKenyanCurrency(amount) {
    return new Intl.NumberFormat("en-KE", {
        currency: "KES",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        style: "currency",
    }).format(amount);
}
function matchesCategorySearch(category, searchQuery) {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
        return true;
    }
    return (category.name.toLocaleLowerCase().includes(normalizedQuery) ||
        category.matchingItemCount > 0);
}
function BlocklyToolboxRail({ categories, department, mode, onSearchQueryChange, searchQuery, }) {
    const visibleCategories = categories.filter((category) => matchesCategorySearch(category, searchQuery));
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-border/60 bg-background/90 px-4 py-3 text-sm text-muted-foreground", children: mode === "edit"
                    ? "Search stays scoped to the selected categories and the live toolbox hides duplicate category source blocks once they are already on the canvas."
                    : "Read-only mode keeps search and category context visible for review, even though block insertion and destructive actions stay disabled." }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", htmlFor: "blockly-toolbox-search", children: "Toolbox search" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), (0, jsx_runtime_1.jsx)(input_1.Input, { className: "pl-9", id: "blockly-toolbox-search", onChange: (event) => onSearchQueryChange(event.target.value), placeholder: "Search items, units, methods, or prices", value: searchQuery })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: visibleCategories.length === 0 ? ((0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "secondary", className: "rounded-full", children: "No categories match this search" })) : (visibleCategories.map((category) => {
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
                    return ((0, jsx_runtime_1.jsx)("div", { className: "w-full rounded-2xl border border-border/60 bg-background/90 px-4 py-3", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { "aria-hidden": "true", className: "h-3 w-3 rounded-full border border-black/10", style: { backgroundColor: category.previewColor } }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm font-semibold text-foreground", children: category.name })] }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-muted-foreground", children: category.unavailableReason ?? itemCountLabel })] }), (0, jsx_runtime_1.jsxs)(badge_1.Badge, { variant: "secondary", className: "rounded-full", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Layers3, { className: "mr-1 h-3.5 w-3.5" }), statusLabel] })] }) }, category.id));
                })) }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-border/60 bg-background/90 px-4 py-4 text-sm", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-foreground", children: "Department source" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 space-y-1 text-muted-foreground", children: [(0, jsx_runtime_1.jsx)("div", { children: department.name }), (0, jsx_runtime_1.jsxs)("div", { children: ["Vote: ", department.voteNumber] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Budget:", " ", department.budgetAllocation === null
                                        ? "Not allocated"
                                        : formatKenyanCurrency(department.budgetAllocation)] })] })] })] }));
}
exports.BlocklyToolboxRail = BlocklyToolboxRail;
