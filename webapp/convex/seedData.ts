import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
    getDepartmentUserAccessCodeSuffix,
    hashDepartmentUserAccessCode,
    normalizeDepartmentUserAccessCode,
} from "../lib/auth/department-user-access";

function firstOrThrow<T>(items: readonly T[], errorFactory: () => Error): T {
    const item = items[0];
    if (item === undefined) {
        throw errorFactory();
    }

    return item;
}

/**
 * Seed subscription tiers with initial data.
 * Idempotent — skips if tiers already exist.
 * Run via Convex dashboard or CLI: npx convex run seedData:seedSubscriptionTiers
 */
export const seedSubscriptionTiers = mutation({
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
                    departments: 10 as number | string,
                    categories: 20 as number | string,
                    itemsPerCategory: 50 as number | string,
                    users: 5 as number | string,
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
                    departments: 30 as number | string,
                    categories: 60 as number | string,
                    itemsPerCategory: 150 as number | string,
                    users: 15 as number | string,
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
                    departments: 100 as number | string,
                    categories: 200 as number | string,
                    itemsPerCategory: 500 as number | string,
                    users: 50 as number | string,
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
                    departments: "Unlimited" as number | string,
                    categories: "Unlimited" as number | string,
                    itemsPerCategory: "Unlimited" as number | string,
                    users: "Unlimited" as number | string,
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
export const listTenantRoleAssignments = query({
    args: {},
    handler: async (ctx) => {
        const tenantUsers = await ctx.db.query("tenantUsers").collect();
        const users = await Promise.all(
            tenantUsers.map(async (tenantUser) => ({
                email:
                    (await ctx.db.get(tenantUser.userId))?.email ??
                    "unknown-email",
                role: tenantUser.role,
                tenantId: String(tenantUser.tenantId),
                tenantUserId: String(tenantUser._id),
                userId: String(tenantUser.userId),
                isActive: tenantUser.isActive,
            })),
        );

        return users.sort((left, right) => left.email.localeCompare(right.email));
    },
});

/**
 * Update an existing tenant-scoped account to a different role for local/dev validation.
 * This intentionally only works when the user has exactly one active tenant role.
 * Run via CLI:
 * npx convex run seedData:setTenantRoleByEmail "{\"email\":\"you@example.com\",\"role\":\"procurement_officer\"}"
 */
export const setTenantRoleByEmail = mutation({
    args: {
        email: v.string(),
        role: v.union(
            v.literal("tenant_admin"),
            v.literal("procurement_officer"),
            v.literal("department_user"),
        ),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();

        if (matchingUsers.length === 0) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: `No auth user found for ${normalizedEmail}.`,
            });
        }

        if (matchingUsers.length > 1) {
            throw new ConvexError({
                code: "DATA_INTEGRITY_ERROR",
                message: `Multiple auth users found for ${normalizedEmail}.`,
            });
        }

        const user = firstOrThrow(matchingUsers, () =>
            new ConvexError({
                code: "NOT_FOUND",
                message: `No auth user found for ${normalizedEmail}.`,
            }),
        );

        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        const activeTenantUsers = tenantUsers.filter((tenantUser) => tenantUser.isActive);

        if (activeTenantUsers.length !== 1) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    "This helper requires exactly one active tenant role for the target user.",
            });
        }

        const activeTenantUser = firstOrThrow(activeTenantUsers, () =>
            new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    "This helper requires exactly one active tenant role for the target user.",
            }),
        );

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
export const listDepartmentsForUserEmail = query({
    args: {
        email: v.string(),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();

        if (matchingUsers.length !== 1) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: `Expected exactly one auth user for ${normalizedEmail}.`,
            });
        }

        const user = firstOrThrow(matchingUsers, () =>
            new ConvexError({
                code: "NOT_FOUND",
                message: `No auth user found for ${normalizedEmail}.`,
            }),
        );

        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        const activeTenantUsers = tenantUsers.filter((tenantUser) => tenantUser.isActive);

        if (activeTenantUsers.length !== 1) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    "This helper requires exactly one active tenant role for the target user.",
            });
        }

        const activeTenantUser = firstOrThrow(activeTenantUsers, () =>
            new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    "This helper requires exactly one active tenant role for the target user.",
            }),
        );

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
export const setDepartmentUserRoleByEmail = mutation({
    args: {
        departmentId: v.id("departments"),
        email: v.string(),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();

        if (matchingUsers.length !== 1) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: `Expected exactly one auth user for ${normalizedEmail}.`,
            });
        }

        const user = firstOrThrow(matchingUsers, () =>
            new ConvexError({
                code: "NOT_FOUND",
                message: `No auth user found for ${normalizedEmail}.`,
            }),
        );

        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        const activeTenantUsers = tenantUsers.filter((tenantUser) => tenantUser.isActive);

        if (activeTenantUsers.length !== 1) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    "This helper requires exactly one active tenant role for the target user.",
            });
        }

        const activeTenantUser = firstOrThrow(activeTenantUsers, () =>
            new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    "This helper requires exactly one active tenant role for the target user.",
            }),
        );

        const department = await ctx.db.get(args.departmentId);
        if (!department || !department.isActive) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: "Department not found or inactive.",
            });
        }

        if (department.tenantId !== activeTenantUser.tenantId) {
            throw new ConvexError({
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
        } else {
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
export const bootstrapDepartmentUserByEmail = mutation({
    args: {
        budgetAllocation: v.optional(v.number()),
        departmentCode: v.optional(v.string()),
        departmentName: v.optional(v.string()),
        email: v.string(),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();

        if (matchingUsers.length !== 1) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: `Expected exactly one auth user for ${normalizedEmail}.`,
            });
        }

        const user = firstOrThrow(matchingUsers, () =>
            new ConvexError({
                code: "NOT_FOUND",
                message: `No auth user found for ${normalizedEmail}.`,
            }),
        );

        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        const activeTenantUsers = tenantUsers.filter((tenantUser) => tenantUser.isActive);

        if (activeTenantUsers.length !== 1) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    "This helper requires exactly one active tenant role for the target user.",
            });
        }

        const activeTenantUser = firstOrThrow(activeTenantUsers, () =>
            new ConvexError({
                code: "VALIDATION_FAILED",
                message:
                    "This helper requires exactly one active tenant role for the target user.",
            }),
        );

        const now = Date.now();
        const departmentName =
            args.departmentName?.trim() || "Manual DU Verification Department";
        const departmentCode =
            args.departmentCode?.trim().toUpperCase() || "DU-MANUAL-VERIFY";
        const budgetAllocation = args.budgetAllocation;
        const submissionStartsAt = now - 2 * 24 * 60 * 60 * 1000;
        const submissionEndsAt = now + 14 * 24 * 60 * 60 * 1000;

        const existingDepartment = await ctx.db
            .query("departments")
            .withIndex("by_tenantId_code", (q) =>
                q.eq("tenantId", activeTenantUser.tenantId).eq("code", departmentCode),
            )
            .first();

        const departmentId =
            existingDepartment?._id ??
            (await ctx.db.insert("departments", {
                code: departmentCode,
                createdAt: now,
                isActive: true,
                name: departmentName,
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
        } else {
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
export const clearDepartmentUserBudgetByEmail = mutation({
    args: {
        email: v.string(),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();

        if (matchingUsers.length !== 1) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: `Expected exactly one auth user for ${normalizedEmail}.`,
            });
        }

        const user = firstOrThrow(matchingUsers, () =>
            new ConvexError({
                code: "NOT_FOUND",
                message: `No auth user found for ${normalizedEmail}.`,
            }),
        );

        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        const activeTenantUser = tenantUsers.find((tenantUser) => tenantUser.isActive);

        if (!activeTenantUser) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: "No active tenant role found for the target user.",
            });
        }

        const profile = await ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", activeTenantUser._id))
            .first();

        if (!profile || !profile.isActive) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: "The target user does not have an active department profile.",
            });
        }

        const department = await ctx.db.get(profile.departmentId);
        if (!department || !department.isActive) {
            throw new ConvexError({
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
export const issueDepartmentAccessCodeForEmail = mutation({
    args: {
        accessCode: v.string(),
        email: v.string(),
        expiresAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const normalizedEmail = args.email.trim().toLowerCase();
        const normalizedAccessCode = normalizeDepartmentUserAccessCode(args.accessCode);
        const matchingUsers = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", normalizedEmail))
            .collect();

        if (matchingUsers.length !== 1) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: `Expected exactly one auth user for ${normalizedEmail}.`,
            });
        }

        const user = firstOrThrow(matchingUsers, () =>
            new ConvexError({
                code: "NOT_FOUND",
                message: `No auth user found for ${normalizedEmail}.`,
            }),
        );

        const tenantUsers = await ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();
        const activeTenantUser = tenantUsers.find((tenantUser) => tenantUser.isActive);

        if (!activeTenantUser) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: "No active tenant role found for the target user.",
            });
        }

        const profile = await ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", activeTenantUser._id))
            .first();

        if (!profile || !profile.isActive) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: "The target user does not have an active department profile.",
            });
        }

        const department = await ctx.db.get(profile.departmentId);
        if (!department || !department.isActive) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: "Active department not found for the target user.",
            });
        }

        const now = Date.now();
        const codeHash = await hashDepartmentUserAccessCode(normalizedAccessCode);
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
            codeSuffix: getDepartmentUserAccessCodeSuffix(normalizedAccessCode),
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
