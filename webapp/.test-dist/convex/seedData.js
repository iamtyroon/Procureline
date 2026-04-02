"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapPlatformAdminByEmail = exports.removeDepartmentUserTenantRoleByEmail = exports.upsertPlatformAdminBootstrapRecords = exports.finalizePlatformAdminBootstrap = exports.getPlatformAdminBootstrapStateByEmail = exports.issueDepartmentAccessCodeForEmail = exports.clearDepartmentUserBudgetByEmail = exports.bootstrapDepartmentUserByEmail = exports.setDepartmentUserRoleByEmail = exports.listDepartmentsForUserEmail = exports.setTenantRoleByEmail = exports.removePlatformRoleForDevByEmail = exports.assignTenantRoleForDev = exports.listTenantsForDev = exports.inspectUserAccessByEmail = exports.listTenantRoleAssignments = exports.seedSubscriptionTiers = void 0;
const values_1 = require("convex/values");
const lucia_1 = require("lucia");
const server_1 = require("./_generated/server");
const department_user_access_1 = require("../lib/auth/department-user-access");
const departments_1 = require("../lib/procurement-officer/departments");
const input_1 = require("../lib/security/input");
function firstOrThrow(items, errorFactory) {
    const item = items[0];
    if (item === undefined) {
        throw errorFactory();
    }
    return item;
}
function validateBootstrapPassword(password) {
    const passwordLengthResult = (0, input_1.validatePasswordLength)(password);
    if (!passwordLengthResult.ok) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            message: passwordLengthResult.issue.message,
        });
    }
    if (password.length < input_1.PASSWORD_MIN_LENGTH) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            message: `Password must be at least ${input_1.PASSWORD_MIN_LENGTH} characters`,
        });
    }
    if (!input_1.PASSWORD_PATTERNS.uppercase.test(password)) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            message: "Password must contain at least one uppercase letter",
        });
    }
    if (!input_1.PASSWORD_PATTERNS.lowercase.test(password)) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            message: "Password must contain at least one lowercase letter",
        });
    }
    if (!input_1.PASSWORD_PATTERNS.digit.test(password)) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            message: "Password must contain at least one number",
        });
    }
    if (!input_1.PASSWORD_PATTERNS.special.test(password)) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            message: "Password must contain at least one special character",
        });
    }
    return password;
}
/**
 * Seed subscription tiers with initial data.
 * Idempotent — skips if tiers already exist.
 * Run via Convex dashboard or CLI: npx convex run seedData:seedSubscriptionTiers
 */
exports.seedSubscriptionTiers = (0, server_1.mutation)({
    args: {},
    handler: async (ctx) => {
        const existing = await ctx.db.query("subscriptionTiers").first();
        if (existing) {
            console.log("Tiers already seeded — skipping");
            return { seeded: false, message: "Tiers already exist" };
        }
        const tiers = [
            {
                tierName: "Free",
                slug: "free",
                priceUSD: 0,
                billingCycle: "annual",
                description: "Perfect for pilots and small departments",
                features: [
                    "10 departments",
                    "20 categories",
                    "50 items per category",
                    "Basic Blockly interface",
                    "Limited Excel export",
                    "Email support (48h response)",
                ],
                limits: {
                    departments: 10,
                    categories: 20,
                    itemsPerCategory: 50,
                    users: 5,
                    storage: "1GB",
                    apiAccess: false,
                    ssoLdap: false,
                },
                isPopular: false,
                displayOrder: 1,
                isActive: true,
            },
            {
                tierName: "Starter",
                slug: "starter",
                priceUSD: 3850,
                billingCycle: "annual",
                description: "For small to medium universities",
                features: [
                    "30 departments",
                    "60 categories",
                    "150 items per category",
                    "Full Blockly interface",
                    "Bulk import (100 rows)",
                    "Excel export (GOK templates)",
                    "Email support (24h response)",
                    "Quarterly compliance reports",
                ],
                limits: {
                    departments: 30,
                    categories: 60,
                    itemsPerCategory: 150,
                    users: 15,
                    storage: "10GB",
                    apiAccess: false,
                    ssoLdap: false,
                },
                isPopular: false,
                displayOrder: 2,
                isActive: true,
            },
            {
                tierName: "Professional",
                slug: "professional",
                priceUSD: 9230,
                billingCycle: "annual",
                description: "For large universities",
                features: [
                    "100 departments",
                    "200 categories",
                    "500 items per category",
                    "Advanced Blockly features",
                    "Unlimited bulk import",
                    "Custom Excel templates",
                    "Audit trail reports",
                    "Plan consolidation",
                    "Priority email support (12h response)",
                    "Monthly compliance reports",
                ],
                limits: {
                    departments: 100,
                    categories: 200,
                    itemsPerCategory: 500,
                    users: 50,
                    storage: "50GB",
                    apiAccess: true,
                    ssoLdap: false,
                },
                isPopular: true,
                displayOrder: 3,
                isActive: true,
            },
            {
                tierName: "Enterprise",
                slug: "enterprise",
                priceUSD: 18460,
                billingCycle: "annual",
                description: "For government agencies and consortiums",
                features: [
                    "Unlimited departments",
                    "Unlimited categories",
                    "Unlimited items",
                    "Custom Blockly blocks",
                    "API access",
                    "SSO/LDAP integration",
                    "Custom compliance rules",
                    "White-label options",
                    "Dedicated account manager",
                    "24/7 phone support",
                    "On-premise deployment option",
                ],
                limits: {
                    departments: "Unlimited",
                    categories: "Unlimited",
                    itemsPerCategory: "Unlimited",
                    users: "Unlimited",
                    storage: "Unlimited",
                    apiAccess: true,
                    ssoLdap: true,
                },
                isPopular: false,
                displayOrder: 4,
                isActive: true,
            },
        ];
        for (const tier of tiers) {
            await ctx.db.insert("subscriptionTiers", tier);
        }
        console.log("Seeded 4 subscription tiers");
        return { seeded: true, message: "Seeded 4 subscription tiers" };
    },
});
/**
 * List current tenant-scoped role assignments by email to help local/dev setup.
 * Run via CLI: npx convex run seedData:listTenantRoleAssignments
 */
exports.listTenantRoleAssignments = (0, server_1.query)({
    args: {},
    handler: async (ctx) => {
        const tenantUsers = await ctx.db.query("tenantUsers").collect();
        const users = await Promise.all(tenantUsers.map(async (tenantUser) => ({
            email: (await ctx.db.get(tenantUser.userId))?.email ??
                "unknown-email",
            role: tenantUser.role,
            tenantId: String(tenantUser.tenantId),
            tenantUserId: String(tenantUser._id),
            userId: String(tenantUser.userId),
            isActive: tenantUser.isActive,
        })));
        return users.sort((left, right) => left.email.localeCompare(right.email));
    },
});
/**
 * Inspect auth and role records for a single email to support local/dev access fixes.
 * Run via CLI:
 * npx convex run seedData:inspectUserAccessByEmail "{ email: 'you@example.com' }"
 */
exports.inspectUserAccessByEmail = (0, server_1.query)({
    args: {
        email: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();
        return await Promise.all(matchingUsers.map(async (user) => {
            const [tenantUsers, platformUsers, authAccounts] = await Promise.all([
                ctx.db
                    .query("tenantUsers")
                    .withIndex("by_userId", (q) => q.eq("userId", user._id))
                    .collect(),
                ctx.db
                    .query("platformUsers")
                    .withIndex("by_userId", (q) => q.eq("userId", user._id))
                    .collect(),
                ctx.db
                    .query("authAccounts")
                    .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id).eq("provider", "password"))
                    .collect(),
            ]);
            const tenantMemberships = await Promise.all(tenantUsers.map(async (tenantUser) => ({
                isActive: tenantUser.isActive,
                role: tenantUser.role,
                tenantId: String(tenantUser.tenantId),
                tenantName: (await ctx.db.get(tenantUser.tenantId))?.name ?? "Unknown tenant",
                tenantUserId: String(tenantUser._id),
            })));
            return {
                authAccounts: authAccounts.map((account) => ({
                    authAccountId: String(account._id),
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                })),
                email: user.email ?? normalizedEmail,
                name: typeof user.name === "string" && user.name.trim().length > 0
                    ? user.name.trim()
                    : null,
                platformRoles: platformUsers.map((platformUser) => ({
                    isActive: platformUser.isActive,
                    platformUserId: String(platformUser._id),
                })),
                tenantMemberships,
                userId: String(user._id),
            };
        }));
    },
});
/**
 * List tenants to support local/dev role attachment helpers.
 * Run via CLI:
 * npx convex run seedData:listTenantsForDev
 */
exports.listTenantsForDev = (0, server_1.query)({
    args: {},
    handler: async (ctx) => {
        const tenants = await ctx.db.query("tenants").collect();
        return tenants
            .map((tenant) => ({
            createdAt: tenant.createdAt,
            name: tenant.name,
            status: tenant.status,
            subdomain: tenant.subdomain,
            tenantId: String(tenant._id),
            tier: tenant.tier,
        }))
            .sort((left, right) => left.name.localeCompare(right.name));
    },
});
/**
 * Attach an existing auth account to a tenant role for local/dev validation.
 * To avoid mixed-role misconfiguration, active platform-admin roles are deactivated.
 *
 * Run via CLI:
 * npx convex run seedData:assignTenantRoleForDev "{ email: 'you@example.com', tenantId: '...', role: 'procurement_officer' }"
 */
exports.assignTenantRoleForDev = (0, server_1.mutation)({
    args: {
        email: values_1.v.string(),
        role: values_1.v.union(values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user")),
        tenantId: values_1.v.id("tenants"),
    },
    handler: async (ctx, args) => {
        const emailResult = (0, input_1.validateEmailInput)(args.email);
        if (!emailResult.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: emailResult.issue.message,
            });
        }
        const normalizedEmail = emailResult.value;
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();
        if (matchingUsers.length !== 1) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: `Expected exactly one auth user for ${normalizedEmail}.`,
            });
        }
        const tenant = await ctx.db.get(args.tenantId);
        if (!tenant || tenant.status !== "active") {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Target tenant not found or inactive.",
            });
        }
        const user = firstOrThrow(matchingUsers, () => new values_1.ConvexError({
            code: "NOT_FOUND",
            message: `No auth user found for ${normalizedEmail}.`,
        }));
        const [tenantUsers, platformUsers] = await Promise.all([
            ctx.db
                .query("tenantUsers")
                .withIndex("by_userId", (q) => q.eq("userId", user._id))
                .collect(),
            ctx.db
                .query("platformUsers")
                .withIndex("by_userId", (q) => q.eq("userId", user._id))
                .collect(),
        ]);
        for (const platformUser of platformUsers) {
            if (!platformUser.isActive) {
                continue;
            }
            await ctx.db.patch(platformUser._id, {
                isActive: false,
            });
        }
        for (const tenantUser of tenantUsers) {
            if (tenantUser.tenantId === args.tenantId) {
                await ctx.db.patch(tenantUser._id, {
                    isActive: true,
                    role: args.role,
                });
                return {
                    deactivatedPlatformRoles: platformUsers.filter((platformUser) => platformUser.isActive)
                        .length,
                    email: normalizedEmail,
                    role: args.role,
                    tenantId: String(args.tenantId),
                    tenantName: tenant.name,
                    tenantUserId: String(tenantUser._id),
                    userId: String(user._id),
                };
            }
        }
        const tenantUserId = await ctx.db.insert("tenantUsers", {
            isActive: true,
            role: args.role,
            tenantId: args.tenantId,
            userId: user._id,
        });
        return {
            deactivatedPlatformRoles: platformUsers.filter((platformUser) => platformUser.isActive)
                .length,
            email: normalizedEmail,
            role: args.role,
            tenantId: String(args.tenantId),
            tenantName: tenant.name,
            tenantUserId: String(tenantUserId),
            userId: String(user._id),
        };
    },
});
/**
 * Remove platform-admin role records for a local/dev account so a tenant role can resolve cleanly.
 * Run via CLI:
 * npx convex run seedData:removePlatformRoleForDevByEmail "{ email: 'you@example.com' }"
 */
exports.removePlatformRoleForDevByEmail = (0, server_1.mutation)({
    args: {
        email: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const emailResult = (0, input_1.validateEmailInput)(args.email);
        if (!emailResult.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: emailResult.issue.message,
            });
        }
        const normalizedEmail = emailResult.value;
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();
        if (matchingUsers.length !== 1) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: `Expected exactly one auth user for ${normalizedEmail}.`,
            });
        }
        const user = firstOrThrow(matchingUsers, () => new values_1.ConvexError({
            code: "NOT_FOUND",
            message: `No auth user found for ${normalizedEmail}.`,
        }));
        const platformUsers = await ctx.db
            .query("platformUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        for (const platformUser of platformUsers) {
            await ctx.db.delete(platformUser._id);
        }
        return {
            email: normalizedEmail,
            removedPlatformRoles: platformUsers.length,
            userId: String(user._id),
        };
    },
});
/**
 * Update an existing tenant-scoped account to a different role for local/dev validation.
 * This intentionally only works when the user has exactly one active tenant role.
 * Run via CLI:
 * npx convex run seedData:setTenantRoleByEmail "{\"email\":\"you@example.com\",\"role\":\"procurement_officer\"}"
 */
exports.setTenantRoleByEmail = (0, server_1.mutation)({
    args: {
        email: values_1.v.string(),
        role: values_1.v.union(values_1.v.literal("tenant_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("department_user")),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();
        if (matchingUsers.length === 0) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: `No auth user found for ${normalizedEmail}.`,
            });
        }
        if (matchingUsers.length > 1) {
            throw new values_1.ConvexError({
                code: "DATA_INTEGRITY_ERROR",
                message: `Multiple auth users found for ${normalizedEmail}.`,
            });
        }
        const user = firstOrThrow(matchingUsers, () => new values_1.ConvexError({
            code: "NOT_FOUND",
            message: `No auth user found for ${normalizedEmail}.`,
        }));
        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        const activeTenantUsers = tenantUsers.filter((tenantUser) => tenantUser.isActive);
        if (activeTenantUsers.length !== 1) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "This helper requires exactly one active tenant role for the target user.",
            });
        }
        const activeTenantUser = firstOrThrow(activeTenantUsers, () => new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            message: "This helper requires exactly one active tenant role for the target user.",
        }));
        await ctx.db.patch(activeTenantUser._id, {
            role: args.role,
        });
        return {
            email: normalizedEmail,
            previousRole: activeTenantUser.role,
            role: args.role,
            tenantId: String(activeTenantUser.tenantId),
            tenantUserId: String(activeTenantUser._id),
        };
    },
});
/**
 * List departments for a tenant-scoped user email to support local role/profile setup.
 * Run via CLI:
 * npx convex run seedData:listDepartmentsForUserEmail "{\"email\":\"you@example.com\"}"
 */
exports.listDepartmentsForUserEmail = (0, server_1.query)({
    args: {
        email: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();
        if (matchingUsers.length !== 1) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: `Expected exactly one auth user for ${normalizedEmail}.`,
            });
        }
        const user = firstOrThrow(matchingUsers, () => new values_1.ConvexError({
            code: "NOT_FOUND",
            message: `No auth user found for ${normalizedEmail}.`,
        }));
        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        const activeTenantUsers = tenantUsers.filter((tenantUser) => tenantUser.isActive);
        if (activeTenantUsers.length !== 1) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "This helper requires exactly one active tenant role for the target user.",
            });
        }
        const activeTenantUser = firstOrThrow(activeTenantUsers, () => new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            message: "This helper requires exactly one active tenant role for the target user.",
        }));
        const departments = await ctx.db
            .query("departments")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", activeTenantUser.tenantId))
            .collect();
        return departments
            .filter((department) => department.isActive)
            .sort((left, right) => left.name.localeCompare(right.name))
            .map((department) => ({
            code: department.code,
            departmentId: String(department._id),
            name: department.name,
            submissionEndsAt: department.submissionEndsAt,
            submissionStartsAt: department.submissionStartsAt,
            tenantId: String(department.tenantId),
        }));
    },
});
/**
 * Switch a tenant-scoped account into Department User role and attach/create its department profile.
 * Run via CLI:
 * npx convex run seedData:setDepartmentUserRoleByEmail "{\"email\":\"you@example.com\",\"departmentId\":\"...\"}"
 */
exports.setDepartmentUserRoleByEmail = (0, server_1.mutation)({
    args: {
        departmentId: values_1.v.id("departments"),
        email: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();
        if (matchingUsers.length !== 1) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: `Expected exactly one auth user for ${normalizedEmail}.`,
            });
        }
        const user = firstOrThrow(matchingUsers, () => new values_1.ConvexError({
            code: "NOT_FOUND",
            message: `No auth user found for ${normalizedEmail}.`,
        }));
        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        const activeTenantUsers = tenantUsers.filter((tenantUser) => tenantUser.isActive);
        if (activeTenantUsers.length !== 1) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "This helper requires exactly one active tenant role for the target user.",
            });
        }
        const activeTenantUser = firstOrThrow(activeTenantUsers, () => new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            message: "This helper requires exactly one active tenant role for the target user.",
        }));
        const department = await ctx.db.get(args.departmentId);
        if (!department || !department.isActive) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Department not found or inactive.",
            });
        }
        if (department.tenantId !== activeTenantUser.tenantId) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "Department must belong to the same tenant as the user.",
            });
        }
        await ctx.db.patch(activeTenantUser._id, {
            role: "department_user",
        });
        const existingProfile = await ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", activeTenantUser._id))
            .first();
        const now = Date.now();
        if (existingProfile) {
            await ctx.db.patch(existingProfile._id, {
                deactivatedAt: undefined,
                departmentId: args.departmentId,
                isActive: true,
                normalizedEmail,
                updatedAt: now,
            });
        }
        else {
            await ctx.db.insert("departmentUserProfiles", {
                createdAt: now,
                departmentId: args.departmentId,
                isActive: true,
                normalizedEmail,
                tenantId: activeTenantUser.tenantId,
                tenantUserId: activeTenantUser._id,
                updatedAt: now,
            });
        }
        return {
            departmentCode: department.code,
            departmentId: String(department._id),
            departmentName: department.name,
            email: normalizedEmail,
            role: "department_user",
            tenantId: String(activeTenantUser.tenantId),
            tenantUserId: String(activeTenantUser._id),
        };
    },
});
/**
 * Create a minimal DU-ready department for a tenant user and switch that account to department_user.
 * Run via CLI:
 * npx convex run seedData:bootstrapDepartmentUserByEmail "{ email: 'you@example.com' }"
 */
exports.bootstrapDepartmentUserByEmail = (0, server_1.mutation)({
    args: {
        budgetAllocation: values_1.v.optional(values_1.v.number()),
        departmentCode: values_1.v.optional(values_1.v.string()),
        departmentName: values_1.v.optional(values_1.v.string()),
        email: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();
        if (matchingUsers.length !== 1) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: `Expected exactly one auth user for ${normalizedEmail}.`,
            });
        }
        const user = firstOrThrow(matchingUsers, () => new values_1.ConvexError({
            code: "NOT_FOUND",
            message: `No auth user found for ${normalizedEmail}.`,
        }));
        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        const activeTenantUsers = tenantUsers.filter((tenantUser) => tenantUser.isActive);
        if (activeTenantUsers.length !== 1) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "This helper requires exactly one active tenant role for the target user.",
            });
        }
        const activeTenantUser = firstOrThrow(activeTenantUsers, () => new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            message: "This helper requires exactly one active tenant role for the target user.",
        }));
        const now = Date.now();
        const departmentName = args.departmentName?.trim() || "Manual DU Verification Department";
        const departmentCode = args.departmentCode?.trim().toUpperCase() || "DU-MANUAL-VERIFY";
        const budgetAllocation = args.budgetAllocation;
        const submissionStartsAt = now - 2 * 24 * 60 * 60 * 1000;
        const submissionEndsAt = now + 14 * 24 * 60 * 60 * 1000;
        const normalizedDepartmentCode = (0, departments_1.normalizeDepartmentCode)(departmentCode);
        const normalizedDepartmentName = (0, departments_1.normalizeDepartmentName)(departmentName);
        const existingDepartment = await ctx.db
            .query("departments")
            .withIndex("by_tenantId_normalizedCode", (q) => q.eq("tenantId", activeTenantUser.tenantId).eq("normalizedCode", normalizedDepartmentCode))
            .first();
        const departmentId = existingDepartment?._id ??
            (await ctx.db.insert("departments", {
                code: normalizedDepartmentCode,
                createdAt: now,
                isActive: true,
                name: departmentName,
                normalizedCode: normalizedDepartmentCode,
                normalizedName: normalizedDepartmentName,
                procurementOfficerTenantUserId: activeTenantUser._id,
                submissionEndsAt,
                submissionStartsAt,
                tenantId: activeTenantUser.tenantId,
                updatedAt: now,
                ...(typeof budgetAllocation === "number" ? { budgetAllocation } : {}),
            }));
        await ctx.db.patch(activeTenantUser._id, {
            role: "department_user",
        });
        const existingProfile = await ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", activeTenantUser._id))
            .first();
        if (existingProfile) {
            await ctx.db.patch(existingProfile._id, {
                deactivatedAt: undefined,
                departmentId,
                isActive: true,
                normalizedEmail,
                updatedAt: now,
            });
        }
        else {
            await ctx.db.insert("departmentUserProfiles", {
                createdAt: now,
                departmentId,
                isActive: true,
                normalizedEmail,
                tenantId: activeTenantUser.tenantId,
                tenantUserId: activeTenantUser._id,
                updatedAt: now,
            });
        }
        return {
            budgetAllocation,
            departmentCode,
            departmentId: String(departmentId),
            departmentName,
            email: normalizedEmail,
            role: "department_user",
            submissionEndsAt,
            submissionStartsAt,
            tenantId: String(activeTenantUser.tenantId),
            tenantUserId: String(activeTenantUser._id),
        };
    },
});
/**
 * Clear the seeded DU budget allocation so the dashboard falls back to truthful empty-state dashes.
 * Run via CLI:
 * npx convex run seedData:clearDepartmentUserBudgetByEmail "{ email: 'you@example.com' }"
 */
exports.clearDepartmentUserBudgetByEmail = (0, server_1.mutation)({
    args: {
        email: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();
        if (matchingUsers.length !== 1) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: `Expected exactly one auth user for ${normalizedEmail}.`,
            });
        }
        const user = firstOrThrow(matchingUsers, () => new values_1.ConvexError({
            code: "NOT_FOUND",
            message: `No auth user found for ${normalizedEmail}.`,
        }));
        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        const activeTenantUser = tenantUsers.find((tenantUser) => tenantUser.isActive);
        if (!activeTenantUser) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "No active tenant role found for the target user.",
            });
        }
        const profile = await ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", activeTenantUser._id))
            .first();
        if (!profile || !profile.isActive) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "The target user does not have an active department profile.",
            });
        }
        const department = await ctx.db.get(profile.departmentId);
        if (!department || !department.isActive) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Active department not found for the target user.",
            });
        }
        const now = Date.now();
        await ctx.db.patch(department._id, {
            budgetAllocation: undefined,
            updatedAt: now,
        });
        return {
            cleared: true,
            departmentCode: department.code,
            departmentId: String(department._id),
            departmentName: department.name,
            email: normalizedEmail,
            updatedAt: now,
        };
    },
});
/**
 * Issue a fresh DU access code for an already-linked department user account.
 * Run via CLI:
 * npx convex run seedData:issueDepartmentAccessCodeForEmail "{ email: 'you@example.com', accessCode: 'DU-VERIFY-2026' }"
 */
exports.issueDepartmentAccessCodeForEmail = (0, server_1.mutation)({
    args: {
        accessCode: values_1.v.string(),
        email: values_1.v.string(),
        expiresAt: values_1.v.optional(values_1.v.number()),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const normalizedAccessCode = (0, department_user_access_1.normalizeDepartmentUserAccessCode)(args.accessCode);
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();
        if (matchingUsers.length !== 1) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: `Expected exactly one auth user for ${normalizedEmail}.`,
            });
        }
        const user = firstOrThrow(matchingUsers, () => new values_1.ConvexError({
            code: "NOT_FOUND",
            message: `No auth user found for ${normalizedEmail}.`,
        }));
        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        const activeTenantUser = tenantUsers.find((tenantUser) => tenantUser.isActive);
        if (!activeTenantUser) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "No active tenant role found for the target user.",
            });
        }
        const profile = await ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", activeTenantUser._id))
            .first();
        if (!profile || !profile.isActive) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "The target user does not have an active department profile.",
            });
        }
        const department = await ctx.db.get(profile.departmentId);
        if (!department || !department.isActive) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Active department not found for the target user.",
            });
        }
        const now = Date.now();
        const codeHash = await (0, department_user_access_1.hashDepartmentUserAccessCode)(normalizedAccessCode);
        const existingCodes = await ctx.db
            .query("departmentAccessCodes")
            .withIndex("by_departmentId", (q) => q.eq("departmentId", department._id))
            .collect();
        for (const existingCode of existingCodes) {
            if (existingCode.isActive) {
                await ctx.db.patch(existingCode._id, {
                    isActive: false,
                    updatedAt: now,
                });
            }
        }
        const expiresAt = args.expiresAt ?? now + 30 * 24 * 60 * 60 * 1000;
        const accessCodeId = await ctx.db.insert("departmentAccessCodes", {
            codeHash,
            codeSuffix: (0, department_user_access_1.getDepartmentUserAccessCodeSuffix)(normalizedAccessCode),
            createdAt: now,
            departmentId: department._id,
            expiresAt,
            isActive: true,
            tenantId: department.tenantId,
            updatedAt: now,
        });
        return {
            accessCode: normalizedAccessCode,
            accessCodeId: String(accessCodeId),
            departmentCode: department.code,
            departmentId: String(department._id),
            departmentName: department.name,
            email: normalizedEmail,
            expiresAt,
        };
    },
});
/**
 * Inspect the current account state for a potential platform-admin bootstrap email.
 * Run via CLI:
 * PowerShell:
 * npx convex run seedData:getPlatformAdminBootstrapStateByEmail "{ email: 'platform.admin@example.com' }"
 */
exports.getPlatformAdminBootstrapStateByEmail = (0, server_1.query)({
    args: {
        email: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const emailResult = (0, input_1.validateEmailInput)(args.email);
        if (!emailResult.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: emailResult.issue.message,
            });
        }
        const normalizedEmail = emailResult.value;
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();
        const passwordAccounts = await ctx.db
            .query("authAccounts")
            .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", normalizedEmail))
            .collect();
        const passwordAccount = passwordAccounts.length === 1
            ? firstOrThrow(passwordAccounts, () => new values_1.ConvexError({
                code: "DATA_INTEGRITY_ERROR",
                message: "Expected a single password account record.",
            }))
            : null;
        const matchingUser = matchingUsers.length === 1 ? matchingUsers[0] : null;
        const platformUsers = matchingUser
            ? await ctx.db
                .query("platformUsers")
                .withIndex("by_userId", (q) => q.eq("userId", matchingUser._id))
                .collect()
            : [];
        const tenantUsers = matchingUser
            ? await ctx.db
                .query("tenantUsers")
                .withIndex("by_userId", (q) => q.eq("userId", matchingUser._id))
                .collect()
            : [];
        return {
            email: normalizedEmail,
            hasActivePlatformRole: platformUsers.some((platformUser) => platformUser.isActive),
            hasActiveTenantRole: tenantUsers.some((tenantUser) => tenantUser.isActive),
            hasPasswordAccount: passwordAccount !== null,
            passwordAccountId: passwordAccount ? String(passwordAccount._id) : null,
            passwordAccountCount: passwordAccounts.length,
            platformRoleCount: platformUsers.length,
            tenantRoleCount: tenantUsers.length,
            userCount: matchingUsers.length,
            userEmailVerified: matchingUser?.emailVerificationTime !== undefined,
            userId: matchingUser ? String(matchingUser._id) : null,
        };
    },
});
exports.finalizePlatformAdminBootstrap = (0, server_1.mutation)({
    args: {
        accountId: values_1.v.id("authAccounts"),
        email: values_1.v.string(),
        isActive: values_1.v.boolean(),
        name: values_1.v.optional(values_1.v.string()),
        userId: values_1.v.id("users"),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const user = await ctx.db.get(args.userId);
        const account = await ctx.db.get(args.accountId);
        if (!user || !account) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "The bootstrapped auth user could not be resolved.",
            });
        }
        if (account.userId !== args.userId) {
            throw new values_1.ConvexError({
                code: "DATA_INTEGRITY_ERROR",
                message: "Password account is linked to a different user.",
            });
        }
        const [platformUsers, tenantUsers] = await Promise.all([
            ctx.db
                .query("platformUsers")
                .withIndex("by_userId", (q) => q.eq("userId", args.userId))
                .collect(),
            ctx.db
                .query("tenantUsers")
                .withIndex("by_userId", (q) => q.eq("userId", args.userId))
                .collect(),
        ]);
        if (tenantUsers.length > 0) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "This email already has a tenant-scoped role assignment. Platform Admin bootstrap requires a clean global-only account.",
            });
        }
        if (platformUsers.length > 1) {
            throw new values_1.ConvexError({
                code: "DATA_INTEGRITY_ERROR",
                message: "Multiple platform role records already exist for this user.",
            });
        }
        await ctx.db.patch(args.userId, {
            email: normalizedEmail,
            emailVerificationTime: user.emailVerificationTime ?? Date.now(),
            ...(args.name ? { name: args.name } : {}),
        });
        await ctx.db.patch(args.accountId, {
            emailVerified: normalizedEmail,
        });
        if (platformUsers.length === 1) {
            const existingPlatformUser = firstOrThrow(platformUsers, () => new values_1.ConvexError({
                code: "DATA_INTEGRITY_ERROR",
                message: "Expected an existing platform role record.",
            }));
            await ctx.db.patch(existingPlatformUser._id, {
                isActive: args.isActive,
            });
            return {
                email: normalizedEmail,
                platformUserId: String(existingPlatformUser._id),
                userId: String(args.userId),
            };
        }
        const platformUserId = await ctx.db.insert("platformUsers", {
            userId: args.userId,
            isActive: args.isActive,
            createdAt: Date.now(),
        });
        return {
            email: normalizedEmail,
            platformUserId: String(platformUserId),
            userId: String(args.userId),
        };
    },
});
exports.upsertPlatformAdminBootstrapRecords = (0, server_1.mutation)({
    args: {
        email: values_1.v.string(),
        isActive: values_1.v.boolean(),
        name: values_1.v.optional(values_1.v.string()),
        secretHash: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();
        const passwordAccounts = await ctx.db
            .query("authAccounts")
            .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", normalizedEmail))
            .collect();
        if (matchingUsers.length > 1 || passwordAccounts.length > 1) {
            throw new values_1.ConvexError({
                code: "DATA_INTEGRITY_ERROR",
                message: "Multiple auth records already exist for this email. Clean up the duplicate records before bootstrapping Platform Admin access.",
            });
        }
        let user = matchingUsers.length === 1 ? matchingUsers[0] : null;
        const passwordAccount = passwordAccounts.length === 1
            ? firstOrThrow(passwordAccounts, () => new values_1.ConvexError({
                code: "DATA_INTEGRITY_ERROR",
                message: "Expected a single password account record.",
            }))
            : null;
        if (!user) {
            const userId = await ctx.db.insert("users", {
                email: normalizedEmail,
                emailVerificationTime: Date.now(),
                ...(args.name ? { name: args.name } : {}),
            });
            user = await ctx.db.get(userId);
        }
        else {
            await ctx.db.patch(user._id, {
                email: normalizedEmail,
                emailVerificationTime: user.emailVerificationTime ?? Date.now(),
                ...(args.name ? { name: args.name } : {}),
            });
            user = await ctx.db.get(user._id);
        }
        if (!user) {
            throw new values_1.ConvexError({
                code: "INVALID_STATE",
                message: "Platform Admin bootstrap user could not be created.",
            });
        }
        const [platformUsers, tenantUsers] = await Promise.all([
            ctx.db
                .query("platformUsers")
                .withIndex("by_userId", (q) => q.eq("userId", user._id))
                .collect(),
            ctx.db
                .query("tenantUsers")
                .withIndex("by_userId", (q) => q.eq("userId", user._id))
                .collect(),
        ]);
        if (tenantUsers.length > 0) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "This email already belongs to a tenant-scoped account. Use a fresh email for Platform Admin review.",
            });
        }
        let accountId = passwordAccount?._id;
        if (passwordAccount) {
            await ctx.db.patch(passwordAccount._id, {
                emailVerified: normalizedEmail,
                secret: args.secretHash,
                userId: user._id,
            });
        }
        else {
            accountId = await ctx.db.insert("authAccounts", {
                userId: user._id,
                provider: "password",
                providerAccountId: normalizedEmail,
                secret: args.secretHash,
                emailVerified: normalizedEmail,
            });
        }
        if (platformUsers.length > 1) {
            throw new values_1.ConvexError({
                code: "DATA_INTEGRITY_ERROR",
                message: "Multiple platform role records already exist for this user.",
            });
        }
        let platformUserId = platformUsers[0]?._id;
        if (platformUsers.length === 1) {
            const existingPlatformUser = firstOrThrow(platformUsers, () => new values_1.ConvexError({
                code: "DATA_INTEGRITY_ERROR",
                message: "Expected an existing platform role record.",
            }));
            await ctx.db.patch(existingPlatformUser._id, {
                isActive: args.isActive,
            });
            platformUserId = existingPlatformUser._id;
        }
        else {
            platformUserId = await ctx.db.insert("platformUsers", {
                userId: user._id,
                isActive: args.isActive,
                createdAt: Date.now(),
            });
        }
        return {
            accountId: String(accountId),
            createdAuthAccount: passwordAccount === null,
            email: normalizedEmail,
            passwordUpdated: passwordAccount !== null,
            platformUserId: String(platformUserId),
            userId: String(user._id),
        };
    },
});
/**
 * Remove a single department-user tenant membership so the same verified login
 * can be converted into a platform-admin account during local/manual review.
 *
 * PowerShell:
 * npx convex run seedData:removeDepartmentUserTenantRoleByEmail "{ email: 'iamtyroon@gmail.com' }"
 */
exports.removeDepartmentUserTenantRoleByEmail = (0, server_1.mutation)({
    args: {
        email: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const emailResult = (0, input_1.validateEmailInput)(args.email);
        if (!emailResult.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: emailResult.issue.message,
            });
        }
        const normalizedEmail = emailResult.value;
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();
        if (matchingUsers.length !== 1) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: `Expected exactly one auth user for ${normalizedEmail}.`,
            });
        }
        const user = firstOrThrow(matchingUsers, () => new values_1.ConvexError({
            code: "NOT_FOUND",
            message: `No auth user found for ${normalizedEmail}.`,
        }));
        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        if (tenantUsers.length !== 1) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "This helper requires exactly one tenant membership for the target user.",
            });
        }
        const tenantUser = firstOrThrow(tenantUsers, () => new values_1.ConvexError({
            code: "NOT_FOUND",
            message: `No tenant membership found for ${normalizedEmail}.`,
        }));
        if (tenantUser.role !== "department_user") {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "This conversion helper only supports department-user accounts.",
            });
        }
        const profile = await ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", tenantUser._id))
            .first();
        if (profile) {
            await ctx.db.delete(profile._id);
        }
        await ctx.db.delete(tenantUser._id);
        return {
            email: normalizedEmail,
            removedDepartmentProfile: profile ? String(profile._id) : null,
            removedTenantRole: tenantUser.role,
            removedTenantUserId: String(tenantUser._id),
            userId: String(user._id),
        };
    },
});
/**
 * Create or reset a local password account and assign the global Platform Admin role.
 * This bypasses the public tenant signup flow on purpose so Story 2.1 can be reviewed
 * without first creating a tenant-admin account.
 *
 * Run via CLI:
 * PowerShell:
 * npx convex run seedData:bootstrapPlatformAdminByEmail "{ email: 'platform.admin@example.com', password: 'StrongPass123!', name: 'Platform Admin' }"
 */
exports.bootstrapPlatformAdminByEmail = (0, server_1.action)({
    args: {
        email: values_1.v.string(),
        isActive: values_1.v.optional(values_1.v.boolean()),
        name: values_1.v.optional(values_1.v.string()),
        password: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const emailResult = (0, input_1.validateEmailInput)(args.email);
        if (!emailResult.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: emailResult.issue.message,
            });
        }
        const normalizedEmail = emailResult.value;
        const normalizedPassword = validateBootstrapPassword(args.password);
        const normalizedName = args.name?.trim() || undefined;
        const secretHash = await new lucia_1.Scrypt().hash(normalizedPassword);
        const finalized = await ctx.runMutation("seedData:upsertPlatformAdminBootstrapRecords", {
            email: normalizedEmail,
            isActive: args.isActive ?? true,
            name: normalizedName,
            secretHash,
        });
        return {
            createdAuthAccount: finalized.createdAuthAccount,
            email: normalizedEmail,
            loginPath: "/platform-admin/login",
            passwordUpdated: finalized.passwordUpdated,
            platformUserId: finalized.platformUserId,
            userId: finalized.userId,
        };
    },
});
