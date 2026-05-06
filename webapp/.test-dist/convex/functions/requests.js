"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.undoCatalogRequestDenial = exports.bulkDenyCatalogRequests = exports.bulkApproveCatalogRequests = exports.bulkDenyCatalogRequestsInternal = exports.bulkApproveCatalogRequestsInternal = exports.denyCatalogRequest = exports.approveItemRequest = exports.approveCategoryRequest = exports.applyDenialUndo = exports.prepareDenialUndo = exports.markDecisionNotificationFailed = exports.markDecisionNotificationQueued = exports.denyCatalogRequestInternal = exports.approveItemRequestInternal = exports.approveCategoryRequestInternal = exports.getRequestorEmail = exports.getProcurementOfficerCatalogRequests = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const audit_1 = require("../../lib/shared/security/audit");
const catalog_requests_1 = require("../../lib/procurement/catalog-requests");
const categories_1 = require("../../lib/procurement-officer/categories");
const items_1 = require("../../lib/procurement-officer/items");
const requests_1 = require("../../lib/procurement-officer/requests");
const category_1 = require("../../lib/validators/category");
const item_1 = require("../../lib/validators/item");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const _tenantGuard_1 = require("./_tenantGuard");
const item_backend_1 = require("../../lib/procurement-officer/item-backend");
const requestStatusValidator = values_1.v.union(values_1.v.literal("pending"), values_1.v.literal("approved"), values_1.v.literal("denied"), values_1.v.literal("expired"), values_1.v.literal("cancelled"));
const requestTypeValidator = values_1.v.union(values_1.v.literal("item"), values_1.v.literal("category"));
const requestFiltersValidator = values_1.v.object({
    departmentId: values_1.v.optional(values_1.v.string()),
    endDate: values_1.v.optional(values_1.v.number()),
    requestType: values_1.v.optional(requestTypeValidator),
    startDate: values_1.v.optional(values_1.v.number()),
    status: values_1.v.optional(requestStatusValidator),
    view: values_1.v.optional(values_1.v.union(values_1.v.literal("history"), values_1.v.literal("inbox"))),
});
const decisionReasonValidator = values_1.v.string();
const DECISION_REASON_MIN_LENGTH = 3;
const DECISION_REASON_MAX_LENGTH = 280;
async function loadProcurementOfficerContext(ctx) {
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
    if (!tenantUser ||
        tenantUser.role !== "procurement_officer" ||
        !tenantUser.isActive) {
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
function buildDecisionReasonLabel(args) {
    return ((0, catalog_requests_1.formatCatalogRequestDecisionReason)({
        reason: args.reason ?? null,
        status: args.status,
    }) ?? null);
}
function resolveCatalogRequestStatus(args) {
    const shouldExpire = (0, catalog_requests_1.shouldExpireCatalogRequest)({
        status: args.request.status,
        submissionEndsAt: args.department.submissionEndsAt,
        submissionStartsAt: args.department.submissionStartsAt,
    });
    return shouldExpire ? "expired" : args.request.status;
}
function buildRequestRow(args) {
    const status = args.statusOverride ??
        resolveCatalogRequestStatus({
            department: args.department,
            request: args.request,
        });
    const decisionReason = buildDecisionReasonLabel({
        reason: args.request.decisionReason,
        status,
    });
    return {
        canApprove: status === "pending",
        canDeny: status === "pending",
        canUndo: (0, requests_1.isDenialUndoEligible)({
            decisionNotificationStatus: args.request.decisionNotificationStatus,
            denialUndoDeadlineAt: args.request.denialUndoDeadlineAt,
            status,
        }),
        categoryName: args.type === "item"
            ? args.request.categoryNameSnapshot
            : null,
        createdAt: args.request.createdAt,
        description: args.request.description,
        departmentId: String(args.request.departmentId),
        departmentName: args.department.name,
        decisionReason,
        decisionStatusLabel: (0, catalog_requests_1.buildCatalogRequestStatusMeta)(status).label,
        id: String(args.request._id),
        justification: args.request.justification,
        name: args.request.name,
        requestorId: String(args.request.requestorUserId),
        requestorLabel: args.requestorLabel,
        status,
        submittedAt: args.request.submittedAt,
        type: args.type,
        updatedAt: args.request.updatedAt,
        estimatedUnitPrice: args.type === "item"
            ? args.request.estimatedUnitPrice
            : null,
        categoryId: args.type === "item"
            ? (args.request.categoryId
                ? String(args.request.categoryId)
                : null)
            : null,
        linkedCategoryRequestId: args.type === "item"
            ? (args.request.linkedCategoryRequestId
                ? String(args.request.linkedCategoryRequestId)
                : null)
            : null,
    };
}
function createRequestCluster(rows, clusterId) {
    const statusCounts = {
        pending: 0,
        approved: 0,
        denied: 0,
        expired: 0,
        cancelled: 0,
    };
    const requestorIds = new Set();
    const departmentIds = new Set();
    for (const row of rows) {
        statusCounts[row.status] += 1;
        requestorIds.add(row.requestorId);
        departmentIds.add(row.departmentId);
    }
    return {
        id: clusterId,
        name: rows[0]?.name ?? "Request",
        requestType: rows[0]?.type ?? "item",
        requestCount: rows.length,
        requestorCount: requestorIds.size,
        departmentCount: departmentIds.size,
        statusCounts,
        requests: rows,
    };
}
exports.getProcurementOfficerCatalogRequests = (0, server_1.query)({
    args: requestFiltersValidator,
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext } = await loadProcurementOfficerContext(ctx);
        const resolvedView = args.view ?? "inbox";
        const resolvedStatus = args.status ?? (resolvedView === "inbox" ? "pending" : undefined);
        const departments = await ctx.db
            .query("departments")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
            .collect();
        const departmentMap = new Map(departments.map((department) => [String(department._id), department]));
        const [categoryRequests, itemRequests] = await Promise.all([
            ctx.db
                .query("categoryRequests")
                .withIndex("by_tenantId_createdAt", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("itemRequests")
                .withIndex("by_tenantId_createdAt", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
        ]);
        const filteredCategoryRequests = [];
        const filteredItemRequests = [];
        if (!args.requestType || args.requestType === "category") {
            for (const request of categoryRequests) {
                const department = departmentMap.get(String(request.departmentId));
                if (!department) {
                    continue;
                }
                const status = resolveCatalogRequestStatus({ department, request });
                if (resolvedStatus && status !== resolvedStatus) {
                    continue;
                }
                if (args.departmentId && String(request.departmentId) !== args.departmentId) {
                    continue;
                }
                if (typeof args.startDate === "number" && request.createdAt < args.startDate) {
                    continue;
                }
                if (typeof args.endDate === "number" && request.createdAt > args.endDate) {
                    continue;
                }
                filteredCategoryRequests.push({ department, request, status });
            }
        }
        if (!args.requestType || args.requestType === "item") {
            for (const request of itemRequests) {
                const department = departmentMap.get(String(request.departmentId));
                if (!department) {
                    continue;
                }
                const status = resolveCatalogRequestStatus({ department, request });
                if (resolvedStatus && status !== resolvedStatus) {
                    continue;
                }
                if (args.departmentId && String(request.departmentId) !== args.departmentId) {
                    continue;
                }
                if (typeof args.startDate === "number" && request.createdAt < args.startDate) {
                    continue;
                }
                if (typeof args.endDate === "number" && request.createdAt > args.endDate) {
                    continue;
                }
                filteredItemRequests.push({ department, request, status });
            }
        }
        const requestorIds = new Set();
        for (const entry of filteredCategoryRequests) {
            requestorIds.add(String(entry.request.requestorUserId));
        }
        for (const entry of filteredItemRequests) {
            requestorIds.add(String(entry.request.requestorUserId));
        }
        const requestorEntries = await Promise.all(Array.from(requestorIds).map(async (requestorId) => {
            const user = await ctx.db.get(requestorId);
            return [requestorId, user?.email ? user.email : requestorId];
        }));
        const requestorMap = new Map(requestorEntries);
        const rows = [];
        for (const entry of filteredCategoryRequests) {
            rows.push(buildRequestRow({
                department: entry.department,
                request: entry.request,
                requestorLabel: requestorMap.get(String(entry.request.requestorUserId)) ?? "Unknown",
                statusOverride: entry.status,
                type: "category",
            }));
        }
        for (const entry of filteredItemRequests) {
            rows.push(buildRequestRow({
                department: entry.department,
                request: entry.request,
                requestorLabel: requestorMap.get(String(entry.request.requestorUserId)) ?? "Unknown",
                statusOverride: entry.status,
                type: "item",
            }));
        }
        const categoryGroupingKeyById = new Map(filteredCategoryRequests.map((entry) => [
            String(entry.request._id),
            entry.request.sharedGroupingKey,
        ]));
        const itemGroupingKeyById = new Map(filteredItemRequests.map((entry) => [
            String(entry.request._id),
            entry.request.sharedGroupingKey,
        ]));
        const rowsByCluster = new Map();
        for (const row of rows) {
            const clusterId = row.type === "item"
                ? itemGroupingKeyById.get(row.id)
                : categoryGroupingKeyById.get(row.id);
            const resolvedClusterId = clusterId ?? row.id;
            const existing = rowsByCluster.get(resolvedClusterId) ?? [];
            existing.push(row);
            rowsByCluster.set(resolvedClusterId, existing);
        }
        const clusters = Array.from(rowsByCluster.entries()).map(([clusterId, groupRows]) => createRequestCluster(groupRows.sort((left, right) => right.updatedAt - left.updatedAt), clusterId));
        return {
            clusters: clusters.sort((left, right) => {
                const leftUpdated = left.requests[0]?.updatedAt ?? 0;
                const rightUpdated = right.requests[0]?.updatedAt ?? 0;
                return rightUpdated - leftUpdated;
            }),
            departments: departments.map((department) => ({
                id: String(department._id),
                name: department.name,
            })),
            summary: (0, catalog_requests_1.buildCatalogRequestSummary)({
                requests: rows.map((row) => ({ status: row.status, type: row.type })),
            }),
        };
    },
});
exports.getRequestorEmail = (0, server_1.query)({
    args: {
        userId: values_1.v.string(),
    },
    returns: values_1.v.union(values_1.v.string(), values_1.v.null()),
    handler: async (ctx, args) => {
        await loadProcurementOfficerContext(ctx);
        const user = await ctx.db.get(args.userId);
        return user?.email ?? null;
    },
});
exports.approveCategoryRequestInternal = (0, server_1.internalMutation)({
    args: {
        category: values_1.v.any(),
        requestId: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser, tenant } = await loadProcurementOfficerContext(ctx);
        const request = await ctx.db.get(args.requestId);
        if (!request || request.tenantId !== authContext.tenantId) {
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Request not found." });
        }
        if (request.status !== "pending") {
            throw new values_1.ConvexError({
                code: "ALREADY_PROCESSED",
                message: "Request already processed.",
            });
        }
        const department = await ctx.db.get(request.departmentId);
        if (!department) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Department not found.",
            });
        }
        if ((0, catalog_requests_1.shouldExpireCatalogRequest)({
            status: request.status,
            submissionEndsAt: department.submissionEndsAt,
            submissionStartsAt: department.submissionStartsAt,
        })) {
            await ctx.db.patch(request._id, {
                decisionReason: "Submission window ended before review.",
                decisionSource: "deadline",
                revision: request.revision + 1,
                status: "expired",
                updatedAt: Date.now(),
            });
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildRequestAuditEntry({
                action: "expire",
                event: audit_1.AUDIT_EVENT_NAMES.categoryRequestExpired,
                recordId: String(request._id),
                tableName: "categoryRequests",
                tenantId: String(authContext.tenantId),
                userId: String(request.requestorUserId),
            }));
            throw new values_1.ConvexError({
                code: "DEADLINE_PASSED",
                message: "Submission window ended before review.",
            });
        }
        const parsed = category_1.categoryFormSchema.safeParse(args.category);
        if (!parsed.success) {
            const issue = parsed.error.issues.at(0);
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: issue?.path[0] ?? "category",
                message: issue?.message ?? "Category data is invalid.",
            });
        }
        await assertCategoryUnique(ctx, {
            normalizedName: (0, categories_1.normalizeCategoryName)(parsed.data.name),
            tenantId: authContext.tenantId,
        });
        await assertCategoryTierCapacity(ctx, {
            tenantId: authContext.tenantId,
            tier: tenant.tier,
        });
        const existingCategories = await ctx.db
            .query("procurementCategories")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
            .collect();
        const nextSortOrder = Math.max(0, ...existingCategories.map((category) => category.sortOrder)) + 1;
        const now = Date.now();
        const categoryId = await ctx.db.insert("procurementCategories", {
            archivedAt: undefined,
            archivedByTenantUserId: undefined,
            color: parsed.data.color,
            createdAt: now,
            description: parsed.data.description,
            icon: parsed.data.icon,
            isActive: true,
            name: parsed.data.name,
            normalizedName: (0, categories_1.normalizeCategoryName)(parsed.data.name),
            revision: 1,
            sortOrder: nextSortOrder,
            tenantId: authContext.tenantId,
            updatedAt: now,
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildRequestAuditEntry({
            action: "approve",
            event: audit_1.AUDIT_EVENT_NAMES.categoryRequestApproved,
            recordId: String(request._id),
            tableName: "categoryRequests",
            tenantId: String(authContext.tenantId),
            userId: String(authContext.userId),
        }));
        await ctx.db.patch(request._id, {
            decisionReason: undefined,
            decisionSnapshot: {
                approvedCategoryId: String(categoryId),
                description: parsed.data.description ?? null,
                name: parsed.data.name,
            },
            decisionSource: "po",
            linkedCatalogCategoryId: categoryId,
            reviewedAt: now,
            reviewedByTenantUserId: tenantUser._id,
            revision: request.revision + 1,
            status: "approved",
            updatedAt: now,
        });
        return {
            requestId: String(request._id),
            requestType: "category",
            requestSummary: parsed.data.name,
            tenantName: tenant.name,
            tenantId: String(authContext.tenantId),
            userId: String(request.requestorUserId),
        };
    },
});
exports.approveItemRequestInternal = (0, server_1.internalMutation)({
    args: {
        item: values_1.v.any(),
        requestId: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser, tenant } = await loadProcurementOfficerContext(ctx);
        const request = await ctx.db.get(args.requestId);
        if (!request || request.tenantId !== authContext.tenantId) {
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Request not found." });
        }
        if (request.status !== "pending") {
            throw new values_1.ConvexError({
                code: "ALREADY_PROCESSED",
                message: "Request already processed.",
            });
        }
        const department = await ctx.db.get(request.departmentId);
        if (!department) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Department not found.",
            });
        }
        if ((0, catalog_requests_1.shouldExpireCatalogRequest)({
            status: request.status,
            submissionEndsAt: department.submissionEndsAt,
            submissionStartsAt: department.submissionStartsAt,
        })) {
            await ctx.db.patch(request._id, {
                decisionReason: "Submission window ended before review.",
                decisionSource: "deadline",
                revision: request.revision + 1,
                status: "expired",
                updatedAt: Date.now(),
            });
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildRequestAuditEntry({
                action: "expire",
                event: audit_1.AUDIT_EVENT_NAMES.itemRequestExpired,
                recordId: String(request._id),
                tableName: "itemRequests",
                tenantId: String(authContext.tenantId),
                userId: String(request.requestorUserId),
            }));
            throw new values_1.ConvexError({
                code: "DEADLINE_PASSED",
                message: "Submission window ended before review.",
            });
        }
        const parsed = item_1.itemFormSchema.safeParse(args.item);
        if (!parsed.success) {
            const issue = parsed.error.issues.at(0);
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: issue?.path[0] ?? "item",
                message: issue?.message ?? "Item data is invalid.",
            });
        }
        const category = await ctx.db.get(parsed.data.categoryId);
        if (!category || category.tenantId !== authContext.tenantId) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Category not found.",
            });
        }
        (0, item_backend_1.assertProcurementItemAssignmentAllowed)({
            categoryIsActive: category.isActive,
            nextCategoryId: String(category._id),
        });
        await (0, item_backend_1.assertProcurementItemTierCapacity)(ctx, {
            categoryId: String(category._id),
            tenantId: String(authContext.tenantId),
            tier: tenant.tier,
        });
        await (0, item_backend_1.assertProcurementItemUnique)(ctx, {
            categoryId: String(category._id),
            normalizedName: (0, items_1.normalizeProcurementItemName)(parsed.data.name),
            tenantId: String(authContext.tenantId),
        });
        const nextSortOrder = await (0, item_backend_1.resolveNextProcurementItemSortOrder)({
            categoryId: String(category._id),
            ctx,
            tenantId: String(authContext.tenantId),
        });
        const now = Date.now();
        const itemDescription = parsed.data.description ?? parsed.data.name;
        const itemId = await ctx.db.insert("procurementItems", {
            archivedAt: undefined,
            archivedByTenantUserId: undefined,
            catalogSearchText: (0, items_1.buildProcurementItemCatalogSearchText)({
                categoryName: category.name,
                description: itemDescription,
                name: parsed.data.name,
            }),
            categoryId: category._id,
            categoryNameSnapshot: category.name,
            complianceFlags: parsed.data.complianceFlags,
            createdAt: now,
            description: itemDescription,
            isActive: true,
            lastPriceChangedAt: now,
            lastPriceChangedByTenantUserId: tenantUser._id,
            maxQuantity: parsed.data.maxQuantity,
            minQuantity: parsed.data.minQuantity,
            name: parsed.data.name,
            normalizedName: (0, items_1.normalizeProcurementItemName)(parsed.data.name),
            procurementMethod: parsed.data.procurementMethod,
            revision: 1,
            sortOrder: nextSortOrder,
            sourceOfFunds: parsed.data.sourceOfFunds,
            tenantId: authContext.tenantId,
            unitOfMeasurement: parsed.data.unit,
            unitPrice: parsed.data.unitPrice,
            updatedAt: now,
        });
        await ctx.db.insert("procurementItemPriceHistory", {
            ...(0, items_1.createProcurementItemPriceHistoryEntry)({
                changedAt: now,
                itemId: String(itemId),
                nextUnitPrice: parsed.data.unitPrice,
                previousUnitPrice: null,
            }),
            changedByTenantUserId: tenantUser._id,
            itemId,
            tenantId: authContext.tenantId,
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildRequestAuditEntry({
            action: "approve",
            event: audit_1.AUDIT_EVENT_NAMES.itemRequestApproved,
            recordId: String(request._id),
            tableName: "itemRequests",
            tenantId: String(authContext.tenantId),
            userId: String(authContext.userId),
        }));
        await ctx.db.patch(request._id, {
            decisionReason: undefined,
            decisionSnapshot: {
                approvedItemId: String(itemId),
                description: itemDescription,
                name: parsed.data.name,
                unitPrice: parsed.data.unitPrice,
                categoryId: String(category._id),
            },
            decisionSource: "po",
            linkedCatalogItemId: itemId,
            reviewedAt: now,
            reviewedByTenantUserId: tenantUser._id,
            revision: request.revision + 1,
            status: "approved",
            updatedAt: now,
        });
        return {
            requestId: String(request._id),
            requestType: "item",
            requestSummary: `${parsed.data.name} in ${category.name}`,
            tenantName: tenant.name,
            tenantId: String(authContext.tenantId),
            userId: String(request.requestorUserId),
        };
    },
});
exports.denyCatalogRequestInternal = (0, server_1.internalMutation)({
    args: {
        reason: decisionReasonValidator,
        requestId: values_1.v.string(),
        requestType: requestTypeValidator,
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser, tenant } = await loadProcurementOfficerContext(ctx);
        const request = args.requestType === "item"
            ? await ctx.db.get(args.requestId)
            : await ctx.db.get(args.requestId);
        if (!request || request.tenantId !== authContext.tenantId) {
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Request not found." });
        }
        if (request.status !== "pending") {
            throw new values_1.ConvexError({
                code: "ALREADY_PROCESSED",
                message: "Request already processed.",
            });
        }
        const now = Date.now();
        const reason = args.reason.trim();
        if (reason.length < DECISION_REASON_MIN_LENGTH ||
            reason.length > DECISION_REASON_MAX_LENGTH) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "reason",
                message: "Denial reason must be between 3 and 280 characters.",
            });
        }
        const undoDeadlineAt = (0, requests_1.resolveProcurementRequestDenialUndoDeadline)({ now });
        await ctx.db.patch(request._id, {
            decisionReason: reason,
            decisionSource: "po",
            denialUndoDeadlineAt: undoDeadlineAt,
            reviewedAt: now,
            reviewedByTenantUserId: tenantUser._id,
            revision: request.revision + 1,
            status: "denied",
            updatedAt: now,
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildRequestAuditEntry({
            action: "deny",
            event: args.requestType === "item"
                ? audit_1.AUDIT_EVENT_NAMES.itemRequestDenied
                : audit_1.AUDIT_EVENT_NAMES.categoryRequestDenied,
            recordId: String(request._id),
            tableName: args.requestType === "item" ? "itemRequests" : "categoryRequests",
            tenantId: String(authContext.tenantId),
            userId: String(authContext.userId),
        }));
        return {
            requestId: String(request._id),
            requestType: args.requestType,
            requestSummary: args.requestType === "item"
                ? `${request.name} (${request.categoryNameSnapshot})`
                : request.name,
            tenantName: tenant.name,
            tenantId: String(authContext.tenantId),
            userId: String(request.requestorUserId),
            deliverAt: undoDeadlineAt,
        };
    },
});
exports.markDecisionNotificationQueued = (0, server_1.internalMutation)({
    args: {
        deliverAt: values_1.v.optional(values_1.v.number()),
        idempotencyKey: values_1.v.string(),
        requestId: values_1.v.string(),
        requestType: requestTypeValidator,
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const now = Date.now();
        if (args.requestType === "item") {
            const request = await ctx.db.get(args.requestId);
            if (!request)
                return null;
            await ctx.db.patch(request._id, {
                decisionNotificationIdempotencyKey: args.idempotencyKey,
                decisionNotificationDeliverAt: args.deliverAt,
                decisionNotificationQueuedAt: now,
                decisionNotificationStatus: "queued",
                updatedAt: now,
            });
            return null;
        }
        const request = await ctx.db.get(args.requestId);
        if (!request)
            return null;
        await ctx.db.patch(request._id, {
            decisionNotificationIdempotencyKey: args.idempotencyKey,
            decisionNotificationDeliverAt: args.deliverAt,
            decisionNotificationQueuedAt: now,
            decisionNotificationStatus: "queued",
            updatedAt: now,
        });
        return null;
    },
});
exports.markDecisionNotificationFailed = (0, server_1.internalMutation)({
    args: {
        errorCode: values_1.v.string(),
        errorMessage: values_1.v.string(),
        idempotencyKey: values_1.v.string(),
        requestId: values_1.v.string(),
        requestType: requestTypeValidator,
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const now = Date.now();
        if (args.requestType === "item") {
            const request = await ctx.db.get(args.requestId);
            if (!request)
                return null;
            await ctx.db.patch(request._id, {
                decisionNotificationErrorCode: args.errorCode,
                decisionNotificationErrorMessage: args.errorMessage,
                decisionNotificationIdempotencyKey: args.idempotencyKey,
                decisionNotificationStatus: "failed",
                updatedAt: now,
            });
            return null;
        }
        const request = await ctx.db.get(args.requestId);
        if (!request)
            return null;
        await ctx.db.patch(request._id, {
            decisionNotificationErrorCode: args.errorCode,
            decisionNotificationErrorMessage: args.errorMessage,
            decisionNotificationIdempotencyKey: args.idempotencyKey,
            decisionNotificationStatus: "failed",
            updatedAt: now,
        });
        return null;
    },
});
exports.prepareDenialUndo = (0, server_1.internalMutation)({
    args: {
        requestId: values_1.v.string(),
        requestType: requestTypeValidator,
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext } = await loadProcurementOfficerContext(ctx);
        const request = args.requestType === "item"
            ? await ctx.db.get(args.requestId)
            : await ctx.db.get(args.requestId);
        if (!request || request.tenantId !== authContext.tenantId) {
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Request not found." });
        }
        if (request.status !== "denied") {
            throw new values_1.ConvexError({
                code: "ALREADY_PROCESSED",
                message: "Only denied requests can be undone.",
            });
        }
        if (typeof request.denialUndoDeadlineAt !== "number" ||
            Date.now() > request.denialUndoDeadlineAt) {
            throw new values_1.ConvexError({
                code: "UNDO_WINDOW_CLOSED",
                message: "Undo window has closed.",
            });
        }
        return {
            idempotencyKey: request.decisionNotificationIdempotencyKey ?? null,
            requestId: String(request._id),
            requestType: args.requestType,
            notificationStatus: request.decisionNotificationStatus ?? null,
        };
    },
});
exports.applyDenialUndo = (0, server_1.internalMutation)({
    args: {
        requestId: values_1.v.string(),
        requestType: requestTypeValidator,
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const { authContext } = await loadProcurementOfficerContext(ctx);
        const request = args.requestType === "item"
            ? await ctx.db.get(args.requestId)
            : await ctx.db.get(args.requestId);
        if (!request || request.tenantId !== authContext.tenantId) {
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Request not found." });
        }
        await ctx.db.patch(request._id, {
            decisionReason: undefined,
            decisionNotificationErrorCode: undefined,
            decisionNotificationErrorMessage: undefined,
            decisionNotificationIdempotencyKey: undefined,
            decisionSource: undefined,
            decisionSnapshot: undefined,
            decisionNotificationStatus: "cancelled",
            denialUndoDeadlineAt: undefined,
            reviewedAt: undefined,
            reviewedByTenantUserId: undefined,
            revision: request.revision + 1,
            status: "pending",
            updatedAt: Date.now(),
        });
        await (0, _audit_1.appendAuditLogRequired)(ctx, buildRequestAuditEntry({
            action: "undo",
            event: args.requestType === "item"
                ? audit_1.AUDIT_EVENT_NAMES.itemRequestDenialUndone
                : audit_1.AUDIT_EVENT_NAMES.categoryRequestDenialUndone,
            recordId: String(request._id),
            tableName: args.requestType === "item" ? "itemRequests" : "categoryRequests",
            tenantId: String(authContext.tenantId),
            userId: String(authContext.userId),
        }));
        return null;
    },
});
exports.approveCategoryRequest = (0, server_1.action)({
    args: {
        category: values_1.v.any(),
        requestId: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const result = await ctx.runMutation("functions/requests:approveCategoryRequestInternal", args);
        const notification = await buildDecisionNotification({
            ctx,
            requestId: result.requestId,
            requestSummary: result.requestSummary,
            requestType: result.requestType,
            tenantId: result.tenantId,
            tenantName: result.tenantName,
            userId: result.userId,
            status: "approved",
        });
        if (notification) {
            await queueDecisionNotification(ctx, notification);
        }
        return result;
    },
});
exports.approveItemRequest = (0, server_1.action)({
    args: {
        item: values_1.v.any(),
        requestId: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const result = await ctx.runMutation("functions/requests:approveItemRequestInternal", args);
        const notification = await buildDecisionNotification({
            ctx,
            requestId: result.requestId,
            requestSummary: result.requestSummary,
            requestType: result.requestType,
            tenantId: result.tenantId,
            tenantName: result.tenantName,
            userId: result.userId,
            status: "approved",
        });
        if (notification) {
            await queueDecisionNotification(ctx, notification);
        }
        return result;
    },
});
exports.denyCatalogRequest = (0, server_1.action)({
    args: {
        reason: decisionReasonValidator,
        requestId: values_1.v.string(),
        requestType: requestTypeValidator,
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const result = await ctx.runMutation("functions/requests:denyCatalogRequestInternal", args);
        const notification = await buildDecisionNotification({
            ctx,
            deliverAt: result.deliverAt,
            requestId: result.requestId,
            requestSummary: result.requestSummary,
            requestType: result.requestType,
            tenantId: result.tenantId,
            tenantName: result.tenantName,
            userId: result.userId,
            status: "denied",
            reason: args.reason,
        });
        if (notification) {
            await queueDecisionNotification(ctx, notification);
        }
        return result;
    },
});
exports.bulkApproveCatalogRequestsInternal = (0, server_1.internalMutation)({
    args: {
        requestIds: values_1.v.array(values_1.v.string()),
        requestType: requestTypeValidator,
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser, tenant } = await loadProcurementOfficerContext(ctx);
        const processed = [];
        const skipped = [];
        for (const requestId of args.requestIds) {
            const request = args.requestType === "item"
                ? await ctx.db.get(requestId)
                : await ctx.db.get(requestId);
            if (!request || request.tenantId !== authContext.tenantId) {
                skipped.push({ requestId, reason: "Request not found." });
                continue;
            }
            if (request.status !== "pending") {
                skipped.push({ requestId, reason: "Request already processed." });
                continue;
            }
            const department = await ctx.db.get(request.departmentId);
            if (!department) {
                skipped.push({ requestId, reason: "Department not found." });
                continue;
            }
            if ((0, catalog_requests_1.shouldExpireCatalogRequest)({
                status: request.status,
                submissionEndsAt: department.submissionEndsAt,
                submissionStartsAt: department.submissionStartsAt,
            })) {
                await ctx.db.patch(request._id, {
                    decisionReason: "Submission window ended before review.",
                    decisionSource: "deadline",
                    revision: request.revision + 1,
                    status: "expired",
                    updatedAt: Date.now(),
                });
                await (0, _audit_1.appendAuditLogRequired)(ctx, buildRequestAuditEntry({
                    action: "expire",
                    event: args.requestType === "item"
                        ? audit_1.AUDIT_EVENT_NAMES.itemRequestExpired
                        : audit_1.AUDIT_EVENT_NAMES.categoryRequestExpired,
                    recordId: String(request._id),
                    tableName: args.requestType === "item" ? "itemRequests" : "categoryRequests",
                    tenantId: String(authContext.tenantId),
                    userId: String(request.requestorUserId),
                }));
                skipped.push({ requestId, reason: "Request expired before review." });
                continue;
            }
            if (args.requestType === "category") {
                const categoryInput = {
                    name: request.name,
                    description: request.description,
                };
                const parsed = category_1.categoryFormSchema.safeParse(categoryInput);
                if (!parsed.success) {
                    skipped.push({ requestId, reason: "Category data invalid." });
                    continue;
                }
                try {
                    await assertCategoryUnique(ctx, {
                        normalizedName: (0, categories_1.normalizeCategoryName)(parsed.data.name),
                        tenantId: authContext.tenantId,
                    });
                    await assertCategoryTierCapacity(ctx, {
                        tenantId: authContext.tenantId,
                        tier: tenant.tier,
                    });
                }
                catch (error) {
                    skipped.push({
                        requestId,
                        reason: error instanceof Error ? error.message : "Category validation failed.",
                    });
                    continue;
                }
                const existingCategories = await ctx.db
                    .query("procurementCategories")
                    .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                    .collect();
                const nextSortOrder = Math.max(0, ...existingCategories.map((category) => category.sortOrder)) + 1;
                const now = Date.now();
                const categoryId = await ctx.db.insert("procurementCategories", {
                    archivedAt: undefined,
                    archivedByTenantUserId: undefined,
                    color: undefined,
                    createdAt: now,
                    description: parsed.data.description,
                    icon: undefined,
                    isActive: true,
                    name: parsed.data.name,
                    normalizedName: (0, categories_1.normalizeCategoryName)(parsed.data.name),
                    revision: 1,
                    sortOrder: nextSortOrder,
                    tenantId: authContext.tenantId,
                    updatedAt: now,
                });
                await (0, _audit_1.appendAuditLogRequired)(ctx, buildRequestAuditEntry({
                    action: "approve",
                    event: audit_1.AUDIT_EVENT_NAMES.categoryRequestBulkApproved,
                    recordId: String(request._id),
                    tableName: "categoryRequests",
                    tenantId: String(authContext.tenantId),
                    userId: String(authContext.userId),
                }));
                await ctx.db.patch(request._id, {
                    decisionReason: undefined,
                    decisionSnapshot: {
                        approvedCategoryId: String(categoryId),
                        description: parsed.data.description ?? null,
                        name: parsed.data.name,
                    },
                    decisionSource: "po",
                    linkedCatalogCategoryId: categoryId,
                    reviewedAt: now,
                    reviewedByTenantUserId: tenantUser._id,
                    revision: request.revision + 1,
                    status: "approved",
                    updatedAt: now,
                });
                processed.push({
                    requestId: String(request._id),
                    requestSummary: parsed.data.name,
                    requestType: "category",
                    tenantId: String(authContext.tenantId),
                    tenantName: tenant.name,
                    userId: String(request.requestorUserId),
                });
                continue;
            }
            const itemRequest = request;
            let categoryId = itemRequest.categoryId ? String(itemRequest.categoryId) : null;
            if (!categoryId && itemRequest.linkedCategoryRequestId) {
                const linkedCategoryRequest = await ctx.db.get(itemRequest.linkedCategoryRequestId);
                if (linkedCategoryRequest?.linkedCatalogCategoryId) {
                    categoryId = String(linkedCategoryRequest.linkedCatalogCategoryId);
                }
                else {
                    skipped.push({
                        requestId,
                        reason: "Linked category request not approved yet.",
                    });
                    continue;
                }
            }
            if (!categoryId) {
                skipped.push({ requestId, reason: "Request missing category." });
                continue;
            }
            const itemInput = {
                categoryId,
                complianceFlags: [],
                customUnit: undefined,
                description: itemRequest.description,
                maxQuantity: undefined,
                minQuantity: undefined,
                name: itemRequest.name,
                procurementMethod: "RFQ",
                sourceOfFunds: "GOK",
                unit: "each",
                unitPrice: itemRequest.estimatedUnitPrice,
            };
            const parsed = item_1.itemFormSchema.safeParse(itemInput);
            if (!parsed.success) {
                skipped.push({ requestId, reason: "Item data invalid." });
                continue;
            }
            const category = await ctx.db.get(parsed.data.categoryId);
            if (!category || category.tenantId !== authContext.tenantId) {
                skipped.push({ requestId, reason: "Category not found." });
                continue;
            }
            try {
                (0, item_backend_1.assertProcurementItemAssignmentAllowed)({
                    categoryIsActive: category.isActive,
                    nextCategoryId: String(category._id),
                });
                await (0, item_backend_1.assertProcurementItemTierCapacity)(ctx, {
                    categoryId: String(category._id),
                    tenantId: String(authContext.tenantId),
                    tier: tenant.tier,
                });
                await (0, item_backend_1.assertProcurementItemUnique)(ctx, {
                    categoryId: String(category._id),
                    normalizedName: (0, items_1.normalizeProcurementItemName)(parsed.data.name),
                    tenantId: String(authContext.tenantId),
                });
            }
            catch (error) {
                skipped.push({
                    requestId,
                    reason: error instanceof Error ? error.message : "Item validation failed.",
                });
                continue;
            }
            const nextSortOrder = await (0, item_backend_1.resolveNextProcurementItemSortOrder)({
                categoryId: String(category._id),
                ctx,
                tenantId: String(authContext.tenantId),
            });
            const now = Date.now();
            const itemDescription = parsed.data.description ?? parsed.data.name;
            const itemId = await ctx.db.insert("procurementItems", {
                archivedAt: undefined,
                archivedByTenantUserId: undefined,
                catalogSearchText: (0, items_1.buildProcurementItemCatalogSearchText)({
                    categoryName: category.name,
                    description: itemDescription,
                    name: parsed.data.name,
                }),
                categoryId: category._id,
                categoryNameSnapshot: category.name,
                complianceFlags: parsed.data.complianceFlags,
                createdAt: now,
                description: itemDescription,
                isActive: true,
                lastPriceChangedAt: now,
                lastPriceChangedByTenantUserId: tenantUser._id,
                maxQuantity: parsed.data.maxQuantity,
                minQuantity: parsed.data.minQuantity,
                name: parsed.data.name,
                normalizedName: (0, items_1.normalizeProcurementItemName)(parsed.data.name),
                procurementMethod: parsed.data.procurementMethod,
                revision: 1,
                sortOrder: nextSortOrder,
                sourceOfFunds: parsed.data.sourceOfFunds,
                tenantId: authContext.tenantId,
                unitOfMeasurement: parsed.data.unit,
                unitPrice: parsed.data.unitPrice,
                updatedAt: now,
            });
            await ctx.db.insert("procurementItemPriceHistory", {
                ...(0, items_1.createProcurementItemPriceHistoryEntry)({
                    changedAt: now,
                    itemId: String(itemId),
                    nextUnitPrice: parsed.data.unitPrice,
                    previousUnitPrice: null,
                }),
                changedByTenantUserId: tenantUser._id,
                itemId,
                tenantId: authContext.tenantId,
            });
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildRequestAuditEntry({
                action: "approve",
                event: audit_1.AUDIT_EVENT_NAMES.itemRequestBulkApproved,
                recordId: String(request._id),
                tableName: "itemRequests",
                tenantId: String(authContext.tenantId),
                userId: String(authContext.userId),
            }));
            await ctx.db.patch(request._id, {
                decisionReason: undefined,
                decisionSnapshot: {
                    approvedItemId: String(itemId),
                    description: itemDescription,
                    name: parsed.data.name,
                    unitPrice: parsed.data.unitPrice,
                    categoryId: String(category._id),
                },
                decisionSource: "po",
                linkedCatalogItemId: itemId,
                reviewedAt: now,
                reviewedByTenantUserId: tenantUser._id,
                revision: request.revision + 1,
                status: "approved",
                updatedAt: now,
            });
            processed.push({
                requestId: String(request._id),
                requestSummary: `${parsed.data.name} in ${category.name}`,
                requestType: "item",
                tenantId: String(authContext.tenantId),
                tenantName: tenant.name,
                userId: String(request.requestorUserId),
            });
        }
        return {
            processed,
            skipped,
        };
    },
});
exports.bulkDenyCatalogRequestsInternal = (0, server_1.internalMutation)({
    args: {
        reason: decisionReasonValidator,
        requestIds: values_1.v.array(values_1.v.string()),
        requestType: requestTypeValidator,
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser, tenant } = await loadProcurementOfficerContext(ctx);
        const processed = [];
        const skipped = [];
        const now = Date.now();
        const reason = args.reason.trim();
        if (reason.length < DECISION_REASON_MIN_LENGTH ||
            reason.length > DECISION_REASON_MAX_LENGTH) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "reason",
                message: "Denial reason must be between 3 and 280 characters.",
            });
        }
        const undoDeadlineAt = (0, requests_1.resolveProcurementRequestDenialUndoDeadline)({ now });
        for (const requestId of args.requestIds) {
            const request = args.requestType === "item"
                ? await ctx.db.get(requestId)
                : await ctx.db.get(requestId);
            if (!request || request.tenantId !== authContext.tenantId) {
                skipped.push({ requestId, reason: "Request not found." });
                continue;
            }
            if (request.status !== "pending") {
                skipped.push({ requestId, reason: "Request already processed." });
                continue;
            }
            await ctx.db.patch(request._id, {
                decisionReason: reason,
                decisionSource: "po",
                denialUndoDeadlineAt: undoDeadlineAt,
                reviewedAt: now,
                reviewedByTenantUserId: tenantUser._id,
                revision: request.revision + 1,
                status: "denied",
                updatedAt: now,
            });
            await (0, _audit_1.appendAuditLogRequired)(ctx, buildRequestAuditEntry({
                action: "deny",
                event: args.requestType === "item"
                    ? audit_1.AUDIT_EVENT_NAMES.itemRequestBulkDenied
                    : audit_1.AUDIT_EVENT_NAMES.categoryRequestBulkDenied,
                recordId: String(request._id),
                tableName: args.requestType === "item" ? "itemRequests" : "categoryRequests",
                tenantId: String(authContext.tenantId),
                userId: String(authContext.userId),
            }));
            processed.push({
                requestId: String(request._id),
                requestSummary: args.requestType === "item"
                    ? `${request.name} (${request.categoryNameSnapshot})`
                    : request.name,
                requestType: args.requestType,
                tenantId: String(authContext.tenantId),
                tenantName: tenant.name,
                userId: String(request.requestorUserId),
                deliverAt: undoDeadlineAt,
            });
        }
        return {
            processed,
            skipped,
        };
    },
});
exports.bulkApproveCatalogRequests = (0, server_1.action)({
    args: {
        requestIds: values_1.v.array(values_1.v.string()),
        requestType: requestTypeValidator,
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const result = await ctx.runMutation("functions/requests:bulkApproveCatalogRequestsInternal", args);
        for (const entry of result.processed) {
            const notification = await buildDecisionNotification({
                ctx,
                requestId: entry.requestId,
                requestSummary: entry.requestSummary,
                requestType: entry.requestType,
                tenantId: entry.tenantId,
                tenantName: entry.tenantName,
                userId: entry.userId,
                status: "approved",
            });
            if (notification) {
                await queueDecisionNotification(ctx, notification);
            }
        }
        return result;
    },
});
exports.bulkDenyCatalogRequests = (0, server_1.action)({
    args: {
        reason: decisionReasonValidator,
        requestIds: values_1.v.array(values_1.v.string()),
        requestType: requestTypeValidator,
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const result = await ctx.runMutation("functions/requests:bulkDenyCatalogRequestsInternal", args);
        for (const entry of result.processed) {
            const notification = await buildDecisionNotification({
                ctx,
                deliverAt: entry.deliverAt,
                requestId: entry.requestId,
                requestSummary: entry.requestSummary,
                requestType: entry.requestType,
                tenantId: entry.tenantId,
                tenantName: entry.tenantName,
                userId: entry.userId,
                status: "denied",
                reason: args.reason,
            });
            if (notification) {
                await queueDecisionNotification(ctx, notification);
            }
        }
        return result;
    },
});
exports.undoCatalogRequestDenial = (0, server_1.action)({
    args: {
        requestId: values_1.v.string(),
        requestType: requestTypeValidator,
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const prep = await ctx.runMutation("functions/requests:prepareDenialUndo", args);
        if (!prep.idempotencyKey || prep.notificationStatus === "failed") {
            await ctx.runMutation("functions/requests:applyDenialUndo", args);
            return null;
        }
        const cancelled = await ctx.runAction("actions/email:cancelTransactionalEmail", {
            idempotencyKey: prep.idempotencyKey,
        });
        if (!cancelled?.cancelled) {
            throw new values_1.ConvexError({
                code: "UNDO_WINDOW_CLOSED",
                message: "Undo is unavailable once the notification is delivered.",
            });
        }
        await ctx.runMutation("functions/requests:applyDenialUndo", args);
        return null;
    },
});
async function buildDecisionNotification(args) {
    const emailValue = await args.ctx.runQuery("functions/requests:getRequestorEmail", {
        userId: args.userId,
    });
    const email = emailValue?.trim?.()?.toLowerCase?.() ?? "";
    if (!email) {
        return null;
    }
    return {
        deliverAt: args.deliverAt ?? undefined,
        idempotencyKey: `catalog-request-status:${args.tenantId}:${args.requestType}:${args.requestId}:${args.status}:${email}`,
        reason: args.reason ?? undefined,
        requestId: args.requestId,
        requestSummary: args.requestSummary,
        requestType: args.requestType,
        status: args.status,
        tenantName: args.tenantName,
        to: email,
    };
}
async function queueDecisionNotification(ctx, notification) {
    try {
        await ctx.runAction("actions/email:queueTransactionalEmail", {
            deliverAt: notification.deliverAt,
            idempotencyKey: notification.idempotencyKey,
            subject: `${notification.tenantName} catalog request ${notification.status}`,
            template: "catalog-request-status",
            templateProps: {
                reason: notification.reason ?? null,
                requestId: notification.requestId,
                requestSummary: notification.requestSummary,
                status: notification.status,
                tenantName: notification.tenantName,
            },
            to: notification.to,
        });
    }
    catch (error) {
        await ctx.runMutation("functions/requests:markDecisionNotificationFailed", {
            errorCode: "EMAIL_FAILED",
            errorMessage: error instanceof Error ? error.message : "Email queue failed.",
            idempotencyKey: notification.idempotencyKey,
            requestId: notification.requestId,
            requestType: notification.requestType,
        });
        throw error;
    }
    await ctx.runMutation("functions/requests:markDecisionNotificationQueued", {
        deliverAt: notification.deliverAt,
        idempotencyKey: notification.idempotencyKey,
        requestId: notification.requestId,
        requestType: notification.requestType,
    });
}
function buildRequestAuditEntry(args) {
    return {
        action: args.action,
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "procurement_officer",
            userId: args.userId,
        }),
        entityType: "catalog_request",
        event: args.event,
        metadata: {},
        outcome: audit_1.AUDIT_OUTCOMES.allowed,
        recordId: args.recordId,
        sourceTenantId: args.tenantId,
        tableName: args.tableName,
        targetTenantId: args.tenantId,
        timestamp: Date.now(),
    };
}
async function assertCategoryUnique(ctx, args) {
    const categories = await ctx.db
        .query("procurementCategories")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .collect();
    const conflict = categories.some((category) => {
        if (!category.isActive) {
            return false;
        }
        return ((category.normalizedName ?? (0, categories_1.normalizeCategoryName)(category.name)) ===
            args.normalizedName);
    });
    if (conflict) {
        throw new values_1.ConvexError({
            code: "ALREADY_EXISTS",
            message: "This category already exists.",
        });
    }
}
async function assertCategoryTierCapacity(ctx, args) {
    const activeCategoryCount = (await ctx.db
        .query("procurementCategories")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .collect()).filter((category) => category.isActive).length;
    const limits = {
        free: 20,
        professional: 200,
        starter: 60,
    };
    const limit = args.tier === "enterprise" ? null : limits[args.tier];
    if (limit !== null && activeCategoryCount >= limit) {
        throw new values_1.ConvexError({
            code: "QUOTA_EXCEEDED",
            limit,
            message: "Category limit reached for this plan tier.",
            tier: args.tier,
            upgradeHref: "/pricing",
        });
    }
}
