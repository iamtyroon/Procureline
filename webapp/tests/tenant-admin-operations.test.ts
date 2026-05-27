import assert from "node:assert/strict";
import {
    buildDowngradeBlockers,
    computeLockoutUntil,
    formatFiscalYearBySetting,
    getUsageTone,
    normalizeAllowedEmailDomain,
    validateComplianceTargets,
} from "../lib/shared/tenant-admin/operations";

export function runTenantAdminOperationsTests(): string[] {
    const completedTests: string[] = [];
    assert.equal(normalizeAllowedEmailDomain("@Example.AC.KE"), "example.ac.ke");
    assert.equal(normalizeAllowedEmailDomain("bad..domain"), null);
    assert.deepEqual(validateComplianceTargets({ agpo: 30, pwd: 2, localContent: 40 }), []);
    assert.equal(validateComplianceTargets({ agpo: 70, pwd: 20, localContent: 20 }).length, 1);
    completedTests.push("tenant settings normalize domains and enforce bounded combined compliance targets");

    assert.equal(getUsageTone({ key: "departments", label: "Departments", current: 7, limit: 10 }), "yellow");
    assert.equal(getUsageTone({ key: "departments", label: "Departments", current: 10, limit: 10 }), "red");
    assert.deepEqual(
        buildDowngradeBlockers([{ key: "departments", label: "Departments", current: 11, limit: 10 }]),
        ["Departments: 11 in use exceeds 10 allowed."],
    );
    completedTests.push("tenant billing usage thresholds and downgrade limits surface real blockers");

    const now = Date.UTC(2026, 4, 26);
    assert.equal(computeLockoutUntil({ failedAttempts: 4, now }), null);
    assert.equal(computeLockoutUntil({ failedAttempts: 5, now }), now + 15 * 60 * 1000);
    assert.equal(computeLockoutUntil({ failedAttempts: 10, now }), now + 60 * 60 * 1000);
    assert.equal(computeLockoutUntil({ failedAttempts: 15, now }), now + 24 * 60 * 60 * 1000);
    completedTests.push("security lockout escalation remains deterministic");

    assert.equal(formatFiscalYearBySetting({ format: "FY2025-26", startYear: 2025 }), "FY2025-26");
    assert.equal(
        formatFiscalYearBySetting({ format: "custom", customFormat: "{start}/{endShort}", startYear: 2025 }),
        "2025/26",
    );
    completedTests.push("tenant fiscal-year display formatting supports approved and validated custom formats");
    return completedTests;
}
