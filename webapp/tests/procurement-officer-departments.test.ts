import assert from "node:assert/strict";
import {
    buildDepartmentDeletionBlockers,
    buildDepartmentOverAllocationWarning,
    buildDepartmentTierLimitModalContent,
    buildDepartmentTierLimitState,
    buildDepartmentWorkspaceSummary,
    DEPARTMENT_BUDGET_POSITIVE_MESSAGE,
    DEPARTMENT_CODE_EXISTS_MESSAGE,
    DEPARTMENT_NAME_EXISTS_MESSAGE,
    DEPARTMENT_NOT_FOUND_MESSAGE,
    departmentFormSchema,
    formatDepartmentBudget,
    getDepartmentCrudRecoveryHref,
    getDepartmentUpgradeHref,
    isDepartmentCrudAuthorizationError,
    normalizeDepartmentCode,
    normalizeDepartmentName,
} from "../lib/procurement-officer/departments";
import { buildDashboardPath, FORBIDDEN_ACCESS_REASON } from "../lib/auth/roles";

export function runProcurementOfficerDepartmentTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(normalizeDepartmentName("  Human   Resources  "), "human resources");
    assert.equal(normalizeDepartmentCode(" hr 01 "), "HR01");
    assert.equal(normalizeDepartmentCode(" ict "), "ICT");
    completedTests.push(
        "department normalization collapses whitespace, lowercases names for uniqueness, and stores codes as uppercase alphanumeric values",
    );

    const parsedDepartment = departmentFormSchema.parse({
        budgetAllocation: "2500000",
        code: " hr 01 ",
        name: " Human   Resources ",
    });
    assert.equal(parsedDepartment.name, "Human Resources");
    assert.equal(parsedDepartment.code, "HR01");
    assert.equal(parsedDepartment.normalizedName, "human resources");
    assert.equal(parsedDepartment.normalizedCode, "HR01");
    assert.equal(parsedDepartment.budgetAllocation, 2_500_000);
    assert.equal(
        departmentFormSchema.safeParse({
            budgetAllocation: 0,
            code: "HR",
            name: "Human Resources",
        }).success,
        false,
    );
    assert.equal(
        departmentFormSchema.safeParse({
            budgetAllocation: 5_000,
            code: "HR-01",
            name: "Human Resources",
        }).success,
        false,
    );
    completedTests.push(
        "department form validation requires positive budgets and rejects non-alphanumeric department codes after normalization",
    );

    const freeTierLimit = buildDepartmentTierLimitState({
        activeDepartmentCount: 10,
        tier: "free",
    });
    const enterpriseLimit = buildDepartmentTierLimitState({
        activeDepartmentCount: 245,
        tier: "enterprise",
    });
    assert.equal(freeTierLimit.limit, 10);
    assert.equal(freeTierLimit.atLimit, true);
    assert.equal(enterpriseLimit.limit, null);
    assert.equal(enterpriseLimit.atLimit, false);
    assert.equal(getDepartmentUpgradeHref(), "/pricing");
    completedTests.push(
        "department tier-limit helpers enforce free, starter, and professional caps while leaving enterprise uncapped and routing upgrade CTAs to the public pricing page",
    );

    const freeTierModal = buildDepartmentTierLimitModalContent(freeTierLimit);
    const professionalTierModal = buildDepartmentTierLimitModalContent({
        limit: 100,
        tier: "professional",
        tierLabel: "Professional",
    });
    assert.equal(freeTierModal.title, "Free tier limit: 10 departments");
    assert.equal(
        freeTierModal.guidance,
        "Upgrade to Starter (30 departments) or Professional (100 departments).",
    );
    assert.equal(
        professionalTierModal.guidance,
        "Upgrade to Enterprise for unlimited departments.",
    );
    completedTests.push(
        "department tier-limit modal copy stays tier-specific so procurement officers see the exact upgrade guidance required by Story 4.2",
    );

    const deletionBlockers = buildDepartmentDeletionBlockers({
        activeDepartmentUserEmails: ["du1@example.com", "du2@example.com"],
        hasProtectedPlans: true,
    });
    assert.equal(deletionBlockers.canDelete, false);
    assert.deepEqual(deletionBlockers.activeDepartmentUserEmails, [
        "du1@example.com",
        "du2@example.com",
    ]);
    assert.equal(deletionBlockers.messages[0], "Cannot delete department with submitted plans");
    completedTests.push(
        "department delete blockers surface submitted-plan protection and the exact active DU emails that must be resolved before archiving",
    );

    const workspaceSummary = buildDepartmentWorkspaceSummary({
        activeDepartmentCount: 2,
        departments: [
            {
                activeDepartmentUserEmails: [],
                budgetAllocation: 2_000_000,
                code: "FIN",
                hasActiveAccessCode: true,
                id: "department-1",
                isActive: true,
                lastUpdatedAt: Date.UTC(2026, 2, 20, 10, 0, 0),
                name: "Finance",
                planStatuses: ["draft"],
            },
            {
                activeDepartmentUserEmails: ["du@example.com"],
                budgetAllocation: 3_000_000,
                code: "HR",
                hasActiveAccessCode: false,
                id: "department-2",
                isActive: false,
                lastUpdatedAt: Date.UTC(2026, 2, 21, 10, 0, 0),
                name: "Human Resources",
                planStatuses: ["approved"],
            },
        ],
        budgetCeiling: null,
        now: Date.UTC(2026, 2, 24, 9, 0, 0),
        tier: "starter",
    });
    assert.equal(workspaceSummary.rows.length, 1);
    assert.equal(workspaceSummary.rows[0]?.planningStateLabel, "Draft in progress");
    assert.equal(workspaceSummary.rows[0]?.departmentUserStateLabel, "Unassigned");
    assert.equal(workspaceSummary.overAllocationWarning, null);
    assert.equal(workspaceSummary.limit.limit, 30);
    completedTests.push(
        "department workspace summaries exclude archived departments from active views, keep planning-state signals truthful, and avoid fabricating over-allocation warnings without a real tenant budget ceiling",
    );

    const createOverAllocationWarning = buildDepartmentOverAllocationWarning({
        budgetCeiling: 4_000_000,
        currentBudgetAllocation: 2_500_000,
        departments: [
            {
                budgetAllocation: 2_000_000,
                id: "department-1",
            },
        ],
    });
    const editOverAllocationWarning = buildDepartmentOverAllocationWarning({
        budgetCeiling: 4_000_000,
        currentBudgetAllocation: 2_500_000,
        currentDepartmentId: "department-2",
        departments: [
            {
                budgetAllocation: 2_000_000,
                id: "department-1",
            },
            {
                budgetAllocation: 1_500_000,
                id: "department-2",
            },
        ],
    });
    assert.equal(
        createOverAllocationWarning?.message,
        "Total department budgets exceed institution allocation by KES 500,000.00",
    );
    assert.equal(
        editOverAllocationWarning?.message,
        "Total department budgets exceed institution allocation by KES 500,000.00",
    );
    completedTests.push(
        "department over-allocation warnings can be recomputed against the live draft budget so create and edit dialogs stay truthful before save",
    );

    assert.equal(formatDepartmentBudget(1_500_000), "KES 1,500,000.00");
    assert.equal(DEPARTMENT_CODE_EXISTS_MESSAGE, "Department code already exists");
    assert.equal(DEPARTMENT_NAME_EXISTS_MESSAGE, "Department name already exists");
    assert.equal(DEPARTMENT_BUDGET_POSITIVE_MESSAGE, "Budget must be a positive number");
    assert.equal(DEPARTMENT_NOT_FOUND_MESSAGE, "Department not found");
    completedTests.push(
        "department CRUD helpers preserve the exact user-facing validation and not-found messages required by Story 4.2",
    );

    assert.equal(
        isDepartmentCrudAuthorizationError(
            new Error("Procurement Officer access is required for this resource."),
        ),
        true,
    );
    assert.equal(
        isDepartmentCrudAuthorizationError(new Error("Department code already exists")),
        false,
    );
    assert.equal(
        getDepartmentCrudRecoveryHref(),
        buildDashboardPath(FORBIDDEN_ACCESS_REASON),
    );
    completedTests.push(
        "department CRUD auth failures are classified separately from validation errors and reuse the protected dashboard handoff instead of leaving the workspace stranded",
    );

    return completedTests;
}
