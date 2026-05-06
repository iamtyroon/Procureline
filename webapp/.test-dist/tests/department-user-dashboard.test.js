"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDepartmentUserDashboardTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const roles_1 = require("../lib/shared/auth/roles");
const dashboard_1 = require("../lib/department-user/dashboard");
const dashboard_snapshot_1 = require("../lib/department-user/dashboard-snapshot");
function runDepartmentUserDashboardTests() {
    const completedTests = [];
    strict_1.default.equal((0, dashboard_1.getDepartmentUserFiscalYearForDate)(Date.UTC(2026, 5, 30, 12, 0, 0)).key, "2025-2026");
    strict_1.default.equal((0, dashboard_1.getDepartmentUserFiscalYearForDate)(Date.UTC(2026, 6, 1, 12, 0, 0)).key, "2026-2027");
    strict_1.default.equal((0, dashboard_1.getDepartmentUserFiscalYearForDate)(Date.UTC(2026, 5, 30, 12, 30, 0), {
        fiscalYearStartMonth: 7,
        timeZone: "Pacific/Auckland",
    }).key, "2026-2027");
    strict_1.default.equal((0, dashboard_1.getDepartmentUserFiscalYearForDate)(Date.UTC(2026, 2, 31, 21, 30, 0), {
        fiscalYearStartMonth: 4,
        timeZone: "Africa/Nairobi",
    }).key, "2026-2027");
    completedTests.push("department-user fiscal-year helpers honor tenant-specific timezone and fiscal-year boundaries instead of assuming a fixed Kenya July rollover");
    const activeDeadline = (0, dashboard_1.deriveDeadlinePresentation)({
        departmentAccessMode: "editable",
        fiscalYearKey: "2026-2027",
        now: Date.UTC(2026, 7, 18, 12, 0, 0),
        submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
    });
    const pendingDeadline = (0, dashboard_1.deriveDeadlinePresentation)({
        departmentAccessMode: undefined,
        fiscalYearKey: "2026-2027",
        now: Date.UTC(2026, 6, 20, 12, 0, 0),
        submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
    });
    const readOnlyDeadline = (0, dashboard_1.deriveDeadlinePresentation)({
        departmentAccessMode: "read_only_grace",
        fiscalYearKey: "2026-2027",
        now: Date.UTC(2026, 7, 20, 13, 0, 0),
        submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
    });
    strict_1.default.equal(activeDeadline.state, "available");
    strict_1.default.equal(activeDeadline.daysRemaining, 2);
    strict_1.default.match(activeDeadline.deadlineDateLabel, /20 Aug 2026/);
    strict_1.default.match(activeDeadline.deadlineDateLabel, /GMT\+3/);
    strict_1.default.equal(activeDeadline.isUrgent, true);
    strict_1.default.notEqual(activeDeadline.gaugeLabel, "45d");
    strict_1.default.equal(pendingDeadline.helperText, "Submission window opens on 1 Aug 2026, 15:00 GMT+3.");
    strict_1.default.equal(readOnlyDeadline.state, "read_only");
    strict_1.default.equal(readOnlyDeadline.helperText, "Submission closed on 20 Aug 2026, 15:00 GMT+3. Your plan is now read-only.");
    completedTests.push("department-user deadline derivation keeps live day counts, upcoming-window copy, and read-only messaging truthful without a hard-coded 45-day fallback");
    strict_1.default.deepEqual((0, dashboard_1.createCategorySelectionState)(["cat-b", "cat-a", "cat-a"]), ["cat-a", "cat-b"]);
    strict_1.default.deepEqual((0, dashboard_1.toggleCategorySelection)({
        categoryId: "cat-c",
        selectedCategoryIds: ["cat-a", "cat-b"],
    }), ["cat-a", "cat-b", "cat-c"]);
    strict_1.default.deepEqual((0, dashboard_1.toggleCategorySelection)({
        categoryId: "cat-a",
        selectedCategoryIds: ["cat-a", "cat-b"],
    }), ["cat-b"]);
    strict_1.default.deepEqual((0, dashboard_1.sanitizeCategorySelection)({
        availableCategoryIds: ["cat-b", "cat-c"],
        selectedCategoryIds: ["cat-a", "cat-b", "cat-d"],
    }), ["cat-b"]);
    completedTests.push("department-user launchpad selection helpers support toggle, dedupe, and reactive refresh sanitization without dropping still-valid picks");
    strict_1.default.deepEqual((0, dashboard_1.derivePlanAction)({
        accessMode: "editable",
        hasCanonicalPlan: false,
        planHref: "/du/plans/new",
        status: "No Plan",
    }), {
        disabled: false,
        href: "/du/plans/new",
        kind: "create",
        label: "Start Your Plan",
    });
    strict_1.default.deepEqual((0, dashboard_1.derivePlanAction)({
        accessMode: "editable",
        hasCanonicalPlan: true,
        planHref: "/du/plans/plan-1?mode=edit",
        status: "Rejected",
    }), {
        disabled: false,
        href: "/du/plans/plan-1?mode=edit",
        kind: "edit",
        label: "Edit Plan",
    });
    strict_1.default.deepEqual((0, dashboard_1.derivePlanAction)({
        accessMode: "read_only_grace",
        hasCanonicalPlan: true,
        planHref: "/du/plans/plan-1?mode=view",
        status: "Rejected",
    }), {
        disabled: false,
        href: "/du/plans/plan-1?mode=view",
        kind: "view_rejection",
        label: "View Rejection",
    });
    completedTests.push("department-user plan actions pivot cleanly between create, edit, and truthful view-only rejection states");
    const setupLaunchpad = (0, dashboard_1.deriveLaunchpadState)({
        accessMode: "editable",
        budgetState: "empty",
        catalogState: "setup_required",
        currentPlanAction: (0, dashboard_1.derivePlanAction)({
            accessMode: "editable",
            hasCanonicalPlan: false,
            planHref: "/du/plans/new",
            status: "No Plan",
        }),
        hasCanonicalPlan: false,
    });
    const readyLaunchpad = (0, dashboard_1.deriveLaunchpadState)({
        accessMode: "editable",
        budgetState: "available",
        catalogState: "available",
        currentPlanAction: (0, dashboard_1.derivePlanAction)({
            accessMode: "editable",
            hasCanonicalPlan: false,
            planHref: "/du/plans/new",
            status: "No Plan",
        }),
        hasCanonicalPlan: false,
    });
    strict_1.default.equal(setupLaunchpad.disabledReason, "No budget allocated. Contact your Procurement Officer.");
    strict_1.default.equal(setupLaunchpad.primaryAction.disabled, true);
    strict_1.default.equal(readyLaunchpad.primaryAction.disabled, false);
    completedTests.push("department-user launchpad gating disables creation when budget or catalog truth is missing and otherwise leaves ready-state selection handling to the client");
    const staleSelectionLaunchpad = (0, dashboard_1.deriveLaunchpadInteractivity)({
        canSelectCategories: true,
        disabledReason: "Select at least one category to start planning.",
        primaryAction: {
            disabled: true,
            href: "/du/plans/new",
            kind: "create",
            label: "Start Your Plan",
        },
        selectedCategoryCount: 2,
        state: "available",
    });
    const emptySelectionLaunchpad = (0, dashboard_1.deriveLaunchpadInteractivity)({
        canSelectCategories: true,
        disabledReason: null,
        primaryAction: {
            disabled: false,
            href: "/du/plans/new",
            kind: "create",
            label: "Start Your Plan",
        },
        selectedCategoryCount: 0,
        state: "available",
    });
    const readOnlyLaunchpadInteractivity = (0, dashboard_1.deriveLaunchpadInteractivity)({
        canSelectCategories: true,
        disabledReason: "Submission deadline has passed. Your plan is now read-only.",
        primaryAction: {
            disabled: true,
            href: "/du/plans/new",
            kind: "create",
            label: "Start Your Plan",
        },
        selectedCategoryCount: 2,
        state: "read_only",
    });
    strict_1.default.equal(staleSelectionLaunchpad.disabled, false);
    strict_1.default.equal(staleSelectionLaunchpad.disabledReason, null);
    strict_1.default.equal(staleSelectionLaunchpad.statusLabel, "Ready to launch");
    strict_1.default.equal(emptySelectionLaunchpad.disabled, true);
    strict_1.default.equal(emptySelectionLaunchpad.disabledReason, "Select at least one category to start planning.");
    strict_1.default.equal(readOnlyLaunchpadInteractivity.disabled, true);
    strict_1.default.equal(readOnlyLaunchpadInteractivity.disabledReason, "Submission deadline has passed. Your plan is now read-only.");
    completedTests.push("department-user launchpad interactivity now clears stale no-selection blocking once live category picks exist while preserving read-only blocking states");
    const truthfulSnapshot = (0, dashboard_snapshot_1.buildDepartmentUserDashboardSnapshot)({
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
    strict_1.default.equal(truthfulSnapshot.meta.viewState, "dashboard");
    strict_1.default.equal(truthfulSnapshot.quickStats.budget.state, "empty");
    strict_1.default.equal(truthfulSnapshot.quickStats.budget.helperText, "No budget allocated. Contact your Procurement Officer.");
    strict_1.default.equal(truthfulSnapshot.launchpad.state, "setup_required");
    strict_1.default.equal(truthfulSnapshot.launchpad.disabledReason, "No budget allocated. Contact your Procurement Officer.");
    strict_1.default.equal(truthfulSnapshot.leaderboard.state, "unavailable");
    strict_1.default.equal(truthfulSnapshot.announcements.state, "unavailable");
    strict_1.default.equal(truthfulSnapshot.heroSupport.support.state, "unavailable");
    completedTests.push("department-user snapshot shaping refuses to fabricate budget, leaderboard, announcement, or support-contact data when the live source is absent");
    const rejectedSnapshot = (0, dashboard_snapshot_1.buildDepartmentUserDashboardSnapshot)({
        announcements: [],
        auth: {
            departmentAccessMode: "editable",
            departmentId: "department-1",
            tenantId: "tenant-1",
        },
        categories: [
            { id: "cat-1", isActive: true, name: "ICT Equipment", sortOrder: 2 },
            { id: "cat-2", isActive: true, name: "Office Supplies", sortOrder: 1 },
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
    strict_1.default.equal(rejectedSnapshot.quickStats.plan.statusLabel, "Rejected");
    strict_1.default.equal(rejectedSnapshot.rejectionNotice?.message, "Please revise the laptop quantity assumptions.");
    strict_1.default.equal(rejectedSnapshot.rejectionNotice.action.label, "Edit Plan");
    strict_1.default.equal(rejectedSnapshot.launchpad.primaryAction.label, "Edit Plan");
    strict_1.default.equal(rejectedSnapshot.launchpad.selectedCategoryIds[0], "cat-1");
    completedTests.push("department-user rejected plans surface revision comments prominently and reuse the canonical plan selection instead of implying a duplicate same-year draft");
    const submittedSnapshot = (0, dashboard_snapshot_1.buildDepartmentUserDashboardSnapshot)({
        announcements: [],
        auth: {
            departmentAccessMode: "editable",
            departmentId: "department-1",
            tenantId: "tenant-1",
        },
        categories: [
            { id: "cat-1", isActive: true, name: "ICT Equipment", sortOrder: 1 },
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
        items: [{ categoryId: "cat-1", id: "item-1", isActive: true }],
        leaderboardEntries: [],
        now: Date.UTC(2026, 7, 10, 12, 0, 0),
        plans: [
            {
                categorySummaries: [],
                createdAt: Date.UTC(2026, 7, 1, 10, 0, 0),
                estimatedBudgetUsed: 1_200_000,
                fiscalYear: "2026-2027",
                id: "plan-3",
                itemCount: 6,
                rejectionComment: null,
                selectedCategoryIds: ["cat-1"],
                status: "submitted",
                submissionReference: "CS-2627-003",
                submittedAt: Date.UTC(2026, 7, 9, 10, 0, 0),
                updatedAt: Date.UTC(2026, 7, 9, 10, 0, 0),
            },
        ],
        procurementOfficer: null,
        tenant: {
            id: "tenant-1",
            name: "Pwani University",
        },
    });
    strict_1.default.equal(submittedSnapshot.quickStats.plan.helperText, "Submitted as CS-2627-003. Submitted 9 Aug 2026, 13:00 GMT+3. Waiting for Procurement Officer review.");
    strict_1.default.equal(submittedSnapshot.quickStats.plan.submissionReference, "CS-2627-003");
    strict_1.default.equal(submittedSnapshot.plans.rows[0]?.submissionReference, "CS-2627-003");
    strict_1.default.equal(submittedSnapshot.quickStats.plan.canWithdraw, true);
    completedTests.push("department-user submitted plans now surface the canonical submission reference in quick stats and plan history rows instead of a generic awaiting-review message");
    const underReviewSnapshot = (0, dashboard_snapshot_1.buildDepartmentUserDashboardSnapshot)({
        announcements: [],
        auth: {
            departmentAccessMode: "editable",
            departmentId: "department-1",
            tenantId: "tenant-1",
        },
        categories: [{ id: "cat-1", isActive: true, name: "ICT Equipment", sortOrder: 1 }],
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
        items: [{ categoryId: "cat-1", id: "item-1", isActive: true }],
        leaderboardEntries: [],
        now: Date.UTC(2026, 7, 12, 12, 0, 0),
        plans: [
            {
                categorySummaries: [],
                createdAt: Date.UTC(2026, 7, 1, 10, 0, 0),
                estimatedBudgetUsed: 1_200_000,
                fiscalYear: "2026-2027",
                id: "plan-4",
                itemCount: 6,
                reviewStartedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
                reviewer: {
                    label: "Jane Mwangi",
                    state: "available",
                },
                selectedCategoryIds: ["cat-1"],
                status: "submitted",
                submissionReference: "CS-2627-004",
                submittedAt: Date.UTC(2026, 7, 10, 8, 0, 0),
                updatedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
            },
        ],
        procurementOfficer: null,
        tenant: {
            id: "tenant-1",
            name: "Pwani University",
        },
    });
    strict_1.default.equal(underReviewSnapshot.quickStats.plan.statusLabel, "Under Review");
    strict_1.default.equal(underReviewSnapshot.quickStats.plan.canWithdraw, false);
    strict_1.default.equal(underReviewSnapshot.quickStats.plan.reviewerLabel, "Jane Mwangi");
    strict_1.default.equal(underReviewSnapshot.plans.rows[0]?.statusLabel, "Under Review");
    completedTests.push("department-user dashboard snapshots switch submitted plans to under-review as soon as reviewStartedAt arrives and surface reviewer context without client-side polling");
    const sameYearWorkflowSnapshot = (0, dashboard_snapshot_1.buildDepartmentUserDashboardSnapshot)({
        announcements: [],
        auth: {
            departmentAccessMode: "editable",
            departmentId: "department-1",
            tenantId: "tenant-1",
        },
        categories: [{ id: "cat-1", isActive: true, name: "ICT Equipment", sortOrder: 1 }],
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
        items: [{ categoryId: "cat-1", id: "item-1", isActive: true }],
        leaderboardEntries: [],
        now: Date.UTC(2026, 7, 12, 12, 0, 0),
        plans: [
            {
                categorySummaries: [],
                createdAt: Date.UTC(2026, 7, 1, 10, 0, 0),
                estimatedBudgetUsed: 1_200_000,
                fiscalYear: "2026-2027",
                id: "plan-submitted",
                itemCount: 6,
                selectedCategoryIds: ["cat-1"],
                status: "submitted",
                submissionReference: "CS-2627-004",
                submittedAt: Date.UTC(2026, 7, 10, 8, 0, 0),
                updatedAt: Date.UTC(2026, 7, 10, 8, 0, 0),
            },
            {
                categorySummaries: [],
                createdAt: Date.UTC(2026, 7, 11, 10, 0, 0),
                estimatedBudgetUsed: 0,
                fiscalYear: "2026-2027",
                id: "plan-draft",
                itemCount: 0,
                selectedCategoryIds: ["cat-1"],
                status: "draft",
                updatedAt: Date.UTC(2026, 7, 12, 8, 0, 0),
            },
        ],
        procurementOfficer: null,
        tenant: {
            id: "tenant-1",
            name: "Pwani University",
        },
    });
    strict_1.default.equal(sameYearWorkflowSnapshot.quickStats.plan.submissionReference, "CS-2627-004");
    strict_1.default.equal(sameYearWorkflowSnapshot.quickStats.plan.statusLabel, "Submitted");
    completedTests.push("department-user dashboard snapshot selection keeps an active same-year submitted workflow visible instead of letting a newer draft hide the current review state");
    const archivedCategorySnapshot = (0, dashboard_snapshot_1.buildDepartmentUserDashboardSnapshot)({
        announcements: [],
        auth: {
            departmentAccessMode: "editable",
            departmentId: "department-1",
            tenantId: "tenant-1",
        },
        categories: [
            { id: "cat-zero", isActive: true, name: "Office Supplies", sortOrder: 1 },
            { id: "cat-live", isActive: true, name: "ICT Equipment", sortOrder: 2 },
            { archivedAt: Date.UTC(2026, 8, 1, 9, 0, 0), id: "cat-archived", isActive: false, name: "Legacy Items", sortOrder: 3 },
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
            { categoryId: "cat-live", id: "item-1", isActive: true },
        ],
        leaderboardEntries: [],
        now: Date.UTC(2026, 7, 10, 12, 0, 0),
        plans: [
            {
                categorySummaries: [],
                createdAt: Date.UTC(2026, 7, 1, 10, 0, 0),
                estimatedBudgetUsed: 0,
                fiscalYear: "2026-2027",
                id: "plan-2",
                itemCount: 0,
                rejectionComment: null,
                selectedCategoryIds: ["cat-live", "cat-archived"],
                status: "draft",
                updatedAt: Date.UTC(2026, 7, 8, 10, 0, 0),
            },
        ],
        procurementOfficer: null,
        tenant: {
            id: "tenant-1",
            name: "Pwani University",
        },
    });
    strict_1.default.deepEqual(archivedCategorySnapshot.launchpad.categories.map((category) => category.id), ["cat-zero", "cat-live", "cat-archived"]);
    strict_1.default.equal(archivedCategorySnapshot.launchpad.categories.find((category) => category.id === "cat-zero")?.disabled, true);
    strict_1.default.equal(archivedCategorySnapshot.launchpad.categories.find((category) => category.id === "cat-archived")?.isSelected, true);
    strict_1.default.equal(archivedCategorySnapshot.launchpad.categories.find((category) => category.id === "cat-archived")?.disabled, true);
    completedTests.push("department-user launchpad ordering now follows managed category order, disables zero-item categories for new selection, and still preserves archived category references on existing plans");
    const budgetAnnouncement = (0, dashboard_1.buildDepartmentBudgetChangeAnnouncement)({
        budgetAllocation: 4_200_000,
        departmentId: "department-1",
        lastAuthenticatedAt: Date.UTC(2026, 7, 10, 9, 0, 0),
        lastBudgetChangedAt: Date.UTC(2026, 7, 10, 10, 0, 0),
    });
    strict_1.default.ok(budgetAnnouncement);
    strict_1.default.equal(budgetAnnouncement.title, "Budget allocation updated");
    strict_1.default.match(budgetAnnouncement.message, /Review any draft planning assumptions\./);
    strict_1.default.equal((0, dashboard_1.buildDepartmentBudgetChangeAnnouncement)({
        budgetAllocation: 4_200_000,
        departmentId: "department-1",
        lastAuthenticatedAt: Date.UTC(2026, 7, 10, 10, 0, 0),
        lastBudgetChangedAt: Date.UTC(2026, 7, 10, 9, 0, 0),
    }), null);
    completedTests.push("department-user budget change announcements only appear for newer procurement-officer updates and stay quiet for already-seen budget changes");
    const blockedSnapshot = (0, dashboard_snapshot_1.buildDepartmentUserDashboardSnapshot)({
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
    strict_1.default.equal(blockedSnapshot.meta.viewState, "blocked");
    strict_1.default.equal(blockedSnapshot.meta.blockedMessage, "Department setup is incomplete. Contact your Procurement Officer to finish linking your account.");
    completedTests.push("department-user dashboard snapshots fall back to a blocked setup state when the authenticated DU lacks a valid department linkage");
    const duRoutes = [
        "/du",
        "/du/plans",
        "/du/plans/new",
        "/du/plans/plan-1",
    ];
    for (const route of duRoutes) {
        strict_1.default.equal((0, roles_1.getProtectedRouteRole)(route), "department_user");
    }
    completedTests.push("department-user dashboard and reserved handoff routes stay under the existing segment-aware role guard");
    return completedTests;
}
exports.runDepartmentUserDashboardTests = runDepartmentUserDashboardTests;
