import {
    getPlatformAdminLocalTimestampLabel,
    getPlatformAdminUtcTimestampLabel,
    humanizePlatformAdminToken,
    isPlatformHealthSnapshotStale,
} from "./dashboard";

export type PlatformAdminTenantTier =
    | "enterprise"
    | "free"
    | "professional"
    | "starter"
    | "unknown";

export type PlatformAdminTenantStatus =
    | "active"
    | "cancelled"
    | "pending"
    | "suspended"
    | "unknown";

export type PlatformAdminProfileCompletionFilter =
    | "all"
    | "complete"
    | "incomplete";

export type PlatformAdminAttentionFilter =
    | "all"
    | "attention"
    | "clear";

export interface PlatformAdminTenantListInputTenant {
    createdAt: number;
    id: string;
    name?: string;
    onboardingCompletedAt?: number | null;
    primaryContactEmail?: string | null;
    primaryContactName?: string | null;
    profileComplete?: boolean | null;
    status?: string | null;
    subdomain?: string;
    tier?: string | null;
}

export interface PlatformAdminTenantListDepartment {
    isActive: boolean;
    tenantId: string;
}

export interface PlatformAdminTenantListUser {
    isActive: boolean;
    tenantId: string;
}

export interface PlatformAdminTenantListSubscriptionTier {
    isActive: boolean;
    slug: string;
}

export interface PlatformAdminTenantListHealthSnapshot {
    capturedAt: number;
    summaryState?: "critical" | "healthy" | "warning";
}

export interface PlatformAdminTenantListFilters {
    attention: PlatformAdminAttentionFilter;
    profile: PlatformAdminProfileCompletionFilter;
    search: string;
    status: PlatformAdminTenantStatus | "all";
    tier: PlatformAdminTenantTier | "all";
}

export interface PlatformAdminTenantListRow {
    activeUserCount: number;
    attentionIndicators: string[];
    departmentCount: number;
    detailHref: string;
    id: string;
    joinedAt: number;
    joinedAtLocalLabel: string;
    joinedAtUtcLabel: string;
    name: string;
    primaryContactEmail: string | null;
    primaryContactName: string | null;
    profileComplete: boolean | null;
    profileLabel: string;
    status: PlatformAdminTenantStatus;
    statusLabel: string;
    subdomain: string;
    tier: PlatformAdminTenantTier;
    tierLabel: string;
}

export interface PlatformAdminTenantListSnapshot {
    filters: {
        attention: Array<{ label: string; value: PlatformAdminAttentionFilter }>;
        profile: Array<{ label: string; value: PlatformAdminProfileCompletionFilter }>;
        status: Array<{ label: string; value: PlatformAdminTenantStatus | "all" }>;
        tier: Array<{ label: string; value: PlatformAdminTenantTier | "all" }>;
    };
    meta: {
        generatedAt: number;
        healthSnapshotState: "available" | "awaiting_source" | "stale";
        totalRows: number;
    };
    pagination: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        page: number;
        pageSize: number;
        totalFilteredRows: number;
        totalPages: number;
    };
    rows: PlatformAdminTenantListRow[];
    summary: {
        active: number;
        attention: number;
        incompleteProfiles: number;
        total: number;
    };
}

interface BuildPlatformAdminTenantListSnapshotArgs {
    departments: readonly PlatformAdminTenantListDepartment[];
    filters: PlatformAdminTenantListFilters;
    healthSnapshot: PlatformAdminTenantListHealthSnapshot | null;
    now: number;
    page: number;
    pageSize: number;
    subscriptionTiers: readonly PlatformAdminTenantListSubscriptionTier[];
    tenantUsers: readonly PlatformAdminTenantListUser[];
    tenants: readonly PlatformAdminTenantListInputTenant[];
}

const KNOWN_TIERS = new Set(["enterprise", "free", "professional", "starter"]);
const KNOWN_STATUSES = new Set(["active", "cancelled", "pending", "suspended"]);

export const PLATFORM_ADMIN_TENANT_LIST_PAGE_SIZE = 20;

export function normalizePlatformAdminTenantListFilters(
    input: Partial<PlatformAdminTenantListFilters> | null | undefined,
): PlatformAdminTenantListFilters {
    const tier = input?.tier ?? "all";
    const status = input?.status ?? "all";
    return {
        attention: input?.attention ?? "all",
        profile: input?.profile ?? "all",
        search: input?.search?.trim() ?? "",
        status: status === "all" || KNOWN_STATUSES.has(status) ? status : "unknown",
        tier: tier === "all" || KNOWN_TIERS.has(tier) ? tier : "unknown",
    };
}

export function buildPlatformAdminTenantListSnapshot(
    args: BuildPlatformAdminTenantListSnapshotArgs,
): PlatformAdminTenantListSnapshot {
    const activeDepartmentCountByTenantId = countActiveByTenant(args.departments);
    const activeUserCountByTenantId = countActiveByTenant(args.tenantUsers);
    const activeTierSlugs = new Set(
        args.subscriptionTiers
            .filter((tier) => tier.isActive)
            .map((tier) => tier.slug.toLowerCase()),
    );
    const healthSnapshotState = getHealthSnapshotState({
        healthSnapshot: args.healthSnapshot,
        now: args.now,
    });

    const allRows = args.tenants
        .map((tenant) =>
            buildTenantRow({
                activeTierSlugs,
                departmentCount: activeDepartmentCountByTenantId.get(tenant.id) ?? 0,
                healthSnapshotState,
                tenant,
                userCount: activeUserCountByTenantId.get(tenant.id) ?? 0,
            }),
        )
        .sort((left, right) => {
            if (right.joinedAt !== left.joinedAt) {
                return right.joinedAt - left.joinedAt;
            }
            const nameCompare = left.name.localeCompare(right.name);
            return nameCompare !== 0 ? nameCompare : left.id.localeCompare(right.id);
        });
    const filteredRows = allRows.filter((row) => rowMatchesFilters(row, args.filters));
    const pageSize = Math.max(1, args.pageSize);
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const page = Math.min(Math.max(1, args.page), totalPages);
    const pageStart = (page - 1) * pageSize;

    return {
        filters: createFilterOptions(),
        meta: {
            generatedAt: args.now,
            healthSnapshotState,
            totalRows: allRows.length,
        },
        pagination: {
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            page,
            pageSize,
            totalFilteredRows: filteredRows.length,
            totalPages,
        },
        rows: filteredRows.slice(pageStart, pageStart + pageSize),
        summary: {
            active: allRows.filter((row) => row.status === "active").length,
            attention: allRows.filter((row) => row.attentionIndicators.length > 0).length,
            incompleteProfiles: allRows.filter((row) => row.profileComplete === false).length,
            total: allRows.length,
        },
    };
}

function buildTenantRow(args: {
    activeTierSlugs: ReadonlySet<string>;
    departmentCount: number;
    healthSnapshotState: PlatformAdminTenantListSnapshot["meta"]["healthSnapshotState"];
    tenant: PlatformAdminTenantListInputTenant;
    userCount: number;
}): PlatformAdminTenantListRow {
    const tier = normalizeTenantTier(args.tenant.tier);
    const status = normalizeTenantStatus(args.tenant.status);
    const profileComplete =
        typeof args.tenant.profileComplete === "boolean"
            ? args.tenant.profileComplete
            : null;
    const attentionIndicators = getAttentionIndicators({
        healthSnapshotState: args.healthSnapshotState,
        profileComplete,
        status,
        tier,
        tierIsAvailable: tier !== "unknown" && args.activeTierSlugs.has(tier),
    });

    return {
        activeUserCount: args.userCount,
        attentionIndicators,
        departmentCount: args.departmentCount,
        detailHref: `/platform-admin/tenants/${args.tenant.id}`,
        id: args.tenant.id,
        joinedAt: args.tenant.createdAt,
        joinedAtLocalLabel: getPlatformAdminLocalTimestampLabel({
            timestamp: args.tenant.createdAt,
        }),
        joinedAtUtcLabel: getPlatformAdminUtcTimestampLabel(args.tenant.createdAt),
        name: cleanText(args.tenant.name) ?? "Unavailable tenant name",
        primaryContactEmail: cleanText(args.tenant.primaryContactEmail),
        primaryContactName: cleanText(args.tenant.primaryContactName),
        profileComplete,
        profileLabel:
            profileComplete === true
                ? "Complete"
                : profileComplete === false
                  ? "Incomplete"
                  : "Unavailable",
        status,
        statusLabel: status === "unknown" ? "Unknown" : humanizePlatformAdminToken(status),
        subdomain: cleanText(args.tenant.subdomain) ?? "Unavailable subdomain",
        tier,
        tierLabel: tier === "unknown" ? "Unknown" : humanizePlatformAdminToken(tier),
    };
}

function rowMatchesFilters(
    row: PlatformAdminTenantListRow,
    filters: PlatformAdminTenantListFilters,
): boolean {
    const search = filters.search.toLowerCase();
    const matchesSearch =
        search.length === 0 ||
        row.name.toLowerCase().includes(search) ||
        row.subdomain.toLowerCase().includes(search) ||
        (row.primaryContactEmail?.toLowerCase().includes(search) ?? false);
    const matchesTier = filters.tier === "all" || row.tier === filters.tier;
    const matchesStatus =
        filters.status === "all" || row.status === filters.status;
    const matchesProfile =
        filters.profile === "all" ||
        (filters.profile === "complete" && row.profileComplete === true) ||
        (filters.profile === "incomplete" && row.profileComplete !== true);
    const matchesAttention =
        filters.attention === "all" ||
        (filters.attention === "attention" && row.attentionIndicators.length > 0) ||
        (filters.attention === "clear" && row.attentionIndicators.length === 0);

    return matchesSearch && matchesTier && matchesStatus && matchesProfile && matchesAttention;
}

function getAttentionIndicators(args: {
    healthSnapshotState: PlatformAdminTenantListSnapshot["meta"]["healthSnapshotState"];
    profileComplete: boolean | null;
    status: PlatformAdminTenantStatus;
    tier: PlatformAdminTenantTier;
    tierIsAvailable: boolean;
}): string[] {
    const indicators: string[] = [];
    if (args.status === "suspended" || args.status === "cancelled") {
        indicators.push(`Status ${args.status}`);
    }
    if (args.status === "unknown") {
        indicators.push("Status unavailable");
    }
    if (args.profileComplete !== true) {
        indicators.push(args.profileComplete === false ? "Profile incomplete" : "Profile unavailable");
    }
    if (args.tier === "unknown" || !args.tierIsAvailable) {
        indicators.push("Tier usage unavailable");
    }
    if (args.healthSnapshotState !== "available") {
        indicators.push(
            args.healthSnapshotState === "stale"
                ? "Health snapshot stale"
                : "Health source awaiting data",
        );
    }
    return indicators;
}

function getHealthSnapshotState(args: {
    healthSnapshot: PlatformAdminTenantListHealthSnapshot | null;
    now: number;
}): PlatformAdminTenantListSnapshot["meta"]["healthSnapshotState"] {
    if (!args.healthSnapshot) {
        return "awaiting_source";
    }
    return isPlatformHealthSnapshotStale({
        capturedAt: args.healthSnapshot.capturedAt,
        now: args.now,
    })
        ? "stale"
        : "available";
}

function countActiveByTenant(
    records: readonly { isActive: boolean; tenantId: string }[],
): Map<string, number> {
    const countByTenantId = new Map<string, number>();
    for (const record of records) {
        if (!record.isActive) {
            continue;
        }
        countByTenantId.set(
            record.tenantId,
            (countByTenantId.get(record.tenantId) ?? 0) + 1,
        );
    }
    return countByTenantId;
}

function normalizeTenantTier(value: string | null | undefined): PlatformAdminTenantTier {
    if (!value) {
        return "unknown";
    }
    const normalized = value.toLowerCase();
    return KNOWN_TIERS.has(normalized)
        ? (normalized as PlatformAdminTenantTier)
        : "unknown";
}

function normalizeTenantStatus(value: string | null | undefined): PlatformAdminTenantStatus {
    if (!value) {
        return "unknown";
    }
    const normalized = value.toLowerCase();
    return KNOWN_STATUSES.has(normalized)
        ? (normalized as PlatformAdminTenantStatus)
        : "unknown";
}

function cleanText(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function createFilterOptions(): PlatformAdminTenantListSnapshot["filters"] {
    return {
        attention: [
            { label: "All attention states", value: "all" },
            { label: "Needs attention", value: "attention" },
            { label: "Clear", value: "clear" },
        ],
        profile: [
            { label: "All profiles", value: "all" },
            { label: "Complete", value: "complete" },
            { label: "Incomplete or unavailable", value: "incomplete" },
        ],
        status: [
            { label: "All statuses", value: "all" },
            { label: "Active", value: "active" },
            { label: "Pending", value: "pending" },
            { label: "Suspended", value: "suspended" },
            { label: "Cancelled", value: "cancelled" },
            { label: "Unknown", value: "unknown" },
        ],
        tier: [
            { label: "All tiers", value: "all" },
            { label: "Free", value: "free" },
            { label: "Starter", value: "starter" },
            { label: "Professional", value: "professional" },
            { label: "Enterprise", value: "enterprise" },
            { label: "Unknown", value: "unknown" },
        ],
    };
}
