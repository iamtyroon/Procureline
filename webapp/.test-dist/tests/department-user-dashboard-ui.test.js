"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDepartmentUserDashboardUiTests = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const strict_1 = __importDefault(require("node:assert/strict"));
const server_1 = require("react-dom/server");
const DepartmentUserDashboard_1 = require("../src/components/department-user/DepartmentUserDashboard");
function runDepartmentUserDashboardUiTests() {
    const completedTests = [];
    const statusCardMarkup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(DepartmentUserDashboard_1.PlanStatCard, { isWithdrawing: false, onRequestRedraft: () => undefined, onWithdrawSubmission: () => undefined, plan: {
            canWithdraw: false,
            helperText: "Review started 12 Aug 2026, 11:00 GMT+3. Procurement Officer review in progress. This plan is read-only while review is in progress.",
            historySummary: null,
            itemCount: 8,
            primaryActionHref: "/du/plans/plan-1?mode=view",
            primaryActionLabel: "View Plan",
            redraftRequest: {
                canRequest: false,
                pendingRequestId: null,
                pendingReason: null,
                requestedAt: null,
            },
            reviewerLabel: null,
            reviewerState: "unavailable",
            state: "available",
            statusDateLabel: "12 Aug 2026, 11:00 GMT+3",
            statusLabel: "Under Review",
            submissionReference: "CS-2627-004",
            timeline: [
                {
                    description: "Plan workspace created.",
                    id: "draft",
                    timestampLabel: "1 Aug 2026, 11:00 GMT+3",
                    title: "Draft Created",
                },
                {
                    description: "Submitted as CS-2627-004.",
                    id: "submitted",
                    timestampLabel: "10 Aug 2026, 11:00 GMT+3",
                    title: "Submitted",
                },
                {
                    description: "Procurement Officer review started.",
                    id: "review",
                    timestampLabel: "12 Aug 2026, 11:00 GMT+3",
                    title: "Under Review",
                },
            ],
        } }));
    strict_1.default.match(statusCardMarkup, /Status history/);
    strict_1.default.match(statusCardMarkup, /Under Review/);
    strict_1.default.match(statusCardMarkup, /Procurement Officer review in progress/);
    strict_1.default.doesNotMatch(statusCardMarkup, /Withdraw submission/);
    completedTests.push("department-user dashboard status card renders under-review timeline context and hides withdrawal actions once procurement review has started");
    const plansTableMarkup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(DepartmentUserDashboard_1.PlansCard, { emptyMessage: "", rows: [
            {
                action: {
                    href: "/du/plans/plan-1?mode=view",
                    label: "View Plan",
                },
                fiscalYear: "2026-2027",
                id: "plan-1",
                itemCountLabel: "8 items",
                rejectionComment: "Revise delivery phasing.",
                reviewerLabel: "Jane Mwangi",
                statusDateLabel: "14 Aug 2026, 09:30 GMT+3",
                statusDetail: "Revision requested. Revise delivery phasing.",
                statusHistorySummary: "Some earlier status history is unavailable for this plan.",
                statusLabel: "Rejected",
                submissionReference: "CS-2627-004",
                viewHref: "/du/plans/plan-1?mode=view",
            },
        ], title: "Annual Procurement Plans" }));
    strict_1.default.match(plansTableMarkup, /Reviewer: Jane Mwangi/);
    strict_1.default.match(plansTableMarkup, /Revision requested\./);
    strict_1.default.match(plansTableMarkup, /Some earlier status history is unavailable for this plan\./);
    completedTests.push("department-user dashboard plan rows render reviewer context, decision detail, and explicit legacy-history warnings alongside canonical status badges");
    return completedTests;
}
exports.runDepartmentUserDashboardUiTests = runDepartmentUserDashboardUiTests;
