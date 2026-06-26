"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTenantAdminOperationsTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const operations_1 = require("../lib/shared/tenant-admin/operations");
function runTenantAdminOperationsTests() {
    const completedTests = [];
    strict_1.default.equal((0, operations_1.normalizeAllowedEmailDomain)("@Example.AC.KE"), "example.ac.ke");
    strict_1.default.equal((0, operations_1.normalizeAllowedEmailDomain)("bad..domain"), null);
    strict_1.default.deepEqual((0, operations_1.validateComplianceTargets)({ agpo: 30, pwd: 2, localContent: 40 }), []);
    strict_1.default.equal((0, operations_1.validateComplianceTargets)({ agpo: 70, pwd: 20, localContent: 20 }).length, 1);
    completedTests.push("tenant settings normalize domains and enforce bounded combined compliance targets");
    strict_1.default.equal((0, operations_1.getUsageTone)({ key: "departments", label: "Departments", current: 7, limit: 10 }), "yellow");
    strict_1.default.equal((0, operations_1.getUsageTone)({ key: "departments", label: "Departments", current: 10, limit: 10 }), "red");
    strict_1.default.deepEqual((0, operations_1.buildDowngradeBlockers)([{ key: "departments", label: "Departments", current: 11, limit: 10 }]), ["Departments: 11 in use exceeds 10 allowed."]);
    completedTests.push("tenant billing usage thresholds and downgrade limits surface real blockers");
    const now = Date.UTC(2026, 4, 26);
    strict_1.default.equal((0, operations_1.computeLockoutUntil)({ failedAttempts: 4, now }), null);
    strict_1.default.equal((0, operations_1.computeLockoutUntil)({ failedAttempts: 5, now }), now + 15 * 60 * 1000);
    strict_1.default.equal((0, operations_1.computeLockoutUntil)({ failedAttempts: 10, now }), now + 60 * 60 * 1000);
    strict_1.default.equal((0, operations_1.computeLockoutUntil)({ failedAttempts: 15, now }), now + 24 * 60 * 60 * 1000);
    completedTests.push("security lockout escalation remains deterministic");
    strict_1.default.equal((0, operations_1.formatFiscalYearBySetting)({ format: "FY2025-26", startYear: 2025 }), "FY2025-26");
    strict_1.default.equal((0, operations_1.formatFiscalYearBySetting)({ format: "custom", customFormat: "{start}/{endShort}", startYear: 2025 }), "2025/26");
    completedTests.push("tenant fiscal-year display formatting supports approved and validated custom formats");
    return completedTests;
}
exports.runTenantAdminOperationsTests = runTenantAdminOperationsTests;
