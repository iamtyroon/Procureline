import {
    getPlatformAdminRevenuePresentation,
    getPlatformAdminUtcTimestampLabel,
    humanizePlatformAdminToken,
    isPlatformHealthSnapshotStale,
    normalizePlatformAdminDashboardPreferences,
    type PlatformAdminAlertSeverity,
    type PlatformAdminDashboardPreferences,
    type PlatformAdminHealthServiceState,
    type PlatformAdminSummaryState,
} from "./dashboard";

export type PlatformAdminTenantTier =
    | "enterprise"
    | "free"
    | "professional"
    | "starter";

export type PlatformAdminTenantStatus =
    | "active"
    | "cancelled"
    | "pending"
    | "suspended";

export interface PlatformAdminTenantRecord {
    createdAt: number;
    id: string;
    name: string;
    status: PlatformAdminTenantStatus;
    subdomain: string;
    tier: PlatformAdminTenantTier;
}

export interface PlatformAdminDepartmentRecord {
    id: string;
    isActive: boolean;
    tenantId: string;
}

export interface PlatformAdminTenantUserRecord {
    id: string;
    isActive: boolean;
    role: "department_user" | "procurement_officer" | "tenant_admin";
    tenantId: string;
}

export interface PlatformAdminSubscriptionTierRecord {
    billingCycle: string;
    isActive: boolean;
    priceUSD: number;
    slug: string;
}

export interface PlatformAdminHealthServiceRecord {
    detail?: string;
    state: "critical" | "healthy" | "warning";
}

export interface PlatformAdminHealthSnapshotRecord {
    api?: PlatformAdminHealthServiceRecord;
    capturedAt: number;
    database?: PlatformAdminHealthServiceRecord;
    email?: PlatformAdminHealthServiceRecord;
    jobs?: PlatformAdminHealthServiceRecord;
    storage?: PlatformAdminHealthServiceRecord;
    summaryState?: "critical" | "healthy" | "warning";
}

export interface PlatformAdminAuditLogRecord {
    action: string;
    entityType: string;
    event: string;
    id: string;
    metadata?: unknown;
    outcome: string;
    sourceTenantId?: string;
    targetTenantId?: string;
    timestamp: number;
}

export interface PlatformAdminIsolationEventRecord {
    event: "tenant.platform_read_allowed" | "tenant.probe_blocked";
    id: string;
    outcome:
        | "allowed_platform_bypass"
        | "blocked_missing_metadata"
        | "blocked_not_found";
    recordId?: string;
    tableName: string;
    targetTenantId?: string;
    timestamp: number;
}

export interface PlatformAdminExternalSyncRecord {
    eventKey: string;
    eventType: string;
    id: string;
    lastError?: {
        code: string;
        message: string;
    } | null;
    metadata?: unknown;
    provider: string;
    status: "claimed" | "completed" | "failed";
    updatedAt: number;
}

export interface PlatformAdminCurrentUserProfile {
    email: string;
    initials: string;
    name: string;
}

export interface PlatformAdminDashboardNavigationItem {
    href: string;
    id:
        | "analytics"
        | "audit_logs"
        | "dashboard"
        | "errors"
        | "free_tier"
        | "health"
        | "configuration"
        | "security"
        | "subscriptions"
        | "support"
        | "tenant_admins"
        | "tenants";
    label: string;
}

export interface PlatformAdminDashboardNavigationGroup {
    items: PlatformAdminDashboardNavigationItem[];
    label:
        | "Overview"
        | "Platform"
        | "Support"
        | "Tenant Management"
        | "User Management";
}

export interface PlatformAdminSummaryCard {
    helperText: string;
    id:
        | "recurring_revenue"
        | "tenant_attention"
        | "total_tenants"
        | "urgent_issues";
    label: string;
    state: PlatformAdminSummaryState;
    statusLabel: string;
    tone: "critical" | "neutral" | "positive" | "warning";
    value: string;
}

export interface PlatformAdminRecentTenantRow {
    activeUserCount: number | null;
    departmentCount: number | null;
    id: string;
    joinedAt: number;
    joinedAtLabel: string;
    name: string;
    status: PlatformAdminTenantStatus;
    tier: PlatformAdminTenantTier;
}

export interface PlatformAdminRecentTenantsPanel {
    rows: PlatformAdminRecentTenantRow[];
    state: "available" | "empty";
    totalCount: number;
}

export interface PlatformAdminHealthTile {
    detail: string;
    id: "api" | "database" | "email" | "jobs" | "storage";
    label: string;
    state: PlatformAdminHealthServiceState;
    statusLabel: string;
}

export interface PlatformAdminHealthSummary {
    capturedAt: number | null;
    capturedAtLabel: string | null;
    state:
        | "available"
        | "awaiting_source"
        | "critical"
        | "partial"
        | "stale"
        | "warning";
    summaryLabel: string;
    tiles: PlatformAdminHealthTile[];
}

export interface PlatformAdminAlertItem {
    href: string;
    id: string;
    occurredAt: number;
    occurredAtLabel: string;
    severity: PlatformAdminAlertSeverity;
    sourceLabel: string;
    summary: string;
    title: string;
}

export interface PlatformAdminAlertsPanel {
    allItems: PlatformAdminAlertItem[];
    state: "available" | "empty";
    totalCount: number;
}

export interface PlatformAdminDashboardSnapshot {
    alerts: PlatformAdminAlertsPanel;
    currentAdmin: PlatformAdminCurrentUserProfile;
    healthSummary: PlatformAdminHealthSummary;
    meta: {
        generatedAt: number;
        statusCounts: Record<PlatformAdminTenantStatus, number>;
        tierCounts: Record<PlatformAdminTenantTier, number>;
    };
    navigation: PlatformAdminDashboardNavigationGroup[];
    preferences: PlatformAdminDashboardPreferences;
    recentTenants: PlatformAdminRecentTenantsPanel;
    summaryCards: PlatformAdminSummaryCard[];
}

export interface BuildPlatformAdminDashboardSnapshotArgs {
    auditLogs: readonly PlatformAdminAuditLogRecord[];
    currentAdmin: PlatformAdminCurrentUserProfile;
    departments: readonly PlatformAdminDepartmentRecord[];
    externalSyncEvents: readonly PlatformAdminExternalSyncRecord[];
    healthSnapshot: PlatformAdminHealthSnapshotRecord | null;
    isolationEvents: readonly PlatformAdminIsolationEventRecord[];
    now: number;
    preferences: unknown;
    subscriptionTiers: readonly PlatformAdminSubscriptionTierRecord[];
    tenantUsers: readonly PlatformAdminTenantUserRecord[];
    tenants: readonly PlatformAdminTenantRecord[];
}

const PLATFORM_ADMIN_NAVIGATION: PlatformAdminDashboardNavigationGroup[] = [
    {
        label: "Overview",
        items: [
            {
                href: "/platform-admin",
                id: "dashboard",
                label: "Dashboard",
            },
        ],
    },
    {
        label: "Tenant Management",
        items: [
            {
                href: "/platform-admin/tenants",
                id: "tenants",
                label: "All Tenants",
            },
            {
                href: "/platform-admin/subscriptions",
                id: "subscriptions",
                label: "Subscriptions",
            },
            {
                href: "/platform-admin/free-tier",
                id: "free_tier",
                label: "Free Tier",
            },
        ],
    },
    {
        label: "User Management",
        items: [
            {
                href: "/platform-admin/tenant-admins",
                id: "tenant_admins",
                label: "Tenant Admins",
            },
        ],
    },
    {
        label: "Platform",
        items: [
            {
                href: "/platform-admin/analytics",
                id: "analytics",
                label: "Analytics",
            },
            {
                href: "/platform-admin/health",
                id: "health",
                label: "System Health",
            },
            {
                href: "/platform-admin/security",
                id: "security",
                label: "Security",
            },
            {
                href: "/platform-admin/configuration",
                id: "configuration",
                label: "Configuration",
            },
        ],
    },
    {
        label: "Support",
        items: [
            {
                href: "/platform-admin/support",
                id: "support",
                label: "Tickets & Incidents",
            },
            {
                href: "/platform-admin/audit-logs",
                id: "audit_logs",
                label: "Audit Logs",
            },
            {
                href: "/platform-admin/errors",
                id: "errors",
                label: "Error Monitor",
            },
        ],
    },
];

const HEALTH_TILE_META = [
    {
        emptyDetail: "No telemetry available yet.",
        id: "api",
        label: "API Server",
    },
    {
        emptyDetail: "No telemetry available yet.",
        id: "database",
        label: "Database",
    },
    {
        emptyDetail: "No telemetry available yet.",
        id: "jobs",
        label: "Jobs",
    },
    {
        emptyDetail: "No telemetry available yet.",
        id: "storage",
        label: "Storage",
    },
    {
        emptyDetail: "No telemetry available yet.",
        id: "email",
        label: "Email Service",
    },
] as const;

function createEmptyTierCounts(): Record<PlatformAdminTenantTier, number> {
    return {
        enterprise: 0,
        free: 0,
        professional: 0,
        starter: 0,
    };
}

function createEmptyStatusCounts(): Record<PlatformAdminTenantStatus, number> {
    return {
        active: 0,
        cancelled: 0,
        pending: 0,
        suspended: 0,
    };
}

function readMetadataString(metadata: unknown, key: string): string | null {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        return null;
    }

    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getCurrentTierPriceAnnualUsd(
    tier: PlatformAdminSubscriptionTierRecord,
): number | null {
    if (!tier.isActive || !Number.isFinite(tier.priceUSD) || tier.priceUSD < 0) {
        return null;
    }

    if (typeof tier.billingCycle !== "string") {
        return null;
    }

    const billingCycle = tier.billingCycle.trim().toLowerCase();
    if (!billingCycle) {
        return null;
    }

    if (billingCycle === "annual" || billingCycle === "yearly") {
        return tier.priceUSD;
    }

    if (billingCycle === "monthly") {
        return tier.priceUSD * 12;
    }

    return null;
}

function buildRecentTenants(args: {
    departments: readonly PlatformAdminDepartmentRecord[];
    tenantUsers: readonly PlatformAdminTenantUserRecord[];
    tenants: readonly PlatformAdminTenantRecord[];
}): PlatformAdminRecentTenantsPanel {
    const activeDepartmentCountByTenantId = new Map<string, number>();
    const activeUserCountByTenantId = new Map<string, number>();

    for (const department of args.departments) {
        if (!department.isActive) {
            continue;
        }

        activeDepartmentCountByTenantId.set(
            department.tenantId,
            (activeDepartmentCountByTenantId.get(department.tenantId) ?? 0) + 1,
        );
    }

    for (const tenantUser of args.tenantUsers) {
        if (!tenantUser.isActive) {
            continue;
        }

        activeUserCountByTenantId.set(
            tenantUser.tenantId,
            (activeUserCountByTenantId.get(tenantUser.tenantId) ?? 0) + 1,
        );
    }

    const rows = [...args.tenants]
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, 5)
        .map((tenant) => ({
            activeUserCount:
                activeUserCountByTenantId.get(tenant.id) ?? 0,
            departmentCount:
                activeDepartmentCountByTenantId.get(tenant.id) ?? 0,
            id: tenant.id,
            joinedAt: tenant.createdAt,
            joinedAtLabel: getPlatformAdminUtcTimestampLabel(tenant.createdAt),
            name: tenant.name,
            status: tenant.status,
            tier: tenant.tier,
        }));

    return {
        rows,
        state: rows.length > 0 ? "available" : "empty",
        totalCount: args.tenants.length,
    };
}

function buildRevenueSummaryCardBase(args: {
    labels: {
        awaitingSource: string;
        available: string;
        empty: string;
    };
    statusCounts: Record<PlatformAdminTenantStatus, number>;
    subscriptionTiers: readonly PlatformAdminSubscriptionTierRecord[];
    tenants: readonly PlatformAdminTenantRecord[];
}): PlatformAdminSummaryCard {
    const annualTierPriceBySlug = new Map<string, number>();

    for (const subscriptionTier of args.subscriptionTiers) {
        const annualPrice = getCurrentTierPriceAnnualUsd(subscriptionTier);
        if (annualPrice === null) {
            continue;
        }

        annualTierPriceBySlug.set(subscriptionTier.slug, annualPrice);
    }

    const activeTenants = args.tenants.filter((tenant) => tenant.status === "active");
    const billableActiveTenants = activeTenants.filter((tenant) => tenant.tier !== "free");
    const missingTierCatalog = billableActiveTenants.some(
        (tenant) => !annualTierPriceBySlug.has(tenant.tier),
    );

    if (missingTierCatalog) {
        return {
            helperText:
                "Recurring revenue is waiting on an active pricing catalog that matches every paid tenant tier.",
            id: "recurring_revenue",
            label: "Recurring Revenue",
            state: "awaiting_source",
            statusLabel: args.labels.awaitingSource,
            tone: "warning",
            value: "Unavailable",
        };
    }

    const annualRevenueUsd = billableActiveTenants.reduce((total, tenant) => {
        return total + (annualTierPriceBySlug.get(tenant.tier) ?? 0);
    }, 0);
    const revenuePresentation =
        getPlatformAdminRevenuePresentation(annualRevenueUsd);

    if (billableActiveTenants.length === 0) {
        return {
            helperText:
                args.statusCounts.active === 0
                    ? "No active billable tenants are contributing recurring revenue yet."
                    : "Active tenants are currently on Free, so recurring revenue remains at zero.",
            id: "recurring_revenue",
            label: "Recurring Revenue",
            state: "empty",
            statusLabel: args.labels.empty,
            tone: "neutral",
            value: revenuePresentation.annualLabel,
        };
    }

    return {
        helperText: `${revenuePresentation.monthlyLabel} across ${billableActiveTenants.length} active paid tenant${billableActiveTenants.length === 1 ? "" : "s"}.`,
        id: "recurring_revenue",
        label: "Recurring Revenue",
        state: "available",
        statusLabel: args.labels.available,
        tone: "positive",
        value: revenuePresentation.annualLabel,
    };
}

function buildRevenueSummaryCard(args: {
    statusCounts: Record<PlatformAdminTenantStatus, number>;
    subscriptionTiers: readonly PlatformAdminSubscriptionTierRecord[];
    tenants: readonly PlatformAdminTenantRecord[];
}): PlatformAdminSummaryCard {
    return buildRevenueSummaryCardBase({
        ...args,
        labels: {
            awaitingSource: "Awaiting source",
            available: "Truthful ARR",
            empty: "Free only",
        },
    });
}

function buildAlertItems(args: {
    auditLogs: readonly PlatformAdminAuditLogRecord[];
    externalSyncEvents: readonly PlatformAdminExternalSyncRecord[];
    healthDiagnostics: readonly PlatformAdminAlertItem[];
    isolationEvents: readonly PlatformAdminIsolationEventRecord[];
    tenantsById: ReadonlyMap<string, PlatformAdminTenantRecord>;
}): PlatformAdminAlertsPanel {
    const alertItems: PlatformAdminAlertItem[] = [...args.healthDiagnostics];

    for (const isolationEvent of args.isolationEvents) {
        const tenantName = isolationEvent.targetTenantId
            ? args.tenantsById.get(isolationEvent.targetTenantId)?.name
            : null;

        alertItems.push({
            href: "/platform-admin/audit-logs",
            id: `isolation-${isolationEvent.id}`,
            occurredAt: isolationEvent.timestamp,
            occurredAtLabel: getPlatformAdminUtcTimestampLabel(
                isolationEvent.timestamp,
            ),
            severity:
                isolationEvent.event === "tenant.probe_blocked"
                    ? "critical"
                    : "warning",
            sourceLabel: "Tenant isolation",
            summary:
                isolationEvent.event === "tenant.probe_blocked"
                    ? `Cross-tenant probe on ${isolationEvent.tableName}${tenantName ? ` for ${tenantName}` : ""} was blocked.`
                    : `Platform bypass read on ${isolationEvent.tableName}${tenantName ? ` for ${tenantName}` : ""} was allowed and audited.`,
            title:
                isolationEvent.event === "tenant.probe_blocked"
                    ? "Tenant isolation probe blocked"
                    : "Platform bypass read recorded",
        });
    }

    for (const externalSyncEvent of args.externalSyncEvents) {
        if (
            externalSyncEvent.status !== "failed" &&
            externalSyncEvent.status !== "claimed"
        ) {
            continue;
        }
        const severity: PlatformAdminAlertSeverity =
            externalSyncEvent.status === "failed" ? "critical" : "warning";

        alertItems.push({
            href: "/platform-admin/errors",
            id: `sync-${externalSyncEvent.id}`,
            occurredAt: externalSyncEvent.updatedAt,
            occurredAtLabel: getPlatformAdminUtcTimestampLabel(
                externalSyncEvent.updatedAt,
            ),
            severity,
            sourceLabel: "External sync",
            summary:
                externalSyncEvent.lastError?.message ??
                `${humanizePlatformAdminToken(externalSyncEvent.eventType)} is still ${externalSyncEvent.status}.`,
            title: `${humanizePlatformAdminToken(externalSyncEvent.provider)} sync ${humanizePlatformAdminToken(externalSyncEvent.status)}`,
        });
    }

    for (const auditLog of args.auditLogs) {
        const lowerOutcome = auditLog.outcome.toLowerCase();
        const lowerEvent = auditLog.event.toLowerCase();
        const lowerAction = auditLog.action.toLowerCase();
        const isCritical =
            lowerOutcome.includes("failed") ||
            lowerOutcome.includes("blocked") ||
            lowerEvent.includes("error");
        const isWarning =
            lowerEvent.includes("suspend") ||
            lowerEvent.includes("cancel") ||
            lowerEvent.includes("revoke") ||
            lowerAction.includes("delete");

        if (!isCritical && !isWarning) {
            continue;
        }

        alertItems.push({
            href: "/platform-admin/audit-logs",
            id: `audit-${auditLog.id}`,
            occurredAt: auditLog.timestamp,
            occurredAtLabel: getPlatformAdminUtcTimestampLabel(
                auditLog.timestamp,
            ),
            severity: isCritical ? "critical" : "warning",
            sourceLabel: "Audit log",
            summary:
                readMetadataString(auditLog.metadata, "summary") ??
                readMetadataString(auditLog.metadata, "description") ??
                `${humanizePlatformAdminToken(auditLog.entityType)} ${humanizePlatformAdminToken(auditLog.event)}.`,
            title:
                readMetadataString(auditLog.metadata, "title") ??
                humanizePlatformAdminToken(auditLog.event),
        });
    }

    const uniqueItems = Array.from(
        new Map(
            alertItems.map((alertItem) => [alertItem.id, alertItem] as const),
        ).values(),
    )
        .sort((left, right) => right.occurredAt - left.occurredAt)
        .slice(0, 20);

    return {
        allItems: uniqueItems,
        state: uniqueItems.length > 0 ? "available" : "empty",
        totalCount: uniqueItems.length,
    };
}

function _buildSummaryCardsLegacy(args: {
    alerts: PlatformAdminAlertsPanel;
    healthSummary: PlatformAdminHealthSummary;
    statusCounts: Record<PlatformAdminTenantStatus, number>;
    subscriptionTiers: readonly PlatformAdminSubscriptionTierRecord[];
    tenants: readonly PlatformAdminTenantRecord[];
    tierCounts: Record<PlatformAdminTenantTier, number>;
}): PlatformAdminSummaryCard[] {
    const activeCount = args.statusCounts.active;
    const attentionCount = args.statusCounts.suspended + args.statusCounts.cancelled;
    const criticalAlertCount = args.alerts.allItems.filter(
        (item) => item.severity === "critical",
    ).length;
    const warningAlertCount = args.alerts.allItems.filter(
        (item) => item.severity === "warning",
    ).length;

    return [
        {
            helperText: `Free ${args.tierCounts.free} · Starter ${args.tierCounts.starter} · Professional ${args.tierCounts.professional} · Enterprise ${args.tierCounts.enterprise}`,
            id: "total_tenants",
            label: "Total Tenants",
            state: args.tenants.length > 0 ? "available" : "empty",
            statusLabel:
                args.tenants.length > 0 ? "Live roster" : "No tenants yet",
            tone: args.tenants.length > 0 ? "positive" : "neutral",
            value: String(args.tenants.length),
        },
        {
            helperText: `Active ${activeCount} · Suspended ${args.statusCounts.suspended} · Cancelled ${args.statusCounts.cancelled}`,
            id: "tenant_attention",
            label: "Tenant Status",
            state:
                attentionCount > 0
                    ? args.statusCounts.suspended > 0
                        ? "critical"
                        : "warning"
                    : activeCount > 0
                      ? "available"
                      : "empty",
            statusLabel:
                attentionCount > 0 ? "Needs attention" : "Operational",
            tone:
                attentionCount > 0
                    ? args.statusCounts.suspended > 0
                        ? "critical"
                        : "warning"
                    : "positive",
            value: `${activeCount} active`,
        },
        buildRevenueSummaryCard({
            statusCounts: args.statusCounts,
            subscriptionTiers: args.subscriptionTiers,
            tenants: args.tenants,
        }),
        {
            helperText:
                args.healthSummary.state === "critical"
                    ? `${criticalAlertCount} critical alerts, ${warningAlertCount} warnings, and health telemetry needs action.`
                    : `${criticalAlertCount} critical alerts and ${warningAlertCount} warnings from live monitoring sources.`,
            id: "urgent_issues",
            label: "Urgent Issues",
            state:
                criticalAlertCount > 0
                    ? "critical"
                    : warningAlertCount > 0
                      ? "warning"
                      : "empty",
            statusLabel:
                criticalAlertCount > 0
                    ? "Immediate action"
                    : warningAlertCount > 0
                      ? "Monitoring"
                      : "Clear",
            tone:
                criticalAlertCount > 0
                    ? "critical"
                    : warningAlertCount > 0
                      ? "warning"
                      : "neutral",
            value: String(criticalAlertCount + warningAlertCount),
        },
    ];
}

function buildRevenueSummaryCardClean(args: {
    statusCounts: Record<PlatformAdminTenantStatus, number>;
    subscriptionTiers: readonly PlatformAdminSubscriptionTierRecord[];
    tenants: readonly PlatformAdminTenantRecord[];
}): PlatformAdminSummaryCard {
    return buildRevenueSummaryCardBase({
        ...args,
        labels: {
            awaitingSource: "Catalog missing",
            available: "Catalog matched",
            empty: "No paid tenants",
        },
    });
}

function buildHealthSummaryClean(args: {
    healthSnapshot: PlatformAdminHealthSnapshotRecord | null;
    now: number;
}): {
    diagnostics: PlatformAdminAlertItem[];
    healthSummary: PlatformAdminHealthSummary;
} {
    if (!args.healthSnapshot) {
        return {
            diagnostics: [],
            healthSummary: {
                capturedAt: null,
                capturedAtLabel: null,
                state: "awaiting_source",
                summaryLabel: "No health snapshot available",
                tiles: HEALTH_TILE_META.map((tile) => ({
                    detail: tile.emptyDetail,
                    id: tile.id,
                    label: tile.label,
                    state: "awaiting_source",
                    statusLabel: "Unavailable",
                })),
            },
        };
    }

    const capturedAtLabel = getPlatformAdminUtcTimestampLabel(
        args.healthSnapshot.capturedAt,
    );
    const snapshotIsStale = isPlatformHealthSnapshotStale({
        capturedAt: args.healthSnapshot.capturedAt,
        now: args.now,
    });
    const rawHealthRecordById = new Map<
        PlatformAdminHealthTile["id"],
        PlatformAdminHealthServiceRecord | undefined
    >([
        ["api", args.healthSnapshot.api],
        ["database", args.healthSnapshot.database],
        ["jobs", args.healthSnapshot.jobs],
        ["storage", args.healthSnapshot.storage],
        ["email", args.healthSnapshot.email],
    ]);

    const tiles = HEALTH_TILE_META.map((tile) => {
        const healthRecord = rawHealthRecordById.get(tile.id);

        if (!healthRecord) {
            return {
                detail: `Latest snapshot omitted ${tile.label.toLowerCase()} telemetry.`,
                id: tile.id,
                label: tile.label,
                state: "partial" as const,
                statusLabel: "Partial data",
            };
        }

        if (snapshotIsStale && healthRecord.state === "healthy") {
            return {
                detail: `Last update ${capturedAtLabel}.`,
                id: tile.id,
                label: tile.label,
                state: "stale" as const,
                statusLabel: "Snapshot stale",
            };
        }

        if (healthRecord.state === "critical") {
            return {
                detail: healthRecord.detail ?? "Critical service degradation detected.",
                id: tile.id,
                label: tile.label,
                state: "critical" as const,
                statusLabel: "Critical",
            };
        }

        if (healthRecord.state === "warning") {
            return {
                detail: healthRecord.detail ?? "Monitoring required.",
                id: tile.id,
                label: tile.label,
                state: "warning" as const,
                statusLabel: "Warning",
            };
        }

        return {
            detail: healthRecord.detail ?? "No issues reported.",
            id: tile.id,
            label: tile.label,
            state: "healthy" as const,
            statusLabel: "Healthy",
        };
    });

    const diagnostics: PlatformAdminAlertItem[] = [];
    for (const tile of tiles) {
        if (tile.state !== "critical" && tile.state !== "warning" && tile.state !== "stale") {
            continue;
        }

        diagnostics.push({
            href: "/platform-admin/health",
            id: `health-${tile.id}`,
            occurredAt: args.healthSnapshot.capturedAt,
            occurredAtLabel: capturedAtLabel,
            severity:
                tile.state === "critical"
                    ? "critical"
                    : "warning",
            sourceLabel: "Health",
            summary:
                tile.state === "stale"
                    ? `${tile.label} is showing a stale snapshot.`
                    : tile.detail,
            title:
                tile.state === "stale"
                    ? "Health snapshot stale"
                    : `${tile.label} requires attention`,
        });
    }

    const hasCritical = tiles.some((tile) => tile.state === "critical");
    const hasWarning = tiles.some((tile) => tile.state === "warning");
    const hasStale = tiles.some((tile) => tile.state === "stale");
    const hasPartial = tiles.some((tile) => tile.state === "partial");

    return {
        diagnostics,
        healthSummary: {
            capturedAt: args.healthSnapshot.capturedAt,
            capturedAtLabel,
            state: hasCritical
                ? "critical"
                : hasWarning
                  ? "warning"
                  : hasStale
                      ? "stale"
                      : hasPartial
                        ? "partial"
                      : "available",
            summaryLabel: hasCritical
                ? "Critical issues detected"
                : hasWarning
                  ? "Warnings detected"
                  : hasStale
                      ? "Snapshot stale"
                      : hasPartial
                        ? "Partial telemetry"
                      : "No active health issues",
            tiles,
        },
    };
}

function buildSummaryCardsClean(args: {
    alerts: PlatformAdminAlertsPanel;
    healthSummary: PlatformAdminHealthSummary;
    statusCounts: Record<PlatformAdminTenantStatus, number>;
    subscriptionTiers: readonly PlatformAdminSubscriptionTierRecord[];
    tenants: readonly PlatformAdminTenantRecord[];
    tierCounts: Record<PlatformAdminTenantTier, number>;
}): PlatformAdminSummaryCard[] {
    const activeCount = args.statusCounts.active;
    const attentionCount = args.statusCounts.suspended + args.statusCounts.cancelled;
    const criticalAlertCount = args.alerts.allItems.filter(
        (item) => item.severity === "critical",
    ).length;
    const warningAlertCount = args.alerts.allItems.filter(
        (item) => item.severity === "warning",
    ).length;

    return [
        {
            helperText: `Free ${args.tierCounts.free} / Starter ${args.tierCounts.starter} / Professional ${args.tierCounts.professional} / Enterprise ${args.tierCounts.enterprise}`,
            id: "total_tenants",
            label: "Total Tenants",
            state: args.tenants.length > 0 ? "available" : "empty",
            statusLabel: args.tenants.length > 0 ? "Available" : "Empty",
            tone: args.tenants.length > 0 ? "positive" : "neutral",
            value: String(args.tenants.length),
        },
        {
            helperText: `Active ${activeCount} / Suspended ${args.statusCounts.suspended} / Cancelled ${args.statusCounts.cancelled}`,
            id: "tenant_attention",
            label: "Tenant Status",
            state:
                attentionCount > 0
                    ? args.statusCounts.suspended > 0
                        ? "critical"
                        : "warning"
                    : activeCount > 0
                      ? "available"
                      : "empty",
            statusLabel:
                attentionCount > 0
                    ? "Attention required"
                    : activeCount > 0
                      ? "Stable"
                      : "Empty",
            tone:
                attentionCount > 0
                    ? args.statusCounts.suspended > 0
                        ? "critical"
                        : "warning"
                    : "positive",
            value: `${activeCount} active`,
        },
        buildRevenueSummaryCardClean({
            statusCounts: args.statusCounts,
            subscriptionTiers: args.subscriptionTiers,
            tenants: args.tenants,
        }),
        {
            helperText:
                args.healthSummary.state === "critical"
                    ? `${criticalAlertCount} critical alerts, ${warningAlertCount} warnings, and health telemetry needs action.`
                    : `${criticalAlertCount} critical alerts and ${warningAlertCount} warnings from live monitoring sources.`,
            id: "urgent_issues",
            label: "Urgent Issues",
            state:
                criticalAlertCount > 0
                    ? "critical"
                    : warningAlertCount > 0
                      ? "warning"
                      : "empty",
            statusLabel:
                criticalAlertCount > 0
                    ? "Action required"
                    : warningAlertCount > 0
                      ? "Warnings present"
                      : "Clear",
            tone:
                criticalAlertCount > 0
                    ? "critical"
                    : warningAlertCount > 0
                      ? "warning"
                      : "neutral",
            value: String(criticalAlertCount + warningAlertCount),
        },
    ];
}

export function buildPlatformAdminDashboardSnapshot(
    args: BuildPlatformAdminDashboardSnapshotArgs,
): PlatformAdminDashboardSnapshot {
    const preferences = normalizePlatformAdminDashboardPreferences(
        args.preferences,
    );
    const tierCounts = createEmptyTierCounts();
    const statusCounts = createEmptyStatusCounts();

    for (const tenant of args.tenants) {
        tierCounts[tenant.tier] += 1;
        statusCounts[tenant.status] += 1;
    }

    const tenantsById = new Map(
        args.tenants.map((tenant) => [tenant.id, tenant] as const),
    );
    const { diagnostics: healthDiagnostics, healthSummary } = buildHealthSummaryClean({
        healthSnapshot: args.healthSnapshot,
        now: args.now,
    });
    const alerts = buildAlertItems({
        auditLogs: args.auditLogs,
        externalSyncEvents: args.externalSyncEvents,
        healthDiagnostics,
        isolationEvents: args.isolationEvents,
        tenantsById,
    });

    return {
        alerts,
        currentAdmin: args.currentAdmin,
        healthSummary,
        meta: {
            generatedAt: args.now,
            statusCounts,
            tierCounts,
        },
        navigation: PLATFORM_ADMIN_NAVIGATION,
        preferences,
        recentTenants: buildRecentTenants({
            departments: args.departments,
            tenantUsers: args.tenantUsers,
            tenants: args.tenants,
        }),
        summaryCards: buildSummaryCardsClean({
            alerts,
            healthSummary,
            statusCounts,
            subscriptionTiers: args.subscriptionTiers,
            tenants: args.tenants,
            tierCounts,
        }),
    };
}
