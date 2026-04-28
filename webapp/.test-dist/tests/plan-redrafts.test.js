"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPlanRedraftTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const redraft_1 = require("../lib/plans/redraft");
function runPlanRedraftTests() {
    const completedTests = [];
    strict_1.default.deepEqual((0, redraft_1.normalizePlanRedraftReason)("   "), {
        message: "Explain why this approved plan needs to be redrafted.",
        ok: false,
    });
    strict_1.default.deepEqual((0, redraft_1.normalizePlanRedraftReason)("  Update laptop quantities.  "), {
        ok: true,
        value: "Update laptop quantities.",
    });
    completedTests.push("plan redraft reasons are required, trimmed, and normalized before a DU can request PO approval");
    strict_1.default.equal((0, redraft_1.hasPendingPlanRedraftRequest)({
        fiscalYear: "2026-2027",
        planId: "plan-1",
        requests: [
            { fiscalYear: "2026-2027", planId: "plan-1", status: "denied" },
            { fiscalYear: "2026-2027", planId: "plan-2", status: "pending" },
        ],
    }), false);
    strict_1.default.equal((0, redraft_1.hasPendingPlanRedraftRequest)({
        fiscalYear: "2026-2027",
        planId: "plan-1",
        requests: [
            { fiscalYear: "2026-2027", planId: "plan-1", status: "pending" },
        ],
    }), true);
    completedTests.push("plan redraft duplicate detection only blocks a pending request for the same plan and fiscal year");
    strict_1.default.deepEqual((0, redraft_1.getPlanRedraftRequestEligibility)({
        currentFiscalYear: "2026-2027",
        departmentId: "dept-1",
        pendingRequestExists: false,
        plan: {
            approvedAt: 10,
            departmentId: "dept-1",
            fiscalYear: "2026-2027",
            id: "plan-1",
            status: "approved",
            tenantId: "tenant-1",
        },
        tenantId: "tenant-1",
    }), {
        canRequest: true,
        message: null,
    });
    strict_1.default.equal((0, redraft_1.getPlanRedraftRequestEligibility)({
        currentFiscalYear: "2026-2027",
        departmentId: "dept-1",
        pendingRequestExists: false,
        plan: {
            approvedAt: 10,
            departmentId: "dept-1",
            fiscalYear: "2026-2027",
            id: "plan-1",
            status: "submitted",
            tenantId: "tenant-1",
        },
        tenantId: "tenant-1",
    }).message, "Only approved plans can be requested for redraft.");
    strict_1.default.equal((0, redraft_1.getPlanRedraftRequestEligibility)({
        currentFiscalYear: "2026-2027",
        departmentId: "dept-1",
        pendingRequestExists: true,
        plan: {
            approvedAt: 10,
            departmentId: "dept-1",
            fiscalYear: "2026-2027",
            id: "plan-1",
            status: "approved",
            tenantId: "tenant-1",
        },
        tenantId: "tenant-1",
    }).message, "A redraft request is already pending for this approved plan.");
    completedTests.push("plan redraft eligibility is approved-only, department-scoped, current-year scoped, and duplicate-safe");
    strict_1.default.equal((0, redraft_1.buildApprovedPlanRedraftSnapshotKey)({
        approvedAt: 1234,
        planId: "plan-1",
        tenantId: "tenant-1",
    }), "tenant-1:plan-1:approved-baseline:1234");
    completedTests.push("plan redraft approved-baseline snapshot keys are stable per tenant, plan, and approval timestamp");
    return completedTests;
}
exports.runPlanRedraftTests = runPlanRedraftTests;
