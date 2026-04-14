import { z } from "zod";
import { evaluateDepartmentUserSubmissionWindow } from "../auth/department-user-access";
import { normalizeCategoryName } from "../procurement-officer/categories";
import { normalizeProcurementItemName } from "../procurement-officer/items";
import { validatePlainTextInput } from "../security/input";

export const CATALOG_REQUEST_STATUS_VALUES = [
    "pending",
    "approved",
    "denied",
    "expired",
    "cancelled",
] as const;

export const CATALOG_CATEGORY_REQUEST_ORIGIN_VALUES = [
    "standalone",
    "item_handoff",
] as const;

export const CATALOG_REQUEST_TYPE_VALUES = ["item", "category"] as const;
export const CATALOG_REQUEST_CATEGORY_MODE_VALUES = ["existing", "request"] as const;

export type CatalogRequestStatus = (typeof CATALOG_REQUEST_STATUS_VALUES)[number];
export type CatalogCategoryRequestOrigin =
    (typeof CATALOG_CATEGORY_REQUEST_ORIGIN_VALUES)[number];
export type CatalogRequestType = (typeof CATALOG_REQUEST_TYPE_VALUES)[number];
export type CatalogRequestCategoryMode =
    (typeof CATALOG_REQUEST_CATEGORY_MODE_VALUES)[number];
export type CatalogRequestBadgeTone =
    | "approved"
    | "denied"
    | "expired"
    | "pending";

export const CATALOG_REQUEST_LIMITS = {
    categoryDescription: 280,
    categoryJustification: 280,
    categoryName: 80,
    itemDescription: 280,
    itemJustification: 280,
    itemName: 80,
} as const;

export const CATALOG_REQUEST_MESSAGES = {
    categoryAlreadyExists: "This category already exists.",
    categoryDescriptionRequired: "Category description is required",
    categoryJustificationRequired: "Justification is required",
    categoryNameRequired: "Category name is required",
    duplicatePending: "A matching request is already pending review.",
    itemAlreadyExistsPrefix: "This item already exists in",
    itemCategoryRequired:
        "Choose an active category or switch to category request handoff.",
    itemDescriptionRequired: "Item description is required",
    itemJustificationRequired: "Justification is required",
    itemNameRequired: "Item name is required",
    itemPricePositive: "Estimated unit price must be greater than zero",
    staleRevision: "Request data changed. Refresh and try again.",
} as const;

export interface CatalogRequestStatusMeta {
    badgeTone: CatalogRequestBadgeTone;
    label: string;
}

export interface CatalogRequestSummary {
    pendingCategoryCount: number;
    pendingItemCount: number;
    totalCount: number;
    totalPendingCount: number;
}

function createTrimmedStringSchema(args: {
    maxLength: number;
    minLength?: number;
    requiredMessage: string;
}) {
    return z
        .string()
        .transform((value) => value.trim())
        .refine((value) => value.length >= (args.minLength ?? 1), {
            message: args.requiredMessage,
        })
        .refine((value) => value.length <= args.maxLength, {
            message: `Must be ${args.maxLength} characters or less`,
        });
}

export const catalogCategoryRequestFormSchema = z.object({
    description: createTrimmedStringSchema({
        maxLength: CATALOG_REQUEST_LIMITS.categoryDescription,
        requiredMessage: CATALOG_REQUEST_MESSAGES.categoryDescriptionRequired,
    }),
    justification: createTrimmedStringSchema({
        maxLength: CATALOG_REQUEST_LIMITS.categoryJustification,
        requiredMessage: CATALOG_REQUEST_MESSAGES.categoryJustificationRequired,
    }),
    name: createTrimmedStringSchema({
        maxLength: CATALOG_REQUEST_LIMITS.categoryName,
        requiredMessage: CATALOG_REQUEST_MESSAGES.categoryNameRequired,
    }),
});

export type CatalogCategoryRequestFormValues = z.infer<
    typeof catalogCategoryRequestFormSchema
>;

export const catalogItemRequestFormSchema = z
    .object({
        categoryId: z.string().trim().optional(),
        categoryMode: z.enum(CATALOG_REQUEST_CATEGORY_MODE_VALUES),
        categoryRequest: catalogCategoryRequestFormSchema.optional(),
        description: createTrimmedStringSchema({
            maxLength: CATALOG_REQUEST_LIMITS.itemDescription,
            requiredMessage: CATALOG_REQUEST_MESSAGES.itemDescriptionRequired,
        }),
        estimatedUnitPrice: z.preprocess(
            (value) => {
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
            },
            z
                .number({
                    invalid_type_error: CATALOG_REQUEST_MESSAGES.itemPricePositive,
                })
                .positive(CATALOG_REQUEST_MESSAGES.itemPricePositive),
        ),
        justification: createTrimmedStringSchema({
            maxLength: CATALOG_REQUEST_LIMITS.itemJustification,
            requiredMessage: CATALOG_REQUEST_MESSAGES.itemJustificationRequired,
        }),
        name: createTrimmedStringSchema({
            maxLength: CATALOG_REQUEST_LIMITS.itemName,
            requiredMessage: CATALOG_REQUEST_MESSAGES.itemNameRequired,
        }),
    })
    .superRefine((value, ctx) => {
        if (value.categoryMode === "existing" && !value.categoryId?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: CATALOG_REQUEST_MESSAGES.itemCategoryRequired,
                path: ["categoryId"],
            });
        }
    });

export type CatalogItemRequestFormValues = z.infer<
    typeof catalogItemRequestFormSchema
>;

export function normalizeCatalogRequestName(
    type: CatalogRequestType,
    value: string,
): string {
    return type === "category"
        ? normalizeCategoryName(value)
        : normalizeProcurementItemName(value);
}

export function buildCatalogRequestCategoryReferenceKey(args: {
    categoryId?: string | null;
    normalizedCategoryName?: string | null;
}): string {
    if (args.categoryId?.trim()) {
        return `category::${args.categoryId.trim()}`;
    }

    return `category-name::${(args.normalizedCategoryName ?? "").trim()}`;
}

export function shouldAutoCancelLinkedCategoryRequest(args: {
    hasOtherPendingLinks: boolean;
    requestOrigin: CatalogCategoryRequestOrigin;
}): boolean {
    return (
        args.requestOrigin === "item_handoff" && !args.hasOtherPendingLinks
    );
}

export function createCategoryRequestIdentityKeys(args: {
    departmentId: string;
    normalizedName: string;
    requestorTenantUserId: string;
    tenantId: string;
}) {
    return {
        requesterDuplicateKey: [
            args.tenantId,
            args.departmentId,
            args.requestorTenantUserId,
            "category",
            args.normalizedName,
        ].join("::"),
        sharedGroupingKey: [args.tenantId, "category", args.normalizedName].join(
            "::",
        ),
    };
}

export function createItemRequestIdentityKeys(args: {
    categoryReferenceKey: string;
    departmentId: string;
    normalizedName: string;
    requestorTenantUserId: string;
    tenantId: string;
}) {
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

export function sanitizeCatalogRequestTextField(
    value: string,
    args: {
        field: string;
        label: string;
        maxLength: number;
        minLength?: number;
    },
): string {
    const result = validatePlainTextInput(value, args);
    if (!result.ok) {
        throw new Error(result.issue.message);
    }

    return result.value;
}

export function buildCatalogRequestStatusMeta(
    status: CatalogRequestStatus,
): CatalogRequestStatusMeta {
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

export function formatCatalogRequestDecisionReason(args: {
    reason: string | null | undefined;
    status: CatalogRequestStatus;
}): string | null {
    const normalizedReason = args.reason?.trim();
    if (!normalizedReason) {
        return null;
    }

    const statusLabel = buildCatalogRequestStatusMeta(args.status).label;
    return `${statusLabel}: ${normalizedReason}`;
}

export function shouldExpireCatalogRequest(args: {
    now?: number;
    status: CatalogRequestStatus;
    submissionEndsAt?: number | null;
    submissionStartsAt?: number | null;
}): boolean {
    if (args.status !== "pending") {
        return false;
    }

    if (
        typeof args.submissionStartsAt !== "number" ||
        typeof args.submissionEndsAt !== "number"
    ) {
        return false;
    }

    return (
        evaluateDepartmentUserSubmissionWindow({
            now: args.now,
            submissionEndsAt: args.submissionEndsAt,
            submissionStartsAt: args.submissionStartsAt,
        }).state === "ended"
    );
}

export function buildCatalogRequestSummary(args: {
    requests: ReadonlyArray<{
        status: CatalogRequestStatus;
        type: CatalogRequestType;
    }>;
}): CatalogRequestSummary {
    const pendingItemCount = args.requests.filter(
        (request) => request.status === "pending" && request.type === "item",
    ).length;
    const pendingCategoryCount = args.requests.filter(
        (request) => request.status === "pending" && request.type === "category",
    ).length;

    return {
        pendingCategoryCount,
        pendingItemCount,
        totalCount: args.requests.length,
        totalPendingCount: pendingItemCount + pendingCategoryCount,
    };
}

export function formatCatalogRequestDuplicateCatalogMessage(
    categoryName: string,
): string {
    return `${CATALOG_REQUEST_MESSAGES.itemAlreadyExistsPrefix} ${categoryName}`;
}

export function isCatalogRequestEditable(args: {
    accessMode: "editable" | "read_only_grace" | null;
    status: CatalogRequestStatus;
}): boolean {
    return args.accessMode === "editable" && args.status === "pending";
}
