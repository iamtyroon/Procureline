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
const collapsible_1 = require("@/components/ui/collapsible");
const card_1 = require("@/components/ui/card");
const dialog_1 = require("@/components/ui/dialog");
const scroll_area_1 = require("@/components/ui/scroll-area");
const skeleton_1 = require("@/components/ui/skeleton");
const textarea_1 = require("@/components/ui/textarea");
const dashboard_1 = require("@/lib/department-user/dashboard");
const deadlines_1 = require("@/lib/procurement-officer/deadlines");
const utils_1 = require("@/lib/utils");
const sonner_1 = require("sonner");
function DepartmentUserDashboard() {
    const router = (0, navigation_1.useRouter)();
    const snapshot = (0, react_1.useQuery)(api_1.api.functions.departmentUserDashboard.getDepartmentUserDashboardSnapshot, {});
    const requestRedraft = (0, react_1.useMutation)(api_1.api.functions.planRedrafts.requestDepartmentUserPlanRedraft);
    const withdrawSubmission = (0, react_1.useMutation)(api_1.api.functions.plans.withdrawDepartmentUserPlanSubmission);
    const [selectedCategoryIds, setSelectedCategoryIds] = (0, react_2.useState)([]);
    const [isBudgetOpen, setIsBudgetOpen] = (0, react_2.useState)(false);
    const [countdownNow, setCountdownNow] = (0, react_2.useState)(() => Date.now());
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
    (0, react_2.useEffect)(() => {
        if (!snapshot?.quickStats.deadline.targetAt) {
            return;
        }
        const interval = window.setInterval(() => {
            setCountdownNow(Date.now());
        }, 30_000);
        return () => window.clearInterval(interval);
    }, [snapshot?.quickStats.deadline.targetAt]);
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
            sonner_1.toast.success("Redraft request sent to your Procurement Officer.");
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
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-[calc(100vh-4rem)] bg-background", children: [(0, jsx_runtime_1.jsx)("div", { className: "px-4 py-8 sm:px-6 lg:hidden", children: (0, jsx_runtime_1.jsx)(card_1.Card, { className: "mx-auto max-w-2xl rounded-[24px] border-border/70 bg-card shadow-sm", children: (0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)(badge_1.Badge, { className: "w-fit rounded-md bg-primary text-primary-foreground hover:bg-primary", children: "Desktop required" }), (0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-2xl text-foreground", children: "Department User dashboards are designed for desktop viewports" }), (0, jsx_runtime_1.jsx)(card_1.CardDescription, { className: "text-base leading-7 text-muted-foreground", children: "This workspace follows the desktop-only DU planning layout from the Procureline UX specification." })] }) }) }), (0, jsx_runtime_1.jsx)("div", { className: "hidden lg:block", children: (0, jsx_runtime_1.jsxs)("div", { className: "mx-auto flex w-full max-w-none flex-col gap-4 px-4 py-4 xl:px-5", children: [dashboardSnapshot.rejectionNotice ? ((0, jsx_runtime_1.jsxs)(alert_1.Alert, { className: "rounded-2xl border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100", dismissible: true, dismissKey: `${dashboardSnapshot.rejectionNotice.title}-${dashboardSnapshot.rejectionNotice.message}-${dashboardSnapshot.rejectionNotice.action.href}`, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)(alert_1.AlertTitle, { children: dashboardSnapshot.rejectionNotice.title }), (0, jsx_runtime_1.jsxs)(alert_1.AlertDescription, { className: "flex items-center justify-between gap-4", children: [(0, jsx_runtime_1.jsx)("span", { children: dashboardSnapshot.rejectionNotice.message }), (0, jsx_runtime_1.jsx)(button_1.Button, { asChild: true, size: "sm", className: "rounded-full", children: (0, jsx_runtime_1.jsx)(link_1.default, { href: dashboardSnapshot.rejectionNotice.action.href, children: dashboardSnapshot.rejectionNotice.action.label }) })] })] })) : null, (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-3", children: [(0, jsx_runtime_1.jsx)(BudgetCard, { budget: dashboardSnapshot.quickStats.budget, isBudgetOpen: isBudgetOpen, setIsBudgetOpen: setIsBudgetOpen }), (0, jsx_runtime_1.jsx)(PlanStatCard, { isWithdrawing: isWithdrawSubmitting, onWithdrawSubmission: () => void handleWithdrawSubmission(), plan: dashboardSnapshot.quickStats.plan, onRequestRedraft: () => {
                                        const approvedRow = dashboardSnapshot.plans.rows.find((row) => row.isCurrentFiscalYear &&
                                            row.statusLabel === "Approved");
                                        if (approvedRow) {
                                            setRedraftPlanId(approvedRow.id);
                                        }
                                    } }), (0, jsx_runtime_1.jsx)(DeadlineCard, { countdownNow: countdownNow, deadline: dashboardSnapshot.quickStats.deadline })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]", children: [(0, jsx_runtime_1.jsx)(LaunchpadCard, { categories: dashboardSnapshot.launchpad.categories, canSelectCategories: dashboardSnapshot.launchpad.canSelectCategories, disabledReason: launchpadInteractivity.disabledReason, launchpadActionLabel: launchpadActionLabel, launchpadDisabled: launchpadInteractivity.disabled, onAction: handleLaunchpadAction, selectedCategoryIds: effectiveSelectedCategoryIds, setSelectedCategoryIds: setSelectedCategoryIds, statusLabel: launchpadInteractivity.statusLabel, subtitle: dashboardSnapshot.launchpad.subtitle, title: dashboardSnapshot.launchpad.title }), (0, jsx_runtime_1.jsx)(PlansCard, { emptyMessage: dashboardSnapshot.plans.emptyMessage, rows: dashboardSnapshot.plans.rows, title: dashboardSnapshot.plans.title })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-2", children: [(0, jsx_runtime_1.jsx)(InfoPanel, { badgeLabel: dashboardSnapshot.leaderboard.state === "available" ? "Live" : "Unavailable", description: dashboardSnapshot.leaderboard.emptyMessage, emptyLabel: "No leaderboard data", icon: (0, jsx_runtime_1.jsx)(lucide_react_1.Trophy, { className: "h-4 w-4" }), items: dashboardSnapshot.leaderboard.items, title: dashboardSnapshot.leaderboard.title }), (0, jsx_runtime_1.jsx)(InfoPanel, { badgeLabel: dashboardSnapshot.announcements.state === "available" ? "Live" : "Unavailable", description: dashboardSnapshot.announcements.emptyMessage, emptyLabel: "No announcements", icon: (0, jsx_runtime_1.jsx)(lucide_react_1.Megaphone, { className: "h-4 w-4" }), items: dashboardSnapshot.announcements.items, title: dashboardSnapshot.announcements.title, trailing: (0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "ghost", size: "sm", disabled: true, className: "rounded-full", children: "View All" }) })] })] }) }), (0, jsx_runtime_1.jsx)(dialog_1.Dialog, { open: redraftPlanId !== null, onOpenChange: (open) => {
                    if (!open && !isRedraftSubmitting) {
                        setRedraftPlanId(null);
                        setRedraftReason("");
                    }
                }, children: (0, jsx_runtime_1.jsxs)(dialog_1.DialogContent, { className: "sm:max-w-lg", children: [(0, jsx_runtime_1.jsxs)(dialog_1.DialogHeader, { children: [(0, jsx_runtime_1.jsx)(dialog_1.DialogTitle, { children: "Request plan redraft" }), (0, jsx_runtime_1.jsx)(dialog_1.DialogDescription, { children: "Send a request to your Procurement Officer to reopen this approved plan for editing." })] }), (0, jsx_runtime_1.jsx)(textarea_1.Textarea, { value: redraftReason, onChange: (event) => setRedraftReason(event.target.value), placeholder: "Explain what needs to change in the approved plan." }), (0, jsx_runtime_1.jsxs)(dialog_1.DialogFooter, { children: [(0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "outline", disabled: isRedraftSubmitting, onClick: () => {
                                        setRedraftPlanId(null);
                                        setRedraftReason("");
                                    }, children: "Cancel" }), (0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", disabled: isRedraftSubmitting || redraftReason.trim().length < 8, onClick: () => void handleSubmitRedraftRequest(), children: isRedraftSubmitting ? "Sending..." : "Send request" })] })] }) })] }));
}
exports.DepartmentUserDashboard = DepartmentUserDashboard;
function BudgetCard({ budget, isBudgetOpen, setIsBudgetOpen, }) {
    return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: "rounded-[26px] border-border/70 shadow-sm", children: [(0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "space-y-3 pb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground", children: "Budget Utilization" }), (0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "rounded-full", children: budget.state === "available" ? `${budget.utilizationPercent}%` : "Unavailable" })] }), (0, jsx_runtime_1.jsx)("div", { className: "text-5xl font-black tracking-[-0.08em] text-foreground", children: budget.state === "available" ? `${budget.utilizationPercent}%` : "--" }), (0, jsx_runtime_1.jsxs)(card_1.CardDescription, { className: "text-base text-muted-foreground", children: [budget.usedBudgetLabel, " / ", budget.totalBudgetLabel] })] }), (0, jsx_runtime_1.jsx)(card_1.CardContent, { className: "space-y-4", children: (0, jsx_runtime_1.jsxs)(collapsible_1.Collapsible, { open: isBudgetOpen, onOpenChange: setIsBudgetOpen, children: [(0, jsx_runtime_1.jsxs)(collapsible_1.CollapsibleTrigger, { className: "flex w-full items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-left", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-foreground", children: "Budget by category" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-muted-foreground", children: budget.helperText })] }), (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: (0, utils_1.cn)("h-4 w-4 transition-transform", isBudgetOpen && "rotate-180") })] }), (0, jsx_runtime_1.jsx)(collapsible_1.CollapsibleContent, { className: "pt-3", children: budget.breakdown.items.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground", children: budget.breakdown.emptyMessage })) : ((0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: budget.breakdown.items.map((item) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-foreground", children: item.categoryName }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-muted-foreground", children: item.itemCountLabel })] }), (0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-foreground", children: item.amountLabel })] }, item.id))) })) })] }) })] }));
}
function PlanStatCard({ isWithdrawing, onRequestRedraft, onWithdrawSubmission, plan, }) {
    return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: "rounded-[26px] border-border/70 shadow-sm", children: [(0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "space-y-3 pb-4", children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground", children: "Items in Plan" }), (0, jsx_runtime_1.jsx)("div", { className: "text-5xl font-black tracking-[-0.08em] text-foreground", children: plan.itemCount }), (0, jsx_runtime_1.jsx)(card_1.CardDescription, { className: "text-base text-muted-foreground", children: plan.statusLabel })] }), (0, jsx_runtime_1.jsxs)(card_1.CardContent, { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-border/60 bg-muted/30 px-4 py-4 text-sm text-muted-foreground", children: plan.helperText }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-2", children: [plan.statusDateLabel ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground", children: "Latest update" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 font-medium text-foreground", children: plan.statusDateLabel })] })) : null, plan.reviewerLabel || plan.reviewerState === "unavailable" ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground", children: "Reviewer" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 font-medium text-foreground", children: plan.reviewerLabel ?? "Procurement Officer review in progress" })] })) : null] }), plan.submissionReference ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900", children: ["Submission reference: ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: plan.submissionReference })] })) : null, plan.historySummary ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900", children: plan.historySummary })) : null, plan.redraftRequest.pendingRequestId ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900", children: "Redraft request pending PO approval." })) : null, plan.timeline.length > 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-border/60 bg-background px-4 py-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-3 flex items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm font-semibold text-foreground", children: "Status history" }), (0, jsx_runtime_1.jsxs)(badge_1.Badge, { variant: "outline", className: "rounded-full", children: [plan.timeline.length, " events"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: plan.timeline.map((item) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" }), (0, jsx_runtime_1.jsxs)("div", { className: "min-w-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium text-foreground", children: item.title }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-muted-foreground", children: item.timestampLabel })] }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm leading-6 text-muted-foreground", children: item.description })] })] }, item.id))) })] })) : null, plan.statusLabel !== "No Plan" ? ((0, jsx_runtime_1.jsx)(button_1.Button, { asChild: true, className: "w-full rounded-2xl", children: (0, jsx_runtime_1.jsxs)(link_1.default, { href: plan.primaryActionHref, children: [plan.primaryActionLabel, (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowRight, { className: "ml-2 h-4 w-4" })] }) })) : null, plan.canWithdraw ? ((0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "outline", className: "w-full rounded-2xl", disabled: isWithdrawing, onClick: onWithdrawSubmission, children: isWithdrawing ? "Withdrawing..." : "Withdraw submission" })) : null, plan.redraftRequest.canRequest ? ((0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "outline", className: "w-full rounded-2xl", onClick: onRequestRedraft, children: "Request redraft" })) : null] })] }));
}
exports.PlanStatCard = PlanStatCard;
function DeadlineCard({ countdownNow, deadline, }) {
    const liveGaugeLabel = deadline.targetAt &&
        (deadline.state === "available" || deadline.state === "coming_soon")
        ? (0, deadlines_1.formatDeadlineCountdown)({
            deadlineAt: deadline.targetAt,
            now: countdownNow,
        })
        : deadline.gaugeLabel;
    return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: "rounded-[26px] border-border/70 shadow-sm", children: [(0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "space-y-3 pb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground", children: deadline.label }), (0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: (0, utils_1.cn)("rounded-full", deadline.state === "read_only" &&
                                    "border-border/70 bg-muted text-muted-foreground", deadline.state === "coming_soon" &&
                                    "border-primary/20 bg-primary/10 text-primary", deadline.state === "available" &&
                                    deadline.isUrgent &&
                                    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"), children: liveGaugeLabel })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-4", children: [(0, jsx_runtime_1.jsx)(ThemedDeadlineRing, { label: liveGaugeLabel, percent: deadline.gaugePercent, state: deadline.state, urgent: deadline.isUrgent }), (0, jsx_runtime_1.jsxs)("div", { className: "min-w-0", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-3xl font-black tracking-[-0.06em] text-foreground", children: deadline.deadlineDateLabel }), (0, jsx_runtime_1.jsx)(card_1.CardDescription, { className: "mt-1 text-sm font-medium text-foreground", children: deadline.note })] })] })] }), (0, jsx_runtime_1.jsx)(card_1.CardContent, { className: "space-y-4", children: (0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-border/60 bg-muted/20 px-4 py-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-3 text-sm", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-muted-foreground", children: deadline.helperText }), (0, jsx_runtime_1.jsx)("span", { className: "shrink-0 font-medium text-foreground", children: deadline.fiscalYearLabel })] }) }) })] }));
}
function ThemedDeadlineRing({ label, percent, state, urgent, }) {
    const safePercent = Math.max(0, Math.min(100, percent));
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - (safePercent / 100) * circumference;
    const progressClass = state === "read_only"
        ? "stroke-muted-foreground/35"
        : urgent
            ? "stroke-amber-500"
            : "stroke-primary";
    const iconClass = state === "read_only"
        ? "text-muted-foreground"
        : urgent
            ? "text-amber-700 dark:text-amber-100"
            : "text-primary";
    return ((0, jsx_runtime_1.jsxs)("div", { className: "relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted/20", children: [(0, jsx_runtime_1.jsxs)("svg", { className: "-rotate-90", height: "72", viewBox: "0 0 72 72", width: "72", children: [(0, jsx_runtime_1.jsx)("circle", { className: "stroke-border/70", cx: "36", cy: "36", fill: "none", r: radius, strokeWidth: "6" }), (0, jsx_runtime_1.jsx)("circle", { className: (0, utils_1.cn)("transition-all duration-500 ease-out", progressClass), cx: "36", cy: "36", fill: "none", r: radius, strokeDasharray: circumference, strokeDashoffset: progressOffset, strokeLinecap: "round", strokeWidth: "6" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "absolute inset-0 flex flex-col items-center justify-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Clock3, { className: (0, utils_1.cn)("h-4 w-4", iconClass) }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground", children: label })] })] }));
}
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
function LaunchpadCard({ categories, canSelectCategories, disabledReason, launchpadActionLabel, launchpadDisabled, onAction, selectedCategoryIds, setSelectedCategoryIds, statusLabel, subtitle, title, }) {
    return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: "rounded-[28px] border-border/70 shadow-sm", children: [(0, jsx_runtime_1.jsx)(card_1.CardHeader, { className: "pb-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-xl tracking-[-0.04em] text-foreground", children: title }), (0, jsx_runtime_1.jsx)(card_1.CardDescription, { className: "mt-2 text-sm leading-6", children: subtitle })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "outline", size: "sm", disabled: !canSelectCategories || categories.length === 0, className: "rounded-full", onClick: () => setSelectedCategoryIds((0, dashboard_1.selectAllCategories)(categories.map((category) => category.id))), children: "Select All" }), (0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "outline", size: "sm", disabled: !canSelectCategories || selectedCategoryIds.length === 0, className: "rounded-full", onClick: () => setSelectedCategoryIds([]), children: "Clear All" }), (0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", className: "rounded-full", disabled: launchpadDisabled, onClick: () => (0, react_2.startTransition)(onAction), children: launchpadActionLabel })] })] }) }), (0, jsx_runtime_1.jsxs)(card_1.CardContent, { className: "space-y-5", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-3", children: categories.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "w-full rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground", children: disabledReason ?? "Setup in progress. Your Procurement Officer is preparing the catalog." })) : (categories.map((category) => {
                            const isSelected = selectedCategoryIds.includes(category.id);
                            return ((0, jsx_runtime_1.jsxs)("button", { type: "button", "aria-pressed": isSelected, disabled: !canSelectCategories || category.disabled, className: (0, utils_1.cn)("flex min-w-[180px] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors", isSelected
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border/70 bg-background text-foreground", (!canSelectCategories || category.disabled) &&
                                    "cursor-not-allowed opacity-70"), onClick: () => setSelectedCategoryIds((current) => (0, dashboard_1.toggleCategorySelection)({
                                    categoryId: category.id,
                                    selectedCategoryIds: current,
                                })), children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium", children: category.name }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-muted-foreground", children: category.disabledReason ?? category.itemCountLabel })] }), (0, jsx_runtime_1.jsx)(lucide_react_1.Layers3, { className: "h-4 w-4" })] }, category.id));
                        })) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-muted-foreground", children: [selectedCategoryIds.length, " categories selected"] }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm font-medium text-foreground", children: statusLabel })] }), disabledReason ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground", children: disabledReason })) : null] })] }));
}
function PlansCard({ emptyMessage, rows, title, }) {
    return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: "rounded-[28px] border-border/70 shadow-sm", children: [(0, jsx_runtime_1.jsx)(card_1.CardHeader, { className: "pb-4", children: (0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-between gap-3", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-xl tracking-[-0.04em] text-foreground", children: title }), (0, jsx_runtime_1.jsx)(card_1.CardDescription, { className: "mt-2", children: "One canonical plan per fiscal year." })] }) }) }), (0, jsx_runtime_1.jsx)(card_1.CardContent, { children: rows.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-5 py-8 text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ClipboardList, { className: "mx-auto h-10 w-10 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("div", { className: "text-lg font-semibold text-foreground", children: "Start Your Plan" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm leading-6 text-muted-foreground", children: emptyMessage || "Use the Plan Launchpad to start your first procurement plan." })] })) : ((0, jsx_runtime_1.jsx)(scroll_area_1.ScrollArea, { className: "h-[360px]", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "sticky top-0 bg-card", children: (0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-border/70 text-left text-muted-foreground", children: [(0, jsx_runtime_1.jsx)("th", { className: "pb-3 font-medium", children: "Fiscal Year" }), (0, jsx_runtime_1.jsx)("th", { className: "pb-3 font-medium", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "pb-3 font-medium", children: "Items" }), (0, jsx_runtime_1.jsx)("th", { className: "pb-3 text-right font-medium", children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: rows.map((row) => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-border/50 align-top last:border-b-0", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-4 font-medium text-foreground", children: row.fiscalYear }), (0, jsx_runtime_1.jsxs)("td", { className: "py-4", children: [(0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "rounded-full", children: (0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(StatusIcon, { statusLabel: row.statusLabel }), row.statusLabel] }) }), row.submissionReference ? ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 text-xs font-medium text-emerald-700", children: ["Ref: ", row.submissionReference] })) : null, row.statusDateLabel ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-2 text-xs text-muted-foreground", children: row.statusDateLabel })) : null, row.reviewerLabel ? ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 text-xs text-muted-foreground", children: ["Reviewer: ", row.reviewerLabel] })) : null, (0, jsx_runtime_1.jsx)("div", { className: "mt-2 max-w-[260px] text-xs leading-5 text-muted-foreground", children: row.statusDetail }), row.rejectionComment ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-2 max-w-[220px] text-xs leading-5 text-muted-foreground", children: row.rejectionComment })) : null, row.statusHistorySummary ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-2 max-w-[220px] text-xs leading-5 text-amber-700", children: row.statusHistorySummary })) : null] }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 text-muted-foreground", children: row.itemCountLabel }), (0, jsx_runtime_1.jsx)("td", { className: "py-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-end gap-2", children: [(0, jsx_runtime_1.jsx)(button_1.Button, { asChild: true, size: "sm", variant: "outline", className: "rounded-full", children: (0, jsx_runtime_1.jsx)(link_1.default, { href: row.viewHref, children: "View" }) }), (0, jsx_runtime_1.jsx)(button_1.Button, { asChild: true, size: "sm", className: "rounded-full", children: (0, jsx_runtime_1.jsx)(link_1.default, { href: row.action.href, children: row.action.label }) })] }) })] }, row.id))) })] }) })) })] }));
}
exports.PlansCard = PlansCard;
function InfoPanel({ badgeLabel, description, emptyLabel, icon, items, title, trailing, }) {
    return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: "rounded-[28px] border-border/70 shadow-sm", children: [(0, jsx_runtime_1.jsx)(card_1.CardHeader, { className: "pb-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary", children: icon }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-xl tracking-[-0.04em] text-foreground", children: title }), (0, jsx_runtime_1.jsx)(card_1.CardDescription, { className: "mt-1", children: description })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [trailing, (0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "rounded-full", children: badgeLabel })] })] }) }), (0, jsx_runtime_1.jsx)(card_1.CardContent, { children: items.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-dashed border-border/70 bg-muted/20 px-5 py-12 text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-base font-medium text-foreground", children: emptyLabel }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 text-sm leading-6 text-muted-foreground", children: description })] })) : ((0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: items.map((item) => ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-border/70 bg-muted/20 px-4 py-4", children: "rank" in item ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-foreground", children: item.label }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 text-sm text-muted-foreground", children: ["Rank #", item.rank] })] }), (0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "secondary", className: "rounded-full", children: item.score })] })) : ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-foreground", children: item.title }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 text-sm leading-6 text-muted-foreground", children: item.message })] })) }, item.id))) })) })] }));
}
function DepartmentUserBlockedState({ message, title, }) {
    return ((0, jsx_runtime_1.jsx)("div", { className: "mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center px-4 py-10 sm:px-6", children: (0, jsx_runtime_1.jsx)(card_1.Card, { className: "w-full rounded-[32px] border-border/70 bg-card/95 shadow-sm", children: (0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-4", children: [(0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "rounded-full border-amber-300 bg-amber-50 text-amber-800", children: "Setup blocked" }), (0, jsx_runtime_1.jsx)(lucide_react_1.CircleHelp, { className: "h-5 w-5 text-muted-foreground" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-3xl tracking-tight text-foreground", children: title ?? "Department setup incomplete" }), (0, jsx_runtime_1.jsx)(card_1.CardDescription, { className: "text-base leading-7 text-muted-foreground", children: message ?? "Department setup is incomplete. Contact your Procurement Officer to finish linking your account." })] })] }) }) }));
}
function DepartmentUserDashboardSkeleton() {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto hidden w-full max-w-none gap-4 px-4 py-4 lg:flex lg:flex-col xl:px-5", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-3", children: [(0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-72 rounded-[28px]" }), (0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-72 rounded-[28px]" }), (0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-72 rounded-[28px]" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]", children: [(0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-[28rem] rounded-[28px]" }), (0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-[28rem] rounded-[28px]" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 xl:grid-cols-2", children: [(0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-64 rounded-[28px]" }), (0, jsx_runtime_1.jsx)(skeleton_1.Skeleton, { className: "h-64 rounded-[28px]" })] })] }));
}
