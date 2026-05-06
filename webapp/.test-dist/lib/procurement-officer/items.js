"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProcurementItemUpgradeHref = exports.normalizeUnitPrice = exports.normalizeQuantityLimit = exports.normalizeComplianceFlags = exports.normalizeProcurementMethod = exports.formatProcurementItemMinimumQuantityMessage = exports.formatProcurementItemMaximumQuantityMessage = exports.procurementItemUnitAllowsDecimal = exports.normalizeProcurementItemUnitOption = exports.normalizeProcurementItemUnit = exports.normalizeProcurementItemDisplayName = exports.normalizeProcurementCatalogSearchText = exports.normalizeProcurementItemName = exports.PROCUREMENT_ITEM_IMPORT_COLUMNS = exports.PROCUREMENT_ITEM_PROCUREMENT_METHODS = exports.PROCUREMENT_ITEM_COMPLIANCE_FLAGS = exports.PROCUREMENT_ITEM_UNITS = exports.ITEM_DRAFT_STORAGE_KEY = exports.PROCUREMENT_ITEM_WORKSPACE_INTEGER_ONLY_MESSAGE = exports.PROCUREMENT_ITEM_WORKSPACE_QUANTITY_INVALID_MESSAGE = exports.PROCUREMENT_ITEM_WORKSPACE_QUANTITY_NEGATIVE_MESSAGE = exports.PROCUREMENT_ITEM_WORKSPACE_UNAVAILABLE_MESSAGE = exports.PROCUREMENT_ITEM_WORKSPACE_DUPLICATE_MESSAGE = exports.PROCUREMENT_ITEM_VALIDATION_CHANGE_NOTICE = exports.PROCUREMENT_ITEM_PRICE_CHANGE_NOTICE = exports.PROCUREMENT_ITEM_EXPORT_GENERIC_ERROR_MESSAGE = exports.PROCUREMENT_ITEM_IMPORT_GENERIC_ERROR_MESSAGE = exports.PROCUREMENT_ITEM_ARCHIVE_GENERIC_MESSAGE = exports.PROCUREMENT_ITEM_SAVE_GENERIC_ERROR_MESSAGE = exports.PROCUREMENT_ITEM_COMPLIANCE_INVALID_MESSAGE = exports.PROCUREMENT_ITEM_IMPORT_OVERFLOW_MESSAGE = exports.PROCUREMENT_ITEM_IMPORT_DUPLICATE_IN_FILE_MESSAGE = exports.PROCUREMENT_ITEM_IMPORT_UNKNOWN_CATEGORY_MESSAGE = exports.PROCUREMENT_ITEM_IMPORT_BLANK_CATEGORY_MESSAGE = exports.PROCUREMENT_ITEM_IMPORT_ROW_LIMIT_MESSAGE = exports.PROCUREMENT_ITEM_IMPORT_FREE_TIER_MESSAGE = exports.PROCUREMENT_ITEM_LIMIT_MESSAGE = exports.PROCUREMENT_ITEM_REFRESH_REQUIRED_MESSAGE = exports.PROCUREMENT_ITEM_CATEGORY_INACTIVE_MESSAGE = exports.PROCUREMENT_ITEM_NOT_FOUND_MESSAGE = exports.PROCUREMENT_ITEM_DUPLICATE_MESSAGE = exports.PROCUREMENT_ITEM_QUANTITY_RANGE_INVALID_MESSAGE = exports.PROCUREMENT_ITEM_MAX_QUANTITY_INVALID_MESSAGE = exports.PROCUREMENT_ITEM_MIN_QUANTITY_INVALID_MESSAGE = exports.PROCUREMENT_ITEM_PRICE_POSITIVE_MESSAGE = exports.PROCUREMENT_ITEM_UNIT_CUSTOM_REQUIRED_MESSAGE = exports.PROCUREMENT_ITEM_UNIT_INVALID_MESSAGE = exports.PROCUREMENT_ITEM_UNIT_REQUIRED_MESSAGE = exports.PROCUREMENT_ITEM_CATEGORY_REQUIRED_MESSAGE = exports.PROCUREMENT_ITEM_NAME_REQUIRED_MESSAGE = void 0;
exports.isProcurementItemCrudAuthorizationError = exports.isProcurementItemTierLimitMessage = exports.getProcurementItemCrudErrorMessage = exports.getProcurementItemImportRowFailure = exports.buildProcurementItemTemplateRows = exports.normalizeImportedProcurementItemUnit = exports.createProcurementItemDuplicateKey = exports.getNextProcurementItemSortOrder = exports.hasProcurementItemDuplicateConflict = exports.getComparableProcurementItemRevision = exports.categoryAcceptsProcurementItems = exports.hasStoredItemDraft = exports.parseStoredItemDraft = exports.hasMeaningfulItemDraftValues = exports.buildProcurementCatalogExportRows = exports.paginateProcurementCatalogRows = exports.filterProcurementCatalogRows = exports.createProcurementItemPriceHistoryEntry = exports.buildProcurementItemEditorCategoryOptions = exports.resolveProcurementItemDraftCategoryId = exports.buildProcurementItemWorkspaceRows = exports.createProcurementItemWorkspaceRow = exports.createProcurementCatalogRowMatcher = exports.buildProcurementItemCatalogSearchText = exports.formatProcurementItemQuantityLimits = exports.summarizeComplianceFlags = exports.buildProcurementItemTierLimitModalContent = exports.buildProcurementItemImportLimitState = exports.buildProcurementItemTierLimitState = exports.getProcurementItemCrudRecoveryHref = void 0;
const roles_1 = require("../shared/auth/roles");
const input_1 = require("../shared/security/input");
exports.PROCUREMENT_ITEM_NAME_REQUIRED_MESSAGE = "Item description is required";
exports.PROCUREMENT_ITEM_CATEGORY_REQUIRED_MESSAGE = "Category is required";
exports.PROCUREMENT_ITEM_UNIT_REQUIRED_MESSAGE = "Unit is required";
exports.PROCUREMENT_ITEM_UNIT_INVALID_MESSAGE = "Choose a supported unit";
exports.PROCUREMENT_ITEM_UNIT_CUSTOM_REQUIRED_MESSAGE = "Enter a custom unit label";
exports.PROCUREMENT_ITEM_PRICE_POSITIVE_MESSAGE = "Unit price must be greater than zero";
exports.PROCUREMENT_ITEM_MIN_QUANTITY_INVALID_MESSAGE = "Minimum quantity must be zero or greater";
exports.PROCUREMENT_ITEM_MAX_QUANTITY_INVALID_MESSAGE = "Maximum quantity must be zero or greater";
exports.PROCUREMENT_ITEM_QUANTITY_RANGE_INVALID_MESSAGE = "Maximum quantity must be greater than or equal to minimum quantity";
exports.PROCUREMENT_ITEM_DUPLICATE_MESSAGE = "An active item with this description already exists in the selected category.";
exports.PROCUREMENT_ITEM_NOT_FOUND_MESSAGE = "Item not found";
exports.PROCUREMENT_ITEM_CATEGORY_INACTIVE_MESSAGE = "Only active categories can accept new catalog items.";
exports.PROCUREMENT_ITEM_REFRESH_REQUIRED_MESSAGE = "Item data changed. Refresh and try again.";
exports.PROCUREMENT_ITEM_LIMIT_MESSAGE = "Item limit reached for this category on the current plan tier.";
exports.PROCUREMENT_ITEM_IMPORT_FREE_TIER_MESSAGE = "Workbook import is unavailable on the Free tier.";
exports.PROCUREMENT_ITEM_IMPORT_ROW_LIMIT_MESSAGE = "Workbook row limit reached for this plan tier.";
exports.PROCUREMENT_ITEM_IMPORT_BLANK_CATEGORY_MESSAGE = "Category is required";
exports.PROCUREMENT_ITEM_IMPORT_UNKNOWN_CATEGORY_MESSAGE = "Category could not be matched to an active catalog category.";
exports.PROCUREMENT_ITEM_IMPORT_DUPLICATE_IN_FILE_MESSAGE = "This item appears more than once in the workbook for the same category.";
exports.PROCUREMENT_ITEM_IMPORT_OVERFLOW_MESSAGE = "No remaining active-item slots are available for this category.";
exports.PROCUREMENT_ITEM_COMPLIANCE_INVALID_MESSAGE = "Choose supported compliance flags only";
exports.PROCUREMENT_ITEM_SAVE_GENERIC_ERROR_MESSAGE = "We could not save the item right now. Please try again.";
exports.PROCUREMENT_ITEM_ARCHIVE_GENERIC_MESSAGE = "We could not archive the item right now. Please try again.";
exports.PROCUREMENT_ITEM_IMPORT_GENERIC_ERROR_MESSAGE = "We could not import the item workbook right now. Please try again.";
exports.PROCUREMENT_ITEM_EXPORT_GENERIC_ERROR_MESSAGE = "We could not export the catalog right now. Please try again.";
exports.PROCUREMENT_ITEM_PRICE_CHANGE_NOTICE = "Catalog pricing changed while this workspace was open.";
exports.PROCUREMENT_ITEM_VALIDATION_CHANGE_NOTICE = "Catalog validation rules changed while this workspace was open.";
exports.PROCUREMENT_ITEM_WORKSPACE_DUPLICATE_MESSAGE = "Item already in this category";
exports.PROCUREMENT_ITEM_WORKSPACE_UNAVAILABLE_MESSAGE = "This item is no longer available in the live catalog.";
exports.PROCUREMENT_ITEM_WORKSPACE_QUANTITY_NEGATIVE_MESSAGE = "Quantity cannot be negative";
exports.PROCUREMENT_ITEM_WORKSPACE_QUANTITY_INVALID_MESSAGE = "Quantity must be a valid number";
exports.PROCUREMENT_ITEM_WORKSPACE_INTEGER_ONLY_MESSAGE = "Whole numbers only for this unit";
exports.ITEM_DRAFT_STORAGE_KEY = "procureline:po:item-draft";
exports.PROCUREMENT_ITEM_UNITS = [
    "each",
    "box",
    "kg",
    "liter",
    "ream",
    "set",
    "pair",
    "custom",
];
exports.PROCUREMENT_ITEM_COMPLIANCE_FLAGS = [
    "agpo",
    "pwd",
    "local_content",
];
exports.PROCUREMENT_ITEM_PROCUREMENT_METHODS = [
    "RFQ",
    "Open Tender",
    "Direct",
    "Low Value",
    "Framework",
];
exports.PROCUREMENT_ITEM_IMPORT_COLUMNS = [
    "Category",
    "Item/Service Description",
    "Unit Of Measurement",
    "Unit Price",
    "Proc Method",
    "Source Of Funds",
    "Min Quantity",
    "Max Quantity",
    "Compliance Flags",
];
const PROCUREMENT_ITEM_TIER_LABELS = {
    enterprise: "Enterprise",
    free: "Free",
    professional: "Professional",
    starter: "Starter",
};
const PROCUREMENT_ITEM_TIER_LIMITS = {
    free: 50,
    professional: 500,
    starter: 150,
};
const PROCUREMENT_ITEM_IMPORT_LIMITS = {
    free: 0,
    professional: 1_000,
    starter: 100,
};
const PROCUREMENT_ITEM_TIER_LIMIT_PATTERN = /\b(item limit reached for this category on the current plan tier|no remaining active-item slots are available for this category)\b/i;
const PROCUREMENT_ITEM_CRUD_AUTH_RECOVERY_PATTERNS = [
    /\bprocurement officer access is required for this resource\b/i,
    /\btenant record not found\b/i,
];
const PROCUREMENT_ITEM_UNIT_ALIAS_MAP = {
    box: "box",
    boxes: "box",
    each: "each",
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
    liter: "liter",
    litre: "liter",
    litres: "liter",
    liters: "liter",
    pair: "pair",
    pairs: "pair",
    pcs: "each",
    piece: "each",
    pieces: "each",
    ream: "ream",
    reams: "ream",
    set: "set",
    sets: "set",
};
function normalizeProcurementItemName(input) {
    return (0, input_1.normalizePlainText)(input).toLowerCase();
}
exports.normalizeProcurementItemName = normalizeProcurementItemName;
function normalizeProcurementCatalogSearchText(input) {
    return (0, input_1.normalizePlainText)(input.normalize("NFKD").replace(/[\u0300-\u036F]/g, "")).toLowerCase();
}
exports.normalizeProcurementCatalogSearchText = normalizeProcurementCatalogSearchText;
function normalizeProcurementItemDisplayName(input) {
    return (0, input_1.normalizePlainText)(input);
}
exports.normalizeProcurementItemDisplayName = normalizeProcurementItemDisplayName;
function normalizeProcurementItemUnit(input) {
    const normalized = (0, input_1.normalizePlainText)(input ?? "");
    return normalized.length > 0 ? normalized : undefined;
}
exports.normalizeProcurementItemUnit = normalizeProcurementItemUnit;
function normalizeProcurementItemUnitOption(input) {
    const normalized = (0, input_1.normalizePlainText)(input ?? "").toLowerCase();
    return (exports.PROCUREMENT_ITEM_UNITS.find((unit) => unit === normalized) ?? undefined);
}
exports.normalizeProcurementItemUnitOption = normalizeProcurementItemUnitOption;
function procurementItemUnitAllowsDecimal(input) {
    const normalizedUnit = normalizeProcurementItemUnitOption(input);
    return normalizedUnit === "kg" || normalizedUnit === "liter";
}
exports.procurementItemUnitAllowsDecimal = procurementItemUnitAllowsDecimal;
function formatProcurementItemQuantityNumber(limit) {
    return Number.isInteger(limit) ? String(limit) : String(limit);
}
function formatProcurementItemMaximumQuantityMessage(limit) {
    return `Maximum quantity is ${formatProcurementItemQuantityNumber(limit)}`;
}
exports.formatProcurementItemMaximumQuantityMessage = formatProcurementItemMaximumQuantityMessage;
function formatProcurementItemMinimumQuantityMessage(limit) {
    return `Minimum catalog quantity is ${formatProcurementItemQuantityNumber(limit)}`;
}
exports.formatProcurementItemMinimumQuantityMessage = formatProcurementItemMinimumQuantityMessage;
function normalizeProcurementMethod(input) {
    const normalized = (0, input_1.normalizePlainText)(input ?? "");
    return (exports.PROCUREMENT_ITEM_PROCUREMENT_METHODS.find((method) => method === normalized) ?? undefined);
}
exports.normalizeProcurementMethod = normalizeProcurementMethod;
function normalizeComplianceFlags(input) {
    const rawValues = Array.isArray(input)
        ? input
        : typeof input === "string"
            ? input.split(/[;,]/)
            : [];
    return Array.from(new Set(rawValues
        .map((value) => (0, input_1.normalizePlainText)(value).toLowerCase())
        .filter((value) => exports.PROCUREMENT_ITEM_COMPLIANCE_FLAGS.includes(value))));
}
exports.normalizeComplianceFlags = normalizeComplianceFlags;
function normalizeQuantityLimit(input) {
    if (typeof input === "number" && Number.isFinite(input)) {
        return input;
    }
    if (typeof input === "string" && input.trim().length > 0) {
        const parsed = Number(input);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
}
exports.normalizeQuantityLimit = normalizeQuantityLimit;
function normalizeUnitPrice(input) {
    if (typeof input === "number" && Number.isFinite(input)) {
        return input;
    }
    if (typeof input === "string" && input.trim().length > 0) {
        const parsed = Number(input);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
}
exports.normalizeUnitPrice = normalizeUnitPrice;
function getProcurementItemUpgradeHref() {
    return "/pricing";
}
exports.getProcurementItemUpgradeHref = getProcurementItemUpgradeHref;
function getProcurementItemCrudRecoveryHref() {
    return (0, roles_1.buildDashboardPath)(roles_1.FORBIDDEN_ACCESS_REASON);
}
exports.getProcurementItemCrudRecoveryHref = getProcurementItemCrudRecoveryHref;
function buildProcurementItemTierLimitState(args) {
    const limit = args.tier === "enterprise" ? null : PROCUREMENT_ITEM_TIER_LIMITS[args.tier];
    return {
        atLimit: limit !== null && args.activeItemCount >= limit,
        limit,
        remainingSlots: limit === null ? null : Math.max(limit - args.activeItemCount, 0),
        tier: args.tier,
        tierLabel: PROCUREMENT_ITEM_TIER_LABELS[args.tier],
        upgradeHref: getProcurementItemUpgradeHref(),
    };
}
exports.buildProcurementItemTierLimitState = buildProcurementItemTierLimitState;
function buildProcurementItemImportLimitState(args) {
    return {
        rowLimit: args.tier === "enterprise"
            ? null
            : PROCUREMENT_ITEM_IMPORT_LIMITS[args.tier],
        tier: args.tier,
        tierLabel: PROCUREMENT_ITEM_TIER_LABELS[args.tier],
    };
}
exports.buildProcurementItemImportLimitState = buildProcurementItemImportLimitState;
function buildProcurementItemTierLimitModalContent(args) {
    if (args.tier === "free") {
        return {
            body: "Archive an inactive item or upgrade to keep growing this category.",
            guidance: "Upgrade to Starter (150 items) or Professional (500 items).",
            title: `Free tier limit: ${args.limit ?? 50} active items per category`,
        };
    }
    if (args.tier === "starter") {
        return {
            body: "Archive an inactive item or upgrade to keep growing this category.",
            guidance: "Upgrade to Professional (500 items) or Enterprise (unlimited).",
            title: `Starter tier limit: ${args.limit ?? 150} active items per category`,
        };
    }
    if (args.tier === "professional") {
        return {
            body: "Archive an inactive item or upgrade to keep growing this category.",
            guidance: "Upgrade to Enterprise for unlimited category items.",
            title: `Professional tier limit: ${args.limit ?? 500} active items per category`,
        };
    }
    return {
        body: "Your current plan already supports unlimited active items per category.",
        guidance: "No numeric per-category cap applies on Enterprise.",
        title: `${args.tierLabel} tier supports unlimited active items`,
    };
}
exports.buildProcurementItemTierLimitModalContent = buildProcurementItemTierLimitModalContent;
function summarizeComplianceFlags(flags) {
    if (flags.length === 0) {
        return "No compliance flags";
    }
    return flags
        .map((flag) => {
        if (flag === "agpo") {
            return "AGPO";
        }
        if (flag === "pwd") {
            return "PWD";
        }
        return "Local Content";
    })
        .join(", ");
}
exports.summarizeComplianceFlags = summarizeComplianceFlags;
function formatProcurementItemQuantityLimits(args) {
    if (args.minQuantity === null && args.maxQuantity === null) {
        return "No limits";
    }
    if (args.minQuantity !== null && args.maxQuantity !== null) {
        return `${args.minQuantity} - ${args.maxQuantity}`;
    }
    if (args.minQuantity !== null) {
        return `Min ${args.minQuantity}`;
    }
    return `Max ${args.maxQuantity ?? 0}`;
}
exports.formatProcurementItemQuantityLimits = formatProcurementItemQuantityLimits;
function buildProcurementItemCatalogSearchText(args) {
    return normalizeProcurementCatalogSearchText([args.name, args.description ?? args.name, args.categoryName].join(" "));
}
exports.buildProcurementItemCatalogSearchText = buildProcurementItemCatalogSearchText;
function buildProcurementCatalogSearchTerms(searchText) {
    const normalizedSearchText = normalizeProcurementCatalogSearchText(searchText);
    return normalizedSearchText.length === 0
        ? []
        : normalizedSearchText.split(" ").filter((term) => term.length > 0);
}
function matchesProcurementCatalogSearchTerms(args) {
    if (args.searchTerms.length === 0) {
        return true;
    }
    const catalogSearchText = buildProcurementItemCatalogSearchText({
        categoryName: args.row.categoryName,
        description: args.row.description,
        name: args.row.name,
    });
    return args.searchTerms.every((term) => catalogSearchText.includes(term));
}
function createProcurementCatalogRowMatcher(filters) {
    const categoryIdSet = filters.categoryIds.length > 0 ? new Set(filters.categoryIds) : null;
    const requiredFlags = filters.complianceFlags.length > 0
        ? new Set(filters.complianceFlags)
        : null;
    const searchTerms = buildProcurementCatalogSearchTerms(filters.searchText);
    return (row) => {
        if (categoryIdSet && !categoryIdSet.has(row.categoryId)) {
            return false;
        }
        if (filters.minPrice !== null &&
            (row.unitPrice ?? Number.NEGATIVE_INFINITY) < filters.minPrice) {
            return false;
        }
        if (filters.maxPrice !== null &&
            (row.unitPrice ?? Number.POSITIVE_INFINITY) > filters.maxPrice) {
            return false;
        }
        if (requiredFlags &&
            !Array.from(requiredFlags).every((flag) => row.complianceFlags.includes(flag))) {
            return false;
        }
        return matchesProcurementCatalogSearchTerms({
            row,
            searchTerms,
        });
    };
}
exports.createProcurementCatalogRowMatcher = createProcurementCatalogRowMatcher;
function createProcurementItemWorkspaceRow(args) {
    return {
        ...args.item,
        archivedLabel: args.item.isActive || args.item.archivedAt === null ? null : "Archived",
        categoryLimit: buildProcurementItemTierLimitState({
            activeItemCount: args.category?.activeItemCount ?? 0,
            tier: args.tier,
        }),
        complianceSummary: summarizeComplianceFlags(args.item.complianceFlags),
    };
}
exports.createProcurementItemWorkspaceRow = createProcurementItemWorkspaceRow;
function buildProcurementItemWorkspaceRows(args) {
    const categoriesById = new Map(args.categories.map((category) => [category.id, category]));
    return [...args.items]
        .sort((left, right) => {
        const leftCategory = categoriesById.get(left.categoryId);
        const rightCategory = categoriesById.get(right.categoryId);
        const leftSort = leftCategory?.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const rightSort = rightCategory?.sortOrder ?? Number.MAX_SAFE_INTEGER;
        return (Number(right.isActive) - Number(left.isActive) ||
            leftSort - rightSort ||
            left.sortOrder - right.sortOrder ||
            left.name.localeCompare(right.name));
    })
        .map((item) => {
        const category = categoriesById.get(item.categoryId);
        return createProcurementItemWorkspaceRow({
            category,
            item,
            tier: args.tier,
        });
    });
}
exports.buildProcurementItemWorkspaceRows = buildProcurementItemWorkspaceRows;
function resolveProcurementItemDraftCategoryId(args) {
    const normalizedDraftCategoryId = args.draftCategoryId?.trim() ?? "";
    if (normalizedDraftCategoryId.length > 0 &&
        args.categories.some((category) => category.id === normalizedDraftCategoryId)) {
        return normalizedDraftCategoryId;
    }
    return args.categories.find((category) => category.isActive)?.id ?? "";
}
exports.resolveProcurementItemDraftCategoryId = resolveProcurementItemDraftCategoryId;
function buildProcurementItemEditorCategoryOptions(args) {
    const normalizedSelectedCategoryId = args.selectedCategoryId?.trim() ?? "";
    const options = args.categories
        .filter((category) => category.isActive)
        .map((category) => ({
        ...category,
        isPreservedInactiveSelection: false,
    }));
    if (normalizedSelectedCategoryId.length === 0) {
        return options;
    }
    const selectedCategory = args.categories.find((category) => category.id === normalizedSelectedCategoryId);
    if (!selectedCategory || selectedCategory.isActive) {
        return options;
    }
    return [
        ...options,
        {
            ...selectedCategory,
            isPreservedInactiveSelection: true,
        },
    ];
}
exports.buildProcurementItemEditorCategoryOptions = buildProcurementItemEditorCategoryOptions;
function createProcurementItemPriceHistoryEntry(args) {
    return {
        changedAt: args.changedAt,
        itemId: args.itemId,
        nextUnitPrice: args.nextUnitPrice,
        previousUnitPrice: args.previousUnitPrice,
    };
}
exports.createProcurementItemPriceHistoryEntry = createProcurementItemPriceHistoryEntry;
function filterProcurementCatalogRows(args) {
    if (args.filters.searchText.length === 0 &&
        args.filters.categoryIds.length === 0 &&
        args.filters.complianceFlags.length === 0 &&
        args.filters.minPrice === null &&
        args.filters.maxPrice === null) {
        return [...args.rows];
    }
    const matchesRow = createProcurementCatalogRowMatcher(args.filters);
    return args.rows.filter((row) => matchesRow(row));
}
exports.filterProcurementCatalogRows = filterProcurementCatalogRows;
function paginateProcurementCatalogRows(args) {
    const safePageSize = Number.isInteger(args.pageSize) && args.pageSize > 0 ? args.pageSize : 50;
    const totalCount = args.rows.length;
    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / safePageSize);
    const currentPage = totalPages === 0
        ? 1
        : Math.min(Math.max(Math.trunc(args.page), 1), totalPages);
    const startIndex = totalPages === 0 ? 0 : (currentPage - 1) * safePageSize;
    return {
        currentPage,
        page: args.rows.slice(startIndex, startIndex + safePageSize),
        pageSize: safePageSize,
        totalCount,
        totalPages,
    };
}
exports.paginateProcurementCatalogRows = paginateProcurementCatalogRows;
function buildProcurementCatalogExportRows(rows) {
    return rows.map((row) => ({
        Category: row.categoryName,
        "Compliance Flags": row.complianceSummary,
        Description: row.description ?? row.name,
        "Item Name": row.name,
        Price: row.unitPrice ?? 0,
        "Qty Limits": formatProcurementItemQuantityLimits({
            maxQuantity: row.maxQuantity,
            minQuantity: row.minQuantity,
        }),
        Unit: row.unitOfMeasurement ?? "",
    }));
}
exports.buildProcurementCatalogExportRows = buildProcurementCatalogExportRows;
function hasMeaningfulItemDraftValues(args) {
    return ((0, input_1.normalizePlainText)(args.name ?? "").length > 0 ||
        (0, input_1.normalizePlainText)(args.categoryName ?? "").length > 0 ||
        (0, input_1.normalizePlainText)(args.unit ?? "").length > 0 ||
        (0, input_1.normalizePlainText)(args.customUnit ?? "").length > 0 ||
        (0, input_1.normalizePlainText)(args.sourceOfFunds ?? "").length > 0 ||
        typeof args.unitPrice === "number" ||
        typeof args.minQuantity === "number" ||
        typeof args.maxQuantity === "number" ||
        (args.complianceFlags?.length ?? 0) > 0);
}
exports.hasMeaningfulItemDraftValues = hasMeaningfulItemDraftValues;
function parseStoredItemDraft(raw) {
    if (!raw) {
        return null;
    }
    try {
        const record = JSON.parse(raw);
        const maxQuantityInput = typeof record.maxQuantity === "number" ||
            typeof record.maxQuantity === "string"
            ? record.maxQuantity
            : null;
        const minQuantityInput = typeof record.minQuantity === "number" ||
            typeof record.minQuantity === "string"
            ? record.minQuantity
            : null;
        const unitPriceInput = typeof record.unitPrice === "number" ||
            typeof record.unitPrice === "string"
            ? record.unitPrice
            : null;
        return {
            categoryId: typeof record.categoryId === "string" &&
                (0, input_1.normalizePlainText)(record.categoryId).length > 0
                ? record.categoryId
                : null,
            categoryName: typeof record.categoryName === "string" &&
                (0, input_1.normalizePlainText)(record.categoryName).length > 0
                ? record.categoryName
                : null,
            complianceFlags: normalizeComplianceFlags(Array.isArray(record.complianceFlags)
                ? record.complianceFlags
                : []),
            customUnit: typeof record.customUnit === "string" &&
                (0, input_1.normalizePlainText)(record.customUnit).length > 0
                ? (0, input_1.normalizePlainText)(record.customUnit)
                : null,
            id: typeof record.id === "string" ? record.id : "",
            maxQuantity: normalizeQuantityLimit(maxQuantityInput) ?? null,
            minQuantity: normalizeQuantityLimit(minQuantityInput) ?? null,
            name: typeof record.name === "string" ? (0, input_1.normalizePlainText)(record.name) : "",
            procurementMethod: normalizeProcurementMethod(typeof record.procurementMethod === "string"
                ? record.procurementMethod
                : null) ?? null,
            revision: typeof record.revision === "number" && Number.isFinite(record.revision)
                ? record.revision
                : 0,
            sourceOfFunds: typeof record.sourceOfFunds === "string" &&
                (0, input_1.normalizePlainText)(record.sourceOfFunds).length > 0
                ? (0, input_1.normalizePlainText)(record.sourceOfFunds)
                : null,
            unit: typeof record.unit === "string" &&
                (0, input_1.normalizePlainText)(record.unit).length > 0
                ? (0, input_1.normalizePlainText)(record.unit)
                : null,
            unitPrice: normalizeUnitPrice(unitPriceInput) ?? null,
        };
    }
    catch {
        return null;
    }
}
exports.parseStoredItemDraft = parseStoredItemDraft;
function hasStoredItemDraft(raw) {
    const draft = parseStoredItemDraft(raw);
    return draft ? hasMeaningfulItemDraftValues(draft) : false;
}
exports.hasStoredItemDraft = hasStoredItemDraft;
function categoryAcceptsProcurementItems(args) {
    return args.isActive;
}
exports.categoryAcceptsProcurementItems = categoryAcceptsProcurementItems;
function getComparableProcurementItemRevision(revision) {
    if (typeof revision !== "number" || !Number.isFinite(revision)) {
        return 0;
    }
    return revision;
}
exports.getComparableProcurementItemRevision = getComparableProcurementItemRevision;
function hasProcurementItemDuplicateConflict(args) {
    return args.items.some((item) => {
        if (!item.isActive) {
            return false;
        }
        if (args.excludeItemId && item._id === args.excludeItemId) {
            return false;
        }
        return ((item.normalizedName ?? normalizeProcurementItemName(item.name)) ===
            args.normalizedName);
    });
}
exports.hasProcurementItemDuplicateConflict = hasProcurementItemDuplicateConflict;
function getNextProcurementItemSortOrder(items) {
    return Math.max(0, ...items.map((item) => item.sortOrder ?? 0)) + 1;
}
exports.getNextProcurementItemSortOrder = getNextProcurementItemSortOrder;
function createProcurementItemDuplicateKey(args) {
    return `${args.categoryId}::${args.normalizedName}`;
}
exports.createProcurementItemDuplicateKey = createProcurementItemDuplicateKey;
function normalizeImportedProcurementItemUnit(value) {
    const normalized = normalizeProcurementItemDisplayName(value).toLowerCase();
    const mappedValue = PROCUREMENT_ITEM_UNIT_ALIAS_MAP[normalized];
    if (mappedValue) {
        return { valid: true, value: mappedValue };
    }
    return { valid: false, value: value.trim() };
}
exports.normalizeImportedProcurementItemUnit = normalizeImportedProcurementItemUnit;
function buildProcurementItemTemplateRows() {
    return [
        {
            Category: "",
            "Compliance Flags": "",
            "Item/Service Description": "",
            "Max Quantity": "",
            "Min Quantity": "",
            "Proc Method": "",
            "Source Of Funds": "",
            "Unit Of Measurement": "",
            "Unit Price": "",
        },
    ];
}
exports.buildProcurementItemTemplateRows = buildProcurementItemTemplateRows;
function getProcurementItemImportRowFailure(args) {
    if (args.categoryName.length === 0) {
        return exports.PROCUREMENT_ITEM_IMPORT_BLANK_CATEGORY_MESSAGE;
    }
    if (!args.hasActiveCategory) {
        return exports.PROCUREMENT_ITEM_IMPORT_UNKNOWN_CATEGORY_MESSAGE;
    }
    if (args.normalizedName.length === 0) {
        return exports.PROCUREMENT_ITEM_NAME_REQUIRED_MESSAGE;
    }
    if (args.seenInFile.has(args.normalizedName)) {
        return exports.PROCUREMENT_ITEM_IMPORT_DUPLICATE_IN_FILE_MESSAGE;
    }
    if (!normalizeProcurementItemUnit(args.unit)) {
        return exports.PROCUREMENT_ITEM_UNIT_REQUIRED_MESSAGE;
    }
    if (!Number.isFinite(args.price ?? NaN) || (args.price ?? 0) <= 0) {
        return exports.PROCUREMENT_ITEM_PRICE_POSITIVE_MESSAGE;
    }
    if (args.minQuantity !== null && args.minQuantity < 0) {
        return exports.PROCUREMENT_ITEM_MIN_QUANTITY_INVALID_MESSAGE;
    }
    if (args.maxQuantity !== null && args.maxQuantity < 0) {
        return exports.PROCUREMENT_ITEM_MAX_QUANTITY_INVALID_MESSAGE;
    }
    if (args.minQuantity !== null &&
        args.maxQuantity !== null &&
        args.maxQuantity < args.minQuantity) {
        return exports.PROCUREMENT_ITEM_QUANTITY_RANGE_INVALID_MESSAGE;
    }
    if (args.rowLimit !== null && args.rowIndexWithinTierCap >= args.rowLimit) {
        return exports.PROCUREMENT_ITEM_IMPORT_ROW_LIMIT_MESSAGE;
    }
    if (args.limit !== null && args.activeItemCount >= args.limit) {
        return exports.PROCUREMENT_ITEM_IMPORT_OVERFLOW_MESSAGE;
    }
    return null;
}
exports.getProcurementItemImportRowFailure = getProcurementItemImportRowFailure;
function getProcurementItemCrudErrorMessage(error) {
    const message = error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : null;
    if (!message) {
        return exports.PROCUREMENT_ITEM_SAVE_GENERIC_ERROR_MESSAGE;
    }
    if ([
        exports.PROCUREMENT_ITEM_CATEGORY_INACTIVE_MESSAGE,
        exports.PROCUREMENT_ITEM_CATEGORY_REQUIRED_MESSAGE,
        exports.PROCUREMENT_ITEM_DUPLICATE_MESSAGE,
        exports.PROCUREMENT_ITEM_IMPORT_FREE_TIER_MESSAGE,
        exports.PROCUREMENT_ITEM_COMPLIANCE_INVALID_MESSAGE,
        exports.PROCUREMENT_ITEM_IMPORT_OVERFLOW_MESSAGE,
        exports.PROCUREMENT_ITEM_IMPORT_ROW_LIMIT_MESSAGE,
        exports.PROCUREMENT_ITEM_MAX_QUANTITY_INVALID_MESSAGE,
        exports.PROCUREMENT_ITEM_MIN_QUANTITY_INVALID_MESSAGE,
        exports.PROCUREMENT_ITEM_NAME_REQUIRED_MESSAGE,
        exports.PROCUREMENT_ITEM_NOT_FOUND_MESSAGE,
        exports.PROCUREMENT_ITEM_PRICE_POSITIVE_MESSAGE,
        exports.PROCUREMENT_ITEM_QUANTITY_RANGE_INVALID_MESSAGE,
        exports.PROCUREMENT_ITEM_REFRESH_REQUIRED_MESSAGE,
        exports.PROCUREMENT_ITEM_UNIT_CUSTOM_REQUIRED_MESSAGE,
        exports.PROCUREMENT_ITEM_UNIT_INVALID_MESSAGE,
        exports.PROCUREMENT_ITEM_UNIT_REQUIRED_MESSAGE,
    ].includes(message)) {
        return message;
    }
    if (isProcurementItemTierLimitMessage(message)) {
        return message;
    }
    return exports.PROCUREMENT_ITEM_SAVE_GENERIC_ERROR_MESSAGE;
}
exports.getProcurementItemCrudErrorMessage = getProcurementItemCrudErrorMessage;
function isProcurementItemTierLimitMessage(message) {
    return message ? PROCUREMENT_ITEM_TIER_LIMIT_PATTERN.test(message) : false;
}
exports.isProcurementItemTierLimitMessage = isProcurementItemTierLimitMessage;
function isProcurementItemCrudAuthorizationError(error) {
    const message = error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : null;
    if (!message) {
        return false;
    }
    return PROCUREMENT_ITEM_CRUD_AUTH_RECOVERY_PATTERNS.some((pattern) => pattern.test(message));
}
exports.isProcurementItemCrudAuthorizationError = isProcurementItemCrudAuthorizationError;
