"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTenantAdminDashboardTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const dashboard_1 = require("../lib/shared/tenant-admin/dashboard");
const dashboard_snapshot_1 = require("../lib/shared/tenant-admin/dashboard-snapshot");
const dashboard_cache_1 = require("../lib/frontend/tenant-admin/dashboard-cache");
function createSnapshotFixture() {
    return (0, dashboard_snapshot_1.buildTenantAdminDashboardSnapshot)({
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
function runTenantAdminDashboardTests() {
    const completedTests = [];
    const juneFiscalYear = (0, dashboard_1.getFiscalYearForDate)(Date.UTC(2026, 5, 30));
    const julyFiscalYear = (0, dashboard_1.getFiscalYearForDate)(Date.UTC(2026, 6, 1));
    strict_1.default.equal(juneFiscalYear.key, "2025-2026");
    strict_1.default.equal(julyFiscalYear.key, "2026-2027");
    strict_1.default.deepEqual((0, dashboard_1.buildAvailableFiscalYears)({
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
    }), ["2026-2027", "2025-2026", "2024-2025"]);
    completedTests.push("tenant-admin fiscal-year helpers honor the Kenya July-to-June boundary and keep selector options stable");
    const beforeStartState = (0, dashboard_1.deriveDashboardCyclePresentation)({
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
    const cycleCompleteState = (0, dashboard_1.deriveDashboardCyclePresentation)({
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
    const inconsistentWindowState = (0, dashboard_1.deriveDashboardCyclePresentation)({
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
    strict_1.default.equal(beforeStartState.state, "before_start");
    strict_1.default.equal(beforeStartState.countdown.mode, "until_start");
    strict_1.default.equal(cycleCompleteState.state, "cycle_complete");
    strict_1.default.equal(inconsistentWindowState.state, "setup_required");
    strict_1.default.equal(inconsistentWindowState.reason, "inconsistent_windows");
    completedTests.push("tenant-admin cycle-state derivation distinguishes setup-required, pre-start, and completed timelines without inventing unsafe dates");
    const onboardingWithoutPo = (0, dashboard_1.deriveOnboardingChecklist)({
        cycleState: "setup_required",
        departmentCount: 0,
        procurementOfficerCount: 0,
    });
    const quickActionsWithoutPo = (0, dashboard_1.deriveQuickActions)({
        cycleState: "setup_required",
        departmentCount: 0,
        procurementOfficerCount: 0,
    });
    const quickActionsAfterSetup = (0, dashboard_1.deriveQuickActions)({
        cycleState: "cycle_complete",
        departmentCount: 4,
        procurementOfficerCount: 2,
    });
    strict_1.default.equal(onboardingWithoutPo.find((item) => item.id === "add_po")?.isPriority, true);
    strict_1.default.equal(onboardingWithoutPo.find((item) => item.id === "configure_settings")?.status, "blocked");
    strict_1.default.equal(quickActionsWithoutPo.find((item) => item.id === "add_po")?.highlighted, true);
    strict_1.default.equal(quickActionsAfterSetup.find((item) => item.id === "view_reports")?.highlighted, true);
    completedTests.push("tenant-admin onboarding and quick actions prioritize missing setup prerequisites before later-story destinations");
    const cacheKey = (0, dashboard_cache_1.createTenantAdminDashboardCacheKey)({
        fiscalYear: "2026-2027",
        tenantId: "tenant-1",
    });
    strict_1.default.equal(cacheKey, "procureline.tenant-admin-dashboard:tenant-1:2026-2027");
    const liveSnapshot = createSnapshotFixture();
    const cachedSnapshot = createSnapshotFixture();
    const cachedState = (0, dashboard_cache_1.resolveDashboardSnapshotState)({
        cachedEnvelope: {
            cachedAt: Date.UTC(2026, 6, 10, 10, 30, 0),
            fiscalYear: "2026-2027",
            snapshot: cachedSnapshot,
            tenantId: "tenant-1",
        },
    });
    const livePreferredState = (0, dashboard_cache_1.resolveDashboardSnapshotState)({
        cachedEnvelope: {
            cachedAt: Date.UTC(2026, 6, 10, 10, 30, 0),
            fiscalYear: "2026-2027",
            snapshot: cachedSnapshot,
            tenantId: "tenant-1",
        },
        liveSnapshot,
    });
    strict_1.default.equal(cachedState.state, "cached");
    strict_1.default.equal(cachedState.showStaleBanner, true);
    strict_1.default.equal(cachedState.snapshot?.meta.sourceState, "cached");
    strict_1.default.equal(livePreferredState.state, "live");
    strict_1.default.equal(livePreferredState.showStaleBanner, false);
    strict_1.default.equal(livePreferredState.snapshot?.meta.sourceState, "live");
    completedTests.push("tenant-admin stale snapshot metadata is isolated by tenant-plus-fiscal-year and only appears when live data is unavailable");
    const snapshot = (0, dashboard_snapshot_1.buildTenantAdminDashboardSnapshot)({
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
    strict_1.default.equal(snapshot.userSummary.activeTotal, 3);
    strict_1.default.equal(snapshot.userSummary.procurementOfficers, 2);
    strict_1.default.equal(snapshot.userSummary.tenantAdmins, 1);
    strict_1.default.equal(snapshot.userSummary.departmentUsers, 0);
    strict_1.default.equal(snapshot.summaryCards.totalPOs.value, "2");
    strict_1.default.equal(snapshot.summaryCards.departments.value, "2");
    strict_1.default.equal(snapshot.summaryCards.submissionProgress.dataState, "unavailable");
    strict_1.default.equal(snapshot.summaryCards.budgetUtilization.dataState, "unavailable");
    strict_1.default.equal(snapshot.departmentStatus.length, 2);
    strict_1.default.equal(snapshot.departmentStatus[0]?.statusLabel, "In progress");
    strict_1.default.equal(snapshot.activityFeed.items.length, 20);
    strict_1.default.equal(snapshot.activityFeed.items[0]?.id, "activity-23");
    completedTests.push("tenant-admin snapshot shaping counts active POs and departments, truncates recent activity to 20 events, and keeps unavailable metrics honest");
    return completedTests;
}
exports.runTenantAdminDashboardTests = runTenantAdminDashboardTests;
