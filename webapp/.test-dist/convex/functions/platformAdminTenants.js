"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantEffectiveConfiguration = exports.resolveTenantSubdomainRedirect = exports.requestTenantDataExport = exports.createTenantOverride = exports.updateTenantLifecycle = exports.changeTenantSubdomain = exports.updateTenantSettings = exports.getTenantManagementDetail = exports.assignReplacementTenantAdmin = exports.provisionTenant = exports.checkTenantSubdomainAvailability = exports.issuePlatformAdminTenantListReadAccess = exports.getPlatformAdminTenantListSnapshot = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const tenant_list_1 = require("../../lib/shared/platform-admin/tenant-list");
const dashboard_access_token_1 = require("../../lib/backend/platform-admin/dashboard-access-token");
const audit_1 = require("../../lib/shared/security/audit");
const input_1 = require("../../lib/shared/security/input");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const _tenantGuard_1 = require("./_tenantGuard");
const tenantAdminOnboarding_1 = require("./tenantAdminOnboarding");
const tenantTierFilterValidator = values_1.v.union(values_1.v.literal("all"), values_1.v.literal("enterprise"), values_1.v.literal("free"), values_1.v.literal("professional"), values_1.v.literal("starter"), values_1.v.literal("unknown"));
const tenantStatusFilterValidator = values_1.v.union(values_1.v.literal("all"), values_1.v.literal("active"), values_1.v.literal("cancelled"), values_1.v.literal("pending"), values_1.v.literal("suspended"), values_1.v.literal("unknown"));
const profileFilterValidator = values_1.v.union(values_1.v.literal("all"), values_1.v.literal("complete"), values_1.v.literal("incomplete"));
const attentionFilterValidator = values_1.v.union(values_1.v.literal("all"), values_1.v.literal("attention"), values_1.v.literal("clear"));
const tenantSubdomainPattern = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;
const redirectRetentionMs = 30 * 24 * 60 * 60 * 1000;
const softDeleteRetentionMs = 90 * 24 * 60 * 60 * 1000;
const exportLinkRetentionMs = 72 * 60 * 60 * 1000;
function validationError(field, message) {
    throw new values_1.ConvexError({ code: "VALIDATION_FAILED", field, message });
}
function requireValidSubdomain(value) {
    const subdomain = (0, input_1.normalizePlainText)(value).toLowerCase();
    if (!tenantSubdomainPattern.test(subdomain)) {
        validationError("subdomain", "Subdomain must be 3-63 lowercase letters, numbers, or hyphens, with no leading or trailing hyphen.");
    }
    return subdomain;
}
function assertPlainText(value, field, label, maxLength = 240) {
    const result = (0, input_1.validatePlainTextInput)(value, {
        field,
        label,
        maxLength,
        minLength: 1,
    });
    if (!result.ok) {
        validationError(field, result.issue.message);
    }
    return result.value;
}
function assertIntegerInRange(value, field, label, min, max) {
    if (value === undefined) {
        return undefined;
    }
    if (!Number.isInteger(value) || value < min || value > max) {
        validationError(field, `${label} must be a whole number between ${min} and ${max}.`);
    }
    return value;
}
function assertPositiveFiniteNumber(value, field, label) {
    if (value === undefined) {
        return undefined;
    }
    if (!Number.isFinite(value) || value <= 0) {
        validationError(field, `${label} must be greater than zero.`);
    }
    return value;
}
async function assertSubdomainAvailable(ctx, subdomain, existingTenantId) {
    const existingTenant = await ctx.db
        .query("tenants")
        .withIndex("by_subdomain", (q) => q.eq("subdomain", subdomain))
        .first();
    if (existingTenant && existingTenant._id !== existingTenantId) {
        validationError("subdomain", "This subdomain is already assigned to another tenant.");
    }
    const existingRedirect = await ctx.db
        .query("tenantSubdomainRedirects")
        .withIndex("by_fromSubdomain", (q) => q.eq("fromSubdomain", subdomain))
        .first();
    if (existingRedirect && existingRedirect.tenantId !== existingTenantId && existingRedirect.expiresAt > Date.now()) {
        validationError("subdomain", "This subdomain is reserved by an active redirect.");
    }
}
async function auditTenantChange(args) {
    await (0, _audit_1.appendAuditLogRequired)(args.ctx, {
        action: args.action,
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "platform_admin",
            userId: String(args.platformUserId),
        }),
        entityType: "tenant",
        event: args.event,
        metadata: args.metadata ?? {},
        outcome: args.outcome ?? "allowed",
        recordId: args.recordId,
        tableName: "tenants",
        targetTenantId: args.targetTenantId ? String(args.targetTenantId) : undefined,
        timestamp: Date.now(),
    });
}
function buildTenantDetail(tenant, args) {
    const now = Date.now();
    const storageLimitBytes = tenant.storageLimitBytes ?? 1073741824;
    const storageUsedBytes = tenant.storageUsedBytes ?? 0;
    const userLimit = tenant.userLimit ?? 25;
    const storagePercent = storageLimitBytes > 0 ? Math.round((storageUsedBytes / storageLimitBytes) * 100) : 0;
    const userPercent = userLimit > 0 ? Math.round((args.activeUsers / userLimit) * 100) : 0;
    return {
        id: tenant._id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        tier: tenant.tier,
        status: tenant.status,
        profileComplete: tenant.profileComplete,
        primaryContactEmail: tenant.primaryContactEmail,
        primaryContactName: tenant.primaryContactName,
        primaryContactPhone: tenant.primaryContactPhone,
        procurementBudgetCeiling: tenant.procurementBudgetCeiling,
        fiscalYearStartMonth: tenant.fiscalYearStartMonth,
        timeZone: tenant.timeZone,
        storageLimitBytes,
        storageUsedBytes,
        userLimit,
        activeUsers: args.activeUsers,
        departmentCount: args.departmentCount,
        lifecycle: {
            suspendedAt: tenant.suspendedAt,
            suspensionReason: tenant.suspensionReason,
            restoredAt: tenant.restoredAt,
            restoreReason: tenant.restoreReason,
            softDeletedAt: tenant.softDeletedAt,
            softDeleteReason: tenant.softDeleteReason,
            purgeScheduledAt: tenant.purgeScheduledAt,
        },
        alerts: [
            ...(storagePercent >= 90 ? [`Storage usage is at ${storagePercent}% of limit`] : []),
            ...(userPercent >= 90 ? [`Active user count is at ${userPercent}% of limit`] : []),
        ],
        redirects: args.redirects
            .filter((redirect) => redirect.expiresAt > now)
            .map((redirect) => ({
            fromSubdomain: redirect.fromSubdomain,
            toSubdomain: redirect.toSubdomain,
            expiresAt: redirect.expiresAt,
        })),
        overrides: args.configOverrides
            .filter((override) => override.expiresAt > now)
            .map((override) => ({
            id: override._id,
            key: override.key,
            value: override.value,
            reason: override.reason,
            expiresAt: override.expiresAt,
            createdAt: override.createdAt,
        })),
        exports: args.dataExports.map((dataExport) => ({
            id: dataExport._id,
            status: dataExport.status,
            downloadUrl: dataExport.downloadUrl,
            errorMessage: dataExport.errorMessage,
            requestedAt: dataExport.requestedAt,
            expiresAt: dataExport.expiresAt,
        })),
        createdAt: tenant.createdAt,
    };
}
exports.getPlatformAdminTenantListSnapshot = (0, server_1.query)({
    args: {
        accessToken: values_1.v.string(),
        attention: values_1.v.optional(attentionFilterValidator),
        page: values_1.v.optional(values_1.v.number()),
        profile: values_1.v.optional(profileFilterValidator),
        search: values_1.v.optional(values_1.v.string()),
        status: values_1.v.optional(tenantStatusFilterValidator),
        tier: values_1.v.optional(tenantTierFilterValidator),
    },
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        const accessResult = await (0, dashboard_access_token_1.verifyPlatformAdminDashboardReadAccessToken)({
            scope: "tenant_list",
            token: args.accessToken,
            userId: String(authContext.userId),
        });
        if (!accessResult.ok) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: accessResult.reason === "expired"
                    ? "Platform admin tenant-list access expired. Retry to re-establish the audited read session."
                    : "Platform admin tenant-list access could not be verified.",
            });
        }
        const [tenants, tenantUsers, departments, subscriptionTiers, latestHealthSnapshot,] = await Promise.all([
            ctx.db.query("tenants").collect(),
            ctx.db.query("tenantUsers").collect(),
            ctx.db.query("departments").collect(),
            ctx.db.query("subscriptionTiers").collect(),
            ctx.db
                .query("platformHealthSnapshots")
                .withIndex("by_capturedAt", (q) => q)
                .order("desc")
                .first(),
        ]);
        return (0, tenant_list_1.buildPlatformAdminTenantListSnapshot)({
            departments: departments.map((department) => ({
                isActive: department.isActive,
                tenantId: String(department.tenantId),
            })),
            filters: (0, tenant_list_1.normalizePlatformAdminTenantListFilters)({
                attention: args.attention,
                profile: args.profile,
                search: args.search,
                status: args.status,
                tier: args.tier,
            }),
            healthSnapshot: latestHealthSnapshot
                ? {
                    capturedAt: latestHealthSnapshot.capturedAt,
                    summaryState: latestHealthSnapshot.summaryState,
                }
                : null,
            now: Date.now(),
            page: args.page ?? 1,
            pageSize: tenant_list_1.PLATFORM_ADMIN_TENANT_LIST_PAGE_SIZE,
            subscriptionTiers: subscriptionTiers.map((tier) => ({
                isActive: tier.isActive,
                slug: tier.slug,
            })),
            tenantUsers: tenantUsers.map((tenantUser) => ({
                isActive: tenantUser.isActive,
                tenantId: String(tenantUser.tenantId),
            })),
            tenants: tenants.map((tenant) => ({
                createdAt: tenant.createdAt,
                id: String(tenant._id),
                name: tenant.name,
                onboardingCompletedAt: tenant.onboardingCompletedAt ?? null,
                primaryContactEmail: tenant.primaryContactEmail ?? null,
                primaryContactName: tenant.primaryContactName ?? null,
                profileComplete: tenant.profileComplete,
                status: tenant.status === "active" && tenant.profileComplete === false
                    ? "pending"
                    : tenant.status,
                subdomain: tenant.subdomain,
                tier: tenant.tier,
            })),
        });
    },
});
exports.issuePlatformAdminTenantListReadAccess = (0, server_1.mutation)({
    args: {},
    handler: async (ctx) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        await Promise.all([
            (0, _tenantGuard_1.auditPlatformAdminBypassRead)(ctx, {
                action: "tenant_list_snapshot_read",
                entityType: "tenant",
                tableName: "tenants",
            }),
            (0, _tenantGuard_1.auditPlatformAdminBypassRead)(ctx, {
                action: "tenant_list_snapshot_read",
                entityType: "tenantUser",
                tableName: "tenantUsers",
            }),
            (0, _tenantGuard_1.auditPlatformAdminBypassRead)(ctx, {
                action: "tenant_list_snapshot_read",
                entityType: "department",
                tableName: "departments",
            }),
        ]);
        return await (0, dashboard_access_token_1.createPlatformAdminDashboardReadAccessToken)({
            scope: "tenant_list",
            userId: String(authContext.userId),
        });
    },
});
exports.checkTenantSubdomainAvailability = (0, server_1.query)({
    args: {
        subdomain: values_1.v.string(),
        tenantId: values_1.v.optional(values_1.v.id("tenants")),
    },
    returns: values_1.v.object({
        available: values_1.v.boolean(),
        message: values_1.v.string(),
        normalizedSubdomain: values_1.v.string(),
    }),
    handler: async (ctx, args) => {
        await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        const normalizedSubdomain = (0, input_1.normalizePlainText)(args.subdomain).toLowerCase();
        if (!tenantSubdomainPattern.test(normalizedSubdomain)) {
            return {
                available: false,
                message: "Use 3-63 lowercase letters, numbers, or hyphens with no edge hyphen.",
                normalizedSubdomain,
            };
        }
        const tenant = await ctx.db
            .query("tenants")
            .withIndex("by_subdomain", (q) => q.eq("subdomain", normalizedSubdomain))
            .first();
        const redirect = await ctx.db
            .query("tenantSubdomainRedirects")
            .withIndex("by_fromSubdomain", (q) => q.eq("fromSubdomain", normalizedSubdomain))
            .first();
        const available = (!tenant || tenant._id === args.tenantId) &&
            (!redirect || redirect.tenantId === args.tenantId || redirect.expiresAt <= Date.now());
        return {
            available,
            message: available ? "Subdomain is available." : "Subdomain is already in use.",
            normalizedSubdomain,
        };
    },
});
exports.provisionTenant = (0, server_1.mutation)({
    args: {
        organizationName: values_1.v.string(),
        subdomain: values_1.v.string(),
        tenantAdminEmail: values_1.v.string(),
    },
    returns: values_1.v.object({
        invitationId: values_1.v.id("tenantAdminInvitations"),
        inviteUrl: values_1.v.string(),
        tenantId: values_1.v.id("tenants"),
    }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        const organizationNameResult = (0, input_1.validateOrganizationNameInput)(args.organizationName);
        if (!organizationNameResult.ok) {
            validationError("organizationName", organizationNameResult.issue.message);
        }
        const emailResult = (0, input_1.validateEmailInput)(args.tenantAdminEmail, "tenantAdminEmail");
        if (!emailResult.ok) {
            validationError("tenantAdminEmail", emailResult.issue.message);
        }
        const subdomain = requireValidSubdomain(args.subdomain);
        await assertSubdomainAvailable(ctx, subdomain);
        let tenantId;
        try {
            const now = Date.now();
            tenantId = await ctx.db.insert("tenants", {
                name: organizationNameResult.value.normalized,
                subdomain,
                tier: "free",
                status: "pending",
                profileComplete: false,
                primaryContactEmail: emailResult.value,
                storageLimitBytes: 1073741824,
                storageUsedBytes: 0,
                userLimit: 25,
                createdAt: now,
            });
            const invitation = await (0, tenantAdminOnboarding_1.issueInvitationCore)({
                ctx,
                email: emailResult.value,
                platformUserId: authContext.userId,
                tenantId,
            });
            await ctx.db.insert("devEmailMessages", {
                createdAt: now,
                debugLink: invitation.inviteUrl,
                from: "Procureline <no-reply@procureline.local>",
                html: `<p>You have been invited to administer ${organizationNameResult.value.normalized} on Procureline.</p><p><a href="${invitation.inviteUrl}">Accept invitation</a></p>`,
                idempotencyKey: `tenant-admin-invite:${String(invitation.invitationId)}`,
                messageType: "tenant_admin_invitation",
                metadata: {
                    invitationId: String(invitation.invitationId),
                    tenantId: String(tenantId),
                },
                primaryRecipient: emailResult.value,
                subject: "You're invited to Procureline",
                text: `You have been invited to administer ${organizationNameResult.value.normalized} on Procureline. Accept: ${invitation.inviteUrl}`,
                to: [emailResult.value],
                transport: "dev_inbox",
            });
            await auditTenantChange({
                action: "provision",
                ctx,
                event: audit_1.AUDIT_EVENT_NAMES.tenantProvisioned,
                metadata: {
                    normalizedEmail: (0, input_1.normalizeAuthEmail)(args.tenantAdminEmail),
                    subdomain,
                },
                platformUserId: authContext.userId,
                recordId: String(tenantId),
                targetTenantId: tenantId,
            });
            return {
                invitationId: invitation.invitationId,
                inviteUrl: invitation.inviteUrl,
                tenantId,
            };
        }
        catch (error) {
            if (tenantId) {
                await ctx.db.patch(tenantId, {
                    status: "cancelled",
                    softDeletedAt: Date.now(),
                    softDeleteReason: "Provisioning failed before completion.",
                    purgeScheduledAt: Date.now(),
                });
            }
            await (0, _audit_1.appendAuditLogBestEffort)(ctx, {
                action: "provision",
                actor: (0, audit_1.createAuthenticatedAuditActor)({
                    role: "platform_admin",
                    userId: String(authContext.userId),
                }),
                entityType: "tenant",
                event: audit_1.AUDIT_EVENT_NAMES.tenantProvisioningFailed,
                metadata: {
                    message: error instanceof Error ? error.message : "Unknown provisioning failure",
                    subdomain,
                },
                outcome: "failed",
                recordId: tenantId ? String(tenantId) : undefined,
                tableName: "tenants",
                targetTenantId: tenantId ? String(tenantId) : undefined,
                timestamp: Date.now(),
            });
            throw error;
        }
    },
});
exports.assignReplacementTenantAdmin = (0, server_1.mutation)({
    args: {
        tenantAdminEmail: values_1.v.string(),
        tenantId: values_1.v.id("tenants"),
    },
    returns: values_1.v.object({
        invitationId: values_1.v.id("tenantAdminInvitations"),
        inviteUrl: values_1.v.string(),
    }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant)
            validationError("tenantId", "Tenant not found.");
        const emailResult = (0, input_1.validateEmailInput)(args.tenantAdminEmail, "tenantAdminEmail");
        if (!emailResult.ok)
            validationError("tenantAdminEmail", emailResult.issue.message);
        const invitation = await (0, tenantAdminOnboarding_1.issueInvitationCore)({
            ctx,
            email: emailResult.value,
            platformUserId: authContext.userId,
            tenantId: args.tenantId,
        });
        await ctx.db.insert("devEmailMessages", {
            createdAt: Date.now(),
            debugLink: invitation.inviteUrl,
            from: "Procureline <no-reply@procureline.local>",
            html: `<p>You have been appointed to administer ${tenant.name} on Procureline.</p><p><a href="${invitation.inviteUrl}">Accept appointment</a></p>`,
            idempotencyKey: `tenant-admin-replacement:${String(invitation.invitationId)}`,
            messageType: "tenant_admin_invitation",
            metadata: { invitationId: String(invitation.invitationId), mode: "platform_override", tenantId: String(args.tenantId) },
            primaryRecipient: emailResult.value,
            subject: "Tenant Admin replacement appointment",
            text: `You have been appointed to administer ${tenant.name} on Procureline. Accept: ${invitation.inviteUrl}`,
            to: [emailResult.value],
            transport: "dev_inbox",
        });
        await auditTenantChange({
            action: "assign_replacement_admin",
            ctx,
            event: audit_1.AUDIT_EVENT_NAMES.tenantSettingsUpdated,
            metadata: { normalizedEmail: (0, input_1.normalizeAuthEmail)(args.tenantAdminEmail), mode: "platform_override" },
            platformUserId: authContext.userId,
            recordId: String(invitation.invitationId),
            targetTenantId: args.tenantId,
        });
        return invitation;
    },
});
exports.getTenantManagementDetail = (0, server_1.query)({
    args: { tenantId: values_1.v.id("tenants") },
    handler: async (ctx, args) => {
        await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant) {
            return null;
        }
        const [tenantUsers, departments, redirects, overrides, dataExports] = await Promise.all([
            ctx.db.query("tenantUsers").withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId)).collect(),
            ctx.db.query("departments").withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId)).collect(),
            ctx.db.query("tenantSubdomainRedirects").withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId)).order("desc").collect(),
            ctx.db.query("tenantConfigOverrides").withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId)).order("desc").collect(),
            ctx.db.query("platformTenantDataExports").withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId)).order("desc").collect(),
        ]);
        return buildTenantDetail(tenant, {
            activeUsers: tenantUsers.filter((user) => user.isActive).length,
            configOverrides: overrides,
            dataExports,
            departmentCount: departments.filter((department) => department.isActive).length,
            redirects,
        });
    },
});
exports.updateTenantSettings = (0, server_1.mutation)({
    args: {
        tenantId: values_1.v.id("tenants"),
        name: values_1.v.string(),
        primaryContactEmail: values_1.v.optional(values_1.v.string()),
        primaryContactName: values_1.v.optional(values_1.v.string()),
        primaryContactPhone: values_1.v.optional(values_1.v.string()),
        procurementBudgetCeiling: values_1.v.optional(values_1.v.number()),
        fiscalYearStartMonth: values_1.v.optional(values_1.v.number()),
        timeZone: values_1.v.optional(values_1.v.string()),
        storageLimitBytes: values_1.v.optional(values_1.v.number()),
        userLimit: values_1.v.optional(values_1.v.number()),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant) {
            validationError("tenantId", "Tenant not found.");
        }
        const nameResult = (0, input_1.validateOrganizationNameInput)(args.name);
        if (!nameResult.ok) {
            validationError("name", nameResult.issue.message);
        }
        const email = args.primaryContactEmail
            ? (0, input_1.validateEmailInput)(args.primaryContactEmail, "primaryContactEmail")
            : undefined;
        if (email && !email.ok) {
            validationError("primaryContactEmail", email.issue.message);
        }
        if (args.fiscalYearStartMonth !== undefined && args.fiscalYearStartMonth !== 7) {
            validationError("fiscalYearStartMonth", "The institutional fiscal year is fixed from 1 July through 30 June.");
        }
        const storageLimitBytes = assertPositiveFiniteNumber(args.storageLimitBytes, "storageLimitBytes", "Storage limit");
        const userLimit = assertIntegerInRange(args.userLimit, "userLimit", "User limit", 1, 100000);
        const procurementBudgetCeiling = assertPositiveFiniteNumber(args.procurementBudgetCeiling, "procurementBudgetCeiling", "Procurement budget ceiling");
        await ctx.db.patch(args.tenantId, {
            name: nameResult.value.normalized,
            primaryContactEmail: email?.value,
            primaryContactName: args.primaryContactName ? assertPlainText(args.primaryContactName, "primaryContactName", "Contact name", 120) : undefined,
            primaryContactPhone: args.primaryContactPhone ? assertPlainText(args.primaryContactPhone, "primaryContactPhone", "Contact phone", 40) : undefined,
            procurementBudgetCeiling,
            fiscalYearStartMonth: 7,
            timeZone: args.timeZone ? assertPlainText(args.timeZone, "timeZone", "Time zone", 80) : undefined,
            storageLimitBytes,
            userLimit,
        });
        await auditTenantChange({
            action: "update_settings",
            ctx,
            event: audit_1.AUDIT_EVENT_NAMES.tenantSettingsUpdated,
            platformUserId: authContext.userId,
            recordId: String(args.tenantId),
            targetTenantId: args.tenantId,
        });
        return null;
    },
});
exports.changeTenantSubdomain = (0, server_1.mutation)({
    args: {
        tenantId: values_1.v.id("tenants"),
        subdomain: values_1.v.string(),
        reason: values_1.v.string(),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant) {
            validationError("tenantId", "Tenant not found.");
        }
        const nextSubdomain = requireValidSubdomain(args.subdomain);
        const reason = assertPlainText(args.reason, "reason", "Reason");
        await assertSubdomainAvailable(ctx, nextSubdomain, args.tenantId);
        if (tenant.subdomain !== nextSubdomain) {
            const now = Date.now();
            await ctx.db.patch(args.tenantId, {
                subdomain: nextSubdomain,
                previousSubdomains: [...(tenant.previousSubdomains ?? []), tenant.subdomain],
            });
            await ctx.db.insert("tenantSubdomainRedirects", {
                tenantId: args.tenantId,
                fromSubdomain: tenant.subdomain,
                toSubdomain: nextSubdomain,
                expiresAt: now + redirectRetentionMs,
                createdAt: now,
                createdByPlatformUserId: authContext.userId,
            });
            await auditTenantChange({
                action: "change_subdomain",
                ctx,
                event: audit_1.AUDIT_EVENT_NAMES.tenantSubdomainChanged,
                metadata: { fromSubdomain: tenant.subdomain, reason, toSubdomain: nextSubdomain },
                platformUserId: authContext.userId,
                recordId: String(args.tenantId),
                targetTenantId: args.tenantId,
            });
        }
        return null;
    },
});
exports.updateTenantLifecycle = (0, server_1.mutation)({
    args: {
        tenantId: values_1.v.id("tenants"),
        action: values_1.v.union(values_1.v.literal("suspend"), values_1.v.literal("restore"), values_1.v.literal("delete")),
        reason: values_1.v.string(),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant) {
            validationError("tenantId", "Tenant not found.");
        }
        const reason = assertPlainText(args.reason, "reason", "Reason");
        const now = Date.now();
        if (args.action === "suspend") {
            await ctx.db.patch(args.tenantId, {
                status: "suspended",
                suspendedAt: now,
                suspendedByPlatformUserId: authContext.userId,
                suspensionReason: reason,
            });
            await auditTenantChange({ action: "suspend", ctx, event: audit_1.AUDIT_EVENT_NAMES.tenantLifecycleSuspended, metadata: { reason }, platformUserId: authContext.userId, recordId: String(args.tenantId), targetTenantId: args.tenantId });
        }
        else if (args.action === "restore") {
            await ctx.db.patch(args.tenantId, {
                status: "active",
                restoredAt: now,
                restoredByPlatformUserId: authContext.userId,
                restoreReason: reason,
                softDeletedAt: undefined,
                softDeletedByPlatformUserId: undefined,
                softDeleteReason: undefined,
                purgeScheduledAt: undefined,
            });
            await auditTenantChange({ action: "restore", ctx, event: audit_1.AUDIT_EVENT_NAMES.tenantLifecycleRestored, metadata: { reason }, platformUserId: authContext.userId, recordId: String(args.tenantId), targetTenantId: args.tenantId });
        }
        else {
            await ctx.db.patch(args.tenantId, {
                status: "cancelled",
                softDeletedAt: now,
                softDeletedByPlatformUserId: authContext.userId,
                softDeleteReason: reason,
                purgeScheduledAt: now + softDeleteRetentionMs,
            });
            await auditTenantChange({ action: "soft_delete", ctx, event: audit_1.AUDIT_EVENT_NAMES.tenantLifecycleDeleted, metadata: { reason, purgeScheduledAt: now + softDeleteRetentionMs }, platformUserId: authContext.userId, recordId: String(args.tenantId), targetTenantId: args.tenantId });
        }
        return null;
    },
});
exports.createTenantOverride = (0, server_1.mutation)({
    args: {
        tenantId: values_1.v.id("tenants"),
        key: values_1.v.string(),
        value: values_1.v.string(),
        reason: values_1.v.string(),
        expiresAt: values_1.v.number(),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        if (!(await ctx.db.get(args.tenantId))) {
            validationError("tenantId", "Tenant not found.");
        }
        if (args.expiresAt <= Date.now()) {
            validationError("expiresAt", "Override expiry must be in the future.");
        }
        const now = Date.now();
        await ctx.db.insert("tenantConfigOverrides", {
            tenantId: args.tenantId,
            key: assertPlainText(args.key, "key", "Override key", 80),
            value: assertPlainText(args.value, "value", "Override value", 240),
            reason: assertPlainText(args.reason, "reason", "Reason"),
            expiresAt: args.expiresAt,
            createdAt: now,
            createdByPlatformUserId: authContext.userId,
        });
        await auditTenantChange({ action: "create_override", ctx, event: audit_1.AUDIT_EVENT_NAMES.tenantOverrideCreated, metadata: { expiresAt: args.expiresAt, key: args.key }, platformUserId: authContext.userId, recordId: String(args.tenantId), targetTenantId: args.tenantId });
        return null;
    },
});
exports.requestTenantDataExport = (0, server_1.mutation)({
    args: { tenantId: values_1.v.id("tenants") },
    returns: values_1.v.object({
        exportId: values_1.v.id("platformTenantDataExports"),
        downloadUrl: values_1.v.string(),
    }),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant) {
            validationError("tenantId", "Tenant not found.");
        }
        const now = Date.now();
        const [tenantUsers, departments, invitations, redirects, overrides, auditLogs] = await Promise.all([
            ctx.db.query("tenantUsers").withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId)).collect(),
            ctx.db.query("departments").withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId)).collect(),
            ctx.db.query("tenantAdminInvitations").withIndex("by_tenantId_email", (q) => q.eq("tenantId", args.tenantId)).collect(),
            ctx.db.query("tenantSubdomainRedirects").withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId)).collect(),
            ctx.db.query("tenantConfigOverrides").withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId)).collect(),
            ctx.db.query("auditLogs").withIndex("by_targetTenantId", (q) => q.eq("targetTenantId", args.tenantId)).collect(),
        ]);
        const exportPayload = {
            auditLogs,
            departments,
            generatedAt: now,
            generatedByPlatformUserId: authContext.userId,
            invitations,
            overrides,
            redirects,
            tenant,
            tenantUsers,
        };
        const fileBody = JSON.stringify(exportPayload, null, 2);
        const downloadUrl = `data:application/json;charset=utf-8,${encodeURIComponent(fileBody)}`;
        const exportId = await ctx.db.insert("platformTenantDataExports", {
            tenantId: args.tenantId,
            requestedByPlatformUserId: authContext.userId,
            status: "ready",
            downloadUrl,
            fileSizeBytes: fileBody.length,
            requestedAt: now,
            updatedAt: now,
            expiresAt: now + exportLinkRetentionMs,
        });
        await auditTenantChange({ action: "request_data_export", ctx, event: audit_1.AUDIT_EVENT_NAMES.tenantDataExportRequested, outcome: "queued", platformUserId: authContext.userId, recordId: String(exportId), targetTenantId: args.tenantId });
        return {
            exportId,
            downloadUrl,
        };
    },
});
exports.resolveTenantSubdomainRedirect = (0, server_1.query)({
    args: { subdomain: values_1.v.string() },
    returns: values_1.v.union(values_1.v.null(), values_1.v.object({
        expiresAt: values_1.v.number(),
        tenantId: values_1.v.id("tenants"),
        toSubdomain: values_1.v.string(),
    })),
    handler: async (ctx, args) => {
        const subdomain = requireValidSubdomain(args.subdomain);
        const redirect = await ctx.db
            .query("tenantSubdomainRedirects")
            .withIndex("by_fromSubdomain", (q) => q.eq("fromSubdomain", subdomain))
            .first();
        if (!redirect || redirect.expiresAt <= Date.now()) {
            return null;
        }
        return {
            expiresAt: redirect.expiresAt,
            tenantId: redirect.tenantId,
            toSubdomain: redirect.toSubdomain,
        };
    },
});
exports.getTenantEffectiveConfiguration = (0, server_1.query)({
    args: { tenantId: values_1.v.id("tenants") },
    handler: async (ctx, args) => {
        await (0, _roleGuard_1.requirePlatformAdmin)(ctx);
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant) {
            return null;
        }
        const overrides = await ctx.db
            .query("tenantConfigOverrides")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
            .collect();
        const now = Date.now();
        const activeOverrides = overrides.filter((override) => override.expiresAt > now);
        const overrideValues = Object.fromEntries(activeOverrides.map((override) => [override.key, override.value]));
        return {
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            overrideValues,
            storageLimitBytes: tenant.storageLimitBytes,
            timeZone: tenant.timeZone,
            userLimit: tenant.userLimit,
        };
    },
});
