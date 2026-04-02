"use client";
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlocklyEditor = exports.buildDepartmentUserWorkspaceDraftSaveInput = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const dynamic_1 = __importDefault(require("next/dynamic"));
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const react_2 = require("convex/react");
const lucide_react_1 = require("lucide-react");
const sonner_1 = require("sonner");
const api_1 = require("@/convex/_generated/api");
const alert_1 = require("@/components/ui/alert");
const badge_1 = require("@/components/ui/badge");
const button_1 = require("@/components/ui/button");
const card_1 = require("@/components/ui/card");
const BlocklyBudgetHeader_1 = require("@/src/components/blockly/BlocklyBudgetHeader");
const BlocklyLoadingSkeleton_1 = require("@/src/components/blockly/BlocklyLoadingSkeleton");
const editor_contract_1 = require("@/lib/blockly/editor-contract");
const du_toolbox_1 = require("@/lib/blockly/du-toolbox");
const du_workspace_calculations_1 = require("@/lib/blockly/du-workspace-calculations");
const BlocklyWorkspace_module_css_1 = __importDefault(require("./BlocklyWorkspace.module.css"));
const LazyBlocklyWorkspace = (0, dynamic_1.default)(() => import("./BlocklyWorkspace").then((module) => ({
    default: module.BlocklyWorkspace,
})), {
    loading: () => (0, jsx_runtime_1.jsx)(BlocklyLoadingSkeleton_1.BlocklyLoadingSkeleton, {}),
    ssr: false,
});
function buildDepartmentUserWorkspaceDraftSaveInput(args) {
    const categoriesByName = new Map(args.categories.map((category) => [category.name, category.id]));
    return {
        categorySummaries: args.rollup?.categories.map((category) => ({
            amount: category.totalCost,
            categoryId: categoriesByName.get(category.categoryName) ?? category.categoryId,
            categoryName: category.categoryName,
            itemCount: category.itemCount,
        })) ?? [],
        estimatedBudgetUsed: args.rollup?.departmentTotal ?? 0,
        itemCount: args.rollup?.totalItemCount ?? 0,
        planId: args.planId,
        selectedCategoryIds: args.selectedCategoryIds,
        workspaceState: args.workspaceState,
    };
}
exports.buildDepartmentUserWorkspaceDraftSaveInput = buildDepartmentUserWorkspaceDraftSaveInput;
function BlocklyEditor(props) {
    const saveWorkspaceDraft = (0, react_2.useMutation)(api_1.api.functions.plans.saveDepartmentUserWorkspaceDraft);
    const toolbox = (0, react_1.useMemo)(() => (0, du_toolbox_1.buildDepartmentUserToolbox)({
        categories: props.categories,
        department: {
            budgetAllocation: props.department.budgetAllocation,
            departmentId: props.department.id,
            departmentName: props.department.name,
            voteNumber: props.department.voteNumber,
        },
        items: props.items,
        selectedCategoryIds: props.selectedCategoryIds,
    }), [props.categories, props.department, props.items, props.selectedCategoryIds]);
    const [budgetState, setBudgetState] = (0, react_1.useState)(() => (0, du_workspace_calculations_1.mapDepartmentUserBudgetMeterState)({
        totalBudget: props.department.budgetAllocation,
        usedAmount: 0,
    }));
    const [saveState, setSaveState] = (0, react_1.useState)("idle");
    const [lastSavedAt, setLastSavedAt] = (0, react_1.useState)(props.workspaceState?.editorMetadata.lastSavedAt ?? null);
    const presentation = (0, react_1.useMemo)(() => (0, editor_contract_1.buildPlanningWorkspacePresentation)({
        actor: props.actor,
        actorLabel: props.actorLabel,
        mode: props.mode,
    }), [props.actor, props.actorLabel, props.mode]);
    async function handleWorkspaceChange(payload) {
        setBudgetState((0, du_workspace_calculations_1.mapDepartmentUserBudgetMeterState)({
            totalBudget: props.department.budgetAllocation,
            usedAmount: payload.rollup?.departmentTotal ?? 0,
        }));
        if (props.mode !== "edit") {
            return;
        }
        setSaveState("saving");
        try {
            const result = await saveWorkspaceDraft(buildDepartmentUserWorkspaceDraftSaveInput({
                categories: props.categories,
                planId: props.planId,
                rollup: payload.rollup,
                selectedCategoryIds: toolbox.sanitizedCategoryIds,
                workspaceState: payload.workspaceState,
            }));
            setLastSavedAt(result.savedAt);
            setSaveState("saved");
        }
        catch {
            setSaveState("error");
            sonner_1.toast.error("Draft workspace sync failed. Your current session is still open.");
        }
    }
    function handleReservedAction(message) {
        (0, sonner_1.toast)(message);
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]", children: [(0, jsx_runtime_1.jsx)(card_1.Card, { className: "rounded-[28px] border-border/70 shadow-sm", children: (0, jsx_runtime_1.jsx)(card_1.CardHeader, { className: "gap-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(badge_1.Badge, { className: "rounded-full bg-primary text-primary-foreground hover:bg-primary", children: presentation.badgeLabel }), (0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "secondary", className: "rounded-full", children: presentation.actorBadgeLabel }), (0, jsx_runtime_1.jsxs)(badge_1.Badge, { variant: "outline", className: "rounded-full", children: ["FY ", props.fiscalYear] }), (props.modeIndicatorLabel ?? presentation.modeIndicatorLabel) ? ((0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "rounded-full", children: props.modeIndicatorLabel ?? presentation.modeIndicatorLabel })) : null, props.mode === "view" ? ((0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "rounded-full border-amber-300 bg-amber-50 text-amber-800", children: "Read-only" })) : null] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-3xl tracking-[-0.05em] text-foreground", children: props.department.name }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 max-w-3xl text-sm leading-7 text-muted-foreground", children: props.subtitle })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-end gap-2", children: [(0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "rounded-full", children: saveState === "saving"
                                                    ? "Saving draft..."
                                                    : saveState === "saved"
                                                        ? lastSavedAt
                                                            ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
                                                            : "Saved"
                                                        : saveState === "error"
                                                            ? "Save failed"
                                                            : "Draft open" }), (0, jsx_runtime_1.jsx)(button_1.Button, { asChild: true, type: "button", variant: "outline", children: (0, jsx_runtime_1.jsxs)(link_1.default, { href: "/du", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "mr-2 h-4 w-4" }), "Exit"] }) }), (0, jsx_runtime_1.jsxs)(button_1.Button, { onClick: () => (0, react_1.startTransition)(() => handleReservedAction("Item request handoff stays reserved until Story 5.5 lands.")), type: "button", variant: "outline", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.PackagePlus, { className: "mr-2 h-4 w-4" }), "Request Item"] }), (0, jsx_runtime_1.jsxs)(button_1.Button, { onClick: () => (0, react_1.startTransition)(() => handleReservedAction("Export handoff stays reserved until the export stories land.")), type: "button", variant: "outline", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.FileDown, { className: "mr-2 h-4 w-4" }), "Export"] }), (0, jsx_runtime_1.jsxs)(button_1.Button, { onClick: () => (0, react_1.startTransition)(() => handleReservedAction("Submission stays reserved until Story 6.1 completes the plan-submission flow.")), type: "button", variant: props.mode === "edit" ? "default" : "outline", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Send, { className: "mr-2 h-4 w-4" }), "Submit"] })] })] }) }) }), (0, jsx_runtime_1.jsx)(BlocklyBudgetHeader_1.BlocklyBudgetHeader, { budgetState: budgetState })] }), props.mode === "view" ? ((0, jsx_runtime_1.jsxs)(alert_1.Alert, { className: "rounded-2xl border-amber-300 bg-amber-50 text-amber-900", children: [(0, jsx_runtime_1.jsx)(alert_1.AlertTitle, { children: "Read-only planning surface" }), (0, jsx_runtime_1.jsx)(alert_1.AlertDescription, { children: presentation.readOnlyMessage })] })) : null, props.unavailableCategories.length > 0 ? ((0, jsx_runtime_1.jsxs)(alert_1.Alert, { className: "rounded-2xl border-border/70 bg-muted/30", children: [(0, jsx_runtime_1.jsx)(alert_1.AlertTitle, { children: "Unavailable selected categories" }), (0, jsx_runtime_1.jsx)(alert_1.AlertDescription, { children: props.unavailableCategories
                            .map((category) => `${category.name}: ${category.reason}`)
                            .join(" ") })] })) : null, (0, jsx_runtime_1.jsxs)("div", { className: BlocklyWorkspace_module_css_1.default.editorGrid, children: [(0, jsx_runtime_1.jsxs)(card_1.Card, { className: BlocklyWorkspace_module_css_1.default.toolboxRail, children: [(0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "w-fit rounded-full", children: "Toolbox contract" }), (0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-xl tracking-[-0.04em]", children: "Selected categories" })] }), (0, jsx_runtime_1.jsxs)(card_1.CardContent, { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-border/60 bg-background/90 px-4 py-3 text-sm text-muted-foreground", children: props.mode === "edit"
                                            ? "The live Blockly toolbox stays scoped to these categories and the department source block."
                                            : "Read-only mode keeps the selected category context visible even when Blockly toolbox editing is disabled." }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: toolbox.sanitizedCategoryIds.length === 0 ? ((0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "secondary", className: "rounded-full", children: "No active categories available" })) : (toolbox.sanitizedCategoryIds.map((categoryId) => {
                                            const category = props.categories.find((candidate) => candidate.id === categoryId);
                                            return ((0, jsx_runtime_1.jsxs)(badge_1.Badge, { variant: "secondary", className: "rounded-full", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Layers3, { className: "mr-1 h-3.5 w-3.5" }), category?.name ?? categoryId] }, categoryId));
                                        })) }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-border/60 bg-background/90 px-4 py-4 text-sm", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-foreground", children: "Department source" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 space-y-1 text-muted-foreground", children: [(0, jsx_runtime_1.jsx)("div", { children: props.department.name }), (0, jsx_runtime_1.jsxs)("div", { children: ["Vote: ", props.department.voteNumber] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Budget:", " ", props.department.budgetAllocation === null
                                                                ? "Not allocated"
                                                                : formatKenyanCurrency(props.department.budgetAllocation)] })] })] })] })] }), (0, jsx_runtime_1.jsx)(LazyBlocklyWorkspace, { budgetAllocation: props.department.budgetAllocation, currentUserId: props.currentUserId, editorMode: props.mode, onBudgetStateChange: setBudgetState, onWorkspaceChange: (payload) => {
                            void handleWorkspaceChange(payload);
                        }, selectedCategoryIds: toolbox.sanitizedCategoryIds, toolboxDefinition: toolbox.toolboxDefinition, workspaceState: props.workspaceState })] })] }));
}
exports.BlocklyEditor = BlocklyEditor;
function formatKenyanCurrency(amount) {
    return new Intl.NumberFormat("en-KE", {
        currency: "KES",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        style: "currency",
    }).format(amount);
}
