"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlocklyLoadingSkeleton = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const skeleton_1 = require("@/components/ui/skeleton");
function BlocklyLoadingSkeleton() {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]", children: [(0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-32 rounded-[28px]" }), (0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-32 rounded-[28px]" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]", children: [(0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-[72vh] rounded-[28px]" }), (0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-[72vh] rounded-[28px]" })] })] }));
}
exports.BlocklyLoadingSkeleton = BlocklyLoadingSkeleton;
