import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
    PlanStatCard,
    PlansCard,
} from "../src/components/department-user/DepartmentUserDashboard";

export function runDepartmentUserDashboardUiTests(): string[] {
    const completedTests: string[] = [];

    const statusCardMarkup = renderToStaticMarkup(
        <PlanStatCard
            isWithdrawing={false}
            onRequestRedraft={() => undefined}
            onWithdrawSubmission={() => undefined}
            plan={{
                canWithdraw: false,
                helperText:
                    "Review started 12 Aug 2026, 11:00 GMT+3. Procurement Officer review in progress. This plan is read-only while review is in progress.",
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
            }}
        />,
    );
    assert.match(statusCardMarkup, /Status history/);
    assert.match(statusCardMarkup, /Under Review/);
    assert.match(statusCardMarkup, /Procurement Officer review in progress/);
    assert.doesNotMatch(statusCardMarkup, /Withdraw submission/);
    completedTests.push(
        "department-user dashboard status card renders under-review timeline context and hides withdrawal actions once procurement review has started",
    );

    const plansTableMarkup = renderToStaticMarkup(
        <PlansCard
            emptyMessage=""
            rows={[
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
                    statusDetail:
                        "Revision requested. Revise delivery phasing.",
                    statusHistorySummary:
                        "Some earlier status history is unavailable for this plan.",
                    statusLabel: "Rejected",
                    submissionReference: "CS-2627-004",
                    viewHref: "/du/plans/plan-1?mode=view",
                },
            ]}
            title="Annual Procurement Plans"
        />,
    );
    assert.match(plansTableMarkup, /Reviewer: Jane Mwangi/);
    assert.match(plansTableMarkup, /Revision requested\./);
    assert.match(plansTableMarkup, /Some earlier status history is unavailable for this plan\./);
    completedTests.push(
        "department-user dashboard plan rows render reviewer context, decision detail, and explicit legacy-history warnings alongside canonical status badges",
    );

    return completedTests;
}
