import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireTenantRole } from "./_roleGuard";
import {
    buildSecureShareExpiry,
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
            status: args.status,
            tenantId: authContext.tenantId,
            updatedAt: now,
        });
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
