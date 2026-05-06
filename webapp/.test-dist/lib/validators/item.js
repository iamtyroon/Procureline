"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.itemFormSchema = void 0;
const zod_1 = require("zod");
const items_1 = require("../procurement-officer/items");
const input_1 = require("../shared/security/input");
exports.itemFormSchema = zod_1.z
    .object({
    categoryId: zod_1.z.string(),
    complianceFlags: zod_1.z.array(zod_1.z.string()).default([]),
    customUnit: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    maxQuantity: zod_1.z.union([zod_1.z.number(), zod_1.z.nan()]).optional(),
    minQuantity: zod_1.z.union([zod_1.z.number(), zod_1.z.nan()]).optional(),
    name: zod_1.z.string(),
    procurementMethod: zod_1.z.string().optional(),
    sourceOfFunds: zod_1.z.string().optional(),
    unit: zod_1.z.string(),
    unitPrice: zod_1.z.union([zod_1.z.number(), zod_1.z.nan()]),
})
    .superRefine((value, ctx) => {
    const name = (0, items_1.normalizeProcurementItemDisplayName)(value.name);
    const categoryId = (0, input_1.normalizePlainText)(value.categoryId);
    const unit = (0, items_1.normalizeProcurementItemUnitOption)(value.unit);
    const customUnit = (0, items_1.normalizeProcurementItemUnit)(value.customUnit);
    const unitPrice = (0, items_1.normalizeUnitPrice)(value.unitPrice);
    const minQuantity = (0, items_1.normalizeQuantityLimit)(value.minQuantity);
    const maxQuantity = (0, items_1.normalizeQuantityLimit)(value.maxQuantity);
    if (categoryId.length === 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: items_1.PROCUREMENT_ITEM_CATEGORY_REQUIRED_MESSAGE,
            path: ["categoryId"],
        });
    }
    if (name.length === 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: items_1.PROCUREMENT_ITEM_NAME_REQUIRED_MESSAGE,
            path: ["name"],
        });
    }
    if (!unit) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: (0, input_1.normalizePlainText)(value.unit).length === 0
                ? items_1.PROCUREMENT_ITEM_UNIT_REQUIRED_MESSAGE
                : items_1.PROCUREMENT_ITEM_UNIT_INVALID_MESSAGE,
            path: ["unit"],
        });
    }
    if (unit === "custom" && !customUnit) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: items_1.PROCUREMENT_ITEM_UNIT_CUSTOM_REQUIRED_MESSAGE,
            path: ["customUnit"],
        });
    }
    if (!Number.isFinite(unitPrice ?? NaN) || (unitPrice ?? 0) <= 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: items_1.PROCUREMENT_ITEM_PRICE_POSITIVE_MESSAGE,
            path: ["unitPrice"],
        });
    }
    if (minQuantity !== undefined && minQuantity < 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: items_1.PROCUREMENT_ITEM_MIN_QUANTITY_INVALID_MESSAGE,
            path: ["minQuantity"],
        });
    }
    if (maxQuantity !== undefined && maxQuantity < 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: items_1.PROCUREMENT_ITEM_MAX_QUANTITY_INVALID_MESSAGE,
            path: ["maxQuantity"],
        });
    }
    if (minQuantity !== undefined &&
        maxQuantity !== undefined &&
        maxQuantity < minQuantity) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: items_1.PROCUREMENT_ITEM_QUANTITY_RANGE_INVALID_MESSAGE,
            path: ["maxQuantity"],
        });
    }
})
    .transform((value) => {
    const resolvedUnitOption = (0, items_1.normalizeProcurementItemUnitOption)(value.unit);
    const resolvedCustomUnit = (0, items_1.normalizeProcurementItemUnit)(value.customUnit);
    const resolvedUnit = resolvedUnitOption === "custom"
        ? resolvedCustomUnit
        : (0, items_1.normalizeProcurementItemUnit)(resolvedUnitOption);
    return {
        categoryId: (0, input_1.normalizePlainText)(value.categoryId),
        complianceFlags: (0, items_1.normalizeComplianceFlags)(value.complianceFlags),
        customUnit: resolvedUnitOption === "custom" ? resolvedCustomUnit : undefined,
        description: (0, input_1.normalizePlainText)(value.description ?? "").length > 0
            ? (0, input_1.normalizePlainText)(value.description ?? "")
            : undefined,
        maxQuantity: (0, items_1.normalizeQuantityLimit)(value.maxQuantity),
        minQuantity: (0, items_1.normalizeQuantityLimit)(value.minQuantity),
        name: (0, items_1.normalizeProcurementItemDisplayName)(value.name),
        normalizedName: (0, items_1.normalizeProcurementItemName)(value.name),
        procurementMethod: (0, items_1.normalizeProcurementMethod)(value.procurementMethod) ?? "RFQ",
        sourceOfFunds: (0, input_1.normalizePlainText)(value.sourceOfFunds ?? "").length > 0
            ? (0, input_1.normalizePlainText)(value.sourceOfFunds ?? "")
            : "GOK",
        unit: resolvedUnit,
        unitOption: resolvedUnitOption,
        unitPrice: (0, items_1.normalizeUnitPrice)(value.unitPrice) ?? 0,
    };
});
