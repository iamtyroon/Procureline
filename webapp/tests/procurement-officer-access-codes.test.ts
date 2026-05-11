import assert from "node:assert/strict";
import {
    ACCESS_CODE_EXPIRATION_PAST_MESSAGE,
    ACCESS_CODE_FORMAT_MESSAGE,
    buildAbsoluteAccessCodeLoginUrl,
    buildAccessCodeBulkGenerationFeedback,
    buildCanonicalDepartmentAccessCode,
    deriveAccessCodeExpirationDefault,
    getAccessCodeExpirationFormError,
    maskCanonicalDepartmentAccessCode,
    resolveAccessCodeFiscalYearLabel,
    selectDepartmentsForBulkAccessCodeGeneration,
    validateAccessCodeExpiration,
    validateCanonicalDepartmentAccessCode,
} from "../lib/procurement-officer/access-codes";

export function runProcurementOfficerAccessCodeTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(
        buildCanonicalDepartmentAccessCode({
            departmentName: "Computer Science",
            now: Date.UTC(2026, 2, 26, 10, 0, 0),
            randomChars: "a7k9",
        }),
        "2025-CS-A7K9",
    );
    assert.equal(
        resolveAccessCodeFiscalYearLabel(Date.UTC(2026, 6, 1, 12, 0, 0)),
        "2026",
    );
    assert.equal(
        buildCanonicalDepartmentAccessCode({
            departmentName: "Human Resources",
            fiscalYear: "2026",
            randomChars: "m2xk",
        }),
        "2026-HR-M2XK",
    );
    completedTests.push(
        "canonical access-code generation uses the selected fiscal-year prefix when supplied, department initials, and deterministic random suffix",
    );

    assert.equal(
        validateCanonicalDepartmentAccessCode("2025-CS-A7K9").ok,
        true,
    );
    assert.equal(
        validateCanonicalDepartmentAccessCode("CS2T").message,
        ACCESS_CODE_FORMAT_MESSAGE,
    );
    assert.equal(
        maskCanonicalDepartmentAccessCode("2025-CS-A7K9"),
        "2025-CS-**K9",
    );
    completedTests.push(
        "canonical access-code validation rejects the legacy compact format and later renders can mask the random suffix without inventing a second code value",
    );

    const expirationDefault = deriveAccessCodeExpirationDefault({
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
    const missingDefault = deriveAccessCodeExpirationDefault({
        departments: [
            {
                id: "department-1",
                isActive: true,
                submissionEndsAt: undefined,
                submissionStartsAt: undefined,
            },
        ],
    });
    assert.equal(expirationDefault.state, "available");
    assert.equal(expirationDefault.deadlineAt, Date.UTC(2026, 7, 20, 12, 0, 0));
    assert.equal(missingDefault.state, "setup_required");
    assert.equal(missingDefault.deadlineAt, null);
    completedTests.push(
        "access-code expiration defaults reuse the safe shared deadline when available and require manual input when deadline data is still unsafe",
    );

    assert.equal(
        validateAccessCodeExpiration({
            expirationAt: Date.UTC(2026, 2, 26, 9, 59, 59),
            now: Date.UTC(2026, 2, 26, 10, 0, 0),
        }).message,
        ACCESS_CODE_EXPIRATION_PAST_MESSAGE,
    );
    assert.deepEqual(
        getAccessCodeExpirationFormError(
            new Error(
                `Uncaught ConvexError: {"code":"VALIDATION_FAILED","field":"expirationAt","message":"${ACCESS_CODE_EXPIRATION_PAST_MESSAGE}"}`,
            ),
        ),
        {
            field: "expiresAt",
            message: ACCESS_CODE_EXPIRATION_PAST_MESSAGE,
        },
    );
    completedTests.push(
        "access-code expiration validation fails closed for stale timestamps and maps backend expiration fields back onto the workspace form",
    );

    assert.deepEqual(
        selectDepartmentsForBulkAccessCodeGeneration({
            candidates: [
                { departmentId: "department-1", hasActiveCode: false, isActive: true },
                { departmentId: "department-2", hasActiveCode: true, isActive: true },
                { departmentId: "department-3", hasActiveCode: false, isActive: false },
            ],
        }),
        ["department-1"],
    );
    assert.deepEqual(
        selectDepartmentsForBulkAccessCodeGeneration({
            candidates: [
                { departmentId: "department-1", hasActiveCode: false, isActive: true },
                { departmentId: "department-2", hasActiveCode: true, isActive: true },
            ],
            includeDepartmentsWithActiveCodes: true,
        }),
        ["department-1", "department-2"],
    );
    completedTests.push(
        "bulk generation selection stays honest about missing coverage by default and only includes already-covered departments after explicit confirmation",
    );

    assert.equal(
        buildAbsoluteAccessCodeLoginUrl({
            appUrl: "https://procureline.example.com/",
        }),
        "https://procureline.example.com/access/department-user",
    );
    assert.equal(
        buildAbsoluteAccessCodeLoginUrl({
            nodeEnv: "test",
        }),
        "http://localhost:3000/access/department-user",
    );
    completedTests.push(
        "access-code delivery links are promoted to absolute URLs for email clients and still fall back safely in test mode",
    );

    const bulkFeedback = buildAccessCodeBulkGenerationFeedback({
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
    assert.equal(bulkFeedback.generatedCount, 1);
    assert.equal(bulkFeedback.skippedCount, 1);
    assert.equal(bulkFeedback.failedCount, 1);
    assert.equal(bulkFeedback.items[2]?.detail, "Generation failed");
    completedTests.push(
        "bulk generation feedback keeps a department-by-department result summary so operators can see generated, skipped, and failed outcomes instead of a single toast",
    );

    return completedTests;
}
