import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../_generated/server";
import {
    buildPlatformAdminTenantListSnapshot,
    normalizePlatformAdminTenantListFilters,
    PLATFORM_ADMIN_TENANT_LIST_PAGE_SIZE,
    type PlatformAdminAttentionFilter,
    type PlatformAdminProfileCompletionFilter,
    type PlatformAdminTenantStatus,
    type PlatformAdminTenantTier,
} from "../../lib/shared/platform-admin/tenant-list";
import {
    createPlatformAdminDashboardReadAccessToken,
    verifyPlatformAdminDashboardReadAccessToken,
} from "../../lib/backend/platform-admin/dashboard-access-token";
import {
    AUDIT_EVENT_NAMES,
    createAuthenticatedAuditActor,
} from "../../lib/shared/security/audit";
import {
    normalizeAuthEmail,
    normalizePlainText,
    validateEmailInput,
    validateOrganizationNameInput,
    validatePlainTextInput,
} from "../../lib/shared/security/input";
import { appendAuditLogBestEffort, appendAuditLogRequired } from "./_audit";
import { requirePlatformAdmin } from "./_roleGuard";
import { auditPlatformAdminBypassRead } from "./_tenantGuard";
import { issueInvitationCore } from "./tenantAdminOnboarding";

const tenantTierFilterValidator = v.union(
    v.literal("all"),
    v.literal("enterprise"),
    v.literal("free"),
    v.literal("professional"),
    v.literal("starter"),
    v.literal("unknown"),
);

const tenantStatusFilterValidator = v.union(
    v.literal("all"),
    v.literal("active"),
    v.literal("cancelled"),
    v.literal("suspended"),
    v.literal("unknown"),
);

const profileFilterValidator = v.union(
    v.literal("all"),
    v.literal("complete"),
    v.literal("incomplete"),
);

const attentionFilterValidator = v.union(
    v.literal("all"),
    v.literal("attention"),
    v.literal("clear"),
);

const tenantSubdomainPattern = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;
const redirectRetentionMs = 30 * 24 * 60 * 60 * 1000;
const softDeleteRetentionMs = 90 * 24 * 60 * 60 * 1000;
const exportLinkRetentionMs = 72 * 60 * 60 * 1000;

function validationError(field: string, message: string): never {
    throw new ConvexError({ code: "VALIDATION_FAILED", field, message });
}

function requireValidSubdomain(value: string): string {
    const subdomain = normalizePlainText(value).toLowerCase();
    if (!tenantSubdomainPattern.test(subdomain)) {
        validationError(
            "subdomain",
            "Subdomain must be 3-63 lowercase letters, numbers, or hyphens, with no leading or trailing hyphen.",
        );
    }
    return subdomain;
}

function assertPlainText(value: string, field: string, label: string, maxLength = 240): string {
    const result = validatePlainTextInput(value, {
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

async function assertSubdomainAvailable(
    ctx: Parameters<typeof requirePlatformAdmin>[0],
    subdomain: string,
    existingTenantId?: Id<"tenants">,
): Promise<void> {
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

async function auditTenantChange(args: {
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

function buildTenantDetail(tenant: Doc<"tenants">, args: {
    activeUsers: number;
    configOverrides: Doc<"tenantConfigOverrides">[];
    dataExports: Doc<"platformTenantDataExports">[];
    departmentCount: number;
    redirects: Doc<"tenantSubdomainRedirects">[];
}) {
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
        redirects: args.redirects.map((redirect) => ({
            fromSubdomain: redirect.fromSubdomain,
            toSubdomain: redirect.toSubdomain,
            expiresAt: redirect.expiresAt,
        })),
        overrides: args.configOverrides.map((override) => ({
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

export const getPlatformAdminTenantListSnapshot = query({
    args: {
        accessToken: v.string(),
        attention: v.optional(attentionFilterValidator),
        page: v.optional(v.number()),
        profile: v.optional(profileFilterValidator),
        search: v.optional(v.string()),
        status: v.optional(tenantStatusFilterValidator),
        tier: v.optional(tenantTierFilterValidator),
    },
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const accessResult = await verifyPlatformAdminDashboardReadAccessToken({
            scope: "tenant_list",
            token: args.accessToken,
            userId: String(authContext.userId),
        });

        if (!accessResult.ok) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message:
                    accessResult.reason === "expired"
                        ? "Platform admin tenant-list access expired. Retry to re-establish the audited read session."
                        : "Platform admin tenant-list access could not be verified.",
            });
        }

        const [
            tenants,
            tenantUsers,
            departments,
            subscriptionTiers,
            latestHealthSnapshot,
        ] = await Promise.all([
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

        return buildPlatformAdminTenantListSnapshot({
            departments: departments.map((department) => ({
                isActive: department.isActive,
                tenantId: String(department.tenantId),
            })),
            filters: normalizePlatformAdminTenantListFilters({
                attention: args.attention as PlatformAdminAttentionFilter | undefined,
                profile: args.profile as PlatformAdminProfileCompletionFilter | undefined,
                search: args.search,
                status: args.status as
                    | "all"
                    | PlatformAdminTenantStatus
                    | undefined,
                tier: args.tier as "all" | PlatformAdminTenantTier | undefined,
            }),
            healthSnapshot: latestHealthSnapshot
                ? {
                    capturedAt: latestHealthSnapshot.capturedAt,
                    summaryState: latestHealthSnapshot.summaryState,
                }
                : null,
            now: Date.now(),
            page: args.page ?? 1,
            pageSize: PLATFORM_ADMIN_TENANT_LIST_PAGE_SIZE,
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
                status: tenant.status,
                subdomain: tenant.subdomain,
                tier: tenant.tier,
            })),
        });
    },
});

export const issuePlatformAdminTenantListReadAccess = mutation({
    args: {},
    handler: async (ctx) => {
        const authContext = await requirePlatformAdmin(ctx);

        await Promise.all([
            auditPlatformAdminBypassRead(ctx, {
                action: "tenant_list_snapshot_read",
                entityType: "tenant",
                tableName: "tenants",
            }),
            auditPlatformAdminBypassRead(ctx, {
                action: "tenant_list_snapshot_read",
                entityType: "tenantUser",
                tableName: "tenantUsers",
            }),
            auditPlatformAdminBypassRead(ctx, {
                action: "tenant_list_snapshot_read",
                entityType: "department",
                tableName: "departments",
            }),
        ]);

        return await createPlatformAdminDashboardReadAccessToken({
            scope: "tenant_list",
            userId: String(authContext.userId),
        });
    },
});

export const checkTenantSubdomainAvailability = query({
    args: {
        subdomain: v.string(),
        tenantId: v.optional(v.id("tenants")),
    },
    returns: v.object({
        available: v.boolean(),
        message: v.string(),
        normalizedSubdomain: v.string(),
    }),
    handler: async (ctx, args) => {
        await requirePlatformAdmin(ctx);
        const normalizedSubdomain = normalizePlainText(args.subdomain).toLowerCase();
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
        const available =
            (!tenant || tenant._id === args.tenantId) &&
            (!redirect || redirect.tenantId === args.tenantId || redirect.expiresAt <= Date.now());

        return {
            available,
            message: available ? "Subdomain is available." : "Subdomain is already in use.",
            normalizedSubdomain,
        };
    },
});

export const provisionTenant = mutation({
    args: {
        organizationName: v.string(),
        subdomain: v.string(),
        tenantAdminEmail: v.string(),
    },
    returns: v.object({
        invitationId: v.id("tenantAdminInvitations"),
        inviteUrl: v.string(),
        tenantId: v.id("tenants"),
    }),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const organizationNameResult = validateOrganizationNameInput(args.organizationName);
        if (!organizationNameResult.ok) {
            validationError("organizationName", organizationNameResult.issue.message);
        }
        const emailResult = validateEmailInput(args.tenantAdminEmail, "tenantAdminEmail");
        if (!emailResult.ok) {
            validationError("tenantAdminEmail", emailResult.issue.message);
        }
        const subdomain = requireValidSubdomain(args.subdomain);
        await assertSubdomainAvailable(ctx, subdomain);

        let tenantId: Id<"tenants"> | undefined;
        try {
            const now = Date.now();
            tenantId = await ctx.db.insert("tenants", {
                name: organizationNameResult.value.normalized,
                subdomain,
                tier: "free",
                status: "active",
                profileComplete: false,
                primaryContactEmail: emailResult.value,
                storageLimitBytes: 1073741824,
                storageUsedBytes: 0,
                userLimit: 25,
                createdAt: now,
            });

            const invitation = await issueInvitationCore({
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
                event: AUDIT_EVENT_NAMES.tenantProvisioned,
                metadata: {
                    normalizedEmail: normalizeAuthEmail(args.tenantAdminEmail),
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
        } catch (error) {
            if (tenantId) {
                await ctx.db.patch(tenantId, {
                    status: "cancelled",
                    softDeletedAt: Date.now(),
                    softDeleteReason: "Provisioning failed before completion.",
                    purgeScheduledAt: Date.now(),
                });
            }
            await appendAuditLogBestEffort(ctx, {
                action: "provision",
                actor: createAuthenticatedAuditActor({
                    role: "platform_admin",
                    userId: String(authContext.userId),
                }),
                entityType: "tenant",
                event: AUDIT_EVENT_NAMES.tenantProvisioningFailed,
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

export const getTenantManagementDetail = query({
    args: { tenantId: v.id("tenants") },
    handler: async (ctx, args) => {
        await requirePlatformAdmin(ctx);
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

export const updateTenantSettings = mutation({
    args: {
        tenantId: v.id("tenants"),
        name: v.string(),
        primaryContactEmail: v.optional(v.string()),
        primaryContactName: v.optional(v.string()),
        primaryContactPhone: v.optional(v.string()),
        procurementBudgetCeiling: v.optional(v.number()),
        fiscalYearStartMonth: v.optional(v.number()),
        timeZone: v.optional(v.string()),
        storageLimitBytes: v.optional(v.number()),
        userLimit: v.optional(v.number()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant) {
            validationError("tenantId", "Tenant not found.");
        }
        const nameResult = validateOrganizationNameInput(args.name);
        if (!nameResult.ok) {
            validationError("name", nameResult.issue.message);
        }
        const email = args.primaryContactEmail
            ? validateEmailInput(args.primaryContactEmail, "primaryContactEmail")
            : undefined;
        if (email && !email.ok) {
            validationError("primaryContactEmail", email.issue.message);
        }
        await ctx.db.patch(args.tenantId, {
            name: nameResult.value.normalized,
            primaryContactEmail: email?.value,
            primaryContactName: args.primaryContactName ? assertPlainText(args.primaryContactName, "primaryContactName", "Contact name", 120) : undefined,
            primaryContactPhone: args.primaryContactPhone ? assertPlainText(args.primaryContactPhone, "primaryContactPhone", "Contact phone", 40) : undefined,
            procurementBudgetCeiling: args.procurementBudgetCeiling,
            fiscalYearStartMonth: args.fiscalYearStartMonth,
            timeZone: args.timeZone ? assertPlainText(args.timeZone, "timeZone", "Time zone", 80) : undefined,
            storageLimitBytes: args.storageLimitBytes,
            userLimit: args.userLimit,
        });
        await auditTenantChange({
            action: "update_settings",
            ctx,
            event: AUDIT_EVENT_NAMES.tenantSettingsUpdated,
            platformUserId: authContext.userId,
            recordId: String(args.tenantId),
            targetTenantId: args.tenantId,
        });
        return null;
    },
});

export const changeTenantSubdomain = mutation({
    args: {
        tenantId: v.id("tenants"),
        subdomain: v.string(),
        reason: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
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
                event: AUDIT_EVENT_NAMES.tenantSubdomainChanged,
                metadata: { fromSubdomain: tenant.subdomain, reason, toSubdomain: nextSubdomain },
                platformUserId: authContext.userId,
                recordId: String(args.tenantId),
                targetTenantId: args.tenantId,
            });
        }
        return null;
    },
});

export const updateTenantLifecycle = mutation({
    args: {
        tenantId: v.id("tenants"),
        action: v.union(v.literal("suspend"), v.literal("restore"), v.literal("delete")),
        reason: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
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
            await auditTenantChange({ action: "suspend", ctx, event: AUDIT_EVENT_NAMES.tenantLifecycleSuspended, metadata: { reason }, platformUserId: authContext.userId, recordId: String(args.tenantId), targetTenantId: args.tenantId });
        } else if (args.action === "restore") {
            await ctx.db.patch(args.tenantId, {
                status: "active",
                restoredAt: now,
                restoredByPlatformUserId: authContext.userId,
                restoreReason: reason,
            });
            await auditTenantChange({ action: "restore", ctx, event: AUDIT_EVENT_NAMES.tenantLifecycleRestored, metadata: { reason }, platformUserId: authContext.userId, recordId: String(args.tenantId), targetTenantId: args.tenantId });
        } else {
            await ctx.db.patch(args.tenantId, {
                status: "cancelled",
                softDeletedAt: now,
                softDeletedByPlatformUserId: authContext.userId,
                softDeleteReason: reason,
                purgeScheduledAt: now + softDeleteRetentionMs,
            });
            await auditTenantChange({ action: "soft_delete", ctx, event: AUDIT_EVENT_NAMES.tenantLifecycleDeleted, metadata: { reason, purgeScheduledAt: now + softDeleteRetentionMs }, platformUserId: authContext.userId, recordId: String(args.tenantId), targetTenantId: args.tenantId });
        }
        return null;
    },
});

export const createTenantOverride = mutation({
    args: {
        tenantId: v.id("tenants"),
        key: v.string(),
        value: v.string(),
        reason: v.string(),
        expiresAt: v.number(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
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
        await auditTenantChange({ action: "create_override", ctx, event: AUDIT_EVENT_NAMES.tenantOverrideCreated, metadata: { expiresAt: args.expiresAt, key: args.key }, platformUserId: authContext.userId, recordId: String(args.tenantId), targetTenantId: args.tenantId });
        return null;
    },
});

export const requestTenantDataExport = mutation({
    args: { tenantId: v.id("tenants") },
    returns: v.object({
        exportId: v.id("platformTenantDataExports"),
        downloadUrl: v.string(),
    }),
    handler: async (ctx, args) => {
        const authContext = await requirePlatformAdmin(ctx);
        if (!(await ctx.db.get(args.tenantId))) {
            validationError("tenantId", "Tenant not found.");
        }
        const now = Date.now();
        const exportId = await ctx.db.insert("platformTenantDataExports", {
            tenantId: args.tenantId,
            requestedByPlatformUserId: authContext.userId,
            status: "ready",
            downloadUrl: `/api/platform-admin/tenants/${String(args.tenantId)}/export/${now}.zip`,
            requestedAt: now,
            updatedAt: now,
            expiresAt: now + exportLinkRetentionMs,
        });
        await auditTenantChange({ action: "request_data_export", ctx, event: AUDIT_EVENT_NAMES.tenantDataExportRequested, outcome: "queued", platformUserId: authContext.userId, recordId: String(exportId), targetTenantId: args.tenantId });
        return {
            exportId,
            downloadUrl: `/api/platform-admin/tenants/${String(args.tenantId)}/export/${now}.zip`,
        };
    },
});
