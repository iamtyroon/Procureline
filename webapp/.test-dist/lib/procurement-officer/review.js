"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProcurementOfficerReviewComparison = exports.resolveProcurementOfficerReviewRenderState = exports.revalidateProcurementOfficerReviewSelection = exports.prepareProcurementOfficerPlanReviewStart = exports.buildProcurementOfficerReviewSnapshotSequenceKey = exports.resolveProcurementOfficerReviewSelectionFromBlocklyBlock = exports.buildProcurementOfficerReviewSelectionId = exports.selectPriorFiscalYearBaseline = exports.selectPreviousSubmissionBaseline = exports.derivePreviousFiscalYearKey = exports.buildProcurementOfficerReviewStartPatch = exports.normalizeProcurementOfficerReviewBudgetAdjustment = exports.normalizeProcurementOfficerReviewComment = exports.resolveProcurementOfficerReviewDepartmentContext = exports.shouldStartProcurementOfficerReviewTracking = exports.resolveProcurementOfficerReviewTargetState = exports.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE = exports.PROCUREMENT_OFFICER_REVIEW_EMPTY_STATES = void 0;
const du_workspace_calculations_1 = require("../blockly/du-workspace-calculations");
const submission_1 = require("../plans/submission");
exports.PROCUREMENT_OFFICER_REVIEW_EMPTY_STATES = {
    previousFiscalYear: "A prior fiscal-year comparison is unavailable for this department.",
    previousSubmission: "No previous submitted baseline is available for this plan yet.",
};
exports.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE = "That plan is no longer available for review. It may have been withdrawn or moved out of scope.";
function resolveProcurementOfficerReviewTargetState(args) {
    if (!args.requestPlanIdIsValid ||
        !args.planExists ||
        !args.tenantMatches ||
        args.planStatus === "draft") {
        return {
            message: exports.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            state: "redirect",
        };
    }
    return {
        message: null,
        state: "ready",
    };
}
exports.resolveProcurementOfficerReviewTargetState = resolveProcurementOfficerReviewTargetState;
function shouldStartProcurementOfficerReviewTracking(status) {
    return status === "submitted";
}
exports.shouldStartProcurementOfficerReviewTracking = shouldStartProcurementOfficerReviewTracking;
function resolveProcurementOfficerReviewDepartmentContext(args) {
    const joinedName = args.joinedDepartmentName?.trim() ?? "";
    const snapshotName = args.planDepartmentNameSnapshot?.trim() ?? "";
    const joinedCode = args.joinedDepartmentCode?.trim() ?? "";
    const snapshotCode = args.planDepartmentCodeSnapshot?.trim() ?? "";
    if (joinedName.length > 0) {
        return {
            code: joinedCode.length > 0 ? joinedCode : null,
            name: args.joinedDepartmentIsActive === false
                ? `${joinedName} (archived)`
                : joinedName,
        };
    }
    if (snapshotName.length > 0) {
        return {
            code: snapshotCode.length > 0 ? snapshotCode : null,
            name: snapshotName,
        };
    }
    return {
        code: snapshotCode.length > 0 ? snapshotCode : null,
        name: "Archived department",
    };
}
exports.resolveProcurementOfficerReviewDepartmentContext = resolveProcurementOfficerReviewDepartmentContext;
function normalizeProcurementOfficerReviewComment(value) {
    const normalized = value.trim();
    if (normalized.length === 0) {
        return {
            message: "Internal comments cannot be blank.",
            ok: false,
        };
    }
    return {
        ok: true,
        value: normalized,
    };
}
exports.normalizeProcurementOfficerReviewComment = normalizeProcurementOfficerReviewComment;
function normalizeProcurementOfficerReviewBudgetAdjustment(value) {
    if (value === null || value === undefined) {
        return {
            ok: true,
            value: null,
        };
    }
    if (!Number.isFinite(value) || Number.isNaN(value) || value <= 0) {
        return {
            message: "Updated department budget must be greater than zero.",
            ok: false,
        };
    }
    return {
        ok: true,
        value,
    };
}
exports.normalizeProcurementOfficerReviewBudgetAdjustment = normalizeProcurementOfficerReviewBudgetAdjustment;
function buildProcurementOfficerReviewStartPatch(args) {
    const patch = {};
    if (!args.existingReviewStartedAt) {
        patch.reviewStartedAt = args.now;
    }
    if (!args.existingReviewStartedByUserId) {
        patch.reviewStartedByUserId = args.reviewerUserId;
    }
    if (!args.existingReviewStartedByTenantUserId) {
        patch.reviewStartedByTenantUserId = args.reviewerTenantUserId;
    }
    const currentDepartmentName = args.currentDepartmentName?.trim() ?? "";
    if ((!args.existingDepartmentNameSnapshot ||
        args.existingDepartmentNameSnapshot.trim().length === 0) &&
        currentDepartmentName.length > 0) {
        patch.departmentNameSnapshot = currentDepartmentName;
    }
    const currentDepartmentCode = args.currentDepartmentCode?.trim() ?? "";
    if ((!args.existingDepartmentCodeSnapshot ||
        args.existingDepartmentCodeSnapshot.trim().length === 0) &&
        currentDepartmentCode.length > 0) {
        patch.departmentCodeSnapshot = currentDepartmentCode;
    }
    return Object.keys(patch).length > 0 ? patch : null;
}
exports.buildProcurementOfficerReviewStartPatch = buildProcurementOfficerReviewStartPatch;
function derivePreviousFiscalYearKey(fiscalYear) {
    const match = /^(\d{4})-(\d{4})$/.exec(fiscalYear.trim());
    if (!match) {
        return null;
    }
    return `${Number(match[1]) - 1}-${Number(match[2]) - 1}`;
}
exports.derivePreviousFiscalYearKey = derivePreviousFiscalYearKey;
function selectPreviousSubmissionBaseline(args) {
    return (0, submission_1.selectPreviousActivePlanSubmissionSnapshot)(args);
}
exports.selectPreviousSubmissionBaseline = selectPreviousSubmissionBaseline;
function selectPriorFiscalYearBaseline(args) {
    const previousFiscalYear = derivePreviousFiscalYearKey(args.currentFiscalYear);
    if (!previousFiscalYear) {
        return null;
    }
    const matchingPlans = args.priorFiscalYearPlans.filter((plan) => plan.fiscalYear === previousFiscalYear);
    if (matchingPlans.length > 0) {
        return [...matchingPlans].sort((left, right) => {
            const leftRank = left.submittedAt ?? left.updatedAt ?? 0;
            const rightRank = right.submittedAt ?? right.updatedAt ?? 0;
            return rightRank - leftRank;
        })[0] ?? null;
    }
    const matchingSnapshots = args.priorFiscalYearSnapshots.filter((snapshot) => snapshot.fiscalYear === previousFiscalYear);
    if (matchingSnapshots.length === 0) {
        return null;
    }
    return [...matchingSnapshots].sort((left, right) => right.capturedAt - left.capturedAt)[0] ?? null;
}
exports.selectPriorFiscalYearBaseline = selectPriorFiscalYearBaseline;
function buildProcurementOfficerReviewSelectionId(args) {
    if (args.type === "category") {
        return `category:${args.categoryId}`;
    }
    const itemIdentity = args.itemId?.trim()
        ? args.itemId.trim()
        : (args.itemName?.trim().toLocaleLowerCase() ?? "unknown-item");
    return `item:${args.categoryId}:${itemIdentity}`;
}
exports.buildProcurementOfficerReviewSelectionId = buildProcurementOfficerReviewSelectionId;
function resolveProcurementOfficerReviewSelectionFromBlocklyBlock(block) {
    if (!block) {
        return null;
    }
    if (block.type === "category_block") {
        const categoryId = block.getFieldValue("CATEGORY_ID").trim();
        if (categoryId.length === 0) {
            return null;
        }
        const categoryName = block.getFieldValue("CATEGORY_NAME").trim();
        return {
            id: buildProcurementOfficerReviewSelectionId({
                categoryId,
                type: "category",
            }),
            label: categoryName.length > 0 ? categoryName : "Unnamed category",
            type: "category",
        };
    }
    if (block.type !== "item_block") {
        return null;
    }
    const parentCategoryBlock = findParentCategoryBlock(block);
    const categoryId = parentCategoryBlock?.getFieldValue("CATEGORY_ID").trim() ?? "";
    if (categoryId.length === 0) {
        return null;
    }
    const itemName = readBlocklyFieldValue(block, ["ITEM_DESC", "ITEM_DESCRIPTION"]);
    const categoryName = readBlocklyFieldValue(parentCategoryBlock, ["CATEGORY_NAME"]);
    return {
        id: buildProcurementOfficerReviewSelectionId({
            categoryId,
            itemId: block.getFieldValue("ITEM_ID"),
            itemName,
            type: "item",
        }),
        label: categoryName.length > 0
            ? `${itemName || "Unnamed item"} (${categoryName})`
            : itemName || "Unnamed item",
        type: "item",
    };
}
exports.resolveProcurementOfficerReviewSelectionFromBlocklyBlock = resolveProcurementOfficerReviewSelectionFromBlocklyBlock;
function buildProcurementOfficerReviewSnapshotSequenceKey(args) {
    return (0, submission_1.buildPlanSubmissionSequenceKey)(args);
}
exports.buildProcurementOfficerReviewSnapshotSequenceKey = buildProcurementOfficerReviewSnapshotSequenceKey;
function prepareProcurementOfficerPlanReviewStart(args) {
    const patch = buildProcurementOfficerReviewStartPatch({
        currentDepartmentCode: args.currentDepartmentCode ?? null,
        currentDepartmentName: args.currentDepartmentName ?? null,
        existingDepartmentCodeSnapshot: args.existingDepartmentCodeSnapshot ?? null,
        existingDepartmentNameSnapshot: args.existingDepartmentNameSnapshot ?? null,
        existingReviewStartedAt: args.existingReviewStartedAt ?? null,
        existingReviewStartedByTenantUserId: args.existingReviewStartedByTenantUserId ?? null,
        existingReviewStartedByUserId: args.existingReviewStartedByUserId ?? null,
        now: args.now,
        reviewerTenantUserId: args.reviewerTenantUserId,
        reviewerUserId: args.reviewerUserId,
    });
    const patchedDepartmentCodeSnapshot = typeof patch?.departmentCodeSnapshot === "string"
        ? patch.departmentCodeSnapshot
        : null;
    const patchedDepartmentNameSnapshot = typeof patch?.departmentNameSnapshot === "string"
        ? patch.departmentNameSnapshot
        : null;
    const departmentCodeSnapshot = normalizeOptionalSnapshotText(patchedDepartmentCodeSnapshot ??
        args.existingDepartmentCodeSnapshot ??
        args.currentDepartmentCode ??
        null);
    const departmentNameSnapshot = normalizeOptionalSnapshotText(patchedDepartmentNameSnapshot ??
        args.existingDepartmentNameSnapshot ??
        args.currentDepartmentName ??
        null);
    return {
        departmentCodeSnapshot,
        departmentNameSnapshot,
        planPatch: patch ?? {},
        reviewStartedAt: args.existingReviewStartedAt ??
            (typeof patch?.reviewStartedAt === "number"
                ? patch.reviewStartedAt
                : null),
        shouldCaptureSnapshot: !args.snapshotAlreadyExists,
        submissionSequenceKey: buildProcurementOfficerReviewSnapshotSequenceKey({
            planId: args.planId,
            submissionSequence: args.submissionSequence,
            submittedAt: args.submittedAt,
            tenantId: args.tenantId,
        }),
    };
}
exports.prepareProcurementOfficerPlanReviewStart = prepareProcurementOfficerPlanReviewStart;
function revalidateProcurementOfficerReviewSelection(args) {
    const visibleIdSet = new Set(args.visibleIds);
    const validSelectionIds = args.selectedIds.filter((id) => visibleIdSet.has(id));
    const staleSelectionIds = args.selectedIds.filter((id) => !visibleIdSet.has(id));
    return {
        notice: staleSelectionIds.length > 0
            ? "Some selected review targets are no longer visible in the current comparison or fallback view."
            : null,
        staleSelectionIds,
        validSelectionIds,
    };
}
exports.revalidateProcurementOfficerReviewSelection = revalidateProcurementOfficerReviewSelection;
function resolveProcurementOfficerReviewRenderState(args) {
    const detailedSummary = (0, du_workspace_calculations_1.calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord)({
        items: args.items,
        refreshCatalogMetadata: true,
        totalBudget: args.totalBudget,
        workspaceState: args.workspaceState,
    });
    const hasMeaningfulWorkspace = (0, du_workspace_calculations_1.workspaceRecordHasMeaningfulDepartmentContent)(args.workspaceState);
    const hasHydrationGap = detailedSummary?.categories.some((category) => category.items.some((item) => item.isActive === false || item.itemId === null)) ?? false;
    if (hasMeaningfulWorkspace && detailedSummary && !hasHydrationGap) {
        return {
            mode: "detailed",
            reason: null,
            summary: detailedSummary,
        };
    }
    const fallbackSummary = (0, du_workspace_calculations_1.buildDepartmentUserWorkspaceSummaryFromPersistedPlan)({
        persistedPlanSummary: args.persistedPlanSummary,
        totalBudget: args.totalBudget,
    });
    if (hasHydrationGap) {
        return {
            mode: "summary",
            reason: "Detailed block rendering unavailable because one or more archived categories or items no longer hydrate safely.",
            summary: fallbackSummary,
        };
    }
    return {
        mode: "summary",
        reason: hasMeaningfulWorkspace ||
            (0, du_workspace_calculations_1.hasMeaningfulDepartmentUserPersistedPlanSummary)(args.persistedPlanSummary)
            ? "Detailed block rendering unavailable for this submission snapshot."
            : "No reviewable Blockly workspace snapshot is available for this plan.",
        summary: fallbackSummary,
    };
}
exports.resolveProcurementOfficerReviewRenderState = resolveProcurementOfficerReviewRenderState;
function buildProcurementOfficerReviewComparison(args) {
    if (!args.baseline) {
        return {
            categoryDeltas: [],
            emptyMessage: exports.PROCUREMENT_OFFICER_REVIEW_EMPTY_STATES[args.kind],
            itemDeltas: null,
            itemDeltaState: "unavailable",
            kind: args.kind,
            state: "empty",
            totals: {
                currentAmount: args.currentPlan.summary.estimatedBudgetUsed,
                currentItemCount: args.currentPlan.summary.itemCount,
                deltaAmount: args.currentPlan.summary.estimatedBudgetUsed,
                deltaItemCount: args.currentPlan.summary.itemCount,
                previousAmount: 0,
                previousItemCount: 0,
            },
        };
    }
    const currentComparable = toComparablePlan({
        items: args.items,
        plan: args.currentPlan,
        totalBudget: args.totalBudget,
    });
    const baselineComparable = toComparablePlan({
        items: args.items,
        plan: args.baseline,
        totalBudget: args.totalBudget,
    });
    return {
        categoryDeltas: buildCategoryDeltas({
            baseline: baselineComparable,
            current: currentComparable,
        }),
        emptyMessage: null,
        itemDeltas: currentComparable.hasDetailedItems && baselineComparable.hasDetailedItems
            ? buildItemDeltas({
                baseline: baselineComparable,
                current: currentComparable,
            })
            : null,
        itemDeltaState: currentComparable.hasDetailedItems && baselineComparable.hasDetailedItems
            ? "available"
            : "unavailable",
        kind: args.kind,
        state: "ready",
        totals: {
            currentAmount: currentComparable.totalAmount,
            currentItemCount: currentComparable.itemCount,
            deltaAmount: roundCurrency(currentComparable.totalAmount - baselineComparable.totalAmount),
            deltaItemCount: currentComparable.itemCount - baselineComparable.itemCount,
            previousAmount: baselineComparable.totalAmount,
            previousItemCount: baselineComparable.itemCount,
        },
    };
}
exports.buildProcurementOfficerReviewComparison = buildProcurementOfficerReviewComparison;
function toComparablePlan(args) {
    const workspaceSummary = args.plan.workspaceState
        ? (0, du_workspace_calculations_1.calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord)({
            items: args.items,
            refreshCatalogMetadata: false,
            totalBudget: args.totalBudget,
            workspaceState: args.plan.workspaceState,
        })
        : null;
    if (workspaceSummary && (0, du_workspace_calculations_1.workspaceRecordHasMeaningfulDepartmentContent)(args.plan.workspaceState)) {
        return {
            categories: workspaceSummary.categories.map((category) => ({
                id: category.categoryId,
                itemCount: category.itemCount,
                items: category.items.map((item) => ({
                    categoryId: category.categoryId,
                    id: item.itemId ?? buildFallbackItemKey(item.itemName),
                    isActive: item.isActive,
                    name: item.itemName,
                    totalAmount: item.totalCost,
                    totalQuantity: item.totalQuantity,
                })),
                name: category.categoryName,
                totalAmount: category.totalCost,
            })),
            hasDetailedItems: true,
            itemCount: workspaceSummary.totalItemCount,
            totalAmount: workspaceSummary.departmentTotal,
        };
    }
    return {
        categories: args.plan.summary.categorySummaries.map((category) => ({
            id: category.categoryId,
            itemCount: category.itemCount,
            items: null,
            name: category.categoryName,
            totalAmount: roundCurrency(category.amount),
        })),
        hasDetailedItems: false,
        itemCount: Math.max(0, Math.round(args.plan.summary.itemCount)),
        totalAmount: roundCurrency(args.plan.summary.estimatedBudgetUsed),
    };
}
function buildCategoryDeltas(args) {
    const categoryIds = new Set([
        ...args.current.categories.map((category) => category.id),
        ...args.baseline.categories.map((category) => category.id),
    ]);
    const currentById = new Map(args.current.categories.map((category) => [category.id, category]));
    const baselineById = new Map(args.baseline.categories.map((category) => [category.id, category]));
    return Array.from(categoryIds)
        .map((categoryId) => {
        const current = currentById.get(categoryId) ?? null;
        const previous = baselineById.get(categoryId) ?? null;
        const currentAmount = current?.totalAmount ?? 0;
        const previousAmount = previous?.totalAmount ?? 0;
        const currentItemCount = current?.itemCount ?? 0;
        const previousItemCount = previous?.itemCount ?? 0;
        let status = "unchanged";
        if (current && !previous) {
            status = "added";
        }
        else if (!current && previous) {
            status = "removed";
        }
        else if (currentAmount !== previousAmount ||
            currentItemCount !== previousItemCount) {
            status = "changed";
        }
        return {
            categoryId,
            categoryName: current?.name ?? previous?.name ?? "Unnamed category",
            currentAmount,
            currentItemCount,
            deltaAmount: roundCurrency(currentAmount - previousAmount),
            deltaItemCount: currentItemCount - previousItemCount,
            previousAmount,
            previousItemCount,
            status,
        };
    })
        .sort((left, right) => left.categoryName.localeCompare(right.categoryName));
}
function buildItemDeltas(args) {
    const currentItems = flattenComparableItems(args.current);
    const baselineItems = flattenComparableItems(args.baseline);
    const itemIds = new Set([
        ...currentItems.map((item) => item.id),
        ...baselineItems.map((item) => item.id),
    ]);
    const currentById = new Map(currentItems.map((item) => [item.id, item]));
    const baselineById = new Map(baselineItems.map((item) => [item.id, item]));
    return Array.from(itemIds)
        .flatMap((itemId) => {
        const current = currentById.get(itemId) ?? null;
        const previous = baselineById.get(itemId) ?? null;
        if (!current && !previous) {
            return [];
        }
        const currentAmount = current?.totalAmount ?? 0;
        const previousAmount = previous?.totalAmount ?? 0;
        const currentQuantity = current?.totalQuantity ?? 0;
        const previousQuantity = previous?.totalQuantity ?? 0;
        let status = null;
        if (current && !previous) {
            status = "added";
        }
        else if (!current && previous) {
            status = "removed";
        }
        else if (currentAmount !== previousAmount ||
            currentQuantity !== previousQuantity) {
            status = "changed";
        }
        if (status === null) {
            return [];
        }
        return [
            {
                categoryId: current?.categoryId ?? previous?.categoryId ?? "unknown-category",
                categoryName: resolveCategoryNameForItem({
                    categoryId: current?.categoryId ?? previous?.categoryId ?? "",
                    plan: current ? args.current : args.baseline,
                }) ?? "Unnamed category",
                currentAmount,
                currentQuantity,
                deltaAmount: roundCurrency(currentAmount - previousAmount),
                deltaQuantity: roundCurrency(currentQuantity - previousQuantity),
                itemId,
                itemName: current?.name ?? previous?.name ?? "Unnamed item",
                previousAmount,
                previousQuantity,
                status,
            },
        ];
    })
        .sort((left, right) => left.itemName.localeCompare(right.itemName));
}
function flattenComparableItems(plan) {
    return plan.categories.flatMap((category) => category.items ?? []);
}
function resolveCategoryNameForItem(args) {
    return (args.plan.categories.find((category) => category.id === args.categoryId)?.name ??
        null);
}
function buildFallbackItemKey(value) {
    return value.trim().toLocaleLowerCase().replace(/\s+/g, "-") || "unknown-item";
}
function readBlocklyFieldValue(block, fieldNames) {
    if (!block) {
        return "";
    }
    for (const fieldName of fieldNames) {
        const value = block.getFieldValue(fieldName).trim();
        if (value.length > 0) {
            return value;
        }
    }
    return "";
}
function findParentCategoryBlock(block) {
    let currentParent = block.getParent?.() ?? null;
    while (currentParent) {
        if (currentParent.type === "category_block") {
            return currentParent;
        }
        currentParent = currentParent.getParent?.() ?? null;
    }
    return null;
}
function normalizeOptionalSnapshotText(value) {
    const normalized = value?.trim() ?? "";
    return normalized.length > 0 ? normalized : null;
}
function roundCurrency(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
