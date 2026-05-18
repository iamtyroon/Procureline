"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reopenProcurementOfficerConsolidationForEditing = exports.finalizeProcurementOfficerConsolidation = exports.saveProcurementOfficerConsolidationDraft = exports.getProcurementOfficerConsolidationWorkspace = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const consolidation_1 = require("../../lib/procurement-officer/consolidation");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const audit_1 = require("../../lib/shared/security/audit");
const blockly_serialization_1 = require("../../lib/shared/blockly/blockly-serialization");
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
async function readTenantUserActorSummary(ctx, tenantUserId) {
    if (!tenantUserId) {
        return null;
    }
    const tenantUser = await ctx.db.get(tenantUserId);
    if (!tenantUser) {
        return null;
    }
    const user = await ctx.db.get(tenantUser.userId);
    const email = typeof user?.email === "string" && user.email.trim().length > 0
        ? user.email.trim()
        : null;
    const name = typeof user?.name === "string" && user.name.trim().length > 0
        ? user.name.trim()
        : null;
    return {
        email,
        name,
        tenantUserId: String(tenantUser._id),
    };
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
        approvedPlanFiscalYears: plans
            .filter((plan) => plan.status === "approved")
            .map((plan) => plan.fiscalYear),
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
        workspaceState: plan.workspaceState ?? null,
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
async function loadConsolidationForFiscalYear(ctx, args) {
    return ctx.db
        .query("consolidations")
        .withIndex("by_tenantId_fiscalYear", (q) => q.eq("tenantId", args.tenantId).eq("fiscalYear", args.fiscalYear))
        .first();
}
async function loadSnapshotForConsolidation(ctx, args) {
    return ctx.db
        .query("consolidationSnapshots")
        .withIndex("by_consolidationId", (q) => q.eq("consolidationId", args.consolidationId))
        .order("desc")
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
        finalizedAt: draft.finalizedAt ?? null,
        finalizedByTenantUserId: draft.finalizedByTenantUserId
            ? String(draft.finalizedByTenantUserId)
            : null,
        revision: draft.revision,
        schemaVersion: draft.schemaVersion,
        status: draft.status,
        updatedAt: draft.updatedAt,
        workspaceState: draft.workspaceState ?? null,
    };
}
function mapSnapshot(snapshot) {
    if (!snapshot) {
        return null;
    }
    return {
        calculatedTotals: snapshot.calculatedTotals,
        capturedAt: snapshot.capturedAt,
        capturedByTenantUserId: String(snapshot.capturedByTenantUserId),
        complianceSummary: snapshot.complianceSummary,
        draftData: snapshot.draftData,
        fiscalYear: snapshot.fiscalYear,
        id: String(snapshot._id),
        notes: snapshot.notes,
        schemaVersion: snapshot.schemaVersion,
        selectedSourceDepartmentIds: snapshot.selectedSourceDepartmentIds,
        sourcePlanIds: snapshot.sourcePlanIds,
        status: snapshot.status,
        workspaceState: snapshot.workspaceState ?? null,
    };
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function getNestedBlock(value) {
    return asRecord(asRecord(value)?.block);
}
function createDepartmentStubChain(selectedSourceDepartmentIds) {
    let firstBlock = null;
    let previousBlock = null;
    for (const departmentId of selectedSourceDepartmentIds) {
        const block = {
            fields: {
                DEPARTMENT_ID: departmentId,
            },
            type: "department_block",
        };
        if (!firstBlock) {
            firstBlock = block;
        }
        if (previousBlock) {
            previousBlock.next = { block };
        }
        previousBlock = block;
    }
    return firstBlock;
}
function createDepartmentStubChainFromAggregate(aggregateBlock) {
    let currentBlock = getNestedBlock(asRecord(aggregateBlock?.inputs)?.DEPARTMENTS);
    let firstBlock = null;
    let previousBlock = null;
    while (currentBlock) {
        if (currentBlock.type === "department_block") {
            const departmentId = String(asRecord(currentBlock.fields)?.DEPARTMENT_ID ?? "").trim();
            if (departmentId) {
                const block = {
                    fields: {
                        DEPARTMENT_ID: departmentId,
                    },
                    type: "department_block",
                };
                if (!firstBlock) {
                    firstBlock = block;
                }
                if (previousBlock) {
                    previousBlock.next = { block };
                }
                previousBlock = block;
            }
        }
        currentBlock = getNestedBlock(currentBlock.next);
    }
    return firstBlock;
}
function findAggregateBlock(workspaceJson) {
    const blocks = asRecord(asRecord(workspaceJson)?.blocks)?.blocks;
    if (!Array.isArray(blocks)) {
        return null;
    }
    return (blocks
        .map((block) => asRecord(block))
        .find((block) => block?.type === "aggregate_plan_block") ?? null);
}
function createCompactConsolidationWorkspaceRecord(args) {
    if (!args.workspaceState) {
        return undefined;
    }
    const normalizedRecord = (0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(args.workspaceState);
    const workspaceJson = (0, blockly_serialization_1.normalizeBlocklyWorkspaceJson)(normalizedRecord.workspaceJson);
    const aggregateBlock = findAggregateBlock(workspaceJson);
    const aggregateFields = {
        ...(asRecord(aggregateBlock?.fields) ?? {}),
        FINANCIAL_YEAR: args.fiscalYear,
    };
    const departmentStubChain = createDepartmentStubChainFromAggregate(aggregateBlock) ??
        createDepartmentStubChain(args.selectedSourceDepartmentIds);
    const compactAggregateBlock = {
        fields: aggregateFields,
        type: "aggregate_plan_block",
        x: typeof aggregateBlock?.x === "number" ? aggregateBlock.x : 80,
        y: typeof aggregateBlock?.y === "number" ? aggregateBlock.y : 60,
    };
    if (departmentStubChain) {
        compactAggregateBlock.inputs = {
            DEPARTMENTS: {
                block: departmentStubChain,
            },
        };
    }
    return (0, blockly_serialization_1.createPersistedBlocklyWorkspaceRecord)((0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
        lastSavedAt: normalizedRecord.editorMetadata.lastSavedAt,
        lastSavedByUserId: normalizedRecord.editorMetadata.lastSavedByUserId,
        recoveredAt: normalizedRecord.editorMetadata.recoveredAt,
        revision: normalizedRecord.editorMetadata.revision,
        saveSource: normalizedRecord.editorMetadata.saveSource,
        workspaceJson: {
            blocks: {
                blocks: [compactAggregateBlock],
                languageVersion: 0,
            },
        },
    }));
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
function getSelectedSourceDepartmentIds(draftData) {
    const selectedSourceDepartmentIds = asRecord(draftData)?.selectedSourceDepartmentIds;
    return Array.isArray(selectedSourceDepartmentIds)
        ? selectedSourceDepartmentIds.map((departmentId) => String(departmentId))
        : [];
}
function getNotes(draftData) {
    const notes = asRecord(draftData)?.notes;
    return typeof notes === "string" ? notes : "";
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
            ...(args.metadata ?? {}),
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
        const consolidation = draft ??
            await loadConsolidationForFiscalYear(ctx, {
                fiscalYear: base.readiness.selectedFiscalYear,
                tenantId: authContext.tenantId,
            });
        const snapshot = consolidation?.status === "finalized"
            ? await loadSnapshotForConsolidation(ctx, {
                consolidationId: consolidation._id,
            })
            : null;
        const [finalizedByActor, snapshotCapturedByActor] = await Promise.all([
            readTenantUserActorSummary(ctx, consolidation?.finalizedByTenantUserId ?? null),
            readTenantUserActorSummary(ctx, snapshot?.capturedByTenantUserId ?? null),
        ]);
        return {
            actors: {
                finalizedBy: finalizedByActor,
                snapshotCapturedBy: snapshotCapturedByActor,
            },
            draft: mapDraft(consolidation),
            fiscalYears: base.fiscalYears,
            readiness: base.readiness,
            snapshot: mapSnapshot(snapshot),
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
        const persistedWorkspaceState = createCompactConsolidationWorkspaceRecord({
            fiscalYear: args.fiscalYear,
            selectedSourceDepartmentIds: args.selectedSourceDepartmentIds,
            workspaceState: args.workspaceState,
        });
        const validation = (0, consolidation_1.validateConsolidationDraftPayload)({
            notes: args.notes,
            selectedSourceDepartmentIds: args.selectedSourceDepartmentIds,
            workspaceState: persistedWorkspaceState,
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
        const existingConsolidation = existingDraft ?? await loadConsolidationForFiscalYear(ctx, {
            fiscalYear: base.readiness.selectedFiscalYear,
            tenantId: authContext.tenantId,
        });
        if (existingConsolidation?.status === "finalized") {
            throw new values_1.ConvexError({
                code: "ALREADY_FINALIZED",
                message: "Use Edit Draft before saving changes to a finalized consolidation.",
            });
        }
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
                workspaceState: persistedWorkspaceState,
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
            workspaceState: persistedWorkspaceState,
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
exports.finalizeProcurementOfficerConsolidation = (0, server_1.mutation)({
    args: {
        expectedRevision: values_1.v.number(),
        fiscalYear: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const tenantUser = await loadProcurementOfficerTenantUser(ctx, {
            tenantId: authContext.tenantId,
            userId: authContext.userId,
        });
        const base = await loadConsolidationBase(ctx, {
            requestedFiscalYear: args.fiscalYear,
            tenantId: authContext.tenantId,
        });
        const consolidation = await loadConsolidationForFiscalYear(ctx, {
            fiscalYear: base.readiness.selectedFiscalYear,
            tenantId: authContext.tenantId,
        });
        if (!consolidation) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Save a consolidation draft before finalizing it.",
            });
        }
        const existingSnapshot = await loadSnapshotForConsolidation(ctx, {
            consolidationId: consolidation._id,
        });
        if (consolidation.status === "finalized") {
            if (existingSnapshot) {
                return {
                    draft: mapDraft(consolidation),
                    readiness: base.readiness,
                    snapshot: mapSnapshot(existingSnapshot),
                };
            }
            throw new values_1.ConvexError({
                code: "ALREADY_FINALIZED",
                message: "This consolidation has already been finalized.",
            });
        }
        if (consolidation.revision !== args.expectedRevision) {
            throw new values_1.ConvexError({
                code: "REVISION_CONFLICT",
                currentRevision: consolidation.revision,
                message: "This consolidation draft changed in another tab or device. Refresh before finalizing.",
            });
        }
        const selectedSourceDepartmentIds = getSelectedSourceDepartmentIds(consolidation.draftData);
        if (selectedSourceDepartmentIds.length === 0) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: "Connect at least one approved source department before finalizing.",
            });
        }
        assertSelectedSourcesAreStillApproved({
            readyDepartmentIds: base.readiness.readyDepartmentIds,
            selectedSourceDepartmentIds,
        });
        const selectedSourcePlanIds = base.readiness.readyDepartments
            .filter((department) => selectedSourceDepartmentIds.includes(department.departmentId))
            .map((department) => department.planId);
        const snapshotValues = (0, consolidation_1.extractConsolidationFinalizationSnapshotValues)(consolidation.workspaceState);
        const now = Date.now();
        const snapshotId = await ctx.db.insert("consolidationSnapshots", {
            calculatedTotals: snapshotValues.calculatedTotals,
            capturedAt: now,
            capturedByTenantUserId: tenantUser._id,
            capturedByUserId: authContext.userId,
            complianceSummary: snapshotValues.complianceSummary,
            consolidationId: consolidation._id,
            draftData: consolidation.draftData,
            fiscalYear: base.readiness.selectedFiscalYear,
            notes: getNotes(consolidation.draftData),
            schemaVersion: consolidation_1.CONSOLIDATION_SNAPSHOT_SCHEMA_VERSION,
            selectedSourceDepartmentIds,
            sourcePlanIds: selectedSourcePlanIds,
            status: "finalized",
            tenantId: authContext.tenantId,
            workspaceState: consolidation.workspaceState,
        });
        await ctx.db.patch(consolidation._id, {
            finalizedAt: now,
            finalizedByTenantUserId: tenantUser._id,
            revision: consolidation.revision + 1,
            status: "finalized",
            updatedAt: now,
            updatedByTenantUserId: tenantUser._id,
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildConsolidationAuditEntry({
            action: "finalize",
            actorUserId: authContext.userId,
            consolidationId: consolidation._id,
            event: audit_1.AUDIT_EVENT_NAMES.consolidationFinalized,
            fiscalYear: base.readiness.selectedFiscalYear,
            metadata: {
                calculatedTotalsSnapshotPresent: true,
                complianceSnapshotPresent: true,
                sourcePlanIds: selectedSourcePlanIds,
                snapshotId: String(snapshotId),
                statusTransition: "draft:finalized",
            },
            selectedSourceDepartmentIds,
            tenantId: authContext.tenantId,
        }));
        const finalizedConsolidation = await ctx.db.get(consolidation._id);
        const snapshot = await ctx.db.get(snapshotId);
        return {
            draft: mapDraft(finalizedConsolidation),
            readiness: base.readiness,
            snapshot: mapSnapshot(snapshot),
        };
    },
});
exports.reopenProcurementOfficerConsolidationForEditing = (0, server_1.mutation)({
    args: {
        expectedRevision: values_1.v.number(),
        fiscalYear: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
        const tenantUser = await loadProcurementOfficerTenantUser(ctx, {
            tenantId: authContext.tenantId,
            userId: authContext.userId,
        });
        const base = await loadConsolidationBase(ctx, {
            requestedFiscalYear: args.fiscalYear,
            tenantId: authContext.tenantId,
        });
        const consolidation = await loadConsolidationForFiscalYear(ctx, {
            fiscalYear: base.readiness.selectedFiscalYear,
            tenantId: authContext.tenantId,
        });
        if (!consolidation) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "No consolidation was found for this fiscal year.",
            });
        }
        if (consolidation.status !== "finalized") {
            return {
                draft: mapDraft(consolidation),
                readiness: base.readiness,
                snapshot: null,
            };
        }
        if (consolidation.revision !== args.expectedRevision) {
            throw new values_1.ConvexError({
                code: "REVISION_CONFLICT",
                currentRevision: consolidation.revision,
                message: "This consolidation changed in another tab or device. Refresh before editing.",
            });
        }
        const selectedSourceDepartmentIds = getSelectedSourceDepartmentIds(consolidation.draftData);
        const now = Date.now();
        await ctx.db.patch(consolidation._id, {
            finalizedAt: undefined,
            finalizedByTenantUserId: undefined,
            revision: consolidation.revision + 1,
            status: "draft",
            updatedAt: now,
            updatedByTenantUserId: tenantUser._id,
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildConsolidationAuditEntry({
            action: "reopen",
            actorUserId: authContext.userId,
            consolidationId: consolidation._id,
            event: audit_1.AUDIT_EVENT_NAMES.consolidationReopened,
            fiscalYear: base.readiness.selectedFiscalYear,
            metadata: {
                previousFinalizedAt: consolidation.finalizedAt ?? null,
                statusTransition: "finalized:draft",
            },
            selectedSourceDepartmentIds,
            tenantId: authContext.tenantId,
        }));
        const reopenedConsolidation = await ctx.db.get(consolidation._id);
        return {
            draft: mapDraft(reopenedConsolidation),
            readiness: base.readiness,
            snapshot: null,
        };
    },
});
