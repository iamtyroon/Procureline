"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCategoryTemplateRows = exports.isCategoryCrudAuthorizationError = exports.isCategoryTierLimitMessage = exports.getCategoryCrudErrorMessage = exports.getCategoryImportRowFailure = exports.hasStoredCategoryDraft = exports.parseStoredCategoryDraft = exports.hasMeaningfulCategoryDraftValues = exports.buildCategoryToolboxStyle = exports.buildCategoryWorkspaceSummary = exports.buildCategoryDeletionBlockers = exports.summarizeCategoryPlanningState = exports.buildCategoryTierLimitModalContent = exports.buildCategoryTierLimitState = exports.getComparableCategoryRevision = exports.normalizeCategoryIcon = exports.isValidCategoryColor = exports.normalizeCategoryColor = exports.normalizeCategoryDescription = exports.normalizeCategoryName = exports.getCategoryCrudRecoveryHref = exports.getCategoryUpgradeHref = exports.getDefaultCategoryIconOption = exports.getCategoryIconOption = exports.getCategoryIconOptions = exports.CATEGORY_IMPORT_COLUMNS = exports.CATEGORY_DRAFT_STORAGE_KEY = exports.CATEGORY_IMPORT_LIMIT_MESSAGE = exports.CATEGORY_IMPORT_DUPLICATE_IN_FILE_MESSAGE = exports.CATEGORY_IMPORT_BLANK_NAME_MESSAGE = exports.CATEGORY_DESCRIPTION_TOO_LONG_MESSAGE = exports.CATEGORY_ICON_INVALID_MESSAGE = exports.CATEGORY_COLOR_INVALID_MESSAGE = exports.CATEGORY_NAME_REQUIRED_MESSAGE = exports.CATEGORY_IMPORT_GENERIC_ERROR_MESSAGE = exports.CATEGORY_DELETE_GENERIC_ERROR_MESSAGE = exports.CATEGORY_SAVE_GENERIC_ERROR_MESSAGE = exports.CATEGORY_ARCHIVE_GENERIC_MESSAGE = exports.CATEGORY_DELETE_PLANS_MESSAGE = exports.CATEGORY_DELETE_ITEMS_MESSAGE = exports.CATEGORY_REFRESH_REQUIRED_MESSAGE = exports.CATEGORY_NOT_FOUND_MESSAGE = exports.CATEGORY_NAME_EXISTS_MESSAGE = void 0;
const lucide_react_1 = require("lucide-react");
const roles_1 = require("../shared/auth/roles");
const input_1 = require("../shared/security/input");
exports.CATEGORY_NAME_EXISTS_MESSAGE = "Category name already exists";
exports.CATEGORY_NOT_FOUND_MESSAGE = "Category not found";
exports.CATEGORY_REFRESH_REQUIRED_MESSAGE = "Category data changed. Refresh and try again.";
exports.CATEGORY_DELETE_ITEMS_MESSAGE = "Remove or reassign category items before deleting this category.";
exports.CATEGORY_DELETE_PLANS_MESSAGE = "Archive or reassign this category before deleting it from active plans.";
exports.CATEGORY_ARCHIVE_GENERIC_MESSAGE = "We could not archive the category right now. Please try again.";
exports.CATEGORY_SAVE_GENERIC_ERROR_MESSAGE = "We could not save the category right now. Please try again.";
exports.CATEGORY_DELETE_GENERIC_ERROR_MESSAGE = "We could not delete the category right now. Please try again.";
exports.CATEGORY_IMPORT_GENERIC_ERROR_MESSAGE = "We could not import the category workbook right now. Please try again.";
exports.CATEGORY_NAME_REQUIRED_MESSAGE = "Category name is required";
exports.CATEGORY_COLOR_INVALID_MESSAGE = "Category color must be a valid hex color";
exports.CATEGORY_ICON_INVALID_MESSAGE = "Choose a supported category icon";
exports.CATEGORY_DESCRIPTION_TOO_LONG_MESSAGE = "Description must be 500 characters or less";
exports.CATEGORY_IMPORT_BLANK_NAME_MESSAGE = "Name is required";
exports.CATEGORY_IMPORT_DUPLICATE_IN_FILE_MESSAGE = "This category name appears more than once in the workbook.";
exports.CATEGORY_IMPORT_LIMIT_MESSAGE = "Category limit reached for this plan tier.";
exports.CATEGORY_DRAFT_STORAGE_KEY = "procureline:po:category-draft";
exports.CATEGORY_IMPORT_COLUMNS = ["Name", "Description", "Color"];
const CATEGORY_ICON_OPTIONS_INTERNAL = [
    {
        description: "General catalog grouping",
        icon: lucide_react_1.FolderTree,
        label: "Folder",
        value: "folder",
    },
    {
        description: "Operational tools and maintenance",
        icon: lucide_react_1.Wrench,
        label: "Tools",
        value: "wrench",
    },
    {
        description: "ICT and electronic equipment",
        icon: lucide_react_1.Cpu,
        label: "Technology",
        value: "cpu",
    },
    {
        description: "Buildings and facilities",
        icon: lucide_react_1.Building2,
        label: "Facilities",
        value: "building",
    },
    {
        description: "Stocked goods and supplies",
        icon: lucide_react_1.Boxes,
        label: "Supplies",
        value: "boxes",
    },
    {
        description: "Archived legacy grouping",
        icon: lucide_react_1.Archive,
        label: "Archive",
        value: "archive",
    },
];
const CATEGORY_TIER_LABELS = {
    enterprise: "Enterprise",
    free: "Free",
    professional: "Professional",
    starter: "Starter",
};
const CATEGORY_TIER_LIMITS = {
    free: 20,
    professional: 200,
    starter: 60,
};
const CATEGORY_HEX_COLOR_PATTERN = /^#([0-9A-F]{6})$/;
const CATEGORY_TIER_LIMIT_MESSAGE_PATTERN = /\bcategory limit reached for this plan tier\b/i;
const CATEGORY_CRUD_AUTH_RECOVERY_PATTERNS = [
    /\bprocurement officer access is required for this resource\b/i,
    /\btenant record not found\b/i,
];
function getCategoryIconOptions() {
    return CATEGORY_ICON_OPTIONS_INTERNAL;
}
exports.getCategoryIconOptions = getCategoryIconOptions;
function getCategoryIconOption(value) {
    if (!value) {
        return null;
    }
    return (CATEGORY_ICON_OPTIONS_INTERNAL.find((option) => option.value === value) ?? null);
}
exports.getCategoryIconOption = getCategoryIconOption;
function getDefaultCategoryIconOption() {
    return CATEGORY_ICON_OPTIONS_INTERNAL[0];
}
exports.getDefaultCategoryIconOption = getDefaultCategoryIconOption;
function getCategoryUpgradeHref() {
    return "/pricing";
}
exports.getCategoryUpgradeHref = getCategoryUpgradeHref;
function getCategoryCrudRecoveryHref() {
    return (0, roles_1.buildDashboardPath)(roles_1.FORBIDDEN_ACCESS_REASON);
}
exports.getCategoryCrudRecoveryHref = getCategoryCrudRecoveryHref;
function normalizeCategoryName(input) {
    return (0, input_1.normalizePlainText)(input).toLowerCase();
}
exports.normalizeCategoryName = normalizeCategoryName;
function normalizeCategoryDescription(input) {
    const normalized = (0, input_1.normalizePlainText)(input ?? "");
    return normalized.length > 0 ? normalized : undefined;
}
exports.normalizeCategoryDescription = normalizeCategoryDescription;
function normalizeCategoryColor(input) {
    const normalized = (0, input_1.normalizePlainText)(input ?? "").toUpperCase();
    if (normalized.length === 0) {
        return undefined;
    }
    const prefixed = normalized.startsWith("#") ? normalized : `#${normalized}`;
    return CATEGORY_HEX_COLOR_PATTERN.test(prefixed) ? prefixed : undefined;
}
exports.normalizeCategoryColor = normalizeCategoryColor;
function isValidCategoryColor(input) {
    return normalizeCategoryColor(input) !== undefined;
}
exports.isValidCategoryColor = isValidCategoryColor;
function normalizeCategoryIcon(input) {
    const normalized = (0, input_1.normalizePlainText)(input ?? "").toLowerCase();
    if (normalized.length === 0) {
        return undefined;
    }
    return (CATEGORY_ICON_OPTIONS_INTERNAL.find((option) => option.value === normalized)?.value ??
        undefined);
}
exports.normalizeCategoryIcon = normalizeCategoryIcon;
function getComparableCategoryRevision(revision) {
    if (!Number.isFinite(revision) || typeof revision !== "number") {
        return 0;
    }
    return revision;
}
exports.getComparableCategoryRevision = getComparableCategoryRevision;
function buildCategoryTierLimitState(args) {
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
exports.buildCategoryTierLimitState = buildCategoryTierLimitState;
function buildCategoryTierLimitModalContent(args) {
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
            guidance: "Upgrade to Professional (200 categories) or Enterprise (unlimited).",
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
exports.buildCategoryTierLimitModalContent = buildCategoryTierLimitModalContent;
function summarizeCategoryPlanningState(planStatuses) {
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
exports.summarizeCategoryPlanningState = summarizeCategoryPlanningState;
function buildCategoryDeletionBlockers(args) {
    const messages = [];
    if (args.assignedItemCount > 0) {
        messages.push(exports.CATEGORY_DELETE_ITEMS_MESSAGE);
    }
    if (args.planStatuses.length > 0) {
        messages.push(exports.CATEGORY_DELETE_PLANS_MESSAGE);
    }
    return {
        canDelete: messages.length === 0,
        messages,
    };
}
exports.buildCategoryDeletionBlockers = buildCategoryDeletionBlockers;
function buildCategoryWorkspaceSummary(args) {
    const rows = [...args.categories]
        .sort((left, right) => {
        if (left.isActive !== right.isActive) {
            return left.isActive ? -1 : 1;
        }
        return (left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
    })
        .map((category) => ({
        ...category,
        archivedLabel: category.isActive || category.archivedAt === null ? null : "Archived",
        deleteBlockers: buildCategoryDeletionBlockers({
            assignedItemCount: category.assignedItemCount,
            planStatuses: category.planStatuses,
        }),
        planningImpactWarning: category.planStatuses.length > 0
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
exports.buildCategoryWorkspaceSummary = buildCategoryWorkspaceSummary;
function buildCategoryToolboxStyle(args) {
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
exports.buildCategoryToolboxStyle = buildCategoryToolboxStyle;
function hasMeaningfulCategoryDraftValues(args) {
    return ((0, input_1.normalizePlainText)(args.name ?? "").length > 0 ||
        (0, input_1.normalizePlainText)(args.description ?? "").length > 0 ||
        (0, input_1.normalizePlainText)(args.color ?? "").length > 0 ||
        (0, input_1.normalizePlainText)(args.icon ?? "").length > 0);
}
exports.hasMeaningfulCategoryDraftValues = hasMeaningfulCategoryDraftValues;
function parseStoredCategoryDraft(raw) {
    if (!raw) {
        return null;
    }
    try {
        const record = JSON.parse(raw);
        const color = typeof record.color === "string" && (0, input_1.normalizePlainText)(record.color).length > 0
            ? record.color
            : null;
        const description = typeof record.description === "string" &&
            (0, input_1.normalizePlainText)(record.description).length > 0
            ? record.description
            : null;
        return {
            color,
            description,
            icon: normalizeCategoryIcon(typeof record.icon === "string" ? record.icon : null) ?? null,
            id: typeof record.id === "string" ? record.id : "",
            name: typeof record.name === "string" ? record.name : "",
            revision: typeof record.revision === "number" && Number.isFinite(record.revision)
                ? record.revision
                : 0,
        };
    }
    catch {
        return null;
    }
}
exports.parseStoredCategoryDraft = parseStoredCategoryDraft;
function hasStoredCategoryDraft(raw) {
    const draft = parseStoredCategoryDraft(raw);
    if (!draft) {
        return false;
    }
    return hasMeaningfulCategoryDraftValues(draft);
}
exports.hasStoredCategoryDraft = hasStoredCategoryDraft;
function getCategoryImportRowFailure(args) {
    if (args.name.length === 0) {
        return exports.CATEGORY_IMPORT_BLANK_NAME_MESSAGE;
    }
    if (args.seenInFile.has(args.normalizedName)) {
        return exports.CATEGORY_IMPORT_DUPLICATE_IN_FILE_MESSAGE;
    }
    if (args.activeNameSet.has(args.normalizedName)) {
        return exports.CATEGORY_NAME_EXISTS_MESSAGE;
    }
    const normalizedColor = normalizeCategoryColor(args.colorInput);
    if (args.colorInput.length > 0 && !normalizedColor) {
        return exports.CATEGORY_COLOR_INVALID_MESSAGE;
    }
    if (args.description.length > 500) {
        return exports.CATEGORY_DESCRIPTION_TOO_LONG_MESSAGE;
    }
    if (args.limit !== null &&
        args.activeCategoryCount + args.createdCount >= args.limit) {
        return exports.CATEGORY_IMPORT_LIMIT_MESSAGE;
    }
    return null;
}
exports.getCategoryImportRowFailure = getCategoryImportRowFailure;
function getCategoryCrudErrorMessage(error) {
    const message = error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : null;
    if (!message) {
        return exports.CATEGORY_SAVE_GENERIC_ERROR_MESSAGE;
    }
    if ([
        exports.CATEGORY_COLOR_INVALID_MESSAGE,
        exports.CATEGORY_DELETE_ITEMS_MESSAGE,
        exports.CATEGORY_DELETE_PLANS_MESSAGE,
        exports.CATEGORY_DESCRIPTION_TOO_LONG_MESSAGE,
        exports.CATEGORY_ICON_INVALID_MESSAGE,
        exports.CATEGORY_NAME_EXISTS_MESSAGE,
        exports.CATEGORY_NAME_REQUIRED_MESSAGE,
        exports.CATEGORY_NOT_FOUND_MESSAGE,
        exports.CATEGORY_REFRESH_REQUIRED_MESSAGE,
    ].includes(message)) {
        return message;
    }
    if (isCategoryTierLimitMessage(message)) {
        return message;
    }
    return exports.CATEGORY_SAVE_GENERIC_ERROR_MESSAGE;
}
exports.getCategoryCrudErrorMessage = getCategoryCrudErrorMessage;
function isCategoryTierLimitMessage(message) {
    return message ? CATEGORY_TIER_LIMIT_MESSAGE_PATTERN.test(message) : false;
}
exports.isCategoryTierLimitMessage = isCategoryTierLimitMessage;
function isCategoryCrudAuthorizationError(error) {
    const message = error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : null;
    if (!message) {
        return false;
    }
    return CATEGORY_CRUD_AUTH_RECOVERY_PATTERNS.some((pattern) => pattern.test(message));
}
exports.isCategoryCrudAuthorizationError = isCategoryCrudAuthorizationError;
function createCategoryTemplateRows() {
    return [
        {
            Color: "",
            Description: "",
            Name: "",
        },
    ];
}
exports.createCategoryTemplateRows = createCategoryTemplateRows;
