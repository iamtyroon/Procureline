"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markTenantAdminReportScheduleFailure = exports.markTenantAdminReportScheduleSuccess = exports.listDueTenantAdminReportSchedules = exports.markStaleTenantAdminReportJobsFailed = exports.failTenantAdminReportJobFromService = exports.markTenantAdminReportJobFailedFromAction = exports.attachTenantAdminReportServiceJob = exports.completeTenantAdminReportJobFromService = exports.createTenantAdminReportJobForSchedule = exports.createTenantAdminReportJobFromAction = exports.upsertTenantAdminReportSchedule = exports.recordTenantAdminReportDownload = exports.resolveTenantAdminReportShareLink = exports.createTenantAdminReportShareLink = exports.getTenantAdminReportSource = exports.listTenantAdminReportJobs = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const _roleGuard_1 = require("./_roleGuard");
const report_generation_1 = require("../../lib/shared/tenant-admin/report-generation");
const reportTypeValidator = values_1.v.union(values_1.v.literal("activity"), values_1.v.literal("audit"), values_1.v.literal("budget"));
const reportFormatValidator = values_1.v.union(values_1.v.literal("csv"), values_1.v.literal("xlsx"));
const overviewStatusValidator = values_1.v.union(values_1.v.literal("all"), values_1.v.literal("approved"), values_1.v.literal("draft"), values_1.v.literal("not_started"), values_1.v.literal("rejected"), values_1.v.literal("submitted"));
const reportParametersValidator = values_1.v.object({
    dateRange: values_1.v.object({
        from: values_1.v.string(),
        to: values_1.v.string(),
    }),
    departmentId: values_1.v.union(values_1.v.string(), values_1.v.literal("all")),
    fiscalYear: values_1.v.string(),
    format: reportFormatValidator,
    procurementOfficerId: values_1.v.union(values_1.v.string(), values_1.v.literal("all")),
    reportType: reportTypeValidator,
    status: overviewStatusValidator,
});
const reportStatusValidator = values_1.v.union(values_1.v.literal("failed"), values_1.v.literal("queued"), values_1.v.literal("ready"));
const scheduleCadenceValidator = values_1.v.union(values_1.v.literal("monthly"), values_1.v.literal("weekly"));
exports.listTenantAdminReportJobs = (0, server_1.query)({
    args: {},
    handler: async (ctx) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const db = ctx.db;
        return await db
            .query("tenantAdminReportJobs")
            .withIndex("by_tenantId_createdAt", (q) => q.eq("tenantId", authContext.tenantId))
            .order("desc")
            .take(20);
    },
});
exports.getTenantAdminReportSource = (0, server_1.query)({
    args: {
        fiscalYear: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const db = ctx.db;
        const [tenant, targetActivity, sourceActivity] = await Promise.all([
            db.get(authContext.tenantId),
            db
                .query("auditLogs")
                .withIndex("by_targetTenantId", (q) => q.eq("targetTenantId", authContext.tenantId))
                .order("desc")
                .take(500),
            db
                .query("auditLogs")
                .withIndex("by_sourceTenantId", (q) => q.eq("sourceTenantId", authContext.tenantId))
                .order("desc")
                .take(500),
        ]);
        const auditLogs = [...targetActivity, ...sourceActivity]
            .sort((left, right) => right.timestamp - left.timestamp)
            .filter((log, index, collection) => collection.findIndex((candidate) => candidate._id === log._id) === index);
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
exports.createTenantAdminReportShareLink = (0, server_1.mutation)({
    args: {
        reportJobId: values_1.v.id("tenantAdminReportJobs"),
    },
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const tenantUser = await getCurrentTenantUser(ctx, authContext);
        const db = ctx.db;
        const job = await db.get(args.reportJobId);
        if (!job || job.tenantId !== authContext.tenantId) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Report job not found.",
            });
        }
        if (job.status !== "ready") {
            throw new values_1.ConvexError({
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
            expiresAt: (0, report_generation_1.buildSecureShareExpiry)(now),
            reportJobId: args.reportJobId,
            tenantId: authContext.tenantId,
            tokenHash: hashTokenForStorage(token),
        });
        await appendTenantAdminReportMutationAudit(ctx, authContext, {
            entityId: String(args.reportJobId),
            event: "tenant_admin.report.link_created",
            metadata: {
                expiresAt: (0, report_generation_1.buildSecureShareExpiry)(now),
                linkId: String(linkId),
                reportJobId: String(args.reportJobId),
            },
            outcome: "allowed",
        });
        return {
            expiresAt: (0, report_generation_1.buildSecureShareExpiry)(now),
            linkId,
            url: `/tenant-admin/reports/share/${token}`,
        };
    },
});
exports.resolveTenantAdminReportShareLink = (0, server_1.mutation)({
    args: {
        token: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const db = ctx.db;
        const now = Date.now();
        const link = await db
            .query("tenantAdminReportSecureLinks")
            .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hashTokenForStorage(args.token)))
            .first();
        if (!link || link.revokedAt || link.expiresAt <= now) {
            throw new values_1.ConvexError({
                code: "LINK_EXPIRED",
                message: "This report link is no longer available.",
            });
        }
        const job = await db.get(link.reportJobId);
        if (!job || job.tenantId !== link.tenantId || job.status !== "ready" || !job.downloadUrl) {
            throw new values_1.ConvexError({
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
exports.recordTenantAdminReportDownload = (0, server_1.mutation)({
    args: {
        reportJobId: values_1.v.id("tenantAdminReportJobs"),
    },
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const tenantUser = await getCurrentTenantUser(ctx, authContext);
        const db = ctx.db;
        const job = await db.get(args.reportJobId);
        if (!job || job.tenantId !== authContext.tenantId || job.status !== "ready" || !job.downloadUrl) {
            throw new values_1.ConvexError({
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
exports.upsertTenantAdminReportSchedule = (0, server_1.mutation)({
    args: {
        cadence: scheduleCadenceValidator,
        enabled: values_1.v.boolean(),
        parameters: reportParametersValidator,
        reportType: values_1.v.union(values_1.v.literal("activity"), values_1.v.literal("budget")),
    },
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const tenantUser = await getCurrentTenantUser(ctx, authContext);
        const db = ctx.db;
        const now = Date.now();
        const nextRunAt = computeNextScheduleRun(now, args.cadence);
        const existing = await db
            .query("tenantAdminReportSchedules")
            .withIndex("by_tenantId_reportType", (q) => q.eq("tenantId", authContext.tenantId).eq("reportType", args.reportType))
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
exports.createTenantAdminReportJobFromAction = (0, server_1.internalMutation)({
    args: {
        fileName: values_1.v.optional(values_1.v.string()),
        downloadUrl: values_1.v.optional(values_1.v.string()),
        idempotencyKey: values_1.v.string(),
        metadata: values_1.v.any(),
        parameters: reportParametersValidator,
        reportName: values_1.v.string(),
        serviceJobId: values_1.v.optional(values_1.v.string()),
        status: reportStatusValidator,
    },
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const tenantUser = await getCurrentTenantUser(ctx, authContext);
        const db = ctx.db;
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
            staleTimeoutAt: now + report_generation_1.TENANT_ADMIN_REPORT_STALE_TIMEOUT_MS,
            status: args.status,
            tenantId: authContext.tenantId,
            updatedAt: now,
        });
    },
});
exports.createTenantAdminReportJobForSchedule = (0, server_1.internalMutation)({
    args: {
        idempotencyKey: values_1.v.string(),
        metadata: values_1.v.any(),
        parameters: reportParametersValidator,
        reportName: values_1.v.string(),
        tenantId: values_1.v.id("tenants"),
        tenantUserId: values_1.v.id("tenantUsers"),
    },
    handler: async (ctx, args) => {
        const tenantUser = await ctx.db.get(args.tenantUserId);
        if (!tenantUser ||
            tenantUser.tenantId !== args.tenantId ||
            tenantUser.role !== "tenant_admin" ||
            !tenantUser.isActive) {
            throw new values_1.ConvexError({
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
            staleTimeoutAt: now + report_generation_1.TENANT_ADMIN_REPORT_STALE_TIMEOUT_MS,
            status: "queued",
            tenantId: args.tenantId,
            updatedAt: now,
        });
    },
});
exports.completeTenantAdminReportJobFromService = (0, server_1.internalMutation)({
    args: {
        checksum: values_1.v.optional(values_1.v.string()),
        downloadUrl: values_1.v.optional(values_1.v.string()),
        fileName: values_1.v.optional(values_1.v.string()),
        fileSizeBytes: values_1.v.optional(values_1.v.number()),
        idempotencyKey: values_1.v.optional(values_1.v.string()),
        reportJobId: values_1.v.optional(values_1.v.id("tenantAdminReportJobs")),
        serviceJobId: values_1.v.optional(values_1.v.string()),
        storageId: values_1.v.optional(values_1.v.string()),
    },
    handler: async (ctx, args) => {
        const db = ctx.db;
        const job = args.reportJobId
            ? await db.get(args.reportJobId)
            : args.idempotencyKey
                ? await db
                    .query("tenantAdminReportJobs")
                    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
                    .first()
                : args.serviceJobId
                    ? await db
                        .query("tenantAdminReportJobs")
                        .withIndex("by_serviceJobId", (q) => q.eq("serviceJobId", args.serviceJobId))
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
exports.attachTenantAdminReportServiceJob = (0, server_1.internalMutation)({
    args: {
        reportJobId: values_1.v.id("tenantAdminReportJobs"),
        serviceJobId: values_1.v.optional(values_1.v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.reportJobId, {
            serviceJobId: args.serviceJobId,
            updatedAt: Date.now(),
        });
        return null;
    },
});
exports.markTenantAdminReportJobFailedFromAction = (0, server_1.internalMutation)({
    args: {
        errorMessage: values_1.v.string(),
        idempotencyKey: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const db = ctx.db;
        const now = Date.now();
        const job = await db
            .query("tenantAdminReportJobs")
            .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
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
exports.failTenantAdminReportJobFromService = (0, server_1.internalMutation)({
    args: {
        errorMessage: values_1.v.string(),
        idempotencyKey: values_1.v.optional(values_1.v.string()),
        reportJobId: values_1.v.optional(values_1.v.id("tenantAdminReportJobs")),
        serviceJobId: values_1.v.optional(values_1.v.string()),
    },
    handler: async (ctx, args) => {
        const db = ctx.db;
        const job = args.reportJobId
            ? await db.get(args.reportJobId)
            : args.idempotencyKey
                ? await db
                    .query("tenantAdminReportJobs")
                    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
                    .first()
                : args.serviceJobId
                    ? await db
                        .query("tenantAdminReportJobs")
                        .withIndex("by_serviceJobId", (q) => q.eq("serviceJobId", args.serviceJobId))
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
exports.markStaleTenantAdminReportJobsFailed = (0, server_1.mutation)({
    args: {},
    handler: async (ctx) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const db = ctx.db;
        const now = Date.now();
        const jobs = await db
            .query("tenantAdminReportJobs")
            .withIndex("by_tenantId_createdAt", (q) => q.eq("tenantId", authContext.tenantId))
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
exports.listDueTenantAdminReportSchedules = (0, server_1.internalMutation)({
    args: {
        now: values_1.v.number(),
        limit: values_1.v.optional(values_1.v.number()),
    },
    handler: async (ctx, args) => {
        const db = ctx.db;
        const rows = await db
            .query("tenantAdminReportSchedules")
            .withIndex("by_enabled_nextRunAt", (q) => q.eq("enabled", true).lte("nextRunAt", args.now))
            .take(args.limit ?? 20);
        return rows;
    },
});
exports.markTenantAdminReportScheduleSuccess = (0, server_1.internalMutation)({
    args: {
        scheduleId: values_1.v.id("tenantAdminReportSchedules"),
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
exports.markTenantAdminReportScheduleFailure = (0, server_1.internalMutation)({
    args: {
        errorMessage: values_1.v.string(),
        scheduleId: values_1.v.id("tenantAdminReportSchedules"),
    },
    handler: async (ctx, args) => {
        const schedule = await ctx.db.get(args.scheduleId);
        if (!schedule) {
            return null;
        }
        const db = ctx.db;
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
async function getCurrentTenantUser(ctx, authContext) {
    const db = ctx.db;
    const tenantUser = await db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) => q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId))
        .first();
    if (!tenantUser || tenantUser.role !== "tenant_admin" || !tenantUser.isActive) {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "Tenant Admin access is required for reports.",
        });
    }
    return tenantUser;
}
function computeNextScheduleRun(now, cadence) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() + (cadence === "weekly" ? 7 : 30));
    return date.getTime();
}
function createShareToken(reportJobId, now) {
    return `${reportJobId}-${now.toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function hashTokenForStorage(token) {
    let hash = 0;
    for (let index = 0; index < token.length; index += 1) {
        hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
}
async function appendTenantAdminReportMutationAudit(ctx, authContext, args) {
    const db = ctx.db;
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
