"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveProcurementOfficerConsolidationDraft = exports.getProcurementOfficerConsolidationWorkspace = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const consolidation_1 = require("../../lib/procurement-officer/consolidation");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const audit_1 = require("../../lib/security/audit");
async function loadProcurementOfficerTenantUser(ctx, args) {
    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) => q.eq("userId", args.userId).eq("tenantId", args.tenantId))
        .first();
    if (!tenantUser || !tenantUser.isActive || tenantUser.role !== "procurement_officer") {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for consolidation.",
        });
    }
    return tenantUser;
}
async function loadConsolidationBase(ctx, args) {
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
        throw new values_1.ConvexError({
            code: "NOT_FOUND",
            message: "Tenant record not found",
        });
    }
    const fiscalYears = (0, consolidation_1.normalizeConsolidationFiscalYear)({
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
    const readiness = (0, consolidation_1.buildConsolidationReadiness)({
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
function mapPlanRecord(plan) {
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
async function loadDraft(ctx, args) {
    return ctx.db
        .query("consolidations")
        .withIndex("by_tenantId_status_fiscalYear", (q) => q.eq("tenantId", args.tenantId)
        .eq("status", "draft")
        .eq("fiscalYear", args.fiscalYear))
        .first();
}
function mapDraft(draft) {
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
function assertSelectedSourcesAreStillApproved(args) {
    const ready = new Set(args.readyDepartmentIds);
    const staleSourceIds = args.selectedSourceDepartmentIds.filter((departmentId) => !ready.has(departmentId));
    if (staleSourceIds.length > 0) {
        throw new values_1.ConvexError({
            code: "STALE_SOURCE_PLAN",
            message: "One or more selected departments no longer have approved plans. Refresh the workspace before saving.",
            staleSourceDepartmentIds: staleSourceIds,
        });
    }
}
function buildConsolidationAuditEntry(args) {
    return {
        action: args.action,
        actor: (0, audit_1.createAuthenticatedAuditActor)({
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
        outcome: audit_1.AUDIT_OUTCOMES.allowed,
        recordId: String(args.consolidationId),
        sourceTenantId: String(args.tenantId),
        tableName: "consolidations",
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    };
}
exports.getProcurementOfficerConsolidationWorkspace = (0, server_1.query)({
    args: {
        selectedFiscalYear: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
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
exports.saveProcurementOfficerConsolidationDraft = (0, server_1.mutation)({
    args: {
        expectedRevision: values_1.v.optional(values_1.v.number()),
        fiscalYear: values_1.v.string(),
        notes: values_1.v.optional(values_1.v.string()),
        selectedSourceDepartmentIds: values_1.v.array(values_1.v.string()),
        workspaceState: values_1.v.optional(values_1.v.any()),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const tenantUser = await loadProcurementOfficerTenantUser(ctx, {
            tenantId: authContext.tenantId,
            userId: authContext.userId,
        });
        const validation = (0, consolidation_1.validateConsolidationDraftPayload)({
            notes: args.notes,
            selectedSourceDepartmentIds: args.selectedSourceDepartmentIds,
            workspaceState: args.workspaceState,
        });
        if (!validation.ok) {
            throw new values_1.ConvexError({
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
            throw new values_1.ConvexError({
                code: "REVISION_CONFLICT",
                message: "This consolidation draft already exists. Refresh before saving again.",
                currentRevision: existingDraft.revision,
            });
        }
        if (existingDraft &&
            existingDraft.revision !== args.expectedRevision) {
            throw new values_1.ConvexError({
                code: "REVISION_CONFLICT",
                message: "This consolidation draft changed in another tab or device. Refresh before saving again.",
                currentRevision: existingDraft.revision,
            });
        }
        const now = Date.now();
        const draftData = {
            notes: args.notes ?? "",
            selectedSourceDepartmentIds: args.selectedSourceDepartmentIds,
            sourcePlanIds: base.readiness.readyDepartments
                .filter((department) => args.selectedSourceDepartmentIds.includes(department.departmentId))
                .map((department) => department.planId),
        };
        if (!existingDraft) {
            const consolidationId = await ctx.db.insert("consolidations", {
                createdAt: now,
                createdByTenantUserId: tenantUser._id,
                draftData,
                fiscalYear: base.readiness.selectedFiscalYear,
                revision: 1,
                schemaVersion: consolidation_1.CONSOLIDATION_DRAFT_SCHEMA_VERSION,
                status: "draft",
                tenantId: authContext.tenantId,
                updatedAt: now,
                updatedByTenantUserId: tenantUser._id,
                workspaceState: args.workspaceState,
            });
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildConsolidationAuditEntry({
                action: "create_draft",
                actorUserId: authContext.userId,
                consolidationId,
                event: audit_1.AUDIT_EVENT_NAMES.consolidationDraftCreated,
                fiscalYear: base.readiness.selectedFiscalYear,
                selectedSourceDepartmentIds: args.selectedSourceDepartmentIds,
                tenantId: authContext.tenantId,
            }));
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
            schemaVersion: consolidation_1.CONSOLIDATION_DRAFT_SCHEMA_VERSION,
            updatedAt: now,
            updatedByTenantUserId: tenantUser._id,
            workspaceState: args.workspaceState,
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildConsolidationAuditEntry({
            action: "update_draft",
            actorUserId: authContext.userId,
            consolidationId: existingDraft._id,
            event: audit_1.AUDIT_EVENT_NAMES.consolidationDraftUpdated,
            fiscalYear: base.readiness.selectedFiscalYear,
            selectedSourceDepartmentIds: args.selectedSourceDepartmentIds,
            tenantId: authContext.tenantId,
        }));
        const savedDraft = await ctx.db.get(existingDraft._id);
        return {
            draft: mapDraft(savedDraft),
            readiness: base.readiness,
        };
    },
});
