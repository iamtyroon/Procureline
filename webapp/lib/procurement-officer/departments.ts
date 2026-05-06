import { z } from "zod";
import {
    buildDashboardPath,
    FORBIDDEN_ACCESS_REASON,
} from "../shared/auth/roles";
import {
    normalizeAuthEmail,
    normalizePlainText,
    validateEmailInput,
} from "../shared/security/input";
import {
    ACCESS_CODE_FORMAT_MESSAGE,
    CANONICAL_ACCESS_CODE_MAX_LENGTH,
    normalizeCanonicalDepartmentAccessCode,
    validateCanonicalDepartmentAccessCode,
} from "./access-codes";

export const DEPARTMENT_CODE_MAX_LENGTH = CANONICAL_ACCESS_CODE_MAX_LENGTH;
export const DEPARTMENT_CODE_EXISTS_MESSAGE = "Department code already exists";
export const DEPARTMENT_NAME_EXISTS_MESSAGE = "Department name already exists";
export const DEPARTMENT_VOTE_NUMBER_EXISTS_MESSAGE =
    "Vote number already exists";
export const DEPARTMENT_BUDGET_POSITIVE_MESSAGE = "Budget must be a positive number";
export const DEPARTMENT_NOT_FOUND_MESSAGE = "Department not found";
export const DEPARTMENT_HARD_DELETE_ACTIVE_MESSAGE =
    "Archive the department before permanently deleting it.";
export const DEPARTMENT_HARD_DELETE_GENERIC_ERROR_MESSAGE =
    "We could not permanently delete the department right now. Please try again.";
export const DEPARTMENT_DELETE_PLANS_MESSAGE =
    "Cannot delete department with submitted plans";
export const DEPARTMENT_DELETE_DU_MESSAGE =
    "Assigned Departmental Users and active department codes will be deactivated when this department is deleted.";
export const DEPARTMENT_DEADLINE_NOT_CONFIGURED_MESSAGE =
    "Configure the shared submission deadline before extending one department.";
export const DEPARTMENT_DEADLINE_EXTENSION_PAST_MESSAGE =
    "Choose a new expiry date in the future.";
export const DEPARTMENT_DEADLINE_EXTENSION_ORDER_MESSAGE =
    "New expiry date must be after the current department expiry.";
export const DEPARTMENT_CODE_EMAIL_AFTER_CREATE_MESSAGE =
    "Create the department first, then send the department code.";
export const DEPARTMENT_SAVE_GENERIC_ERROR_MESSAGE =
    "We could not save the department right now. Please try again.";
export const DEPARTMENT_DELETE_GENERIC_ERROR_MESSAGE =
    "We could not delete the department right now. Please try again.";
export const DEPARTMENT_SETUP_REQUIRED_MESSAGE =
    "Department setup is incomplete. Contact your Procurement Officer.";

export type DepartmentTier = "enterprise" | "free" | "professional" | "starter";
export type DepartmentPlanStatus = "approved" | "draft" | "rejected" | "submitted";

export interface DepartmentCodeValidationResult {
    message: string;
    ok: boolean;
}

export interface DepartmentTierLimitState {
    atLimit: boolean;
    limit: number | null;
    remainingSlots: number | null;
    tier: DepartmentTier;
    tierLabel: string;
    upgradeHref: string;
}

export interface DepartmentTierLimitModalContent {
    body: string;
    guidance: string;
    title: string;
}

export interface DepartmentDeletionBlockers {
    activeDepartmentUserEmails: string[];
    canDelete: boolean;
    hasProtectedPlans: boolean;
    messages: string[];
}

export interface DepartmentWorkspaceRecord {
    activeDepartmentUserEmails: string[];
    budgetAllocation: number | null;
    code: string;
    hasActiveAccessCode: boolean;
    id: string;
    isActive: boolean;
    lastUpdatedAt: number;
    name: string;
    planStatuses: DepartmentPlanStatus[];
    voteNumber: string;
}

export interface DepartmentWorkspaceRow extends DepartmentWorkspaceRecord {
    accessCodeStateLabel: string;
    deleteBlockers: DepartmentDeletionBlockers;
    departmentUserCount: number;
    departmentUserStateLabel: string;
    planningStateLabel: string;
}

export interface DepartmentWorkspaceSummary {
    limit: DepartmentTierLimitState;
    overAllocationWarning: null | {
        amount: number;
        message: string;
    };
    rows: DepartmentWorkspaceRow[];
}

export const DEPARTMENT_NAME_REQUIRED_MESSAGE = "Department name is required";
export const DEPARTMENT_CODE_REQUIRED_MESSAGE = "Department code is required";
export const DEPARTMENT_VOTE_NUMBER_REQUIRED_MESSAGE =
    "Vote number is required";
export const DEPARTMENT_CODE_FORMAT_MESSAGE = ACCESS_CODE_FORMAT_MESSAGE;

const TIER_LABELS: Record<DepartmentTier, string> = {
    enterprise: "Enterprise",
    free: "Free",
    professional: "Professional",
    starter: "Starter",
};

const TIER_LIMITS: Record<Exclude<DepartmentTier, "enterprise">, number> = {
    free: 10,
    professional: 100,
    starter: 30,
};

const DEPARTMENT_TIER_LIMIT_MESSAGE_PATTERN =
    /\b(free|starter|professional)\b tier supports up to \d+ active departments\./i;
const DEPARTMENT_CRUD_AUTH_RECOVERY_PATTERNS = [
    /\bprocurement officer access is required for this resource\b/i,
    /\btenant record not found\b/i,
] as const;

export function normalizeDepartmentName(input: string): string {
    return normalizePlainText(input).toLowerCase();
}

export function normalizeDepartmentCode(input: string): string {
    return normalizeCanonicalDepartmentAccessCode(input);
}

export function normalizeDepartmentVoteNumber(input: string): string {
    return normalizePlainText(input).toUpperCase();
}

export function validateDepartmentCode(code: string): DepartmentCodeValidationResult {
    return validateCanonicalDepartmentAccessCode(code);
}

export const departmentFormSchema = z
    .object({
        adminEmail: z.string().optional(),
        budgetAllocation: z.coerce.number(),
        code: z.string(),
        name: z.string(),
        voteNumber: z.string(),
    })
    .superRefine((value, ctx) => {
        const adminEmail = normalizeAuthEmail(value.adminEmail ?? "");
        const normalizedName = normalizeDepartmentName(value.name);
        const normalizedCode = normalizeDepartmentCode(value.code);
        const normalizedVoteNumber = normalizeDepartmentVoteNumber(value.voteNumber);
        const codeValidation = validateDepartmentCode(normalizedCode);

        if (adminEmail.length > 0) {
            const emailValidation = validateEmailInput(adminEmail, "adminEmail");
            if (!emailValidation.ok) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: emailValidation.issue.message,
                    path: ["adminEmail"],
                });
            }
        }

        if (normalizedName.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: DEPARTMENT_NAME_REQUIRED_MESSAGE,
                path: ["name"],
            });
        }

        if (normalizedVoteNumber.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: DEPARTMENT_VOTE_NUMBER_REQUIRED_MESSAGE,
                path: ["voteNumber"],
            });
        }

        if (normalizedCode.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: DEPARTMENT_CODE_REQUIRED_MESSAGE,
                path: ["code"],
            });
        } else if (!codeValidation.ok) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: codeValidation.message,
                path: ["code"],
            });
        }

        if (
            !Number.isFinite(value.budgetAllocation) ||
            Number.isNaN(value.budgetAllocation) ||
            value.budgetAllocation <= 0
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: DEPARTMENT_BUDGET_POSITIVE_MESSAGE,
                path: ["budgetAllocation"],
            });
        }
    })
    .transform((value) => {
        const adminEmail = normalizeAuthEmail(value.adminEmail ?? "");
        const code = normalizeDepartmentCode(value.code);
        const name = normalizePlainText(value.name);
        const voteNumber = normalizeDepartmentVoteNumber(value.voteNumber);

        return {
            adminEmail: adminEmail.length > 0 ? adminEmail : undefined,
            budgetAllocation: value.budgetAllocation,
            code,
            name,
            normalizedCode: code,
            normalizedName: normalizeDepartmentName(name),
            normalizedVoteNumber: voteNumber,
            voteNumber,
        };
    });

export type DepartmentFormData = z.infer<typeof departmentFormSchema>;

export function getDepartmentCodeFieldDescription(args: {
    isCreateMode: boolean;
}): string {
    return args.isCreateMode
        ? "Generate the department code now, or enter one manually before creating the department."
        : "Update the department code here if the Department User sign-in identifier changes. Generate a new canonical code or enter one manually.";
}

export function formatDepartmentBudget(amount: number): string {
    return `KES ${amount.toLocaleString("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
    })}`;
}

export function getDepartmentUpgradeHref(): string {
    return "/pricing";
}

export function getDepartmentCrudRecoveryHref(): string {
    return buildDashboardPath(FORBIDDEN_ACCESS_REASON);
}

export function isDepartmentTierLimitMessage(message: string | null): boolean {
    return message ? DEPARTMENT_TIER_LIMIT_MESSAGE_PATTERN.test(message) : false;
}

export function getDepartmentCrudErrorMessage(error: unknown): string {
    const message =
        error instanceof Error && error.message.trim().length > 0
            ? error.message.trim()
            : null;

    if (!message) {
        return DEPARTMENT_SAVE_GENERIC_ERROR_MESSAGE;
    }

    if (
        [
            DEPARTMENT_BUDGET_POSITIVE_MESSAGE,
            DEPARTMENT_CODE_FORMAT_MESSAGE,
            DEPARTMENT_CODE_EXISTS_MESSAGE,
            DEPARTMENT_CODE_REQUIRED_MESSAGE,
            DEPARTMENT_DELETE_DU_MESSAGE,
            DEPARTMENT_DELETE_PLANS_MESSAGE,
            DEPARTMENT_DEADLINE_EXTENSION_ORDER_MESSAGE,
            DEPARTMENT_DEADLINE_EXTENSION_PAST_MESSAGE,
            DEPARTMENT_DEADLINE_NOT_CONFIGURED_MESSAGE,
            DEPARTMENT_HARD_DELETE_ACTIVE_MESSAGE,
            DEPARTMENT_NAME_EXISTS_MESSAGE,
            DEPARTMENT_NAME_REQUIRED_MESSAGE,
            DEPARTMENT_NOT_FOUND_MESSAGE,
            DEPARTMENT_VOTE_NUMBER_EXISTS_MESSAGE,
            DEPARTMENT_VOTE_NUMBER_REQUIRED_MESSAGE,
        ].includes(message)
    ) {
        return message;
    }

    if (isDepartmentTierLimitMessage(message)) {
        return message;
    }

    return DEPARTMENT_SAVE_GENERIC_ERROR_MESSAGE;
}

export function isDepartmentCrudAuthorizationError(error: unknown): boolean {
    const message =
        error instanceof Error && error.message.trim().length > 0
            ? error.message.trim()
            : null;

    if (!message) {
        return false;
    }

    return DEPARTMENT_CRUD_AUTH_RECOVERY_PATTERNS.some((pattern) =>
        pattern.test(message),
    );
}

export function buildDepartmentTierLimitState(args: {
    activeDepartmentCount: number;
    tier: DepartmentTier;
}): DepartmentTierLimitState {
    const limit: number | null =
        args.tier === "enterprise" ? null : TIER_LIMITS[args.tier];
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

export function buildDepartmentTierLimitModalContent(
    args: Pick<DepartmentTierLimitState, "limit" | "tier" | "tierLabel">,
): DepartmentTierLimitModalContent {
    if (args.tier === "free") {
        return {
            body: "Archive an existing department or upgrade to keep adding departments.",
            guidance:
                "Upgrade to Starter (30 departments) or Professional (100 departments).",
            title: `Free tier limit: ${args.limit ?? 10} departments`,
        };
    }

    if (args.tier === "starter") {
        return {
            body: "Archive an existing department or upgrade to keep adding departments.",
            guidance:
                "Upgrade to Professional (100 departments) or Enterprise (unlimited).",
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

export function buildDepartmentDeletionBlockers(args: {
    activeDepartmentUserEmails: string[];
    hasProtectedPlans: boolean;
}): DepartmentDeletionBlockers {
    const activeDepartmentUserEmails = Array.from(
        new Set(args.activeDepartmentUserEmails),
    ).sort((left, right) => left.localeCompare(right));
    const messages: string[] = [];

    if (args.hasProtectedPlans) {
        messages.push(DEPARTMENT_DELETE_PLANS_MESSAGE);
    }

    if (activeDepartmentUserEmails.length > 0 && !args.hasProtectedPlans) {
        messages.push(DEPARTMENT_DELETE_DU_MESSAGE);
    }

    return {
        activeDepartmentUserEmails,
        canDelete: !args.hasProtectedPlans,
        hasProtectedPlans: args.hasProtectedPlans,
        messages,
    };
}

export function summarizeDepartmentPlanningState(
    planStatuses: readonly DepartmentPlanStatus[],
): string {
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

export function buildDepartmentOverAllocationWarning(args: {
    budgetCeiling: number | null;
    currentBudgetAllocation?: number | null;
    currentDepartmentId?: string | null;
    departments: ReadonlyArray<{
        budgetAllocation: number | null;
        id: string;
        isActive?: boolean;
    }>;
}): DepartmentWorkspaceSummary["overAllocationWarning"] {
    if (typeof args.budgetCeiling !== "number") {
        return null;
    }

    const otherDepartmentTotal = args.departments.reduce((sum, department) => {
        if (
            args.currentDepartmentId &&
            department.id === args.currentDepartmentId
        ) {
            return sum;
        }

        if (department.isActive === false) {
            return sum;
        }

        return sum + (department.budgetAllocation ?? 0);
    }, 0);
    const currentBudgetAllocation =
        typeof args.currentBudgetAllocation === "number" &&
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
        message: `Total department budgets exceed institution allocation by ${formatDepartmentBudget(
            amount,
        )}`,
    };
}

export function buildDepartmentWorkspaceSummary(args: {
    activeDepartmentCount: number;
    budgetCeiling: number | null;
    departments: readonly DepartmentWorkspaceRecord[];
    now: number;
    tier: DepartmentTier;
}): DepartmentWorkspaceSummary {
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
                hasProtectedPlans: department.planStatuses.some(
                    (status) => status === "approved" || status === "submitted",
                ),
            }),
            departmentUserCount: department.activeDepartmentUserEmails.length,
            departmentUserStateLabel:
                department.activeDepartmentUserEmails.length > 0 ? "Assigned" : "Unassigned",
            planningStateLabel: summarizeDepartmentPlanningState(department.planStatuses),
        })),
    };
}
