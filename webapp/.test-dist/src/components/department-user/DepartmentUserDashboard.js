"use client";
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlansCard = exports.PlanStatCard = exports.DepartmentUserDashboard = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
const react_1 = require("convex/react");
const lucide_react_1 = require("lucide-react");
const react_2 = require("react");
const navigation_1 = require("next/navigation");
const api_1 = require("@/convex/_generated/api");
const alert_1 = require("@/components/ui/alert");
const badge_1 = require("@/components/ui/badge");
const button_1 = require("@/components/ui/button");
const card_1 = require("@/components/ui/card");
const checkbox_1 = require("@/components/ui/checkbox");
const dialog_1 = require("@/components/ui/dialog");
const scroll_area_1 = require("@/components/ui/scroll-area");
const skeleton_1 = require("@/components/ui/skeleton");
const textarea_1 = require("@/components/ui/textarea");
const dashboard_1 = require("@/lib/department-user/dashboard");
const utils_1 = require("@/lib/utils");
const sonner_1 = require("sonner");
function DepartmentUserDashboard() {
    const router = (0, navigation_1.useRouter)();
    const snapshot = (0, react_1.useQuery)(api_1.api.functions.departmentUserDashboard.getDepartmentUserDashboardSnapshot, {});
    const requestRedraft = (0, react_1.useMutation)(api_1.api.functions.planRedrafts.requestDepartmentUserPlanRedraft);
    const withdrawSubmission = (0, react_1.useMutation)(api_1.api.functions.plans.withdrawDepartmentUserPlanSubmission);
    const [selectedCategoryIds, setSelectedCategoryIds] = (0, react_2.useState)([]);
    const [redraftPlanId, setRedraftPlanId] = (0, react_2.useState)(null);
    const [redraftReason, setRedraftReason] = (0, react_2.useState)("");
    const [isRedraftSubmitting, setIsRedraftSubmitting] = (0, react_2.useState)(false);
    const [isWithdrawSubmitting, setIsWithdrawSubmitting] = (0, react_2.useState)(false);
    (0, react_2.useEffect)(() => {
        if (!snapshot) {
            return;
        }
        const availableCategoryIds = snapshot.launchpad.categories
            .filter((category) => !category.disabled)
            .map((category) => category.id);
        if (!snapshot.launchpad.canSelectCategories) {
            setSelectedCategoryIds(snapshot.launchpad.selectedCategoryIds);
            return;
        }
        setSelectedCategoryIds((current) => (0, dashboard_1.sanitizeCategorySelection)({
            availableCategoryIds,
            selectedCategoryIds: current,
        }));
    }, [snapshot]);
    if (!snapshot) {
        return (0, jsx_runtime_1.jsx)(DepartmentUserDashboardSkeleton, {});
    }
    if (snapshot.meta.viewState === "blocked") {
        return (0, jsx_runtime_1.jsx)(DepartmentUserBlockedState, { message: snapshot.meta.blockedMessage, title: snapshot.meta.blockedTitle });
    }
    const dashboardSnapshot = snapshot;
    const effectiveSelectedCategoryIds = dashboardSnapshot.launchpad.canSelectCategories
        ? selectedCategoryIds
        : dashboardSnapshot.launchpad.selectedCategoryIds;
    const launchpadInteractivity = (0, dashboard_1.deriveLaunchpadInteractivity)({
        canSelectCategories: dashboardSnapshot.launchpad.canSelectCategories,
        disabledReason: dashboardSnapshot.launchpad.disabledReason,
        primaryAction: dashboardSnapshot.launchpad.primaryAction,
        selectedCategoryCount: effectiveSelectedCategoryIds.length,
        state: dashboardSnapshot.launchpad.state,
    });
    const launchpadActionLabel = dashboardSnapshot.launchpad.primaryAction.kind === "create"
        ? "+ New Plan"
        : dashboardSnapshot.launchpad.primaryAction.label;
    function handleLaunchpadAction() {
        if (launchpadInteractivity.disabled) {
            return;
        }
        if (dashboardSnapshot.launchpad.primaryAction.kind === "create") {
            const params = new URLSearchParams();
            params.set("fiscalYear", dashboardSnapshot.meta.fiscalYearKey);
            if (effectiveSelectedCategoryIds.length > 0) {
                params.set("categories", effectiveSelectedCategoryIds.join(","));
            }
            router.push(`/du/plans/new?${params.toString()}`);
            return;
        }
        router.push(dashboardSnapshot.launchpad.primaryAction.href);
    }
    function handleCategorySelectionChange(categoryId, checked) {
        const availableCategoryIds = dashboardSnapshot.launchpad.categories
            .filter((category) => !category.disabled)
            .map((category) => category.id);
        setSelectedCategoryIds((current) => checked
            ? (0, dashboard_1.sanitizeCategorySelection)({
                availableCategoryIds,
                selectedCategoryIds: [...current, categoryId],
            })
            : current.filter((id) => id !== categoryId));
    }
    async function handleSubmitRedraftRequest() {
        if (!redraftPlanId || isRedraftSubmitting) {
            return;
        }
        setIsRedraftSubmitting(true);
        try {
            await requestRedraft({
                planId: redraftPlanId,
                reason: redraftReason,
            });
            sonner_1.toast.success("Reopen request sent to your Procurement Officer for approval.");
            setRedraftPlanId(null);
            setRedraftReason("");
        }
        catch (error) {
            sonner_1.toast.error(error instanceof Error
                ? error.message
                : "The redraft request could not be sent.");
        }
        finally {
            setIsRedraftSubmitting(false);
        }
    }
    async function handleWithdrawSubmission() {
        const currentRow = dashboardSnapshot.plans.rows.find((row) => row.isCurrentFiscalYear);
        if (!currentRow || isWithdrawSubmitting || !dashboardSnapshot.quickStats.plan.canWithdraw) {
            return;
        }
        setIsWithdrawSubmitting(true);
        try {
            await withdrawSubmission({
                planId: currentRow.id,
            });
            sonner_1.toast.success("Submission withdrawn. This draft is editable again.");
        }
        catch (error) {
            sonner_1.toast.error(error instanceof Error
                ? error.message
                : "The submission could not be withdrawn right now.");
        }
        finally {
            setIsWithdrawSubmitting(false);
        }
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-[calc(100vh-4rem)] bg-background", children: [(0, jsx_runtime_1.jsx)("div", { className: "px-4 py-8 sm:px-6 lg:hidden", children: (0, jsx_runtime_1.jsx)(card_1.Card, { className: "mx-auto max-w-2xl rounded-[24px] border-border/70 bg-card shadow-sm", children: (0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)(badge_1.Badge, { className: "w-fit rounded-md bg-primary text-primary-foreground hover:bg-primary", children: "Desktop required" }), (0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-2xl text-foreground", children: "Department User dashboards are designed for desktop viewports" }), (0, jsx_runtime_1.jsx)(card_1.CardDescription, { className: "text-base leading-7 text-muted-foreground", children: "This workspace follows the desktop-only DU planning layout from the Procureline UX specification." })] }) }) }), (0, jsx_runtime_1.jsx)("div", { className: "hidden lg:block", children: (0, jsx_runtime_1.jsxs)("div", { className: "mx-auto flex w-full max-w-none flex-col gap-4 px-4 py-4 xl:px-5", children: [dashboardSnapshot.rejectionNotice ? ((0, jsx_runtime_1.jsxs)(alert_1.Alert, { className: "rounded-2xl border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100", dismissible: true, dismissKey: `${dashboardSnapshot.rejectionNotice.title}-${dashboardSnapshot.rejectionNotice.message}-${dashboardSnapshot.rejectionNotice.action.href}`, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)(alert_1.AlertTitle, { children: dashboardSnapshot.rejectionNotice.title }), (0, jsx_runtime_1.jsxs)(alert_1.AlertDescription, { className: "flex items-center justify-between gap-4", children: [(0, jsx_runtime_1.jsx)("span", { children: dashboardSnapshot.rejectionNotice.message }), (0, jsx_runtime_1.jsx)(button_1.Button, { asChild: true, size: "sm", className: "rounded-full", children: (0, jsx_runtime_1.jsx)(link_1.default, { href: dashboardSnapshot.rejectionNotice.action.href, children: dashboardSnapshot.rejectionNotice.action.label }) })] })] })) : null, (0, jsx_runtime_1.jsx)(OperationalOverview, { isWithdrawing: isWithdrawSubmitting, launchpadActionLabel: launchpadActionLabel, launchpadDisabled: launchpadInteractivity.disabled, launchpadStatusLabel: launchpadInteractivity.statusLabel, onLaunchpadAction: handleLaunchpadAction, onSelectionChange: handleCategorySelectionChange, onRequestRedraft: () => {
                                const approvedRow = dashboardSnapshot.plans.rows.find((row) => row.isCurrentFiscalYear &&
                                    row.statusLabel === "Approved");
                                if (approvedRow) {
                                    setRedraftPlanId(approvedRow.id);
                                }
                            }, onWithdrawSubmission: () => void handleWithdrawSubmission(), selectedCategoryIds: effectiveSelectedCategoryIds, snapshot: dashboardSnapshot })] }) }), (0, jsx_runtime_1.jsx)(dialog_1.Dialog, { open: redraftPlanId !== null, onOpenChange: (open) => {
                    if (!open && !isRedraftSubmitting) {
                        setRedraftPlanId(null);
                        setRedraftReason("");
                    }
                }, children: (0, jsx_runtime_1.jsxs)(dialog_1.DialogContent, { className: "sm:max-w-lg", children: [(0, jsx_runtime_1.jsxs)(dialog_1.DialogHeader, { children: [(0, jsx_runtime_1.jsx)(dialog_1.DialogTitle, { children: "Request approved plan reopen" }), (0, jsx_runtime_1.jsx)(dialog_1.DialogDescription, { children: "Send a request to your Procurement Officer to approve reopening this plan for editing. This does not unlock the plan immediately." })] }), (0, jsx_runtime_1.jsx)(textarea_1.Textarea, { value: redraftReason, onChange: (event) => setRedraftReason(event.target.value), placeholder: "Explain what needs to change in the approved plan." }), (0, jsx_runtime_1.jsxs)(dialog_1.DialogFooter, { children: [(0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "outline", disabled: isRedraftSubmitting, onClick: () => {
                                        setRedraftPlanId(null);
                                        setRedraftReason("");
                                    }, children: "Cancel" }), (0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", disabled: isRedraftSubmitting || redraftReason.trim().length < 8, onClick: () => void handleSubmitRedraftRequest(), children: isRedraftSubmitting ? "Sending..." : "Send request" })] })] }) })] }));
}
exports.DepartmentUserDashboard = DepartmentUserDashboard;
function OperationalOverview({ isWithdrawing, launchpadActionLabel, launchpadDisabled, launchpadStatusLabel, onLaunchpadAction, onSelectionChange, onRequestRedraft, onWithdrawSubmission, selectedCategoryIds, snapshot, }) {
    const budget = snapshot.quickStats.budget;
    const plan = snapshot.quickStats.plan;
    const deadline = snapshot.quickStats.deadline;
    const categories = budget.breakdown.items;
    const currentPlan = snapshot.plans.rows.find((row) => row.isCurrentFiscalYear);
    const pendingApprovals = plan.statusLabel === "Submitted" || plan.statusLabel === "Under Review" ? 1 : 0;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-xl font-semibold tracking-tight text-foreground", children: "Overview" }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-sm text-muted-foreground", children: [snapshot.heroSupport.departmentName, " procurement workspace"] })] }), (0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", className: "rounded-full", disabled: launchpadDisabled, onClick: () => (0, react_2.startTransition)(onLaunchpadAction), children: launchpadActionLabel })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 xl:grid-cols-5", children: [(0, jsx_runtime_1.jsx)(MetricTile, { icon: (0, jsx_runtime_1.jsx)(lucide_react_1.BarChart3, { className: "h-4 w-4" }), label: "Plan Utilization", value: budget.state === "available" ? `${budget.utilizationPercent}%` : "--", detail: `${budget.usedBudgetLabel} of ${budget.totalBudgetLabel}`, accent: "emerald", progress: budget.utilizationPercent }), (0, jsx_runtime_1.jsx)(MetricTile, { icon: (0, jsx_runtime_1.jsx)(lucide_react_1.Boxes, { className: "h-4 w-4" }), label: "Budgeted Amount", value: budget.totalBudgetLabel, detail: `FY ${snapshot.meta.fiscalYearKey}`, accent: "blue" }), (0, jsx_runtime_1.jsx)(MetricTile, { icon: (0, jsx_runtime_1.jsx)(lucide_react_1.ClipboardList, { className: "h-4 w-4" }), label: "Total Items", value: String(plan.itemCount), detail: `Across ${categories.length} categories`, accent: "emerald" }), (0, jsx_runtime_1.jsx)(MetricTile, { icon: (0, jsx_runtime_1.jsx)(lucide_react_1.FileClock, { className: "h-4 w-4" }), label: "Pending Approvals", value: String(pendingApprovals), detail: plan.statusLabel, accent: "violet" }), (0, jsx_runtime_1.jsx)(MetricTile, { icon: (0, jsx_runtime_1.jsx)(lucide_react_1.CalendarClock, { className: "h-4 w-4" }), label: "Submission Deadline", value: deadline.deadlineDateLabel, detail: deadline.note, accent: "emerald" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,2.3fr)_minmax(280px,0.9fr)]", children: [(0, jsx_runtime_1.jsx)(PlanSummaryCard, { budget: budget, categories: categories, primaryHref: plan.primaryActionHref }), (0, jsx_runtime_1.jsx)(TimelineCard, { timeline: plan.timeline })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,2.7fr)_minmax(280px,0.95fr)]", children: [(0, jsx_runtime_1.jsx)(PlanCategoriesCard, { canSelectCategories: snapshot.launchpad.canSelectCategories, categories: snapshot.launchpad.categories, launchpadStatusLabel: launchpadStatusLabel, onSelectionChange: onSelectionChange, selectedCategoryIds: selectedCategoryIds }), (0, jsx_runtime_1.jsx)(DepartmentNotesCard, { currentPlan: currentPlan, isWithdrawing: isWithdrawing, onRequestRedraft: onRequestRedraft, onWithdrawSubmission: onWithdrawSubmission, plan: plan, snapshot: snapshot })] })] }));
}
function MetricTile({ accent, detail, icon, label, progress, value, }) {
    const accentClass = {
        blue: "bg-blue-500/10 text-blue-300",
        emerald: "bg-emerald-500/10 text-emerald-300",
        violet: "bg-violet-500/10 text-violet-300",
    }[accent];
    return ((0, jsx_runtime_1.jsx)(card_1.Card, { className: "rounded-xl border-border/60 bg-card/95 shadow-sm", children: (0, jsx_runtime_1.jsxs)(card_1.CardContent, { className: "p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "min-w-0", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground", children: label }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 break-words text-2xl font-black text-foreground", children: value }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 text-xs leading-5 text-muted-foreground", children: detail })] }), (0, jsx_runtime_1.jsx)("div", { className: (0, utils_1.cn)("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", accentClass), children: icon })] }), typeof progress === "number" ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-4 h-2 rounded-full bg-muted", children: (0, jsx_runtime_1.jsx)("div", { className: "h-full rounded-full bg-primary", style: { width: `${Math.max(0, Math.min(100, progress))}%` } }) })) : null] }) }));
}
function PlanSummaryCard({ budget, categories, primaryHref, }) {
    return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: "rounded-xl border-border/60 bg-card/95 shadow-sm", children: [(0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "flex flex-row items-center justify-between pb-3", children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-base font-semibold", children: "Annual Procurement Plan Summary" }), (0, jsx_runtime_1.jsx)(button_1.Button, { asChild: true, size: "sm", variant: "outline", className: "rounded-lg", children: (0, jsx_runtime_1.jsx)(link_1.default, { href: primaryHref, children: "View Full Plan" }) })] }), (0, jsx_runtime_1.jsx)(card_1.CardContent, { children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-border/60 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground", children: [(0, jsx_runtime_1.jsx)("th", { className: "py-3 font-medium", children: "Category" }), (0, jsx_runtime_1.jsx)("th", { className: "py-3 text-right font-medium", children: "Items" }), (0, jsx_runtime_1.jsx)("th", { className: "py-3 text-right font-medium", children: "Total" }), (0, jsx_runtime_1.jsx)("th", { className: "py-3 text-right font-medium", children: "% of Total" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { children: [categories.map((category) => {
                                    const percent = budget.totalBudget > 0 ? (category.amount / budget.totalBudget) * 100 : 0;
                                    return ((0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-border/40 last:border-b-0", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-3 font-medium text-foreground", children: category.categoryName }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 text-right text-muted-foreground", children: category.itemCountLabel.replace(/ items?/, "") }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 text-right font-medium text-foreground", children: category.amountLabel }), (0, jsx_runtime_1.jsx)("td", { className: "py-3", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-end gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "w-12 text-right font-medium text-foreground", children: formatPercent(percent) }), (0, jsx_runtime_1.jsx)(ProgressBar, { value: percent })] }) })] }, category.id));
                                }), (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { className: "py-3 font-semibold text-foreground", children: "Total" }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 text-right font-semibold text-foreground", children: categories.reduce((total, item) => total + parseItemCount(item.itemCountLabel), 0) }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 text-right font-semibold text-foreground", children: budget.totalBudgetLabel }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 text-right font-semibold text-foreground", children: "100%" })] })] })] }) })] }));
}
function TimelineCard({ timeline, }) {
    const steps = timeline.length > 0
        ? timeline
        : [
            { description: "--", id: "created", timestampLabel: "--", title: "Plan Created" },
            { description: "--", id: "planning", timestampLabel: "--", title: "In Planning" },
            { description: "--", id: "approval", timestampLabel: "--", title: "For Approval" },
            { description: "--", id: "approved", timestampLabel: "--", title: "Approved" },
            { description: "--", id: "implementation", timestampLabel: "--", title: "Implementation" },
            { description: "--", id: "completed", timestampLabel: "--", title: "Completed" },
        ];
    return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: "rounded-xl border-border/60 bg-card/95 shadow-sm", children: [(0, jsx_runtime_1.jsx)(card_1.CardHeader, { className: "pb-3", children: (0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-base font-semibold", children: "Plan Timeline" }) }), (0, jsx_runtime_1.jsx)(card_1.CardContent, { className: "space-y-4", children: steps.map((item, index) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-center", children: [(0, jsx_runtime_1.jsx)("div", { className: (0, utils_1.cn)("flex h-6 w-6 items-center justify-center rounded-full border", index < timeline.length
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-muted text-muted-foreground"), children: index < timeline.length ? (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-3.5 w-3.5" }) : null }), index < steps.length - 1 ? (0, jsx_runtime_1.jsx)("div", { className: "mt-2 h-7 w-px bg-border" }) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "min-w-0 pb-1", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-foreground", children: item.title }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-xs text-muted-foreground", children: item.timestampLabel })] })] }, item.id))) })] }));
}
function PlanCategoriesCard({ canSelectCategories, categories, launchpadStatusLabel, onSelectionChange, selectedCategoryIds, }) {
    const selectedCount = selectedCategoryIds.length;
    return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: "rounded-xl border-border/60 bg-card/95 shadow-sm", children: [(0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "flex flex-row items-center justify-between pb-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-base font-semibold", children: "Plan Categories" }), (0, jsx_runtime_1.jsx)(card_1.CardDescription, { children: "Select the categories your department will use in this fiscal-year plan." })] }), (0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "rounded-lg", children: selectedCount > 0 ? `${selectedCount} selected` : launchpadStatusLabel })] }), (0, jsx_runtime_1.jsx)(card_1.CardContent, { className: "space-y-3", children: categories.length > 0 ? ((0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-border/60 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground", children: [(0, jsx_runtime_1.jsx)("th", { className: "w-12 py-3 font-medium", children: "Use" }), (0, jsx_runtime_1.jsx)("th", { className: "py-3 font-medium", children: "Category" }), (0, jsx_runtime_1.jsx)("th", { className: "py-3 font-medium", children: "Availability" }), (0, jsx_runtime_1.jsx)("th", { className: "py-3 text-right font-medium", children: "Items" }), (0, jsx_runtime_1.jsx)("th", { className: "py-3 text-right font-medium", children: "Status" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: categories.map((category) => {
                                const checked = selectedCategoryIds.includes(category.id);
                                const disabled = !canSelectCategories || category.disabled;
                                return ((0, jsx_runtime_1.jsxs)("tr", { className: (0, utils_1.cn)("border-b border-border/40 last:border-b-0", checked ? "bg-primary/5" : null, disabled ? "text-muted-foreground" : null), children: [(0, jsx_runtime_1.jsx)("td", { className: "py-4 align-top", children: (0, jsx_runtime_1.jsx)(checkbox_1.Checkbox, { "aria-label": `Use ${category.name} in this departmental plan`, checked: checked, disabled: disabled, onCheckedChange: (value) => onSelectionChange(category.id, value === true) }) }), (0, jsx_runtime_1.jsxs)("td", { className: "py-4 align-top", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-foreground", children: category.name }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 text-xs text-muted-foreground", children: [category.itemCountLabel, " available for planning"] })] }), (0, jsx_runtime_1.jsx)("td", { className: "max-w-[340px] py-4 align-top text-muted-foreground", children: category.disabledReason ??
                                                (canSelectCategories
                                                    ? "Available for this departmental plan."
                                                    : "Category selection is locked for this plan state.") }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 text-right align-top text-foreground", children: category.itemCount }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 text-right align-top", children: (0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: (0, utils_1.cn)("rounded-full", checked
                                                    ? "border-primary/30 text-primary"
                                                    : "text-muted-foreground"), children: checked ? "Selected" : disabled ? "Unavailable" : "Optional" }) })] }, category.id));
                            }) })] })) : ((0, jsx_runtime_1.jsx)(EmptyOperationalState, { label: "No plan categories are available for this department yet." })) })] }));
}
function DepartmentNotesCard({ currentPlan, isWithdrawing, onRequestRedraft, onWithdrawSubmission, plan, snapshot, }) {
    return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: "rounded-xl border-border/60 bg-card/95 shadow-sm", children: [(0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "flex flex-row items-center justify-between pb-3", children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-base font-semibold", children: "Department Notes" }), (0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", size: "sm", variant: "outline", disabled: true, className: "rounded-lg", children: "Edit" })] }), (0, jsx_runtime_1.jsxs)(card_1.CardContent, { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.NotebookPen, { className: "mx-auto h-5 w-5 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3 font-medium text-foreground", children: "No notes added" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-xs leading-5 text-muted-foreground", children: "Add notes to keep track of important information." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 text-sm", children: [(0, jsx_runtime_1.jsx)(InfoLine, { label: "Department", value: snapshot.heroSupport.departmentName }), (0, jsx_runtime_1.jsx)(InfoLine, { label: "Fiscal year", value: snapshot.meta.fiscalYearKey }), (0, jsx_runtime_1.jsx)(InfoLine, { label: "Plan status", value: plan.statusLabel }), currentPlan?.submissionReference ? ((0, jsx_runtime_1.jsx)(InfoLine, { label: "Reference", value: currentPlan.submissionReference })) : null] }), plan.canWithdraw ? ((0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "outline", className: "w-full rounded-lg", disabled: isWithdrawing, onClick: onWithdrawSubmission, children: isWithdrawing ? "Withdrawing..." : "Withdraw submission" })) : null, plan.redraftRequest.canRequest ? ((0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "outline", className: "w-full rounded-lg", onClick: onRequestRedraft, children: "Request reopen approval" })) : null] })] }));
}
function InfoLine({ label, value }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-muted-foreground", children: label }), (0, jsx_runtime_1.jsx)("span", { className: "text-right font-medium text-foreground", children: value })] }));
}
function EmptyOperationalState({ label }) {
    return ((0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground", children: label }));
}
function ProgressBar({ value }) {
    return ((0, jsx_runtime_1.jsx)("div", { className: "h-2 w-24 rounded-full bg-muted", children: (0, jsx_runtime_1.jsx)("div", { className: "h-full rounded-full bg-primary", style: { width: `${Math.max(0, Math.min(100, value))}%` } }) }));
}
function parseItemCount(label) {
    return Number.parseInt(label, 10) || 0;
}
function formatPercent(value) {
    if (!Number.isFinite(value)) {
        return "0%";
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}
function PlanStatCard({ isWithdrawing, onRequestRedraft, onWithdrawSubmission, plan, }) {
    return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: "rounded-[26px] border-border/70 shadow-sm", children: [(0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "space-y-3 pb-4", children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground", children: "Items in Plan" }), (0, jsx_runtime_1.jsx)("div", { className: "text-5xl font-black tracking-[-0.08em] text-foreground", children: plan.itemCount }), (0, jsx_runtime_1.jsx)(card_1.CardDescription, { className: "text-base text-muted-foreground", children: plan.statusLabel })] }), (0, jsx_runtime_1.jsxs)(card_1.CardContent, { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-border/60 bg-muted/30 px-4 py-4 text-sm text-muted-foreground", children: plan.helperText }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-2", children: [plan.statusDateLabel ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground", children: "Latest update" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 font-medium text-foreground", children: plan.statusDateLabel })] })) : null, plan.reviewerLabel || plan.reviewerState === "unavailable" ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground", children: "Reviewer" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 font-medium text-foreground", children: plan.reviewerLabel ?? "Procurement Officer review in progress" })] })) : null] }), plan.submissionReference ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900", children: ["Submission reference: ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: plan.submissionReference })] })) : null, plan.historySummary ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900", children: plan.historySummary })) : null, plan.redraftRequest.pendingRequestId ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900", children: "Redraft request pending PO approval." })) : null, plan.timeline.length > 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-border/60 bg-background px-4 py-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-3 flex items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm font-semibold text-foreground", children: "Status history" }), (0, jsx_runtime_1.jsxs)(badge_1.Badge, { variant: "outline", className: "rounded-full", children: [plan.timeline.length, " events"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: plan.timeline.map((item) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" }), (0, jsx_runtime_1.jsxs)("div", { className: "min-w-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium text-foreground", children: item.title }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-muted-foreground", children: item.timestampLabel })] }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm leading-6 text-muted-foreground", children: item.description })] })] }, item.id))) })] })) : null, plan.statusLabel !== "No Plan" ? ((0, jsx_runtime_1.jsx)(button_1.Button, { asChild: true, className: "w-full rounded-2xl", children: (0, jsx_runtime_1.jsxs)(link_1.default, { href: plan.primaryActionHref, children: [plan.primaryActionLabel, (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowRight, { className: "ml-2 h-4 w-4" })] }) })) : null, plan.canWithdraw ? ((0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "outline", className: "w-full rounded-2xl", disabled: isWithdrawing, onClick: onWithdrawSubmission, children: isWithdrawing ? "Withdrawing..." : "Withdraw submission" })) : null, plan.redraftRequest.canRequest ? ((0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "outline", className: "w-full rounded-2xl", onClick: onRequestRedraft, children: "Request reopen approval" })) : null] })] }));
}
exports.PlanStatCard = PlanStatCard;
function StatusIcon({ statusLabel }) {
    if (statusLabel === "Approved") {
        return (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-3.5 w-3.5" });
    }
    if (statusLabel === "Rejected") {
        return (0, jsx_runtime_1.jsx)(lucide_react_1.XCircle, { className: "h-3.5 w-3.5" });
    }
    if (statusLabel === "Under Review") {
        return (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-3.5 w-3.5" });
    }
    if (statusLabel === "Submitted") {
        return (0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCcw, { className: "h-3.5 w-3.5" });
    }
    return (0, jsx_runtime_1.jsx)(lucide_react_1.Clock3, { className: "h-3.5 w-3.5" });
}
function PlansCard({ emptyMessage, rows, title, }) {
    return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: "rounded-[28px] border-border/70 shadow-sm", children: [(0, jsx_runtime_1.jsx)(card_1.CardHeader, { className: "pb-4", children: (0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-between gap-3", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-xl tracking-[-0.04em] text-foreground", children: title }), (0, jsx_runtime_1.jsx)(card_1.CardDescription, { className: "mt-2", children: "One canonical plan per fiscal year." })] }) }) }), (0, jsx_runtime_1.jsx)(card_1.CardContent, { children: rows.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-5 py-8 text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ClipboardList, { className: "mx-auto h-10 w-10 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("div", { className: "text-lg font-semibold text-foreground", children: "Start Your Plan" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm leading-6 text-muted-foreground", children: emptyMessage || "Use the Plan Launchpad to start your first procurement plan." })] })) : ((0, jsx_runtime_1.jsx)(scroll_area_1.ScrollArea, { className: "h-[360px]", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "sticky top-0 bg-card", children: (0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-border/70 text-left text-muted-foreground", children: [(0, jsx_runtime_1.jsx)("th", { className: "pb-3 font-medium", children: "Fiscal Year" }), (0, jsx_runtime_1.jsx)("th", { className: "pb-3 font-medium", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "pb-3 font-medium", children: "Items" }), (0, jsx_runtime_1.jsx)("th", { className: "pb-3 text-right font-medium", children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: rows.map((row) => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-border/50 align-top last:border-b-0", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-4 font-medium text-foreground", children: row.fiscalYear }), (0, jsx_runtime_1.jsxs)("td", { className: "py-4", children: [(0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "rounded-full", children: (0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(StatusIcon, { statusLabel: row.statusLabel }), row.statusLabel] }) }), row.submissionReference ? ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 text-xs font-medium text-emerald-700", children: ["Ref: ", row.submissionReference] })) : null, row.statusDateLabel ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-2 text-xs text-muted-foreground", children: row.statusDateLabel })) : null, row.reviewerLabel ? ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 text-xs text-muted-foreground", children: ["Reviewer: ", row.reviewerLabel] })) : null, (0, jsx_runtime_1.jsx)("div", { className: "mt-2 max-w-[260px] text-xs leading-5 text-muted-foreground", children: row.statusDetail }), row.rejectionComment ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-2 max-w-[220px] text-xs leading-5 text-muted-foreground", children: row.rejectionComment })) : null, row.statusHistorySummary ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-2 max-w-[220px] text-xs leading-5 text-amber-700", children: row.statusHistorySummary })) : null] }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 text-muted-foreground", children: row.itemCountLabel }), (0, jsx_runtime_1.jsx)("td", { className: "py-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-end gap-2", children: [(0, jsx_runtime_1.jsx)(button_1.Button, { asChild: true, size: "sm", variant: "outline", className: "rounded-full", children: (0, jsx_runtime_1.jsx)(link_1.default, { href: row.viewHref, children: "View" }) }), (0, jsx_runtime_1.jsx)(button_1.Button, { asChild: true, size: "sm", className: "rounded-full", children: (0, jsx_runtime_1.jsx)(link_1.default, { href: row.action.href, children: row.action.label }) })] }) })] }, row.id))) })] }) })) })] }));
}
exports.PlansCard = PlansCard;
function DepartmentUserBlockedState({ message, title, }) {
    return ((0, jsx_runtime_1.jsx)("div", { className: "mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center px-4 py-10 sm:px-6", children: (0, jsx_runtime_1.jsx)(card_1.Card, { className: "w-full rounded-[32px] border-border/70 bg-card/95 shadow-sm", children: (0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-4", children: [(0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "rounded-full border-amber-300 bg-amber-50 text-amber-800", children: "Setup blocked" }), (0, jsx_runtime_1.jsx)(lucide_react_1.CircleHelp, { className: "h-5 w-5 text-muted-foreground" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-3xl tracking-tight text-foreground", children: title ?? "Department setup incomplete" }), (0, jsx_runtime_1.jsx)(card_1.CardDescription, { className: "text-base leading-7 text-muted-foreground", children: message ?? "Department setup is incomplete. Contact your Procurement Officer to finish linking your account." })] })] }) }) }));
}
function DepartmentUserDashboardSkeleton() {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto hidden w-full max-w-none gap-4 px-4 py-4 lg:flex lg:flex-col xl:px-5", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-3", children: [(0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-72 rounded-[28px]" }), (0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-72 rounded-[28px]" }), (0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-72 rounded-[28px]" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]", children: [(0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-[28rem] rounded-[28px]" }), (0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-[28rem] rounded-[28px]" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-2", children: [(0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-64 rounded-[28px]" }), (0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-64 rounded-[28px]" })] })] }));
}
