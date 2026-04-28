"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApprovedPlanRedraftSnapshotKey = exports.getPlanRedraftRequestEligibility = exports.hasPendingPlanRedraftRequest = exports.normalizePlanRedraftReason = void 0;
function normalizePlanRedraftReason(value) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length < 8) {
        return {
            message: "Explain why this approved plan needs to be redrafted.",
            ok: false,
        };
    }
    if (normalized.length > 500) {
        return {
            message: "Redraft reason must be 500 characters or fewer.",
            ok: false,
        };
    }
    return {
        ok: true,
        value: normalized,
    };
}
exports.normalizePlanRedraftReason = normalizePlanRedraftReason;
function hasPendingPlanRedraftRequest(args) {
    return args.requests.some((request) => request.planId === args.planId &&
        request.fiscalYear === args.fiscalYear &&
        request.status === "pending");
}
exports.hasPendingPlanRedraftRequest = hasPendingPlanRedraftRequest;
function getPlanRedraftRequestEligibility(args) {
    if (!args.plan) {
        return {
            canRequest: false,
            message: "Approved plan not found.",
        };
    }
    if (args.plan.tenantId !== args.tenantId || args.plan.departmentId !== args.departmentId) {
        return {
            canRequest: false,
            message: "Approved plan not found for this department.",
        };
    }
    if (args.plan.fiscalYear !== args.currentFiscalYear) {
        return {
            canRequest: false,
            message: "Only the current fiscal-year approved plan can be redrafted.",
        };
    }
    if (args.plan.status !== "approved") {
        return {
            canRequest: false,
            message: "Only approved plans can be requested for redraft.",
        };
    }
    if (typeof args.plan.approvedAt !== "number") {
        return {
            canRequest: false,
            message: "This approved plan is missing its approval timestamp.",
        };
    }
    if (args.pendingRequestExists) {
        return {
            canRequest: false,
            message: "A redraft request is already pending for this approved plan.",
        };
    }
    return {
        canRequest: true,
        message: null,
    };
}
exports.getPlanRedraftRequestEligibility = getPlanRedraftRequestEligibility;
function buildApprovedPlanRedraftSnapshotKey(args) {
    return `${args.tenantId}:${args.planId}:approved-baseline:${args.approvedAt}`;
}
exports.buildApprovedPlanRedraftSnapshotKey = buildApprovedPlanRedraftSnapshotKey;
