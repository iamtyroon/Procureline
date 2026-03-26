import assert from "node:assert/strict";
import { getProtectedRouteRole } from "../lib/auth/roles";
import {
    buildDepartmentBudgetChangeAnnouncement,
    createCategorySelectionState,
    deriveDeadlinePresentation,
    deriveLaunchpadState,
    derivePlanAction,
    getDepartmentUserFiscalYearForDate,
    sanitizeCategorySelection,
    toggleCategorySelection,
} from "../lib/department-user/dashboard";
import { buildDepartmentUserDashboardSnapshot } from "../lib/department-user/dashboard-snapshot";

export function runDepartmentUserDashboardTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(
        getDepartmentUserFiscalYearForDate(Date.UTC(2026, 5, 30, 12, 0, 0)).key,
        "2025-2026",
    );
    assert.equal(
        getDepartmentUserFiscalYearForDate(Date.UTC(2026, 6, 1, 12, 0, 0)).key,
        "2026-2027",
    );
    completedTests.push(
        "department-user fiscal-year helpers honor the Kenya July boundary for DU dashboard labels",
    );

    const activeDeadline = deriveDeadlinePresentation({
        departmentAccessMode: "editable",
        fiscalYearKey: "2026-2027",
        now: Date.UTC(2026, 7, 18, 12, 0, 0),
        submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
    });
    const pendingDeadline = deriveDeadlinePresentation({
        departmentAccessMode: undefined,
        fiscalYearKey: "2026-2027",
        now: Date.UTC(2026, 6, 20, 12, 0, 0),
        submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
    });
    const readOnlyDeadline = deriveDeadlinePresentation({
        departmentAccessMode: "read_only_grace",
        fiscalYearKey: "2026-2027",
        now: Date.UTC(2026, 7, 20, 13, 0, 0),
        submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
    });
    assert.equal(activeDeadline.state, "available");
    assert.equal(activeDeadline.daysRemaining, 2);
    assert.equal(activeDeadline.deadlineDateLabel, "Aug 20, 2026");
    assert.equal(activeDeadline.isUrgent, true);
    assert.notEqual(activeDeadline.gaugeLabel, "45d");
    assert.equal(
        pendingDeadline.helperText,
        "Submission window opens on Aug 1, 2026.",
    );
    assert.equal(readOnlyDeadline.state, "read_only");
    assert.equal(
        readOnlyDeadline.helperText,
        "Submission closed on Aug 20, 2026. Your plan is now read-only.",
    );
    completedTests.push(
        "department-user deadline derivation keeps live day counts, upcoming-window copy, and read-only messaging truthful without a hard-coded 45-day fallback",
    );

    assert.deepEqual(
        createCategorySelectionState(["cat-b", "cat-a", "cat-a"]),
        ["cat-a", "cat-b"],
    );
    assert.deepEqual(
        toggleCategorySelection({
            categoryId: "cat-c",
            selectedCategoryIds: ["cat-a", "cat-b"],
        }),
        ["cat-a", "cat-b", "cat-c"],
    );
    assert.deepEqual(
        toggleCategorySelection({
            categoryId: "cat-a",
            selectedCategoryIds: ["cat-a", "cat-b"],
        }),
        ["cat-b"],
    );
    assert.deepEqual(
        sanitizeCategorySelection({
            availableCategoryIds: ["cat-b", "cat-c"],
            selectedCategoryIds: ["cat-a", "cat-b", "cat-d"],
        }),
        ["cat-b"],
    );
    completedTests.push(
        "department-user launchpad selection helpers support toggle, dedupe, and reactive refresh sanitization without dropping still-valid picks",
    );

    assert.deepEqual(
        derivePlanAction({
            accessMode: "editable",
            hasCanonicalPlan: false,
            planHref: "/du/plans/new",
            status: "No Plan",
        }),
        {
            disabled: false,
            href: "/du/plans/new",
            kind: "create",
            label: "Start Your Plan",
        },
    );
    assert.deepEqual(
        derivePlanAction({
            accessMode: "editable",
            hasCanonicalPlan: true,
            planHref: "/du/plans/plan-1?mode=edit",
            status: "Rejected",
        }),
        {
            disabled: false,
            href: "/du/plans/plan-1?mode=edit",
            kind: "edit",
            label: "Edit Plan",
        },
    );
    assert.deepEqual(
        derivePlanAction({
            accessMode: "read_only_grace",
            hasCanonicalPlan: true,
            planHref: "/du/plans/plan-1?mode=view",
            status: "Rejected",
        }),
        {
            disabled: false,
            href: "/du/plans/plan-1?mode=view",
            kind: "view_rejection",
            label: "View Rejection",
        },
    );
    completedTests.push(
        "department-user plan actions pivot cleanly between create, edit, and truthful view-only rejection states",
    );

    const setupLaunchpad = deriveLaunchpadState({
        accessMode: "editable",
        budgetState: "empty",
        catalogState: "setup_required",
        currentPlanAction: derivePlanAction({
            accessMode: "editable",
            hasCanonicalPlan: false,
            planHref: "/du/plans/new",
            status: "No Plan",
        }),
        hasCanonicalPlan: false,
        selectedCategoryCount: 0,
    });
    const readyLaunchpad = deriveLaunchpadState({
        accessMode: "editable",
        budgetState: "available",
        catalogState: "available",
        currentPlanAction: derivePlanAction({
            accessMode: "editable",
            hasCanonicalPlan: false,
            planHref: "/du/plans/new",
            status: "No Plan",
        }),
        hasCanonicalPlan: false,
        selectedCategoryCount: 2,
    });
    assert.equal(
        setupLaunchpad.disabledReason,
        "No budget allocated. Contact your Procurement Officer.",
    );
    assert.equal(setupLaunchpad.primaryAction.disabled, true);
    assert.equal(readyLaunchpad.primaryAction.disabled, false);
    completedTests.push(
        "department-user launchpad gating disables creation when budget or catalog truth is missing and only enables the CTA once setup is genuinely ready",
    );

    const truthfulSnapshot = buildDepartmentUserDashboardSnapshot({
        announcements: [],
        auth: {
            departmentAccessMode: "editable",
            departmentId: "department-1",
            tenantId: "tenant-1",
        },
        categories: [],
        currentUser: {
            email: "du@example.com",
            initials: "DU",
            name: "Department User",
        },
        department: {
            budgetAllocation: null,
            code: "CS",
            id: "department-1",
            name: "Computer Science",
            submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
            submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
        },
        items: [],
        leaderboardEntries: [],
        now: Date.UTC(2026, 7, 10, 12, 0, 0),
        plans: [],
        procurementOfficer: null,
        tenant: {
            id: "tenant-1",
            name: "Pwani University",
        },
    });
    assert.equal(truthfulSnapshot.meta.viewState, "dashboard");
    assert.equal(truthfulSnapshot.quickStats.budget.state, "empty");
    assert.equal(
        truthfulSnapshot.quickStats.budget.helperText,
        "No budget allocated. Contact your Procurement Officer.",
    );
    assert.equal(truthfulSnapshot.launchpad.state, "setup_required");
    assert.equal(
        truthfulSnapshot.launchpad.disabledReason,
        "No budget allocated. Contact your Procurement Officer.",
    );
    assert.equal(truthfulSnapshot.leaderboard.state, "unavailable");
    assert.equal(truthfulSnapshot.announcements.state, "unavailable");
    assert.equal(truthfulSnapshot.heroSupport.support.state, "unavailable");
    completedTests.push(
        "department-user snapshot shaping refuses to fabricate budget, leaderboard, announcement, or support-contact data when the live source is absent",
    );

    const rejectedSnapshot = buildDepartmentUserDashboardSnapshot({
        announcements: [],
        auth: {
            departmentAccessMode: "editable",
            departmentId: "department-1",
            tenantId: "tenant-1",
        },
        categories: [
            { id: "cat-1", isActive: true, name: "ICT Equipment" },
            { id: "cat-2", isActive: true, name: "Office Supplies" },
        ],
        currentUser: {
            email: "du@example.com",
            initials: "DU",
            name: "Department User",
        },
        department: {
            budgetAllocation: 8_000_000,
            code: "CS",
            id: "department-1",
            name: "Computer Science",
            submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
            submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
        },
        items: [
            { categoryId: "cat-1", id: "item-1", isActive: true },
            { categoryId: "cat-1", id: "item-2", isActive: true },
            { categoryId: "cat-2", id: "item-3", isActive: true },
        ],
        leaderboardEntries: [],
        now: Date.UTC(2026, 7, 10, 12, 0, 0),
        plans: [
            {
                categorySummaries: [
                    {
                        amount: 2_400_000,
                        categoryId: "cat-1",
                        categoryName: "ICT Equipment",
                        itemCount: 4,
                    },
                ],
                createdAt: Date.UTC(2026, 7, 1, 10, 0, 0),
                estimatedBudgetUsed: 2_400_000,
                fiscalYear: "2026-2027",
                id: "plan-1",
                itemCount: 4,
                rejectionComment: "Please revise the laptop quantity assumptions.",
                selectedCategoryIds: ["cat-1"],
                status: "rejected",
                updatedAt: Date.UTC(2026, 7, 8, 10, 0, 0),
            },
        ],
        procurementOfficer: {
            email: "officer@example.com",
            initials: "JM",
            name: "John Mwangi",
        },
        tenant: {
            id: "tenant-1",
            name: "Pwani University",
        },
    });
    assert.equal(rejectedSnapshot.quickStats.plan.statusLabel, "Rejected");
    assert.equal(
        rejectedSnapshot.rejectionNotice?.message,
        "Please revise the laptop quantity assumptions.",
    );
    assert.equal(rejectedSnapshot.rejectionNotice.action.label, "Edit Plan");
    assert.equal(rejectedSnapshot.launchpad.primaryAction.label, "Edit Plan");
    assert.equal(rejectedSnapshot.launchpad.selectedCategoryIds[0], "cat-1");
    completedTests.push(
        "department-user rejected plans surface revision comments prominently and reuse the canonical plan selection instead of implying a duplicate same-year draft",
    );

    const budgetAnnouncement = buildDepartmentBudgetChangeAnnouncement({
        budgetAllocation: 4_200_000,
        departmentId: "department-1",
        lastAuthenticatedAt: Date.UTC(2026, 7, 10, 9, 0, 0),
        lastBudgetChangedAt: Date.UTC(2026, 7, 10, 10, 0, 0),
    });
    assert.ok(budgetAnnouncement);
    assert.equal(budgetAnnouncement.title, "Budget allocation updated");
    assert.match(budgetAnnouncement.message, /Review any draft planning assumptions\./);
    assert.equal(
        buildDepartmentBudgetChangeAnnouncement({
            budgetAllocation: 4_200_000,
            departmentId: "department-1",
            lastAuthenticatedAt: Date.UTC(2026, 7, 10, 10, 0, 0),
            lastBudgetChangedAt: Date.UTC(2026, 7, 10, 9, 0, 0),
        }),
        null,
    );
    completedTests.push(
        "department-user budget change announcements only appear for newer procurement-officer updates and stay quiet for already-seen budget changes",
    );

    const blockedSnapshot = buildDepartmentUserDashboardSnapshot({
        announcements: [],
        auth: {
            departmentAccessMode: undefined,
            departmentId: undefined,
            tenantId: "tenant-1",
        },
        categories: [],
        currentUser: {
            email: "du@example.com",
            initials: "DU",
            name: "Department User",
        },
        department: null,
        items: [],
        leaderboardEntries: [],
        now: Date.UTC(2026, 7, 10, 12, 0, 0),
        plans: [],
        procurementOfficer: null,
        tenant: {
            id: "tenant-1",
            name: "Pwani University",
        },
    });
    assert.equal(blockedSnapshot.meta.viewState, "blocked");
    assert.equal(
        blockedSnapshot.meta.blockedMessage,
        "Department setup is incomplete. Contact your Procurement Officer to finish linking your account.",
    );
    completedTests.push(
        "department-user dashboard snapshots fall back to a blocked setup state when the authenticated DU lacks a valid department linkage",
    );

    const duRoutes = [
        "/du",
        "/du/plans",
        "/du/plans/new",
        "/du/plans/plan-1",
    ];
    for (const route of duRoutes) {
        assert.equal(getProtectedRouteRole(route), "department_user");
    }
    completedTests.push(
        "department-user dashboard and reserved handoff routes stay under the existing segment-aware role guard",
    );

    return completedTests;
}
