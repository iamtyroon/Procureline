"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcurementOfficerDepartmentTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const departments_1 = require("../lib/procurement-officer/departments");
const roles_1 = require("../lib/shared/auth/roles");
function runProcurementOfficerDepartmentTests() {
    const completedTests = [];
    strict_1.default.equal((0, departments_1.normalizeDepartmentName)("  Human   Resources  "), "human resources");
    strict_1.default.equal((0, departments_1.normalizeDepartmentCode)(" 2025 hr a7k9 "), "2025-HR-A7K9");
    strict_1.default.equal((0, departments_1.normalizeDepartmentCode)("2025__it---a7k9"), "2025-IT-A7K9");
    strict_1.default.equal((0, departments_1.normalizeDepartmentVoteNumber)(" bus 2025 q1 "), "BUS 2025 Q1");
    completedTests.push("department normalization collapses whitespace, lowercases names for uniqueness, preserves separate vote numbers, and stores department codes in the shared canonical access-code format");
    const parsedDepartment = departments_1.departmentFormSchema.parse({
        budgetAllocation: "2500000",
        code: "2025-hr-a7k9",
        name: " Human   Resources ",
        voteNumber: " hr-2025-q1 ",
    });
    strict_1.default.equal(parsedDepartment.name, "Human Resources");
    strict_1.default.equal(parsedDepartment.code, "2025-HR-A7K9");
    strict_1.default.equal(parsedDepartment.normalizedName, "human resources");
    strict_1.default.equal(parsedDepartment.normalizedCode, "2025-HR-A7K9");
    strict_1.default.equal(parsedDepartment.voteNumber, "HR-2025-Q1");
    strict_1.default.equal(parsedDepartment.normalizedVoteNumber, "HR-2025-Q1");
    strict_1.default.equal(parsedDepartment.adminEmail, undefined);
    strict_1.default.equal(parsedDepartment.budgetAllocation, 2_500_000);
    strict_1.default.equal(departments_1.departmentFormSchema.safeParse({
        adminEmail: "du@example.com",
        budgetAllocation: "2500000",
        code: "2025-IT-A7K9",
        name: "Information Technology",
        voteNumber: "IT-2025-Q1",
    }).success, true);
    strict_1.default.equal(departments_1.departmentFormSchema.safeParse({
        adminEmail: "not-an-email",
        budgetAllocation: "2500000",
        code: "2025-IT-A7K9",
        name: "Information Technology",
        voteNumber: "IT-2025-Q1",
    }).success, false);
    strict_1.default.equal(departments_1.departmentFormSchema.safeParse({
        budgetAllocation: 0,
        code: "2025-HR-A7K9",
        name: "Human Resources",
        voteNumber: "HR-2025-Q1",
    }).success, false);
    strict_1.default.equal(departments_1.departmentFormSchema.safeParse({
        budgetAllocation: 5_000,
        code: "HR01",
        name: "Human Resources",
        voteNumber: "HR-2025-Q1",
    }).success, false);
    completedTests.push("department form validation requires a separate vote number, positive budgets, and the canonical access-code format for department codes");
    const freeTierLimit = (0, departments_1.buildDepartmentTierLimitState)({
        activeDepartmentCount: 10,
        tier: "free",
    });
    const enterpriseLimit = (0, departments_1.buildDepartmentTierLimitState)({
        activeDepartmentCount: 245,
        tier: "enterprise",
    });
    strict_1.default.equal(freeTierLimit.limit, 10);
    strict_1.default.equal(freeTierLimit.atLimit, true);
    strict_1.default.equal(enterpriseLimit.limit, null);
    strict_1.default.equal(enterpriseLimit.atLimit, false);
    strict_1.default.equal((0, departments_1.getDepartmentUpgradeHref)(), "/pricing");
    completedTests.push("department tier-limit helpers enforce free, starter, and professional caps while leaving enterprise uncapped and routing upgrade CTAs to the public pricing page");
    const freeTierModal = (0, departments_1.buildDepartmentTierLimitModalContent)(freeTierLimit);
    const professionalTierModal = (0, departments_1.buildDepartmentTierLimitModalContent)({
        limit: 100,
        tier: "professional",
        tierLabel: "Professional",
    });
    strict_1.default.equal(freeTierModal.title, "Free tier limit: 10 departments");
    strict_1.default.equal(freeTierModal.guidance, "Upgrade to Starter (30 departments) or Professional (100 departments).");
    strict_1.default.equal(professionalTierModal.guidance, "Upgrade to Enterprise for unlimited departments.");
    completedTests.push("department tier-limit modal copy stays tier-specific so procurement officers see the exact upgrade guidance required by Story 4.2");
    const deletionBlockers = (0, departments_1.buildDepartmentDeletionBlockers)({
        activeDepartmentUserEmails: ["du1@example.com", "du2@example.com"],
        hasProtectedPlans: true,
    });
    strict_1.default.equal(deletionBlockers.canDelete, false);
    strict_1.default.deepEqual(deletionBlockers.activeDepartmentUserEmails, [
        "du1@example.com",
        "du2@example.com",
    ]);
    strict_1.default.equal(deletionBlockers.messages[0], "Cannot delete department with submitted plans");
    const deletionWithAssignedUsers = (0, departments_1.buildDepartmentDeletionBlockers)({
        activeDepartmentUserEmails: ["du@example.com"],
        hasProtectedPlans: false,
    });
    strict_1.default.equal(deletionWithAssignedUsers.canDelete, true);
    strict_1.default.equal(deletionWithAssignedUsers.messages[0], departments_1.DEPARTMENT_DELETE_DU_MESSAGE);
    completedTests.push("department delete blockers only block submitted-plan protection while surfacing DU access that will be deactivated during archive");
    const workspaceSummary = (0, departments_1.buildDepartmentWorkspaceSummary)({
        activeDepartmentCount: 2,
        departments: [
            {
                activeDepartmentUserEmails: [],
                budgetAllocation: 2_000_000,
                code: "FIN",
                hasActiveAccessCode: true,
                hasSentAccessCode: true,
                id: "department-1",
                isActive: true,
                lastUpdatedAt: Date.UTC(2026, 2, 20, 10, 0, 0),
                name: "Finance",
                planStatuses: ["draft"],
                voteNumber: "FIN-2025-Q1",
            },
            {
                activeDepartmentUserEmails: ["du@example.com"],
                budgetAllocation: 3_000_000,
                code: "HR",
                hasActiveAccessCode: false,
                hasSentAccessCode: false,
                id: "department-2",
                isActive: false,
                lastUpdatedAt: Date.UTC(2026, 2, 21, 10, 0, 0),
                name: "Human Resources",
                planStatuses: ["approved"],
                voteNumber: "HR-2025-Q1",
            },
        ],
        budgetCeiling: null,
        now: Date.UTC(2026, 2, 24, 9, 0, 0),
        tier: "starter",
    });
    strict_1.default.equal(workspaceSummary.rows.length, 1);
    strict_1.default.equal(workspaceSummary.rows[0]?.planningStateLabel, "Draft in progress");
    strict_1.default.equal(workspaceSummary.rows[0]?.departmentUserStateLabel, "Awaiting first sign-in");
    strict_1.default.equal(workspaceSummary.rows[0]?.accessCodeStateLabel, "Code sent");
    strict_1.default.equal(workspaceSummary.overAllocationWarning, null);
    strict_1.default.equal(workspaceSummary.limit.limit, 30);
    completedTests.push("department workspace summaries exclude archived departments from active views, keep planning-state signals truthful, and avoid fabricating over-allocation warnings without a real tenant budget ceiling");
    const createOverAllocationWarning = (0, departments_1.buildDepartmentOverAllocationWarning)({
        budgetCeiling: 4_000_000,
        currentBudgetAllocation: 2_500_000,
        departments: [
            {
                budgetAllocation: 2_000_000,
                id: "department-1",
            },
        ],
    });
    const editOverAllocationWarning = (0, departments_1.buildDepartmentOverAllocationWarning)({
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
    strict_1.default.equal(createOverAllocationWarning?.message, "Total department budgets exceed institution allocation by KES 500,000.00");
    strict_1.default.equal(editOverAllocationWarning?.message, "Total department budgets exceed institution allocation by KES 500,000.00");
    completedTests.push("department over-allocation warnings can be recomputed against the live draft budget so create and edit dialogs stay truthful before save");
    strict_1.default.equal((0, departments_1.formatDepartmentBudget)(1_500_000), "KES 1,500,000.00");
    strict_1.default.equal((0, departments_1.getDepartmentCodeFieldDescription)({ isCreateMode: true }), "Generate the DU access code now, or enter the canonical department code manually before creating the department.");
    strict_1.default.equal((0, departments_1.getDepartmentCodeFieldDescription)({ isCreateMode: false }), "Update the department code here if the DU access identifier changes. Generate a new canonical code or enter one manually.");
    strict_1.default.equal(departments_1.DEPARTMENT_CODE_EXISTS_MESSAGE, "Department code already exists");
    strict_1.default.equal(departments_1.DEPARTMENT_DEADLINE_NOT_CONFIGURED_MESSAGE, "Configure the shared submission deadline before extending one department.");
    strict_1.default.equal(departments_1.DEPARTMENT_DEADLINE_EXTENSION_PAST_MESSAGE, "Choose a new expiry date in the future.");
    strict_1.default.equal(departments_1.DEPARTMENT_DEADLINE_EXTENSION_ORDER_MESSAGE, "New expiry date must be after the current department expiry.");
    strict_1.default.equal(departments_1.DEPARTMENT_HARD_DELETE_ACTIVE_MESSAGE, "Archive the department before permanently deleting it.");
    strict_1.default.equal(departments_1.DEPARTMENT_NAME_EXISTS_MESSAGE, "Department name already exists");
    strict_1.default.equal(departments_1.DEPARTMENT_VOTE_NUMBER_EXISTS_MESSAGE, "Vote number already exists");
    strict_1.default.equal(departments_1.DEPARTMENT_BUDGET_POSITIVE_MESSAGE, "Budget must be a positive number");
    strict_1.default.equal(departments_1.DEPARTMENT_NOT_FOUND_MESSAGE, "Department not found");
    completedTests.push("department CRUD helpers preserve the exact user-facing validation and not-found messages required by Story 4.2");
    strict_1.default.equal((0, departments_1.isDepartmentCrudAuthorizationError)(new Error("Procurement Officer access is required for this resource.")), true);
    strict_1.default.equal((0, departments_1.isDepartmentCrudAuthorizationError)(new Error("Department code already exists")), false);
    strict_1.default.equal((0, departments_1.getDepartmentCrudRecoveryHref)(), (0, roles_1.buildDashboardPath)(roles_1.FORBIDDEN_ACCESS_REASON));
    strict_1.default.equal((0, departments_1.getDepartmentCrudErrorMessage)(new Error('Uncaught ConvexError: {"code":"FORBIDDEN","message":"Department code already sent. Create a new department if this user needs a different access path."}')), "Department code already sent. Create a new department if this user needs a different access path.");
    completedTests.push("department CRUD auth failures are classified separately from validation errors, unwrap safe Convex errors, and reuse the protected dashboard handoff instead of leaving the workspace stranded");
    return completedTests;
}
exports.runProcurementOfficerDepartmentTests = runProcurementOfficerDepartmentTests;
