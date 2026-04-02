import {
    Archive,
    Boxes,
    Building2,
    Cpu,
    FolderTree,
    Wrench,
    type LucideIcon,
} from "lucide-react";
import { buildDashboardPath, FORBIDDEN_ACCESS_REASON } from "../auth/roles";
import { normalizePlainText } from "../security/input";

export const CATEGORY_NAME_EXISTS_MESSAGE = "Category name already exists";
export const CATEGORY_NOT_FOUND_MESSAGE = "Category not found";
export const CATEGORY_REFRESH_REQUIRED_MESSAGE =
    "Category data changed. Refresh and try again.";
export const CATEGORY_DELETE_ITEMS_MESSAGE =
    "Remove or reassign category items before deleting this category.";
export const CATEGORY_DELETE_PLANS_MESSAGE =
    "Archive or reassign this category before deleting it from active plans.";
export const CATEGORY_ARCHIVE_GENERIC_MESSAGE =
    "We could not archive the category right now. Please try again.";
export const CATEGORY_SAVE_GENERIC_ERROR_MESSAGE =
    "We could not save the category right now. Please try again.";
export const CATEGORY_DELETE_GENERIC_ERROR_MESSAGE =
    "We could not delete the category right now. Please try again.";
export const CATEGORY_IMPORT_GENERIC_ERROR_MESSAGE =
    "We could not import the category workbook right now. Please try again.";
export const CATEGORY_NAME_REQUIRED_MESSAGE = "Category name is required";
export const CATEGORY_COLOR_INVALID_MESSAGE =
    "Category color must be a valid hex color";
export const CATEGORY_ICON_INVALID_MESSAGE =
    "Choose a supported category icon";
export const CATEGORY_DESCRIPTION_TOO_LONG_MESSAGE =
    "Description must be 500 characters or less";
export const CATEGORY_IMPORT_BLANK_NAME_MESSAGE = "Name is required";
export const CATEGORY_IMPORT_DUPLICATE_IN_FILE_MESSAGE =
    "This category name appears more than once in the workbook.";
export const CATEGORY_IMPORT_LIMIT_MESSAGE =
    "Category limit reached for this plan tier.";
export const CATEGORY_DRAFT_STORAGE_KEY = "procureline:po:category-draft";

export const CATEGORY_IMPORT_COLUMNS = ["Name", "Description", "Color"] as const;

export type CategoryTier = "enterprise" | "free" | "professional" | "starter";
export type CategoryPlanStatus = "approved" | "draft" | "rejected" | "submitted";
export type CategoryIconName =
    | "archive"
    | "boxes"
    | "building"
    | "cpu"
    | "folder"
    | "wrench";

export interface CategoryIconOption {
    description: string;
    icon: LucideIcon;
    label: string;
    value: CategoryIconName;
}

export interface CategoryTierLimitState {
    atLimit: boolean;
    limit: number | null;
    remainingSlots: number | null;
    tier: CategoryTier;
    tierLabel: string;
    upgradeHref: string;
}

export interface CategoryTierLimitModalContent {
    body: string;
    guidance: string;
    title: string;
}

export interface CategoryDeletionBlockers {
    canDelete: boolean;
    messages: string[];
}

export interface CategoryWorkspaceRecord {
    assignedItemCount: number;
    archivedAt: number | null;
    color: string | null;
    description: string | null;
    icon: CategoryIconName | null;
    id: string;
    isActive: boolean;
    itemCount: number;
    name: string;
    planStatuses: CategoryPlanStatus[];
    revision: number;
    sortOrder: number;
}

export interface CategoryWorkspaceRow extends CategoryWorkspaceRecord {
    archivedLabel: string | null;
    deleteBlockers: CategoryDeletionBlockers;
    planningStateLabel: string;
    planningImpactWarning: string | null;
}

export interface CategoryWorkspaceSummary {
    limit: CategoryTierLimitState;
    rows: CategoryWorkspaceRow[];
}

export interface StoredCategoryDraft {
    color: string | null;
    description: string | null;
    icon: CategoryIconName | null;
    id: string;
    name: string;
    revision: number;
}

const CATEGORY_ICON_OPTIONS_INTERNAL: CategoryIconOption[] = [
    {
        description: "General catalog grouping",
        icon: FolderTree,
        label: "Folder",
        value: "folder",
    },
    {
        description: "Operational tools and maintenance",
        icon: Wrench,
        label: "Tools",
        value: "wrench",
    },
    {
        description: "ICT and electronic equipment",
        icon: Cpu,
        label: "Technology",
        value: "cpu",
    },
    {
        description: "Buildings and facilities",
        icon: Building2,
        label: "Facilities",
        value: "building",
    },
    {
        description: "Stocked goods and supplies",
        icon: Boxes,
        label: "Supplies",
        value: "boxes",
    },
    {
        description: "Archived legacy grouping",
        icon: Archive,
        label: "Archive",
        value: "archive",
    },
];

const CATEGORY_TIER_LABELS: Record<CategoryTier, string> = {
    enterprise: "Enterprise",
    free: "Free",
    professional: "Professional",
    starter: "Starter",
};

const CATEGORY_TIER_LIMITS: Record<Exclude<CategoryTier, "enterprise">, number> = {
    free: 20,
    professional: 200,
    starter: 60,
};

const CATEGORY_HEX_COLOR_PATTERN = /^#([0-9A-F]{6})$/;
const CATEGORY_TIER_LIMIT_MESSAGE_PATTERN =
    /\bcategory limit reached for this plan tier\b/i;
const CATEGORY_CRUD_AUTH_RECOVERY_PATTERNS = [
    /\bprocurement officer access is required for this resource\b/i,
    /\btenant record not found\b/i,
];

export function getCategoryIconOptions(): readonly CategoryIconOption[] {
    return CATEGORY_ICON_OPTIONS_INTERNAL;
}

export function getCategoryIconOption(
    value: string | null | undefined,
): CategoryIconOption | null {
    if (!value) {
        return null;
    }

    return (
        CATEGORY_ICON_OPTIONS_INTERNAL.find((option) => option.value === value) ?? null
    );
}

export function getDefaultCategoryIconOption(): CategoryIconOption {
    return CATEGORY_ICON_OPTIONS_INTERNAL[0]!;
}

export function getCategoryUpgradeHref(): string {
    return "/pricing";
}

export function getCategoryCrudRecoveryHref(): string {
    return buildDashboardPath(FORBIDDEN_ACCESS_REASON);
}

export function normalizeCategoryName(input: string): string {
    return normalizePlainText(input).toLowerCase();
}

export function normalizeCategoryDescription(
    input: string | null | undefined,
): string | undefined {
    const normalized = normalizePlainText(input ?? "");
    return normalized.length > 0 ? normalized : undefined;
}

export function normalizeCategoryColor(
    input: string | null | undefined,
): string | undefined {
    const normalized = normalizePlainText(input ?? "").toUpperCase();
    if (normalized.length === 0) {
        return undefined;
    }

    const prefixed = normalized.startsWith("#") ? normalized : `#${normalized}`;
    return CATEGORY_HEX_COLOR_PATTERN.test(prefixed) ? prefixed : undefined;
}

export function isValidCategoryColor(input: string | null | undefined): boolean {
    return normalizeCategoryColor(input) !== undefined;
}

export function normalizeCategoryIcon(
    input: string | null | undefined,
): CategoryIconName | undefined {
    const normalized = normalizePlainText(input ?? "").toLowerCase();
    if (normalized.length === 0) {
        return undefined;
    }

    return (
        CATEGORY_ICON_OPTIONS_INTERNAL.find((option) => option.value === normalized)?.value ??
        undefined
    );
}

export function getComparableCategoryRevision(revision: number | null | undefined): number {
    if (!Number.isFinite(revision) || typeof revision !== "number") {
        return 0;
    }

    return revision;
}

export function buildCategoryTierLimitState(args: {
    activeCategoryCount: number;
    tier: CategoryTier;
}): CategoryTierLimitState {
    const limit = args.tier === "enterprise" ? null : CATEGORY_TIER_LIMITS[args.tier];

    return {
        atLimit: limit !== null && args.activeCategoryCount >= limit,
        limit,
        remainingSlots: limit === null ? null : Math.max(limit - args.activeCategoryCount, 0),
        tier: args.tier,
        tierLabel: CATEGORY_TIER_LABELS[args.tier],
        upgradeHref: getCategoryUpgradeHref(),
    };
}

export function buildCategoryTierLimitModalContent(
    args: Pick<CategoryTierLimitState, "limit" | "tier" | "tierLabel">,
): CategoryTierLimitModalContent {
    if (args.tier === "free") {
        return {
            body: "Archive an unused category or upgrade to keep growing your catalog.",
            guidance: "Upgrade to Starter (60 categories) or Professional (200 categories).",
            title: `Free tier limit: ${args.limit ?? 20} categories`,
        };
    }

    if (args.tier === "starter") {
        return {
            body: "Archive an unused category or upgrade to keep growing your catalog.",
            guidance:
                "Upgrade to Professional (200 categories) or Enterprise (unlimited).",
            title: `Starter tier limit: ${args.limit ?? 60} categories`,
        };
    }

    if (args.tier === "professional") {
        return {
            body: "Archive an unused category or upgrade to keep growing your catalog.",
            guidance: "Upgrade to Enterprise for unlimited categories.",
            title: `Professional tier limit: ${args.limit ?? 200} categories`,
        };
    }

    return {
        body: "Your current plan already supports unlimited active categories.",
        guidance: "No numeric category cap applies on Enterprise.",
        title: `${args.tierLabel} tier supports unlimited categories`,
    };
}

export function summarizeCategoryPlanningState(
    planStatuses: readonly CategoryPlanStatus[],
): string {
    if (planStatuses.includes("approved")) {
        return "Referenced by approved plan";
    }

    if (planStatuses.includes("submitted")) {
        return "Referenced by submitted plan";
    }

    if (planStatuses.includes("rejected")) {
        return "Referenced by rejected plan";
    }

    if (planStatuses.includes("draft")) {
        return "Referenced by draft plan";
    }

    return "No plans yet";
}

export function buildCategoryDeletionBlockers(args: {
    assignedItemCount: number;
    planStatuses: readonly CategoryPlanStatus[];
}): CategoryDeletionBlockers {
    const messages: string[] = [];

    if (args.assignedItemCount > 0) {
        messages.push(CATEGORY_DELETE_ITEMS_MESSAGE);
    }

    if (args.planStatuses.length > 0) {
        messages.push(CATEGORY_DELETE_PLANS_MESSAGE);
    }

    return {
        canDelete: messages.length === 0,
        messages,
    };
}

export function buildCategoryWorkspaceSummary(args: {
    categories: readonly CategoryWorkspaceRecord[];
    tier: CategoryTier;
}): CategoryWorkspaceSummary {
    const rows = [...args.categories]
        .sort((left, right) => {
            if (left.isActive !== right.isActive) {
                return left.isActive ? -1 : 1;
            }

            return (
                left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
            );
        })
        .map((category) => ({
            ...category,
            archivedLabel:
                category.isActive || category.archivedAt === null ? null : "Archived",
            deleteBlockers: buildCategoryDeletionBlockers({
                assignedItemCount: category.assignedItemCount,
                planStatuses: category.planStatuses,
            }),
            planningImpactWarning:
                category.planStatuses.length > 0
                    ? "Editing this category affects current plan references."
                    : null,
            planningStateLabel: summarizeCategoryPlanningState(category.planStatuses),
        }));

    return {
        limit: buildCategoryTierLimitState({
            activeCategoryCount: rows.filter((row) => row.isActive).length,
            tier: args.tier,
        }),
        rows,
    };
}

export function buildCategoryToolboxStyle(args: {
    color?: string | null;
    icon?: CategoryIconName | null;
}): {
    colour: string;
    cssConfig: {
        container: string;
        icon: string;
        label: string;
    };
    preview: {
        color: string;
        icon: CategoryIconName;
    };
} {
    const color = normalizeCategoryColor(args.color) ?? "#4A90D9";
    const icon = normalizeCategoryIcon(args.icon) ?? "folder";

    return {
        colour: color,
        cssConfig: {
            container: `pl-toolbox-category pl-toolbox-category--${icon}`,
            icon: "pl-toolbox-category__icon",
            label: "pl-toolbox-category__label",
        },
        preview: {
            color,
            icon,
        },
    };
}

export function hasMeaningfulCategoryDraftValues(args: {
    color?: string | null;
    description?: string | null;
    icon?: string | null;
    name?: string | null;
}): boolean {
    return (
        normalizePlainText(args.name ?? "").length > 0 ||
        normalizePlainText(args.description ?? "").length > 0 ||
        normalizePlainText(args.color ?? "").length > 0 ||
        normalizePlainText(args.icon ?? "").length > 0
    );
}

export function parseStoredCategoryDraft(
    raw: string | null | undefined,
): StoredCategoryDraft | null {
    if (!raw) {
        return null;
    }

    try {
        const record = JSON.parse(raw) as Record<string, unknown>;
        const color =
            typeof record.color === "string" && normalizePlainText(record.color).length > 0
                ? record.color
                : null;
        const description =
            typeof record.description === "string" &&
            normalizePlainText(record.description).length > 0
                ? record.description
                : null;
        return {
            color,
            description,
            icon: normalizeCategoryIcon(
                typeof record.icon === "string" ? record.icon : null,
            ) ?? null,
            id: typeof record.id === "string" ? record.id : "",
            name: typeof record.name === "string" ? record.name : "",
            revision:
                typeof record.revision === "number" && Number.isFinite(record.revision)
                    ? record.revision
                    : 0,
        };
    } catch {
        return null;
    }
}

export function hasStoredCategoryDraft(raw: string | null | undefined): boolean {
    const draft = parseStoredCategoryDraft(raw);
    if (!draft) {
        return false;
    }

    return hasMeaningfulCategoryDraftValues(draft);
}

export function getCategoryImportRowFailure(args: {
    activeCategoryCount: number;
    activeNameSet: ReadonlySet<string>;
    colorInput: string;
    createdCount: number;
    description: string;
    limit: number | null;
    name: string;
    normalizedName: string;
    seenInFile: ReadonlySet<string>;
}): string | null {
    if (args.name.length === 0) {
        return CATEGORY_IMPORT_BLANK_NAME_MESSAGE;
    }

    if (args.seenInFile.has(args.normalizedName)) {
        return CATEGORY_IMPORT_DUPLICATE_IN_FILE_MESSAGE;
    }

    if (args.activeNameSet.has(args.normalizedName)) {
        return CATEGORY_NAME_EXISTS_MESSAGE;
    }

    const normalizedColor = normalizeCategoryColor(args.colorInput);
    if (args.colorInput.length > 0 && !normalizedColor) {
        return CATEGORY_COLOR_INVALID_MESSAGE;
    }

    if (args.description.length > 500) {
        return CATEGORY_DESCRIPTION_TOO_LONG_MESSAGE;
    }

    if (
        args.limit !== null &&
        args.activeCategoryCount + args.createdCount >= args.limit
    ) {
        return CATEGORY_IMPORT_LIMIT_MESSAGE;
    }

    return null;
}

export function getCategoryCrudErrorMessage(error: unknown): string {
    const message =
        error instanceof Error && error.message.trim().length > 0
            ? error.message.trim()
            : null;

    if (!message) {
        return CATEGORY_SAVE_GENERIC_ERROR_MESSAGE;
    }

    if (
        [
            CATEGORY_COLOR_INVALID_MESSAGE,
            CATEGORY_DELETE_ITEMS_MESSAGE,
            CATEGORY_DELETE_PLANS_MESSAGE,
            CATEGORY_DESCRIPTION_TOO_LONG_MESSAGE,
            CATEGORY_ICON_INVALID_MESSAGE,
            CATEGORY_NAME_EXISTS_MESSAGE,
            CATEGORY_NAME_REQUIRED_MESSAGE,
            CATEGORY_NOT_FOUND_MESSAGE,
            CATEGORY_REFRESH_REQUIRED_MESSAGE,
        ].includes(message)
    ) {
        return message;
    }

    if (isCategoryTierLimitMessage(message)) {
        return message;
    }

    return CATEGORY_SAVE_GENERIC_ERROR_MESSAGE;
}

export function isCategoryTierLimitMessage(message: string | null): boolean {
    return message ? CATEGORY_TIER_LIMIT_MESSAGE_PATTERN.test(message) : false;
}

export function isCategoryCrudAuthorizationError(error: unknown): boolean {
    const message =
        error instanceof Error && error.message.trim().length > 0
            ? error.message.trim()
            : null;

    if (!message) {
        return false;
    }

    return CATEGORY_CRUD_AUTH_RECOVERY_PATTERNS.some((pattern) =>
        pattern.test(message),
    );
}

export function createCategoryTemplateRows(): Array<Record<(typeof CATEGORY_IMPORT_COLUMNS)[number], string>> {
    return [
        {
            Color: "",
            Description: "",
            Name: "",
        },
    ];
}
