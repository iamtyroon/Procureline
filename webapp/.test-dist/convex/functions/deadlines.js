"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertSubmissionDeadline = exports.getDeadlineActionTenant = exports.claimReminderJobDispatch = exports.recordReminderJobCancellationOutcome = exports.failReminderJobQueueing = exports.finalizeReminderJobQueueing = exports.saveSubmissionDeadlineState = exports.getDeadlinesWorkspace = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const audit_1 = require("../../lib/security/audit");
const deadlines_1 = require("../../lib/procurement-officer/deadlines");
const dashboard_1 = require("../../lib/procurement-officer/dashboard");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const _tenantGuard_1 = require("./_tenantGuard");
function asDepartmentWindowRecord(department) {
    return {
        id: String(department._id),
        isActive: department.isActive,
        submissionEndsAt: department.submissionEndsAt,
        submissionStartsAt: department.submissionStartsAt,
    };
}
function isActiveDepartment(department) {
    return department.isActive && department.deletedAt === undefined;
}
function buildDeadlineAuditEntry(args) {
    return {
        action: "save",
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "procurement_officer",
            userId: String(args.actorUserId),
        }),
        entityType: "submission_deadline",
        event: "submission_deadline.saved",
        metadata: {
            fiscalYearKey: args.fiscalYearKey,
            ...args.metadata,
        },
        outcome: args.outcome,
        recordId: args.recordId,
        sourceTenantId: String(args.tenantId),
        tableName: "submissionDeadlines",
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    };
}
async function loadProcurementOfficerQueryContext(ctx) {
    const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
    const tenant = await ctx.db.get(authContext.tenantId);
    if (!tenant) {
        throw new values_1.ConvexError({
            code: "NOT_FOUND",
            message: "Tenant record not found",
        });
    }
    return {
        authContext,
        tenant,
    };
}
async function loadProcurementOfficerMutationContext(ctx) {
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
async function getTenantSubmissionDeadlineRecord(ctx, args) {
    return ((await ctx.db
        .query("submissionDeadlines")
        .withIndex("by_tenantId_fiscalYearKey", (q) => q.eq("tenantId", args.tenantId).eq("fiscalYearKey", args.fiscalYearKey))
        .first()) ?? null);
}
async function getActiveDeadlineRecipientEmails(ctx, args) {
    if (args.departmentIds.length === 0) {
        return [];
    }
    const profiles = (await ctx.db
        .query("departmentUserProfiles")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .collect())
        .filter((profile) => profile.isActive &&
        args.departmentIds.some((departmentId) => departmentId === profile.departmentId));
    const tenantUsers = await ctx.db
        .query("tenantUsers")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .collect();
    const tenantUsersById = new Map(tenantUsers.map((tenantUser) => [String(tenantUser._id), tenantUser]));
    const relevantUserIds = Array.from(new Set(profiles
        .map((profile) => tenantUsersById.get(String(profile.tenantUserId))?.userId ?? null)
        .filter((userId) => userId !== null)));
    const userDocs = await Promise.all(relevantUserIds.map(async (userId) => await ctx.db.get(userId)));
    return Array.from(new Set(userDocs
        .map((user) => typeof user?.email === "string" ? user.email.trim() : null)
        .filter((email) => Boolean(email)))).sort((left, right) => left.localeCompare(right));
}
function buildDeadlineAnnouncement(args) {
    const deadlineLabel = (0, deadlines_1.formatDeadlineDateTime)(args.submissionEndsAt, args.timeZone, {
        includeTimeZoneName: true,
    });
    if (args.changeType === "extension") {
        return {
            message: `The shared submission deadline was extended to ${deadlineLabel}.`,
            title: "Submission deadline extended",
        };
    }
    if (args.changeType === "tightened") {
        return {
            message: `The shared submission deadline now closes on ${deadlineLabel}. Review your remaining work immediately.`,
            title: "Submission deadline updated",
        };
    }
    if (args.changeType === "edited") {
        return {
            message: `The shared submission window was updated and now closes on ${deadlineLabel}.`,
            title: "Submission window updated",
        };
    }
    return {
        message: `The shared submission window is now active and closes on ${deadlineLabel}.`,
        title: "Submission window configured",
    };
}
function buildExtensionEmailTemplateProps(args) {
    return {
        deadlineLabel: (0, deadlines_1.formatDeadlineDateTime)(args.submissionEndsAt, args.timeZone, {
            includeTimeZoneName: true,
        }),
        fiscalYearLabel: args.fiscalYearKey,
        heading: "Submission deadline extended",
        message: `Your Procurement Officer extended the shared submission deadline for ${args.fiscalYearKey}.`,
        tenantName: args.tenantName,
    };
}
function resolvePersistedChangeType(args) {
    if (args.changeType === "unchanged") {
        return args.hasCurrentRecord ? "edited" : "initial_setup";
    }
    return args.changeType;
}
exports.getDeadlinesWorkspace = (0, server_1.query)({
    args: {
        selectedFiscalYear: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenant } = await loadProcurementOfficerQueryContext(ctx);
        const departments = (await ctx.db
            .query("departments")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
            .collect())
            .filter(isActiveDepartment);
        const deadlineRecords = await ctx.db
            .query("submissionDeadlines")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
            .collect();
        const resolvedTimeZone = (0, deadlines_1.resolveDeadlineTimeZone)({
            tenantTimeZone: tenant.timeZone,
        });
        const fiscalYearOptions = (0, dashboard_1.buildAvailableProcurementFiscalYears)({
            departments: departments.map(asDepartmentWindowRecord),
            existingFiscalYearKeys: deadlineRecords.map((record) => record.fiscalYearKey),
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            now: Date.now(),
            requestedFiscalYear: args.selectedFiscalYear ?? null,
            timeZone: resolvedTimeZone.timeZone,
        });
        const selectedFiscalYear = args.selectedFiscalYear && fiscalYearOptions.includes(args.selectedFiscalYear)
            ? args.selectedFiscalYear
            : fiscalYearOptions[0] ??
                (0, deadlines_1.getCurrentFiscalYearKey)({
                    fiscalYearStartMonth: tenant.fiscalYearStartMonth,
                    timeZone: resolvedTimeZone.timeZone,
                });
        const currentDeadlineRecord = deadlineRecords.find((record) => record.fiscalYearKey === selectedFiscalYear) ?? null;
        const sharedDeadline = (0, dashboard_1.deriveSharedSubmissionDeadline)({
            deadlineRecord: currentDeadlineRecord
                ? {
                    announcementIssuedAt: currentDeadlineRecord.announcementIssuedAt,
                    announcementMessage: currentDeadlineRecord.announcementMessage,
                    announcementTitle: currentDeadlineRecord.announcementTitle,
                    deadlineVersion: currentDeadlineRecord.deadlineVersion,
                    fiscalYearKey: currentDeadlineRecord.fiscalYearKey,
                    reminderOffsets: currentDeadlineRecord.reminderOffsets,
                    submissionEndsAt: currentDeadlineRecord.submissionEndsAt,
                    submissionStartsAt: currentDeadlineRecord.submissionStartsAt,
                    timeZone: currentDeadlineRecord.timeZone,
                    updatedAt: currentDeadlineRecord.updatedAt,
                }
                : null,
            departments: departments.map(asDepartmentWindowRecord),
            fiscalYearKey: selectedFiscalYear,
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            now: Date.now(),
            tenantTimeZone: tenant.timeZone,
        });
        const activeDepartmentIds = departments.map((department) => department._id);
        const recipientEmails = await getActiveDeadlineRecipientEmails(ctx, {
            departmentIds: activeDepartmentIds,
            tenantId: authContext.tenantId,
        });
        const reminderJobs = currentDeadlineRecord
            ? await ctx.db
                .query("submissionDeadlineReminderJobs")
                .withIndex("by_submissionDeadlineId_version", (q) => q.eq("submissionDeadlineId", currentDeadlineRecord._id).eq("deadlineVersion", currentDeadlineRecord.deadlineVersion))
                .collect()
            : [];
        return {
            current: {
                announcementIssuedAt: currentDeadlineRecord?.announcementIssuedAt ?? null,
                announcementMessage: currentDeadlineRecord?.announcementMessage ?? null,
                announcementTitle: currentDeadlineRecord?.announcementTitle ?? null,
                changeType: currentDeadlineRecord?.lastChangeType ?? null,
                countdownLabel: sharedDeadline.countdownLabel,
                deadlineVersion: currentDeadlineRecord?.deadlineVersion ?? 0,
                reminderOffsets: currentDeadlineRecord?.reminderOffsets ??
                    sharedDeadline.reminderOffsets,
                scheduledReminderOffsets: currentDeadlineRecord?.scheduledReminderOffsets ?? [],
                skippedReminderOffsets: currentDeadlineRecord?.skippedReminderOffsets ?? [],
                source: sharedDeadline.source,
                submissionEndsAt: sharedDeadline.deadlineAt,
                submissionEndsAtInput: (0, deadlines_1.formatTimeZoneInputValue)(sharedDeadline.deadlineAt, sharedDeadline.timeZone),
                submissionStartsAt: sharedDeadline.startAt,
                submissionStartsAtInput: (0, deadlines_1.formatTimeZoneInputValue)(sharedDeadline.startAt, sharedDeadline.timeZone),
                timeZone: sharedDeadline.timeZone,
                timeZoneUsesFallback: sharedDeadline.timeZoneUsesFallback,
                updatedAt: currentDeadlineRecord?.updatedAt ?? null,
            },
            meta: {
                activeDepartmentCount: departments.length,
                fiscalYearStartMonth: tenant.fiscalYearStartMonth,
                impactedDepartmentCount: departments.length,
                now: Date.now(),
                recipientCount: recipientEmails.length,
                reminderOptionDays: [...deadlines_1.DEADLINE_REMINDER_OFFSETS],
                selectedFiscalYear,
                tenantName: tenant.name,
                timeZone: sharedDeadline.timeZone,
                timeZoneUsesFallback: sharedDeadline.timeZoneUsesFallback,
            },
            reminderJobs: {
                failedCount: reminderJobs.filter((job) => job.status === "failed").length,
                scheduledCount: reminderJobs.filter((job) => job.status === "scheduled").length,
            },
            selection: {
                options: fiscalYearOptions,
                selectedFiscalYear,
            },
        };
    },
});
exports.saveSubmissionDeadlineState = (0, server_1.mutation)({
    args: {
        confirmTightening: values_1.v.optional(values_1.v.boolean()),
        extensionReason: values_1.v.optional(values_1.v.string()),
        reminderOffsets: values_1.v.array(values_1.v.number()),
        selectedFiscalYear: values_1.v.string(),
        submissionEndsAt: values_1.v.number(),
        submissionStartsAt: values_1.v.number(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenant, tenantUser } = await loadProcurementOfficerMutationContext(ctx);
        const now = Date.now();
        const activeDepartments = (await ctx.db
            .query("departments")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
            .collect())
            .filter(isActiveDepartment);
        if (activeDepartments.length === 0) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "selectedFiscalYear",
                message: deadlines_1.DEADLINE_NO_DEPARTMENTS_MESSAGE,
            });
        }
        // Fetch the existing record before validating timestamps so we can
        // exempt an unchanged start date from the "must be in the future" rule.
        // This lets a PO extend or correct the end date even after the
        // submission window has already opened.
        const currentRecord = await getTenantSubmissionDeadlineRecord(ctx, {
            fiscalYearKey: args.selectedFiscalYear,
            tenantId: authContext.tenantId,
        });
        const startDateUnchanged = currentRecord !== null &&
            currentRecord.submissionStartsAt === args.submissionStartsAt;
        // End date must always be in the future.
        if (args.submissionEndsAt <= now) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "submissionEndsAt",
                message: deadlines_1.DEADLINE_IN_PAST_MESSAGE,
            });
        }
        // Start date must be in the future unless it matches the existing
        // record — meaning the window has already opened and the PO is only
        // adjusting the end date.
        if (!startDateUnchanged && args.submissionStartsAt <= now) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "submissionStartsAt",
                message: deadlines_1.DEADLINE_IN_PAST_MESSAGE,
            });
        }
        if (args.submissionEndsAt <= args.submissionStartsAt) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "submissionEndsAt",
                message: deadlines_1.DEADLINE_ORDER_MESSAGE,
            });
        }
        const resolvedTimeZone = (0, deadlines_1.resolveDeadlineTimeZone)({
            tenantTimeZone: tenant.timeZone,
        });
        const derivedFiscalYearKey = (0, deadlines_1.getFiscalYearForTimestampInTimeZone)({
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            timeZone: resolvedTimeZone.timeZone,
            timestamp: args.submissionEndsAt,
        }).key;
        if (derivedFiscalYearKey !== args.selectedFiscalYear) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "selectedFiscalYear",
                message: `The selected fiscal year must match ${derivedFiscalYearKey}.`,
            });
        }
        const reminderOffsets = (0, deadlines_1.normalizeReminderOffsets)(args.reminderOffsets);
        // currentRecord already fetched above.
        const currentSharedDeadline = (0, dashboard_1.deriveSharedSubmissionDeadline)({
            deadlineRecord: currentRecord
                ? {
                    announcementIssuedAt: currentRecord.announcementIssuedAt,
                    announcementMessage: currentRecord.announcementMessage,
                    announcementTitle: currentRecord.announcementTitle,
                    deadlineVersion: currentRecord.deadlineVersion,
                    fiscalYearKey: currentRecord.fiscalYearKey,
                    reminderOffsets: currentRecord.reminderOffsets,
                    submissionEndsAt: currentRecord.submissionEndsAt,
                    submissionStartsAt: currentRecord.submissionStartsAt,
                    timeZone: currentRecord.timeZone,
                    updatedAt: currentRecord.updatedAt,
                }
                : null,
            departments: activeDepartments.map(asDepartmentWindowRecord),
            fiscalYearKey: args.selectedFiscalYear,
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            now,
            tenantTimeZone: tenant.timeZone,
        });
        const changeType = (0, deadlines_1.classifySubmissionDeadlineChange)({
            currentEndsAt: currentSharedDeadline.deadlineAt,
            currentStartsAt: currentSharedDeadline.startAt,
            nextEndsAt: args.submissionEndsAt,
            nextStartsAt: args.submissionStartsAt,
        });
        const sharedChangeType = changeType === "extension" ? "edited" : changeType;
        if (changeType === "tightened" && args.confirmTightening !== true) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "confirmTightening",
                message: deadlines_1.DEADLINE_TIGHTEN_CONFIRMATION_MESSAGE,
            });
        }
        const persistedChangeType = resolvePersistedChangeType({
            changeType: sharedChangeType,
            hasCurrentRecord: Boolean(currentRecord),
        });
        const configChanged = !currentRecord ||
            (0, deadlines_1.hasSubmissionDeadlineConfigChanged)({
                currentEndsAt: currentRecord.submissionEndsAt,
                currentReminderOffsets: currentRecord.reminderOffsets,
                currentStartsAt: currentRecord.submissionStartsAt,
                currentTimeZone: currentRecord.timeZone,
                nextEndsAt: args.submissionEndsAt,
                nextReminderOffsets: reminderOffsets,
                nextStartsAt: args.submissionStartsAt,
                nextTimeZone: resolvedTimeZone.timeZone,
            });
        const skippedReminderOffsets = (0, deadlines_1.getSkippedReminderOffsets)({
            deadlineAt: args.submissionEndsAt,
            now,
            reminderOffsets,
        });
        const scheduledReminderOffsets = reminderOffsets.filter((offset) => !skippedReminderOffsets.includes(offset));
        const announcement = buildDeadlineAnnouncement({
            changeType: persistedChangeType,
            submissionEndsAt: args.submissionEndsAt,
            timeZone: resolvedTimeZone.timeZone,
        });
        const departmentsNeedingSync = activeDepartments.filter((department) => department.submissionStartsAt !== args.submissionStartsAt ||
            department.submissionEndsAt !== args.submissionEndsAt);
        if (currentRecord && !configChanged) {
            for (const department of departmentsNeedingSync) {
                await ctx.db.patch(department._id, {
                    submissionEndsAt: args.submissionEndsAt,
                    submissionStartsAt: args.submissionStartsAt,
                    updatedAt: now,
                });
            }
            return {
                cancelledReminderJobs: [],
                changeType: sharedChangeType,
                extensionEmailRecipients: [],
                fiscalYearKey: args.selectedFiscalYear,
                impactedDepartmentCount: activeDepartments.length,
                scheduledReminderJobs: [],
                skippedReminderOffsets,
                submissionDeadlineId: currentRecord._id,
                submissionEndsAt: args.submissionEndsAt,
                submissionStartsAt: args.submissionStartsAt,
                tenantName: tenant.name,
                timeZone: resolvedTimeZone.timeZone,
            };
        }
        const currentDeadlineVersion = currentRecord?.deadlineVersion ?? 0;
        const nextVersion = configChanged
            ? currentDeadlineVersion + 1
            : currentDeadlineVersion || 1;
        const submissionDeadlineId = currentRecord
            ? currentRecord._id
            : await ctx.db.insert("submissionDeadlines", {
                announcementIssuedAt: now,
                announcementMessage: announcement.message,
                announcementTitle: announcement.title,
                createdAt: now,
                createdByTenantUserId: tenantUser._id,
                deadlineVersion: nextVersion,
                fiscalYearKey: args.selectedFiscalYear,
                lastChangeType: persistedChangeType,
                lastExtensionReason: undefined,
                previousSubmissionEndsAt: typeof currentSharedDeadline.deadlineAt === "number"
                    ? currentSharedDeadline.deadlineAt
                    : undefined,
                reminderOffsets,
                scheduledReminderOffsets,
                skippedReminderOffsets,
                submissionEndsAt: args.submissionEndsAt,
                submissionStartsAt: args.submissionStartsAt,
                tenantId: authContext.tenantId,
                timeZone: resolvedTimeZone.timeZone,
                updatedAt: now,
                updatedByTenantUserId: tenantUser._id,
            });
        if (currentRecord) {
            await ctx.db.patch(currentRecord._id, {
                announcementIssuedAt: now,
                announcementMessage: announcement.message,
                announcementTitle: announcement.title,
                deadlineVersion: nextVersion,
                lastChangeType: persistedChangeType,
                lastExtensionReason: undefined,
                previousSubmissionEndsAt: typeof currentSharedDeadline.deadlineAt === "number"
                    ? currentSharedDeadline.deadlineAt
                    : undefined,
                reminderOffsets,
                scheduledReminderOffsets,
                skippedReminderOffsets,
                submissionEndsAt: args.submissionEndsAt,
                submissionStartsAt: args.submissionStartsAt,
                timeZone: resolvedTimeZone.timeZone,
                updatedAt: now,
                updatedByTenantUserId: tenantUser._id,
            });
        }
        for (const department of departmentsNeedingSync) {
            await ctx.db.patch(department._id, {
                submissionEndsAt: args.submissionEndsAt,
                submissionStartsAt: args.submissionStartsAt,
                updatedAt: now,
            });
        }
        const recipientEmails = await getActiveDeadlineRecipientEmails(ctx, {
            departmentIds: activeDepartments.map((department) => department._id),
            tenantId: authContext.tenantId,
        });
        const obsoleteReminderJobs = currentRecord
            ? (await ctx.db
                .query("submissionDeadlineReminderJobs")
                .withIndex("by_submissionDeadlineId_version", (q) => q.eq("submissionDeadlineId", currentRecord._id).eq("deadlineVersion", currentRecord.deadlineVersion))
                .collect()).filter((job) => job.status === "scheduled")
            : [];
        const cancelledReminderJobs = [];
        for (const obsoleteJob of obsoleteReminderJobs) {
            cancelledReminderJobs.push({
                idempotencyKey: obsoleteJob.idempotencyKey,
                jobId: obsoleteJob.jobId,
                reminderJobId: obsoleteJob._id,
            });
        }
        const scheduledReminderJobs = [];
        for (const reminderOffsetDays of scheduledReminderOffsets) {
            const deliverAt = (0, deadlines_1.getReminderDeliveryTimestamp)({
                deadlineAt: args.submissionEndsAt,
                offsetDays: reminderOffsetDays,
            });
            for (const recipientEmail of recipientEmails) {
                const idempotencyKey = `deadline-reminder:${authContext.tenantId}:${args.selectedFiscalYear}:${nextVersion}:${reminderOffsetDays}:${recipientEmail.toLowerCase()}`;
                const reminderJobId = await ctx.db.insert("submissionDeadlineReminderJobs", {
                    createdAt: now,
                    deadlineVersion: nextVersion,
                    deliverAt,
                    fiscalYearKey: args.selectedFiscalYear,
                    idempotencyKey,
                    recipientEmail,
                    reminderOffsetDays,
                    status: "scheduled",
                    submissionDeadlineId,
                    tenantId: authContext.tenantId,
                    updatedAt: now,
                });
                scheduledReminderJobs.push({
                    deliverAt,
                    idempotencyKey,
                    recipientEmail,
                    reminderJobId,
                    reminderOffsetDays,
                });
            }
        }
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildDeadlineAuditEntry({
            actorUserId: tenantUser.userId,
            fiscalYearKey: args.selectedFiscalYear,
            metadata: {
                activeDepartmentCount: activeDepartments.length,
                changeType: sharedChangeType,
                recipientCount: recipientEmails.length,
                scheduledReminderOffsets,
                skippedReminderOffsets,
                submissionDeadlineId: String(submissionDeadlineId),
                summary: `Shared submission deadline saved for ${args.selectedFiscalYear}.`,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            recordId: String(submissionDeadlineId),
            tenantId: authContext.tenantId,
        }));
        return {
            cancelledReminderJobs,
            changeType: sharedChangeType,
            extensionEmailRecipients: [],
            fiscalYearKey: args.selectedFiscalYear,
            impactedDepartmentCount: activeDepartments.length,
            scheduledReminderJobs,
            skippedReminderOffsets,
            submissionDeadlineId,
            submissionEndsAt: args.submissionEndsAt,
            submissionStartsAt: args.submissionStartsAt,
            tenantName: tenant.name,
            timeZone: resolvedTimeZone.timeZone,
        };
    },
});
exports.finalizeReminderJobQueueing = (0, server_1.internalMutation)({
    args: {
        jobId: values_1.v.optional(values_1.v.string()),
        reminderJobId: values_1.v.id("submissionDeadlineReminderJobs"),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        await ctx.db.patch(args.reminderJobId, {
            jobId: args.jobId,
            status: "scheduled",
            statusMessage: undefined,
            updatedAt: Date.now(),
        });
        return null;
    },
});
exports.failReminderJobQueueing = (0, server_1.internalMutation)({
    args: {
        message: values_1.v.string(),
        reminderJobId: values_1.v.id("submissionDeadlineReminderJobs"),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        await ctx.db.patch(args.reminderJobId, {
            status: "failed",
            statusMessage: args.message,
            updatedAt: Date.now(),
        });
        return null;
    },
});
exports.recordReminderJobCancellationOutcome = (0, server_1.internalMutation)({
    args: {
        cancelled: values_1.v.boolean(),
        message: values_1.v.optional(values_1.v.string()),
        reminderJobId: values_1.v.id("submissionDeadlineReminderJobs"),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        if (args.cancelled) {
            await ctx.db.patch(args.reminderJobId, {
                status: "cancelled",
                statusMessage: args.message ?? "Superseded by a newer deadline version.",
                updatedAt: Date.now(),
            });
            return null;
        }
        await ctx.db.patch(args.reminderJobId, {
            statusMessage: args.message ??
                "We could not confirm cancellation before the reminder became active.",
            updatedAt: Date.now(),
        });
        return null;
    },
});
exports.claimReminderJobDispatch = (0, server_1.internalMutation)({
    args: {
        reminderJobId: values_1.v.id("submissionDeadlineReminderJobs"),
    },
    returns: values_1.v.object({
        allowSend: values_1.v.boolean(),
        reason: values_1.v.union(values_1.v.literal("inactive"), values_1.v.literal("ready"), values_1.v.literal("superseded")),
        statusMessage: values_1.v.union(values_1.v.string(), values_1.v.null()),
    }),
    handler: async (ctx, args) => {
        const reminderJob = await ctx.db.get(args.reminderJobId);
        if (!reminderJob) {
            return {
                allowSend: false,
                reason: "inactive",
                statusMessage: "Reminder dispatch skipped because the job no longer exists.",
            };
        }
        const submissionDeadline = await ctx.db.get(reminderJob.submissionDeadlineId);
        if (!submissionDeadline) {
            const statusMessage = "Reminder dispatch skipped because the deadline record is no longer available.";
            if (reminderJob.status === "scheduled") {
                await ctx.db.patch(reminderJob._id, {
                    status: "skipped",
                    statusMessage,
                    updatedAt: Date.now(),
                });
            }
            return {
                allowSend: false,
                reason: "inactive",
                statusMessage,
            };
        }
        const decision = (0, deadlines_1.evaluateReminderJobDispatch)({
            currentDeadlineVersion: submissionDeadline.deadlineVersion,
            reminderJobDeadlineVersion: reminderJob.deadlineVersion,
            reminderJobStatus: reminderJob.status,
        });
        if (decision.nextStatus) {
            await ctx.db.patch(reminderJob._id, {
                status: decision.nextStatus,
                statusMessage: decision.statusMessage,
                updatedAt: Date.now(),
            });
        }
        return {
            allowSend: decision.allowSend,
            reason: decision.reason,
            statusMessage: decision.statusMessage ?? null,
        };
    },
});
async function loadDeadlineActionContext(ctx) {
    const tenantUser = await ctx.runQuery("functions/users:getCurrentUserTenant", {});
    if (tenantUser.role !== "procurement_officer" || !tenantUser.isActive) {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for this resource.",
        });
    }
    return tenantUser;
}
exports.getDeadlineActionTenant = (0, server_1.query)({
    args: {},
    returns: values_1.v.object({
        fiscalYearStartMonth: values_1.v.optional(values_1.v.number()),
        timeZone: values_1.v.optional(values_1.v.string()),
    }),
    handler: async (ctx) => {
        const { tenant } = await loadProcurementOfficerQueryContext(ctx);
        return {
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            timeZone: tenant.timeZone,
        };
    },
});
exports.upsertSubmissionDeadline = (0, server_1.action)({
    args: {
        confirmTightening: values_1.v.optional(values_1.v.boolean()),
        extensionReason: values_1.v.optional(values_1.v.string()),
        reminderOffsets: values_1.v.array(values_1.v.number()),
        selectedFiscalYear: values_1.v.string(),
        submissionEndsAtInput: values_1.v.string(),
        submissionStartsAtInput: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const tenantUser = await loadDeadlineActionContext(ctx);
        const tenantConfig = await ctx.runQuery("functions/deadlines:getDeadlineActionTenant", {});
        const resolvedTimeZone = (0, deadlines_1.resolveDeadlineTimeZone)({
            tenantTimeZone: tenantConfig.timeZone,
        });
        const submissionStartsAt = (0, deadlines_1.parseTimeZoneInputValue)(args.submissionStartsAtInput, resolvedTimeZone.timeZone);
        const submissionEndsAt = (0, deadlines_1.parseTimeZoneInputValue)(args.submissionEndsAtInput, resolvedTimeZone.timeZone);
        if (typeof submissionStartsAt !== "number" ||
            typeof submissionEndsAt !== "number") {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "submissionEndsAt",
                message: "Choose valid deadline date and time values.",
            });
        }
        const saved = await ctx.runMutation("functions/deadlines:saveSubmissionDeadlineState", {
            confirmTightening: args.confirmTightening,
            extensionReason: args.extensionReason,
            reminderOffsets: args.reminderOffsets,
            selectedFiscalYear: args.selectedFiscalYear,
            submissionEndsAt,
            submissionStartsAt,
        });
        let failedReminderCancellationCount = 0;
        let failedReminderQueueCount = 0;
        let failedExtensionEmailCount = 0;
        let queuedReminderJobCount = 0;
        let queuedExtensionEmailCount = 0;
        for (const cancelledJob of saved.cancelledReminderJobs) {
            try {
                const cancelResult = await ctx.runAction("actions/email:cancelTransactionalEmail", {
                    idempotencyKey: cancelledJob.idempotencyKey,
                });
                const cancelled = cancelResult?.cancelled === true;
                await ctx.runMutation("functions/deadlines:recordReminderJobCancellationOutcome", {
                    cancelled,
                    message: cancelled
                        ? "Superseded by a newer deadline version."
                        : "We could not confirm cancellation before the reminder became active.",
                    reminderJobId: cancelledJob.reminderJobId,
                });
                if (!cancelled) {
                    failedReminderCancellationCount += 1;
                }
            }
            catch (error) {
                failedReminderCancellationCount += 1;
                await ctx.runMutation("functions/deadlines:recordReminderJobCancellationOutcome", {
                    cancelled: false,
                    message: error instanceof Error
                        ? error.message
                        : "We could not cancel the superseded reminder job.",
                    reminderJobId: cancelledJob.reminderJobId,
                }).catch(() => undefined);
            }
        }
        for (const reminderJob of saved.scheduledReminderJobs) {
            try {
                const queueResult = await ctx.runAction("actions/email:queueTransactionalEmail", {
                    deliverAt: reminderJob.deliverAt,
                    idempotencyKey: reminderJob.idempotencyKey,
                    subject: `${saved.tenantName} submission deadline reminder`,
                    template: "deadline-reminder",
                    templateProps: {
                        deadlineLabel: (0, deadlines_1.formatDeadlineDateTime)(saved.submissionEndsAt, saved.timeZone, { includeTimeZoneName: true }),
                        fiscalYearLabel: saved.fiscalYearKey,
                        offsetDays: reminderJob.reminderOffsetDays,
                        reminderJobId: String(reminderJob.reminderJobId),
                        tenantName: saved.tenantName,
                    },
                    to: reminderJob.recipientEmail,
                });
                await ctx.runMutation("functions/deadlines:finalizeReminderJobQueueing", {
                    jobId: typeof queueResult?.jobId === "string"
                        ? queueResult.jobId
                        : undefined,
                    reminderJobId: reminderJob.reminderJobId,
                });
                queuedReminderJobCount += 1;
            }
            catch (error) {
                failedReminderQueueCount += 1;
                await ctx.runMutation("functions/deadlines:failReminderJobQueueing", {
                    message: error instanceof Error
                        ? error.message
                        : "We could not queue the reminder email.",
                    reminderJobId: reminderJob.reminderJobId,
                });
            }
        }
        if (saved.changeType === "extension" &&
            Array.isArray(saved.extensionEmailRecipients)) {
            for (const recipientEmail of saved.extensionEmailRecipients) {
                try {
                    await ctx.runAction("actions/email:queueTransactionalEmail", {
                        idempotencyKey: `deadline-extension:${tenantUser.tenantId}:${saved.fiscalYearKey}:${saved.submissionDeadlineId}:${recipientEmail.toLowerCase()}`,
                        subject: `${saved.tenantName} submission deadline extended`,
                        template: "deadline-extension",
                        templateProps: buildExtensionEmailTemplateProps({
                            fiscalYearKey: saved.fiscalYearKey,
                            submissionEndsAt: saved.submissionEndsAt,
                            tenantName: saved.tenantName,
                            timeZone: saved.timeZone,
                        }),
                        to: recipientEmail,
                    });
                    queuedExtensionEmailCount += 1;
                }
                catch {
                    failedExtensionEmailCount += 1;
                }
            }
        }
        return {
            changeType: saved.changeType,
            deadlineLabel: (0, deadlines_1.formatDeadlineDateTime)(saved.submissionEndsAt, saved.timeZone, {
                includeTimeZoneName: true,
            }),
            impactedDepartmentCount: saved.impactedDepartmentCount,
            failedExtensionEmailCount,
            failedReminderCancellationCount,
            failedReminderQueueCount,
            queuedExtensionEmails: queuedExtensionEmailCount,
            queuedReminderJobs: queuedReminderJobCount,
            skippedReminderOffsets: saved.skippedReminderOffsets,
            timeZone: saved.timeZone,
        };
    },
});
