"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getByIdForPlatformAdmin = exports.getById = exports.create = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const input_1 = require("../../lib/shared/security/input");
const _tenantGuard_1 = require("./_tenantGuard");
const tenantRecordValidator = values_1.v.object({
    _id: values_1.v.id("tenants"),
    _creationTime: values_1.v.number(),
    name: values_1.v.string(),
    subdomain: values_1.v.string(),
    tier: values_1.v.union(values_1.v.literal("free"), values_1.v.literal("starter"), values_1.v.literal("professional"), values_1.v.literal("enterprise")),
    status: values_1.v.union(values_1.v.literal("active"), values_1.v.literal("suspended"), values_1.v.literal("cancelled")),
    profileComplete: values_1.v.boolean(),
    primaryContactName: values_1.v.optional(values_1.v.string()),
    primaryContactEmail: values_1.v.optional(values_1.v.string()),
    primaryContactPhone: values_1.v.optional(values_1.v.string()),
    fiscalYearStartMonth: values_1.v.optional(values_1.v.number()),
    logoUrl: values_1.v.optional(values_1.v.string()),
    onboardingCompletedAt: values_1.v.optional(values_1.v.number()),
    createdAt: values_1.v.number(),
});
/**
 * Create a new tenant with Free tier status.
 * Validates subdomain uniqueness to prevent collisions.
 *
 * Internal-only: public tenant creation is handled through
 * `registerWithTenant` in `users.ts`, which authenticates the caller
 * and creates the tenant + tenantUser atomically.
 */
exports.create = (0, server_1.internalMutation)({
    args: {
        name: values_1.v.string(),
    },
    returns: values_1.v.id("tenants"),
    handler: async (ctx, args) => {
        const organizationNameResult = (0, input_1.validateOrganizationNameInput)(args.name);
        if (!organizationNameResult.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: organizationNameResult.issue.field,
                message: organizationNameResult.issue.message,
            });
        }
        const { normalized: trimmedName, subdomain, } = organizationNameResult.value;
        // Check subdomain uniqueness
        const existing = await ctx.db
            .query("tenants")
            .withIndex("by_subdomain", (q) => q.eq("subdomain", subdomain))
            .first();
        if (existing) {
            throw new values_1.ConvexError({
                code: "ALREADY_EXISTS",
                field: "organizationName",
                message: "An organization with this name already exists",
            });
        }
        const tenantId = await ctx.db.insert("tenants", {
            name: trimmedName,
            subdomain,
            tier: "free",
            status: "active",
            profileComplete: false,
            createdAt: Date.now(),
        });
        return tenantId;
    },
});
/**
 * Get tenant by ID for the current authenticated tenant user.
 *
 * Query-safe: enforces same-tenant isolation without writing audit events.
 * Cross-tenant probes return `null` (safe not-found semantics).
 */
exports.getById = (0, server_1.query)({
    args: { tenantId: values_1.v.id("tenants") },
    returns: values_1.v.union(tenantRecordValidator, values_1.v.null()),
    handler: async (ctx, args) => {
        const tenant = await (0, _tenantGuard_1.readTenantByIdForCurrentTenant)(ctx, args.tenantId);
        return tenant ? { ...tenant, profileComplete: tenant.profileComplete === true } : null;
    },
});
/** Read a tenant by ID through the explicit audited platform-admin bypass path */
exports.getByIdForPlatformAdmin = (0, server_1.mutation)({
    args: { tenantId: values_1.v.id("tenants") },
    returns: values_1.v.union(tenantRecordValidator, values_1.v.null()),
    handler: async (ctx, args) => {
        const tenant = await (0, _tenantGuard_1.readTenantByIdWithPlatformAdminBypass)(ctx, args.tenantId);
        return tenant ? { ...tenant, profileComplete: tenant.profileComplete === true } : null;
    },
});
