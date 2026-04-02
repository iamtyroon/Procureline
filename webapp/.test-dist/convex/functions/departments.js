"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailDepartmentCode = exports.generateDepartmentCode = exports.getDepartmentCodeGenerationContext = exports.deleteDepartment = exports.updateDepartment = exports.createDepartment = exports.getDepartmentsWorkspace = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const audit_1 = require("../../lib/security/audit");
const departments_1 = require("../../lib/procurement-officer/departments");
const access_codes_1 = require("../../lib/procurement-officer/access-codes");
const _helpers_1 = require("../actions/_helpers");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const _tenantGuard_1 = require("./_tenantGuard");
const departmentIdValidator = values_1.v.id("departments");
exports.getDepartmentsWorkspace = (0, server_1.query)({
    args: {},
    handler: async (ctx) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const tenant = await ctx.db.get(authContext.tenantId);
        if (!tenant) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }
        const now = Date.now();
        const [departments, accessCodes, plans, profiles, tenantUsers] = await Promise.all([
            ctx.db
                .query("departments")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("departmentAccessCodes")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("plans")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("departmentUserProfiles")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("tenantUsers")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
        ]);
        const activeDepartments = departments.filter(isActiveDepartment);
        const activeDepartmentIds = new Set(activeDepartments.map((department) => String(department._id)));
        const activeTenantUsersById = new Map(tenantUsers.map((tenantUser) => [String(tenantUser._id), tenantUser]));
        const relevantProfiles = profiles.filter((profile) => activeDepartmentIds.has(String(profile.departmentId)));
        const relevantUserIds = Array.from(new Set(relevantProfiles
            .map((profile) => activeTenantUsersById.get(String(profile.tenantUserId))?.userId)
            .filter((userId) => userId !== undefined)));
        const userDocuments = await Promise.all(relevantUserIds.map(async (userId) => [String(userId), await ctx.db.get(userId)]));
        const usersById = new Map(userDocuments);
        const summary = (0, departments_1.buildDepartmentWorkspaceSummary)({
            activeDepartmentCount: activeDepartments.length,
            budgetCeiling: tenant.procurementBudgetCeiling ?? null,
            departments: activeDepartments.map((department) => {
                const departmentProfiles = relevantProfiles.filter((profile) => profile.departmentId === department._id);
                const activeDepartmentUserEmails = departmentProfiles
                    .filter((profile) => {
                    const tenantUser = activeTenantUsersById.get(String(profile.tenantUserId));
                    return (profile.isActive &&
                        tenantUser?.isActive === true &&
                        tenantUser.role === "department_user");
                })
                    .map((profile) => {
                    const tenantUser = activeTenantUsersById.get(String(profile.tenantUserId));
                    const user = tenantUser ? usersById.get(String(tenantUser.userId)) : null;
                    return typeof user?.email === "string" && user.email.trim().length > 0
                        ? user.email.trim()
                        : "No email available";
                });
                return {
                    activeDepartmentUserEmails,
                    budgetAllocation: department.budgetAllocation ?? null,
                    code: department.code,
                    hasActiveAccessCode: accessCodes.some((accessCode) => accessCode.departmentId === department._id &&
                        accessCode.isActive &&
                        accessCode.expiresAt > now),
                    id: String(department._id),
                    isActive: department.isActive,
                    lastUpdatedAt: department.updatedAt,
                    name: department.name,
                    planStatuses: plans
                        .filter((plan) => plan.departmentId === department._id)
                        .map((plan) => plan.status),
                };
            }),
            now,
            tier: tenant.tier,
        });
        return {
            meta: {
                activeDepartmentCount: activeDepartments.length,
                budgetCeiling: tenant.procurementBudgetCeiling ?? null,
                limit: summary.limit,
                overAllocationWarning: summary.overAllocationWarning,
            },
            rows: summary.rows.map((row) => ({
                accessCodeStateLabel: row.accessCodeStateLabel,
                activeDepartmentUserEmails: row.activeDepartmentUserEmails,
                budgetAllocation: row.budgetAllocation,
                canDelete: row.deleteBlockers.canDelete,
                code: row.code,
                deleteBlockerMessages: row.deleteBlockers.messages,
                departmentUserCount: row.departmentUserCount,
                departmentUserStateLabel: row.departmentUserStateLabel,
                hasActiveAccessCode: row.hasActiveAccessCode,
                hasPlanningActivity: row.planStatuses.length > 0,
                id: row.id,
                lastBudgetChangedAt: activeDepartments.find((department) => String(department._id) === row.id)
                    ?.lastBudgetChangedAt ?? null,
                lastUpdatedAt: row.lastUpdatedAt,
                name: row.name,
                planningImpactWarning: row.planStatuses.length > 0
                    ? "Editing this department affects downstream planning activity."
                    : null,
                planningStateLabel: row.planningStateLabel,
                planStatuses: row.planStatuses,
                submissionWindowState: hasConfiguredSubmissionWindow(activeDepartments.find((department) => String(department._id) === row.id) ?? null)
                    ? "configured"
                    : "setup_required",
            })),
        };
    },
});
exports.createDepartment = (0, server_1.mutation)({
    args: {
        budgetAllocation: values_1.v.number(),
        code: values_1.v.string(),
        name: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const { authContext, tenant, tenantUser } = await loadDepartmentMutationContext(ctx);
        const parsed = parseDepartmentInput(args);
        await assertDepartmentUnique(ctx, {
            normalizedCode: parsed.normalizedCode,
            normalizedName: parsed.normalizedName,
            tenantId: authContext.tenantId,
        });
        await assertDepartmentTierCapacity(ctx, {
            tenantId: authContext.tenantId,
            tier: tenant.tier,
        });
        const now = Date.now();
        const departmentId = await ctx.db.insert("departments", {
            budgetAllocation: parsed.budgetAllocation,
            code: parsed.code,
            createdAt: now,
            isActive: true,
            name: parsed.name,
            normalizedCode: parsed.normalizedCode,
            normalizedName: parsed.normalizedName,
            procurementOfficerTenantUserId: tenantUser._id,
            tenantId: authContext.tenantId,
            updatedAt: now,
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentAuditEntry({
            action: "create",
            actorUserId: authContext.userId,
            departmentId,
            event: audit_1.AUDIT_EVENT_NAMES.departmentCreated,
            metadata: {
                budgetAllocation: parsed.budgetAllocation,
                departmentCode: parsed.code,
                departmentName: parsed.name,
                summary: `Created department ${parsed.name}.`,
            },
            tenantId: authContext.tenantId,
        }));
        return {
            departmentId,
        };
    },
});
exports.updateDepartment = (0, server_1.mutation)({
    args: {
        budgetAllocation: values_1.v.number(),
        code: values_1.v.string(),
        departmentId: departmentIdValidator,
        name: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const { authContext, tenantUser } = await loadDepartmentMutationContext(ctx);
        const department = await getActiveDepartmentForTenant(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        const parsed = parseDepartmentInput(args);
        if (parsed.normalizedCode !== department.normalizedCode) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "code",
                message: departments_1.DEPARTMENT_CODE_MANAGED_IN_ACCESS_CODES_MESSAGE,
            });
        }
        await assertDepartmentUnique(ctx, {
            excludeDepartmentId: args.departmentId,
            normalizedCode: parsed.normalizedCode,
            normalizedName: parsed.normalizedName,
            tenantId: authContext.tenantId,
        });
        const budgetChanged = department.budgetAllocation !== parsed.budgetAllocation;
        const now = Date.now();
        await ctx.db.patch(args.departmentId, {
            budgetAllocation: parsed.budgetAllocation,
            code: parsed.code,
            lastBudgetChangedAt: budgetChanged ? now : department.lastBudgetChangedAt,
            lastBudgetChangedByTenantUserId: budgetChanged
                ? tenantUser._id
                : department.lastBudgetChangedByTenantUserId,
            name: parsed.name,
            normalizedCode: parsed.normalizedCode,
            normalizedName: parsed.normalizedName,
            updatedAt: now,
        });
        const auditEntries = [
            buildDepartmentAuditEntry({
                action: "update",
                actorUserId: authContext.userId,
                departmentId: args.departmentId,
                event: audit_1.AUDIT_EVENT_NAMES.departmentUpdated,
                metadata: {
                    budgetAllocation: parsed.budgetAllocation,
                    departmentCode: parsed.code,
                    departmentName: parsed.name,
                    summary: `Updated department ${parsed.name}.`,
                },
                tenantId: authContext.tenantId,
            }),
        ];
        if (budgetChanged) {
            auditEntries.push(buildDepartmentAuditEntry({
                action: "update_budget",
                actorUserId: authContext.userId,
                departmentId: args.departmentId,
                event: audit_1.AUDIT_EVENT_NAMES.departmentBudgetChanged,
                metadata: {
                    budgetAllocation: parsed.budgetAllocation,
                    previousBudgetAllocation: department.budgetAllocation ?? null,
                    summary: `Updated the budget allocation for ${parsed.name}.`,
                },
                tenantId: authContext.tenantId,
            }));
        }
        for (const auditEntry of auditEntries) {
            await (0, _audit_1.appendAuditLogRequired)(ctx, auditEntry);
        }
        return {
            budgetChanged,
            departmentId: args.departmentId,
        };
    },
});
exports.deleteDepartment = (0, server_1.mutation)({
    args: {
        departmentId: departmentIdValidator,
    },
    handler: async (ctx, args) => {
        const { authContext, tenantUser } = await loadDepartmentMutationContext(ctx);
        const department = await getActiveDepartmentForTenant(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        const deletionBlockers = await loadDepartmentDeletionBlockers(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        if (deletionBlockers.hasProtectedPlans) {
            throw new values_1.ConvexError({
                code: "FORBIDDEN",
                message: departments_1.DEPARTMENT_DELETE_PLANS_MESSAGE,
            });
        }
        if (deletionBlockers.activeDepartmentUserEmails.length > 0) {
            throw new values_1.ConvexError({
                code: "FORBIDDEN",
                emails: deletionBlockers.activeDepartmentUserEmails,
                message: departments_1.DEPARTMENT_DELETE_DU_MESSAGE,
            });
        }
        const now = Date.now();
        await ctx.db.patch(args.departmentId, {
            deletedAt: now,
            deletedByTenantUserId: tenantUser._id,
            isActive: false,
            updatedAt: now,
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentAuditEntry({
            action: "delete",
            actorUserId: authContext.userId,
            departmentId: args.departmentId,
            event: audit_1.AUDIT_EVENT_NAMES.departmentDeleted,
            metadata: {
                departmentCode: department.code,
                departmentName: department.name,
                summary: `Archived department ${department.name}.`,
            },
            tenantId: authContext.tenantId,
        }));
        return {
            departmentId: args.departmentId,
        };
    },
});
exports.getDepartmentCodeGenerationContext = (0, server_1.internalQuery)({
    args: {
        tenantId: values_1.v.id("tenants"),
    },
    returns: values_1.v.object({
        activeCodes: values_1.v.array(values_1.v.string()),
        tenantName: values_1.v.string(),
    }),
    handler: async (ctx, args) => {
        const [tenant, departments] = await Promise.all([
            ctx.db.get(args.tenantId),
            ctx.db
                .query("departments")
                .withIndex("by_tenantId_isActive", (q) => q.eq("tenantId", args.tenantId).eq("isActive", true))
                .collect(),
        ]);
        if (!tenant) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }
        return {
            activeCodes: departments
                .filter(isActiveDepartment)
                .map((department) => department.normalizedCode),
            tenantName: tenant.name,
        };
    },
});
exports.generateDepartmentCode = (0, server_1.action)({
    args: {
        name: values_1.v.string(),
    },
    returns: values_1.v.object({
        code: values_1.v.string(),
    }),
    handler: async (ctx, args) => {
        const tenantUser = await loadDepartmentActionContext(ctx);
        const generationContext = await ctx.runQuery("functions/departments:getDepartmentCodeGenerationContext", {
            tenantId: tenantUser.tenantId,
        });
        const existingCodes = new Set(generationContext.activeCodes);
        for (let attempt = 0; attempt < 25; attempt += 1) {
            const candidate = (0, access_codes_1.buildCanonicalDepartmentAccessCode)({
                departmentName: args.name,
            });
            if (!existingCodes.has((0, departments_1.normalizeDepartmentCode)(candidate))) {
                return {
                    code: candidate,
                };
            }
        }
        throw new Error("We could not generate a unique department code right now.");
    },
});
exports.emailDepartmentCode = (0, server_1.action)({
    args: {
        code: values_1.v.string(),
        departmentName: values_1.v.string(),
        email: values_1.v.string(),
    },
    returns: values_1.v.object({
        deliveryStatus: values_1.v.union(values_1.v.literal("failed"), values_1.v.literal("sent")),
    }),
    handler: async () => {
        throw new values_1.ConvexError({
            code: "FORBIDDEN",
            message: departments_1.DEPARTMENT_CODE_EMAIL_AFTER_CREATE_MESSAGE,
        });
    },
});
async function loadDepartmentMutationContext(ctx) {
    const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
    const [tenant, tenantUser] = await Promise.all([
        ctx.db.get(authContext.tenantId),
        (0, _tenantGuard_1.getCurrentTenantUserMembership)(ctx),
    ]);
    if (!tenant) {
        throw new values_1.ConvexError({
            code: "NOT_FOUND",
            message: "Tenant record not found",
        });
    }
    if (!tenantUser || tenantUser.role !== "procurement_officer" || !tenantUser.isActive) {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for this resource.",
        });
    }
    return {
        authContext,
        tenant,
        tenantUser,
    };
}
async function loadDepartmentActionContext(ctx) {
    const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
    if (actor.role !== "procurement_officer" || !actor.tenantId) {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for this resource.",
        });
    }
    const tenantUser = await ctx.runQuery("functions/users:getCurrentUserTenant", {});
    if (tenantUser.role !== "procurement_officer" || !tenantUser.isActive) {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for this resource.",
        });
    }
    return tenantUser;
}
function parseDepartmentInput(args) {
    const result = departments_1.departmentFormSchema.safeParse(args);
    if (!result.success) {
        const issue = result.error.issues[0] ?? {
            message: "Please review the department details and try again.",
            path: ["department"],
        };
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            field: issue.path[0] ?? "department",
            message: issue.message,
        });
    }
    return result.data;
}
async function assertDepartmentUnique(ctx, args) {
    const [codeMatches, nameMatches] = await Promise.all([
        ctx.db
            .query("departments")
            .withIndex("by_tenantId_normalizedCode", (q) => q.eq("tenantId", args.tenantId).eq("normalizedCode", args.normalizedCode))
            .collect(),
        ctx.db
            .query("departments")
            .withIndex("by_tenantId_normalizedName", (q) => q.eq("tenantId", args.tenantId).eq("normalizedName", args.normalizedName))
            .collect(),
    ]);
    const hasCodeConflict = codeMatches.some((department) => isActiveDepartment(department) &&
        (args.excludeDepartmentId ? department._id !== args.excludeDepartmentId : true) &&
        getComparableNormalizedCode(department) === args.normalizedCode);
    if (hasCodeConflict) {
        throw new values_1.ConvexError({
            code: "ALREADY_EXISTS",
            field: "code",
            message: departments_1.DEPARTMENT_CODE_EXISTS_MESSAGE,
        });
    }
    const hasNameConflict = nameMatches.some((department) => isActiveDepartment(department) &&
        (args.excludeDepartmentId ? department._id !== args.excludeDepartmentId : true) &&
        getComparableNormalizedName(department) === args.normalizedName);
    if (hasNameConflict) {
        throw new values_1.ConvexError({
            code: "ALREADY_EXISTS",
            field: "name",
            message: departments_1.DEPARTMENT_NAME_EXISTS_MESSAGE,
        });
    }
}
async function assertDepartmentTierCapacity(ctx, args) {
    const activeDepartments = await ctx.db
        .query("departments")
        .withIndex("by_tenantId_isActive", (q) => q.eq("tenantId", args.tenantId).eq("isActive", true))
        .collect();
    const limitState = (0, departments_1.buildDepartmentTierLimitState)({
        activeDepartmentCount: activeDepartments.filter(isActiveDepartment).length,
        tier: args.tier,
    });
    if (limitState.atLimit && limitState.limit !== null) {
        throw new values_1.ConvexError({
            code: "QUOTA_EXCEEDED",
            limit: limitState.limit,
            message: `${limitState.tierLabel} tier supports up to ${limitState.limit} active departments.`,
            tier: limitState.tier,
            upgradeHref: limitState.upgradeHref,
        });
    }
}
async function getActiveDepartmentForTenant(ctx, args) {
    const department = await ctx.db.get(args.departmentId);
    if (!department || department.tenantId !== args.tenantId || !isActiveDepartment(department)) {
        throw new values_1.ConvexError({
            code: "NOT_FOUND",
            message: departments_1.DEPARTMENT_NOT_FOUND_MESSAGE,
        });
    }
    return department;
}
async function loadDepartmentDeletionBlockers(ctx, args) {
    const [plans, profiles, tenantUsers] = await Promise.all([
        ctx.db
            .query("plans")
            .withIndex("by_departmentId", (q) => q.eq("departmentId", args.departmentId))
            .collect(),
        ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_departmentId_email", (q) => q.eq("departmentId", args.departmentId))
            .collect(),
        ctx.db
            .query("tenantUsers")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
            .collect(),
    ]);
    const tenantUsersById = new Map(tenantUsers.map((tenantUser) => [String(tenantUser._id), tenantUser]));
    const activeUserIds = Array.from(new Set(profiles
        .map((profile) => tenantUsersById.get(String(profile.tenantUserId))?.userId)
        .filter((userId) => userId !== undefined)));
    const users = await Promise.all(activeUserIds.map(async (userId) => [String(userId), await ctx.db.get(userId)]));
    const usersById = new Map(users);
    return {
        activeDepartmentUserEmails: profiles
            .filter((profile) => {
            const tenantUser = tenantUsersById.get(String(profile.tenantUserId));
            return profile.isActive && tenantUser?.isActive === true;
        })
            .map((profile) => {
            const tenantUser = tenantUsersById.get(String(profile.tenantUserId));
            const user = tenantUser ? usersById.get(String(tenantUser.userId)) : null;
            return typeof user?.email === "string" && user.email.trim().length > 0
                ? user.email.trim()
                : "No email available";
        })
            .sort((left, right) => left.localeCompare(right)),
        hasProtectedPlans: plans.some((plan) => plan.status === "approved" || plan.status === "submitted"),
    };
}
function buildDepartmentAuditEntry(args) {
    return {
        action: args.action,
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "procurement_officer",
            userId: String(args.actorUserId),
        }),
        entityType: "department",
        event: args.event,
        metadata: args.metadata,
        outcome: audit_1.AUDIT_OUTCOMES.allowed,
        recordId: String(args.departmentId),
        sourceTenantId: String(args.tenantId),
        tableName: "departments",
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    };
}
function hasConfiguredSubmissionWindow(department) {
    return (department !== null &&
        typeof department.submissionStartsAt === "number" &&
        typeof department.submissionEndsAt === "number" &&
        department.submissionEndsAt > department.submissionStartsAt);
}
function isActiveDepartment(department) {
    return department.isActive && department.deletedAt === undefined;
}
function getComparableNormalizedCode(department) {
    return department.normalizedCode;
}
function getComparableNormalizedName(department) {
    return department.normalizedName;
}
