"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSubmissionMonitoringReminders = exports.getProcurementOfficerSubmissionReviewTarget = exports.getProcurementOfficerSubmissionMonitoringWorkspace = exports.getProcurementOfficerSubmissionQueue = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const dashboard_1 = require("../../lib/procurement-officer/dashboard");
const access_codes_1 = require("../../lib/procurement-officer/access-codes");
const submission_monitoring_1 = require("../../lib/procurement-officer/submission-monitoring");
const submissions_1 = require("../../lib/procurement-officer/submissions");
const revision_deadline_1 = require("../../lib/plans/revision-deadline");
const _roleGuard_1 = require("./_roleGuard");
const _helpers_1 = require("../actions/_helpers");
const audit_1 = require("../../lib/shared/security/audit");
const reviewTargetStateValidator = values_1.v.union(values_1.v.literal("ready"), values_1.v.literal("redirect"));
const submissionReviewTargetValidator = values_1.v.object({
    message: values_1.v.union(values_1.v.string(), values_1.v.null()),
    row: values_1.v.union(values_1.v.object({
        approvedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        departmentCode: values_1.v.union(values_1.v.string(), values_1.v.null()),
        departmentId: values_1.v.union(values_1.v.string(), values_1.v.null()),
        departmentName: values_1.v.string(),
        estimatedBudgetUsed: values_1.v.number(),
        fiscalYear: values_1.v.string(),
        itemCount: values_1.v.number(),
        pendingRedraftRequestedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        pendingRedraftRequestId: values_1.v.union(values_1.v.string(), values_1.v.null()),
        planId: values_1.v.string(),
        rejectedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        reviewHref: values_1.v.string(),
        sortSubmittedAt: values_1.v.number(),
        status: values_1.v.union(values_1.v.literal("submitted"), values_1.v.literal("approved"), values_1.v.literal("rejected")),
        statusLabel: values_1.v.string(),
        submittedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        submittedAtLabel: values_1.v.string(),
        totalAmountLabel: values_1.v.string(),
        updatedAt: values_1.v.number(),
        urgencyLabel: values_1.v.union(values_1.v.string(), values_1.v.null()),
    }), values_1.v.null()),
    state: reviewTargetStateValidator,
});
function buildSubmissionSourceRow(args) {
    if (args.plan.status === "draft") {
        return null;
    }
    return {
        approvedAt: args.plan.approvedAt ?? null,
        departmentCode: args.department?.code ?? null,
        departmentId: args.department?.id ?? null,
        departmentName: args.department
            ? args.department.isActive
                ? args.department.name
                : `${args.department.name} (archived)`
            : "Archived department",
        estimatedBudgetUsed: args.plan.estimatedBudgetUsed,
        fiscalYear: args.plan.fiscalYear,
        itemCount: args.plan.itemCount,
        pendingRedraftRequestedAt: args.pendingRedraftRequest?.createdAt ?? null,
        pendingRedraftRequestId: args.pendingRedraftRequest
            ? String(args.pendingRedraftRequest._id)
            : null,
        planId: String(args.plan._id),
        rejectedAt: args.plan.rejectedAt ?? null,
        status: args.plan.status,
        submittedAt: args.plan.submittedAt ?? null,
        updatedAt: args.plan.updatedAt,
    };
}
exports.getProcurementOfficerSubmissionQueue = (0, server_1.query)({
    args: {
        selectedFiscalYear: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const tenant = await ctx.db.get(authContext.tenantId);
        if (!tenant) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }
        const now = Date.now();
        const [departments, plans, pendingRedraftRequests] = await Promise.all([
            ctx.db
                .query("departments")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("plans")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("planRedraftRequests")
                .withIndex("by_tenantId_status", (q) => q.eq("tenantId", authContext.tenantId).eq("status", "pending"))
                .collect(),
        ]);
        const selectedFiscalYear = args.selectedFiscalYear ??
            (0, dashboard_1.getProcurementFiscalYearForDate)(now, {
                fiscalYearStartMonth: tenant.fiscalYearStartMonth,
                timeZone: tenant.timeZone,
            }).key;
        const departmentMap = new Map(departments.map((department) => [String(department._id), department]));
        const pendingRedraftRequestByPlanId = new Map(pendingRedraftRequests.map((request) => [String(request.planId), request]));
        const queueSourceRows = plans
            .map((plan) => buildSubmissionSourceRow({
            department: (() => {
                const department = departmentMap.get(String(plan.departmentId));
                if (!department) {
                    return null;
                }
                return {
                    code: department.code,
                    id: String(department._id),
                    isActive: department.isActive,
                    name: department.name,
                };
            })(),
            plan,
            pendingRedraftRequest: pendingRedraftRequestByPlanId.get(String(plan._id)) ?? null,
        }))
            .filter((row) => row !== null);
        const scopedRows = queueSourceRows
            .filter((row) => row.fiscalYear === selectedFiscalYear)
            .map((row) => (0, submissions_1.shapeProcurementOfficerSubmissionRow)({
            now,
            row,
            tenantTimeZone: tenant.timeZone,
        }));
        const departmentsInScope = Array.from(new Map(scopedRows
            .filter((row) => row.departmentId)
            .map((row) => [
            row.departmentId,
            {
                id: row.departmentId,
                name: row.departmentName,
            },
        ])).values()).sort((left, right) => left.name.localeCompare(right.name));
        return {
            departments: departmentsInScope,
            meta: {
                currentFiscalYear: (0, dashboard_1.getProcurementFiscalYearForDate)(now, {
                    fiscalYearStartMonth: tenant.fiscalYearStartMonth,
                    timeZone: tenant.timeZone,
                }).key,
                selectedFiscalYear,
                selectedFiscalYearCount: scopedRows.length,
                selectedFiscalYearLabel: (0, dashboard_1.formatProcurementFiscalYearLabel)(selectedFiscalYear),
                tenantTimeZone: tenant.timeZone ?? null,
                totalCount: queueSourceRows.length,
            },
            rows: (0, submissions_1.sortProcurementOfficerSubmissionRows)(scopedRows),
        };
    },
});
function resolveDepartmentEffectiveSubmissionDeadlineAt(args) {
    if (typeof args.departmentSubmissionEndsAt === "number" &&
        typeof args.sharedSubmissionEndsAt === "number") {
        return Math.max(args.departmentSubmissionEndsAt, args.sharedSubmissionEndsAt);
    }
    return args.sharedSubmissionEndsAt ?? args.departmentSubmissionEndsAt ?? null;
}
exports.getProcurementOfficerSubmissionMonitoringWorkspace = (0, server_1.query)({
    args: {
        selectedFiscalYear: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const tenant = await ctx.db.get(authContext.tenantId);
        if (!tenant) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }
        const now = Date.now();
        const [departments, plans, submissionDeadlines, planReviewDecisions, planSubmissionSnapshots, departmentUserProfiles, tenantUsers, departmentAccessCodes,] = await Promise.all([
            ctx.db
                .query("departments")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("plans")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("submissionDeadlines")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("planReviewDecisions")
                .withIndex("by_tenantId_lifecycleStatus_decidedAt", (q) => q.eq("tenantId", authContext.tenantId).eq("lifecycleStatus", "active"))
                .collect(),
            ctx.db
                .query("planSubmissionSnapshots")
                .withIndex("by_tenantId_departmentId_fiscalYear_capturedAt", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("departmentUserProfiles")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("tenantUsers")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("departmentAccessCodes")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
        ]);
        const userDocs = await Promise.all(Array.from(new Set(tenantUsers.map((tenantUser) => String(tenantUser.userId)))).map(async (userId) => {
            const normalized = ctx.db.normalizeId("users", userId);
            return normalized ? await ctx.db.get(normalized) : null;
        }));
        const activeDepartments = departments.filter((department) => department.isActive && department.deletedAt === undefined);
        const requestedFiscalYear = args.selectedFiscalYear ?? null;
        const selectedFiscalYear = (0, dashboard_1.buildAvailableProcurementFiscalYears)({
            departments: activeDepartments.map((department) => ({
                id: String(department._id),
                isActive: department.isActive,
                submissionEndsAt: department.submissionEndsAt,
                submissionStartsAt: department.submissionStartsAt,
            })),
            existingFiscalYearKeys: submissionDeadlines.map((deadline) => deadline.fiscalYearKey),
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            now,
            requestedFiscalYear,
            timeZone: tenant.timeZone,
        })[0] ??
            (0, dashboard_1.getProcurementFiscalYearForDate)(now, {
                fiscalYearStartMonth: tenant.fiscalYearStartMonth,
                timeZone: tenant.timeZone,
            }).key;
        const departmentsInScope = activeDepartments.filter((department) => (0, dashboard_1.getDepartmentFiscalYearKey)({
            id: String(department._id),
            isActive: department.isActive,
            submissionEndsAt: department.submissionEndsAt,
            submissionStartsAt: department.submissionStartsAt,
        }, {
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            timeZone: tenant.timeZone,
        }) === selectedFiscalYear);
        const scopedDepartments = departmentsInScope.length > 0 ? departmentsInScope : activeDepartments;
        const departmentById = new Map(scopedDepartments.map((department) => [String(department._id), department]));
        const sharedDeadline = (0, dashboard_1.deriveSharedSubmissionDeadline)({
            deadlineRecord: submissionDeadlines.find((deadline) => deadline.fiscalYearKey === selectedFiscalYear) ?? null,
            departments: scopedDepartments.map((department) => ({
                id: String(department._id),
                isActive: department.isActive,
                submissionEndsAt: department.submissionEndsAt,
                submissionStartsAt: department.submissionStartsAt,
            })),
            fiscalYearKey: selectedFiscalYear,
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            now,
            tenantTimeZone: tenant.timeZone,
        });
        const snapshotsByPlanId = new Map();
        for (const snapshot of planSubmissionSnapshots) {
            const key = String(snapshot.planId);
            const existing = snapshotsByPlanId.get(key) ?? [];
            existing.push(snapshot);
            snapshotsByPlanId.set(key, existing);
        }
        const activeDecisionByPlanId = new Map();
        for (const decision of planReviewDecisions) {
            const key = String(decision.planId);
            const existing = activeDecisionByPlanId.get(key);
            if (!existing || decision.decidedAt >= existing.decidedAt) {
                activeDecisionByPlanId.set(key, decision);
            }
        }
        const decisionsByPlanId = new Map();
        for (const decision of planReviewDecisions) {
            const key = String(decision.planId);
            const existing = decisionsByPlanId.get(key) ?? [];
            existing.push(decision);
            decisionsByPlanId.set(key, existing);
        }
        const tenantUserById = new Map(tenantUsers.map((tenantUser) => [String(tenantUser._id), tenantUser]));
        const userById = new Map(userDocs
            .filter((user) => Boolean(user))
            .map((user) => [String(user._id), user]));
        const contactsByDepartmentId = new Map();
        for (const profile of departmentUserProfiles) {
            const tenantUser = tenantUserById.get(String(profile.tenantUserId));
            if (!tenantUser ||
                !tenantUser.isActive ||
                tenantUser.role !== "department_user" ||
                !profile.isActive ||
                profile.deactivatedAt != null) {
                continue;
            }
            const user = userById.get(String(tenantUser.userId));
            const key = String(profile.departmentId);
            const existing = contactsByDepartmentId.get(key) ?? [];
            existing.push({
                email: typeof user?.email === "string" ? user.email : null,
                isActive: true,
                name: typeof user?.name === "string" ? user.name : null,
            });
            contactsByDepartmentId.set(key, existing);
        }
        const safeAccessByDepartmentId = new Set(departmentAccessCodes
            .filter((accessCode) => accessCode.isActive &&
            accessCode.revokedAt == null &&
            accessCode.expiresAt > now)
            .map((accessCode) => String(accessCode.departmentId)));
        const plansByDepartmentId = new Map();
        for (const plan of plans) {
            const key = String(plan.departmentId);
            const existing = plansByDepartmentId.get(key) ?? [];
            const submissionDeadlineAt = resolveDepartmentEffectiveSubmissionDeadlineAt({
                departmentSubmissionEndsAt: departmentById.get(key)?.submissionEndsAt,
                sharedSubmissionEndsAt: sharedDeadline.deadlineAt,
            });
            const mapReviewDecision = (decision) => ({
                comment: decision.comment,
                decidedAt: decision.decidedAt,
                decisionType: decision.decisionType,
                effectiveRevisionDeadlineAt: (0, revision_deadline_1.deriveDepartmentUserEffectiveRevisionDeadline)({
                    decidedAt: decision.decidedAt,
                    decisionType: decision.decisionType,
                    revisionDeadlineAt: decision.revisionDeadlineAt ?? null,
                    submissionDeadlineAt,
                }).effectiveDeadlineAt,
                revisionDeadlineAt: decision.revisionDeadlineAt ?? null,
            });
            existing.push({
                ...plan,
                departmentId: key,
                id: String(plan._id),
                latestDecision: (() => {
                    const decision = activeDecisionByPlanId.get(String(plan._id));
                    if (!decision) {
                        return null;
                    }
                    return mapReviewDecision(decision);
                })(),
                reviewDecisions: (decisionsByPlanId.get(String(plan._id)) ?? []).map((decision) => ({
                    ...mapReviewDecision(decision),
                    id: String(decision._id),
                    lifecycleStatus: decision.lifecycleStatus,
                })),
                submissionSnapshots: (snapshotsByPlanId.get(String(plan._id)) ?? []).map((snapshot) => ({
                    capturedAt: snapshot.capturedAt,
                    lifecycleStatus: snapshot.lifecycleStatus ?? null,
                    submissionReference: snapshot.submissionReference ?? null,
                    submissionSequence: snapshot.submissionSequence ?? null,
                    submittedAt: snapshot.submittedAt,
                    withdrawnAt: snapshot.withdrawnAt ?? null,
                })),
            });
            plansByDepartmentId.set(key, existing);
        }
        const rows = scopedDepartments
            .map((department) => {
            const canonicalPlan = (0, submission_monitoring_1.selectCanonicalMonitoringPlan)(plansByDepartmentId.get(String(department._id)) ?? [], selectedFiscalYear);
            return (0, submission_monitoring_1.buildProcurementOfficerMonitoringRow)({
                contacts: contactsByDepartmentId.get(String(department._id)) ?? [],
                deadlineAt: sharedDeadline.deadlineAt,
                department: {
                    code: department.code,
                    id: String(department._id),
                    isActive: department.isActive,
                    name: department.name,
                },
                fiscalYear: selectedFiscalYear,
                hasSafeDuAccess: safeAccessByDepartmentId.has(String(department._id)),
                now,
                plan: canonicalPlan,
                tenantTimeZone: tenant.timeZone,
            });
        })
            .sort((left, right) => left.departmentName.localeCompare(right.departmentName));
        return {
            meta: {
                currentFiscalYear: (0, dashboard_1.getProcurementFiscalYearForDate)(now, {
                    fiscalYearStartMonth: tenant.fiscalYearStartMonth,
                    timeZone: tenant.timeZone,
                }).key,
                selectedFiscalYear,
                selectedFiscalYearLabel: (0, dashboard_1.formatProcurementFiscalYearLabel)(selectedFiscalYear),
                tenantTimeZone: tenant.timeZone ?? null,
            },
            rows,
            summary: (0, submission_monitoring_1.summarizeProcurementOfficerMonitoringRows)(rows),
        };
    },
});
exports.getProcurementOfficerSubmissionReviewTarget = (0, server_1.query)({
    args: {
        planId: values_1.v.string(),
    },
    returns: submissionReviewTargetValidator,
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const normalizedPlanId = ctx.db.normalizeId("plans", args.planId);
        const tenant = await ctx.db.get(authContext.tenantId);
        if (!tenant) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Tenant record not found",
            });
        }
        if (!normalizedPlanId) {
            return {
                message: "That plan is no longer available in the submission queue. It may have been withdrawn or moved out of scope.",
                row: null,
                state: "redirect",
            };
        }
        const plan = await ctx.db.get(normalizedPlanId);
        if (!plan || plan.tenantId !== authContext.tenantId || plan.status === "draft") {
            return {
                message: "That plan is no longer available in the submission queue. It may have been withdrawn or moved out of scope.",
                row: null,
                state: "redirect",
            };
        }
        const department = await ctx.db.get(plan.departmentId);
        const pendingRedraftRequest = await ctx.db
            .query("planRedraftRequests")
            .withIndex("by_planId_status", (q) => q.eq("planId", plan._id).eq("status", "pending"))
            .first();
        const sourceRow = buildSubmissionSourceRow({
            department: department
                ? {
                    code: department.code,
                    id: String(department._id),
                    isActive: department.isActive,
                    name: department.name,
                }
                : null,
            plan,
            pendingRedraftRequest,
        });
        if (!sourceRow) {
            return {
                message: "That plan is no longer available in the submission queue. It may have been withdrawn or moved out of scope.",
                row: null,
                state: "redirect",
            };
        }
        return {
            message: null,
            row: (0, submissions_1.shapeProcurementOfficerSubmissionRow)({
                row: sourceRow,
                tenantTimeZone: tenant.timeZone,
            }),
            state: "ready",
        };
    },
});
exports.sendSubmissionMonitoringReminders = (0, server_1.action)({
    args: {
        appUrl: values_1.v.optional(values_1.v.string()),
        departmentIds: values_1.v.array(values_1.v.string()),
        requestKey: values_1.v.optional(values_1.v.string()),
        selectedFiscalYear: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        if (actor.role !== "procurement_officer" || !actor.tenantId) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Procurement Officer access is required for this resource.",
            });
        }
        const workspace = (await ctx.runQuery("functions/procurementOfficerSubmissions:getProcurementOfficerSubmissionMonitoringWorkspace", {
            selectedFiscalYear: args.selectedFiscalYear,
        }));
        const requestedIds = new Set(args.departmentIds);
        const targetRows = workspace.rows.filter((row) => requestedIds.has(row.departmentId));
        const targetRowIds = new Set(targetRows.map((row) => row.departmentId));
        if (requestedIds.size === 0) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "No monitoring departments were selected for reminders.",
            });
        }
        const loginUrl = (0, access_codes_1.buildAbsoluteAccessCodeLoginUrl)({
            appUrl: args.appUrl,
            loginPath: access_codes_1.ACCESS_CODE_LOGIN_URL_PATH,
        });
        let queuedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        const results = [];
        for (const requestedId of requestedIds) {
            if (!targetRowIds.has(requestedId)) {
                skippedCount += 1;
                results.push({
                    departmentId: requestedId,
                    departmentName: null,
                    outcome: "skipped",
                    reason: "stale_target",
                });
            }
        }
        const reminderWindow = (0, submission_monitoring_1.buildProcurementOfficerSubmissionReminderWindow)({
            now: Date.now(),
        });
        for (const row of targetRows) {
            if (!row.reminderEligibility.eligible || typeof row.dueAt !== "number") {
                skippedCount += 1;
                results.push({
                    departmentId: row.departmentId,
                    departmentName: row.departmentName,
                    outcome: "skipped",
                    reason: row.reminderEligibility.reason ?? "not eligible",
                });
                continue;
            }
            if (row.recipientEmails.length === 0) {
                skippedCount += 1;
                results.push({
                    departmentId: row.departmentId,
                    departmentName: row.departmentName,
                    outcome: "skipped",
                    reason: "missing_contact_email",
                });
                continue;
            }
            let departmentQueued = 0;
            let departmentFailed = 0;
            for (const recipientEmail of row.recipientEmails) {
                try {
                    await ctx.runAction("actions/email:queueTransactionalEmail", {
                        idempotencyKey: (0, submission_monitoring_1.buildProcurementOfficerSubmissionReminderIdempotencyKey)({
                            departmentId: row.departmentId,
                            dueAt: row.dueAt,
                            fiscalYear: args.selectedFiscalYear,
                            reminderWindow,
                            reason: row.status,
                            tenantId: actor.tenantId,
                        }) + `:${recipientEmail}`,
                        subject: `${row.departmentName} submission reminder`,
                        template: "submission-reminder",
                        templateProps: {
                            deadlineLabel: row.dueLabel ?? "Unavailable",
                            departmentName: row.departmentName,
                            fiscalYearLabel: args.selectedFiscalYear,
                            loginUrl,
                            statusLabel: row.status,
                        },
                        to: recipientEmail,
                    });
                    departmentQueued += 1;
                }
                catch {
                    departmentFailed += 1;
                }
            }
            if (departmentQueued > 0) {
                queuedCount += 1;
                results.push({
                    departmentId: row.departmentId,
                    departmentName: row.departmentName,
                    outcome: departmentFailed > 0 ? "queued" : "queued",
                    reason: departmentFailed > 0 ? `${departmentFailed} recipient(s) failed` : null,
                });
            }
            else {
                failedCount += 1;
                results.push({
                    departmentId: row.departmentId,
                    departmentName: row.departmentName,
                    outcome: "failed",
                    reason: "queue_failed",
                });
            }
        }
        await ctx.runMutation("functions/auditLogs:appendAuditLogFromAction", {
            action: "email_queue",
            actorRole: actor.role,
            actorState: (0, audit_1.createAuthenticatedAuditActor)({
                role: actor.role,
                userId: actor.userId,
            }).state,
            actorUserId: actor.userId,
            entityType: "submission_monitoring",
            event: "submission_monitoring.reminders_queued",
            metadata: {
                failedCount,
                fiscalYear: args.selectedFiscalYear,
                queuedCount,
                reminderWindow,
                requestKey: args.requestKey ?? null,
                skippedCount,
            },
            outcome: failedCount > 0 ? audit_1.AUDIT_OUTCOMES.failed : audit_1.AUDIT_OUTCOMES.queued,
            sourceTenantId: actor.tenantId,
            tableName: "plans",
            targetTenantId: actor.tenantId,
            timestamp: Date.now(),
        }).catch(() => undefined);
        return {
            failedCount,
            queuedCount,
            results,
            skippedCount,
        };
    },
});
