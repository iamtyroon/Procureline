"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDepartmentWorkspaceSummary = exports.buildDepartmentOverAllocationWarning = exports.summarizeDepartmentPlanningState = exports.buildDepartmentDeletionBlockers = exports.buildDepartmentTierLimitModalContent = exports.buildDepartmentTierLimitState = exports.isDepartmentCrudAuthorizationError = exports.getDepartmentCrudErrorMessage = exports.isDepartmentTierLimitMessage = exports.getDepartmentCrudRecoveryHref = exports.getDepartmentUpgradeHref = exports.formatDepartmentBudget = exports.getDepartmentCodeFieldDescription = exports.departmentFormSchema = exports.validateDepartmentCode = exports.normalizeDepartmentCode = exports.normalizeDepartmentName = exports.DEPARTMENT_CODE_FORMAT_MESSAGE = exports.DEPARTMENT_CODE_REQUIRED_MESSAGE = exports.DEPARTMENT_NAME_REQUIRED_MESSAGE = exports.DEPARTMENT_SETUP_REQUIRED_MESSAGE = exports.DEPARTMENT_DELETE_GENERIC_ERROR_MESSAGE = exports.DEPARTMENT_SAVE_GENERIC_ERROR_MESSAGE = exports.DEPARTMENT_CODE_EMAIL_AFTER_CREATE_MESSAGE = exports.DEPARTMENT_CODE_MANAGED_IN_ACCESS_CODES_MESSAGE = exports.DEPARTMENT_DELETE_DU_MESSAGE = exports.DEPARTMENT_DELETE_PLANS_MESSAGE = exports.DEPARTMENT_NOT_FOUND_MESSAGE = exports.DEPARTMENT_BUDGET_POSITIVE_MESSAGE = exports.DEPARTMENT_NAME_EXISTS_MESSAGE = exports.DEPARTMENT_CODE_EXISTS_MESSAGE = exports.DEPARTMENT_CODE_MAX_LENGTH = void 0;
const zod_1 = require("zod");
const roles_1 = require("../auth/roles");
const input_1 = require("../security/input");
const access_codes_1 = require("./access-codes");
exports.DEPARTMENT_CODE_MAX_LENGTH = access_codes_1.CANONICAL_ACCESS_CODE_MAX_LENGTH;
exports.DEPARTMENT_CODE_EXISTS_MESSAGE = "Department code already exists";
exports.DEPARTMENT_NAME_EXISTS_MESSAGE = "Department name already exists";
exports.DEPARTMENT_BUDGET_POSITIVE_MESSAGE = "Budget must be a positive number";
exports.DEPARTMENT_NOT_FOUND_MESSAGE = "Department not found";
exports.DEPARTMENT_DELETE_PLANS_MESSAGE = "Cannot delete department with submitted plans";
exports.DEPARTMENT_DELETE_DU_MESSAGE = "Deactivate assigned Departmental Users before deleting this department.";
exports.DEPARTMENT_CODE_MANAGED_IN_ACCESS_CODES_MESSAGE = "Use Access Codes to rotate or replace the department code.";
exports.DEPARTMENT_CODE_EMAIL_AFTER_CREATE_MESSAGE = "Create the department first, then queue the active code from Access Codes.";
exports.DEPARTMENT_SAVE_GENERIC_ERROR_MESSAGE = "We could not save the department right now. Please try again.";
exports.DEPARTMENT_DELETE_GENERIC_ERROR_MESSAGE = "We could not delete the department right now. Please try again.";
exports.DEPARTMENT_SETUP_REQUIRED_MESSAGE = "Department setup is incomplete. Contact your Procurement Officer.";
exports.DEPARTMENT_NAME_REQUIRED_MESSAGE = "Department name is required";
exports.DEPARTMENT_CODE_REQUIRED_MESSAGE = "Department code is required";
exports.DEPARTMENT_CODE_FORMAT_MESSAGE = access_codes_1.ACCESS_CODE_FORMAT_MESSAGE;
const TIER_LABELS = {
    enterprise: "Enterprise",
    free: "Free",
    professional: "Professional",
    starter: "Starter",
};
const TIER_LIMITS = {
    free: 10,
    professional: 100,
    starter: 30,
};
const DEPARTMENT_TIER_LIMIT_MESSAGE_PATTERN = /\b(free|starter|professional)\b tier supports up to \d+ active departments\./i;
const DEPARTMENT_CRUD_AUTH_RECOVERY_PATTERNS = [
    /\bprocurement officer access is required for this resource\b/i,
    /\btenant record not found\b/i,
];
function normalizeDepartmentName(input) {
    return (0, input_1.normalizePlainText)(input).toLowerCase();
}
exports.normalizeDepartmentName = normalizeDepartmentName;
function normalizeDepartmentCode(input) {
    return (0, access_codes_1.normalizeCanonicalDepartmentAccessCode)(input);
}
exports.normalizeDepartmentCode = normalizeDepartmentCode;
function validateDepartmentCode(code) {
    return (0, access_codes_1.validateCanonicalDepartmentAccessCode)(code);
}
exports.validateDepartmentCode = validateDepartmentCode;
exports.departmentFormSchema = zod_1.z
    .object({
    adminEmail: zod_1.z.string().optional(),
    budgetAllocation: zod_1.z.coerce.number(),
    code: zod_1.z.string(),
    name: zod_1.z.string(),
})
    .superRefine((value, ctx) => {
    const adminEmail = (0, input_1.normalizeAuthEmail)(value.adminEmail ?? "");
    const normalizedName = normalizeDepartmentName(value.name);
    const normalizedCode = normalizeDepartmentCode(value.code);
    const codeValidation = validateDepartmentCode(normalizedCode);
    if (adminEmail.length > 0) {
        const emailValidation = (0, input_1.validateEmailInput)(adminEmail, "adminEmail");
        if (!emailValidation.ok) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: emailValidation.issue.message,
                path: ["adminEmail"],
            });
        }
    }
    if (normalizedName.length === 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: exports.DEPARTMENT_NAME_REQUIRED_MESSAGE,
            path: ["name"],
        });
    }
    if (normalizedCode.length === 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: exports.DEPARTMENT_CODE_REQUIRED_MESSAGE,
            path: ["code"],
        });
    }
    else if (!codeValidation.ok) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: codeValidation.message,
            path: ["code"],
        });
    }
    if (!Number.isFinite(value.budgetAllocation) ||
        Number.isNaN(value.budgetAllocation) ||
        value.budgetAllocation <= 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: exports.DEPARTMENT_BUDGET_POSITIVE_MESSAGE,
            path: ["budgetAllocation"],
        });
    }
})
    .transform((value) => {
    const adminEmail = (0, input_1.normalizeAuthEmail)(value.adminEmail ?? "");
    const code = normalizeDepartmentCode(value.code);
    const name = (0, input_1.normalizePlainText)(value.name);
    return {
        adminEmail: adminEmail.length > 0 ? adminEmail : undefined,
        budgetAllocation: value.budgetAllocation,
        code,
        name,
        normalizedCode: code,
        normalizedName: normalizeDepartmentName(name),
    };
});
function getDepartmentCodeFieldDescription(args) {
    return args.isCreateMode
        ? "Generate a canonical code now, then manage future rotation, deactivation, and delivery from Access Codes."
        : "Department code changes are managed from Access Codes so the active DU sign-in code stays in sync.";
}
exports.getDepartmentCodeFieldDescription = getDepartmentCodeFieldDescription;
function formatDepartmentBudget(amount) {
    return `KES ${amount.toLocaleString("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
    })}`;
}
exports.formatDepartmentBudget = formatDepartmentBudget;
function getDepartmentUpgradeHref() {
    return "/pricing";
}
exports.getDepartmentUpgradeHref = getDepartmentUpgradeHref;
function getDepartmentCrudRecoveryHref() {
    return (0, roles_1.buildDashboardPath)(roles_1.FORBIDDEN_ACCESS_REASON);
}
exports.getDepartmentCrudRecoveryHref = getDepartmentCrudRecoveryHref;
function isDepartmentTierLimitMessage(message) {
    return message ? DEPARTMENT_TIER_LIMIT_MESSAGE_PATTERN.test(message) : false;
}
exports.isDepartmentTierLimitMessage = isDepartmentTierLimitMessage;
function getDepartmentCrudErrorMessage(error) {
    const message = error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : null;
    if (!message) {
        return exports.DEPARTMENT_SAVE_GENERIC_ERROR_MESSAGE;
    }
    if ([
        exports.DEPARTMENT_BUDGET_POSITIVE_MESSAGE,
        exports.DEPARTMENT_CODE_MANAGED_IN_ACCESS_CODES_MESSAGE,
        exports.DEPARTMENT_CODE_EXISTS_MESSAGE,
        exports.DEPARTMENT_DELETE_DU_MESSAGE,
        exports.DEPARTMENT_DELETE_PLANS_MESSAGE,
        exports.DEPARTMENT_NAME_EXISTS_MESSAGE,
        exports.DEPARTMENT_NOT_FOUND_MESSAGE,
    ].includes(message)) {
        return message;
    }
    if (isDepartmentTierLimitMessage(message)) {
        return message;
    }
    return exports.DEPARTMENT_SAVE_GENERIC_ERROR_MESSAGE;
}
exports.getDepartmentCrudErrorMessage = getDepartmentCrudErrorMessage;
function isDepartmentCrudAuthorizationError(error) {
    const message = error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : null;
    if (!message) {
        return false;
    }
    return DEPARTMENT_CRUD_AUTH_RECOVERY_PATTERNS.some((pattern) => pattern.test(message));
}
exports.isDepartmentCrudAuthorizationError = isDepartmentCrudAuthorizationError;
function buildDepartmentTierLimitState(args) {
    const limit = args.tier === "enterprise" ? null : TIER_LIMITS[args.tier];
    const tierLabel = TIER_LABELS[args.tier];
    return {
        atLimit: limit !== null && args.activeDepartmentCount >= limit,
        limit,
        remainingSlots: limit === null ? null : Math.max(limit - args.activeDepartmentCount, 0),
        tier: args.tier,
        tierLabel,
        upgradeHref: getDepartmentUpgradeHref(),
    };
}
exports.buildDepartmentTierLimitState = buildDepartmentTierLimitState;
function buildDepartmentTierLimitModalContent(args) {
    if (args.tier === "free") {
        return {
            body: "Archive an existing department or upgrade to keep adding departments.",
            guidance: "Upgrade to Starter (30 departments) or Professional (100 departments).",
            title: `Free tier limit: ${args.limit ?? 10} departments`,
        };
    }
    if (args.tier === "starter") {
        return {
            body: "Archive an existing department or upgrade to keep adding departments.",
            guidance: "Upgrade to Professional (100 departments) or Enterprise (unlimited).",
            title: `Starter tier limit: ${args.limit ?? 30} departments`,
        };
    }
    if (args.tier === "professional") {
        return {
            body: "Archive an existing department or upgrade to keep adding departments.",
            guidance: "Upgrade to Enterprise for unlimited departments.",
            title: `Professional tier limit: ${args.limit ?? 100} departments`,
        };
    }
    return {
        body: "Your current plan already supports unlimited active departments.",
        guidance: "No numeric department cap applies on Enterprise.",
        title: `${args.tierLabel} tier supports unlimited departments`,
    };
}
exports.buildDepartmentTierLimitModalContent = buildDepartmentTierLimitModalContent;
function buildDepartmentDeletionBlockers(args) {
    const activeDepartmentUserEmails = Array.from(new Set(args.activeDepartmentUserEmails)).sort((left, right) => left.localeCompare(right));
    const messages = [];
    if (args.hasProtectedPlans) {
        messages.push(exports.DEPARTMENT_DELETE_PLANS_MESSAGE);
    }
    if (activeDepartmentUserEmails.length > 0) {
        messages.push(exports.DEPARTMENT_DELETE_DU_MESSAGE);
    }
    return {
        activeDepartmentUserEmails,
        canDelete: messages.length === 0,
        hasProtectedPlans: args.hasProtectedPlans,
        messages,
    };
}
exports.buildDepartmentDeletionBlockers = buildDepartmentDeletionBlockers;
function summarizeDepartmentPlanningState(planStatuses) {
    if (planStatuses.includes("approved")) {
        return "Approved plan exists";
    }
    if (planStatuses.includes("submitted")) {
        return "Submitted for review";
    }
    if (planStatuses.includes("rejected")) {
        return "Revision requested";
    }
    if (planStatuses.includes("draft")) {
        return "Draft in progress";
    }
    return "No plans yet";
}
exports.summarizeDepartmentPlanningState = summarizeDepartmentPlanningState;
function buildDepartmentOverAllocationWarning(args) {
    if (typeof args.budgetCeiling !== "number") {
        return null;
    }
    const otherDepartmentTotal = args.departments.reduce((sum, department) => {
        if (args.currentDepartmentId &&
            department.id === args.currentDepartmentId) {
            return sum;
        }
        if (department.isActive === false) {
            return sum;
        }
        return sum + (department.budgetAllocation ?? 0);
    }, 0);
    const currentBudgetAllocation = typeof args.currentBudgetAllocation === "number" &&
        Number.isFinite(args.currentBudgetAllocation) &&
        args.currentBudgetAllocation > 0
        ? args.currentBudgetAllocation
        : 0;
    const totalBudget = otherDepartmentTotal + currentBudgetAllocation;
    if (totalBudget <= args.budgetCeiling) {
        return null;
    }
    const amount = totalBudget - args.budgetCeiling;
    return {
        amount,
        message: `Total department budgets exceed institution allocation by ${formatDepartmentBudget(amount)}`,
    };
}
exports.buildDepartmentOverAllocationWarning = buildDepartmentOverAllocationWarning;
function buildDepartmentWorkspaceSummary(args) {
    const activeDepartments = args.departments
        .filter((department) => department.isActive)
        .sort((left, right) => left.name.localeCompare(right.name));
    return {
        limit: buildDepartmentTierLimitState({
            activeDepartmentCount: args.activeDepartmentCount,
            tier: args.tier,
        }),
        overAllocationWarning: buildDepartmentOverAllocationWarning({
            budgetCeiling: args.budgetCeiling,
            departments: activeDepartments,
        }),
        rows: activeDepartments.map((department) => ({
            ...department,
            accessCodeStateLabel: department.hasActiveAccessCode ? "Active code" : "Setup required",
            deleteBlockers: buildDepartmentDeletionBlockers({
                activeDepartmentUserEmails: department.activeDepartmentUserEmails,
                hasProtectedPlans: department.planStatuses.some((status) => status === "approved" || status === "submitted"),
            }),
            departmentUserCount: department.activeDepartmentUserEmails.length,
            departmentUserStateLabel: department.activeDepartmentUserEmails.length > 0 ? "Assigned" : "Unassigned",
            planningStateLabel: summarizeDepartmentPlanningState(department.planStatuses),
        })),
    };
}
exports.buildDepartmentWorkspaceSummary = buildDepartmentWorkspaceSummary;
