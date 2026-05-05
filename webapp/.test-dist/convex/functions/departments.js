"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncDepartmentCodeForDelivery = exports.emailDepartmentCode = exports.generateDepartmentCode = exports.getDepartmentCodeGenerationContext = exports.hardDeleteArchivedDepartment = exports.extendDepartmentSubmissionDeadline = exports.deleteDepartment = exports.updateDepartment = exports.createDepartment = exports.getDepartmentsWorkspace = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const audit_1 = require("../../lib/security/audit");
const departments_1 = require("../../lib/procurement-officer/departments");
const access_codes_1 = require("../../lib/procurement-officer/access-codes");
const department_user_access_1 = require("../../lib/auth/department-user-access");
const transport_1 = require("../../lib/email/transport");
const deadlines_1 = require("../../lib/procurement-officer/deadlines");
const input_1 = require("../../lib/security/input");
const _helpers_1 = require("../actions/_helpers");
const emailTransport_1 = require("../emailTransport");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const _tenantGuard_1 = require("./_tenantGuard");
const departmentIdValidator = values_1.v.id("departments");
const DEPARTMENT_CODE_LOGIN_EXPIRATION_AT = Date.UTC(2100, 0, 1);
function shouldCaptureDepartmentCodeEmailsDirectly() {
    return (0, transport_1.resolveEmailTransportMode)(process.env.AUTH_EMAIL_TRANSPORT) === "dev_inbox";
}
async function sendDepartmentCodeEmailDirect(args) {
    const result = await (0, emailTransport_1.sendAppEmail)({
        from: process.env.AUTH_RESET_RESEND_FROM ??
            "Procureline <onboarding@resend.dev>",
        html: `
            <div style="color: #0f172a; font-family: Georgia, serif; line-height: 1.6;">
                <h1>${args.tenantName} department code</h1>
                <p>A Procurement Officer sent a department code for ${args.departmentName}.</p>
                <p>Department code: ${args.code}</p>
                <p>
                    <a href="${args.loginUrl}" style="color: #0f172a; font-weight: bold;">
                        Open Department User sign-in
                    </a>
                </p>
            </div>
        `,
        idempotencyKey: args.idempotencyKey,
        messageType: "transactional_department-code-delivery",
        metadata: {
            template: "department-code-delivery",
            templateProps: {
                departmentCode: args.code,
                departmentName: args.departmentName,
                loginUrl: args.loginUrl,
                tenantName: args.tenantName,
            },
        },
        subject: args.subject,
        text: [
            `${args.tenantName} department code`,
            "",
            `A Procurement Officer sent a department code for ${args.departmentName}.`,
            `Department code: ${args.code}`,
            `Department User sign-in: ${args.loginUrl}`,
        ].join("\n"),
        to: [args.email],
    });
    if (!result.sent) {
        throw new Error(result.errorMessage ?? "Development inbox capture failed.");
    }
}
async function getLatestActiveSubmissionDeadline(ctx, args) {
    const deadlines = await ctx.db
        .query("submissionDeadlines")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .collect();
    return (deadlines
        .filter((deadline) => deadline.submissionStartsAt < deadline.submissionEndsAt &&
        deadline.submissionEndsAt > args.now)
        .sort((left, right) => right.updatedAt - left.updatedAt ||
        right.deadlineVersion - left.deadlineVersion)[0] ?? null);
}
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
        const archivedDepartments = departments.filter(isArchivedDepartment);
        const activeDepartmentIds = new Set(activeDepartments.map((department) => String(department._id)));
        const activeTenantUsersById = new Map(tenantUsers.map((tenantUser) => [String(tenantUser._id), tenantUser]));
        const relevantProfiles = profiles.filter((profile) => activeDepartmentIds.has(String(profile.departmentId)));
        const relevantUserIds = Array.from(new Set(relevantProfiles
            .map((profile) => activeTenantUsersById.get(String(profile.tenantUserId))?.userId)
            .filter((userId) => userId !== undefined)));
        const userDocuments = await Promise.all(relevantUserIds.map(async (userId) => [String(userId), await ctx.db.get(userId)]));
        const usersById = new Map(userDocuments);
        const resolvedTimeZone = (0, deadlines_1.resolveDeadlineTimeZone)({
            tenantTimeZone: tenant.timeZone,
        });
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
                    voteNumber: department.voteNumber ?? department.code,
                };
            }),
            now,
            tier: tenant.tier,
        });
        const activeRows = summary.rows.map((row) => ({
            accessCodeCount: accessCodes.filter((accessCode) => String(accessCode.departmentId) === row.id).length,
            accessCodeStateLabel: row.accessCodeStateLabel,
            activeDepartmentUserEmails: row.activeDepartmentUserEmails,
            archivedAt: null,
            budgetAllocation: row.budgetAllocation,
            canDelete: row.deleteBlockers.canDelete,
            code: row.code,
            deleteBlockerMessages: row.deleteBlockers.messages,
            departmentUserCount: row.departmentUserCount,
            departmentUserProfileCount: profiles.filter((profile) => String(profile.departmentId) === row.id).length,
            departmentUserStateLabel: row.departmentUserStateLabel,
            hasActiveAccessCode: row.hasActiveAccessCode,
            hasPlanningActivity: row.planStatuses.length > 0,
            id: row.id,
            isArchived: false,
            lastBudgetChangedAt: activeDepartments.find((department) => String(department._id) === row.id)
                ?.lastBudgetChangedAt ?? null,
            lastUpdatedAt: row.lastUpdatedAt,
            name: row.name,
            permanentDeleteRecordCounts: null,
            planCount: plans.filter((plan) => String(plan.departmentId) === row.id).length,
            planningImpactWarning: row.planStatuses.length > 0
                ? "Editing this department affects downstream planning activity."
                : null,
            planningStateLabel: row.planningStateLabel,
            planStatuses: row.planStatuses,
            submissionEndsAt: activeDepartments.find((department) => String(department._id) === row.id)
                ?.submissionEndsAt ?? null,
            submissionStartsAt: activeDepartments.find((department) => String(department._id) === row.id)
                ?.submissionStartsAt ?? null,
            submissionWindowState: hasConfiguredSubmissionWindow(activeDepartments.find((department) => String(department._id) === row.id) ?? null)
                ? "configured"
                : "setup_required",
            voteNumber: row.voteNumber,
        }));
        const archivedRows = archivedDepartments
            .sort((left, right) => right.updatedAt - left.updatedAt)
            .map((department) => {
            const departmentPlans = plans.filter((plan) => plan.departmentId === department._id);
            const departmentAccessCodes = accessCodes.filter((accessCode) => accessCode.departmentId === department._id);
            const departmentProfiles = profiles.filter((profile) => profile.departmentId === department._id);
            return {
                accessCodeCount: departmentAccessCodes.length,
                accessCodeStateLabel: "Archived",
                activeDepartmentUserEmails: [],
                archivedAt: department.deletedAt ?? department.updatedAt,
                budgetAllocation: department.budgetAllocation ?? null,
                canDelete: true,
                code: department.code,
                deleteBlockerMessages: [],
                departmentUserCount: 0,
                departmentUserProfileCount: departmentProfiles.length,
                departmentUserStateLabel: "Archived",
                hasActiveAccessCode: false,
                hasPlanningActivity: departmentPlans.length > 0,
                id: String(department._id),
                isArchived: true,
                lastBudgetChangedAt: department.lastBudgetChangedAt ?? null,
                lastUpdatedAt: department.updatedAt,
                name: department.name,
                permanentDeleteRecordCounts: {
                    accessCodeCount: departmentAccessCodes.length,
                    departmentUserProfileCount: departmentProfiles.length,
                    planCount: departmentPlans.length,
                },
                planCount: departmentPlans.length,
                planningImpactWarning: null,
                planningStateLabel: "Archived",
                planStatuses: departmentPlans.map((plan) => plan.status),
                submissionEndsAt: department.submissionEndsAt ?? null,
                submissionStartsAt: department.submissionStartsAt ?? null,
                submissionWindowState: hasConfiguredSubmissionWindow(department)
                    ? "configured"
                    : "setup_required",
                voteNumber: department.voteNumber ?? department.code,
            };
        });
        return {
            meta: {
                activeDepartmentCount: activeDepartments.length,
                budgetCeiling: tenant.procurementBudgetCeiling ?? null,
                limit: summary.limit,
                overAllocationWarning: summary.overAllocationWarning,
                timeZone: resolvedTimeZone.timeZone,
            },
            rows: [...activeRows, ...archivedRows],
        };
    },
});
exports.createDepartment = (0, server_1.mutation)({
    args: {
        budgetAllocation: values_1.v.number(),
        code: values_1.v.string(),
        name: values_1.v.string(),
        voteNumber: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const { authContext, tenant, tenantUser } = await loadDepartmentMutationContext(ctx);
        const parsed = parseDepartmentInput(args);
        await assertDepartmentUnique(ctx, {
            normalizedCode: parsed.normalizedCode,
            normalizedName: parsed.normalizedName,
            normalizedVoteNumber: parsed.normalizedVoteNumber,
            tenantId: authContext.tenantId,
        });
        await assertDepartmentTierCapacity(ctx, {
            tenantId: authContext.tenantId,
            tier: tenant.tier,
        });
        const now = Date.now();
        const activeDeadline = await getLatestActiveSubmissionDeadline(ctx, {
            now,
            tenantId: authContext.tenantId,
        });
        const inheritedDeadline = activeDeadline !== null
            ? {
                submissionEndsAt: activeDeadline.submissionEndsAt,
                submissionStartsAt: activeDeadline.submissionStartsAt,
            }
            : {};
        const departmentId = await ctx.db.insert("departments", {
            budgetAllocation: parsed.budgetAllocation,
            code: parsed.code,
            createdAt: now,
            isActive: true,
            name: parsed.name,
            normalizedCode: parsed.normalizedCode,
            normalizedName: parsed.normalizedName,
            normalizedVoteNumber: parsed.normalizedVoteNumber,
            procurementOfficerTenantUserId: tenantUser._id,
            ...inheritedDeadline,
            tenantId: authContext.tenantId,
            updatedAt: now,
            voteNumber: parsed.voteNumber,
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
                voteNumber: parsed.voteNumber,
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
        voteNumber: values_1.v.string(),
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
            normalizedVoteNumber: parsed.normalizedVoteNumber,
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
            normalizedVoteNumber: parsed.normalizedVoteNumber,
            updatedAt: now,
            voteNumber: parsed.voteNumber,
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
                    voteNumber: parsed.voteNumber,
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
        const now = Date.now();
        await deactivateDepartmentUserAccess(ctx, {
            departmentId: args.departmentId,
            now,
            tenantId: authContext.tenantId,
            tenantUserId: tenantUser._id,
        });
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
                deactivatedDepartmentUserCount: deletionBlockers.activeDepartmentUserEmails.length,
                departmentCode: department.code,
                departmentName: department.name,
                summary: `Archived department ${department.name} and deactivated assigned DU access.`,
            },
            tenantId: authContext.tenantId,
        }));
        return {
            departmentId: args.departmentId,
        };
    },
});
exports.extendDepartmentSubmissionDeadline = (0, server_1.mutation)({
    args: {
        departmentId: departmentIdValidator,
        submissionEndsAt: values_1.v.number(),
    },
    handler: async (ctx, args) => {
        const { authContext, tenantUser } = await loadDepartmentMutationContext(ctx);
        const department = await getActiveDepartmentForTenant(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        const currentStartsAt = department.submissionStartsAt;
        const currentEndsAt = department.submissionEndsAt;
        const now = Date.now();
        if (typeof currentStartsAt !== "number" ||
            typeof currentEndsAt !== "number" ||
            currentEndsAt <= currentStartsAt) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "submissionEndsAt",
                message: departments_1.DEPARTMENT_DEADLINE_NOT_CONFIGURED_MESSAGE,
            });
        }
        if (args.submissionEndsAt <= now) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "submissionEndsAt",
                message: departments_1.DEPARTMENT_DEADLINE_EXTENSION_PAST_MESSAGE,
            });
        }
        if (args.submissionEndsAt <= currentEndsAt) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "submissionEndsAt",
                message: departments_1.DEPARTMENT_DEADLINE_EXTENSION_ORDER_MESSAGE,
            });
        }
        await ctx.db.patch(args.departmentId, {
            submissionEndsAt: args.submissionEndsAt,
            updatedAt: now,
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentAuditEntry({
            action: "extend_submission_deadline",
            actorUserId: authContext.userId,
            departmentId: args.departmentId,
            event: audit_1.AUDIT_EVENT_NAMES.departmentDeadlineExtended,
            metadata: {
                departmentCode: department.code,
                departmentName: department.name,
                previousSubmissionEndsAt: currentEndsAt,
                submissionEndsAt: args.submissionEndsAt,
                summary: `Extended submission expiry for ${department.name}.`,
            },
            tenantId: authContext.tenantId,
        }));
        return {
            departmentId: args.departmentId,
            submissionEndsAt: args.submissionEndsAt,
        };
    },
});
exports.hardDeleteArchivedDepartment = (0, server_1.mutation)({
    args: {
        departmentId: departmentIdValidator,
    },
    handler: async (ctx, args) => {
        const { authContext } = await loadDepartmentMutationContext(ctx);
        const department = await ctx.db.get(args.departmentId);
        if (!department || department.tenantId !== authContext.tenantId) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: departments_1.DEPARTMENT_NOT_FOUND_MESSAGE,
            });
        }
        if (!isArchivedDepartment(department)) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: departments_1.DEPARTMENT_HARD_DELETE_ACTIVE_MESSAGE,
            });
        }
        const purgeSummary = await hardDeleteDepartmentOwnedRecords(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        await ctx.db.delete(args.departmentId);
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildDepartmentAuditEntry({
            action: "hard_delete",
            actorUserId: authContext.userId,
            departmentId: args.departmentId,
            event: audit_1.AUDIT_EVENT_NAMES.departmentHardDeleted,
            metadata: {
                departmentCode: department.code,
                departmentName: department.name,
                purgeSummary,
                summary: `Permanently deleted archived department ${department.name}.`,
            },
            tenantId: authContext.tenantId,
        }));
        return {
            departmentId: args.departmentId,
            purgeSummary,
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
        appUrl: values_1.v.optional(values_1.v.string()),
        code: values_1.v.string(),
        departmentId: departmentIdValidator,
        departmentName: values_1.v.string(),
        email: values_1.v.string(),
    },
    returns: values_1.v.object({
        deliveryStatus: values_1.v.union(values_1.v.literal("queued"), values_1.v.literal("sent")),
    }),
    handler: async (ctx, args) => {
        const tenantUser = await loadDepartmentActionContext(ctx);
        const emailResult = (0, input_1.validateEmailInput)(args.email);
        if (!emailResult.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "email",
                message: emailResult.issue.message,
            });
        }
        const normalizedEmail = (0, input_1.normalizeAuthEmail)(emailResult.value);
        const syncResult = await ctx.runMutation("functions/departments:syncDepartmentCodeForDelivery", {
            code: args.code,
            departmentId: args.departmentId,
            tenantId: tenantUser.tenantId,
            tenantUserId: tenantUser._id,
        });
        const loginUrl = (0, access_codes_1.buildAbsoluteAccessCodeLoginUrl)({
            appUrl: args.appUrl,
            loginPath: access_codes_1.ACCESS_CODE_LOGIN_URL_PATH,
        });
        const idempotencyKey = `department-code:${args.departmentId}:${normalizedEmail}:${syncResult.code}`;
        const subject = `${syncResult.tenantName} department code for ${syncResult.departmentName}`;
        if (shouldCaptureDepartmentCodeEmailsDirectly()) {
            await sendDepartmentCodeEmailDirect({
                code: syncResult.code,
                departmentName: syncResult.departmentName,
                email: normalizedEmail,
                idempotencyKey,
                loginUrl,
                subject,
                tenantName: syncResult.tenantName,
            });
        }
        else {
            await ctx.runAction("actions/email:queueTransactionalEmail", {
                idempotencyKey,
                subject,
                template: "access-code-delivery",
                templateProps: {
                    accessCode: syncResult.code,
                    departmentName: syncResult.departmentName,
                    expirationLabel: "No expiration",
                    loginUrl,
                    tenantName: syncResult.tenantName,
                },
                to: normalizedEmail,
            });
        }
        return {
            deliveryStatus: "queued",
        };
    },
});
exports.syncDepartmentCodeForDelivery = (0, server_1.internalMutation)({
    args: {
        code: values_1.v.string(),
        departmentId: departmentIdValidator,
        tenantId: values_1.v.id("tenants"),
        tenantUserId: values_1.v.id("tenantUsers"),
    },
    returns: values_1.v.object({
        code: values_1.v.string(),
        departmentName: values_1.v.string(),
        tenantName: values_1.v.string(),
    }),
    handler: async (ctx, args) => {
        const [tenant, department] = await Promise.all([
            ctx.db.get(args.tenantId),
            getActiveDepartmentForTenant(ctx, {
                departmentId: args.departmentId,
                tenantId: args.tenantId,
            }),
        ]);
        if (!tenant) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }
        const normalizedCode = (0, departments_1.normalizeDepartmentCode)(args.code);
        const codeValidation = (0, departments_1.validateDepartmentCode)(normalizedCode);
        if (!codeValidation.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "code",
                message: codeValidation.message,
            });
        }
        await assertDepartmentUnique(ctx, {
            excludeDepartmentId: args.departmentId,
            normalizedCode,
            normalizedName: department.normalizedName,
            normalizedVoteNumber: department.normalizedVoteNumber ??
                (0, departments_1.normalizeDepartmentVoteNumber)(department.voteNumber ?? department.code),
            tenantId: args.tenantId,
        });
        const now = Date.now();
        const codeHash = await (0, department_user_access_1.hashDepartmentUserAccessCode)(normalizedCode);
        const activeCodes = await ctx.db
            .query("departmentAccessCodes")
            .withIndex("by_departmentId_isActive", (q) => q.eq("departmentId", args.departmentId).eq("isActive", true))
            .collect();
        const matchingActiveCode = activeCodes.find((accessCode) => accessCode.codeHash === codeHash);
        for (const accessCode of activeCodes) {
            if (accessCode.tenantId !== args.tenantId || accessCode._id === matchingActiveCode?._id) {
                continue;
            }
            await ctx.db.patch(accessCode._id, {
                isActive: false,
                revokedAt: now,
                revokedByTenantUserId: args.tenantUserId,
                revocationReason: "rotated",
                updatedAt: now,
            });
        }
        if (matchingActiveCode) {
            await ctx.db.patch(matchingActiveCode._id, {
                expiresAt: DEPARTMENT_CODE_LOGIN_EXPIRATION_AT,
                updatedAt: now,
            });
        }
        else {
            await ctx.db.insert("departmentAccessCodes", {
                codeHash,
                codeSuffix: (0, department_user_access_1.getDepartmentUserAccessCodeSuffix)(normalizedCode),
                createdAt: now,
                deliveryAttemptCount: 0,
                departmentId: args.departmentId,
                expiresAt: DEPARTMENT_CODE_LOGIN_EXPIRATION_AT,
                isActive: true,
                issuedByTenantUserId: args.tenantUserId,
                tenantId: args.tenantId,
                updatedAt: now,
            });
        }
        if (department.code !== normalizedCode || department.normalizedCode !== normalizedCode) {
            await ctx.db.patch(args.departmentId, {
                code: normalizedCode,
                normalizedCode,
                updatedAt: now,
            });
        }
        return {
            code: normalizedCode,
            departmentName: department.name,
            tenantName: tenant.name,
        };
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
    const [codeMatches, nameMatches, tenantDepartments] = await Promise.all([
        ctx.db
            .query("departments")
            .withIndex("by_tenantId_normalizedCode", (q) => q.eq("tenantId", args.tenantId).eq("normalizedCode", args.normalizedCode))
            .collect(),
        ctx.db
            .query("departments")
            .withIndex("by_tenantId_normalizedName", (q) => q.eq("tenantId", args.tenantId).eq("normalizedName", args.normalizedName))
            .collect(),
        ctx.db
            .query("departments")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
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
    const hasVoteNumberConflict = tenantDepartments.some((department) => isActiveDepartment(department) &&
        (args.excludeDepartmentId ? department._id !== args.excludeDepartmentId : true) &&
        getComparableNormalizedVoteNumber(department) === args.normalizedVoteNumber);
    if (hasVoteNumberConflict) {
        throw new values_1.ConvexError({
            code: "ALREADY_EXISTS",
            field: "voteNumber",
            message: departments_1.DEPARTMENT_VOTE_NUMBER_EXISTS_MESSAGE,
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
async function deactivateDepartmentUserAccess(ctx, args) {
    const [profiles, accessCodes] = await Promise.all([
        ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_departmentId_email", (q) => q.eq("departmentId", args.departmentId))
            .collect(),
        ctx.db
            .query("departmentAccessCodes")
            .withIndex("by_departmentId_isActive", (q) => q.eq("departmentId", args.departmentId).eq("isActive", true))
            .collect(),
    ]);
    for (const profile of profiles) {
        if (profile.tenantId !== args.tenantId || !profile.isActive) {
            continue;
        }
        await ctx.db.patch(profile._id, {
            deactivatedAt: args.now,
            isActive: false,
            updatedAt: args.now,
        });
    }
    for (const accessCode of accessCodes) {
        if (accessCode.tenantId !== args.tenantId || !accessCode.isActive) {
            continue;
        }
        await ctx.db.patch(accessCode._id, {
            isActive: false,
            revokedAt: args.now,
            revokedByTenantUserId: args.tenantUserId,
            revocationReason: "deactivated",
            updatedAt: args.now,
        });
    }
}
async function hardDeleteDepartmentOwnedRecords(ctx, args) {
    const [plans, directCategoryRequests, directItemRequests, accessCodes, accessCodeEvents, profiles] = await Promise.all([
        ctx.db
            .query("plans")
            .withIndex("by_departmentId", (q) => q.eq("departmentId", args.departmentId))
            .collect(),
        ctx.db
            .query("categoryRequests")
            .withIndex("by_tenantId_departmentId_createdAt", (q) => q.eq("tenantId", args.tenantId).eq("departmentId", args.departmentId))
            .collect(),
        ctx.db
            .query("itemRequests")
            .withIndex("by_tenantId_departmentId_createdAt", (q) => q.eq("tenantId", args.tenantId).eq("departmentId", args.departmentId))
            .collect(),
        ctx.db
            .query("departmentAccessCodes")
            .withIndex("by_departmentId", (q) => q.eq("departmentId", args.departmentId))
            .collect(),
        ctx.db
            .query("departmentAccessCodeEvents")
            .withIndex("by_departmentId_occurredAt", (q) => q.eq("departmentId", args.departmentId))
            .collect(),
        ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_departmentId_email", (q) => q.eq("departmentId", args.departmentId))
            .collect(),
    ]);
    const planIds = new Set(plans.map((plan) => String(plan._id)));
    const categoryRequestsById = new Map(directCategoryRequests.map((request) => [String(request._id), request]));
    const itemRequestsById = new Map(directItemRequests.map((request) => [String(request._id), request]));
    const accessCodeIds = new Set(accessCodes.map((accessCode) => String(accessCode._id)));
    const [planChildren, accessCodeChildren, tenantChallenges] = await Promise.all([
        Promise.all(plans.map(async (plan) => {
            const [comments, decisions, redraftRequests, snapshots, categoryRequests, itemRequests] = await Promise.all([
                ctx.db
                    .query("planReviewComments")
                    .withIndex("by_planId_createdAt", (q) => q.eq("planId", plan._id))
                    .collect(),
                ctx.db
                    .query("planReviewDecisions")
                    .withIndex("by_planId_decidedAt", (q) => q.eq("planId", plan._id))
                    .collect(),
                ctx.db
                    .query("planRedraftRequests")
                    .withIndex("by_planId_status", (q) => q.eq("planId", plan._id))
                    .collect(),
                ctx.db
                    .query("planSubmissionSnapshots")
                    .withIndex("by_planId_submittedAt", (q) => q.eq("planId", plan._id))
                    .collect(),
                ctx.db
                    .query("categoryRequests")
                    .withIndex("by_planId", (q) => q.eq("planId", plan._id))
                    .collect(),
                ctx.db
                    .query("itemRequests")
                    .withIndex("by_planId", (q) => q.eq("planId", plan._id))
                    .collect(),
            ]);
            return {
                categoryRequests,
                comments,
                decisions,
                itemRequests,
                redraftRequests,
                snapshots,
            };
        })),
        Promise.all(accessCodes.map(async (accessCode) => {
            const [challenges, loginAttempts] = await Promise.all([
                ctx.db
                    .query("departmentUserAuthChallenges")
                    .withIndex("by_accessCodeId", (q) => q.eq("accessCodeId", accessCode._id))
                    .collect(),
                ctx.db
                    .query("departmentUserLoginAttempts")
                    .withIndex("by_accessCodeId", (q) => q.eq("accessCodeId", accessCode._id))
                    .collect(),
            ]);
            return {
                challenges,
                loginAttempts,
            };
        })),
        ctx.db
            .query("departmentUserAuthChallenges")
            .withIndex("by_expiresAt")
            .collect(),
    ]);
    for (const children of planChildren) {
        for (const request of children.categoryRequests) {
            categoryRequestsById.set(String(request._id), request);
        }
        for (const request of children.itemRequests) {
            itemRequestsById.set(String(request._id), request);
        }
    }
    const authChallengesById = new Map();
    const loginAttemptsById = new Map();
    for (const children of accessCodeChildren) {
        for (const challenge of children.challenges) {
            authChallengesById.set(String(challenge._id), challenge);
        }
        for (const loginAttempt of children.loginAttempts) {
            loginAttemptsById.set(String(loginAttempt._id), loginAttempt);
        }
    }
    for (const challenge of tenantChallenges) {
        if (challenge.tenantId === args.tenantId &&
            challenge.departmentId === args.departmentId) {
            authChallengesById.set(String(challenge._id), challenge);
        }
    }
    const planComments = planChildren.flatMap((children) => children.comments);
    const planDecisions = planChildren.flatMap((children) => children.decisions);
    const planRedraftRequests = planChildren.flatMap((children) => children.redraftRequests);
    const planSnapshots = planChildren.flatMap((children) => children.snapshots);
    const categoryRequests = Array.from(categoryRequestsById.values()).filter((request) => request.tenantId === args.tenantId &&
        (request.departmentId === args.departmentId || planIds.has(String(request.planId))));
    const itemRequests = Array.from(itemRequestsById.values()).filter((request) => request.tenantId === args.tenantId &&
        (request.departmentId === args.departmentId || planIds.has(String(request.planId))));
    const authChallenges = Array.from(authChallengesById.values());
    const loginAttempts = Array.from(loginAttemptsById.values());
    const ownedAccessCodeEvents = accessCodeEvents.filter((event) => event.tenantId === args.tenantId &&
        (event.departmentId === args.departmentId || accessCodeIds.has(String(event.accessCodeId))));
    const ownedProfiles = profiles.filter((profile) => profile.tenantId === args.tenantId && profile.departmentId === args.departmentId);
    for (const row of itemRequests)
        await ctx.db.delete(row._id);
    for (const row of categoryRequests)
        await ctx.db.delete(row._id);
    for (const row of planComments)
        await ctx.db.delete(row._id);
    for (const row of planDecisions)
        await ctx.db.delete(row._id);
    for (const row of planRedraftRequests)
        await ctx.db.delete(row._id);
    for (const row of planSnapshots)
        await ctx.db.delete(row._id);
    for (const row of plans)
        await ctx.db.delete(row._id);
    for (const row of authChallenges)
        await ctx.db.delete(row._id);
    for (const row of loginAttempts)
        await ctx.db.delete(row._id);
    for (const row of ownedAccessCodeEvents)
        await ctx.db.delete(row._id);
    for (const row of accessCodes)
        await ctx.db.delete(row._id);
    for (const row of ownedProfiles)
        await ctx.db.delete(row._id);
    return {
        accessCodeEvents: ownedAccessCodeEvents.length,
        accessCodes: accessCodes.length,
        categoryRequests: categoryRequests.length,
        departmentUserAuthChallenges: authChallenges.length,
        departmentUserLoginAttempts: loginAttempts.length,
        departmentUserProfiles: ownedProfiles.length,
        itemRequests: itemRequests.length,
        planRedraftRequests: planRedraftRequests.length,
        planReviewComments: planComments.length,
        planReviewDecisions: planDecisions.length,
        planSubmissionSnapshots: planSnapshots.length,
        plans: plans.length,
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
function isArchivedDepartment(department) {
    return !department.isActive && typeof department.deletedAt === "number";
}
function getComparableNormalizedCode(department) {
    return department.normalizedCode;
}
function getComparableNormalizedName(department) {
    return department.normalizedName;
}
function getComparableNormalizedVoteNumber(department) {
    return department.normalizedVoteNumber ??
        (0, departments_1.normalizeDepartmentVoteNumber)(department.voteNumber ?? department.code);
}
