"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.failSyncEvent = exports.completeSyncEvent = exports.claimSyncEvent = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
exports.claimSyncEvent = (0, server_1.internalMutation)({
    args: {
        actorRole: values_1.v.optional(values_1.v.string()),
        actorTenantId: values_1.v.optional(values_1.v.id("tenants")),
        actorUserId: values_1.v.optional(values_1.v.id("users")),
        eventKey: values_1.v.string(),
        eventType: values_1.v.string(),
        metadata: values_1.v.any(),
        payloadHash: values_1.v.string(),
        provider: values_1.v.string(),
    },
    returns: values_1.v.object({
        status: values_1.v.union(values_1.v.literal("claimed"), values_1.v.literal("duplicate")),
    }),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("externalServiceSyncEvents")
            .withIndex("by_eventKey", (query) => query.eq("eventKey", args.eventKey))
            .first();
        if (existing) {
            return { status: "duplicate" };
        }
        await ctx.db.insert("externalServiceSyncEvents", {
            actorRole: args.actorRole,
            actorTenantId: args.actorTenantId,
            actorUserId: args.actorUserId,
            claimedAt: Date.now(),
            durableChanges: [],
            eventKey: args.eventKey,
            eventType: args.eventType,
            metadata: args.metadata,
            payloadHash: args.payloadHash,
            provider: args.provider,
            status: "claimed",
            updatedAt: Date.now(),
        });
        return { status: "claimed" };
    },
});
exports.completeSyncEvent = (0, server_1.internalMutation)({
    args: {
        durableChanges: values_1.v.array(values_1.v.any()),
        eventKey: values_1.v.string(),
        result: values_1.v.any(),
    },
    returns: values_1.v.object({
        status: values_1.v.literal("completed"),
    }),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("externalServiceSyncEvents")
            .withIndex("by_eventKey", (query) => query.eq("eventKey", args.eventKey))
            .first();
        if (!existing) {
            throw new Error(`No sync event found for ${args.eventKey}`);
        }
        await ctx.db.patch(existing._id, {
            durableChanges: args.durableChanges,
            processedAt: Date.now(),
            result: args.result,
            status: "completed",
            updatedAt: Date.now(),
        });
        for (const change of args.durableChanges) {
            if (change &&
                typeof change === "object" &&
                change.changeType ===
                    "files.consolidated_plan_export.completed" &&
                typeof change.exportId === "string") {
                const result = args.result;
                const now = Date.now();
                await ctx.db.patch(change.exportId, {
                    checksum: typeof result.checksum === "string" ? result.checksum : undefined,
                    completedAt: now,
                    downloadUrl: typeof result.downloadUrl === "string"
                        ? result.downloadUrl
                        : undefined,
                    fileExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
                    fileSizeBytes: typeof result.fileSizeBytes === "number"
                        ? result.fileSizeBytes
                        : undefined,
                    generatedAt: now,
                    progress: 100,
                    status: "completed",
                    storageId: typeof result.storageId === "string" ? result.storageId : undefined,
                    updatedAt: now,
                });
            }
        }
        return { status: "completed" };
    },
});
exports.failSyncEvent = (0, server_1.internalMutation)({
    args: {
        durableChanges: values_1.v.optional(values_1.v.array(values_1.v.any())),
        error: values_1.v.object({
            code: values_1.v.string(),
            message: values_1.v.string(),
        }),
        eventKey: values_1.v.string(),
    },
    returns: values_1.v.object({
        status: values_1.v.literal("failed"),
    }),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("externalServiceSyncEvents")
            .withIndex("by_eventKey", (query) => query.eq("eventKey", args.eventKey))
            .first();
        if (!existing) {
            throw new Error(`No sync event found for ${args.eventKey}`);
        }
        await ctx.db.patch(existing._id, {
            durableChanges: args.durableChanges ?? existing.durableChanges,
            lastError: args.error,
            status: "failed",
            updatedAt: Date.now(),
        });
        return { status: "failed" };
    },
});
