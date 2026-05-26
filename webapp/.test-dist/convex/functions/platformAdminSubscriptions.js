"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDueBillingReconciliations = exports.runScheduledBillingMaintenance = exports.expireGracePeriods = exports.queueInvoiceGeneration = exports.queueReconciliation = exports.batchUpdateSubscriptionStatus = exports.requestRefundApproval = exports.updateCustomPricing = exports.recordFailedPayment = exports.recordProviderPayment = exports.verifyBankTransfer = exports.getSubscriptionDetail = exports.getPlatformAdminSubscriptionSnapshot = exports.issuePlatformAdminSubscriptionReadAccess = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const dashboard_access_token_1 = require("../../lib/backend/platform-admin/dashboard-access-token");
const audit_1 = require("../../lib/shared/security/audit");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const _tenantGuard_1 = require("./_tenantGuard");
const PAGE_SIZE = 25;
const MAX_LIST_SCAN = 500;
const MAX_EXPORT_ROWS = 1000;
const MAX_RECONCILIATION_ATTEMPTS_PER_RUN = 50;
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const tierFilterValidator = values_1.v.union(values_1.v.literal("all"), values_1.v.literal("enterprise"), values_1.v.literal("free"), values_1.v.literal("professional"), values_1.v.literal("starter"));
const statusFilterValidator = values_1.v.union(values_1.v.literal("all"), values_1.v.literal("active"), values_1.v.literal("trialing"), values_1.v.literal("past_due"), values_1.v.literal("grace_period"), values_1.v.literal("suspended"), values_1.v.literal("cancelled"));
const paymentMethodFilterValidator = values_1.v.union(values_1.v.literal("all"), values_1.v.literal("stripe"), values_1.v.literal("intasend"), values_1.v.literal("bank_transfer"), values_1.v.literal("custom"));
const providerValidator = values_1.v.union(values_1.v.literal("stripe"), values_1.v.literal("intasend"), values_1.v.literal("bank_transfer"), values_1.v.literal("custom"));
const billingCycleValidator = values_1.v.union(values_1.v.literal("monthly"), values_1.v.literal("annual"));
function validationError(field, message) {
    throw new values_1.ConvexError({ code: "VALIDATION_FAILED", field, message });
}
function normalizeSubscriptionStatus(tenant) {
    return tenant.subscriptionStatus ?? (tenant.status === "suspended" ? "suspended" : tenant.status === "cancelled" ? "cancelled" : "active");
}
function getEffectiveAmountCents(tenant) {
    return tenant.subscriptionCustomPriceCents ?? tenant.subscriptionAmountCents ?? 0;
}
function getMonthlyEquivalentCents(tenant) {
    const amount = getEffectiveAmountCents(tenant);
    return (tenant.subscriptionBillingCycle ?? "annual") === "annual" ? Math.round(amount / 12) : amount;
}
function requireReason(reason) {
    const normalized = reason.trim();
    if (normalized.length < 3) {
        validationError("reason", "Reason must be at least 3 characters.");
    }
    if (normalized.length > 240) {
        validationError("reason", "Reason must be 240 characters or less.");
    }
    return normalized;
}
function requirePositiveAmount(amountCents, field = "amountCents") {
    if (!Number.isFinite(amountCents) || amountCents < 1) {
        validationError(field, "Amount must be greater than zero.");
    }
}
function requirePaymentReference(paymentReference) {
    const normalized = paymentReference.trim();
    if (normalized.length < 3) {
        validationError("paymentReference", "Payment reference must be at least 3 characters.");
    }
    if (normalized.length > 120) {
        validationError("paymentReference", "Payment reference must be 120 characters or less.");
    }
    return normalized;
}
function requireCurrency(currency) {
    const normalized = currency.trim().toUpperCase() || "KES";
    if (!/^[A-Z]{3}$/.test(normalized)) {
        validationError("currency", "Currency must be a 3-letter code.");
    }
    return normalized;
}
async function auditBillingAction(args) {
    await (0, _audit_1.appendAuditLogRequired)(args.ctx, {
        action: args.action,
        actor: (0, audit_1.createAuthenticatedAuditActor)({
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
function buildRow(tenant) {
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
exports.issuePlatformAdminSubscriptionReadAccess = (0, server_1.mutation)({
    args: {},
    handler: async (ctx) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        await Promise.all([
            (0, _tenantGuard_1.auditPlatformAdminBypassRead)(ctx, {
                action: "subscription_list_read",
                entityType: "tenant",
                tableName: "tenants",
            }),
            (0, _tenantGuard_1.auditPlatformAdminBypassRead)(ctx, {
                action: "subscription_billing_records_read",
                entityType: "billingRecord",
                tableName: "billingRecords",
            }),
        ]);
        await auditBillingAction({
            action: "read_subscription_list",
            ctx,
            event: audit_1.AUDIT_EVENT_NAMES.subscriptionReadAllowed,
            outcome: "allowed",
            platformUserId: authContext.userId,
        });
        return await (0, dashboard_access_token_1.createPlatformAdminDashboardReadAccessToken)({
            scope: "subscription_list",
            userId: String(authContext.userId),
        });
    },
});
exports.getPlatformAdminSubscriptionSnapshot = (0, server_1.query)({
    args: {
        accessToken: values_1.v.string(),
        dateFrom: values_1.v.optional(values_1.v.number()),
        dateTo: values_1.v.optional(values_1.v.number()),
        page: values_1.v.optional(values_1.v.number()),
        paymentMethod: values_1.v.optional(paymentMethodFilterValidator),
        search: values_1.v.optional(values_1.v.string()),
        status: values_1.v.optional(statusFilterValidator),
        tier: values_1.v.optional(tierFilterValidator),
    },
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        const access = await (0, dashboard_access_token_1.verifyPlatformAdminDashboardReadAccessToken)({
            scope: "subscription_list",
            token: args.accessToken,
            userId: String(authContext.userId),
        });
        if (!access.ok) {
            throw new values_1.ConvexError({ code: "UNAUTHORIZED", message: "Audited subscription access could not be verified." });
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
        const byTier = tenants.reduce((totals, tenant) => {
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
exports.getSubscriptionDetail = (0, server_1.mutation)({
    args: {
        accessToken: values_1.v.string(),
        tenantId: values_1.v.id("tenants"),
    },
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        const access = await (0, dashboard_access_token_1.verifyPlatformAdminDashboardReadAccessToken)({
            scope: "subscription_list",
            token: args.accessToken,
            userId: String(authContext.userId),
        });
        if (!access.ok) {
            throw new values_1.ConvexError({ code: "UNAUTHORIZED", message: "Audited subscription detail access could not be verified." });
        }
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant) {
            return null;
        }
        await (0, _tenantGuard_1.auditPlatformAdminBypassRead)(ctx, {
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
exports.verifyBankTransfer = (0, server_1.mutation)({
    args: {
        amountCents: values_1.v.number(),
        billingCycle: billingCycleValidator,
        currency: values_1.v.string(),
        nextBillingDate: values_1.v.number(),
        paymentReference: values_1.v.string(),
        reason: values_1.v.string(),
        tenantId: values_1.v.id("tenants"),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
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
            event: audit_1.AUDIT_EVENT_NAMES.subscriptionBankTransferVerified,
            metadata: { amountCents: args.amountCents, paymentReference, reason },
            platformUserId: authContext.userId,
            recordId: String(recordId),
            targetTenantId: args.tenantId,
        });
        return null;
    },
});
exports.recordProviderPayment = (0, server_1.mutation)({
    args: {
        amountCents: values_1.v.number(),
        billingCycle: billingCycleValidator,
        currency: values_1.v.string(),
        nextBillingDate: values_1.v.number(),
        paymentReference: values_1.v.string(),
        provider: values_1.v.union(values_1.v.literal("stripe"), values_1.v.literal("intasend")),
        tenantId: values_1.v.id("tenants"),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
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
            event: audit_1.AUDIT_EVENT_NAMES.subscriptionPaymentVerified,
            metadata: { provider: args.provider, paymentReference },
            platformUserId: authContext.userId,
            recordId: String(recordId),
            targetTenantId: args.tenantId,
        });
        return null;
    },
});
exports.recordFailedPayment = (0, server_1.mutation)({
    args: {
        amountCents: values_1.v.optional(values_1.v.number()),
        paymentReference: values_1.v.string(),
        provider: providerValidator,
        reason: values_1.v.string(),
        tenantId: values_1.v.id("tenants"),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
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
            event: audit_1.AUDIT_EVENT_NAMES.subscriptionFailedPaymentRecorded,
            metadata: { gracePeriodEndsAt, paymentReference, provider: args.provider, reason },
            platformUserId: authContext.userId,
            targetTenantId: args.tenantId,
        });
        return null;
    },
});
exports.updateCustomPricing = (0, server_1.mutation)({
    args: {
        amountCents: values_1.v.number(),
        reason: values_1.v.string(),
        tenantId: values_1.v.id("tenants"),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
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
            event: audit_1.AUDIT_EVENT_NAMES.subscriptionCustomPriceUpdated,
            metadata: { amountCents: args.amountCents, reason },
            platformUserId: authContext.userId,
            targetTenantId: args.tenantId,
        });
        return null;
    },
});
exports.requestRefundApproval = (0, server_1.mutation)({
    args: {
        amountCents: values_1.v.number(),
        billingRecordId: values_1.v.optional(values_1.v.id("billingRecords")),
        reason: values_1.v.string(),
        serviceEndAt: values_1.v.number(),
        serviceStartAt: values_1.v.number(),
        tenantId: values_1.v.id("tenants"),
    },
    returns: values_1.v.id("billingRefundApprovals"),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
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
            event: audit_1.AUDIT_EVENT_NAMES.subscriptionRefundRequested,
            metadata: { proratedAmountCents, reason },
            outcome: "queued",
            platformUserId: authContext.userId,
            recordId: String(refundId),
            targetTenantId: args.tenantId,
        });
        return refundId;
    },
});
exports.batchUpdateSubscriptionStatus = (0, server_1.mutation)({
    args: {
        reason: values_1.v.string(),
        status: statusFilterValidator,
        tenantIds: values_1.v.array(values_1.v.id("tenants")),
    },
    returns: values_1.v.object({ updated: values_1.v.number() }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
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
            event: audit_1.AUDIT_EVENT_NAMES.subscriptionBatchStatusUpdated,
            metadata: { reason, status: args.status, tenantCount: updated },
            platformUserId: authContext.userId,
        });
        return { updated };
    },
});
exports.queueReconciliation = (0, server_1.mutation)({
    args: {
        provider: values_1.v.union(values_1.v.literal("stripe"), values_1.v.literal("intasend")),
    },
    returns: values_1.v.id("billingReconciliationRecords"),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
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
            event: audit_1.AUDIT_EVENT_NAMES.subscriptionReconciliationQueued,
            metadata: { provider: args.provider, maxAttempts: 3 },
            outcome: "queued",
            platformUserId: authContext.userId,
            recordId: String(id),
        });
        return id;
    },
});
exports.queueInvoiceGeneration = (0, server_1.mutation)({
    args: {
        tenantId: values_1.v.id("tenants"),
    },
    returns: values_1.v.id("billingReconciliationRecords"),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
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
            event: audit_1.AUDIT_EVENT_NAMES.subscriptionInvoiceQueued,
            outcome: "queued",
            platformUserId: authContext.userId,
            recordId: String(id),
            targetTenantId: args.tenantId,
        });
        return id;
    },
});
exports.expireGracePeriods = (0, server_1.mutation)({
    args: {},
    returns: values_1.v.object({ suspended: values_1.v.number() }),
    handler: async (ctx) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
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
                event: audit_1.AUDIT_EVENT_NAMES.subscriptionGraceExpired,
                metadata: { suspended },
                platformUserId: authContext.userId,
            });
        }
        return { suspended };
    },
});
exports.runScheduledBillingMaintenance = (0, server_1.internalMutation)({
    args: {},
    returns: values_1.v.object({
        reconciliationQueued: values_1.v.boolean(),
        suspended: values_1.v.number(),
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
exports.processDueBillingReconciliations = (0, server_1.internalMutation)({
    args: {},
    returns: values_1.v.object({
        failed: values_1.v.number(),
        processed: values_1.v.number(),
        retried: values_1.v.number(),
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
            const shouldProcess = record.action === "daily_mpesa_reconciliation" ||
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
            }
            else {
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
