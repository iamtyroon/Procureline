import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import {
    AUDIT_EVENT_NAMES,
    AUDIT_OUTCOMES,
    type AuditEventName,
    createAuthenticatedAuditActor,
} from "../../lib/security/audit";
import {
    buildDepartmentTierLimitState,
    buildDepartmentWorkspaceSummary,
    DEPARTMENT_CODE_EXISTS_MESSAGE,
    DEPARTMENT_DELETE_DU_MESSAGE,
    DEPARTMENT_DELETE_PLANS_MESSAGE,
    DEPARTMENT_NAME_EXISTS_MESSAGE,
    DEPARTMENT_NOT_FOUND_MESSAGE,
    departmentFormSchema,
    type DepartmentPlanStatus,
} from "../../lib/procurement-officer/departments";
import { appendAuditLogRequired } from "./_audit";
import { requireTenantRole } from "./_roleGuard";
import { getCurrentTenantUserMembership } from "./_tenantGuard";

type DepartmentRecord = Doc<"departments">;
type DepartmentMutationCtx = MutationCtx;
type DepartmentQueryCtx = QueryCtx;

const departmentIdValidator = v.id("departments");

export const getDepartmentsWorkspace = query({
    args: {},
    handler: async (ctx) => {
        const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
        const tenant = await ctx.db.get(authContext.tenantId);

        if (!tenant) {
            throw new ConvexError({
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
        const activeTenantUsersById = new Map(
            tenantUsers.map((tenantUser) => [String(tenantUser._id), tenantUser]),
        );
        const relevantProfiles = profiles.filter((profile) =>
            activeDepartmentIds.has(String(profile.departmentId)),
        );
        const relevantUserIds = Array.from(
            new Set(
                relevantProfiles
                    .map((profile) => activeTenantUsersById.get(String(profile.tenantUserId))?.userId)
                    .filter((userId): userId is Id<"users"> => userId !== undefined),
            ),
        );
        const userDocuments = await Promise.all(
            relevantUserIds.map(async (userId) => [String(userId), await ctx.db.get(userId)] as const),
        );
        const usersById = new Map(userDocuments);

        const summary = buildDepartmentWorkspaceSummary({
            activeDepartmentCount: activeDepartments.length,
            budgetCeiling: tenant.procurementBudgetCeiling ?? null,
            departments: activeDepartments.map((department) => {
                const departmentProfiles = relevantProfiles.filter(
                    (profile) => profile.departmentId === department._id,
                );
                const activeDepartmentUserEmails = departmentProfiles
                    .filter((profile) => {
                        const tenantUser = activeTenantUsersById.get(String(profile.tenantUserId));
                        return (
                            profile.isActive &&
                            tenantUser?.isActive === true &&
                            tenantUser.role === "department_user"
                        );
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
                    hasActiveAccessCode: accessCodes.some(
                        (accessCode) =>
                            accessCode.departmentId === department._id &&
                            accessCode.isActive &&
                            accessCode.expiresAt > now,
                    ),
                    id: String(department._id),
                    isActive: department.isActive,
                    lastUpdatedAt: department.updatedAt,
                    name: department.name,
                    planStatuses: plans
                        .filter((plan) => plan.departmentId === department._id)
                        .map((plan) => plan.status as DepartmentPlanStatus),
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
                lastBudgetChangedAt:
                    activeDepartments.find((department) => String(department._id) === row.id)
                        ?.lastBudgetChangedAt ?? null,
                lastUpdatedAt: row.lastUpdatedAt,
                name: row.name,
                planningImpactWarning:
                    row.planStatuses.length > 0
                        ? "Editing this department affects downstream planning activity."
                        : null,
                planningStateLabel: row.planningStateLabel,
                planStatuses: row.planStatuses,
                submissionWindowState:
                    hasConfiguredSubmissionWindow(
                        activeDepartments.find((department) => String(department._id) === row.id) ?? null,
                    )
                        ? "configured"
                        : "setup_required",
            })),
        };
    },
});

export const createDepartment = mutation({
    args: {
        budgetAllocation: v.number(),
        code: v.string(),
        name: v.string(),
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

        await appendAuditLogRequired(
            ctx,
            buildDepartmentAuditEntry({
                action: "create",
                actorUserId: authContext.userId,
                departmentId,
                event: AUDIT_EVENT_NAMES.departmentCreated,
                metadata: {
                    budgetAllocation: parsed.budgetAllocation,
                    departmentCode: parsed.code,
                    departmentName: parsed.name,
                    summary: `Created department ${parsed.name}.`,
                },
                tenantId: authContext.tenantId,
            }),
        );

        return {
            departmentId,
        };
    },
});

export const updateDepartment = mutation({
    args: {
        budgetAllocation: v.number(),
        code: v.string(),
        departmentId: departmentIdValidator,
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const { authContext, tenantUser } = await loadDepartmentMutationContext(ctx);
        const department = await getActiveDepartmentForTenant(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        const parsed = parseDepartmentInput(args);

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
                event: AUDIT_EVENT_NAMES.departmentUpdated,
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
            auditEntries.push(
                buildDepartmentAuditEntry({
                    action: "update_budget",
                    actorUserId: authContext.userId,
                    departmentId: args.departmentId,
                    event: AUDIT_EVENT_NAMES.departmentBudgetChanged,
                    metadata: {
                        budgetAllocation: parsed.budgetAllocation,
                        previousBudgetAllocation: department.budgetAllocation ?? null,
                        summary: `Updated the budget allocation for ${parsed.name}.`,
                    },
                    tenantId: authContext.tenantId,
                }),
            );
        }

        for (const auditEntry of auditEntries) {
            await appendAuditLogRequired(ctx, auditEntry);
        }

        return {
            budgetChanged,
            departmentId: args.departmentId,
        };
    },
});

export const deleteDepartment = mutation({
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
            throw new ConvexError({
                code: "FORBIDDEN",
                message: DEPARTMENT_DELETE_PLANS_MESSAGE,
            });
        }

        if (deletionBlockers.activeDepartmentUserEmails.length > 0) {
            throw new ConvexError({
                code: "FORBIDDEN",
                emails: deletionBlockers.activeDepartmentUserEmails,
                message: DEPARTMENT_DELETE_DU_MESSAGE,
            });
        }

        const now = Date.now();
        await ctx.db.patch(args.departmentId, {
            deletedAt: now,
            deletedByTenantUserId: tenantUser._id,
            isActive: false,
            updatedAt: now,
        });

        await appendAuditLogRequired(
            ctx,
            buildDepartmentAuditEntry({
                action: "delete",
                actorUserId: authContext.userId,
                departmentId: args.departmentId,
                event: AUDIT_EVENT_NAMES.departmentDeleted,
                metadata: {
                    departmentCode: department.code,
                    departmentName: department.name,
                    summary: `Archived department ${department.name}.`,
                },
                tenantId: authContext.tenantId,
            }),
        );

        return {
            departmentId: args.departmentId,
        };
    },
});

async function loadDepartmentMutationContext(ctx: DepartmentMutationCtx) {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    const [tenant, tenantUser] = await Promise.all([
        ctx.db.get(authContext.tenantId),
        getCurrentTenantUserMembership(ctx),
    ]);

    if (!tenant) {
        throw new ConvexError({
            code: "NOT_FOUND",
            message: "Tenant record not found",
        });
    }

    if (!tenantUser || tenantUser.role !== "procurement_officer" || !tenantUser.isActive) {
        throw new ConvexError({
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

function parseDepartmentInput(args: {
    budgetAllocation: number;
    code: string;
    name: string;
}) {
    const result = departmentFormSchema.safeParse(args);

    if (!result.success) {
        const issue = result.error.issues[0] ?? {
            message: "Please review the department details and try again.",
            path: ["department"],
        };
        throw new ConvexError({
            code: "VALIDATION_FAILED",
            field: issue.path[0] ?? "department",
            message: issue.message,
        });
    }

    return result.data;
}

async function assertDepartmentUnique(
    ctx: DepartmentMutationCtx,
    args: {
        excludeDepartmentId?: Id<"departments">;
        normalizedCode: string;
        normalizedName: string;
        tenantId: Id<"tenants">;
    },
) {
    const [codeMatches, nameMatches] = await Promise.all([
        ctx.db
            .query("departments")
            .withIndex("by_tenantId_normalizedCode", (q) =>
                q.eq("tenantId", args.tenantId).eq("normalizedCode", args.normalizedCode),
            )
            .collect(),
        ctx.db
            .query("departments")
            .withIndex("by_tenantId_normalizedName", (q) =>
                q.eq("tenantId", args.tenantId).eq("normalizedName", args.normalizedName),
            )
            .collect(),
    ]);

    const hasCodeConflict = codeMatches.some(
        (department) =>
            isActiveDepartment(department) &&
            (args.excludeDepartmentId ? department._id !== args.excludeDepartmentId : true) &&
            getComparableNormalizedCode(department) === args.normalizedCode,
    );
    if (hasCodeConflict) {
        throw new ConvexError({
            code: "ALREADY_EXISTS",
            field: "code",
            message: DEPARTMENT_CODE_EXISTS_MESSAGE,
        });
    }

    const hasNameConflict = nameMatches.some(
        (department) =>
            isActiveDepartment(department) &&
            (args.excludeDepartmentId ? department._id !== args.excludeDepartmentId : true) &&
            getComparableNormalizedName(department) === args.normalizedName,
    );
    if (hasNameConflict) {
        throw new ConvexError({
            code: "ALREADY_EXISTS",
            field: "name",
            message: DEPARTMENT_NAME_EXISTS_MESSAGE,
        });
    }
}

async function assertDepartmentTierCapacity(
    ctx: DepartmentMutationCtx,
    args: {
        tenantId: Id<"tenants">;
        tier: Doc<"tenants">["tier"];
    },
) {
    const activeDepartments = await ctx.db
        .query("departments")
        .withIndex("by_tenantId_isActive", (q) =>
            q.eq("tenantId", args.tenantId).eq("isActive", true),
        )
        .collect();
    const limitState = buildDepartmentTierLimitState({
        activeDepartmentCount: activeDepartments.filter(isActiveDepartment).length,
        tier: args.tier,
    });

    if (limitState.atLimit && limitState.limit !== null) {
        throw new ConvexError({
            code: "QUOTA_EXCEEDED",
            limit: limitState.limit,
            message: `${limitState.tierLabel} tier supports up to ${limitState.limit} active departments.`,
            tier: limitState.tier,
            upgradeHref: limitState.upgradeHref,
        });
    }
}

async function getActiveDepartmentForTenant(
    ctx: DepartmentMutationCtx | DepartmentQueryCtx,
    args: {
        departmentId: Id<"departments">;
        tenantId: Id<"tenants">;
    },
) {
    const department = await ctx.db.get(args.departmentId);

    if (!department || department.tenantId !== args.tenantId || !isActiveDepartment(department)) {
        throw new ConvexError({
            code: "NOT_FOUND",
            message: DEPARTMENT_NOT_FOUND_MESSAGE,
        });
    }

    return department;
}

async function loadDepartmentDeletionBlockers(
    ctx: DepartmentMutationCtx,
    args: {
        departmentId: Id<"departments">;
        tenantId: Id<"tenants">;
    },
) {
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
    const tenantUsersById = new Map(
        tenantUsers.map((tenantUser) => [String(tenantUser._id), tenantUser]),
    );
    const activeUserIds = Array.from(
        new Set(
            profiles
                .map((profile) => tenantUsersById.get(String(profile.tenantUserId))?.userId)
                .filter((userId): userId is Id<"users"> => userId !== undefined),
        ),
    );
    const users = await Promise.all(
        activeUserIds.map(async (userId) => [String(userId), await ctx.db.get(userId)] as const),
    );
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
        hasProtectedPlans: plans.some(
            (plan) => plan.status === "approved" || plan.status === "submitted",
        ),
    };
}

function buildDepartmentAuditEntry(args: {
    action: string;
    actorUserId: Id<"users">;
    departmentId: Id<"departments">;
    event: string;
    metadata: Record<string, unknown>;
    tenantId: Id<"tenants">;
}) {
    return {
        action: args.action,
        actor: createAuthenticatedAuditActor({
            role: "procurement_officer",
            userId: String(args.actorUserId),
        }),
        entityType: "department",
        event: args.event as AuditEventName,
        metadata: args.metadata,
        outcome: AUDIT_OUTCOMES.allowed,
        recordId: String(args.departmentId),
        sourceTenantId: String(args.tenantId),
        tableName: "departments",
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    };
}

function hasConfiguredSubmissionWindow(department: DepartmentRecord | null): boolean {
    return (
        department !== null &&
        typeof department.submissionStartsAt === "number" &&
        typeof department.submissionEndsAt === "number" &&
        department.submissionEndsAt > department.submissionStartsAt
    );
}

function isActiveDepartment(department: DepartmentRecord): boolean {
    return department.isActive && department.deletedAt === undefined;
}

function getComparableNormalizedCode(
    department: Pick<DepartmentRecord, "code" | "normalizedCode">,
): string {
    return department.normalizedCode;
}

function getComparableNormalizedName(
    department: Pick<DepartmentRecord, "name" | "normalizedName">,
): string {
    return department.normalizedName;
}
