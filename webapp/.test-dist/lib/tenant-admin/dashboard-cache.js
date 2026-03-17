"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeTenantAdminDashboardCache = exports.writeTenantAdminDashboardCache = exports.readTenantAdminDashboardCache = exports.resolveDashboardSnapshotState = exports.createTenantAdminDashboardCacheKey = exports.TENANT_ADMIN_DASHBOARD_CACHE_PREFIX = void 0;
exports.TENANT_ADMIN_DASHBOARD_CACHE_PREFIX = "procureline.tenant-admin-dashboard";
function createTenantAdminDashboardCacheKey(args) {
    return `${exports.TENANT_ADMIN_DASHBOARD_CACHE_PREFIX}:${args.tenantId}:${args.fiscalYear}`;
}
exports.createTenantAdminDashboardCacheKey = createTenantAdminDashboardCacheKey;
function resolveDashboardSnapshotState(args) {
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
exports.resolveDashboardSnapshotState = resolveDashboardSnapshotState;
function readTenantAdminDashboardCache(args) {
    if (!args.storage) {
        return null;
    }
    const rawValue = args.storage.getItem(createTenantAdminDashboardCacheKey({
        fiscalYear: args.fiscalYear,
        tenantId: args.tenantId,
    }));
    if (!rawValue) {
        return null;
    }
    try {
        const parsed = JSON.parse(rawValue);
        if (parsed.tenantId === args.tenantId &&
            parsed.fiscalYear === args.fiscalYear) {
            return parsed;
        }
    }
    catch {
        return null;
    }
    return null;
}
exports.readTenantAdminDashboardCache = readTenantAdminDashboardCache;
function writeTenantAdminDashboardCache(args) {
    if (!args.storage) {
        return;
    }
    const envelope = {
        cachedAt: Date.now(),
        fiscalYear: args.fiscalYear,
        snapshot: args.snapshot,
        tenantId: args.tenantId,
    };
    args.storage.setItem(createTenantAdminDashboardCacheKey({
        fiscalYear: args.fiscalYear,
        tenantId: args.tenantId,
    }), JSON.stringify(envelope));
}
exports.writeTenantAdminDashboardCache = writeTenantAdminDashboardCache;
function removeTenantAdminDashboardCache(args) {
    if (!args.storage) {
        return;
    }
    args.storage.removeItem(createTenantAdminDashboardCacheKey({
        fiscalYear: args.fiscalYear,
        tenantId: args.tenantId,
    }));
}
exports.removeTenantAdminDashboardCache = removeTenantAdminDashboardCache;
