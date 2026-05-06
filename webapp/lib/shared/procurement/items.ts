import { normalizePlainText } from "@/lib/shared/security/input";

export const PROCUREMENT_ITEM_WORKSPACE_DUPLICATE_MESSAGE =
    "Item already in this category";
export const PROCUREMENT_ITEM_WORKSPACE_UNAVAILABLE_MESSAGE =
    "This item is no longer available in the live catalog.";
export const PROCUREMENT_ITEM_WORKSPACE_QUANTITY_NEGATIVE_MESSAGE =
    "Quantity cannot be negative";
export const PROCUREMENT_ITEM_WORKSPACE_QUANTITY_INVALID_MESSAGE =
    "Quantity must be a valid number";
export const PROCUREMENT_ITEM_WORKSPACE_INTEGER_ONLY_MESSAGE =
    "Whole numbers only for this unit";

export const PROCUREMENT_ITEM_UNITS = [
    "each",
    "box",
    "kg",
    "liter",
    "ream",
    "set",
    "pair",
    "custom",
] as const;

export const PROCUREMENT_ITEM_COMPLIANCE_FLAGS = [
    "agpo",
    "pwd",
    "local_content",
] as const;

export type ProcurementItemUnit = (typeof PROCUREMENT_ITEM_UNITS)[number];
export type ProcurementItemComplianceFlag =
    (typeof PROCUREMENT_ITEM_COMPLIANCE_FLAGS)[number];

export function normalizeProcurementItemUnitOption(
    input: string | null | undefined,
): ProcurementItemUnit | undefined {
    const normalized = normalizePlainText(input ?? "").toLowerCase();
    return (
        PROCUREMENT_ITEM_UNITS.find((unit) => unit === normalized) ?? undefined
    );
}

export function procurementItemUnitAllowsDecimal(
    input: string | null | undefined,
): boolean {
    const normalizedUnit = normalizeProcurementItemUnitOption(input);
    return normalizedUnit === "kg" || normalizedUnit === "liter";
}

function formatProcurementItemQuantityNumber(limit: number): string {
    return Number.isInteger(limit) ? String(limit) : String(limit);
}

export function formatProcurementItemMaximumQuantityMessage(
    limit: number,
): string {
    return `Maximum quantity is ${formatProcurementItemQuantityNumber(limit)}`;
}

export function formatProcurementItemMinimumQuantityMessage(
    limit: number,
): string {
    return `Minimum catalog quantity is ${formatProcurementItemQuantityNumber(limit)}`;
}

export function normalizeComplianceFlags(
    input: readonly string[] | string | null | undefined,
): ProcurementItemComplianceFlag[] {
    const rawValues = Array.isArray(input)
        ? input
        : typeof input === "string"
          ? input.split(/[;,]/)
          : [];

    return Array.from(
        new Set(
            rawValues
                .map((value) => normalizePlainText(value).toLowerCase())
                .filter((value): value is ProcurementItemComplianceFlag =>
                    PROCUREMENT_ITEM_COMPLIANCE_FLAGS.includes(
                        value as ProcurementItemComplianceFlag,
                    ),
                ),
        ),
    );
}
