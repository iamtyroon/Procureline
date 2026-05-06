"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateDepartmentUserWorkspaceValidation = exports.summarizeDepartmentUserBlockValidationIssues = exports.normalizeDepartmentUserQuantityValue = exports.getDepartmentUserQuantityFieldPrecision = void 0;
const items_1 = require("@/lib/shared/procurement/items");
const QUANTITY_KEYS = ["q1", "q2", "q3", "q4"];
function mapQuantityMessageToIssueCode(message) {
    if (message.includes(items_1.PROCUREMENT_ITEM_WORKSPACE_INTEGER_ONLY_MESSAGE)) {
        return "whole_number_required";
    }
    if (message.includes("Maximum quantity is ")) {
        return "maximum_quantity";
    }
    return "invalid_quantity";
}
function coerceFiniteNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}
function roundQuantity(value, precision) {
    if (precision <= 0) {
        return value;
    }
    const multiplier = 1 / precision;
    return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}
function combineValidationMessages(...messages) {
    const normalizedMessages = Array.from(new Set(messages
        .map((message) => message?.trim())
        .filter((message) => Boolean(message))));
    return normalizedMessages.length > 0
        ? normalizedMessages.join(". ")
        : null;
}
function getDepartmentUserQuantityFieldPrecision(unitOfMeasurement) {
    return (0, items_1.procurementItemUnitAllowsDecimal)(unitOfMeasurement) ? 0.01 : 1;
}
exports.getDepartmentUserQuantityFieldPrecision = getDepartmentUserQuantityFieldPrecision;
function normalizeDepartmentUserQuantityValue(args) {
    const parsedValue = coerceFiniteNumber(args.value);
    const precision = getDepartmentUserQuantityFieldPrecision(args.unitOfMeasurement);
    if (parsedValue === null) {
        return {
            message: items_1.PROCUREMENT_ITEM_WORKSPACE_QUANTITY_INVALID_MESSAGE,
            normalizedValue: 0,
            precision,
        };
    }
    if (parsedValue < 0) {
        return {
            message: items_1.PROCUREMENT_ITEM_WORKSPACE_QUANTITY_NEGATIVE_MESSAGE,
            normalizedValue: 0,
            precision,
        };
    }
    let nextValue = parsedValue;
    let nextMessage = null;
    if (precision === 1) {
        const wholeNumberValue = Math.trunc(nextValue);
        if (wholeNumberValue !== nextValue) {
            nextValue = wholeNumberValue;
            nextMessage = items_1.PROCUREMENT_ITEM_WORKSPACE_INTEGER_ONLY_MESSAGE;
        }
    }
    const maxQuantity = coerceFiniteNumber(args.maxQuantity ?? null);
    if (maxQuantity !== null && maxQuantity >= 0 && nextValue > maxQuantity) {
        nextValue = maxQuantity;
        nextMessage = combineValidationMessages(nextMessage, (0, items_1.formatProcurementItemMaximumQuantityMessage)(maxQuantity));
    }
    return {
        message: nextMessage,
        normalizedValue: roundQuantity(nextValue, precision),
        precision,
    };
}
exports.normalizeDepartmentUserQuantityValue = normalizeDepartmentUserQuantityValue;
function appendIssue(issues, issue) {
    issues.push(issue);
}
function dedupeMessages(messages) {
    return Array.from(new Set(messages.filter((message) => message.trim().length > 0)));
}
function summarizeDepartmentUserBlockValidationIssues(issues) {
    const uniqueMessages = dedupeMessages(issues.map((issue) => issue.message));
    if (uniqueMessages.length === 0) {
        return null;
    }
    const summaryMessages = uniqueMessages
        .slice(0, 2)
        .map((message) => message.replace(/[\s.!?]+$/u, "").trim())
        .filter((message) => message.length > 0);
    return summaryMessages.length > 0 ? summaryMessages.join(". ") : null;
}
exports.summarizeDepartmentUserBlockValidationIssues = summarizeDepartmentUserBlockValidationIssues;
function evaluateDepartmentUserWorkspaceValidation(args) {
    const issues = [];
    const seenCategoryItemKeys = new Set();
    for (const category of args.categories) {
        for (const item of category.items) {
            const normalizedItemId = item.itemId?.trim() ?? "";
            const blockId = item.blockId?.trim() || null;
            const itemName = item.itemName.trim().length > 0
                ? item.itemName
                : item.itemDescription;
            const itemFixTarget = blockId
                ? {
                    id: blockId,
                    label: itemName,
                    type: "workspace_block",
                }
                : category.categoryId.trim().length > 0
                    ? {
                        id: category.categoryId,
                        label: category.categoryName,
                        type: "workspace_category",
                    }
                    : null;
            if (normalizedItemId.length > 0) {
                const duplicateKey = `${category.categoryId}::${normalizedItemId}`;
                if (seenCategoryItemKeys.has(duplicateKey)) {
                    appendIssue(issues, {
                        blockId,
                        blocksSubmission: true,
                        categoryId: category.categoryId,
                        categoryName: category.categoryName,
                        code: "duplicate_item",
                        fixTarget: itemFixTarget,
                        itemId: normalizedItemId,
                        itemName,
                        message: items_1.PROCUREMENT_ITEM_WORKSPACE_DUPLICATE_MESSAGE,
                        severity: "error",
                    });
                }
                else {
                    seenCategoryItemKeys.add(duplicateKey);
                }
            }
            if (!item.isActive) {
                appendIssue(issues, {
                    blockId,
                    blocksSubmission: true,
                    categoryId: category.categoryId,
                    categoryName: category.categoryName,
                    code: "inactive_item",
                    fixTarget: itemFixTarget,
                    itemId: normalizedItemId || null,
                    itemName,
                    message: items_1.PROCUREMENT_ITEM_WORKSPACE_UNAVAILABLE_MESSAGE,
                    severity: "error",
                });
            }
            for (const quantityKey of QUANTITY_KEYS) {
                const rawQuantityValue = item.rawQuantities?.[quantityKey] ?? item.quantities[quantityKey];
                const quantityResult = normalizeDepartmentUserQuantityValue({
                    maxQuantity: item.maxQuantity ?? null,
                    unitOfMeasurement: item.unitOfMeasurement ?? null,
                    value: rawQuantityValue,
                });
                if (!quantityResult.message) {
                    continue;
                }
                appendIssue(issues, {
                    blockId,
                    blocksSubmission: false,
                    categoryId: category.categoryId,
                    categoryName: category.categoryName,
                    code: mapQuantityMessageToIssueCode(quantityResult.message),
                    fixTarget: itemFixTarget,
                    itemId: normalizedItemId || null,
                    itemName,
                    message: quantityResult.message,
                    quantityKey,
                    severity: "warning",
                });
            }
            for (const quantityKey of QUANTITY_KEYS) {
                const transientMessage = item.transientQuantityFeedback?.[quantityKey] ?? null;
                if (!transientMessage) {
                    continue;
                }
                const alreadyRecorded = issues.some((issue) => issue.blockId === blockId &&
                    issue.quantityKey === quantityKey &&
                    issue.message === transientMessage);
                if (alreadyRecorded) {
                    continue;
                }
                appendIssue(issues, {
                    blockId,
                    blocksSubmission: false,
                    categoryId: category.categoryId,
                    categoryName: category.categoryName,
                    code: mapQuantityMessageToIssueCode(transientMessage),
                    fixTarget: itemFixTarget,
                    itemId: normalizedItemId || null,
                    itemName,
                    message: transientMessage,
                    quantityKey,
                    severity: "warning",
                });
            }
            const minQuantity = coerceFiniteNumber(item.minQuantity ?? null);
            if (minQuantity !== null && minQuantity > 0) {
                const hasBelowMinimumNonZeroQuantity = QUANTITY_KEYS.some((quantityKey) => {
                    const quantityValue = normalizeDepartmentUserQuantityValue({
                        maxQuantity: item.maxQuantity ?? null,
                        unitOfMeasurement: item.unitOfMeasurement ?? null,
                        value: item.quantities[quantityKey],
                    }).normalizedValue;
                    return quantityValue > 0 && quantityValue < minQuantity;
                });
                if (hasBelowMinimumNonZeroQuantity) {
                    appendIssue(issues, {
                        blockId,
                        blocksSubmission: false,
                        categoryId: category.categoryId,
                        categoryName: category.categoryName,
                        code: "minimum_quantity_reference",
                        fixTarget: itemFixTarget,
                        itemId: normalizedItemId || null,
                        itemName,
                        message: (0, items_1.formatProcurementItemMinimumQuantityMessage)(minQuantity),
                        severity: "warning",
                    });
                }
            }
            const totalQuantity = QUANTITY_KEYS.reduce((sum, quantityKey) => {
                const quantityValue = normalizeDepartmentUserQuantityValue({
                    maxQuantity: item.maxQuantity ?? null,
                    unitOfMeasurement: item.unitOfMeasurement ?? null,
                    value: item.quantities[quantityKey],
                }).normalizedValue;
                return sum + quantityValue;
            }, 0);
            if (totalQuantity <= 0) {
                appendIssue(issues, {
                    blockId,
                    blocksSubmission: true,
                    categoryId: category.categoryId,
                    categoryName: category.categoryName,
                    code: "zero_quantity",
                    fixTarget: itemFixTarget,
                    itemId: normalizedItemId || null,
                    itemName,
                    message: `${itemName} has zero quantity. Enter quantity or remove item.`,
                    severity: "error",
                });
            }
        }
    }
    const submitBlockedReasons = dedupeMessages([
        ...(args.budgetState && !args.budgetState.canSubmitByBudget
            ? [args.budgetState.reason]
            : []),
        ...issues
            .filter((issue) => issue.blocksSubmission)
            .map((issue) => issue.message),
    ]);
    const itemIssuesByBlockId = {};
    for (const issue of issues) {
        if (!issue.blockId) {
            continue;
        }
        const currentIssues = itemIssuesByBlockId[issue.blockId] ?? [];
        currentIssues.push(issue);
        itemIssuesByBlockId[issue.blockId] = currentIssues;
    }
    return {
        hasBlockingIssues: submitBlockedReasons.length > 0 ||
            issues.some((issue) => issue.blocksSubmission),
        issues,
        itemIssuesByBlockId,
        submitBlockedReasons,
        validationUnavailableReason: args.validationUnavailableReason ?? null,
    };
}
exports.evaluateDepartmentUserWorkspaceValidation = evaluateDepartmentUserWorkspaceValidation;
