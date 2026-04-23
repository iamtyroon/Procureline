"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartmentUserReservedSubmitState = exports.getDepartmentUserWorkspaceAnnouncement = exports.applyDepartmentWorkspaceRollup = exports.extractDepartmentUserWorkspaceCategoriesFromWorkspaceRecord = exports.resolveDepartmentUserDisplayedWorkspaceSummary = exports.workspaceRecordHasMeaningfulDepartmentContent = exports.workspaceRecordHasDepartmentBlock = exports.hasMeaningfulDepartmentUserWorkspaceSummary = exports.hasMeaningfulDepartmentUserPersistedPlanSummary = exports.buildDepartmentUserWorkspaceSummaryFromPersistedPlan = exports.calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord = exports.mapDepartmentUserBudgetMeterState = exports.calculateDepartmentUserWorkspaceSummary = exports.calculateDepartmentUserDepartmentRollup = exports.calculateDepartmentUserCategoryRollup = exports.calculateDepartmentUserItemRollup = exports.sanitizeNonNegativeNumber = exports.sumQuarterTotals = exports.createEmptyQuarterTotals = exports.DU_BUDGET_WARNING_THRESHOLD_PERCENT = void 0;
const blockly_serialization_1 = require("./blockly-serialization");
const workspace_catalog_identity_1 = require("./workspace-catalog-identity");
const compliance_1 = require("../procurement/compliance");
const workspace_validation_1 = require("./workspace-validation");
const plan_submission_1 = require("./plan-submission");
exports.DU_BUDGET_WARNING_THRESHOLD_PERCENT = 80;
function createEmptyQuarterTotals() {
    return {
        q1: 0,
        q2: 0,
        q3: 0,
        q4: 0,
    };
}
exports.createEmptyQuarterTotals = createEmptyQuarterTotals;
function sumQuarterTotals(left, right) {
    return {
        q1: roundCurrency(left.q1 + right.q1),
        q2: roundCurrency(left.q2 + right.q2),
        q3: roundCurrency(left.q3 + right.q3),
        q4: roundCurrency(left.q4 + right.q4),
    };
}
exports.sumQuarterTotals = sumQuarterTotals;
function sanitizeNonNegativeNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return roundCurrency(Math.max(0, value));
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return roundCurrency(Math.max(0, parsed));
        }
    }
    return 0;
}
exports.sanitizeNonNegativeNumber = sanitizeNonNegativeNumber;
function parseOptionalFiniteNumber(value) {
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
function parseSerializedBoolean(value) {
    return value?.trim().toLowerCase() !== "false";
}
function normalizeWorkspaceText(value) {
    const normalizedValue = value?.trim() ?? "";
    if (normalizedValue.length === 0 || normalizedValue === "Not set") {
        return null;
    }
    return normalizedValue;
}
function calculateDepartmentUserItemRollup(item) {
    const unitPrice = sanitizeNonNegativeNumber(item.unitPrice);
    const quantities = {
        q1: sanitizeNonNegativeNumber(item.quantities.q1),
        q2: sanitizeNonNegativeNumber(item.quantities.q2),
        q3: sanitizeNonNegativeNumber(item.quantities.q3),
        q4: sanitizeNonNegativeNumber(item.quantities.q4),
    };
    const quarterTotals = {
        q1: roundCurrency(quantities.q1 * unitPrice),
        q2: roundCurrency(quantities.q2 * unitPrice),
        q3: roundCurrency(quantities.q3 * unitPrice),
        q4: roundCurrency(quantities.q4 * unitPrice),
    };
    const totalQuantity = roundCurrency(quantities.q1 + quantities.q2 + quantities.q3 + quantities.q4);
    const totalCost = roundCurrency(quarterTotals.q1 +
        quarterTotals.q2 +
        quarterTotals.q3 +
        quarterTotals.q4);
    return {
        blockId: item.blockId ?? null,
        complianceFlags: (0, compliance_1.serializeProcurementComplianceFlags)(item.complianceFlags).split(",").filter(Boolean),
        isActive: item.isActive ?? true,
        itemDescription: item.itemDescription,
        itemId: item.itemId?.trim() ? item.itemId : null,
        itemName: item.itemName ?? item.itemDescription,
        maxQuantity: parseOptionalFiniteNumber(item.maxQuantity ?? null),
        minQuantity: parseOptionalFiniteNumber(item.minQuantity ?? null),
        quarterTotals,
        totalCost,
        totalQuantity,
        unitOfMeasurement: normalizeWorkspaceText(item.unitOfMeasurement ?? null),
        unitPrice,
    };
}
exports.calculateDepartmentUserItemRollup = calculateDepartmentUserItemRollup;
function calculateDepartmentUserCategoryRollup(category) {
    const items = category.items.map(calculateDepartmentUserItemRollup);
    const quarterTotals = items.reduce((totals, item) => sumQuarterTotals(totals, item.quarterTotals), createEmptyQuarterTotals());
    return {
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        itemCount: items.length,
        items,
        quarterTotals,
        totalCost: roundCurrency(items.reduce((sum, item) => sum + item.totalCost, 0)),
    };
}
exports.calculateDepartmentUserCategoryRollup = calculateDepartmentUserCategoryRollup;
function calculateDepartmentUserDepartmentRollup(categories) {
    const categoryRollups = categories.map(calculateDepartmentUserCategoryRollup);
    const quarterTotals = categoryRollups.reduce((totals, category) => sumQuarterTotals(totals, category.quarterTotals), createEmptyQuarterTotals());
    return {
        categories: categoryRollups,
        departmentTotal: roundCurrency(categoryRollups.reduce((sum, category) => sum + category.totalCost, 0)),
        quarterTotals,
        totalItemCount: categoryRollups.reduce((sum, category) => sum + category.itemCount, 0),
    };
}
exports.calculateDepartmentUserDepartmentRollup = calculateDepartmentUserDepartmentRollup;
function calculateDepartmentUserWorkspaceSummary(args) {
    const rollup = calculateDepartmentUserDepartmentRollup(args.categories);
    const budgetState = mapDepartmentUserBudgetMeterState({
        totalBudget: args.totalBudget,
        usedAmount: rollup.departmentTotal,
    });
    const validationState = (0, workspace_validation_1.evaluateDepartmentUserWorkspaceValidation)({
        budgetState: budgetState.canSubmitByBudget
            ? null
            : {
                canSubmitByBudget: false,
                reason: budgetState.bannerText ??
                    "Budget allocation is unavailable, so submission must remain blocked.",
            },
        categories: args.categories.map((category) => ({
            categoryId: category.categoryId,
            categoryName: category.categoryName,
            items: category.items.map((item) => ({
                blockId: item.blockId ?? null,
                categoryId: category.categoryId,
                isActive: item.isActive ?? true,
                itemDescription: item.itemDescription,
                itemId: item.itemId ?? null,
                itemName: item.itemName ?? item.itemDescription,
                maxQuantity: item.maxQuantity ?? null,
                minQuantity: item.minQuantity ?? null,
                quantities: item.quantities,
                rawQuantities: item.rawQuantities ?? null,
                transientQuantityFeedback: item.transientQuantityFeedback ?? null,
                unitOfMeasurement: item.unitOfMeasurement ?? null,
            })),
        })),
        validationUnavailableReason: null,
    });
    return {
        ...rollup,
        budgetState,
        complianceState: (0, compliance_1.calculateProcurementComplianceSnapshot)({
            items: rollup.categories.flatMap((category) => category.items.map((item) => ({
                amount: item.totalCost,
                complianceFlags: item.complianceFlags,
            }))),
            totalEligibleSpend: rollup.departmentTotal,
        }),
        validationState,
    };
}
exports.calculateDepartmentUserWorkspaceSummary = calculateDepartmentUserWorkspaceSummary;
function mapDepartmentUserBudgetMeterState(args) {
    const totalBudget = sanitizeNonNegativeNumber(args.totalBudget);
    const usedAmount = sanitizeNonNegativeNumber(args.usedAmount);
    if (totalBudget <= 0) {
        return {
            advisoryText: "Budget allocation is unavailable. Planning totals remain visible, but submission must stay blocked until a usable budget is assigned.",
            announcementText: "Department budget allocation is unavailable. Submission remains blocked until a budget is assigned.",
            bannerText: null,
            canSubmitByBudget: false,
            overBudgetAmount: 0,
            remainingBudget: null,
            state: "unallocated",
            statusLabel: "Budget not allocated",
            totalBudget: null,
            usageLabel: "Unallocated",
            usedAmount,
            usedPercent: null,
        };
    }
    const usedPercent = roundPercent((usedAmount / totalBudget) * 100);
    const remainingBudget = roundCurrency(totalBudget - usedAmount);
    const overBudgetAmount = remainingBudget < 0 ? roundCurrency(Math.abs(remainingBudget)) : 0;
    if (usedAmount >= totalBudget) {
        const overBudgetMessage = `Budget exceeded by ${formatKenyanCurrency(overBudgetAmount)}.`;
        return {
            advisoryText: "Reduce quantities or remove items before submission can be unlocked.",
            announcementText: overBudgetMessage,
            bannerText: overBudgetMessage,
            canSubmitByBudget: false,
            overBudgetAmount,
            remainingBudget,
            state: "over_budget",
            statusLabel: "Budget exceeded",
            totalBudget,
            usageLabel: `${formatPercent(usedPercent)} used`,
            usedAmount,
            usedPercent,
        };
    }
    if (usedPercent >= exports.DU_BUDGET_WARNING_THRESHOLD_PERCENT) {
        return {
            advisoryText: "Approaching budget limit. Review the next additions carefully before submission.",
            announcementText: "Approaching budget limit.",
            bannerText: null,
            canSubmitByBudget: true,
            overBudgetAmount: 0,
            remainingBudget,
            state: "warning",
            statusLabel: "Approaching budget limit",
            totalBudget,
            usageLabel: `${formatPercent(usedPercent)} used`,
            usedAmount,
            usedPercent,
        };
    }
    return {
        advisoryText: "Within budget. Live totals update as quantities, prices, and catalog metadata change.",
        announcementText: "Department plan remains within budget.",
        bannerText: null,
        canSubmitByBudget: true,
        overBudgetAmount: 0,
        remainingBudget,
        state: "safe",
        statusLabel: "Within budget",
        totalBudget,
        usageLabel: `${formatPercent(usedPercent)} used`,
        usedAmount,
        usedPercent,
    };
}
exports.mapDepartmentUserBudgetMeterState = mapDepartmentUserBudgetMeterState;
function calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord(args) {
    const categories = extractDepartmentUserWorkspaceCategoriesFromWorkspaceRecord({
        items: args.items,
        refreshCatalogMetadata: args.refreshCatalogMetadata,
        workspaceState: args.workspaceState,
    });
    if (categories === null) {
        return null;
    }
    return calculateDepartmentUserWorkspaceSummary({
        categories,
        totalBudget: args.totalBudget,
    });
}
exports.calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord = calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord;
function buildDepartmentUserWorkspaceSummaryFromPersistedPlan(args) {
    const categories = args.persistedPlanSummary.categorySummaries.map((category) => ({
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        itemCount: category.itemCount,
        items: [],
        quarterTotals: createEmptyQuarterTotals(),
        totalCost: roundCurrency(category.amount),
    }));
    const departmentTotal = roundCurrency(sanitizeNonNegativeNumber(args.persistedPlanSummary.estimatedBudgetUsed));
    const budgetState = mapDepartmentUserBudgetMeterState({
        totalBudget: args.totalBudget,
        usedAmount: departmentTotal,
    });
    return {
        budgetState,
        categories,
        complianceState: departmentTotal > 0
            ? (0, compliance_1.createUnavailableProcurementComplianceSnapshot)({
                totalEligibleSpend: departmentTotal,
            })
            : (0, compliance_1.calculateProcurementComplianceSnapshot)({
                items: [],
                totalEligibleSpend: 0,
            }),
        departmentTotal,
        quarterTotals: createEmptyQuarterTotals(),
        totalItemCount: Math.max(0, Math.round(sanitizeNonNegativeNumber(args.persistedPlanSummary.itemCount))),
        validationState: (0, workspace_validation_1.evaluateDepartmentUserWorkspaceValidation)({
            budgetState: budgetState.canSubmitByBudget
                ? null
                : {
                    canSubmitByBudget: false,
                    reason: budgetState.bannerText ??
                        "Budget allocation is unavailable, so submission must remain blocked.",
                },
            categories: [],
            validationUnavailableReason: args.persistedPlanSummary.itemCount > 0 ||
                args.persistedPlanSummary.categorySummaries.length > 0
                ? "Item-level validation details are unavailable for this saved summary until Blockly workspace data is reloaded."
                : null,
        }),
    };
}
exports.buildDepartmentUserWorkspaceSummaryFromPersistedPlan = buildDepartmentUserWorkspaceSummaryFromPersistedPlan;
function hasMeaningfulDepartmentUserPersistedPlanSummary(persistedPlanSummary) {
    if (!persistedPlanSummary) {
        return false;
    }
    return (sanitizeNonNegativeNumber(persistedPlanSummary.estimatedBudgetUsed) > 0 ||
        sanitizeNonNegativeNumber(persistedPlanSummary.itemCount) > 0 ||
        persistedPlanSummary.categorySummaries.length > 0);
}
exports.hasMeaningfulDepartmentUserPersistedPlanSummary = hasMeaningfulDepartmentUserPersistedPlanSummary;
function hasMeaningfulDepartmentUserWorkspaceSummary(workspaceSummary) {
    if (!workspaceSummary) {
        return false;
    }
    return (workspaceSummary.departmentTotal > 0 ||
        workspaceSummary.totalItemCount > 0 ||
        workspaceSummary.categories.some((category) => category.itemCount > 0 || category.totalCost > 0));
}
exports.hasMeaningfulDepartmentUserWorkspaceSummary = hasMeaningfulDepartmentUserWorkspaceSummary;
function workspaceRecordHasDepartmentBlock(workspaceState) {
    const workspaceJson = (0, blockly_serialization_1.parseBlocklyWorkspaceJson)(workspaceState?.workspaceJson);
    if (!workspaceJson) {
        return false;
    }
    const topBlocks = getSerializedTopBlocks(workspaceJson);
    if (!topBlocks) {
        return false;
    }
    return topBlocks.some((block) => block.type === "department_block");
}
exports.workspaceRecordHasDepartmentBlock = workspaceRecordHasDepartmentBlock;
function workspaceRecordHasMeaningfulDepartmentContent(workspaceState) {
    const workspaceJson = (0, blockly_serialization_1.parseBlocklyWorkspaceJson)(workspaceState?.workspaceJson);
    if (!workspaceJson) {
        return false;
    }
    const topBlocks = getSerializedTopBlocks(workspaceJson);
    if (!topBlocks) {
        return false;
    }
    const departmentBlock = topBlocks.find((block) => block.type === "department_block") ?? null;
    if (!departmentBlock) {
        return false;
    }
    let categoryBlock = getSerializedInputBlock(departmentBlock, "CATEGORIES");
    while (categoryBlock && categoryBlock.type === "category_block") {
        if (getSerializedInputBlock(categoryBlock, "ITEMS")) {
            return true;
        }
        categoryBlock = getSerializedNextBlock(categoryBlock);
    }
    return false;
}
exports.workspaceRecordHasMeaningfulDepartmentContent = workspaceRecordHasMeaningfulDepartmentContent;
function resolveDepartmentUserDisplayedWorkspaceSummary(args) {
    const hasMeaningfulPersistedSummary = hasMeaningfulDepartmentUserPersistedPlanSummary(args.persistedPlanSummary);
    const hasMeaningfulWorkspaceSummary = hasMeaningfulDepartmentUserWorkspaceSummary(args.workspaceSummary);
    const hasMeaningfulWorkspaceContent = workspaceRecordHasMeaningfulDepartmentContent(args.workspaceState);
    if (args.workspaceSummary &&
        (hasMeaningfulWorkspaceSummary ||
            hasMeaningfulWorkspaceContent ||
            !hasMeaningfulPersistedSummary)) {
        return args.workspaceSummary;
    }
    if (args.persistedPlanSummary && hasMeaningfulPersistedSummary) {
        return buildDepartmentUserWorkspaceSummaryFromPersistedPlan({
            persistedPlanSummary: args.persistedPlanSummary,
            totalBudget: args.totalBudget,
        });
    }
    return args.workspaceSummary;
}
exports.resolveDepartmentUserDisplayedWorkspaceSummary = resolveDepartmentUserDisplayedWorkspaceSummary;
function extractDepartmentUserWorkspaceCategoriesFromWorkspaceRecord(args) {
    const workspaceJson = (0, blockly_serialization_1.parseBlocklyWorkspaceJson)(args.workspaceState?.workspaceJson);
    if (!workspaceJson) {
        return [];
    }
    const topBlocks = getSerializedTopBlocks(workspaceJson);
    if (topBlocks === null) {
        return null;
    }
    const departmentBlock = topBlocks.find((block) => block.type === "department_block") ?? null;
    if (!departmentBlock) {
        return [];
    }
    return readCategoriesFromSerializedDepartmentBlock({
        departmentBlock,
        items: args.items,
        refreshCatalogMetadata: args.refreshCatalogMetadata ?? false,
    });
}
exports.extractDepartmentUserWorkspaceCategoriesFromWorkspaceRecord = extractDepartmentUserWorkspaceCategoriesFromWorkspaceRecord;
function applyDepartmentWorkspaceRollup(args) {
    if (!args.departmentBlock || args.departmentBlock.type !== "department_block") {
        return null;
    }
    const categories = readCategoriesFromDepartmentBlock(args.departmentBlock, args.items ?? []);
    const summary = calculateDepartmentUserWorkspaceSummary({
        categories,
        totalBudget: args.totalBudget,
    });
    writeRollupBackToWorkspace(args.departmentBlock, summary, args.totalBudget);
    updateDepartmentBudgetVisualState(args.departmentBlock, summary.budgetState);
    return summary;
}
exports.applyDepartmentWorkspaceRollup = applyDepartmentWorkspaceRollup;
function getDepartmentUserWorkspaceAnnouncement(summary) {
    if (!summary) {
        return {
            key: "empty",
            message: "Workspace totals unavailable.",
        };
    }
    const complianceStateKey = summary.complianceState.metrics
        .map((metric) => `${metric.flag}:${metric.status}`)
        .join("|");
    const unmetMetrics = summary.complianceState.metrics
        .filter((metric) => metric.status === "unmet")
        .map((metric) => metric.label);
    return {
        key: `${summary.budgetState.state}|${complianceStateKey}|${summary.validationState.submitBlockedReasons.join("|")}|${summary.validationState.validationUnavailableReason ?? ""}`,
        message: summary.validationState.validationUnavailableReason
            ? `${summary.budgetState.announcementText} ${summary.validationState.validationUnavailableReason}`
            : summary.validationState.submitBlockedReasons.length > 0
                ? `${summary.budgetState.announcementText} Validation issues to review: ${summary.validationState.submitBlockedReasons.join(", ")}.`
                : unmetMetrics.length > 0
                    ? `${summary.budgetState.announcementText} Compliance targets to review: ${unmetMetrics.join(", ")}.`
                    : summary.budgetState.announcementText,
    };
}
exports.getDepartmentUserWorkspaceAnnouncement = getDepartmentUserWorkspaceAnnouncement;
function getDepartmentUserReservedSubmitState(args) {
    return (0, plan_submission_1.getDepartmentUserPlanSubmitState)({
        budgetState: args.budgetState,
        hasUnsyncedChanges: args.hasUnsyncedChanges ?? false,
        mode: args.mode,
        saveState: args.saveState ?? "idle",
        totalItemCount: args.totalItemCount ?? 0,
        validationState: args.validationState ?? null,
    });
}
exports.getDepartmentUserReservedSubmitState = getDepartmentUserReservedSubmitState;
const QUARTER_FIELD_KEY_MAP = [
    ["Q1_QTY", "q1"],
    ["Q2_QTY", "q2"],
    ["Q3_QTY", "q3"],
    ["Q4_QTY", "q4"],
];
function formatQuantityFieldValue(args) {
    const normalizedValue = (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
        unitOfMeasurement: args.unitOfMeasurement ?? null,
        value: args.value,
    }).normalizedValue;
    if (Number.isInteger(normalizedValue)) {
        return String(normalizedValue);
    }
    return normalizedValue.toFixed(2).replace(/\.?0+$/, "");
}
function readBlockQuantityFeedback(block) {
    const quantityFeedback = block.__duQuantityFeedback;
    if (!quantityFeedback) {
        return null;
    }
    const nextFeedback = QUARTER_FIELD_KEY_MAP.reduce((feedback, [fieldName, quantityKey]) => {
        const message = quantityFeedback[fieldName];
        if (typeof message === "string" && message.trim().length > 0) {
            feedback[quantityKey] = message;
        }
        return feedback;
    }, {});
    delete block.__duQuantityFeedback;
    return Object.keys(nextFeedback).length > 0 ? nextFeedback : null;
}
function synchronizeLiveQuarterQuantityFields(block) {
    const unitOfMeasurement = normalizeWorkspaceText(block.getFieldValue("UNIT_OF_MEASUREMENT"));
    const maxQuantity = parseOptionalFiniteNumber(block.getFieldValue("MAX_QUANTITY"));
    for (const [fieldName] of QUARTER_FIELD_KEY_MAP) {
        const normalizedQuantity = (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
            maxQuantity,
            unitOfMeasurement,
            value: block.getFieldValue(fieldName),
        });
        const nextFieldValue = formatQuantityFieldValue({
            unitOfMeasurement,
            value: normalizedQuantity.normalizedValue,
        });
        if (block.getFieldValue(fieldName) !== nextFieldValue) {
            block.setFieldValue(nextFieldValue, fieldName);
        }
    }
}
function readCategoriesFromDepartmentBlock(departmentBlock, items) {
    const categories = [];
    let categoryBlock = departmentBlock.getInput("CATEGORIES")?.connection?.targetBlock() ?? null;
    while (categoryBlock && categoryBlock.type === "category_block") {
        const categoryId = categoryBlock.getFieldValue("CATEGORY_ID") || "unknown-category";
        const categoryName = categoryBlock.getFieldValue("CATEGORY_NAME") || "Unnamed category";
        const categoryItems = [];
        let itemBlock = categoryBlock.getInput("ITEMS")?.connection?.targetBlock() ?? null;
        while (itemBlock && itemBlock.type === "item_block") {
            const nextItem = readQuarterlyItemFromBlock(itemBlock);
            synchronizeLiveQuarterQuantityFields(itemBlock);
            categoryItems.push(hydrateWorkspaceItem({
                categoryId,
                item: nextItem,
                items,
            }));
            itemBlock = itemBlock.getNextBlock();
        }
        categories.push({
            categoryId,
            categoryName,
            items: categoryItems,
        });
        categoryBlock = categoryBlock.getNextBlock();
    }
    return categories;
}
function readQuarterlyItemFromBlock(block) {
    const unitOfMeasurement = normalizeWorkspaceText(block.getFieldValue("UNIT_OF_MEASUREMENT"));
    const maxQuantity = parseOptionalFiniteNumber(block.getFieldValue("MAX_QUANTITY"));
    const rawQuantities = {
        q1: block.getFieldValue("Q1_QTY"),
        q2: block.getFieldValue("Q2_QTY"),
        q3: block.getFieldValue("Q3_QTY"),
        q4: block.getFieldValue("Q4_QTY"),
    };
    return {
        blockId: block.id ?? null,
        complianceFlags: parseSerializedStringList(block.getFieldValue("COMPLIANCE_FLAGS")),
        isActive: parseSerializedBoolean(block.getFieldValue("ITEM_IS_ACTIVE")),
        itemDescription: block.getFieldValue("ITEM_DESCRIPTION") ||
            block.getFieldValue("ITEM_DESC") ||
            "Untitled item",
        itemId: block.getFieldValue("ITEM_ID") || null,
        itemName: block.getFieldValue("ITEM_DESC") || "Untitled item",
        maxQuantity,
        minQuantity: parseOptionalFiniteNumber(block.getFieldValue("MIN_QUANTITY")),
        rawQuantities,
        quantities: {
            q1: (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
                maxQuantity,
                unitOfMeasurement,
                value: rawQuantities.q1,
            }).normalizedValue,
            q2: (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
                maxQuantity,
                unitOfMeasurement,
                value: rawQuantities.q2,
            }).normalizedValue,
            q3: (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
                maxQuantity,
                unitOfMeasurement,
                value: rawQuantities.q3,
            }).normalizedValue,
            q4: (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
                maxQuantity,
                unitOfMeasurement,
                value: rawQuantities.q4,
            }).normalizedValue,
        },
        transientQuantityFeedback: readBlockQuantityFeedback(block),
        unitOfMeasurement,
        unitPrice: sanitizeNonNegativeNumber(block.getFieldValue("UNIT_PRICE")),
    };
}
function readCategoriesFromSerializedDepartmentBlock(args) {
    const categories = [];
    let categoryBlock = getSerializedInputBlock(args.departmentBlock, "CATEGORIES");
    while (categoryBlock && categoryBlock.type === "category_block") {
        const categoryId = getSerializedFieldValue(categoryBlock, "CATEGORY_ID") ||
            "unknown-category";
        const categoryName = getSerializedFieldValue(categoryBlock, "CATEGORY_NAME") ||
            "Unnamed category";
        const items = [];
        let itemBlock = getSerializedInputBlock(categoryBlock, "ITEMS");
        while (itemBlock && itemBlock.type === "item_block") {
            items.push(hydrateWorkspaceItem({
                categoryId,
                item: readQuarterlyItemFromSerializedBlock(itemBlock),
                items: args.items,
                refreshCatalogMetadata: args.refreshCatalogMetadata,
            }));
            itemBlock = getSerializedNextBlock(itemBlock);
        }
        categories.push({
            categoryId,
            categoryName,
            items,
        });
        categoryBlock = getSerializedNextBlock(categoryBlock);
    }
    return categories;
}
function readQuarterlyItemFromSerializedBlock(block) {
    const unitOfMeasurement = normalizeWorkspaceText(getSerializedFieldValue(block, "UNIT_OF_MEASUREMENT"));
    const maxQuantity = parseOptionalFiniteNumber(getSerializedFieldValue(block, "MAX_QUANTITY"));
    const rawQuantities = {
        q1: getSerializedFieldValue(block, "Q1_QTY"),
        q2: getSerializedFieldValue(block, "Q2_QTY"),
        q3: getSerializedFieldValue(block, "Q3_QTY"),
        q4: getSerializedFieldValue(block, "Q4_QTY"),
    };
    return {
        blockId: null,
        complianceFlags: parseSerializedStringList(getSerializedFieldValue(block, "COMPLIANCE_FLAGS")),
        isActive: parseSerializedBoolean(getSerializedFieldValue(block, "ITEM_IS_ACTIVE")),
        itemDescription: getSerializedFieldValue(block, "ITEM_DESCRIPTION") ||
            getSerializedFieldValue(block, "ITEM_DESC") ||
            "Untitled item",
        itemId: getSerializedFieldValue(block, "ITEM_ID") || null,
        itemName: getSerializedFieldValue(block, "ITEM_DESC") || "Untitled item",
        maxQuantity,
        minQuantity: parseOptionalFiniteNumber(getSerializedFieldValue(block, "MIN_QUANTITY")),
        rawQuantities,
        quantities: {
            q1: (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
                maxQuantity,
                unitOfMeasurement,
                value: rawQuantities.q1,
            }).normalizedValue,
            q2: (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
                maxQuantity,
                unitOfMeasurement,
                value: rawQuantities.q2,
            }).normalizedValue,
            q3: (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
                maxQuantity,
                unitOfMeasurement,
                value: rawQuantities.q3,
            }).normalizedValue,
            q4: (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
                maxQuantity,
                unitOfMeasurement,
                value: rawQuantities.q4,
            }).normalizedValue,
        },
        unitOfMeasurement,
        unitPrice: sanitizeNonNegativeNumber(getSerializedFieldValue(block, "UNIT_PRICE")),
    };
}
function hydrateWorkspaceItem(args) {
    const resolvedItem = (0, workspace_catalog_identity_1.resolveDepartmentUserItemCatalogIdentity)({
        categoryId: args.categoryId,
        itemDescription: args.item.itemDescription,
        itemId: args.item.itemId ?? null,
        itemName: args.item.itemName ?? args.item.itemDescription,
        items: [...args.items],
        unitPrice: args.item.unitPrice,
    });
    const preservedItemDescription = args.item.itemDescription.trim().length
        ? args.item.itemDescription
        : resolvedItem?.name ?? "Untitled item";
    const preservedUnitPrice = sanitizeNonNegativeNumber(args.item.unitPrice);
    const shouldRefreshCatalogMetadata = args.refreshCatalogMetadata ?? true;
    const preservedUnitOfMeasurement = normalizeWorkspaceText(args.item.unitOfMeasurement ?? null);
    const preservedMaxQuantity = parseOptionalFiniteNumber(args.item.maxQuantity ?? null);
    const preservedMinQuantity = parseOptionalFiniteNumber(args.item.minQuantity ?? null);
    const hasKnownCatalogIdentity = (args.item.itemId?.trim().length ?? 0) > 0 ||
        (args.item.itemName?.trim().length ?? 0) > 0;
    return {
        blockId: args.item.blockId ?? null,
        complianceFlags: shouldRefreshCatalogMetadata
            ? resolvedItem?.complianceFlags ?? args.item.complianceFlags ?? []
            : args.item.complianceFlags?.length
                ? args.item.complianceFlags
                : resolvedItem?.complianceFlags ?? [],
        isActive: shouldRefreshCatalogMetadata
            ? resolvedItem?.isActive ?? (hasKnownCatalogIdentity ? false : args.item.isActive)
            : args.item.isActive,
        itemDescription: shouldRefreshCatalogMetadata
            ? resolvedItem?.description ?? resolvedItem?.name ?? preservedItemDescription
            : preservedItemDescription,
        itemId: resolvedItem?.id ?? args.item.itemId ?? null,
        itemName: shouldRefreshCatalogMetadata
            ? resolvedItem?.name ?? args.item.itemName ?? preservedItemDescription
            : args.item.itemName ?? preservedItemDescription,
        maxQuantity: shouldRefreshCatalogMetadata
            ? parseOptionalFiniteNumber(resolvedItem?.maxQuantity ?? args.item.maxQuantity ?? null)
            : preservedMaxQuantity,
        minQuantity: shouldRefreshCatalogMetadata
            ? parseOptionalFiniteNumber(resolvedItem?.minQuantity ?? args.item.minQuantity ?? null)
            : preservedMinQuantity,
        quantities: args.item.quantities,
        rawQuantities: args.item.rawQuantities ?? null,
        transientQuantityFeedback: args.item.transientQuantityFeedback ?? null,
        unitOfMeasurement: shouldRefreshCatalogMetadata
            ? normalizeWorkspaceText(resolvedItem?.unitOfMeasurement ?? args.item.unitOfMeasurement ?? null)
            : preservedUnitOfMeasurement,
        unitPrice: shouldRefreshCatalogMetadata
            ? sanitizeNonNegativeNumber(resolvedItem?.unitPrice ?? args.item.unitPrice)
            : preservedUnitPrice > 0
                ? preservedUnitPrice
                : sanitizeNonNegativeNumber(resolvedItem?.unitPrice ?? args.item.unitPrice),
    };
}
function writeRollupBackToWorkspace(departmentBlock, summary, totalBudget) {
    let writableCategory = departmentBlock.getInput("CATEGORIES")?.connection?.targetBlock() ?? null;
    for (const categoryRollup of summary.categories) {
        if (!writableCategory || writableCategory.type !== "category_block") {
            break;
        }
        writableCategory.setFieldValue(categoryRollup.quarterTotals.q1.toFixed(2), "CAT_Q1_TOTAL");
        writableCategory.setFieldValue(categoryRollup.quarterTotals.q2.toFixed(2), "CAT_Q2_TOTAL");
        writableCategory.setFieldValue(categoryRollup.quarterTotals.q3.toFixed(2), "CAT_Q3_TOTAL");
        writableCategory.setFieldValue(categoryRollup.quarterTotals.q4.toFixed(2), "CAT_Q4_TOTAL");
        writableCategory.setFieldValue(categoryRollup.totalCost.toFixed(2), "CATEGORY_GRAND_TOTAL");
        writableCategory.setFieldValue(categoryRollup.itemCount === 0 ? "Drag items here" : "", "CATEGORY_EMPTY_STATE");
        writableCategory.getInput("EMPTY_STATE")?.setVisible?.(categoryRollup.itemCount === 0);
        let writableItem = writableCategory.getInput("ITEMS")?.connection?.targetBlock() ?? null;
        for (const itemRollup of categoryRollup.items) {
            if (!writableItem || writableItem.type !== "item_block") {
                break;
            }
            writableItem.setFieldValue(String(itemRollup.totalQuantity), "ITEM_TOTAL_QTY");
            writableItem.setFieldValue(itemRollup.totalCost.toFixed(2), "ITEM_TOTAL_COST");
            writableItem.setFieldValue((0, compliance_1.serializeProcurementComplianceFlags)(itemRollup.complianceFlags), "COMPLIANCE_FLAGS");
            writableItem.setWarningText?.((0, workspace_validation_1.summarizeDepartmentUserBlockValidationIssues)(summary.validationState.itemIssuesByBlockId[writableItem.id ?? ""] ?? []));
            writableItem = writableItem.getNextBlock();
        }
        writableCategory = writableCategory.getNextBlock();
    }
    departmentBlock.setFieldValue(sanitizeNonNegativeNumber(totalBudget).toFixed(2), "BUDGET");
    departmentBlock.setFieldValue(summary.departmentTotal.toFixed(2), "DEPT_TOTAL");
    departmentBlock.setWarningText?.(summary.budgetState.state === "over_budget"
        ? summary.budgetState.bannerText
        : summary.budgetState.state === "unallocated"
            ? "Budget allocation unavailable."
            : summary.validationState.submitBlockedReasons[0] ??
                summary.validationState.validationUnavailableReason ??
                null);
}
function updateDepartmentBudgetVisualState(departmentBlock, budgetState) {
    const classList = departmentBlock.svgGroup_?.classList;
    if (!classList) {
        return;
    }
    classList.toggle("dept-block-budget-safe", budgetState.state === "safe");
    classList.toggle("dept-block-budget-warning", budgetState.state === "warning");
    classList.toggle("dept-block-budget-over", budgetState.state === "over_budget");
    classList.toggle("dept-block-budget-unallocated", budgetState.state === "unallocated");
}
function getSerializedTopBlocks(workspaceJson) {
    const blocksRecord = typeof workspaceJson.blocks === "object" && workspaceJson.blocks !== null
        ? workspaceJson.blocks
        : null;
    const blocks = blocksRecord?.blocks;
    if (!Array.isArray(blocks)) {
        return null;
    }
    return blocks.filter((block) => Boolean(block) && typeof block === "object");
}
function getSerializedFieldValue(block, fieldName) {
    const value = block.fields?.[fieldName];
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }
    return "";
}
function parseSerializedStringList(value) {
    return (value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function getSerializedInputBlock(block, inputName) {
    const input = block.inputs?.[inputName];
    const childBlock = input?.block;
    return childBlock && typeof childBlock === "object" ? childBlock : null;
}
function getSerializedNextBlock(block) {
    const nextBlock = block.next?.block;
    return nextBlock && typeof nextBlock === "object" ? nextBlock : null;
}
function roundCurrency(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function roundPercent(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function formatPercent(value) {
    const formatted = value.toFixed(2).replace(/\.?0+$/, "");
    return `${formatted}%`;
}
function formatKenyanCurrency(amount) {
    return new Intl.NumberFormat("en-KE", {
        currency: "KES",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        style: "currency",
    }).format(amount);
}
