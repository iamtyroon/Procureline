"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.failSyncEvent = exports.completeSyncEvent = exports.claimSyncEvent = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
function stringField(record, field) {
    const value = record?.[field];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function numberField(record, field) {
    const value = record?.[field];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
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
            if (change &&
                typeof change === "object" &&
                change.changeType ===
                    "files.tenant_admin_report.completed") {
                const result = args.result;
                const job = typeof change.reportJobId === "string"
                    ? await ctx.db.get(change.reportJobId)
                    : typeof change.idempotencyKey === "string"
                        ? await ctx.db
                            .query("tenantAdminReportJobs")
                            .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", change.idempotencyKey))
                            .first()
                        : null;
                if (job) {
                    await ctx.db.patch(job._id, {
                        checksum: typeof result.checksum === "string" ? result.checksum : undefined,
                        downloadUrl: typeof result.downloadUrl === "string" ? result.downloadUrl : job.downloadUrl,
                        fileName: typeof result.fileName === "string" ? result.fileName : job.fileName,
                        fileSizeBytes: typeof result.fileSizeBytes === "number" ? result.fileSizeBytes : undefined,
                        readyAt: Date.now(),
                        status: "ready",
                        storageId: typeof result.storageId === "string" ? result.storageId : undefined,
                        updatedAt: Date.now(),
                    });
                }
            }
            if (change &&
                typeof change === "object" &&
                change.changeType ===
                    "payment.subscription.provider_updated") {
                const changeRecord = change;
                const tenantId = stringField(changeRecord, "tenantId");
                const tenantReference = stringField(changeRecord, "tenantReference");
                const provider = stringField(changeRecord, "provider");
                const paymentReference = stringField(changeRecord, "paymentReference") ?? args.eventKey;
                const amountCents = numberField(changeRecord, "amountCents");
                const currency = stringField(changeRecord, "currency") ?? "KES";
                const nextBillingDate = numberField(changeRecord, "nextBillingDate");
                const rawStatus = stringField(changeRecord, "subscriptionStatus") ?? "active";
                const subscriptionStatus = rawStatus === "trialing" ||
                    rawStatus === "past_due" ||
                    rawStatus === "grace_period" ||
                    rawStatus === "suspended" ||
                    rawStatus === "cancelled"
                    ? rawStatus
                    : "active";
                const billingCycle = stringField(changeRecord, "billingCycle") === "monthly" ? "monthly" : "annual";
                const targetTenant = tenantId
                    ? await ctx.db.get(tenantId)
                    : tenantReference
                        ? await ctx.db
                            .query("tenants")
                            .withIndex("by_subdomain", (q) => q.eq("subdomain", tenantReference))
                            .first()
                        : null;
                if (targetTenant && (provider === "stripe" || provider === "intasend")) {
                    const now = Date.now();
                    const effectiveAmount = amountCents ?? targetTenant.subscriptionAmountCents ?? targetTenant.subscriptionCustomPriceCents ?? 0;
                    await ctx.db.insert("billingRecords", {
                        amountCents: effectiveAmount,
                        billingCycle,
                        createdAt: now,
                        currency,
                        metadata: {
                            eventKey: args.eventKey,
                            eventType: existing.eventType,
                        },
                        paymentReference,
                        periodEnd: nextBillingDate ?? targetTenant.subscriptionNextBillingDate ?? now,
                        periodStart: now,
                        provider,
                        status: subscriptionStatus === "past_due" ? "failed" : "verified",
                        tenantId: targetTenant._id,
                        updatedAt: now,
                        verifiedAt: status === "past_due" ? undefined : now,
                    });
                    await ctx.db.insert("billingReconciliationRecords", {
                        action: "provider_webhook_subscription_update",
                        attempts: 1,
                        createdAt: now,
                        maxAttempts: 3,
                        metadata: {
                            eventKey: args.eventKey,
                            eventType: existing.eventType,
                            paymentReference,
                        },
                        paymentReference,
                        provider,
                        status: "processed",
                        tenantId: targetTenant._id,
                        updatedAt: now,
                    });
                    await ctx.db.patch(targetTenant._id, {
                        lastPaymentFailureAt: subscriptionStatus === "past_due" ? now : targetTenant.lastPaymentFailureAt,
                        status: subscriptionStatus === "suspended" || subscriptionStatus === "cancelled" ? subscriptionStatus : "active",
                        subscriptionAmountCents: effectiveAmount,
                        subscriptionBillingCycle: billingCycle,
                        subscriptionCurrency: currency,
                        subscriptionGracePeriodEndsAt: subscriptionStatus === "past_due" ? now + 7 * 24 * 60 * 60 * 1000 : undefined,
                        subscriptionNextBillingDate: nextBillingDate ?? targetTenant.subscriptionNextBillingDate,
                        subscriptionPaymentMethod: provider,
                        subscriptionStatus: subscriptionStatus === "past_due" ? "grace_period" : subscriptionStatus,
                    });
                }
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
        for (const change of args.durableChanges ?? existing.durableChanges) {
            if (change &&
                typeof change === "object" &&
                change.changeType ===
                    "files.tenant_admin_report.failed") {
                const job = typeof change.reportJobId === "string"
                    ? await ctx.db.get(change.reportJobId)
                    : typeof change.idempotencyKey === "string"
                        ? await ctx.db
                            .query("tenantAdminReportJobs")
                            .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", change.idempotencyKey))
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
        return { status: "failed" };
    },
});
