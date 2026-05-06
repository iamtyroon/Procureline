"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeComplianceFlags = exports.formatProcurementItemMinimumQuantityMessage = exports.formatProcurementItemMaximumQuantityMessage = exports.procurementItemUnitAllowsDecimal = exports.normalizeProcurementItemUnitOption = exports.PROCUREMENT_ITEM_COMPLIANCE_FLAGS = exports.PROCUREMENT_ITEM_UNITS = exports.PROCUREMENT_ITEM_WORKSPACE_INTEGER_ONLY_MESSAGE = exports.PROCUREMENT_ITEM_WORKSPACE_QUANTITY_INVALID_MESSAGE = exports.PROCUREMENT_ITEM_WORKSPACE_QUANTITY_NEGATIVE_MESSAGE = exports.PROCUREMENT_ITEM_WORKSPACE_UNAVAILABLE_MESSAGE = exports.PROCUREMENT_ITEM_WORKSPACE_DUPLICATE_MESSAGE = void 0;
const input_1 = require("@/lib/shared/security/input");
exports.PROCUREMENT_ITEM_WORKSPACE_DUPLICATE_MESSAGE = "Item already in this category";
exports.PROCUREMENT_ITEM_WORKSPACE_UNAVAILABLE_MESSAGE = "This item is no longer available in the live catalog.";
exports.PROCUREMENT_ITEM_WORKSPACE_QUANTITY_NEGATIVE_MESSAGE = "Quantity cannot be negative";
exports.PROCUREMENT_ITEM_WORKSPACE_QUANTITY_INVALID_MESSAGE = "Quantity must be a valid number";
exports.PROCUREMENT_ITEM_WORKSPACE_INTEGER_ONLY_MESSAGE = "Whole numbers only for this unit";
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
