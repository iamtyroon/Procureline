"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogRequestInbox = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const badge_1 = require("@/components/ui/badge");
const button_1 = require("@/components/ui/button");
const card_1 = require("@/components/ui/card");
const catalog_requests_1 = require("@/lib/procurement/catalog-requests");
function getStatusBadgeClassName(tone) {
    if (tone === "approved") {
        return "border-emerald-300 bg-emerald-50 text-emerald-800";
    }
    if (tone === "denied") {
        return "border-rose-300 bg-rose-50 text-rose-800";
    }
    if (tone === "expired") {
        return "border-amber-300 bg-amber-50 text-amber-800";
    }
    return "border-slate-300 bg-slate-100 text-slate-800";
}
function CatalogRequestInbox(props) {
    return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: "rounded-[28px] border-border/70 shadow-sm", children: [(0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "w-fit rounded-full", children: "Request inbox" }), (0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-xl tracking-[-0.04em]", children: "Catalog request history" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2 text-xs text-muted-foreground", children: [(0, jsx_runtime_1.jsxs)(badge_1.Badge, { variant: "outline", className: "rounded-full", children: [props.summary.totalPendingCount, " pending"] }), (0, jsx_runtime_1.jsxs)(badge_1.Badge, { variant: "outline", className: "rounded-full", children: [props.summary.totalCount, " total"] })] })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm leading-6 text-muted-foreground", children: props.mode === "view"
                            ? "Statuses stay visible in read-only mode."
                            : "Pending requests stay editable here until Procurement Officer review begins." })] }), (0, jsx_runtime_1.jsxs)(card_1.CardContent, { className: "space-y-3", children: [props.requests.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground", children: "No catalog requests have been submitted from this planning flow yet." })) : null, props.requests.map((request) => {
                        const statusMeta = (0, catalog_requests_1.buildCatalogRequestStatusMeta)(request.status);
                        return ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-border/70 bg-muted/15 p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "rounded-full", children: request.typeLabel }), (0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: `rounded-full ${getStatusBadgeClassName(statusMeta.badgeTone)}`, children: request.statusLabel ?? statusMeta.label })] }), (0, jsx_runtime_1.jsx)("p", { className: "font-medium text-foreground", children: request.summary }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-muted-foreground", children: ["Submitted ", request.submittedAtLabel, ". Updated ", request.updatedAtLabel, "."] }), request.reason ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: request.reason })) : null] }), props.mode === "edit" &&
                                        (request.canEdit || request.canCancel) ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2", children: [request.canEdit ? ((0, jsx_runtime_1.jsx)(button_1.Button, { onClick: () => props.onEditRequest(request.id), size: "sm", type: "button", variant: "outline", children: "Edit" })) : null, request.canCancel ? ((0, jsx_runtime_1.jsx)(button_1.Button, { onClick: () => props.onCancelRequest(request.id), size: "sm", type: "button", variant: "outline", children: "Cancel" })) : null] })) : null] }) }, request.id));
                    })] })] }));
}
exports.CatalogRequestInbox = CatalogRequestInbox;
