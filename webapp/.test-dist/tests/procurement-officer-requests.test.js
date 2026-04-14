"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcurementOfficerRequestTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const requests_1 = require("../lib/procurement-officer/requests");
const catalog_requests_1 = require("../lib/procurement/catalog-requests");
function runProcurementOfficerRequestTests() {
    const completedTests = [];
    strict_1.default.deepEqual((0, requests_1.normalizeProcurementCatalogRequestFilters)({
        departmentId: "  dept-1 ",
        requestType: "all",
        status: "all",
        startDate: Number.NaN,
        endDate: 123,
    }), {
        departmentId: "dept-1",
        endDate: 123,
        requestType: null,
        startDate: null,
        status: null,
    });
    completedTests.push("procurement-officer request filter normalization trims optional fields and drops invalid ranges");
    const deadline = (0, requests_1.resolveProcurementRequestDenialUndoDeadline)({
        now: 1000,
        windowMs: 5000,
    });
    strict_1.default.equal(deadline, 6000);
    completedTests.push("procurement-officer denial undo deadline uses the configured window");
    strict_1.default.equal((0, requests_1.isDenialUndoEligible)({
        status: "denied",
        denialUndoDeadlineAt: Date.now() + 1000,
        decisionNotificationStatus: "queued",
    }), true);
    strict_1.default.equal((0, requests_1.isDenialUndoEligible)({
        status: "denied",
        denialUndoDeadlineAt: Date.now() - 1000,
        decisionNotificationStatus: "queued",
    }), false);
    strict_1.default.equal((0, requests_1.isDenialUndoEligible)({
        status: "denied",
        denialUndoDeadlineAt: Date.now() + 1000,
        decisionNotificationStatus: "failed",
    }), false);
    completedTests.push("procurement-officer denial undo eligibility respects deadline and notification state");
    strict_1.default.deepEqual((0, requests_1.resolveProcurementCatalogRequestSummary)({
        categoryRequests: [
            { departmentId: "dept-active", status: "pending" },
            { departmentId: "dept-active", status: "approved" },
        ],
        departments: [
            {
                id: "dept-active",
                submissionEndsAt: Date.now() + 60_000,
                submissionStartsAt: Date.now() - 60_000,
            },
            {
                id: "dept-expired",
                submissionEndsAt: Date.now() - 60_000,
                submissionStartsAt: Date.now() - 120_000,
            },
        ],
        itemRequests: [
            { departmentId: "dept-expired", status: "pending" },
            { departmentId: "dept-expired", status: "denied" },
        ],
    }), {
        pendingCategoryCount: 1,
        pendingItemCount: 0,
        totalCount: 4,
        totalPendingCount: 1,
    });
    completedTests.push("procurement-officer request summary downgrades deadline-expired pending rows before dashboard badges and inbox counts are computed");
    strict_1.default.equal((0, catalog_requests_1.shouldExpireCatalogRequest)({
        now: Date.UTC(2026, 6, 1, 8, 0, 1),
        status: "pending",
        submissionEndsAt: Date.UTC(2026, 6, 1, 8, 0, 0),
        submissionStartsAt: Date.UTC(2026, 5, 1, 8, 0, 0),
    }), true);
    completedTests.push("procurement-officer expiry helpers treat the submission deadline itself as the cutoff for pending request actionability");
    const bulkCompatibility = (0, requests_1.buildBulkDecisionCompatibility)({
        action: "approve",
        allowedType: "item",
        requests: [
            { id: "ok-1", status: "pending", type: "item" },
            { id: "skip-type", status: "pending", type: "category" },
            { id: "skip-status", status: "approved", type: "item" },
        ],
    });
    strict_1.default.deepEqual(bulkCompatibility.eligibleIds, ["ok-1"]);
    strict_1.default.equal(bulkCompatibility.skipped.length, 2);
    completedTests.push("procurement-officer bulk compatibility enforces type and pending-only selection");
    strict_1.default.equal((0, requests_1.buildProcurementCatalogRequestStatusLabel)("approved"), "Approved");
    strict_1.default.equal((0, requests_1.getProcurementRequestDecisionErrorMessage)(new Error("Custom error"), "Fallback"), "Custom error");
    strict_1.default.equal((0, requests_1.getProcurementRequestDecisionErrorMessage)(null, "Fallback"), "Fallback");
    completedTests.push("procurement-officer request helpers surface status labels and deterministic error messages");
    return completedTests;
}
exports.runProcurementOfficerRequestTests = runProcurementOfficerRequestTests;
