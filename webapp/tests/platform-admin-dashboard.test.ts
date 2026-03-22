import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getProtectedRouteRole } from "../lib/auth/roles";
import {
    createPlatformAdminDashboardReadAccessToken,
    verifyPlatformAdminDashboardReadAccessToken,
} from "../lib/platform-admin/dashboard-access-token";
import {
    filterPlatformAdminAlertsBySeverity,
    getPlatformAdminTimestampPresentation,
    movePlatformAdminWidget,
    normalizePlatformAdminDashboardPreferences,
} from "../lib/platform-admin/dashboard";
import { buildPlatformAdminDashboardSnapshot } from "../lib/platform-admin/dashboard-snapshot";

export async function runPlatformAdminDashboardTests(): Promise<string[]> {
    const completedTests: string[] = [];

    const timestampPresentation = getPlatformAdminTimestampPresentation({
        localLocale: "en-GB",
        localTimeZone: "Africa/Nairobi",
        timestamp: Date.UTC(2026, 2, 22, 8, 15, 0),
    });
    assert.equal(timestampPresentation.iso, "2026-03-22T08:15:00.000Z");
    assert.equal(timestampPresentation.utcLabel.includes("UTC"), true);
    assert.equal(timestampPresentation.localLabel.includes("GMT+3"), true);
    completedTests.push(
        "platform-admin timestamps keep UTC visible while exposing a deterministic local-time companion label",
    );

    assert.deepEqual(
        filterPlatformAdminAlertsBySeverity(
            [
                { id: "critical", severity: "critical" as const },
                { id: "warning", severity: "warning" as const },
                { id: "info", severity: "info" as const },
            ],
            "warning",
        ).map((alert) => alert.id),
        ["critical", "warning"],
    );
    assert.deepEqual(
        movePlatformAdminWidget({
            direction: "forward",
            widgetId: "recent_tenants",
            widgetOrder: ["recent_tenants", "system_health", "recent_alerts"],
        }),
        ["system_health", "recent_tenants", "recent_alerts"],
    );
    completedTests.push(
        "platform-admin severity filtering and widget reordering stay pure and deterministic",
    );

    assert.deepEqual(
        normalizePlatformAdminDashboardPreferences({
            alertSeverityFilter: "critical",
            hiddenWidgetIds: ["recent_alerts", "recent_alerts"],
            sidebarCollapsed: true,
            widgetOrder: ["recent_tenants", "system_health"],
        }),
        {
            alertSeverityFilter: "all",
            hiddenWidgetIds: [],
            sidebarCollapsed: false,
            widgetOrder: ["recent_tenants", "system_health", "recent_alerts"],
        },
    );
    completedTests.push(
        "platform-admin invalid saved preferences fail closed to the default layout instead of breaking the dashboard shell",
    );

    const dashboardReadAccessToken =
        await createPlatformAdminDashboardReadAccessToken({
            now: Date.UTC(2026, 2, 22, 8, 15, 0),
            secret: "platform-admin-dashboard-test-secret",
            userId: "user-platform-admin",
        });
    const verifiedDashboardReadAccess =
        await verifyPlatformAdminDashboardReadAccessToken({
            now: Date.UTC(2026, 2, 22, 8, 20, 0),
            secret: "platform-admin-dashboard-test-secret",
            token: dashboardReadAccessToken,
            userId: "user-platform-admin",
        });
    assert.deepEqual(verifiedDashboardReadAccess, { ok: true });
    const rejectedDashboardReadAccess =
        await verifyPlatformAdminDashboardReadAccessToken({
            now: Date.UTC(2026, 2, 22, 8, 20, 0),
            secret: "platform-admin-dashboard-test-secret",
            token: dashboardReadAccessToken,
            userId: "user-someone-else",
        });
    assert.deepEqual(rejectedDashboardReadAccess, {
        ok: false,
        reason: "invalid",
    });
    completedTests.push(
        "platform-admin dashboard access tokens are signed, time-bound, and scoped to the current admin user",
    );

    const snapshot = buildPlatformAdminDashboardSnapshot({
        auditLogs: [
            {
                action: "delete",
                entityType: "tenant",
                event: "tenant.cancelled",
                id: "audit-1",
                metadata: { summary: "Tenant cancelled for non-payment" },
                outcome: "allowed",
                targetTenantId: "tenant-2",
                timestamp: Date.UTC(2026, 2, 22, 9, 45, 0),
            },
        ],
        currentAdmin: {
            email: "platform@example.com",
            initials: "PA",
            name: "Platform Admin",
        },
        departments: [
            { id: "department-1", isActive: true, tenantId: "tenant-1" },
            { id: "department-2", isActive: true, tenantId: "tenant-1" },
            { id: "department-3", isActive: true, tenantId: "tenant-3" },
        ],
        externalSyncEvents: [
            {
                eventKey: "sync-1",
                eventType: "billing_sync",
                id: "sync-1",
                lastError: { code: "SYNC_FAILED", message: "Provider timeout" },
                provider: "stripe",
                status: "failed",
                updatedAt: Date.UTC(2026, 2, 22, 10, 15, 0),
            },
        ],
        healthSnapshot: {
            api: { detail: "Response time high", state: "warning" },
            capturedAt: Date.UTC(2026, 2, 22, 10, 0, 0),
            database: { detail: "Operational", state: "healthy" },
            jobs: { detail: "Backlog elevated", state: "warning" },
            storage: { detail: "Operational", state: "healthy" },
        },
        isolationEvents: [
            {
                event: "tenant.probe_blocked",
                id: "isolation-1",
                outcome: "blocked_not_found",
                tableName: "tenantUsers",
                targetTenantId: "tenant-3",
                timestamp: Date.UTC(2026, 2, 22, 10, 30, 0),
            },
        ],
        now: Date.UTC(2026, 2, 22, 10, 35, 0),
        preferences: {
            alertSeverityFilter: "warning",
            hiddenWidgetIds: [],
            sidebarCollapsed: true,
            widgetOrder: ["recent_tenants", "system_health", "recent_alerts"],
        },
        subscriptionTiers: [
            { billingCycle: "annual", isActive: true, priceUSD: 0, slug: "free" },
            { billingCycle: "annual", isActive: true, priceUSD: 3850, slug: "starter" },
            { billingCycle: "annual", isActive: true, priceUSD: 9230, slug: "professional" },
            { billingCycle: "annual", isActive: true, priceUSD: 18460, slug: "enterprise" },
        ],
        tenantUsers: [
            { id: "tenant-user-1", isActive: true, role: "tenant_admin", tenantId: "tenant-1" },
            { id: "tenant-user-2", isActive: true, role: "procurement_officer", tenantId: "tenant-1" },
            { id: "tenant-user-3", isActive: true, role: "tenant_admin", tenantId: "tenant-3" },
            { id: "tenant-user-4", isActive: false, role: "tenant_admin", tenantId: "tenant-2" },
        ],
        tenants: [
            {
                createdAt: Date.UTC(2026, 2, 1, 8, 0, 0),
                id: "tenant-1",
                name: "Pwani University",
                status: "active",
                subdomain: "pwani",
                tier: "professional",
            },
            {
                createdAt: Date.UTC(2026, 2, 10, 8, 0, 0),
                id: "tenant-2",
                name: "Maseno University",
                status: "cancelled",
                subdomain: "maseno",
                tier: "starter",
            },
            {
                createdAt: Date.UTC(2026, 2, 21, 8, 0, 0),
                id: "tenant-3",
                name: "Karatina University",
                status: "active",
                subdomain: "karatina",
                tier: "enterprise",
            },
        ],
    });
    assert.equal(snapshot.meta.tierCounts.professional, 1);
    assert.equal(snapshot.meta.tierCounts.enterprise, 1);
    assert.equal(snapshot.meta.statusCounts.cancelled, 1);
    assert.equal(snapshot.recentTenants.rows[0]?.id, "tenant-3");
    assert.equal(snapshot.recentTenants.rows[0]?.departmentCount, 1);
    assert.equal(snapshot.summaryCards.find((card) => card.id === "recurring_revenue")?.value, "$27,690");
    assert.equal(snapshot.summaryCards.find((card) => card.id === "urgent_issues")?.state, "critical");
    assert.equal(snapshot.healthSummary.tiles.find((tile) => tile.id === "email")?.state, "partial");
    assert.equal(snapshot.preferences.sidebarCollapsed, true);
    completedTests.push(
        "platform-admin snapshot shaping counts tiers and statuses truthfully, orders recent tenants by live join time, excludes cancelled tenants from recurring revenue, and leaves missing health fields partial",
    );

    const unavailableRevenueSnapshot = buildPlatformAdminDashboardSnapshot({
        auditLogs: [],
        currentAdmin: {
            email: "platform@example.com",
            initials: "PA",
            name: "Platform Admin",
        },
        departments: [],
        externalSyncEvents: [],
        healthSnapshot: null,
        isolationEvents: [],
        now: Date.UTC(2026, 2, 22, 12, 0, 0),
        preferences: null,
        subscriptionTiers: [
            { billingCycle: "annual", isActive: true, priceUSD: 0, slug: "free" },
            { billingCycle: "annual", isActive: true, priceUSD: 3850, slug: "starter" },
        ],
        tenantUsers: [],
        tenants: [
            {
                createdAt: Date.UTC(2026, 2, 12, 8, 0, 0),
                id: "tenant-paid",
                name: "Egerton University",
                status: "active",
                subdomain: "egerton",
                tier: "enterprise",
            },
        ],
    });
    assert.equal(
        unavailableRevenueSnapshot.summaryCards.find((card) => card.id === "recurring_revenue")?.state,
        "awaiting_source",
    );
    assert.equal(unavailableRevenueSnapshot.healthSummary.state, "awaiting_source");
    completedTests.push(
        "platform-admin revenue and health panels surface explicit awaiting-source states when the live catalog or health snapshot source is missing",
    );

    const staleHealthSnapshot = buildPlatformAdminDashboardSnapshot({
        auditLogs: [],
        currentAdmin: {
            email: "platform@example.com",
            initials: "PA",
            name: "Platform Admin",
        },
        departments: [],
        externalSyncEvents: [],
        healthSnapshot: {
            api: { detail: "Operational", state: "healthy" },
            capturedAt: Date.UTC(2026, 2, 22, 8, 0, 0),
            database: { detail: "Operational", state: "healthy" },
            email: { detail: "Operational", state: "healthy" },
            jobs: { detail: "Operational", state: "healthy" },
            storage: { detail: "Operational", state: "healthy" },
        },
        isolationEvents: [],
        now: Date.UTC(2026, 2, 22, 9, 0, 1),
        preferences: null,
        subscriptionTiers: [],
        tenantUsers: [],
        tenants: [],
    });
    assert.equal(
        staleHealthSnapshot.healthSummary.tiles.every((tile) => tile.state !== "healthy"),
        true,
    );
    assert.equal(staleHealthSnapshot.healthSummary.state, "stale");
    completedTests.push(
        "platform-admin stale health snapshots never render all services as healthy and surface a stale summary state",
    );

    const truthfulSnapshot = buildPlatformAdminDashboardSnapshot({
        auditLogs: [
            {
                action: "update",
                entityType: "tenant",
                event: "tenant.updated",
                id: "audit-test-tenant",
                metadata: { summary: "Pricing E2E tenant updated" },
                outcome: "allowed",
                targetTenantId: "tenant-test",
                timestamp: Date.UTC(2026, 2, 22, 11, 5, 0),
            },
            {
                action: "e2e.delete",
                entityType: "sync_job",
                event: "pricing.e2e.failed",
                id: "audit-global-test",
                metadata: { summary: "Pricing E2E suite failed during platform validation" },
                outcome: "failed",
                timestamp: Date.UTC(2026, 2, 22, 11, 7, 0),
            },
        ],
        currentAdmin: {
            email: "platform@example.com",
            initials: "PA",
            name: "Platform Admin",
        },
        departments: [
            { id: "department-live", isActive: true, tenantId: "tenant-live" },
            { id: "department-test", isActive: true, tenantId: "tenant-test" },
        ],
        externalSyncEvents: [
            {
                eventKey: "pricing-e2e-sync",
                eventType: "pricing_e2e_retry",
                id: "sync-global-test",
                lastError: { code: "E2E_FAILED", message: "Pricing E2E timeout" },
                metadata: { suite: "pricing-e2e" },
                provider: "stripe",
                status: "failed",
                updatedAt: Date.UTC(2026, 2, 22, 11, 8, 0),
            },
        ],
        healthSnapshot: null,
        isolationEvents: [
            {
                event: "tenant.probe_blocked",
                id: "isolation-test-tenant",
                outcome: "blocked_not_found",
                tableName: "tenantUsers",
                targetTenantId: "tenant-test",
                timestamp: Date.UTC(2026, 2, 22, 11, 6, 0),
            },
            {
                event: "tenant.probe_blocked",
                id: "isolation-global-test",
                outcome: "blocked_missing_metadata",
                recordId: "pricing-e2e-record",
                tableName: "pricing_e2e_runs",
                timestamp: Date.UTC(2026, 2, 22, 11, 9, 0),
            },
        ],
        now: Date.UTC(2026, 2, 22, 11, 10, 0),
        preferences: null,
        subscriptionTiers: [
            { billingCycle: "annual", isActive: true, priceUSD: 0, slug: "free" },
            { billingCycle: "annual", isActive: true, priceUSD: 3850, slug: "starter" },
        ],
        tenantUsers: [
            { id: "tenant-user-live", isActive: true, role: "tenant_admin", tenantId: "tenant-live" },
            { id: "tenant-user-test", isActive: true, role: "tenant_admin", tenantId: "tenant-test" },
        ],
        tenants: [
            {
                createdAt: Date.UTC(2026, 2, 5, 8, 0, 0),
                id: "tenant-live",
                name: "Live University",
                status: "active",
                subdomain: "live-university",
                tier: "starter",
            },
            {
                createdAt: Date.UTC(2026, 2, 20, 8, 0, 0),
                id: "tenant-test",
                name: "Pricing E2E Professional 20260310",
                status: "active",
                subdomain: "pricing-e2e-professional-20260310",
                tier: "starter",
            },
        ],
    });
    assert.equal(truthfulSnapshot.meta.statusCounts.active, 2);
    assert.equal(truthfulSnapshot.recentTenants.rows.length, 2);
    assert.equal(truthfulSnapshot.recentTenants.rows[0]?.id, "tenant-test");
    assert.equal(
        truthfulSnapshot.alerts.allItems.some(
            (item) => item.id === "audit-audit-test-tenant",
        ),
        false,
    );
    assert.equal(
        truthfulSnapshot.alerts.allItems.some(
            (item) => item.id === "audit-audit-global-test",
        ),
        true,
    );
    assert.equal(
        truthfulSnapshot.alerts.allItems.some(
            (item) => item.id === "isolation-isolation-test-tenant",
        ),
        true,
    );
    assert.equal(
        truthfulSnapshot.alerts.allItems.some(
            (item) => item.id === "isolation-isolation-global-test",
        ),
        true,
    );
    assert.equal(
        truthfulSnapshot.alerts.allItems.some(
            (item) => item.id === "sync-sync-global-test",
        ),
        true,
    );
    completedTests.push(
        "platform-admin dashboard keeps live tenants and alerts truthful instead of dropping records based on name heuristics",
    );

    const protectedRoutes = [
        "/platform-admin",
        "/platform-admin/tenants",
        "/platform-admin/subscriptions",
        "/platform-admin/tenant-admins",
        "/platform-admin/analytics",
        "/platform-admin/health",
        "/platform-admin/audit-logs",
        "/platform-admin/errors",
    ];
    for (const route of protectedRoutes) {
        assert.equal(getProtectedRouteRole(route), "platform_admin");
    }
    completedTests.push(
        "platform-admin reserved routes stay under the centralized segment-aware role guard",
    );

    const querySource = readFileSync(
        join(process.cwd(), "convex/functions/platformAdminDashboard.ts"),
        "utf8",
    );
    assert.equal(querySource.includes("requirePlatformAdmin"), true);
    assert.equal(querySource.includes("requireTenantRole"), false);
    assert.equal(querySource.includes("verifyPlatformAdminDashboardReadAccessToken"), true);
    assert.equal(querySource.includes("auditPlatformAdminBypassRead"), true);
    assert.equal(querySource.includes('accessToken: v.string()'), true);
    completedTests.push(
        "platform-admin dashboard queries require a signed read-access token and the audited bypass path before cross-tenant snapshot reads proceed",
    );

    const componentSource = readFileSync(
        join(process.cwd(), "src/components/platform-admin/PlatformAdminDashboard.tsx"),
        "utf8",
    );
    assert.equal(componentSource.includes("appData.tenants"), false);
    assert.equal(componentSource.includes("appData.invoices"), false);
    assert.equal(componentSource.includes("appData.activityLog"), false);
    assert.equal(componentSource.includes("appData.errors"), false);
    assert.equal(componentSource.includes("appData.revenueData"), false);
    assert.equal(
        componentSource.includes("issuePlatformAdminDashboardReadAccess"),
        true,
    );
    completedTests.push(
        "platform-admin dashboard source does not carry prototype mock arrays into production code and requests audited read access before loading the snapshot",
    );

    return completedTests;
}
