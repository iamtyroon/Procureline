"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProcurementRequestDecisionErrorMessage = exports.buildBulkDecisionCompatibility = exports.isDenialUndoEligible = exports.resolveProcurementRequestDenialUndoDeadline = exports.resolveProcurementCatalogRequestSummary = exports.buildProcurementCatalogRequestStatusLabel = exports.normalizeProcurementCatalogRequestFilters = exports.PROCUREMENT_REQUEST_DENIAL_UNDO_WINDOW_MS = void 0;
const catalog_requests_1 = require("../procurement/catalog-requests");
exports.PROCUREMENT_REQUEST_DENIAL_UNDO_WINDOW_MS = 1000 * 60 * 60 * 24;
function normalizeProcurementCatalogRequestFilters(input) {
    const departmentId = input?.departmentId?.trim() ?? "";
    const requestType = input?.requestType && input.requestType !== "all"
        ? input.requestType
        : null;
    const status = input?.status && input.status !== "all" ? input.status : null;
    const startDate = typeof input?.startDate === "number" && Number.isFinite(input.startDate)
        ? input.startDate
        : null;
    const endDate = typeof input?.endDate === "number" && Number.isFinite(input.endDate)
        ? input.endDate
        : null;
    return {
        departmentId: departmentId.length > 0 ? departmentId : null,
        endDate,
        requestType,
        startDate,
        status,
    };
}
exports.normalizeProcurementCatalogRequestFilters = normalizeProcurementCatalogRequestFilters;
function buildProcurementCatalogRequestStatusLabel(status) {
    return (0, catalog_requests_1.buildCatalogRequestStatusMeta)(status).label;
}
exports.buildProcurementCatalogRequestStatusLabel = buildProcurementCatalogRequestStatusLabel;
function resolveProcurementCatalogRequestSummary(args) {
    const departmentsById = new Map(args.departments.map((department) => [department.id, department]));
    return (0, catalog_requests_1.buildCatalogRequestSummary)({
        requests: [
            ...args.categoryRequests.map((request) => ({
                status: resolveRequestSummaryStatus({
                    departmentsById,
                    request,
                }),
                type: "category",
            })),
            ...args.itemRequests.map((request) => ({
                status: resolveRequestSummaryStatus({
                    departmentsById,
                    request,
                }),
                type: "item",
            })),
        ],
    });
}
exports.resolveProcurementCatalogRequestSummary = resolveProcurementCatalogRequestSummary;
function resolveProcurementRequestDenialUndoDeadline(args) {
    const now = args?.now ?? Date.now();
    const windowMs = args?.windowMs ?? exports.PROCUREMENT_REQUEST_DENIAL_UNDO_WINDOW_MS;
    return now + windowMs;
}
exports.resolveProcurementRequestDenialUndoDeadline = resolveProcurementRequestDenialUndoDeadline;
function isDenialUndoEligible(args) {
    if (args.status !== "denied") {
        return false;
    }
    const deadlineAt = args.denialUndoDeadlineAt ?? null;
    if (typeof deadlineAt !== "number") {
        return false;
    }
    const now = args.now ?? Date.now();
    if (now > deadlineAt) {
        return false;
    }
    return args.decisionNotificationStatus !== "failed";
}
exports.isDenialUndoEligible = isDenialUndoEligible;
function buildBulkDecisionCompatibility(args) {
    const eligibleIds = [];
    const skipped = [];
    const allowedType = args.allowedType ?? null;
    for (const request of args.requests) {
        if (allowedType && request.type !== allowedType) {
            skipped.push({
                id: request.id,
                reason: "Selection must stay within one request type.",
            });
            continue;
        }
        if (request.status !== "pending") {
            skipped.push({
                id: request.id,
                reason: "Only pending requests can be processed.",
            });
            continue;
        }
        eligibleIds.push(request.id);
    }
    return {
        eligibleIds,
        skipped,
    };
}
exports.buildBulkDecisionCompatibility = buildBulkDecisionCompatibility;
function getProcurementRequestDecisionErrorMessage(error, fallback) {
    const message = error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : null;
    if (!message) {
        return fallback;
    }
    return message;
}
exports.getProcurementRequestDecisionErrorMessage = getProcurementRequestDecisionErrorMessage;
function resolveRequestSummaryStatus(args) {
    const department = args.departmentsById.get(args.request.departmentId);
    return (0, catalog_requests_1.shouldExpireCatalogRequest)({
        status: args.request.status,
        submissionEndsAt: department?.submissionEndsAt,
        submissionStartsAt: department?.submissionStartsAt,
    })
        ? "expired"
        : args.request.status;
}
