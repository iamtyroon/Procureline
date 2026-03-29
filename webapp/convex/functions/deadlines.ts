import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
    action,
    internalMutation,
    mutation,
    query,
    type ActionCtx,
    type MutationCtx,
    type QueryCtx,
} from "../_generated/server";
import {
    AUDIT_OUTCOMES,
    createAuthenticatedAuditActor,
} from "../../lib/security/audit";
import {
    classifySubmissionDeadlineChange,
    DEADLINE_IN_PAST_MESSAGE,
    DEADLINE_NO_DEPARTMENTS_MESSAGE,
    DEADLINE_ORDER_MESSAGE,
    DEADLINE_REMINDER_OFFSETS,
    DEADLINE_TIGHTEN_CONFIRMATION_MESSAGE,
    formatDeadlineDateTime,
    formatTimeZoneInputValue,
    getCurrentFiscalYearKey,
    getFiscalYearForTimestampInTimeZone,
    getReminderDeliveryTimestamp,
    getSkippedReminderOffsets,
    hasSubmissionDeadlineConfigChanged,
    normalizeReminderOffsets,
    evaluateReminderJobDispatch,
    parseTimeZoneInputValue,
    resolveDeadlineTimeZone,
} from "../../lib/procurement-officer/deadlines";
import {
    buildAvailableProcurementFiscalYears,
    deriveSharedSubmissionDeadline,
    type ProcurementDepartmentWindowRecord,
} from "../../lib/procurement-officer/dashboard";
import { appendAuditLogRequired } from "./_audit";
import { requireTenantRole } from "./_roleGuard";
import { getCurrentTenantUserMembership } from "./_tenantGuard";

type DepartmentRecord = Doc<"departments">;
type SubmissionDeadlineRecord = Doc<"submissionDeadlines">;

function asDepartmentWindowRecord(
    department: DepartmentRecord,
): ProcurementDepartmentWindowRecord {
    return {
        id: String(department._id),
        isActive: department.isActive,
        submissionEndsAt: department.submissionEndsAt,
        submissionStartsAt: department.submissionStartsAt,
    };
}

function isActiveDepartment(department: DepartmentRecord): boolean {
    return department.isActive && department.deletedAt === undefined;
}

function buildDeadlineAuditEntry(args: {
    actorUserId: Id<"users">;
    fiscalYearKey: string;
    metadata: Record<string, unknown>;
    outcome: string;
    recordId?: string;
    tenantId: Id<"tenants">;
}): Parameters<typeof appendAuditLogRequired>[1] {
    return {
        action: "save",
        actor: createAuthenticatedAuditActor({
            role: "procurement_officer",
            userId: String(args.actorUserId),
        }),
        entityType: "submission_deadline",
        event: "submission_deadline.saved" as any,
        metadata: {
            fiscalYearKey: args.fiscalYearKey,
            ...args.metadata,
        },
        outcome: args.outcome as any,
        recordId: args.recordId,
        sourceTenantId: String(args.tenantId),
        tableName: "submissionDeadlines",
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    };
}

async function loadProcurementOfficerQueryContext(ctx: QueryCtx) {
    const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
    const tenant = await ctx.db.get(authContext.tenantId);

    if (!tenant) {
        throw new ConvexError({
            code: "NOT_FOUND",
            message: "Tenant record not found",
        });
    }

    return {
        authContext,
        tenant,
    };
}

async function loadProcurementOfficerMutationContext(ctx: MutationCtx) {
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

async function getTenantSubmissionDeadlineRecord(
    ctx: MutationCtx | QueryCtx,
    args: {
        fiscalYearKey: string;
        tenantId: Id<"tenants">;
    },
): Promise<SubmissionDeadlineRecord | null> {
    return (
        (await ctx.db
            .query("submissionDeadlines")
            .withIndex("by_tenantId_fiscalYearKey", (q) =>
                q.eq("tenantId", args.tenantId).eq("fiscalYearKey", args.fiscalYearKey),
            )
            .first()) ?? null
    );
}

async function getActiveDeadlineRecipientEmails(
    ctx: MutationCtx | QueryCtx,
    args: {
        departmentIds: readonly Id<"departments">[];
        tenantId: Id<"tenants">;
    },
): Promise<string[]> {
    if (args.departmentIds.length === 0) {
        return [];
    }

    const profiles = (await ctx.db
        .query("departmentUserProfiles")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .collect())
        .filter(
            (profile) =>
                profile.isActive &&
                args.departmentIds.some(
                    (departmentId) => departmentId === profile.departmentId,
                ),
        );
    const tenantUsers = await ctx.db
        .query("tenantUsers")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .collect();
    const tenantUsersById = new Map(
        tenantUsers.map((tenantUser) => [String(tenantUser._id), tenantUser]),
    );
    const relevantUserIds = Array.from(
        new Set(
            profiles
                .map(
                    (profile) =>
                        tenantUsersById.get(String(profile.tenantUserId))?.userId ?? null,
                )
                .filter((userId): userId is Id<"users"> => userId !== null),
        ),
    );
    const userDocs = await Promise.all(
        relevantUserIds.map(async (userId) => await ctx.db.get(userId)),
    );

    return Array.from(
        new Set(
            userDocs
                .map((user) =>
                    typeof user?.email === "string" ? user.email.trim() : null,
                )
                .filter((email): email is string => Boolean(email)),
        ),
    ).sort((left, right) => left.localeCompare(right));
}

function buildDeadlineAnnouncement(args: {
    changeType: "edited" | "extension" | "initial_setup" | "tightened";
    submissionEndsAt: number;
    timeZone: string;
}) {
    const deadlineLabel = formatDeadlineDateTime(args.submissionEndsAt, args.timeZone, {
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

function buildExtensionEmailTemplateProps(args: {
    fiscalYearKey: string;
    submissionEndsAt: number;
    timeZone: string;
    tenantName: string;
}) {
    return {
        deadlineLabel: formatDeadlineDateTime(args.submissionEndsAt, args.timeZone, {
            includeTimeZoneName: true,
        }),
        fiscalYearLabel: args.fiscalYearKey,
        heading: "Submission deadline extended",
        message: `Your Procurement Officer extended the shared submission deadline for ${args.fiscalYearKey}.`,
        tenantName: args.tenantName,
    };
}

function resolvePersistedChangeType(args: {
    changeType: ReturnType<typeof classifySubmissionDeadlineChange>;
    hasCurrentRecord: boolean;
}): "edited" | "extension" | "initial_setup" | "tightened" {
    if (args.changeType === "unchanged") {
        return args.hasCurrentRecord ? "edited" : "initial_setup";
    }

    return args.changeType;
}

export const getDeadlinesWorkspace = query({
    args: {
        selectedFiscalYear: v.optional(v.string()),
    },
    returns: v.any(),
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
        const resolvedTimeZone = resolveDeadlineTimeZone({
            tenantTimeZone: tenant.timeZone,
        });
        const fiscalYearOptions = buildAvailableProcurementFiscalYears({
            departments: departments.map(asDepartmentWindowRecord),
            existingFiscalYearKeys: deadlineRecords.map((record) => record.fiscalYearKey),
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            now: Date.now(),
            requestedFiscalYear: args.selectedFiscalYear ?? null,
            timeZone: resolvedTimeZone.timeZone,
        });
        const selectedFiscalYear =
            args.selectedFiscalYear && fiscalYearOptions.includes(args.selectedFiscalYear)
                ? args.selectedFiscalYear
                : fiscalYearOptions[0] ??
                  getCurrentFiscalYearKey({
                      fiscalYearStartMonth: tenant.fiscalYearStartMonth,
                      timeZone: resolvedTimeZone.timeZone,
                  });
        const currentDeadlineRecord =
            deadlineRecords.find(
                (record) => record.fiscalYearKey === selectedFiscalYear,
            ) ?? null;
        const sharedDeadline = deriveSharedSubmissionDeadline({
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
                  .withIndex("by_submissionDeadlineId_version", (q) =>
                      q.eq("submissionDeadlineId", currentDeadlineRecord._id).eq(
                          "deadlineVersion",
                          currentDeadlineRecord.deadlineVersion,
                      ),
                  )
                  .collect()
            : [];

        return {
            current: {
                announcementIssuedAt:
                    currentDeadlineRecord?.announcementIssuedAt ?? null,
                announcementMessage:
                    currentDeadlineRecord?.announcementMessage ?? null,
                announcementTitle:
                    currentDeadlineRecord?.announcementTitle ?? null,
                changeType: currentDeadlineRecord?.lastChangeType ?? null,
                countdownLabel: sharedDeadline.countdownLabel,
                deadlineVersion: currentDeadlineRecord?.deadlineVersion ?? 0,
                reminderOffsets:
                    currentDeadlineRecord?.reminderOffsets ??
                    sharedDeadline.reminderOffsets,
                scheduledReminderOffsets:
                    currentDeadlineRecord?.scheduledReminderOffsets ?? [],
                skippedReminderOffsets:
                    currentDeadlineRecord?.skippedReminderOffsets ?? [],
                source: sharedDeadline.source,
                submissionEndsAt: sharedDeadline.deadlineAt,
                submissionEndsAtInput: formatTimeZoneInputValue(
                    sharedDeadline.deadlineAt,
                    sharedDeadline.timeZone,
                ),
                submissionStartsAt: sharedDeadline.startAt,
                submissionStartsAtInput: formatTimeZoneInputValue(
                    sharedDeadline.startAt,
                    sharedDeadline.timeZone,
                ),
                timeZone: sharedDeadline.timeZone,
                timeZoneUsesFallback: sharedDeadline.timeZoneUsesFallback,
                updatedAt: currentDeadlineRecord?.updatedAt ?? null,
            },
            meta: {
                activeDepartmentCount: departments.length,
                impactedDepartmentCount: departments.length,
                now: Date.now(),
                recipientCount: recipientEmails.length,
                reminderOptionDays: [...DEADLINE_REMINDER_OFFSETS],
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

export const saveSubmissionDeadlineState = mutation({
    args: {
        confirmTightening: v.optional(v.boolean()),
        extensionReason: v.optional(v.string()),
        reminderOffsets: v.array(v.number()),
        selectedFiscalYear: v.string(),
        submissionEndsAt: v.number(),
        submissionStartsAt: v.number(),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenant, tenantUser } =
            await loadProcurementOfficerMutationContext(ctx);
        const now = Date.now();
        const activeDepartments = (await ctx.db
            .query("departments")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
            .collect())
            .filter(isActiveDepartment);

        if (activeDepartments.length === 0) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: "selectedFiscalYear",
                message: DEADLINE_NO_DEPARTMENTS_MESSAGE,
            });
        }

        if (args.submissionStartsAt <= now || args.submissionEndsAt <= now) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: "submissionEndsAt",
                message: DEADLINE_IN_PAST_MESSAGE,
            });
        }

        if (args.submissionEndsAt <= args.submissionStartsAt) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: "submissionEndsAt",
                message: DEADLINE_ORDER_MESSAGE,
            });
        }

        const resolvedTimeZone = resolveDeadlineTimeZone({
            tenantTimeZone: tenant.timeZone,
        });
        const derivedFiscalYearKey = getFiscalYearForTimestampInTimeZone({
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            timeZone: resolvedTimeZone.timeZone,
            timestamp: args.submissionEndsAt,
        }).key;
        if (derivedFiscalYearKey !== args.selectedFiscalYear) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: "selectedFiscalYear",
                message: `The selected fiscal year must match ${derivedFiscalYearKey}.`,
            });
        }

        const reminderOffsets = normalizeReminderOffsets(args.reminderOffsets);
        const currentRecord = await getTenantSubmissionDeadlineRecord(ctx, {
            fiscalYearKey: args.selectedFiscalYear,
            tenantId: authContext.tenantId,
        });
        const currentSharedDeadline = deriveSharedSubmissionDeadline({
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
        const changeType = classifySubmissionDeadlineChange({
            currentEndsAt: currentSharedDeadline.deadlineAt,
            currentStartsAt: currentSharedDeadline.startAt,
            nextEndsAt: args.submissionEndsAt,
            nextStartsAt: args.submissionStartsAt,
        });

        if (changeType === "tightened" && args.confirmTightening !== true) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: "confirmTightening",
                message: DEADLINE_TIGHTEN_CONFIRMATION_MESSAGE,
            });
        }

        const persistedChangeType = resolvePersistedChangeType({
            changeType,
            hasCurrentRecord: Boolean(currentRecord),
        });
        const configChanged =
            !currentRecord ||
            hasSubmissionDeadlineConfigChanged({
                currentEndsAt: currentRecord.submissionEndsAt,
                currentReminderOffsets: currentRecord.reminderOffsets,
                currentStartsAt: currentRecord.submissionStartsAt,
                currentTimeZone: currentRecord.timeZone,
                nextEndsAt: args.submissionEndsAt,
                nextReminderOffsets: reminderOffsets,
                nextStartsAt: args.submissionStartsAt,
                nextTimeZone: resolvedTimeZone.timeZone,
            });
        const skippedReminderOffsets = getSkippedReminderOffsets({
            deadlineAt: args.submissionEndsAt,
            now,
            reminderOffsets,
        });
        const scheduledReminderOffsets = reminderOffsets.filter(
            (offset) => !skippedReminderOffsets.includes(offset),
        );
        const announcement = buildDeadlineAnnouncement({
            changeType: persistedChangeType,
            submissionEndsAt: args.submissionEndsAt,
            timeZone: resolvedTimeZone.timeZone,
        });
        const departmentsNeedingSync = activeDepartments.filter(
            (department) =>
                department.submissionStartsAt !== args.submissionStartsAt ||
                department.submissionEndsAt !== args.submissionEndsAt,
        );

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
                changeType,
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

        const nextVersion = configChanged
            ? (currentRecord?.deadlineVersion ?? 0) + 1
            : currentRecord?.deadlineVersion ?? 1;
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
                  lastExtensionReason:
                      changeType === "extension"
                          ? args.extensionReason?.trim() || undefined
                          : undefined,
                  previousSubmissionEndsAt:
                      typeof currentSharedDeadline.deadlineAt === "number"
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
                lastExtensionReason:
                    changeType === "extension"
                        ? args.extensionReason?.trim() || undefined
                        : undefined,
                previousSubmissionEndsAt:
                    typeof currentSharedDeadline.deadlineAt === "number"
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
            ? (
                  await ctx.db
                      .query("submissionDeadlineReminderJobs")
                      .withIndex("by_submissionDeadlineId_version", (q) =>
                          q.eq("submissionDeadlineId", currentRecord._id).eq(
                              "deadlineVersion",
                              currentRecord.deadlineVersion,
                          ),
                      )
                      .collect()
              ).filter((job) => job.status === "scheduled")
            : [];
        const cancelledReminderJobs: Array<{
            idempotencyKey: string;
            jobId?: string;
            reminderJobId: Id<"submissionDeadlineReminderJobs">;
        }> = [];

        for (const obsoleteJob of obsoleteReminderJobs) {
            cancelledReminderJobs.push({
                idempotencyKey: obsoleteJob.idempotencyKey,
                jobId: obsoleteJob.jobId,
                reminderJobId: obsoleteJob._id,
            });
        }

        const scheduledReminderJobs: Array<{
            deliverAt: number;
            idempotencyKey: string;
            recipientEmail: string;
            reminderJobId: Id<"submissionDeadlineReminderJobs">;
            reminderOffsetDays: number;
        }> = [];

        for (const reminderOffsetDays of scheduledReminderOffsets) {
            const deliverAt = getReminderDeliveryTimestamp({
                deadlineAt: args.submissionEndsAt,
                offsetDays: reminderOffsetDays,
            });
            for (const recipientEmail of recipientEmails) {
                const idempotencyKey = `deadline-reminder:${authContext.tenantId}:${args.selectedFiscalYear}:${nextVersion}:${reminderOffsetDays}:${recipientEmail.toLowerCase()}`;
                const reminderJobId = await ctx.db.insert(
                    "submissionDeadlineReminderJobs",
                    {
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
                    },
                );
                scheduledReminderJobs.push({
                    deliverAt,
                    idempotencyKey,
                    recipientEmail,
                    reminderJobId,
                    reminderOffsetDays,
                });
            }
        }

        await appendAuditLogRequired(
            ctx,
            buildDeadlineAuditEntry({
                actorUserId: tenantUser.userId,
                fiscalYearKey: args.selectedFiscalYear,
                metadata: {
                    activeDepartmentCount: activeDepartments.length,
                    changeType,
                    recipientCount: recipientEmails.length,
                    scheduledReminderOffsets,
                    skippedReminderOffsets,
                    submissionDeadlineId: String(submissionDeadlineId),
                    summary: `Shared submission deadline saved for ${args.selectedFiscalYear}.`,
                },
                outcome:
                    changeType === "extension"
                        ? AUDIT_OUTCOMES.queued
                        : AUDIT_OUTCOMES.allowed,
                recordId: String(submissionDeadlineId),
                tenantId: authContext.tenantId,
            }),
        );

        return {
            cancelledReminderJobs,
            changeType,
            extensionEmailRecipients:
                changeType === "extension" ? recipientEmails : [],
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

export const finalizeReminderJobQueueing = internalMutation({
    args: {
        jobId: v.optional(v.string()),
        reminderJobId: v.id("submissionDeadlineReminderJobs"),
    },
    returns: v.null(),
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

export const failReminderJobQueueing = internalMutation({
    args: {
        message: v.string(),
        reminderJobId: v.id("submissionDeadlineReminderJobs"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.patch(args.reminderJobId, {
            status: "failed",
            statusMessage: args.message,
            updatedAt: Date.now(),
        });

        return null;
    },
});

export const recordReminderJobCancellationOutcome = internalMutation({
    args: {
        cancelled: v.boolean(),
        message: v.optional(v.string()),
        reminderJobId: v.id("submissionDeadlineReminderJobs"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        if (args.cancelled) {
            await ctx.db.patch(args.reminderJobId, {
                status: "cancelled",
                statusMessage:
                    args.message ?? "Superseded by a newer deadline version.",
                updatedAt: Date.now(),
            });

            return null;
        }

        await ctx.db.patch(args.reminderJobId, {
            statusMessage:
                args.message ??
                "We could not confirm cancellation before the reminder became active.",
            updatedAt: Date.now(),
        });

        return null;
    },
});

export const claimReminderJobDispatch = internalMutation({
    args: {
        reminderJobId: v.id("submissionDeadlineReminderJobs"),
    },
    returns: v.object({
        allowSend: v.boolean(),
        reason: v.union(
            v.literal("inactive"),
            v.literal("ready"),
            v.literal("superseded"),
        ),
        statusMessage: v.union(v.string(), v.null()),
    }),
    handler: async (ctx, args) => {
        const reminderJob = await ctx.db.get(args.reminderJobId);

        if (!reminderJob) {
            return {
                allowSend: false,
                reason: "inactive" as const,
                statusMessage:
                    "Reminder dispatch skipped because the job no longer exists.",
            };
        }

        const submissionDeadline = await ctx.db.get(reminderJob.submissionDeadlineId);

        if (!submissionDeadline) {
            const statusMessage =
                "Reminder dispatch skipped because the deadline record is no longer available.";

            if (reminderJob.status === "scheduled") {
                await ctx.db.patch(reminderJob._id, {
                    status: "skipped",
                    statusMessage,
                    updatedAt: Date.now(),
                });
            }

            return {
                allowSend: false,
                reason: "inactive" as const,
                statusMessage,
            };
        }

        const decision = evaluateReminderJobDispatch({
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

async function loadDeadlineActionContext(ctx: ActionCtx) {
    const tenantUser: {
        _id: Id<"tenantUsers">;
        isActive: boolean;
        role: "department_user" | "procurement_officer" | "tenant_admin";
        tenantId: Id<"tenants">;
        userId: Id<"users">;
    } = await ctx.runQuery("functions/users:getCurrentUserTenant" as any, {});

    if (tenantUser.role !== "procurement_officer" || !tenantUser.isActive) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for this resource.",
        });
    }

    return tenantUser;
}

export const getDeadlineActionTenant = query({
    args: {},
    returns: v.object({
        fiscalYearStartMonth: v.optional(v.number()),
        timeZone: v.optional(v.string()),
    }),
    handler: async (ctx) => {
        const { tenant } = await loadProcurementOfficerQueryContext(ctx);

        return {
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            timeZone: tenant.timeZone,
        };
    },
});

export const upsertSubmissionDeadline = action({
    args: {
        confirmTightening: v.optional(v.boolean()),
        extensionReason: v.optional(v.string()),
        reminderOffsets: v.array(v.number()),
        selectedFiscalYear: v.string(),
        submissionEndsAtInput: v.string(),
        submissionStartsAtInput: v.string(),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const tenantUser = await loadDeadlineActionContext(ctx);
        const tenantConfig = await ctx.runQuery(
            "functions/deadlines:getDeadlineActionTenant" as any,
            {},
        );
        const resolvedTimeZone = resolveDeadlineTimeZone({
            tenantTimeZone: tenantConfig.timeZone,
        });
        const submissionStartsAt = parseTimeZoneInputValue(
            args.submissionStartsAtInput,
            resolvedTimeZone.timeZone,
        );
        const submissionEndsAt = parseTimeZoneInputValue(
            args.submissionEndsAtInput,
            resolvedTimeZone.timeZone,
        );

        if (
            typeof submissionStartsAt !== "number" ||
            typeof submissionEndsAt !== "number"
        ) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: "submissionEndsAt",
                message: "Choose valid deadline date and time values.",
            });
        }

        const saved = await ctx.runMutation(
            "functions/deadlines:saveSubmissionDeadlineState" as any,
            {
                confirmTightening: args.confirmTightening,
                extensionReason: args.extensionReason,
                reminderOffsets: args.reminderOffsets,
                selectedFiscalYear: args.selectedFiscalYear,
                submissionEndsAt,
                submissionStartsAt,
            },
        );
        let failedReminderCancellationCount = 0;
        let failedReminderQueueCount = 0;
        let failedExtensionEmailCount = 0;
        let queuedReminderJobCount = 0;
        let queuedExtensionEmailCount = 0;

        for (const cancelledJob of saved.cancelledReminderJobs as Array<{
            idempotencyKey: string;
            reminderJobId: Id<"submissionDeadlineReminderJobs">;
        }>) {
            try {
                const cancelResult = await ctx.runAction(
                    "actions/email:cancelTransactionalEmail" as any,
                    {
                    idempotencyKey: cancelledJob.idempotencyKey,
                    },
                );
                const cancelled = cancelResult?.cancelled === true;
                await ctx.runMutation(
                    "functions/deadlines:recordReminderJobCancellationOutcome" as any,
                    {
                        cancelled,
                        message: cancelled
                            ? "Superseded by a newer deadline version."
                            : "We could not confirm cancellation before the reminder became active.",
                        reminderJobId: cancelledJob.reminderJobId,
                    },
                );
                if (!cancelled) {
                    failedReminderCancellationCount += 1;
                }
            } catch (error) {
                failedReminderCancellationCount += 1;
                await ctx.runMutation(
                    "functions/deadlines:recordReminderJobCancellationOutcome" as any,
                    {
                        cancelled: false,
                        message:
                            error instanceof Error
                                ? error.message
                                : "We could not cancel the superseded reminder job.",
                        reminderJobId: cancelledJob.reminderJobId,
                    },
                ).catch(() => undefined);
            }
        }

        for (const reminderJob of saved.scheduledReminderJobs as Array<{
            deliverAt: number;
            idempotencyKey: string;
            recipientEmail: string;
            reminderJobId: Id<"submissionDeadlineReminderJobs">;
            reminderOffsetDays: number;
        }>) {
            try {
                const queueResult = await ctx.runAction(
                    "actions/email:queueTransactionalEmail" as any,
                    {
                        deliverAt: reminderJob.deliverAt,
                        idempotencyKey: reminderJob.idempotencyKey,
                        subject: `${saved.tenantName} submission deadline reminder`,
                        template: "deadline-reminder",
                        templateProps: {
                            deadlineLabel: formatDeadlineDateTime(
                                saved.submissionEndsAt,
                                saved.timeZone,
                                { includeTimeZoneName: true },
                            ),
                            fiscalYearLabel: saved.fiscalYearKey,
                            offsetDays: reminderJob.reminderOffsetDays,
                            reminderJobId: String(reminderJob.reminderJobId),
                            tenantName: saved.tenantName,
                        },
                        to: reminderJob.recipientEmail,
                    },
                );

                await ctx.runMutation(
                    "functions/deadlines:finalizeReminderJobQueueing" as any,
                    {
                        jobId:
                            typeof queueResult?.jobId === "string"
                                ? queueResult.jobId
                                : undefined,
                        reminderJobId: reminderJob.reminderJobId,
                    },
                );
                queuedReminderJobCount += 1;
            } catch (error) {
                failedReminderQueueCount += 1;
                await ctx.runMutation(
                    "functions/deadlines:failReminderJobQueueing" as any,
                    {
                        message:
                            error instanceof Error
                                ? error.message
                                : "We could not queue the reminder email.",
                        reminderJobId: reminderJob.reminderJobId,
                    },
                );
            }
        }

        if (
            saved.changeType === "extension" &&
            Array.isArray(saved.extensionEmailRecipients)
        ) {
            for (const recipientEmail of saved.extensionEmailRecipients as string[]) {
                try {
                    await ctx.runAction("actions/email:queueTransactionalEmail" as any, {
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
                } catch {
                    failedExtensionEmailCount += 1;
                }
            }
        }

        return {
            changeType: saved.changeType,
            deadlineLabel: formatDeadlineDateTime(saved.submissionEndsAt, saved.timeZone, {
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
