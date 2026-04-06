import {
    formatProcurementItemMaximumQuantityMessage,
    formatProcurementItemMinimumQuantityMessage,
    procurementItemUnitAllowsDecimal,
    PROCUREMENT_ITEM_WORKSPACE_DUPLICATE_MESSAGE,
    PROCUREMENT_ITEM_WORKSPACE_INTEGER_ONLY_MESSAGE,
    PROCUREMENT_ITEM_WORKSPACE_QUANTITY_INVALID_MESSAGE,
    PROCUREMENT_ITEM_WORKSPACE_QUANTITY_NEGATIVE_MESSAGE,
    PROCUREMENT_ITEM_WORKSPACE_UNAVAILABLE_MESSAGE,
} from "../procurement-officer/items";

export interface DepartmentUserWorkspaceValidationQuarterTotals {
    q1: number | null | string | undefined;
    q2: number | null | string | undefined;
    q3: number | null | string | undefined;
    q4: number | null | string | undefined;
}

export type DepartmentUserWorkspaceValidationQuantityKey =
    keyof DepartmentUserWorkspaceValidationQuarterTotals;

export interface DepartmentUserWorkspaceValidationItem {
    blockId?: string | null;
    categoryId: string;
    isActive: boolean;
    itemDescription: string;
    itemId?: string | null;
    itemName: string;
    maxQuantity?: number | null;
    minQuantity?: number | null;
    quantities: DepartmentUserWorkspaceValidationQuarterTotals;
    rawQuantities?: DepartmentUserWorkspaceValidationQuarterTotals | null;
    transientQuantityFeedback?: Partial<
        Record<DepartmentUserWorkspaceValidationQuantityKey, string | null>
    > | null;
    unitOfMeasurement?: string | null;
}

export interface DepartmentUserWorkspaceValidationCategory {
    categoryId: string;
    categoryName: string;
    items: readonly DepartmentUserWorkspaceValidationItem[];
}

export interface DepartmentUserWorkspaceBudgetValidationInput {
    canSubmitByBudget: boolean;
    reason: string;
}

export interface DepartmentUserWorkspaceValidationIssue {
    blockId: string | null;
    blocksSubmission: boolean;
    categoryId: string;
    code:
        | "duplicate_item"
        | "inactive_item"
        | "invalid_quantity"
        | "maximum_quantity"
        | "minimum_quantity_reference"
        | "whole_number_required";
    itemId: string | null;
    itemName: string;
    message: string;
    quantityKey?: keyof DepartmentUserWorkspaceValidationQuarterTotals;
    severity: "error" | "warning";
}

export interface DepartmentUserWorkspaceValidationState {
    hasBlockingIssues: boolean;
    issues: DepartmentUserWorkspaceValidationIssue[];
    itemIssuesByBlockId: Record<string, DepartmentUserWorkspaceValidationIssue[]>;
    submitBlockedReasons: string[];
    validationUnavailableReason: string | null;
}

export interface DepartmentUserQuantityNormalizationResult {
    message: string | null;
    normalizedValue: number;
    precision: number;
}

const QUANTITY_KEYS = ["q1", "q2", "q3", "q4"] as const satisfies ReadonlyArray<
    keyof DepartmentUserWorkspaceValidationQuarterTotals
>;

function mapQuantityMessageToIssueCode(
    message: string,
): DepartmentUserWorkspaceValidationIssue["code"] {
    if (message.includes(PROCUREMENT_ITEM_WORKSPACE_INTEGER_ONLY_MESSAGE)) {
        return "whole_number_required";
    }

    if (message.includes("Maximum quantity is ")) {
        return "maximum_quantity";
    }

    return "invalid_quantity";
}

function coerceFiniteNumber(
    value: number | null | string | undefined,
): number | null {
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

function roundQuantity(value: number, precision: number): number {
    if (precision <= 0) {
        return value;
    }

    const multiplier = 1 / precision;
    return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function combineValidationMessages(
    ...messages: Array<string | null | undefined>
): string | null {
    const normalizedMessages = Array.from(
        new Set(
            messages
                .map((message) => message?.trim())
                .filter((message): message is string => Boolean(message)),
        ),
    );

    return normalizedMessages.length > 0
        ? normalizedMessages.join(". ")
        : null;
}

export function getDepartmentUserQuantityFieldPrecision(
    unitOfMeasurement: string | null | undefined,
): number {
    return procurementItemUnitAllowsDecimal(unitOfMeasurement) ? 0.01 : 1;
}

export function normalizeDepartmentUserQuantityValue(args: {
    maxQuantity?: number | null;
    unitOfMeasurement?: string | null;
    value: number | null | string | undefined;
}): DepartmentUserQuantityNormalizationResult {
    const parsedValue = coerceFiniteNumber(args.value);
    const precision = getDepartmentUserQuantityFieldPrecision(args.unitOfMeasurement);

    if (parsedValue === null) {
        return {
            message: PROCUREMENT_ITEM_WORKSPACE_QUANTITY_INVALID_MESSAGE,
            normalizedValue: 0,
            precision,
        };
    }

    if (parsedValue < 0) {
        return {
            message: PROCUREMENT_ITEM_WORKSPACE_QUANTITY_NEGATIVE_MESSAGE,
            normalizedValue: 0,
            precision,
        };
    }

    let nextValue = parsedValue;
    let nextMessage: string | null = null;

    if (precision === 1) {
        const wholeNumberValue = Math.trunc(nextValue);
        if (wholeNumberValue !== nextValue) {
            nextValue = wholeNumberValue;
            nextMessage = PROCUREMENT_ITEM_WORKSPACE_INTEGER_ONLY_MESSAGE;
        }
    }

    const maxQuantity = coerceFiniteNumber(args.maxQuantity ?? null);
    if (maxQuantity !== null && maxQuantity >= 0 && nextValue > maxQuantity) {
        nextValue = maxQuantity;
        nextMessage = combineValidationMessages(
            nextMessage,
            formatProcurementItemMaximumQuantityMessage(maxQuantity),
        );
    }

    return {
        message: nextMessage,
        normalizedValue: roundQuantity(nextValue, precision),
        precision,
    };
}

function appendIssue(
    issues: DepartmentUserWorkspaceValidationIssue[],
    issue: DepartmentUserWorkspaceValidationIssue,
): void {
    issues.push(issue);
}

function dedupeMessages(messages: readonly string[]): string[] {
    return Array.from(new Set(messages.filter((message) => message.trim().length > 0)));
}

export function summarizeDepartmentUserBlockValidationIssues(
    issues: readonly DepartmentUserWorkspaceValidationIssue[],
): string | null {
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

export function evaluateDepartmentUserWorkspaceValidation(args: {
    budgetState?: DepartmentUserWorkspaceBudgetValidationInput | null;
    categories: readonly DepartmentUserWorkspaceValidationCategory[];
    validationUnavailableReason?: string | null;
}): DepartmentUserWorkspaceValidationState {
    const issues: DepartmentUserWorkspaceValidationIssue[] = [];
    const seenCategoryItemKeys = new Set<string>();

    for (const category of args.categories) {
        for (const item of category.items) {
            const normalizedItemId = item.itemId?.trim() ?? "";
            const blockId = item.blockId?.trim() || null;
            const itemName = item.itemName.trim().length > 0
                ? item.itemName
                : item.itemDescription;

            if (normalizedItemId.length > 0) {
                const duplicateKey = `${category.categoryId}::${normalizedItemId}`;
                if (seenCategoryItemKeys.has(duplicateKey)) {
                    appendIssue(issues, {
                        blockId,
                        blocksSubmission: true,
                        categoryId: category.categoryId,
                        code: "duplicate_item",
                        itemId: normalizedItemId,
                        itemName,
                        message: PROCUREMENT_ITEM_WORKSPACE_DUPLICATE_MESSAGE,
                        severity: "error",
                    });
                } else {
                    seenCategoryItemKeys.add(duplicateKey);
                }
            }

            if (!item.isActive) {
                appendIssue(issues, {
                    blockId,
                    blocksSubmission: true,
                    categoryId: category.categoryId,
                    code: "inactive_item",
                    itemId: normalizedItemId || null,
                    itemName,
                    message: PROCUREMENT_ITEM_WORKSPACE_UNAVAILABLE_MESSAGE,
                    severity: "error",
                });
            }

            for (const quantityKey of QUANTITY_KEYS) {
                const rawQuantityValue =
                    item.rawQuantities?.[quantityKey] ?? item.quantities[quantityKey];
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
                    code: mapQuantityMessageToIssueCode(quantityResult.message),
                    itemId: normalizedItemId || null,
                    itemName,
                    message: quantityResult.message,
                    quantityKey,
                    severity: "warning",
                });
            }

            for (const quantityKey of QUANTITY_KEYS) {
                const transientMessage =
                    item.transientQuantityFeedback?.[quantityKey] ?? null;
                if (!transientMessage) {
                    continue;
                }

                const alreadyRecorded = issues.some(
                    (issue) =>
                        issue.blockId === blockId &&
                        issue.quantityKey === quantityKey &&
                        issue.message === transientMessage,
                );
                if (alreadyRecorded) {
                    continue;
                }

                appendIssue(issues, {
                    blockId,
                    blocksSubmission: false,
                    categoryId: category.categoryId,
                    code: mapQuantityMessageToIssueCode(transientMessage),
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
                        code: "minimum_quantity_reference",
                        itemId: normalizedItemId || null,
                        itemName,
                        message: formatProcurementItemMinimumQuantityMessage(minQuantity),
                        severity: "warning",
                    });
                }
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
    const itemIssuesByBlockId: Record<string, DepartmentUserWorkspaceValidationIssue[]> = {};

    for (const issue of issues) {
        if (!issue.blockId) {
            continue;
        }

        const currentIssues = itemIssuesByBlockId[issue.blockId] ?? [];
        currentIssues.push(issue);
        itemIssuesByBlockId[issue.blockId] = currentIssues;
    }

    return {
        hasBlockingIssues:
            submitBlockedReasons.length > 0 ||
            issues.some((issue) => issue.blocksSubmission),
        issues,
        itemIssuesByBlockId,
        submitBlockedReasons,
        validationUnavailableReason: args.validationUnavailableReason ?? null,
    };
}
