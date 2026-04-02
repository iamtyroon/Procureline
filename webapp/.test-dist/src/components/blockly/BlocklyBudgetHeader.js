"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlocklyBudgetHeader = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
const progress_1 = require("@/components/ui/progress");
const utils_1 = require("@/lib/utils");
function BlocklyBudgetHeader({ budgetState, }) {
    const accentClass = budgetState.state === "over_budget"
        ? "text-red-700"
        : budgetState.state === "warning"
            ? "text-amber-700"
            : budgetState.state === "safe"
                ? "text-emerald-700"
                : "text-slate-700";
    const progressClass = budgetState.state === "over_budget"
        ? "bg-red-100 [&>div]:bg-red-600"
        : budgetState.state === "warning"
            ? "bg-amber-100 [&>div]:bg-amber-500"
            : budgetState.state === "safe"
                ? "bg-emerald-100 [&>div]:bg-emerald-500"
                : "bg-slate-200 [&>div]:bg-slate-400";
    return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-[26px] border border-border/70 bg-card/95 px-5 py-4 shadow-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground", children: "Budget Meter" }), (0, jsx_runtime_1.jsx)("div", { className: (0, utils_1.cn)("text-2xl font-black tracking-[-0.06em]", accentClass), children: budgetState.usedPercent === null ? "Unallocated" : `${budgetState.usedPercent}% used` })] }), (0, jsx_runtime_1.jsx)("div", { className: (0, utils_1.cn)("flex h-11 w-11 items-center justify-center rounded-2xl", budgetState.state === "over_budget"
                            ? "bg-red-100 text-red-700"
                            : budgetState.state === "warning"
                                ? "bg-amber-100 text-amber-700"
                                : budgetState.state === "safe"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-700"), children: budgetState.state === "over_budget" ? ((0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-5 w-5" })) : budgetState.state === "warning" ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Wallet, { className: "h-5 w-5" })) : budgetState.state === "safe" ? ((0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-5 w-5" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.CircleHelp, { className: "h-5 w-5" })) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-3", children: [(0, jsx_runtime_1.jsx)(progress_1.Progress, { className: (0, utils_1.cn)("h-3 rounded-full", progressClass), value: Math.max(0, Math.min(100, budgetState.usedPercent ?? 0)) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3 text-sm", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-muted-foreground", children: ["Used: ", (0, jsx_runtime_1.jsx)("strong", { className: "text-foreground", children: formatKenyanCurrency(budgetState.usedAmount) })] }), (0, jsx_runtime_1.jsxs)("span", { className: "text-muted-foreground", children: ["Budget:", " ", (0, jsx_runtime_1.jsx)("strong", { className: "text-foreground", children: budgetState.totalBudget === null
                                            ? "Not allocated"
                                            : formatKenyanCurrency(budgetState.totalBudget) })] }), (0, jsx_runtime_1.jsxs)("span", { className: "text-muted-foreground", children: ["Remaining:", " ", (0, jsx_runtime_1.jsx)("strong", { className: "text-foreground", children: budgetState.remainingBudget === null
                                            ? "Unavailable"
                                            : formatKenyanCurrency(budgetState.remainingBudget) })] })] })] })] }));
}
exports.BlocklyBudgetHeader = BlocklyBudgetHeader;
function formatKenyanCurrency(amount) {
    return new Intl.NumberFormat("en-KE", {
        currency: "KES",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        style: "currency",
    }).format(amount);
}
