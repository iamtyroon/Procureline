import assert from "node:assert/strict";
import { getProtectedRouteRole } from "../lib/auth/roles";
import {
    buildAvailableProcurementFiscalYears,
    buildProcurementOfficerWorkspaceModalPath,
    deriveProcurementChecklist,
    deriveSharedSubmissionDeadline,
    getProcurementFiscalYearForDate,
    normalizeProcurementOfficerWorkspaceModalState,
    resolveProcurementOfficerWorkspaceNavigation,
} from "../lib/procurement-officer/dashboard";
import { buildProcurementOfficerDashboardSnapshot } from "../lib/procurement-officer/dashboard-snapshot";

export function runProcurementOfficerDashboardTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(
        getProcurementFiscalYearForDate(Date.UTC(2026, 5, 30, 12, 0, 0)).key,
        "2025-2026",
    );
    assert.equal(
        getProcurementFiscalYearForDate(Date.UTC(2026, 6, 1, 12, 0, 0)).key,
        "2026-2027",
    );
    assert.deepEqual(
        buildAvailableProcurementFiscalYears({
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
        }),
        ["2026-2027"],
    );
    completedTests.push(
        "procurement-officer fiscal-year helpers honor the Kenya July boundary and only expose selector years backed by safe department signals",
    );

    const checklist = deriveProcurementChecklist({
        accessCodeCoverage: { readyCount: 0, totalCount: 0 },
        departmentCount: 0,
        sharedDeadline: deriveSharedSubmissionDeadline([]),
    });
    assert.deepEqual(
        checklist.map((step) => step.id),
        [
            "create_departments",
            "add_categories",
            "add_items",
            "generate_access_codes",
            "set_deadline",
        ],
    );
    assert.equal(checklist[0]?.state, "setup_required");
    assert.equal(checklist[1]?.state, "coming_soon");
    assert.equal(checklist[2]?.state, "coming_soon");
    assert.equal(checklist[3]?.state, "setup_required");
    assert.equal(checklist[4]?.state, "setup_required");
    completedTests.push(
        "procurement-officer onboarding keeps the required five-step order and marks later-story catalog steps as coming soon instead of fabricating readiness",
    );

    const snapshot = buildProcurementOfficerDashboardSnapshot({
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
                isActive: false,
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
            },
            {
                code: "ICT",
                id: "department-2",
                isActive: true,
                name: "ICT",
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            },
            {
                code: "HR",
                id: "department-3",
                isActive: true,
                name: "Human Resources",
                submissionEndsAt: Date.UTC(2026, 7, 24, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            },
            {
                code: "ARCHIVE",
                id: "department-4",
                isActive: false,
                name: "Archived",
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
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
        tenant: {
            id: "tenant-1",
            name: "Pwani University",
        },
    });
    assert.equal(snapshot.meta.selectedFiscalYear, "2026-2027");
    assert.equal(
        snapshot.summaryCards.find((card) => card.id === "access_code_coverage")?.value,
        "2 / 3",
    );
    assert.equal(
        snapshot.summaryCards.find((card) => card.id === "du_assignment_coverage")?.value,
        "2 / 3",
    );
    assert.equal(
        snapshot.summaryCards.find((card) => card.id === "deadline_readiness")?.value,
        "3 / 3",
    );
    assert.equal(snapshot.departmentReadiness.items.length, 3);
    assert.equal(
        snapshot.departmentReadiness.items.find((item) => item.id === "department-1")
            ?.accessCode.state,
        "available",
    );
    assert.equal(
        snapshot.departmentReadiness.items.find((item) => item.id === "department-2")
            ?.departmentUser.state,
        "setup_required",
    );
    assert.equal(
        snapshot.alerts.some(
            (alert) =>
                alert.message ===
                "Submission deadline not set. Configure before DUs can submit.",
        ),
        true,
    );
    assert.equal(snapshot.futurePanels.find((panel) => panel.id === "categories")?.state, "coming_soon");
    assert.equal(snapshot.futurePanels.find((panel) => panel.id === "request_inbox")?.state, "unavailable");
    completedTests.push(
        "procurement-officer snapshot shaping deduplicates access-code and DU coverage by department, keeps shared-deadline warnings honest, and leaves future panels explicitly unavailable",
    );

    const emptySnapshot = buildProcurementOfficerDashboardSnapshot({
        accessCodes: [],
        departments: [],
        departmentUserProfiles: [],
        now: Date.UTC(2026, 7, 10, 12, 0, 0),
        tenant: {
            id: "tenant-2",
            name: "Maseno University",
        },
    });
    assert.equal(emptySnapshot.hero.state, "empty");
    assert.equal(emptySnapshot.hero.primaryAction.label, "Create your first department");
    assert.equal(emptySnapshot.departmentReadiness.state, "empty");
    assert.equal(
        emptySnapshot.alerts.some(
            (alert) =>
                alert.message ===
                "Fiscal year not configured. Contact your Tenant Admin.",
        ),
        true,
    );
    completedTests.push(
        "procurement-officer empty states surface the first-department CTA and exact fiscal-year warning copy instead of misleading readiness metrics",
    );

    assert.deepEqual(
        normalizeProcurementOfficerWorkspaceModalState({
            modal: "categories",
            section: "items",
        }),
        {
            modal: "categories",
            section: "items",
        },
    );
    assert.equal(
        buildProcurementOfficerWorkspaceModalPath({
            modal: "departments",
        }),
        "/po?modal=departments",
    );
    assert.deepEqual(
        resolveProcurementOfficerWorkspaceNavigation("/po/categories/items"),
        {
            href: "/po?modal=categories&section=items",
            modalState: {
                modal: "categories",
                section: "items",
            },
            type: "modal",
        },
    );
    assert.deepEqual(
        resolveProcurementOfficerWorkspaceNavigation("/po/consolidation"),
        {
            href: "/po/consolidation",
            type: "route",
        },
    );
    completedTests.push(
        "procurement-officer workspace routing keeps consolidation as a real page while dashboard surfaces resolve to modal-backed paths",
    );

    const poRoutes = [
        "/po",
        "/po/departments",
        "/po/categories",
        "/po/categories/items",
        "/po/items",
        "/po/access-codes",
        "/po/deadlines",
        "/po/requests",
        "/po/consolidation",
    ];
    for (const route of poRoutes) {
        assert.equal(getProtectedRouteRole(route), "procurement_officer");
    }
    completedTests.push(
        "procurement-officer placeholder routes remain under the existing segment-aware role guard",
    );

    return completedTests;
}
