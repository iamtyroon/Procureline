"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcurementOfficerAccessCodeTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const access_codes_1 = require("../lib/procurement-officer/access-codes");
function runProcurementOfficerAccessCodeTests() {
    const completedTests = [];
    strict_1.default.equal((0, access_codes_1.buildCanonicalDepartmentAccessCode)({
        departmentName: "Computer Science",
        now: Date.UTC(2026, 2, 26, 10, 0, 0),
        randomChars: "a7k9",
    }), "2025-CS-A7K9");
    strict_1.default.equal((0, access_codes_1.resolveAccessCodeFiscalYearLabel)(Date.UTC(2026, 6, 1, 12, 0, 0)), "2026");
    completedTests.push("canonical access-code generation uses the fiscal-year prefix, department initials, and deterministic random suffix");
    strict_1.default.equal((0, access_codes_1.validateCanonicalDepartmentAccessCode)("2025-CS-A7K9").ok, true);
    strict_1.default.equal((0, access_codes_1.validateCanonicalDepartmentAccessCode)("CS2T").message, access_codes_1.ACCESS_CODE_FORMAT_MESSAGE);
    strict_1.default.equal((0, access_codes_1.maskCanonicalDepartmentAccessCode)("2025-CS-A7K9"), "2025-CS-**K9");
    completedTests.push("canonical access-code validation rejects the legacy compact format and later renders can mask the random suffix without inventing a second code value");
    const expirationDefault = (0, access_codes_1.deriveAccessCodeExpirationDefault)({
        departments: [
            {
                id: "department-1",
                isActive: true,
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            },
            {
                id: "department-2",
                isActive: true,
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            },
        ],
    });
    const missingDefault = (0, access_codes_1.deriveAccessCodeExpirationDefault)({
        departments: [
            {
                id: "department-1",
                isActive: true,
                submissionEndsAt: undefined,
                submissionStartsAt: undefined,
            },
        ],
    });
    strict_1.default.equal(expirationDefault.state, "available");
    strict_1.default.equal(expirationDefault.deadlineAt, Date.UTC(2026, 7, 20, 12, 0, 0));
    strict_1.default.equal(missingDefault.state, "setup_required");
    strict_1.default.equal(missingDefault.deadlineAt, null);
    completedTests.push("access-code expiration defaults reuse the safe shared deadline when available and require manual input when deadline data is still unsafe");
    strict_1.default.equal((0, access_codes_1.validateAccessCodeExpiration)({
        expirationAt: Date.UTC(2026, 2, 26, 9, 59, 59),
        now: Date.UTC(2026, 2, 26, 10, 0, 0),
    }).message, access_codes_1.ACCESS_CODE_EXPIRATION_PAST_MESSAGE);
    strict_1.default.deepEqual((0, access_codes_1.getAccessCodeExpirationFormError)(new Error(`Uncaught ConvexError: {"code":"VALIDATION_FAILED","field":"expirationAt","message":"${access_codes_1.ACCESS_CODE_EXPIRATION_PAST_MESSAGE}"}`)), {
        field: "expiresAt",
        message: access_codes_1.ACCESS_CODE_EXPIRATION_PAST_MESSAGE,
    });
    completedTests.push("access-code expiration validation fails closed for stale timestamps and maps backend expiration fields back onto the workspace form");
    strict_1.default.deepEqual((0, access_codes_1.selectDepartmentsForBulkAccessCodeGeneration)({
        candidates: [
            { departmentId: "department-1", hasActiveCode: false, isActive: true },
            { departmentId: "department-2", hasActiveCode: true, isActive: true },
            { departmentId: "department-3", hasActiveCode: false, isActive: false },
        ],
    }), ["department-1"]);
    strict_1.default.deepEqual((0, access_codes_1.selectDepartmentsForBulkAccessCodeGeneration)({
        candidates: [
            { departmentId: "department-1", hasActiveCode: false, isActive: true },
            { departmentId: "department-2", hasActiveCode: true, isActive: true },
        ],
        includeDepartmentsWithActiveCodes: true,
    }), ["department-1", "department-2"]);
    completedTests.push("bulk generation selection stays honest about missing coverage by default and only includes already-covered departments after explicit confirmation");
    strict_1.default.equal((0, access_codes_1.buildAbsoluteAccessCodeLoginUrl)({
        appUrl: "https://procureline.example.com/",
    }), "https://procureline.example.com/access/department-user");
    strict_1.default.equal((0, access_codes_1.buildAbsoluteAccessCodeLoginUrl)({
        nodeEnv: "test",
    }), "http://localhost:3000/access/department-user");
    completedTests.push("access-code delivery links are promoted to absolute URLs for email clients and still fall back safely in test mode");
    const bulkFeedback = (0, access_codes_1.buildAccessCodeBulkGenerationFeedback)({
        noEligibleDepartments: false,
        results: [
            {
                departmentId: "department-1",
                departmentName: "Finance",
                outcome: "generated",
            },
            {
                departmentId: "department-2",
                departmentName: "Human Resources",
                outcome: "skipped",
                reason: "Department already has an active access code.",
            },
            {
                departmentId: "department-3",
                departmentName: "ICT",
                outcome: "failed",
                reason: "Generation failed",
            },
        ],
        summary: "Bulk access-code generation completed.",
    });
    strict_1.default.equal(bulkFeedback.generatedCount, 1);
    strict_1.default.equal(bulkFeedback.skippedCount, 1);
    strict_1.default.equal(bulkFeedback.failedCount, 1);
    strict_1.default.equal(bulkFeedback.items[2]?.detail, "Generation failed");
    completedTests.push("bulk generation feedback keeps a department-by-department result summary so operators can see generated, skipped, and failed outcomes instead of a single toast");
    return completedTests;
}
exports.runProcurementOfficerAccessCodeTests = runProcurementOfficerAccessCodeTests;
