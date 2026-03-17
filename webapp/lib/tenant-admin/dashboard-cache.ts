import type { TenantAdminDashboardSnapshot } from "./dashboard-snapshot";

export const TENANT_ADMIN_DASHBOARD_CACHE_PREFIX =
    "procureline.tenant-admin-dashboard";

export interface StorageLike {
    getItem(key: string): string | null;
    removeItem(key: string): void;
    setItem(key: string, value: string): void;
}

export interface TenantAdminDashboardCacheEnvelope {
    cachedAt: number;
    fiscalYear: string;
    snapshot: TenantAdminDashboardSnapshot;
    tenantId: string;
}

export interface ResolvedDashboardSnapshotState {
    lastUpdatedAt: number | null;
    showStaleBanner: boolean;
    snapshot: TenantAdminDashboardSnapshot | undefined;
    state: "cached" | "live" | "loading";
}

export function createTenantAdminDashboardCacheKey(args: {
    fiscalYear: string;
    tenantId: string;
}): string {
    return `${TENANT_ADMIN_DASHBOARD_CACHE_PREFIX}:${args.tenantId}:${args.fiscalYear}`;
}

export function resolveDashboardSnapshotState(args: {
    cachedEnvelope?: TenantAdminDashboardCacheEnvelope | null;
    liveSnapshot?: TenantAdminDashboardSnapshot;
}): ResolvedDashboardSnapshotState {
    if (args.liveSnapshot) {
        return {
            lastUpdatedAt: args.liveSnapshot.meta.snapshotGeneratedAt,
            showStaleBanner: false,
            snapshot: {
                ...args.liveSnapshot,
                meta: {
                    ...args.liveSnapshot.meta,
                    lastUpdatedAt: args.liveSnapshot.meta.snapshotGeneratedAt,
                    sourceState: "live",
                },
            },
            state: "live",
        };
    }

    if (args.cachedEnvelope) {
        return {
            lastUpdatedAt: args.cachedEnvelope.cachedAt,
            showStaleBanner: true,
            snapshot: {
                ...args.cachedEnvelope.snapshot,
                meta: {
                    ...args.cachedEnvelope.snapshot.meta,
                    lastUpdatedAt: args.cachedEnvelope.cachedAt,
                    sourceState: "cached",
                },
            },
            state: "cached",
        };
    }

    return {
        lastUpdatedAt: null,
        showStaleBanner: false,
        snapshot: undefined,
        state: "loading",
    };
}

export function readTenantAdminDashboardCache(args: {
    fiscalYear: string;
    storage: StorageLike | null | undefined;
    tenantId: string;
}): TenantAdminDashboardCacheEnvelope | null {
    if (!args.storage) {
        return null;
    }

    const rawValue = args.storage.getItem(
        createTenantAdminDashboardCacheKey({
            fiscalYear: args.fiscalYear,
            tenantId: args.tenantId,
        }),
    );

    if (!rawValue) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawValue) as TenantAdminDashboardCacheEnvelope;

        if (
            parsed.tenantId === args.tenantId &&
            parsed.fiscalYear === args.fiscalYear
        ) {
            return parsed;
        }
    } catch {
        return null;
    }

    return null;
}

export function writeTenantAdminDashboardCache(args: {
    fiscalYear: string;
    snapshot: TenantAdminDashboardSnapshot;
    storage: StorageLike | null | undefined;
    tenantId: string;
}): void {
    if (!args.storage) {
        return;
    }

    const envelope: TenantAdminDashboardCacheEnvelope = {
        cachedAt: Date.now(),
        fiscalYear: args.fiscalYear,
        snapshot: args.snapshot,
        tenantId: args.tenantId,
    };

    args.storage.setItem(
        createTenantAdminDashboardCacheKey({
            fiscalYear: args.fiscalYear,
            tenantId: args.tenantId,
        }),
        JSON.stringify(envelope),
    );
}

export function removeTenantAdminDashboardCache(args: {
    fiscalYear: string;
    storage: StorageLike | null | undefined;
    tenantId: string;
}): void {
    if (!args.storage) {
        return;
    }

    args.storage.removeItem(
        createTenantAdminDashboardCacheKey({
            fiscalYear: args.fiscalYear,
            tenantId: args.tenantId,
        }),
    );
}
