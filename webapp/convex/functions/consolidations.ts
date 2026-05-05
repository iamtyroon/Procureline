import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import {
    CONSOLIDATION_DRAFT_SCHEMA_VERSION,
    buildConsolidationReadiness,
    normalizeConsolidationFiscalYear,
    validateConsolidationDraftPayload,
} from "../../lib/procurement-officer/consolidation";
import { appendAuditLogRequired } from "./_audit";
import { requireTenantRole } from "./_roleGuard";
import {
    AUDIT_EVENT_NAMES,
    AUDIT_OUTCOMES,
    createAuthenticatedAuditActor,
} from "../../lib/security/audit";

type DataCtx = MutationCtx | QueryCtx;

async function loadProcurementOfficerTenantUser(
    ctx: DataCtx,
    args: {
        tenantId: Id<"tenants">;
        userId: Id<"users">;
    },
) {
    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) =>
            q.eq("userId", args.userId).eq("tenantId", args.tenantId),
        )
        .first();

    if (!tenantUser || !tenantUser.isActive || tenantUser.role !== "procurement_officer") {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for consolidation.",
        });
    }

    return tenantUser;
}

async function loadConsolidationBase(ctx: DataCtx, args: {
    requestedFiscalYear?: string;
    tenantId: Id<"tenants">;
}) {
    const [tenant, departments, deadlines, plans] = await Promise.all([
        ctx.db.get(args.tenantId),
        ctx.db
            .query("departments")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
            .collect(),
        ctx.db
            .query("submissionDeadlines")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
            .collect(),
        ctx.db
            .query("plans")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
            .collect(),
    ]);

    if (!tenant) {
        throw new ConvexError({
            code: "NOT_FOUND",
            message: "Tenant record not found",
        });
    }

    const fiscalYears = normalizeConsolidationFiscalYear({
        departments: departments.map((department) => ({
            id: String(department._id),
            isActive: department.isActive,
            submissionEndsAt: department.submissionEndsAt,
            submissionStartsAt: department.submissionStartsAt,
        })),
        fiscalYearStartMonth: tenant.fiscalYearStartMonth,
        now: Date.now(),
        requestedFiscalYear: args.requestedFiscalYear,
        submissionDeadlineFiscalYears: deadlines.map((deadline) => deadline.fiscalYearKey),
        tenantTimeZone: tenant.timeZone,
    });
    const readiness = buildConsolidationReadiness({
        departments: departments.map((department) => ({
            budgetAllocation: department.budgetAllocation ?? null,
            code: department.code,
            id: String(department._id),
            isActive: department.isActive,
            name: department.name,
            submissionEndsAt: department.submissionEndsAt,
            submissionStartsAt: department.submissionStartsAt,
            voteNumber: department.voteNumber ?? department.code,
        })),
        fiscalYearStartMonth: tenant.fiscalYearStartMonth,
        plans: plans.map((plan) => mapPlanRecord(plan)),
        selectedFiscalYear: fiscalYears.selectedFiscalYear,
        tenantTimeZone: tenant.timeZone,
    });

    return { fiscalYears, readiness, tenant };
}

function mapPlanRecord(plan: Doc<"plans">) {
    return {
        approvedAt: plan.approvedAt ?? null,
        consolidatedAt: plan.consolidatedAt ?? null,
        departmentId: String(plan.departmentId),
        departmentNameSnapshot: plan.departmentNameSnapshot ?? null,
        estimatedBudgetUsed: plan.estimatedBudgetUsed,
        fiscalYear: plan.fiscalYear,
        id: String(plan._id),
        itemCount: plan.itemCount,
        status: plan.status,
        updatedAt: plan.updatedAt,
    };
}

async function loadDraft(ctx: DataCtx, args: {
    fiscalYear: string;
    tenantId: Id<"tenants">;
}) {
    return ctx.db
        .query("consolidations")
        .withIndex("by_tenantId_status_fiscalYear", (q) =>
            q.eq("tenantId", args.tenantId)
                .eq("status", "draft")
                .eq("fiscalYear", args.fiscalYear),
        )
        .first();
}

function mapDraft(draft: Doc<"consolidations"> | null) {
    if (!draft) {
        return null;
    }

    return {
        createdAt: draft.createdAt,
        draftData: draft.draftData,
        fiscalYear: draft.fiscalYear,
        id: String(draft._id),
        revision: draft.revision,
        schemaVersion: draft.schemaVersion,
        status: draft.status,
        updatedAt: draft.updatedAt,
        workspaceState: draft.workspaceState ?? null,
    };
}

function assertSelectedSourcesAreStillApproved(args: {
    readyDepartmentIds: readonly string[];
    selectedSourceDepartmentIds: readonly string[];
}): void {
    const ready = new Set(args.readyDepartmentIds);
    const staleSourceIds = args.selectedSourceDepartmentIds.filter(
        (departmentId) => !ready.has(departmentId),
    );

    if (staleSourceIds.length > 0) {
        throw new ConvexError({
            code: "STALE_SOURCE_PLAN",
            message:
                "One or more selected departments no longer have approved plans. Refresh the workspace before saving.",
            staleSourceDepartmentIds: staleSourceIds,
        });
    }
}

function buildConsolidationAuditEntry(args: {
    action: "create_draft" | "update_draft";
    actorUserId: Id<"users">;
    consolidationId: Id<"consolidations">;
    event:
        | typeof AUDIT_EVENT_NAMES.consolidationDraftCreated
        | typeof AUDIT_EVENT_NAMES.consolidationDraftUpdated;
    fiscalYear: string;
    selectedSourceDepartmentIds: readonly string[];
    tenantId: Id<"tenants">;
}) {
    return {
        action: args.action,
        actor: createAuthenticatedAuditActor({
            role: "procurement_officer",
            userId: String(args.actorUserId),
        }),
        entityType: "consolidation",
        event: args.event,
        metadata: {
            fiscalYear: args.fiscalYear,
            selectedSourceDepartmentIds: [...args.selectedSourceDepartmentIds],
            selectedSourceDepartmentCount: args.selectedSourceDepartmentIds.length,
        },
        outcome: AUDIT_OUTCOMES.allowed,
        recordId: String(args.consolidationId),
        sourceTenantId: String(args.tenantId),
        tableName: "consolidations",
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    } as const;
}

export const getProcurementOfficerConsolidationWorkspace = query({
    args: {
        selectedFiscalYear: v.optional(v.string()),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
        const base = await loadConsolidationBase(ctx, {
            requestedFiscalYear: args.selectedFiscalYear,
            tenantId: authContext.tenantId,
        });
        const draft = await loadDraft(ctx, {
            fiscalYear: base.readiness.selectedFiscalYear,
            tenantId: authContext.tenantId,
        });

        return {
            draft: mapDraft(draft),
            fiscalYears: base.fiscalYears,
            readiness: base.readiness,
            user: {
                tenantUserId: null,
                userId: String(authContext.userId),
            },
        };
    },
});

export const saveProcurementOfficerConsolidationDraft = mutation({
    args: {
        expectedRevision: v.optional(v.number()),
        fiscalYear: v.string(),
        notes: v.optional(v.string()),
        selectedSourceDepartmentIds: v.array(v.string()),
        workspaceState: v.optional(v.any()),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const authContext = await requireTenantRole(ctx, ["procurement_officer"]);
        const tenantUser = await loadProcurementOfficerTenantUser(ctx, {
            tenantId: authContext.tenantId,
            userId: authContext.userId,
        });
        const validation = validateConsolidationDraftPayload({
            notes: args.notes,
            selectedSourceDepartmentIds: args.selectedSourceDepartmentIds,
            workspaceState: args.workspaceState,
        });
        if (!validation.ok) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: validation.message,
            });
        }

        const base = await loadConsolidationBase(ctx, {
            requestedFiscalYear: args.fiscalYear,
            tenantId: authContext.tenantId,
        });
        assertSelectedSourcesAreStillApproved({
            readyDepartmentIds: base.readiness.readyDepartmentIds,
            selectedSourceDepartmentIds: args.selectedSourceDepartmentIds,
        });

        const existingDraft = await loadDraft(ctx, {
            fiscalYear: base.readiness.selectedFiscalYear,
            tenantId: authContext.tenantId,
        });
        if (existingDraft && typeof args.expectedRevision !== "number") {
            throw new ConvexError({
                code: "REVISION_CONFLICT",
                message:
                    "This consolidation draft already exists. Refresh before saving again.",
                currentRevision: existingDraft.revision,
            });
        }
        if (
            existingDraft &&
            existingDraft.revision !== args.expectedRevision
        ) {
            throw new ConvexError({
                code: "REVISION_CONFLICT",
                message:
                    "This consolidation draft changed in another tab or device. Refresh before saving again.",
                currentRevision: existingDraft.revision,
            });
        }

        const now = Date.now();
        const draftData = {
            notes: args.notes ?? "",
            selectedSourceDepartmentIds: args.selectedSourceDepartmentIds,
            sourcePlanIds: base.readiness.readyDepartments
                .filter((department) =>
                    args.selectedSourceDepartmentIds.includes(department.departmentId),
                )
                .map((department) => department.planId),
        };

        if (!existingDraft) {
            const consolidationId = await ctx.db.insert("consolidations", {
                createdAt: now,
                createdByTenantUserId: tenantUser._id,
                draftData,
                fiscalYear: base.readiness.selectedFiscalYear,
                revision: 1,
                schemaVersion: CONSOLIDATION_DRAFT_SCHEMA_VERSION,
                status: "draft",
                tenantId: authContext.tenantId,
                updatedAt: now,
                updatedByTenantUserId: tenantUser._id,
                workspaceState: args.workspaceState,
            });
            await appendAuditLogRequired(
                ctx,
                buildConsolidationAuditEntry({
                    action: "create_draft",
                    actorUserId: authContext.userId,
                    consolidationId,
                    event: AUDIT_EVENT_NAMES.consolidationDraftCreated,
                    fiscalYear: base.readiness.selectedFiscalYear,
                    selectedSourceDepartmentIds: args.selectedSourceDepartmentIds,
                    tenantId: authContext.tenantId,
                }),
            );

            const savedDraft = await ctx.db.get(consolidationId);
            return {
                draft: mapDraft(savedDraft),
                readiness: base.readiness,
            };
        }

        const nextRevision = existingDraft.revision + 1;
        await ctx.db.patch(existingDraft._id, {
            draftData,
            revision: nextRevision,
            schemaVersion: CONSOLIDATION_DRAFT_SCHEMA_VERSION,
            updatedAt: now,
            updatedByTenantUserId: tenantUser._id,
            workspaceState: args.workspaceState,
        });
        await appendAuditLogRequired(
            ctx,
            buildConsolidationAuditEntry({
                action: "update_draft",
                actorUserId: authContext.userId,
                consolidationId: existingDraft._id,
                event: AUDIT_EVENT_NAMES.consolidationDraftUpdated,
                fiscalYear: base.readiness.selectedFiscalYear,
                selectedSourceDepartmentIds: args.selectedSourceDepartmentIds,
                tenantId: authContext.tenantId,
            }),
        );

        const savedDraft = await ctx.db.get(existingDraft._id);
        return {
            draft: mapDraft(savedDraft),
            readiness: base.readiness,
        };
    },
});
