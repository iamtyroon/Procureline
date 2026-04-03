import { z } from "zod";
import {
    normalizeComplianceFlags,
    normalizeProcurementItemDisplayName,
    normalizeProcurementItemName,
    normalizeProcurementItemUnit,
    normalizeProcurementItemUnitOption,
    normalizeProcurementMethod,
    normalizeQuantityLimit,
    normalizeUnitPrice,
    PROCUREMENT_ITEM_CATEGORY_REQUIRED_MESSAGE,
    PROCUREMENT_ITEM_MAX_QUANTITY_INVALID_MESSAGE,
    PROCUREMENT_ITEM_MIN_QUANTITY_INVALID_MESSAGE,
    PROCUREMENT_ITEM_NAME_REQUIRED_MESSAGE,
    PROCUREMENT_ITEM_PRICE_POSITIVE_MESSAGE,
    PROCUREMENT_ITEM_QUANTITY_RANGE_INVALID_MESSAGE,
    PROCUREMENT_ITEM_UNIT_CUSTOM_REQUIRED_MESSAGE,
    PROCUREMENT_ITEM_UNIT_INVALID_MESSAGE,
    PROCUREMENT_ITEM_UNIT_REQUIRED_MESSAGE,
} from "../procurement-officer/items";
import { normalizePlainText } from "../security/input";

export const itemFormSchema = z
    .object({
        categoryId: z.string(),
        complianceFlags: z.array(z.string()).default([]),
        customUnit: z.string().optional(),
        maxQuantity: z.union([z.number(), z.nan()]).optional(),
        minQuantity: z.union([z.number(), z.nan()]).optional(),
        name: z.string(),
        procurementMethod: z.string().optional(),
        sourceOfFunds: z.string().optional(),
        unit: z.string(),
        unitPrice: z.union([z.number(), z.nan()]),
    })
    .superRefine((value, ctx) => {
        const name = normalizeProcurementItemDisplayName(value.name);
        const categoryId = normalizePlainText(value.categoryId);
        const unit = normalizeProcurementItemUnitOption(value.unit);
        const customUnit = normalizeProcurementItemUnit(value.customUnit);
        const unitPrice = normalizeUnitPrice(value.unitPrice);
        const minQuantity = normalizeQuantityLimit(value.minQuantity);
        const maxQuantity = normalizeQuantityLimit(value.maxQuantity);

        if (categoryId.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: PROCUREMENT_ITEM_CATEGORY_REQUIRED_MESSAGE,
                path: ["categoryId"],
            });
        }

        if (name.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: PROCUREMENT_ITEM_NAME_REQUIRED_MESSAGE,
                path: ["name"],
            });
        }

        if (!unit) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    normalizePlainText(value.unit).length === 0
                        ? PROCUREMENT_ITEM_UNIT_REQUIRED_MESSAGE
                        : PROCUREMENT_ITEM_UNIT_INVALID_MESSAGE,
                path: ["unit"],
            });
        }

        if (unit === "custom" && !customUnit) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: PROCUREMENT_ITEM_UNIT_CUSTOM_REQUIRED_MESSAGE,
                path: ["customUnit"],
            });
        }

        if (!Number.isFinite(unitPrice ?? NaN) || (unitPrice ?? 0) <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: PROCUREMENT_ITEM_PRICE_POSITIVE_MESSAGE,
                path: ["unitPrice"],
            });
        }

        if (minQuantity !== undefined && minQuantity < 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: PROCUREMENT_ITEM_MIN_QUANTITY_INVALID_MESSAGE,
                path: ["minQuantity"],
            });
        }

        if (maxQuantity !== undefined && maxQuantity < 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: PROCUREMENT_ITEM_MAX_QUANTITY_INVALID_MESSAGE,
                path: ["maxQuantity"],
            });
        }

        if (
            minQuantity !== undefined &&
            maxQuantity !== undefined &&
            maxQuantity < minQuantity
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: PROCUREMENT_ITEM_QUANTITY_RANGE_INVALID_MESSAGE,
                path: ["maxQuantity"],
            });
        }
    })
    .transform((value) => {
        const resolvedUnitOption = normalizeProcurementItemUnitOption(value.unit);
        const resolvedCustomUnit = normalizeProcurementItemUnit(value.customUnit);
        const resolvedUnit =
            resolvedUnitOption === "custom"
                ? resolvedCustomUnit
                : normalizeProcurementItemUnit(resolvedUnitOption);

        return {
            categoryId: normalizePlainText(value.categoryId),
            complianceFlags: normalizeComplianceFlags(value.complianceFlags),
            customUnit: resolvedUnitOption === "custom" ? resolvedCustomUnit : undefined,
            maxQuantity: normalizeQuantityLimit(value.maxQuantity),
            minQuantity: normalizeQuantityLimit(value.minQuantity),
            name: normalizeProcurementItemDisplayName(value.name),
            normalizedName: normalizeProcurementItemName(value.name),
            procurementMethod:
                normalizeProcurementMethod(value.procurementMethod) ?? "RFQ",
            sourceOfFunds:
                normalizePlainText(value.sourceOfFunds ?? "").length > 0
                    ? normalizePlainText(value.sourceOfFunds ?? "")
                    : "GOK",
            unit: resolvedUnit,
            unitOption: resolvedUnitOption,
            unitPrice: normalizeUnitPrice(value.unitPrice) ?? 0,
        };
    });

export type ItemFormData = z.infer<typeof itemFormSchema>;
