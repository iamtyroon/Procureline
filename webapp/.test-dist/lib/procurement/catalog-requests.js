"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCatalogRequestEditable = exports.formatCatalogRequestDuplicateCatalogMessage = exports.buildCatalogRequestSummary = exports.shouldExpireCatalogRequest = exports.formatCatalogRequestDecisionReason = exports.buildCatalogRequestStatusMeta = exports.sanitizeCatalogRequestTextField = exports.createItemRequestIdentityKeys = exports.createCategoryRequestIdentityKeys = exports.shouldAutoCancelLinkedCategoryRequest = exports.buildCatalogRequestCategoryReferenceKey = exports.normalizeCatalogRequestName = exports.catalogItemRequestFormSchema = exports.catalogCategoryRequestFormSchema = exports.CATALOG_REQUEST_MESSAGES = exports.CATALOG_REQUEST_LIMITS = exports.CATALOG_REQUEST_CATEGORY_MODE_VALUES = exports.CATALOG_REQUEST_TYPE_VALUES = exports.CATALOG_CATEGORY_REQUEST_ORIGIN_VALUES = exports.CATALOG_REQUEST_STATUS_VALUES = void 0;
const zod_1 = require("zod");
const categories_1 = require("../procurement-officer/categories");
const items_1 = require("../procurement-officer/items");
const input_1 = require("../shared/security/input");
exports.CATALOG_REQUEST_STATUS_VALUES = [
    "pending",
    "approved",
    "denied",
    "expired",
    "cancelled",
];
exports.CATALOG_CATEGORY_REQUEST_ORIGIN_VALUES = [
    "standalone",
    "item_handoff",
];
exports.CATALOG_REQUEST_TYPE_VALUES = ["item", "category"];
exports.CATALOG_REQUEST_CATEGORY_MODE_VALUES = ["existing", "request"];
exports.CATALOG_REQUEST_LIMITS = {
    categoryDescription: 280,
    categoryJustification: 280,
    categoryName: 80,
    itemDescription: 280,
    itemJustification: 280,
    itemName: 80,
};
exports.CATALOG_REQUEST_MESSAGES = {
    categoryAlreadyExists: "This category already exists.",
    categoryDescriptionRequired: "Category description is required",
    categoryJustificationRequired: "Justification is required",
    categoryNameRequired: "Category name is required",
    duplicatePending: "A matching request is already pending review.",
    itemAlreadyExistsPrefix: "This item already exists in",
    itemCategoryRequired: "Choose an active category or switch to category request handoff.",
    itemDescriptionRequired: "Item description is required",
    itemJustificationRequired: "Justification is required",
    itemNameRequired: "Item name is required",
    itemPricePositive: "Estimated unit price must be greater than zero",
    staleRevision: "Request data changed. Refresh and try again.",
};
function createTrimmedStringSchema(args) {
    return zod_1.z
        .string()
        .transform((value) => value.trim())
        .refine((value) => value.length >= (args.minLength ?? 1), {
        message: args.requiredMessage,
    })
        .refine((value) => value.length <= args.maxLength, {
        message: `Must be ${args.maxLength} characters or less`,
    });
}
exports.catalogCategoryRequestFormSchema = zod_1.z.object({
    description: createTrimmedStringSchema({
        maxLength: exports.CATALOG_REQUEST_LIMITS.categoryDescription,
        requiredMessage: exports.CATALOG_REQUEST_MESSAGES.categoryDescriptionRequired,
    }),
    justification: createTrimmedStringSchema({
        maxLength: exports.CATALOG_REQUEST_LIMITS.categoryJustification,
        requiredMessage: exports.CATALOG_REQUEST_MESSAGES.categoryJustificationRequired,
    }),
    name: createTrimmedStringSchema({
        maxLength: exports.CATALOG_REQUEST_LIMITS.categoryName,
        requiredMessage: exports.CATALOG_REQUEST_MESSAGES.categoryNameRequired,
    }),
});
exports.catalogItemRequestFormSchema = zod_1.z
    .object({
    categoryId: zod_1.z.string().trim().optional(),
    categoryMode: zod_1.z.enum(exports.CATALOG_REQUEST_CATEGORY_MODE_VALUES),
    categoryRequest: exports.catalogCategoryRequestFormSchema.optional(),
    description: createTrimmedStringSchema({
        maxLength: exports.CATALOG_REQUEST_LIMITS.itemDescription,
        requiredMessage: exports.CATALOG_REQUEST_MESSAGES.itemDescriptionRequired,
    }),
    estimatedUnitPrice: zod_1.z.preprocess((value) => {
        if (typeof value === "number") {
            return value;
        }
        if (typeof value === "string") {
            const normalized = value.trim();
            if (normalized.length === 0) {
                return Number.NaN;
            }
            return Number(normalized);
        }
        return value;
    }, zod_1.z
        .number({
        invalid_type_error: exports.CATALOG_REQUEST_MESSAGES.itemPricePositive,
    })
        .positive(exports.CATALOG_REQUEST_MESSAGES.itemPricePositive)),
    justification: createTrimmedStringSchema({
        maxLength: exports.CATALOG_REQUEST_LIMITS.itemJustification,
        requiredMessage: exports.CATALOG_REQUEST_MESSAGES.itemJustificationRequired,
    }),
    name: createTrimmedStringSchema({
        maxLength: exports.CATALOG_REQUEST_LIMITS.itemName,
        requiredMessage: exports.CATALOG_REQUEST_MESSAGES.itemNameRequired,
    }),
})
    .superRefine((value, ctx) => {
    if (value.categoryMode === "existing" && !value.categoryId?.trim()) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: exports.CATALOG_REQUEST_MESSAGES.itemCategoryRequired,
            path: ["categoryId"],
        });
    }
});
function normalizeCatalogRequestName(type, value) {
    return type === "category"
        ? (0, categories_1.normalizeCategoryName)(value)
        : (0, items_1.normalizeProcurementItemName)(value);
}
exports.normalizeCatalogRequestName = normalizeCatalogRequestName;
function buildCatalogRequestCategoryReferenceKey(args) {
    if (args.categoryId?.trim()) {
        return `category::${args.categoryId.trim()}`;
    }
    return `category-name::${(args.normalizedCategoryName ?? "").trim()}`;
}
exports.buildCatalogRequestCategoryReferenceKey = buildCatalogRequestCategoryReferenceKey;
function shouldAutoCancelLinkedCategoryRequest(args) {
    return (args.requestOrigin === "item_handoff" && !args.hasOtherPendingLinks);
}
exports.shouldAutoCancelLinkedCategoryRequest = shouldAutoCancelLinkedCategoryRequest;
function createCategoryRequestIdentityKeys(args) {
    return {
        requesterDuplicateKey: [
            args.tenantId,
            args.departmentId,
            args.requestorTenantUserId,
            "category",
            args.normalizedName,
        ].join("::"),
        sharedGroupingKey: [args.tenantId, "category", args.normalizedName].join("::"),
    };
}
exports.createCategoryRequestIdentityKeys = createCategoryRequestIdentityKeys;
function createItemRequestIdentityKeys(args) {
    return {
        requesterDuplicateKey: [
            args.tenantId,
            args.departmentId,
            args.requestorTenantUserId,
            "item",
            args.categoryReferenceKey,
            args.normalizedName,
        ].join("::"),
        sharedGroupingKey: [
            args.tenantId,
            "item",
            args.categoryReferenceKey,
            args.normalizedName,
        ].join("::"),
    };
}
exports.createItemRequestIdentityKeys = createItemRequestIdentityKeys;
function sanitizeCatalogRequestTextField(value, args) {
    const result = (0, input_1.validatePlainTextInput)(value, args);
    if (!result.ok) {
        throw new Error(result.issue.message);
    }
    return result.value;
}
exports.sanitizeCatalogRequestTextField = sanitizeCatalogRequestTextField;
function buildCatalogRequestStatusMeta(status) {
    switch (status) {
        case "approved":
            return {
                badgeTone: "approved",
                label: "Approved",
            };
        case "cancelled":
            return {
                badgeTone: "expired",
                label: "Cancelled",
            };
        case "denied":
            return {
                badgeTone: "denied",
                label: "Denied",
            };
        case "expired":
            return {
                badgeTone: "expired",
                label: "Expired",
            };
        default:
            return {
                badgeTone: "pending",
                label: "Pending",
            };
    }
}
exports.buildCatalogRequestStatusMeta = buildCatalogRequestStatusMeta;
function formatCatalogRequestDecisionReason(args) {
    const normalizedReason = args.reason?.trim();
    if (!normalizedReason) {
        return null;
    }
    const statusLabel = buildCatalogRequestStatusMeta(args.status).label;
    return `${statusLabel}: ${normalizedReason}`;
}
exports.formatCatalogRequestDecisionReason = formatCatalogRequestDecisionReason;
function shouldExpireCatalogRequest(args) {
    if (args.status !== "pending") {
        return false;
    }
    if (typeof args.submissionStartsAt !== "number" ||
        typeof args.submissionEndsAt !== "number") {
        return false;
    }
    const now = args.now ?? Date.now();
    return now > args.submissionEndsAt;
}
exports.shouldExpireCatalogRequest = shouldExpireCatalogRequest;
function buildCatalogRequestSummary(args) {
    const pendingItemCount = args.requests.filter((request) => request.status === "pending" && request.type === "item").length;
    const pendingCategoryCount = args.requests.filter((request) => request.status === "pending" && request.type === "category").length;
    return {
        pendingCategoryCount,
        pendingItemCount,
        totalCount: args.requests.length,
        totalPendingCount: pendingItemCount + pendingCategoryCount,
    };
}
exports.buildCatalogRequestSummary = buildCatalogRequestSummary;
function formatCatalogRequestDuplicateCatalogMessage(categoryName) {
    return `${exports.CATALOG_REQUEST_MESSAGES.itemAlreadyExistsPrefix} ${categoryName}`;
}
exports.formatCatalogRequestDuplicateCatalogMessage = formatCatalogRequestDuplicateCatalogMessage;
function isCatalogRequestEditable(args) {
    return args.accessMode === "editable" && args.status === "pending";
}
exports.isCatalogRequestEditable = isCatalogRequestEditable;
