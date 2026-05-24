import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "../_generated/server";
import {
    createPlatformAdminDashboardReadAccessToken,
    verifyPlatformAdminDashboardReadAccessToken,
} from "../../lib/backend/platform-admin/dashboard-access-token";
import {
    AUDIT_EVENT_NAMES,
    createAuthenticatedAuditActor,
} from "../../lib/shared/security/audit";
import { appendAuditLogRequired } from "./_audit";
import { requirePlatformAdmin } from "./_roleGuard";
import { auditPlatformAdminBypassRead } from "./_tenantGuard";

const PAGE_SIZE = 25;
const MAX_LIST_SCAN = 500;
const MAX_EXPORT_ROWS = 1000;
const MAX_RECONCILIATION_ATTEMPTS_PER_RUN = 50;
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

const tierFilterValidator = v.union(
    v.literal("all"),
    v.literal("enterprise"),
    v.literal("free"),
    v.literal("professional"),
    v.literal("starter"),
);

const statusFilterValidator = v.union(
    v.literal("all"),
    v.literal("active"),
    v.literal("trialing"),
    v.literal("past_due"),
    v.literal("grace_period"),
    v.literal("suspended"),
    v.literal("cancelled"),
);

const paymentMethodFilterValidator = v.union(
    v.literal("all"),
    v.literal("stripe"),
    v.literal("intasend"),
    v.literal("bank_transfer"),
    v.literal("custom"),
);

const providerValidator = v.union(
    v.literal("stripe"),
    v.literal("intasend"),
    v.literal("bank_transfer"),
    v.literal("custom"),
);

const billingCycleValidator = v.union(v.literal("monthly"), v.literal("annual"));

function validationError(field: string, message: string): never {
    throw new ConvexError({ code: "VALIDATION_FAILED", field, message });
}

function normalizeSubscriptionStatus(tenant: Doc<"tenants">) {
    return tenant.subscriptionStatus ?? (tenant.status === "suspended" ? "suspended" : tenant.status === "cancelled" ? "cancelled" : "active");
}

function getEffectiveAmountCents(tenant: Doc<"tenants">): number {
    return tenant.subscriptionCustomPriceCents ?? tenant.subscriptionAmountCents ?? 0;
}

function getMonthlyEquivalentCents(tenant: Doc<"tenants">): number {
    const amount = getEffectiveAmountCents(tenant);
    return (tenant.subscriptionBillingCycle ?? "annual") === "annual" ? Math.round(amount / 12) : amount;
}

function requireReason(reason: string): string {
    const normalized = reason.trim();
    if (normalized.length < 3) {
        validationError("reason", "Reason must be at least 3 characters.");
    }
    if (normalized.length > 240) {
        validationError("reason", "Reason must be 240 characters or less.");
    }
    return normalized;
}

function requirePositiveAmount(amountCents: number, field = "amountCents"): void {
    if (!Number.isFinite(amountCents) || amountCents < 1) {
        validationError(field, "Amount must be greater than zero.");
    }
}

function requirePaymentReference(paymentReference: string): string {
    const normalized = paymentReference.trim();
    if (normalized.length < 3) {
        validationError("paymentReference", "Payment reference must be at least 3 characters.");
    }
    if (normalized.length > 120) {
        validationError("paymentReference", "Payment reference must be 120 characters or less.");
    }
    return normalized;
}

function requireCurrency(currency: string): string {
    const normalized = currency.trim().toUpperCase() || "KES";
    if (!/^[A-Z]{3}$/.test(normalized)) {
        validationError("currency", "Currency must be a 3-letter code.");
    }
    return normalized;
}

async function auditBillingAction(args: {
    action: string;
    ctx: MutationCtx;
    event: (typeof AUDIT_EVENT_NAMES)[keyof typeof AUDIT_EVENT_NAMES];
    metadata?: Record<string, unknown>;
    outcome?: "allowed" | "failed" | "queued";
    platformUserId: Id<"users">;
    recordId?: string;
    targetTenantId?: Id<"tenants">;
}): Promise<void> {
    await appendAuditLogRequired(args.ctx, {
        action: args.action,
        actor: createAuthenticatedAuditActor({
            role: "platform_admin",
            userId: String(args.platformUserId),
        }),
        entityType: "subscription",
        event: args.event,
        metadata: args.metadata ?? {},
        outcome: args.outcome ?? "allowed",
        recordId: args.recordId,
        tableName: "tenants",
        targetTenantId: args.targetTenantId ? String(args.targetTenantId) : undefined,
        timestamp: Date.now(),
    });
}

function buildRow(tenant: Doc<"tenants">) {
    const amountCents = getEffectiveAmountCents(tenant);
    return {
        id: tenant._id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        tier: tenant.tier,
        tenantStatus: tenant.status,
        subscriptionStatus: normalizeSubscriptionStatus(tenant),
        nextBillingDate: tenant.subscriptionNextBillingDate ?? null,
        gracePeriodEndsAt: tenant.subscriptionGracePeriodEndsAt ?? null,
        amountCents,
        currency: tenant.subscriptionCurrency ?? "KES",
        billingCycle: tenant.subscriptionBillingCycle ?? "annual",
        paymentMethod: tenant.subscriptionPaymentMethod ?? "custom",
        customPriceCents: tenant.subscriptionCustomPriceCents ?? null,
        primaryContactEmail: tenant.primaryContactEmail ?? null,
    };
}

export const issuePlatformAdminSubscriptionReadAccess = mutation({
    args: {},
    handler: async (ctx) => {
        const authContext = await requirePlatformAdmin(ctx);
        await Promise.all([
            auditPlatformAdminBypassRead(ctx, {
                action: "subscription_list_read",
                entityType: "tenant",
                tableName: "tenants",
            }),
            auditPlatformAdminBypassRead(ctx, {
                action: "subscription_billing_records_read",
                entityType: "billingRecord",
                tableName: "billingRecords",
            }),
        ]);

        await auditBillingAction({
            action: "read_subscription_list",
            ctx,
            event: AUDIT_EVENT_NAMES.subscriptionReadAllowed,
            outcome: "allowed",
            platformUserId: authContext.userId,
        });

        return await createPlatformAdminDashboardReadAccessToken({
            scope: "subscription_list",
            userId: String(authContext.userId),
        });
    },
});

export const getPlatformAdminSubscriptionSnapshot = query({
    args: {
        accessToken: v.string(),
        dateFrom: v.optional(v.number()),
        dateTo: v.optional(v.number()),
        page: v.optional(v.number()),
        paymentMethod: v.optional(paymentMethodFilterValidator),
        search: v.optional(v.string()),
        status: v.optional(statusFilterValidator),
        tier: v.optional(tierFilterValidator),
    },
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const access = await verifyPlatformAdminDashboardReadAccessToken({
            scope: "subscription_list",
            token: args.accessToken,
            userId: String(authContext.userId),
        });
        if (!access.ok) {
            throw new ConvexError({ code: "UNAUTHORIZED", message: "Audited subscription access could not be verified." });
        }

        const tenants = await (async () => {
            const tierFilter = args.tier;
            if (tierFilter && tierFilter !== "all") {
                return await ctx.db.query("tenants").withIndex("by_tier", (q) => q.eq("tier", tierFilter)).take(MAX_LIST_SCAN);
            }
            const statusFilter = args.status;
            if (statusFilter && statusFilter !== "all") {
                return await ctx.db.query("tenants").withIndex("by_subscriptionStatus", (q) => q.eq("subscriptionStatus", statusFilter)).take(MAX_LIST_SCAN);
            }
            const paymentMethodFilter = args.paymentMethod;
            if (paymentMethodFilter && paymentMethodFilter !== "all") {
                return await ctx.db.query("tenants").withIndex("by_subscriptionPaymentMethod", (q) => q.eq("subscriptionPaymentMethod", paymentMethodFilter)).take(MAX_LIST_SCAN);
            }
            return await ctx.db.query("tenants").withIndex("by_subdomain").take(MAX_LIST_SCAN);
        })();
        const search = (args.search ?? "").trim().toLowerCase();
        const filtered = tenants
            .filter((tenant) => args.tier === undefined || args.tier === "all" || tenant.tier === args.tier)
            .filter((tenant) => args.status === undefined || args.status === "all" || normalizeSubscriptionStatus(tenant) === args.status)
            .filter((tenant) => args.paymentMethod === undefined || args.paymentMethod === "all" || (tenant.subscriptionPaymentMethod ?? "custom") === args.paymentMethod)
            .filter((tenant) => {
                if (!args.dateFrom && !args.dateTo) {
                    return true;
                }
                const nextBillingDate = tenant.subscriptionNextBillingDate;
                if (!nextBillingDate) {
                    return false;
                }
                return (!args.dateFrom || nextBillingDate >= args.dateFrom) && (!args.dateTo || nextBillingDate <= args.dateTo);
            })
            .filter((tenant) => {
                if (!search) {
                    return true;
                }
                return [tenant.name, tenant.subdomain, tenant.primaryContactEmail ?? ""].some((value) => value.toLowerCase().includes(search));
            })
            .sort((left, right) => left.name.localeCompare(right.name));

        const page = Math.max(1, Math.floor(args.page ?? 1));
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(buildRow);
        const exportRows = filtered.slice(0, MAX_EXPORT_ROWS).map(buildRow);
        const monthlyRevenueCents = tenants.reduce((sum, tenant) => {
            const status = normalizeSubscriptionStatus(tenant);
            if (status === "cancelled" || status === "suspended") {
                return sum;
            }
            return sum + getMonthlyEquivalentCents(tenant);
        }, 0);
        const byTier = tenants.reduce<Record<string, number>>((totals, tenant) => {
            const status = normalizeSubscriptionStatus(tenant);
            if (status !== "cancelled" && status !== "suspended") {
                totals[tenant.tier] = (totals[tenant.tier] ?? 0) + getMonthlyEquivalentCents(tenant);
            }
            return totals;
        }, {});

        return {
            rows,
            exportRows,
            exportTruncated: filtered.length > MAX_EXPORT_ROWS,
            revenue: {
                mrrCents: monthlyRevenueCents,
                arrCents: monthlyRevenueCents * 12,
                byTier,
            },
            summary: {
                total: tenants.length,
                filtered: filtered.length,
                active: tenants.filter((tenant) => normalizeSubscriptionStatus(tenant) === "active").length,
                gracePeriod: tenants.filter((tenant) => normalizeSubscriptionStatus(tenant) === "grace_period").length,
                pastDue: tenants.filter((tenant) => normalizeSubscriptionStatus(tenant) === "past_due").length,
            },
            pagination: {
                page,
                pageSize: PAGE_SIZE,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    },
});

export const getSubscriptionDetail = mutation({
    args: {
        accessToken: v.string(),
        tenantId: v.id("tenants"),
    },
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const access = await verifyPlatformAdminDashboardReadAccessToken({
            scope: "subscription_list",
            token: args.accessToken,
            userId: String(authContext.userId),
        });
        if (!access.ok) {
            throw new ConvexError({ code: "UNAUTHORIZED", message: "Audited subscription detail access could not be verified." });
        }
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant) {
            return null;
        }
        await auditPlatformAdminBypassRead(ctx, {
            action: "subscription_detail_read",
            entityType: "subscription",
            tableName: "billingRecords",
            targetTenantId: String(args.tenantId),
        });
        const [records, reconciliations, refunds] = await Promise.all([
            ctx.db.query("billingRecords").withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(8),
            ctx.db.query("billingReconciliationRecords").withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(8),
            ctx.db.query("billingRefundApprovals").withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(8),
        ]);
        return {
            ...buildRow(tenant),
            records,
            reconciliations,
            refunds,
        };
    },
});

export const verifyBankTransfer = mutation({
    args: {
        amountCents: v.number(),
        billingCycle: billingCycleValidator,
        currency: v.string(),
        nextBillingDate: v.number(),
        paymentReference: v.string(),
        reason: v.string(),
        tenantId: v.id("tenants"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const reason = requireReason(args.reason);
        const paymentReference = requirePaymentReference(args.paymentReference);
        const currency = requireCurrency(args.currency);
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant) {
            validationError("tenantId", "Tenant not found.");
        }
        requirePositiveAmount(args.amountCents);
        const now = Date.now();
        const recordId = await ctx.db.insert("billingRecords", {
            tenantId: args.tenantId,
            amountCents: args.amountCents,
            currency,
            provider: "bank_transfer",
            paymentReference,
            status: "verified",
            billingCycle: args.billingCycle,
            periodStart: now,
            periodEnd: args.nextBillingDate,
            verifiedAt: now,
            createdAt: now,
            updatedAt: now,
            metadata: { reason },
        });
        await ctx.db.patch(args.tenantId, {
            status: "active",
            subscriptionStatus: "active",
            subscriptionAmountCents: args.amountCents,
            subscriptionCurrency: currency,
            subscriptionBillingCycle: args.billingCycle,
            subscriptionPaymentMethod: "bank_transfer",
            subscriptionNextBillingDate: args.nextBillingDate,
            subscriptionGracePeriodEndsAt: undefined,
            restoredAt: now,
            restoredByPlatformUserId: authContext.userId,
            restoreReason: "Verified bank transfer restored subscription access.",
        });
        await ctx.db.insert("billingReconciliationRecords", {
            tenantId: args.tenantId,
            provider: "bank_transfer",
            paymentReference,
            action: "manual_bank_transfer_verified",
            status: "processed",
            attempts: 1,
            maxAttempts: 1,
            metadata: { billingRecordId: String(recordId), reason },
            createdAt: now,
            updatedAt: now,
        });
        await auditBillingAction({
            action: "verify_bank_transfer",
            ctx,
            event: AUDIT_EVENT_NAMES.subscriptionBankTransferVerified,
            metadata: { amountCents: args.amountCents, paymentReference, reason },
            platformUserId: authContext.userId,
            recordId: String(recordId),
            targetTenantId: args.tenantId,
        });
        return null;
    },
});

export const recordProviderPayment = mutation({
    args: {
        amountCents: v.number(),
        billingCycle: billingCycleValidator,
        currency: v.string(),
        nextBillingDate: v.number(),
        paymentReference: v.string(),
        provider: v.union(v.literal("stripe"), v.literal("intasend")),
        tenantId: v.id("tenants"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const paymentReference = requirePaymentReference(args.paymentReference);
        const currency = requireCurrency(args.currency);
        requirePositiveAmount(args.amountCents);
        if (!(await ctx.db.get(args.tenantId))) {
            validationError("tenantId", "Tenant not found.");
        }
        const now = Date.now();
        const recordId = await ctx.db.insert("billingRecords", {
            tenantId: args.tenantId,
            amountCents: args.amountCents,
            currency,
            provider: args.provider,
            paymentReference,
            status: "verified",
            billingCycle: args.billingCycle,
            periodStart: now,
            periodEnd: args.nextBillingDate,
            verifiedAt: now,
            createdAt: now,
            updatedAt: now,
        });
        await ctx.db.patch(args.tenantId, {
            status: "active",
            subscriptionStatus: "active",
            subscriptionAmountCents: args.amountCents,
            subscriptionCurrency: currency,
            subscriptionBillingCycle: args.billingCycle,
            subscriptionPaymentMethod: args.provider,
            subscriptionNextBillingDate: args.nextBillingDate,
            subscriptionGracePeriodEndsAt: undefined,
        });
        await auditBillingAction({
            action: "record_provider_payment",
            ctx,
            event: AUDIT_EVENT_NAMES.subscriptionPaymentVerified,
            metadata: { provider: args.provider, paymentReference },
            platformUserId: authContext.userId,
            recordId: String(recordId),
            targetTenantId: args.tenantId,
        });
        return null;
    },
});

export const recordFailedPayment = mutation({
    args: {
        amountCents: v.optional(v.number()),
        paymentReference: v.string(),
        provider: providerValidator,
        reason: v.string(),
        tenantId: v.id("tenants"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const reason = requireReason(args.reason);
        const paymentReference = requirePaymentReference(args.paymentReference);
        if (args.amountCents !== undefined) {
            requirePositiveAmount(args.amountCents);
        }
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant) {
            validationError("tenantId", "Tenant not found.");
        }
        const now = Date.now();
        const gracePeriodEndsAt = now + GRACE_PERIOD_MS;
        await ctx.db.insert("billingRecords", {
            tenantId: args.tenantId,
            amountCents: args.amountCents ?? getEffectiveAmountCents(tenant),
            currency: tenant.subscriptionCurrency ?? "KES",
            provider: args.provider,
            paymentReference,
            status: "failed",
            billingCycle: tenant.subscriptionBillingCycle ?? "annual",
            periodStart: now,
            periodEnd: tenant.subscriptionNextBillingDate ?? gracePeriodEndsAt,
            failedAt: now,
            gracePeriodEndsAt,
            createdAt: now,
            updatedAt: now,
            metadata: { reason },
        });
        await ctx.db.patch(args.tenantId, {
            subscriptionStatus: "grace_period",
            subscriptionGracePeriodEndsAt: gracePeriodEndsAt,
            lastPaymentFailureAt: now,
        });
        await ctx.db.insert("devEmailMessages", {
            createdAt: now,
            from: "Procureline Billing <billing@procureline.local>",
            html: `<p>Payment failed for ${tenant.name}. Subscription access is in a 7-day grace period.</p>`,
            idempotencyKey: `billing-failure:${String(args.tenantId)}:${paymentReference}`,
            messageType: "billing_payment_failed",
            metadata: { gracePeriodEndsAt, paymentReference, tenantId: String(args.tenantId) },
            primaryRecipient: tenant.primaryContactEmail ?? "tenant-admin@procureline.local",
            subject: "Procureline payment failed",
            text: `Payment failed for ${tenant.name}. Subscription access is in a 7-day grace period.`,
            to: [tenant.primaryContactEmail ?? "tenant-admin@procureline.local"],
            transport: "dev_inbox",
        });
        await auditBillingAction({
            action: "record_failed_payment",
            ctx,
            event: AUDIT_EVENT_NAMES.subscriptionFailedPaymentRecorded,
            metadata: { gracePeriodEndsAt, paymentReference, provider: args.provider, reason },
            platformUserId: authContext.userId,
            targetTenantId: args.tenantId,
        });
        return null;
    },
});

export const updateCustomPricing = mutation({
    args: {
        amountCents: v.number(),
        reason: v.string(),
        tenantId: v.id("tenants"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const reason = requireReason(args.reason);
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant) {
            validationError("tenantId", "Tenant not found.");
        }
        if (tenant.tier !== "enterprise") {
            validationError("tenantId", "Custom pricing is only available for enterprise tenants.");
        }
        requirePositiveAmount(args.amountCents, "amountCents");
        const now = Date.now();
        await ctx.db.patch(args.tenantId, {
            subscriptionCustomPriceCents: args.amountCents,
            subscriptionCustomPriceReason: reason,
            subscriptionCustomPriceUpdatedAt: now,
        });
        await auditBillingAction({
            action: "update_custom_pricing",
            ctx,
            event: AUDIT_EVENT_NAMES.subscriptionCustomPriceUpdated,
            metadata: { amountCents: args.amountCents, reason },
            platformUserId: authContext.userId,
            targetTenantId: args.tenantId,
        });
        return null;
    },
});

export const requestRefundApproval = mutation({
    args: {
        amountCents: v.number(),
        billingRecordId: v.optional(v.id("billingRecords")),
        reason: v.string(),
        serviceEndAt: v.number(),
        serviceStartAt: v.number(),
        tenantId: v.id("tenants"),
    },
    returns: v.id("billingRefundApprovals"),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const reason = requireReason(args.reason);
        requirePositiveAmount(args.amountCents);
        if (!(await ctx.db.get(args.tenantId))) {
            validationError("tenantId", "Tenant not found.");
        }
        if (args.serviceEndAt <= args.serviceStartAt) {
            validationError("serviceEndAt", "Service end must be after service start.");
        }
        const now = Date.now();
        const elapsedRatio = Math.min(1, Math.max(0, (now - args.serviceStartAt) / (args.serviceEndAt - args.serviceStartAt)));
        const proratedAmountCents = Math.max(0, Math.round(args.amountCents * (1 - elapsedRatio)));
        const refundId = await ctx.db.insert("billingRefundApprovals", {
            tenantId: args.tenantId,
            billingRecordId: args.billingRecordId,
            amountCents: args.amountCents,
            proratedAmountCents,
            currency: "KES",
            reason,
            status: "pending_approval",
            requestedByPlatformUserId: authContext.userId,
            requestedAt: now,
            updatedAt: now,
            metadata: { serviceEndAt: args.serviceEndAt, serviceStartAt: args.serviceStartAt },
        });
        await ctx.db.insert("billingReconciliationRecords", {
            tenantId: args.tenantId,
            provider: "custom",
            action: "refund_approval_requested",
            status: "requires_approval",
            attempts: 0,
            maxAttempts: 1,
            metadata: { refundId: String(refundId), proratedAmountCents, reason },
            createdAt: now,
            updatedAt: now,
        });
        await auditBillingAction({
            action: "request_refund_approval",
            ctx,
            event: AUDIT_EVENT_NAMES.subscriptionRefundRequested,
            metadata: { proratedAmountCents, reason },
            outcome: "queued",
            platformUserId: authContext.userId,
            recordId: String(refundId),
            targetTenantId: args.tenantId,
        });
        return refundId;
    },
});

export const batchUpdateSubscriptionStatus = mutation({
    args: {
        reason: v.string(),
        status: statusFilterValidator,
        tenantIds: v.array(v.id("tenants")),
    },
    returns: v.object({ updated: v.number() }),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        if (args.status === "all") {
            validationError("status", "Choose a concrete subscription status.");
        }
        const reason = requireReason(args.reason);
        const now = Date.now();
        let updated = 0;
        for (const tenantId of args.tenantIds.slice(0, 50)) {
            const tenant = await ctx.db.get(tenantId);
            if (!tenant) {
                continue;
            }
            await ctx.db.patch(tenantId, {
                status: args.status === "suspended" ? "suspended" : args.status === "cancelled" ? "cancelled" : tenant.status === "pending" ? "pending" : "active",
                subscriptionStatus: args.status,
                subscriptionGracePeriodEndsAt: args.status === "grace_period" ? now + GRACE_PERIOD_MS : undefined,
            });
            updated += 1;
        }
        await auditBillingAction({
            action: "batch_update_subscription_status",
            ctx,
            event: AUDIT_EVENT_NAMES.subscriptionBatchStatusUpdated,
            metadata: { reason, status: args.status, tenantCount: updated },
            platformUserId: authContext.userId,
        });
        return { updated };
    },
});

export const queueReconciliation = mutation({
    args: {
        provider: v.union(v.literal("stripe"), v.literal("intasend")),
    },
    returns: v.id("billingReconciliationRecords"),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const now = Date.now();
        const id = await ctx.db.insert("billingReconciliationRecords", {
            provider: args.provider,
            action: args.provider === "intasend" ? "daily_mpesa_reconciliation" : "stripe_webhook_retry_reconciliation",
            status: "queued",
            attempts: 0,
            maxAttempts: 3,
            nextAttemptAt: now,
            createdAt: now,
            updatedAt: now,
        });
        await auditBillingAction({
            action: "queue_reconciliation",
            ctx,
            event: AUDIT_EVENT_NAMES.subscriptionReconciliationQueued,
            metadata: { provider: args.provider, maxAttempts: 3 },
            outcome: "queued",
            platformUserId: authContext.userId,
            recordId: String(id),
        });
        return id;
    },
});

export const queueInvoiceGeneration = mutation({
    args: {
        tenantId: v.id("tenants"),
    },
    returns: v.id("billingReconciliationRecords"),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        if (!(await ctx.db.get(args.tenantId))) {
            validationError("tenantId", "Tenant not found.");
        }
        const now = Date.now();
        const id = await ctx.db.insert("billingReconciliationRecords", {
            tenantId: args.tenantId,
            provider: "custom",
            action: "invoice_generation",
            status: "queued",
            attempts: 0,
            maxAttempts: 3,
            nextAttemptAt: now,
            createdAt: now,
            updatedAt: now,
        });
        await auditBillingAction({
            action: "queue_invoice_generation",
            ctx,
            event: AUDIT_EVENT_NAMES.subscriptionInvoiceQueued,
            outcome: "queued",
            platformUserId: authContext.userId,
            recordId: String(id),
            targetTenantId: args.tenantId,
        });
        return id;
    },
});

export const expireGracePeriods = mutation({
    args: {},
    returns: v.object({ suspended: v.number() }),
    handler: async (ctx) => {
        const authContext = await requirePlatformAdmin(ctx);
        const now = Date.now();
        const tenants = await ctx.db.query("tenants").withIndex("by_subscriptionStatus", (q) => q.eq("subscriptionStatus", "grace_period")).collect();
        let suspended = 0;
        for (const tenant of tenants) {
            if (tenant.subscriptionGracePeriodEndsAt && tenant.subscriptionGracePeriodEndsAt <= now) {
                await ctx.db.patch(tenant._id, {
                    status: "suspended",
                    subscriptionStatus: "suspended",
                    suspendedAt: now,
                    suspendedByPlatformUserId: authContext.userId,
                    suspensionReason: "Subscription grace period expired.",
                });
                suspended += 1;
            }
        }
        if (suspended > 0) {
            await auditBillingAction({
                action: "expire_grace_periods",
                ctx,
                event: AUDIT_EVENT_NAMES.subscriptionGraceExpired,
                metadata: { suspended },
                platformUserId: authContext.userId,
            });
        }
        return { suspended };
    },
});

export const runScheduledBillingMaintenance = internalMutation({
    args: {},
    returns: v.object({
        reconciliationQueued: v.boolean(),
        suspended: v.number(),
    }),
    handler: async (ctx) => {
        const now = Date.now();
        const tenants = await ctx.db.query("tenants").withIndex("by_subscriptionStatus", (q) => q.eq("subscriptionStatus", "grace_period")).collect();
        let suspended = 0;
        for (const tenant of tenants) {
            if (tenant.subscriptionGracePeriodEndsAt && tenant.subscriptionGracePeriodEndsAt <= now) {
                await ctx.db.patch(tenant._id, {
                    status: "suspended",
                    subscriptionStatus: "suspended",
                    suspendedAt: now,
                    suspensionReason: "Subscription grace period expired by scheduled billing maintenance.",
                });
                suspended += 1;
            }
        }
        await ctx.db.insert("billingReconciliationRecords", {
            provider: "intasend",
            action: "daily_mpesa_reconciliation",
            status: "queued",
            attempts: 0,
            maxAttempts: 3,
            nextAttemptAt: now,
            createdAt: now,
            updatedAt: now,
        });
        return {
            reconciliationQueued: true,
            suspended,
        };
    },
});

export const processDueBillingReconciliations = internalMutation({
    args: {},
    returns: v.object({
        failed: v.number(),
        processed: v.number(),
        retried: v.number(),
    }),
    handler: async (ctx) => {
        const now = Date.now();
        const dueRecords = await ctx.db
            .query("billingReconciliationRecords")
            .withIndex("by_status_nextAttemptAt", (q) => q.eq("status", "queued"))
            .take(MAX_RECONCILIATION_ATTEMPTS_PER_RUN);
        let failed = 0;
        let processed = 0;
        let retried = 0;

        for (const record of dueRecords) {
            if (record.nextAttemptAt && record.nextAttemptAt > now) {
                continue;
            }
            const attempts = record.attempts + 1;
            const shouldProcess =
                record.action === "daily_mpesa_reconciliation" ||
                record.action === "stripe_webhook_retry_reconciliation" ||
                record.action === "invoice_generation";

            if (shouldProcess) {
                await ctx.db.patch(record._id, {
                    attempts,
                    lastError: undefined,
                    status: "processed",
                    updatedAt: now,
                });
                processed += 1;
                continue;
            }

            if (attempts >= record.maxAttempts) {
                await ctx.db.patch(record._id, {
                    attempts,
                    lastError: "No processor is configured for this billing reconciliation action.",
                    status: "failed",
                    updatedAt: now,
                });
                failed += 1;
            } else {
                await ctx.db.patch(record._id, {
                    attempts,
                    lastError: "Retry scheduled for billing reconciliation action.",
                    nextAttemptAt: now + attempts * 60 * 60 * 1000,
                    updatedAt: now,
                });
                retried += 1;
            }
        }

        return { failed, processed, retried };
    },
});
