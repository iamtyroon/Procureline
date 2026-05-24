import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireTenantRole } from "./_roleGuard";
import {
    buildSecureShareExpiry,
    TENANT_ADMIN_REPORT_STALE_TIMEOUT_MS,
    type TenantAdminReportScheduleCadence,
} from "../../lib/shared/tenant-admin/report-generation";

const reportTypeValidator = v.union(
    v.literal("activity"),
    v.literal("audit"),
    v.literal("budget"),
);

const reportFormatValidator = v.union(v.literal("csv"), v.literal("xlsx"));

const overviewStatusValidator = v.union(
    v.literal("all"),
    v.literal("approved"),
    v.literal("draft"),
    v.literal("not_started"),
    v.literal("rejected"),
    v.literal("submitted"),
);

const reportParametersValidator = v.object({
    dateRange: v.object({
        from: v.string(),
        to: v.string(),
    }),
    departmentId: v.union(v.string(), v.literal("all")),
    fiscalYear: v.string(),
    format: reportFormatValidator,
    procurementOfficerId: v.union(v.string(), v.literal("all")),
    reportType: reportTypeValidator,
    status: overviewStatusValidator,
});

const reportStatusValidator = v.union(
    v.literal("failed"),
    v.literal("queued"),
    v.literal("ready"),
);

const scheduleCadenceValidator = v.union(
    v.literal("monthly"),
    v.literal("weekly"),
);

export const listTenantAdminReportJobs = query({
    args: {},
    handler: async (ctx) => {
        const authContext = await requireTenantRole(ctx, ["tenant_admin"]);
        const db = ctx.db as any;

        return await db
            .query("tenantAdminReportJobs")
            .withIndex("by_tenantId_createdAt", (q: any) =>
                q.eq("tenantId", authContext.tenantId),
            )
            .order("desc")
            .take(20);
    },
});

export const getTenantAdminReportSource = query({
    args: {
        fiscalYear: v.string(),
    },
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["tenant_admin"]);
        const db = ctx.db as any;
        const [tenant, targetActivity, sourceActivity] = await Promise.all([
            db.get(authContext.tenantId),
            db
                .query("auditLogs")
                .withIndex("by_targetTenantId", (q: any) =>
                    q.eq("targetTenantId", authContext.tenantId),
                )
                .order("desc")
                .take(500),
            db
                .query("auditLogs")
                .withIndex("by_sourceTenantId", (q: any) =>
                    q.eq("sourceTenantId", authContext.tenantId),
                )
                .order("desc")
                .take(500),
        ]);
        const auditLogs = [...targetActivity, ...sourceActivity]
            .sort((left, right) => right.timestamp - left.timestamp)
            .filter(
                (log, index, collection) =>
                    collection.findIndex((candidate) => candidate._id === log._id) === index,
            );

        return {
            auditLogs: auditLogs.map((log) => ({
                action: log.action,
                actorRole: log.actorRole,
                entityType: log.entityType,
                event: log.event,
                id: String(log._id),
                outcome: log.outcome,
                recordId: log.recordId,
                timestamp: log.timestamp,
            })),
            fiscalYear: args.fiscalYear,
            tenantName: tenant?.name ?? "Tenant",
        };
    },
});

export const createTenantAdminReportShareLink = mutation({
    args: {
        reportJobId: v.id("tenantAdminReportJobs"),
    },
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["tenant_admin"]);
        const tenantUser = await getCurrentTenantUser(ctx, authContext);
        const db = ctx.db as any;
        const job = await db.get(args.reportJobId);

        if (!job || job.tenantId !== authContext.tenantId) {
            throw new ConvexError({
                code: "NOT_FOUND",
                message: "Report job not found.",
            });
        }
        if (job.status !== "ready") {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: "Only ready reports can be shared.",
            });
        }

        const now = Date.now();
        const token = createShareToken(args.reportJobId, now);
        const linkId = await db.insert("tenantAdminReportSecureLinks", {
            accessCount: 0,
            createdAt: now,
            createdByTenantUserId: tenantUser._id,
            expiresAt: buildSecureShareExpiry(now),
            reportJobId: args.reportJobId,
            tenantId: authContext.tenantId,
            tokenHash: hashTokenForStorage(token),
        });
        await appendTenantAdminReportMutationAudit(ctx, authContext, {
            entityId: String(args.reportJobId),
            event: "tenant_admin.report.link_created",
            metadata: {
                expiresAt: buildSecureShareExpiry(now),
                linkId: String(linkId),
                reportJobId: String(args.reportJobId),
            },
            outcome: "allowed",
        });

        return {
            expiresAt: buildSecureShareExpiry(now),
            linkId,
            url: `/tenant-admin/reports/share/${token}`,
        };
    },
});

export const resolveTenantAdminReportShareLink = mutation({
    args: {
        token: v.string(),
    },
    handler: async (ctx, args) => {
        const db = ctx.db as any;
        const now = Date.now();
        const link = await db
            .query("tenantAdminReportSecureLinks")
            .withIndex("by_tokenHash", (q: any) => q.eq("tokenHash", hashTokenForStorage(args.token)))
            .first();

        if (!link || link.revokedAt || link.expiresAt <= now) {
            throw new ConvexError({
                code: "LINK_EXPIRED",
                message: "This report link is no longer available.",
            });
        }

        const job = await db.get(link.reportJobId);
        if (!job || job.tenantId !== link.tenantId || job.status !== "ready" || !job.downloadUrl) {
            throw new ConvexError({
                code: "DOWNLOAD_UNAVAILABLE",
                message: "This report is not available for download.",
            });
        }

        await db.patch(link._id, {
            accessCount: link.accessCount + 1,
            lastAccessedAt: now,
        });
        await db.patch(job._id, {
            downloadCount: job.downloadCount + 1,
            lastDownloadedAt: now,
            updatedAt: now,
        });
        await db.insert("auditLogs", {
            action: "download",
            actorRole: "external_reviewer",
            actorState: "secure_link",
            entityType: "tenant_admin_report",
            event: "tenant_admin.report.secure_link_downloaded",
            metadata: {
                linkId: String(link._id),
                reportJobId: String(job._id),
            },
            outcome: "allowed",
            recordId: String(job._id),
            sourceTenantId: link.tenantId,
            tableName: "tenantAdminReportJobs",
            targetTenantId: link.tenantId,
            timestamp: now,
        });

        return {
            downloadUrl: job.downloadUrl,
            expiresAt: link.expiresAt,
            fileName: job.fileName ?? job.reportName,
            reportName: job.reportName,
        };
    },
});

export const recordTenantAdminReportDownload = mutation({
    args: {
        reportJobId: v.id("tenantAdminReportJobs"),
    },
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["tenant_admin"]);
        const tenantUser = await getCurrentTenantUser(ctx, authContext);
        const db = ctx.db as any;
        const job = await db.get(args.reportJobId);

        if (!job || job.tenantId !== authContext.tenantId || job.status !== "ready" || !job.downloadUrl) {
            throw new ConvexError({
                code: "DOWNLOAD_UNAVAILABLE",
                message: "This report is not available for download.",
            });
        }

        const now = Date.now();
        await db.patch(job._id, {
            downloadCount: job.downloadCount + 1,
            lastDownloadedAt: now,
            lastDownloadedByTenantUserId: tenantUser._id,
            updatedAt: now,
        });
        await appendTenantAdminReportMutationAudit(ctx, authContext, {
            entityId: String(job._id),
            event: "tenant_admin.report.downloaded",
            metadata: {
                reportJobId: String(job._id),
                reportType: job.reportType,
            },
            outcome: "allowed",
        });

        return { downloadUrl: job.downloadUrl };
    },
});

export const upsertTenantAdminReportSchedule = mutation({
    args: {
        cadence: scheduleCadenceValidator,
        enabled: v.boolean(),
        parameters: reportParametersValidator,
        reportType: v.union(v.literal("activity"), v.literal("budget")),
    },
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["tenant_admin"]);
        const tenantUser = await getCurrentTenantUser(ctx, authContext);
        const db = ctx.db as any;
        const now = Date.now();
        const nextRunAt = computeNextScheduleRun(now, args.cadence);
        const existing = await db
            .query("tenantAdminReportSchedules")
            .withIndex("by_tenantId_reportType", (q: any) =>
                q.eq("tenantId", authContext.tenantId).eq("reportType", args.reportType),
            )
            .first();

        if (existing) {
            await db.patch(existing._id, {
                cadence: args.cadence,
                enabled: args.enabled,
                nextRunAt,
                parameters: args.parameters,
                updatedAt: now,
            });
            await appendTenantAdminReportMutationAudit(ctx, authContext, {
                entityId: String(existing._id),
                event: "tenant_admin.report.scheduled",
                metadata: {
                    cadence: args.cadence,
                    enabled: args.enabled,
                    reportType: args.reportType,
                },
                outcome: "allowed",
            });
            return existing._id;
        }

        const scheduleId = await db.insert("tenantAdminReportSchedules", {
            cadence: args.cadence,
            createdAt: now,
            createdByTenantUserId: tenantUser._id,
            enabled: args.enabled,
            maxRetries: 3,
            nextRunAt,
            parameters: args.parameters,
            reportType: args.reportType,
            retryCount: 0,
            tenantId: authContext.tenantId,
            updatedAt: now,
        });
        await appendTenantAdminReportMutationAudit(ctx, authContext, {
            entityId: String(scheduleId),
            event: "tenant_admin.report.scheduled",
            metadata: {
                cadence: args.cadence,
                enabled: args.enabled,
                reportType: args.reportType,
            },
            outcome: "allowed",
        });
        return scheduleId;
    },
});

export const createTenantAdminReportJobFromAction = internalMutation({
    args: {
        fileName: v.optional(v.string()),
        downloadUrl: v.optional(v.string()),
        idempotencyKey: v.string(),
        metadata: v.any(),
        parameters: reportParametersValidator,
        reportName: v.string(),
        serviceJobId: v.optional(v.string()),
        status: reportStatusValidator,
    },
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["tenant_admin"]);
        const tenantUser = await getCurrentTenantUser(ctx, authContext);
        const db = ctx.db as any;
        const now = Date.now();

        return await db.insert("tenantAdminReportJobs", {
            createdAt: now,
            dateFrom: args.parameters.dateRange.from,
            dateTo: args.parameters.dateRange.to,
            departmentId: args.parameters.departmentId,
            downloadCount: 0,
            downloadUrl: args.downloadUrl,
            fileName: args.fileName,
            fiscalYear: args.parameters.fiscalYear,
            format: args.parameters.format,
            idempotencyKey: args.idempotencyKey,
            metadata: args.metadata,
            outputFormat: args.parameters.format,
            procurementOfficerId: args.parameters.procurementOfficerId,
            queuedAt: now,
            readyAt: args.status === "ready" ? now : undefined,
            reportName: args.reportName,
            reportType: args.parameters.reportType,
            requestedByTenantUserId: tenantUser._id,
            requestedByUserId: authContext.userId,
            retryCount: 0,
            schemaVersion: String(args.metadata?.schemaVersion ?? "tenant-admin-report.v1"),
            serviceJobId: args.serviceJobId,
            staleTimeoutAt: now + TENANT_ADMIN_REPORT_STALE_TIMEOUT_MS,
            status: args.status,
            tenantId: authContext.tenantId,
            updatedAt: now,
        });
    },
});

export const createTenantAdminReportJobForSchedule = internalMutation({
    args: {
        idempotencyKey: v.string(),
        metadata: v.any(),
        parameters: reportParametersValidator,
        reportName: v.string(),
        tenantId: v.id("tenants"),
        tenantUserId: v.id("tenantUsers"),
    },
    handler: async (ctx, args) => {
        const tenantUser = await ctx.db.get(args.tenantUserId);
        if (
            !tenantUser ||
            tenantUser.tenantId !== args.tenantId ||
            tenantUser.role !== "tenant_admin" ||
            !tenantUser.isActive
        ) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Tenant Admin schedule owner is not active.",
            });
        }
        const now = Date.now();
        return await ctx.db.insert("tenantAdminReportJobs", {
            createdAt: now,
            dateFrom: args.parameters.dateRange.from,
            dateTo: args.parameters.dateRange.to,
            departmentId: args.parameters.departmentId,
            downloadCount: 0,
            fiscalYear: args.parameters.fiscalYear,
            format: args.parameters.format,
            idempotencyKey: args.idempotencyKey,
            metadata: args.metadata,
            outputFormat: args.parameters.format,
            procurementOfficerId: args.parameters.procurementOfficerId,
            queuedAt: now,
            reportName: args.reportName,
            reportType: args.parameters.reportType,
            requestedByTenantUserId: args.tenantUserId,
            requestedByUserId: tenantUser.userId,
            retryCount: 0,
            schemaVersion: String(args.metadata?.schemaVersion ?? "tenant-admin-report.v1"),
            staleTimeoutAt: now + TENANT_ADMIN_REPORT_STALE_TIMEOUT_MS,
            status: "queued",
            tenantId: args.tenantId,
            updatedAt: now,
        });
    },
});

export const completeTenantAdminReportJobFromService = internalMutation({
    args: {
        checksum: v.optional(v.string()),
        downloadUrl: v.optional(v.string()),
        fileName: v.optional(v.string()),
        fileSizeBytes: v.optional(v.number()),
        idempotencyKey: v.optional(v.string()),
        reportJobId: v.optional(v.id("tenantAdminReportJobs")),
        serviceJobId: v.optional(v.string()),
        storageId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const db = ctx.db as any;
        const job =
            args.reportJobId
                ? await db.get(args.reportJobId)
                : args.idempotencyKey
                  ? await db
                        .query("tenantAdminReportJobs")
                        .withIndex("by_idempotencyKey", (q: any) => q.eq("idempotencyKey", args.idempotencyKey))
                        .first()
                  : args.serviceJobId
                    ? await db
                          .query("tenantAdminReportJobs")
                          .withIndex("by_serviceJobId", (q: any) => q.eq("serviceJobId", args.serviceJobId))
                          .first()
                    : null;
        if (!job) {
            return null;
        }

        const now = Date.now();
        await db.patch(job._id, {
            checksum: args.checksum,
            downloadUrl: args.downloadUrl ?? job.downloadUrl,
            fileName: args.fileName ?? job.fileName,
            fileSizeBytes: args.fileSizeBytes,
            readyAt: now,
            status: "ready",
            storageId: args.storageId,
            updatedAt: now,
        });
        await db.insert("auditLogs", {
            action: "export",
            actorRole: "tenant_admin",
            actorState: "service_callback",
            actorUserId: job.requestedByUserId,
            entityType: "tenant_admin_report",
            event: "tenant_admin.report.ready",
            metadata: {
                reportJobId: String(job._id),
                reportType: job.reportType,
            },
            outcome: "allowed",
            recordId: String(job._id),
            sourceTenantId: job.tenantId,
            tableName: "tenantAdminReportJobs",
            targetTenantId: job.tenantId,
            timestamp: now,
        });
        return job._id;
    },
});

export const attachTenantAdminReportServiceJob = internalMutation({
    args: {
        reportJobId: v.id("tenantAdminReportJobs"),
        serviceJobId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.reportJobId, {
            serviceJobId: args.serviceJobId,
            updatedAt: Date.now(),
        });
        return null;
    },
});

export const markTenantAdminReportJobFailedFromAction = internalMutation({
    args: {
        errorMessage: v.string(),
        idempotencyKey: v.string(),
    },
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["tenant_admin"]);
        const db = ctx.db as any;
        const now = Date.now();
        const job = await db
            .query("tenantAdminReportJobs")
            .withIndex("by_idempotencyKey", (q: any) => q.eq("idempotencyKey", args.idempotencyKey))
            .first();

        if (!job || job.tenantId !== authContext.tenantId) {
            return null;
        }

        await db.patch(job._id, {
            errorMessage: args.errorMessage,
            failedAt: now,
            status: "failed",
            updatedAt: now,
        });
        return job._id;
    },
});

export const failTenantAdminReportJobFromService = internalMutation({
    args: {
        errorMessage: v.string(),
        idempotencyKey: v.optional(v.string()),
        reportJobId: v.optional(v.id("tenantAdminReportJobs")),
        serviceJobId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const db = ctx.db as any;
        const job =
            args.reportJobId
                ? await db.get(args.reportJobId)
                : args.idempotencyKey
                  ? await db
                        .query("tenantAdminReportJobs")
                        .withIndex("by_idempotencyKey", (q: any) => q.eq("idempotencyKey", args.idempotencyKey))
                        .first()
                  : args.serviceJobId
                    ? await db
                          .query("tenantAdminReportJobs")
                          .withIndex("by_serviceJobId", (q: any) => q.eq("serviceJobId", args.serviceJobId))
                          .first()
                    : null;
        if (!job) {
            return null;
        }
        const now = Date.now();
        await db.patch(job._id, {
            errorMessage: args.errorMessage.slice(0, 240),
            failedAt: now,
            status: "failed",
            updatedAt: now,
        });
        await db.insert("auditLogs", {
            action: "export",
            actorRole: "tenant_admin",
            actorState: "service_callback",
            actorUserId: job.requestedByUserId,
            entityType: "tenant_admin_report",
            event: "tenant_admin.report.failed",
            metadata: {
                errorMessage: args.errorMessage.slice(0, 240),
                reportJobId: String(job._id),
                reportType: job.reportType,
            },
            outcome: "failed",
            recordId: String(job._id),
            sourceTenantId: job.tenantId,
            tableName: "tenantAdminReportJobs",
            targetTenantId: job.tenantId,
            timestamp: now,
        });
        return job._id;
    },
});

export const markStaleTenantAdminReportJobsFailed = mutation({
    args: {},
    handler: async (ctx) => {
        const authContext = await requireTenantRole(ctx, ["tenant_admin"]);
        const db = ctx.db as any;
        const now = Date.now();
        const jobs = await db
            .query("tenantAdminReportJobs")
            .withIndex("by_tenantId_createdAt", (q: any) => q.eq("tenantId", authContext.tenantId))
            .collect();
        let failedCount = 0;
        for (const job of jobs) {
            if (job.status === "queued" && job.staleTimeoutAt && job.staleTimeoutAt <= now) {
                await db.patch(job._id, {
                    errorMessage: "Report generation timed out. Retry from the reports workspace.",
                    failedAt: now,
                    status: "failed",
                    updatedAt: now,
                });
                failedCount += 1;
            }
        }
        return failedCount;
    },
});

export const listDueTenantAdminReportSchedules = internalMutation({
    args: {
        now: v.number(),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const db = ctx.db as any;
        const rows = await db
            .query("tenantAdminReportSchedules")
            .withIndex("by_enabled_nextRunAt", (q: any) =>
                q.eq("enabled", true).lte("nextRunAt", args.now),
            )
            .take(args.limit ?? 20);
        return rows;
    },
});

export const markTenantAdminReportScheduleSuccess = internalMutation({
    args: {
        scheduleId: v.id("tenantAdminReportSchedules"),
    },
    handler: async (ctx, args) => {
        const schedule = await ctx.db.get(args.scheduleId);
        if (!schedule) {
            return null;
        }
        const now = Date.now();
        await ctx.db.patch(args.scheduleId, {
            lastRunAt: now,
            nextRunAt: computeNextScheduleRun(now, schedule.cadence),
            retryCount: 0,
            updatedAt: now,
        });
        return args.scheduleId;
    },
});

export const markTenantAdminReportScheduleFailure = internalMutation({
    args: {
        errorMessage: v.string(),
        scheduleId: v.id("tenantAdminReportSchedules"),
    },
    handler: async (ctx, args) => {
        const schedule = await ctx.db.get(args.scheduleId);
        if (!schedule) {
            return null;
        }
        const db = ctx.db as any;
        const now = Date.now();
        const nextRetryCount = schedule.retryCount + 1;
        const exhausted = nextRetryCount >= schedule.maxRetries;
        await ctx.db.patch(args.scheduleId, {
            enabled: exhausted ? false : schedule.enabled,
            lastFailureAt: now,
            nextRunAt: exhausted ? schedule.nextRunAt : now + 15 * 60 * 1000,
            retryCount: nextRetryCount,
            updatedAt: now,
        });
        await db.insert("auditLogs", {
            action: "report",
            actorRole: "tenant_admin",
            actorState: "scheduled",
            entityType: "tenant_admin_report_schedule",
            event: exhausted
                ? "tenant_admin.report.schedule_retry_exhausted"
                : "tenant_admin.report.schedule_failed",
            metadata: {
                errorMessage: args.errorMessage.slice(0, 240),
                reportType: schedule.reportType,
                retryCount: nextRetryCount,
                scheduleId: String(schedule._id),
            },
            outcome: "failed",
            recordId: String(schedule._id),
            sourceTenantId: schedule.tenantId,
            tableName: "tenantAdminReportSchedules",
            targetTenantId: schedule.tenantId,
            timestamp: now,
        });
        return {
            exhausted,
            scheduleId: args.scheduleId,
        };
    },
});

async function getCurrentTenantUser(
    ctx: Parameters<typeof requireTenantRole>[0],
    authContext: Awaited<ReturnType<typeof requireTenantRole>>,
) {
    const db = ctx.db as any;
    const tenantUser = await db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q: any) =>
            q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId),
        )
        .first();

    if (!tenantUser || tenantUser.role !== "tenant_admin" || !tenantUser.isActive) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Tenant Admin access is required for reports.",
        });
    }

    return tenantUser;
}

function computeNextScheduleRun(now: number, cadence: TenantAdminReportScheduleCadence): number {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() + (cadence === "weekly" ? 7 : 30));
    return date.getTime();
}

function createShareToken(reportJobId: Id<"tenantAdminReportJobs">, now: number): string {
    return `${reportJobId}-${now.toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function hashTokenForStorage(token: string): string {
    let hash = 0;
    for (let index = 0; index < token.length; index += 1) {
        hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
}

async function appendTenantAdminReportMutationAudit(
    ctx: Parameters<typeof requireTenantRole>[0],
    authContext: Awaited<ReturnType<typeof requireTenantRole>>,
    args: {
        entityId: string;
        event: string;
        metadata: Record<string, unknown>;
        outcome: string;
    },
): Promise<void> {
    const db = ctx.db as any;
    await db.insert("auditLogs", {
        action: "report",
        actorRole: authContext.role,
        actorState: "authenticated",
        actorUserId: authContext.userId,
        entityType: "tenant_admin_report",
        event: args.event,
        metadata: args.metadata,
        outcome: args.outcome,
        recordId: args.entityId,
        sourceTenantId: authContext.tenantId,
        tableName: "tenantAdminReportJobs",
        targetTenantId: authContext.tenantId,
        timestamp: Date.now(),
    });
}
