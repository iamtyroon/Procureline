"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcurementOfficerDashboardTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const roles_1 = require("../lib/shared/auth/roles");
const dashboard_search_1 = require("../lib/procurement-officer/dashboard-search");
const dashboard_1 = require("../lib/procurement-officer/dashboard");
const dashboard_snapshot_1 = require("../lib/procurement-officer/dashboard-snapshot");
function runProcurementOfficerDashboardTests() {
    const completedTests = [];
    strict_1.default.equal((0, dashboard_1.getProcurementFiscalYearForDate)(Date.UTC(2026, 5, 30, 12, 0, 0)).key, "2025-2026");
    strict_1.default.equal((0, dashboard_1.getProcurementFiscalYearForDate)(Date.UTC(2026, 6, 1, 12, 0, 0)).key, "2026-2027");
    strict_1.default.deepEqual((0, dashboard_1.buildAvailableProcurementFiscalYears)({
        departments: [
            {
                id: "department-safe",
                isActive: true,
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            },
            {
                id: "department-invalid",
                isActive: true,
                submissionEndsAt: Date.UTC(2025, 7, 10, 12, 0, 0),
                submissionStartsAt: Date.UTC(2025, 7, 10, 12, 0, 0),
            },
            {
                id: "department-cross-fy",
                isActive: true,
                submissionEndsAt: Date.UTC(2026, 6, 2, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 5, 28, 12, 0, 0),
            },
        ],
    }), ["2026-2027"]);
    completedTests.push("procurement-officer fiscal-year helpers honor the Kenya July boundary and only expose selector years backed by safe department signals");
    const checklist = (0, dashboard_1.deriveProcurementChecklist)({
        accessCodeCoverage: { readyCount: 0, totalCount: 0 },
        departmentCount: 0,
        sharedDeadline: (0, dashboard_1.deriveSharedSubmissionDeadline)({
            departments: [],
            fiscalYearKey: "2026-2027",
        }),
    });
    strict_1.default.deepEqual(checklist.map((step) => step.id), [
        "create_departments",
        "add_categories",
        "add_items",
        "generate_access_codes",
        "set_deadline",
    ]);
    strict_1.default.equal(checklist[0]?.state, "setup_required");
    strict_1.default.equal(checklist[1]?.state, "available");
    strict_1.default.equal(checklist[2]?.state, "available");
    strict_1.default.equal(checklist[3]?.state, "setup_required");
    strict_1.default.equal(checklist[4]?.state, "setup_required");
    completedTests.push("procurement-officer onboarding keeps the required five-step order while exposing live category and item management inside the dashboard flow");
    const snapshot = (0, dashboard_snapshot_1.buildProcurementOfficerDashboardSnapshot)({
        accessCodes: [
            {
                departmentId: "department-1",
                expiresAt: Date.UTC(2026, 11, 31, 12, 0, 0),
                id: "code-1",
                isActive: true,
            },
            {
                departmentId: "department-1",
                expiresAt: Date.UTC(2026, 11, 31, 12, 0, 0),
                id: "code-1-duplicate",
                isActive: true,
            },
            {
                departmentId: "department-2",
                expiresAt: Date.UTC(2026, 7, 1, 12, 0, 0),
                id: "code-2-expired",
                isActive: true,
            },
            {
                departmentId: "department-2",
                expiresAt: Date.UTC(2026, 11, 31, 12, 0, 0),
                id: "code-2-inactive",
                isActive: true,
                lastDeliveryStatus: "queued",
            },
            {
                departmentId: "department-3",
                expiresAt: Date.UTC(2026, 11, 31, 12, 0, 0),
                id: "code-3",
                isActive: true,
            },
        ],
        departments: [
            {
                code: "FIN",
                id: "department-1",
                isActive: true,
                name: "Finance",
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
                voteNumber: "FIN-2026-Q1",
            },
            {
                code: "ICT",
                id: "department-2",
                isActive: true,
                name: "ICT",
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
                voteNumber: "ICT-2026-Q1",
            },
            {
                code: "HR",
                id: "department-3",
                isActive: true,
                name: "Human Resources",
                submissionEndsAt: Date.UTC(2026, 7, 24, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
                voteNumber: "HR-2026-Q1",
            },
            {
                code: "ARCHIVE",
                id: "department-4",
                isActive: false,
                name: "Archived",
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
                voteNumber: "ARCHIVE-2026-Q1",
            },
        ],
        departmentUserProfiles: [
            {
                deactivatedAt: undefined,
                departmentId: "department-1",
                id: "profile-1",
                isActive: true,
            },
            {
                deactivatedAt: undefined,
                departmentId: "department-1",
                id: "profile-1-duplicate",
                isActive: true,
            },
            {
                deactivatedAt: Date.UTC(2026, 7, 5, 12, 0, 0),
                departmentId: "department-2",
                id: "profile-2-deactivated",
                isActive: true,
            },
            {
                deactivatedAt: undefined,
                departmentId: "department-2",
                id: "profile-2-inactive",
                isActive: false,
            },
            {
                deactivatedAt: undefined,
                departmentId: "department-3",
                id: "profile-3",
                isActive: true,
            },
        ],
        now: Date.UTC(2026, 7, 10, 12, 0, 0),
        plans: [
            {
                departmentId: "department-1",
                estimatedBudgetUsed: 125_000,
                fiscalYear: "2026-2027",
                itemCount: 4,
                status: "submitted",
            },
            {
                departmentId: "department-2",
                estimatedBudgetUsed: 250_000,
                fiscalYear: "2026-2027",
                itemCount: 7,
                status: "approved",
            },
            {
                departmentId: "department-3",
                estimatedBudgetUsed: 75_000,
                fiscalYear: "2025-2026",
                itemCount: 2,
                status: "rejected",
            },
        ],
        requestSummary: {
            pendingCategoryCount: 0,
            pendingItemCount: 0,
            totalCount: 0,
            totalPendingCount: 0,
        },
        tenant: {
            id: "tenant-1",
            name: "Pwani University",
        },
        tenantBudgetCeiling: 500_000,
    });
    strict_1.default.equal(snapshot.meta.selectedFiscalYear, "2026-2027");
    strict_1.default.equal(snapshot.summaryCards.find((card) => card.id === "access_code_coverage")
        ?.value, "3 / 3");
    strict_1.default.equal(snapshot.summaryCards.find((card) => card.id === "du_assignment_coverage")
        ?.value, "2 / 3");
    strict_1.default.equal(snapshot.summaryCards.find((card) => card.id === "deadline_readiness")
        ?.value, "3 / 3");
    strict_1.default.equal(snapshot.departmentReadiness.items.length, 3);
    strict_1.default.equal(snapshot.submissionProgress.submittedDepartmentCount, 2);
    strict_1.default.equal(snapshot.submissionProgress.approvedDepartmentCount, 1);
    strict_1.default.equal(snapshot.submissionProgress.totalDepartmentCount, 3);
    strict_1.default.equal(snapshot.submissionProgress.utilizationPercent, 33);
    strict_1.default.equal(snapshot.submissionProgress.helperText, "2 departments submitted and 1 approved. 2 departments still need approved plans for consolidation.");
    strict_1.default.equal(snapshot.organizationOverview.budget.usedBudget, 375_000);
    strict_1.default.equal(snapshot.organizationOverview.budget.totalBudget, 500_000);
    strict_1.default.equal(snapshot.organizationOverview.budget.utilizationPercent, 75);
    strict_1.default.equal(snapshot.departmentReadiness.items.find((item) => item.id === "department-1")?.accessCode.state, "available");
    strict_1.default.equal(snapshot.departmentReadiness.items.find((item) => item.id === "department-2")?.departmentUser.state, "setup_required");
    strict_1.default.equal(snapshot.departmentReadiness.items.find((item) => item.id === "department-2")?.departmentUser.label, "Awaiting first sign-in");
    strict_1.default.equal(snapshot.departmentReadiness.items.find((item) => item.id === "department-2")?.blockerSummary, "Awaiting DU first sign-in.");
    strict_1.default.equal(snapshot.departmentReadiness.items.find((item) => item.id === "department-1")?.voteNumber, "FIN-2026-Q1");
    strict_1.default.equal(snapshot.alerts.some((alert) => alert.message ===
        "Submission deadline not set. Configure before DUs can submit."), true);
    strict_1.default.equal(snapshot.futurePanels.find((panel) => panel.id === "categories")?.state, "available");
    strict_1.default.equal(snapshot.futurePanels.find((panel) => panel.id === "items")?.state, "available");
    strict_1.default.equal(snapshot.futurePanels.find((panel) => panel.id === "request_inbox")?.state, "empty");
    strict_1.default.equal(snapshot.futurePanels.find((panel) => panel.id === "submission_monitoring")
        ?.state, "available");
    strict_1.default.equal(snapshot.futurePanels.find((panel) => panel.id === "submission_monitoring")
        ?.cta.href, "/po");
    completedTests.push("procurement-officer snapshot shaping deduplicates access-code and DU coverage by department, keeps shared-deadline warnings honest, and surfaces submitted plans in the dashboard without inventing future review states");
    const emptySnapshot = (0, dashboard_snapshot_1.buildProcurementOfficerDashboardSnapshot)({
        accessCodes: [],
        departments: [],
        departmentUserProfiles: [],
        now: Date.UTC(2026, 7, 10, 12, 0, 0),
        plans: [],
        requestSummary: {
            pendingCategoryCount: 0,
            pendingItemCount: 0,
            totalCount: 0,
            totalPendingCount: 0,
        },
        tenant: {
            id: "tenant-2",
            name: "Maseno University",
        },
    });
    strict_1.default.equal(emptySnapshot.hero.state, "empty");
    strict_1.default.equal(emptySnapshot.hero.primaryAction.label, "Create your first department");
    strict_1.default.equal(emptySnapshot.departmentReadiness.state, "empty");
    completedTests.push("procurement-officer empty states surface the first-department CTA without inventing fiscal-year blockers before real deadline setup starts");
    strict_1.default.equal((0, dashboard_1.buildProcurementOfficerWorkspaceModalPath)({
        modal: "review",
        planId: "plan-77",
    }), "/po?modal=review&planId=plan-77");
    strict_1.default.equal((0, dashboard_1.buildProcurementOfficerWorkspaceModalPath)({
        modal: "review",
        planId: "plan-77",
    }, {
        dashboardSearchParams: new URLSearchParams(`${dashboard_search_1.PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear}=2025-2026&junk=ignored`),
    }), "/po?modal=review&poFiscalYear=2025-2026&planId=plan-77");
    strict_1.default.deepEqual((0, dashboard_1.resolveProcurementOfficerWorkspaceNavigation)("/po/categories"), {
        href: "/po/categories",
        type: "route",
    });
    strict_1.default.deepEqual((0, dashboard_1.resolveProcurementOfficerWorkspaceNavigation)("/po/departments"), {
        href: "/po/departments",
        type: "route",
    });
    strict_1.default.deepEqual((0, dashboard_1.resolveProcurementOfficerWorkspaceNavigation)("/po/submissions?poFiscalYear=2025-2026&poSubmissionsStatus=submitted&itemSearch=laptop"), {
        href: "/po?poFiscalYear=2025-2026",
        type: "route",
    });
    strict_1.default.deepEqual((0, dashboard_1.resolveProcurementOfficerWorkspaceNavigation)("/po/review?planId=plan-77&poFiscalYear=2025-2026"), {
        href: "/po?modal=review&poFiscalYear=2025-2026&planId=plan-77",
        modalState: {
            modal: "review",
            planId: "plan-77",
        },
        type: "modal",
    });
    strict_1.default.deepEqual((0, dashboard_1.resolveProcurementOfficerWorkspaceNavigation)("/po/consolidation"), {
        href: "/po/consolidation",
        type: "route",
    });
    strict_1.default.deepEqual((0, dashboard_1.resolveProcurementOfficerWorkspaceNavigation)("/po/items?poFiscalYear=2025-2026&itemSearch=laptop&itemCategory=cat-it&foo=bar&itemCompliance=agpo"), {
        href: "/po/items?poFiscalYear=2025-2026&itemSearch=laptop&itemCategory=cat-it&foo=bar&itemCompliance=agpo",
        type: "route",
    });
    completedTests.push("procurement-officer workspace routing keeps categories and items as real routes, retires the submissions route back to the dashboard, and resolves review links to the summary modal");
    const poRoutes = [
        "/po",
        "/po/departments",
        "/po/categories",
        "/po/items",
        "/po/deadlines",
        "/po/requests",
        "/po/review",
        "/po/consolidation",
    ];
    for (const route of poRoutes) {
        strict_1.default.equal((0, roles_1.getProtectedRouteRole)(route), "procurement_officer");
    }
    completedTests.push("procurement-officer placeholder routes remain under the existing segment-aware role guard");
    const componentSource = [
        "src/components/procurement-officer/ProcurementOfficerDashboard.tsx",
        "src/components/procurement-officer/dashboard/category-editor-dialog.tsx",
        "src/components/procurement-officer/dashboard/item-editor-dialog.tsx",
    ]
        .map((sourcePath) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(process.cwd(), sourcePath), "utf8"))
        .join("\n");
    strict_1.default.equal(componentSource.includes("useMutation(api.functions.categories.createCategory)"), true);
    strict_1.default.equal(componentSource.includes("openDashboardCategoryCreateDialog"), true);
    strict_1.default.equal(componentSource.includes("Create category"), true);
    strict_1.default.equal(componentSource.includes("Category created."), true);
    strict_1.default.equal(componentSource.includes("useMutation(api.functions.items.createItem)"), true);
    strict_1.default.equal(componentSource.includes("Add item"), true);
    strict_1.default.equal(componentSource.includes("Item created."), true);
    strict_1.default.equal(componentSource.includes("Current Items in Category"), true);
    strict_1.default.equal(componentSource.includes("Archive item"), true);
    strict_1.default.equal(componentSource.includes("Active plan warning"), true);
    strict_1.default.equal(componentSource.includes("Category preview"), false);
    completedTests.push("procurement-officer dashboard source keeps the category and item create mutations wired into the dashboard modals and renders the live category item list inside the category flow");
    return completedTests;
}
exports.runProcurementOfficerDashboardTests = runProcurementOfficerDashboardTests;
