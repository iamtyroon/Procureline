import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

export const claimSyncEvent = internalMutation({
  args: {
    actorRole: v.optional(v.string()),
    actorTenantId: v.optional(v.id("tenants")),
    actorUserId: v.optional(v.id("users")),
    eventKey: v.string(),
    eventType: v.string(),
    metadata: v.any(),
    payloadHash: v.string(),
    provider: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal("claimed"), v.literal("duplicate")),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("externalServiceSyncEvents")
      .withIndex("by_eventKey", (query) => query.eq("eventKey", args.eventKey))
      .first();

    if (existing) {
      return { status: "duplicate" as const };
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

    return { status: "claimed" as const };
  },
});

export const completeSyncEvent = internalMutation({
  args: {
    durableChanges: v.array(v.any()),
    eventKey: v.string(),
    result: v.any(),
  },
  returns: v.object({
    status: v.literal("completed"),
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
      if (
        change &&
        typeof change === "object" &&
        (change as { changeType?: unknown }).changeType ===
          "files.consolidated_plan_export.completed" &&
        typeof (change as { exportId?: unknown }).exportId === "string"
      ) {
        const result = args.result as {
          checksum?: unknown;
          downloadUrl?: unknown;
          fileSizeBytes?: unknown;
          storageId?: unknown;
        };
        const now = Date.now();
        await ctx.db.patch(
          (change as { exportId: string }).exportId as Id<"consolidationExports">,
          {
            checksum:
              typeof result.checksum === "string" ? result.checksum : undefined,
            completedAt: now,
            downloadUrl:
              typeof result.downloadUrl === "string"
                ? result.downloadUrl
                : undefined,
            fileExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
            fileSizeBytes:
              typeof result.fileSizeBytes === "number"
                ? result.fileSizeBytes
                : undefined,
            generatedAt: now,
            progress: 100,
            status: "completed",
            storageId:
              typeof result.storageId === "string" ? result.storageId : undefined,
            updatedAt: now,
          },
        );
      }
      if (
        change &&
        typeof change === "object" &&
        (change as { changeType?: unknown }).changeType ===
          "files.tenant_admin_report.completed"
      ) {
        const result = args.result as {
          checksum?: unknown;
          downloadUrl?: unknown;
          fileName?: unknown;
          fileSizeBytes?: unknown;
          storageId?: unknown;
        };
        const job =
          typeof (change as { reportJobId?: unknown }).reportJobId === "string"
            ? await ctx.db.get((change as { reportJobId: string }).reportJobId as Id<"tenantAdminReportJobs">)
            : typeof (change as { idempotencyKey?: unknown }).idempotencyKey === "string"
              ? await ctx.db
                  .query("tenantAdminReportJobs")
                  .withIndex("by_idempotencyKey", (q) =>
                    q.eq("idempotencyKey", (change as { idempotencyKey: string }).idempotencyKey),
                  )
                  .first()
              : null;
        if (job) {
          await ctx.db.patch(job._id, {
            checksum: typeof result.checksum === "string" ? result.checksum : undefined,
            downloadUrl:
              typeof result.downloadUrl === "string" ? result.downloadUrl : job.downloadUrl,
            fileName: typeof result.fileName === "string" ? result.fileName : job.fileName,
            fileSizeBytes:
              typeof result.fileSizeBytes === "number" ? result.fileSizeBytes : undefined,
            readyAt: Date.now(),
            status: "ready",
            storageId: typeof result.storageId === "string" ? result.storageId : undefined,
            updatedAt: Date.now(),
          });
        }
      }
    }

    return { status: "completed" as const };
  },
});

export const failSyncEvent = internalMutation({
  args: {
    durableChanges: v.optional(v.array(v.any())),
    error: v.object({
      code: v.string(),
      message: v.string(),
    }),
    eventKey: v.string(),
  },
  returns: v.object({
    status: v.literal("failed"),
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

    for (const change of args.durableChanges ?? existing.durableChanges) {
      if (
        change &&
        typeof change === "object" &&
        (change as { changeType?: unknown }).changeType ===
          "files.tenant_admin_report.failed"
      ) {
        const job =
          typeof (change as { reportJobId?: unknown }).reportJobId === "string"
            ? await ctx.db.get((change as { reportJobId: string }).reportJobId as Id<"tenantAdminReportJobs">)
            : typeof (change as { idempotencyKey?: unknown }).idempotencyKey === "string"
              ? await ctx.db
                  .query("tenantAdminReportJobs")
                  .withIndex("by_idempotencyKey", (q) =>
                    q.eq("idempotencyKey", (change as { idempotencyKey: string }).idempotencyKey),
                  )
                  .first()
              : null;
        if (job) {
          await ctx.db.patch(job._id, {
            errorMessage: args.error.message.slice(0, 240),
            failedAt: Date.now(),
            status: "failed",
            updatedAt: Date.now(),
          });
        }
      }
    }

    return { status: "failed" as const };
  },
});
