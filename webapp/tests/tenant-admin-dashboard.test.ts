import assert from "node:assert/strict";
import {
    buildAvailableFiscalYears,
    deriveDashboardCyclePresentation,
    deriveOnboardingChecklist,
    deriveQuickActions,
    getFiscalYearForDate,
} from "../lib/shared/tenant-admin/dashboard";
import {
    buildTenantAdminDashboardSnapshot,
    type TenantAdminDashboardSnapshot,
} from "../lib/shared/tenant-admin/dashboard-snapshot";
import {
    createTenantAdminDashboardCacheKey,
    resolveDashboardSnapshotState,
} from "../lib/frontend/tenant-admin/dashboard-cache";

function createSnapshotFixture(): TenantAdminDashboardSnapshot {
    return buildTenantAdminDashboardSnapshot({
        activityLogs: [],
        departments: [],
        now: Date.UTC(2026, 6, 10, 9, 30, 0),
        tenant: {
            createdAt: Date.UTC(2025, 6, 1, 0, 0, 0),
            id: "tenant-1",
            name: "Pwani University",
            status: "active",
            tier: "professional",
        },
        tenantUsers: [],
    });
}

export function runTenantAdminDashboardTests(): string[] {
    const completedTests: string[] = [];

    const juneFiscalYear = getFiscalYearForDate(Date.UTC(2026, 5, 30));
    const julyFiscalYear = getFiscalYearForDate(Date.UTC(2026, 6, 1));
    assert.equal(juneFiscalYear.key, "2025-2026");
    assert.equal(julyFiscalYear.key, "2026-2027");
    assert.deepEqual(
        buildAvailableFiscalYears({
            activityTimestamps: [Date.UTC(2025, 7, 10)],
            departmentWindows: [
                {
                    isActive: true,
                    submissionEndsAt: Date.UTC(2024, 6, 20),
                    submissionStartsAt: Date.UTC(2024, 6, 10),
                },
            ],
            now: Date.UTC(2026, 6, 2),
            selectedFiscalYear: "2024-2025",
        }),
        ["2026-2027", "2025-2026", "2024-2025"],
    );
    completedTests.push(
        "tenant-admin fiscal-year helpers honor the Kenya July-to-June boundary and keep selector options stable",
    );

    const beforeStartState = deriveDashboardCyclePresentation({
        departments: [
            {
                isActive: true,
                submissionEndsAt: Date.UTC(2026, 6, 20),
                submissionStartsAt: Date.UTC(2026, 6, 10),
            },
        ],
        fiscalYearKey: "2026-2027",
        now: Date.UTC(2026, 6, 5),
    });
    const cycleCompleteState = deriveDashboardCyclePresentation({
        departments: [
            {
                isActive: true,
                submissionEndsAt: Date.UTC(2026, 6, 20),
                submissionStartsAt: Date.UTC(2026, 6, 10),
            },
        ],
        fiscalYearKey: "2026-2027",
        now: Date.UTC(2026, 6, 25),
    });
    const inconsistentWindowState = deriveDashboardCyclePresentation({
        departments: [
            {
                isActive: true,
                submissionEndsAt: Date.UTC(2026, 6, 20),
                submissionStartsAt: Date.UTC(2026, 6, 10),
            },
            {
                isActive: true,
                submissionEndsAt: Date.UTC(2026, 6, 23),
                submissionStartsAt: Date.UTC(2026, 6, 10),
            },
        ],
        fiscalYearKey: "2026-2027",
        now: Date.UTC(2026, 6, 12),
    });
    assert.equal(beforeStartState.state, "before_start");
    assert.equal(beforeStartState.countdown.mode, "until_start");
    assert.equal(cycleCompleteState.state, "cycle_complete");
    assert.equal(inconsistentWindowState.state, "setup_required");
    assert.equal(inconsistentWindowState.reason, "inconsistent_windows");
    completedTests.push(
        "tenant-admin cycle-state derivation distinguishes setup-required, pre-start, and completed timelines without inventing unsafe dates",
    );

    const onboardingWithoutPo = deriveOnboardingChecklist({
        cycleState: "setup_required",
        departmentCount: 0,
        procurementOfficerCount: 0,
    });
    const quickActionsWithoutPo = deriveQuickActions({
        cycleState: "setup_required",
        departmentCount: 0,
        procurementOfficerCount: 0,
    });
    const quickActionsAfterSetup = deriveQuickActions({
        cycleState: "cycle_complete",
        departmentCount: 4,
        procurementOfficerCount: 2,
    });
    assert.equal(
        onboardingWithoutPo.find((item) => item.id === "add_po")?.isPriority,
        true,
    );
    assert.equal(
        onboardingWithoutPo.find((item) => item.id === "configure_settings")?.status,
        "blocked",
    );
    assert.equal(
        quickActionsWithoutPo.find((item) => item.id === "add_po")?.highlighted,
        true,
    );
    assert.equal(
        quickActionsAfterSetup.find((item) => item.id === "view_reports")?.highlighted,
        true,
    );
    completedTests.push(
        "tenant-admin onboarding and quick actions prioritize missing setup prerequisites before later-story destinations",
    );

    const cacheKey = createTenantAdminDashboardCacheKey({
        fiscalYear: "2026-2027",
        tenantId: "tenant-1",
    });
    assert.equal(
        cacheKey,
        "procureline.tenant-admin-dashboard:tenant-1:2026-2027",
    );

    const liveSnapshot = createSnapshotFixture();
    const cachedSnapshot = createSnapshotFixture();
    const cachedState = resolveDashboardSnapshotState({
        cachedEnvelope: {
            cachedAt: Date.UTC(2026, 6, 10, 10, 30, 0),
            fiscalYear: "2026-2027",
            snapshot: cachedSnapshot,
            tenantId: "tenant-1",
        },
    });
    const livePreferredState = resolveDashboardSnapshotState({
        cachedEnvelope: {
            cachedAt: Date.UTC(2026, 6, 10, 10, 30, 0),
            fiscalYear: "2026-2027",
            snapshot: cachedSnapshot,
            tenantId: "tenant-1",
        },
        liveSnapshot,
    });
    assert.equal(cachedState.state, "cached");
    assert.equal(cachedState.showStaleBanner, true);
    assert.equal(cachedState.snapshot?.meta.sourceState, "cached");
    assert.equal(livePreferredState.state, "live");
    assert.equal(livePreferredState.showStaleBanner, false);
    assert.equal(livePreferredState.snapshot?.meta.sourceState, "live");
    completedTests.push(
        "tenant-admin stale snapshot metadata is isolated by tenant-plus-fiscal-year and only appears when live data is unavailable",
    );

    const snapshot = buildTenantAdminDashboardSnapshot({
        activityLogs: Array.from({ length: 24 }, (_, index) => ({
            action: "update",
            actorRole: index % 2 === 0 ? "tenant_admin" : "procurement_officer",
            entityType: "department",
            event: "department.updated",
            id: `activity-${index}`,
            metadata: {
                actorLabel: index % 2 === 0 ? "Tenant Admin" : "PO",
                entityLabel: `Department ${index}`,
                summary: `Updated submission settings ${index}`,
            },
            outcome: "allowed",
            recordId: `department-${index}`,
            timestamp: Date.UTC(2026, 6, 20, 12, index, 0),
        })),
        departments: [
            {
                createdAt: Date.UTC(2026, 6, 1),
                id: "department-1",
                isActive: true,
                name: "Finance",
                submissionEndsAt: Date.UTC(2026, 6, 20),
                submissionStartsAt: Date.UTC(2026, 6, 10),
                updatedAt: Date.UTC(2026, 6, 3),
            },
            {
                createdAt: Date.UTC(2026, 6, 2),
                id: "department-2",
                isActive: true,
                name: "ICT",
                submissionEndsAt: Date.UTC(2026, 6, 20),
                submissionStartsAt: Date.UTC(2026, 6, 10),
                updatedAt: Date.UTC(2026, 6, 4),
            },
        ],
        now: Date.UTC(2026, 6, 15, 9, 30, 0),
        tenant: {
            createdAt: Date.UTC(2025, 6, 1),
            id: "tenant-1",
            name: "Pwani University",
            status: "active",
            tier: "professional",
        },
        tenantUsers: [
            { id: "tenant-user-1", isActive: true, role: "tenant_admin" },
            { id: "tenant-user-2", isActive: true, role: "procurement_officer" },
            { id: "tenant-user-3", isActive: true, role: "procurement_officer" },
            { id: "tenant-user-4", isActive: false, role: "procurement_officer" },
        ],
    });
    assert.equal(snapshot.userSummary.activeTotal, 3);
    assert.equal(snapshot.userSummary.procurementOfficers, 2);
    assert.equal(snapshot.userSummary.tenantAdmins, 1);
    assert.equal(snapshot.userSummary.departmentUsers, 0);
    assert.equal(snapshot.summaryCards.totalPOs.value, "2");
    assert.equal(snapshot.summaryCards.departments.value, "2");
    assert.equal(snapshot.summaryCards.submissionProgress.dataState, "unavailable");
    assert.equal(snapshot.summaryCards.budgetUtilization.dataState, "unavailable");
    assert.equal(snapshot.departmentStatus.length, 2);
    assert.equal(snapshot.departmentStatus[0]?.statusLabel, "In progress");
    assert.equal(snapshot.activityFeed.items.length, 20);
    assert.equal(snapshot.activityFeed.items[0]?.id, "activity-23");
    completedTests.push(
        "tenant-admin snapshot shaping counts active POs and departments, truncates recent activity to 20 events, and keeps unavailable metrics honest",
    );

    return completedTests;
}
