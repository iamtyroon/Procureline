import type { BlocklyWorkspaceRecord } from "../blockly/blockly-serialization";
import {
    buildDepartmentUserWorkspaceSummaryFromPersistedPlan,
    calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord,
    hasMeaningfulDepartmentUserPersistedPlanSummary,
    workspaceRecordHasMeaningfulDepartmentContent,
    type DepartmentUserPersistedPlanSummary,
    type DepartmentUserWorkspaceSummary,
} from "../blockly/du-workspace-calculations";
import type { DepartmentUserCatalogItem } from "../blockly/workspace-catalog-identity";

export const PROCUREMENT_OFFICER_REVIEW_EMPTY_STATES = {
    previousFiscalYear:
        "A prior fiscal-year comparison is unavailable for this department.",
    previousSubmission:
        "No previous submitted baseline is available for this plan yet.",
} as const;

export const PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE =
    "That plan is no longer available for review. It may have been withdrawn or moved out of scope.";

export type ProcurementOfficerReviewComparisonKind =
    | "previousFiscalYear"
    | "previousSubmission";

export interface ProcurementOfficerReviewSnapshotLike {
    capturedAt: number;
    fiscalYear: string;
    planId: string;
    submittedAt: number | null;
    summary: DepartmentUserPersistedPlanSummary;
    workspaceState: BlocklyWorkspaceRecord | null;
}

export interface ProcurementOfficerReviewPlanLike {
    fiscalYear: string;
    summary: DepartmentUserPersistedPlanSummary;
    submittedAt?: number | null;
    updatedAt?: number | null;
    workspaceState: BlocklyWorkspaceRecord | null;
}

export interface ProcurementOfficerReviewComparableItem {
    categoryId: string;
    id: string;
    isActive: boolean;
    name: string;
    totalAmount: number;
    totalQuantity: number;
}

export interface ProcurementOfficerReviewComparableCategory {
    id: string;
    itemCount: number;
    items: ProcurementOfficerReviewComparableItem[] | null;
    name: string;
    totalAmount: number;
}

export interface ProcurementOfficerReviewComparablePlan {
    categories: ProcurementOfficerReviewComparableCategory[];
    hasDetailedItems: boolean;
    itemCount: number;
    totalAmount: number;
}

export interface ProcurementOfficerReviewCategoryDelta {
    categoryId: string;
    categoryName: string;
    currentAmount: number;
    currentItemCount: number;
    deltaAmount: number;
    deltaItemCount: number;
    previousAmount: number;
    previousItemCount: number;
    status: "added" | "changed" | "removed" | "unchanged";
}

export interface ProcurementOfficerReviewItemDelta {
    categoryId: string;
    categoryName: string;
    currentAmount: number;
    currentQuantity: number;
    deltaAmount: number;
    deltaQuantity: number;
    itemId: string;
    itemName: string;
    previousAmount: number;
    previousQuantity: number;
    status: "added" | "changed" | "removed";
}

export interface ProcurementOfficerReviewComparison {
    categoryDeltas: ProcurementOfficerReviewCategoryDelta[];
    emptyMessage: string | null;
    itemDeltas: ProcurementOfficerReviewItemDelta[] | null;
    itemDeltaState: "available" | "unavailable";
    kind: ProcurementOfficerReviewComparisonKind;
    state: "empty" | "ready";
    totals: {
        currentAmount: number;
        currentItemCount: number;
        deltaAmount: number;
        deltaItemCount: number;
        previousAmount: number;
        previousItemCount: number;
    };
}

export interface ProcurementOfficerReviewRenderState {
    mode: "detailed" | "summary";
    reason: string | null;
    summary: DepartmentUserWorkspaceSummary;
}

export interface ProcurementOfficerReviewSelectionRevalidation {
    notice: string | null;
    staleSelectionIds: string[];
    validSelectionIds: string[];
}

export interface ProcurementOfficerReviewSelectionDescriptor {
    id: string;
    label: string;
    type: "category" | "item";
}

export interface ProcurementOfficerReviewSelectableBlocklyBlockLike {
    getFieldValue(name: string): string;
    getParent?(): ProcurementOfficerReviewSelectableBlocklyBlockLike | null;
    type: string;
}

export interface ProcurementOfficerPlanReviewStartPreparation {
    departmentCodeSnapshot: string | null;
    departmentNameSnapshot: string | null;
    planPatch: Record<string, number | string>;
    reviewStartedAt: number | null;
    shouldCaptureSnapshot: boolean;
    submissionSequenceKey: string;
}

export function resolveProcurementOfficerReviewTargetState(args: {
    planExists: boolean;
    planStatus: "approved" | "draft" | "rejected" | "submitted" | null;
    requestPlanIdIsValid: boolean;
    tenantMatches: boolean;
}): {
    message: string | null;
    state: "ready" | "redirect";
} {
    if (
        !args.requestPlanIdIsValid ||
        !args.planExists ||
        !args.tenantMatches ||
        args.planStatus === "draft"
    ) {
        return {
            message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            state: "redirect",
        };
    }

    return {
        message: null,
        state: "ready",
    };
}

export function resolveProcurementOfficerReviewDepartmentContext(args: {
    joinedDepartmentCode?: string | null;
    joinedDepartmentIsActive?: boolean | null;
    joinedDepartmentName?: string | null;
    planDepartmentCodeSnapshot?: string | null;
    planDepartmentNameSnapshot?: string | null;
}): {
    code: string | null;
    name: string;
} {
    const joinedName = args.joinedDepartmentName?.trim() ?? "";
    const snapshotName = args.planDepartmentNameSnapshot?.trim() ?? "";
    const joinedCode = args.joinedDepartmentCode?.trim() ?? "";
    const snapshotCode = args.planDepartmentCodeSnapshot?.trim() ?? "";

    if (joinedName.length > 0) {
        return {
            code: joinedCode.length > 0 ? joinedCode : null,
            name:
                args.joinedDepartmentIsActive === false
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

export function normalizeProcurementOfficerReviewComment(
    value: string,
): { message?: string; ok: boolean; value?: string } {
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

export function buildProcurementOfficerReviewStartPatch(args: {
    currentDepartmentCode?: string | null;
    currentDepartmentName?: string | null;
    existingDepartmentCodeSnapshot?: string | null;
    existingDepartmentNameSnapshot?: string | null;
    existingReviewStartedAt?: number | null;
    existingReviewStartedByTenantUserId?: string | null;
    existingReviewStartedByUserId?: string | null;
    now: number;
    reviewerTenantUserId: string;
    reviewerUserId: string;
}): Record<string, number | string> | null {
    const patch: Record<string, number | string> = {};

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
    if (
        (!args.existingDepartmentNameSnapshot ||
            args.existingDepartmentNameSnapshot.trim().length === 0) &&
        currentDepartmentName.length > 0
    ) {
        patch.departmentNameSnapshot = currentDepartmentName;
    }

    const currentDepartmentCode = args.currentDepartmentCode?.trim() ?? "";
    if (
        (!args.existingDepartmentCodeSnapshot ||
            args.existingDepartmentCodeSnapshot.trim().length === 0) &&
        currentDepartmentCode.length > 0
    ) {
        patch.departmentCodeSnapshot = currentDepartmentCode;
    }

    return Object.keys(patch).length > 0 ? patch : null;
}

export function derivePreviousFiscalYearKey(
    fiscalYear: string,
): string | null {
    const match = /^(\d{4})-(\d{4})$/.exec(fiscalYear.trim());
    if (!match) {
        return null;
    }

    return `${Number(match[1]) - 1}-${Number(match[2]) - 1}`;
}

export function selectPreviousSubmissionBaseline(args: {
    currentSubmittedAt: number | null;
    snapshots: readonly ProcurementOfficerReviewSnapshotLike[];
}): ProcurementOfficerReviewSnapshotLike | null {
    if (args.currentSubmittedAt === null) {
        return null;
    }
    const currentSubmittedAt = args.currentSubmittedAt;

    const eligibleSnapshots = args.snapshots.filter((snapshot) => {
        if (snapshot.submittedAt === null) {
            return false;
        }

        return snapshot.submittedAt < currentSubmittedAt;
    });

    if (eligibleSnapshots.length === 0) {
        return null;
    }

    return [...eligibleSnapshots].sort((left, right) => {
        if (left.submittedAt !== right.submittedAt) {
            return (right.submittedAt ?? 0) - (left.submittedAt ?? 0);
        }

        return right.capturedAt - left.capturedAt;
    })[0] ?? null;
}

export function selectPriorFiscalYearBaseline(args: {
    currentFiscalYear: string;
    priorFiscalYearPlans: readonly ProcurementOfficerReviewPlanLike[];
    priorFiscalYearSnapshots: readonly ProcurementOfficerReviewSnapshotLike[];
}): ProcurementOfficerReviewPlanLike | ProcurementOfficerReviewSnapshotLike | null {
    const previousFiscalYear = derivePreviousFiscalYearKey(args.currentFiscalYear);
    if (!previousFiscalYear) {
        return null;
    }

    const matchingPlans = args.priorFiscalYearPlans.filter(
        (plan) => plan.fiscalYear === previousFiscalYear,
    );
    if (matchingPlans.length > 0) {
        return [...matchingPlans].sort((left, right) => {
            const leftRank = left.submittedAt ?? left.updatedAt ?? 0;
            const rightRank = right.submittedAt ?? right.updatedAt ?? 0;
            return rightRank - leftRank;
        })[0] ?? null;
    }

    const matchingSnapshots = args.priorFiscalYearSnapshots.filter(
        (snapshot) => snapshot.fiscalYear === previousFiscalYear,
    );
    if (matchingSnapshots.length === 0) {
        return null;
    }

    return [...matchingSnapshots].sort(
        (left, right) => right.capturedAt - left.capturedAt,
    )[0] ?? null;
}

export function buildProcurementOfficerReviewSelectionId(args: {
    categoryId: string;
    itemId?: string | null;
    itemName?: string | null;
    type: "category" | "item";
}): string {
    if (args.type === "category") {
        return `category:${args.categoryId}`;
    }

    const itemIdentity = args.itemId?.trim()
        ? args.itemId.trim()
        : (args.itemName?.trim().toLocaleLowerCase() ?? "unknown-item");
    return `item:${args.categoryId}:${itemIdentity}`;
}

export function resolveProcurementOfficerReviewSelectionFromBlocklyBlock(
    block: ProcurementOfficerReviewSelectableBlocklyBlockLike | null | undefined,
): ProcurementOfficerReviewSelectionDescriptor | null {
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
    const categoryId =
        parentCategoryBlock?.getFieldValue("CATEGORY_ID").trim() ?? "";
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
        label:
            categoryName.length > 0
                ? `${itemName || "Unnamed item"} (${categoryName})`
                : itemName || "Unnamed item",
        type: "item",
    };
}

export function buildProcurementOfficerReviewSnapshotSequenceKey(args: {
    planId: string;
    submittedAt: number | null;
    tenantId: string;
}): string {
    return `${args.tenantId}:${args.planId}:${args.submittedAt ?? "no-submission"}`;
}

export function prepareProcurementOfficerPlanReviewStart(args: {
    currentDepartmentCode?: string | null;
    currentDepartmentName?: string | null;
    existingDepartmentCodeSnapshot?: string | null;
    existingDepartmentNameSnapshot?: string | null;
    existingReviewStartedAt?: number | null;
    existingReviewStartedByTenantUserId?: string | null;
    existingReviewStartedByUserId?: string | null;
    now: number;
    planId: string;
    reviewerTenantUserId: string;
    reviewerUserId: string;
    snapshotAlreadyExists: boolean;
    submittedAt: number | null;
    tenantId: string;
}): ProcurementOfficerPlanReviewStartPreparation {
    const patch = buildProcurementOfficerReviewStartPatch({
        currentDepartmentCode: args.currentDepartmentCode ?? null,
        currentDepartmentName: args.currentDepartmentName ?? null,
        existingDepartmentCodeSnapshot: args.existingDepartmentCodeSnapshot ?? null,
        existingDepartmentNameSnapshot: args.existingDepartmentNameSnapshot ?? null,
        existingReviewStartedAt: args.existingReviewStartedAt ?? null,
        existingReviewStartedByTenantUserId:
            args.existingReviewStartedByTenantUserId ?? null,
        existingReviewStartedByUserId: args.existingReviewStartedByUserId ?? null,
        now: args.now,
        reviewerTenantUserId: args.reviewerTenantUserId,
        reviewerUserId: args.reviewerUserId,
    });
    const patchedDepartmentCodeSnapshot =
        typeof patch?.departmentCodeSnapshot === "string"
            ? patch.departmentCodeSnapshot
            : null;
    const patchedDepartmentNameSnapshot =
        typeof patch?.departmentNameSnapshot === "string"
            ? patch.departmentNameSnapshot
            : null;
    const departmentCodeSnapshot = normalizeOptionalSnapshotText(
        patchedDepartmentCodeSnapshot ??
            args.existingDepartmentCodeSnapshot ??
            args.currentDepartmentCode ??
            null,
    );
    const departmentNameSnapshot = normalizeOptionalSnapshotText(
        patchedDepartmentNameSnapshot ??
            args.existingDepartmentNameSnapshot ??
            args.currentDepartmentName ??
            null,
    );

    return {
        departmentCodeSnapshot,
        departmentNameSnapshot,
        planPatch: patch ?? {},
        reviewStartedAt:
            args.existingReviewStartedAt ??
            (typeof patch?.reviewStartedAt === "number"
                ? patch.reviewStartedAt
                : null),
        shouldCaptureSnapshot: !args.snapshotAlreadyExists,
        submissionSequenceKey: buildProcurementOfficerReviewSnapshotSequenceKey({
            planId: args.planId,
            submittedAt: args.submittedAt,
            tenantId: args.tenantId,
        }),
    };
}

export function revalidateProcurementOfficerReviewSelection(args: {
    selectedIds: readonly string[];
    visibleIds: readonly string[];
}): ProcurementOfficerReviewSelectionRevalidation {
    const visibleIdSet = new Set(args.visibleIds);
    const validSelectionIds = args.selectedIds.filter((id) => visibleIdSet.has(id));
    const staleSelectionIds = args.selectedIds.filter((id) => !visibleIdSet.has(id));

    return {
        notice:
            staleSelectionIds.length > 0
                ? "Some selected review targets are no longer visible in the current comparison or fallback view."
                : null,
        staleSelectionIds,
        validSelectionIds,
    };
}

export function resolveProcurementOfficerReviewRenderState(args: {
    items: readonly DepartmentUserCatalogItem[];
    persistedPlanSummary: DepartmentUserPersistedPlanSummary;
    totalBudget: number | null | undefined;
    workspaceState: BlocklyWorkspaceRecord | null | undefined;
}): ProcurementOfficerReviewRenderState {
    const detailedSummary =
        calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord({
            items: args.items,
            refreshCatalogMetadata: true,
            totalBudget: args.totalBudget,
            workspaceState: args.workspaceState,
        });
    const hasMeaningfulWorkspace = workspaceRecordHasMeaningfulDepartmentContent(
        args.workspaceState,
    );
    const hasHydrationGap =
        detailedSummary?.categories.some((category) =>
            category.items.some(
                (item) => item.isActive === false || item.itemId === null,
            ),
        ) ?? false;

    if (hasMeaningfulWorkspace && detailedSummary && !hasHydrationGap) {
        return {
            mode: "detailed",
            reason: null,
            summary: detailedSummary,
        };
    }

    const fallbackSummary = buildDepartmentUserWorkspaceSummaryFromPersistedPlan({
        persistedPlanSummary: args.persistedPlanSummary,
        totalBudget: args.totalBudget,
    });

    if (hasHydrationGap) {
        return {
            mode: "summary",
            reason:
                "Detailed block rendering unavailable because one or more archived categories or items no longer hydrate safely.",
            summary: fallbackSummary,
        };
    }

    return {
        mode: "summary",
        reason:
            hasMeaningfulWorkspace ||
            hasMeaningfulDepartmentUserPersistedPlanSummary(args.persistedPlanSummary)
                ? "Detailed block rendering unavailable for this submission snapshot."
                : "No reviewable Blockly workspace snapshot is available for this plan.",
        summary: fallbackSummary,
    };
}

export function buildProcurementOfficerReviewComparison(args: {
    baseline:
        | ProcurementOfficerReviewPlanLike
        | ProcurementOfficerReviewSnapshotLike
        | null;
    currentPlan: ProcurementOfficerReviewPlanLike;
    items: readonly DepartmentUserCatalogItem[];
    kind: ProcurementOfficerReviewComparisonKind;
    totalBudget: number | null | undefined;
}): ProcurementOfficerReviewComparison {
    if (!args.baseline) {
        return {
            categoryDeltas: [],
            emptyMessage: PROCUREMENT_OFFICER_REVIEW_EMPTY_STATES[args.kind],
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
        itemDeltas:
            currentComparable.hasDetailedItems && baselineComparable.hasDetailedItems
                ? buildItemDeltas({
                      baseline: baselineComparable,
                      current: currentComparable,
                  })
                : null,
        itemDeltaState:
            currentComparable.hasDetailedItems && baselineComparable.hasDetailedItems
                ? "available"
                : "unavailable",
        kind: args.kind,
        state: "ready",
        totals: {
            currentAmount: currentComparable.totalAmount,
            currentItemCount: currentComparable.itemCount,
            deltaAmount: roundCurrency(
                currentComparable.totalAmount - baselineComparable.totalAmount,
            ),
            deltaItemCount:
                currentComparable.itemCount - baselineComparable.itemCount,
            previousAmount: baselineComparable.totalAmount,
            previousItemCount: baselineComparable.itemCount,
        },
    };
}

function toComparablePlan(args: {
    items: readonly DepartmentUserCatalogItem[];
    plan:
        | ProcurementOfficerReviewPlanLike
        | ProcurementOfficerReviewSnapshotLike;
    totalBudget: number | null | undefined;
}): ProcurementOfficerReviewComparablePlan {
    const workspaceSummary = args.plan.workspaceState
        ? calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord({
              items: args.items,
              refreshCatalogMetadata: false,
              totalBudget: args.totalBudget,
              workspaceState: args.plan.workspaceState,
          })
        : null;

    if (workspaceSummary && workspaceRecordHasMeaningfulDepartmentContent(args.plan.workspaceState)) {
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

function buildCategoryDeltas(args: {
    baseline: ProcurementOfficerReviewComparablePlan;
    current: ProcurementOfficerReviewComparablePlan;
}): ProcurementOfficerReviewCategoryDelta[] {
    const categoryIds = new Set<string>([
        ...args.current.categories.map((category) => category.id),
        ...args.baseline.categories.map((category) => category.id),
    ]);
    const currentById = new Map(
        args.current.categories.map((category) => [category.id, category] as const),
    );
    const baselineById = new Map(
        args.baseline.categories.map((category) => [category.id, category] as const),
    );

    return Array.from(categoryIds)
        .map((categoryId) => {
            const current = currentById.get(categoryId) ?? null;
            const previous = baselineById.get(categoryId) ?? null;
            const currentAmount = current?.totalAmount ?? 0;
            const previousAmount = previous?.totalAmount ?? 0;
            const currentItemCount = current?.itemCount ?? 0;
            const previousItemCount = previous?.itemCount ?? 0;
            let status: ProcurementOfficerReviewCategoryDelta["status"] = "unchanged";
            if (current && !previous) {
                status = "added";
            } else if (!current && previous) {
                status = "removed";
            } else if (
                currentAmount !== previousAmount ||
                currentItemCount !== previousItemCount
            ) {
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
        .sort((left, right) =>
            left.categoryName.localeCompare(right.categoryName),
        );
}

function buildItemDeltas(args: {
    baseline: ProcurementOfficerReviewComparablePlan;
    current: ProcurementOfficerReviewComparablePlan;
}): ProcurementOfficerReviewItemDelta[] {
    const currentItems = flattenComparableItems(args.current);
    const baselineItems = flattenComparableItems(args.baseline);
    const itemIds = new Set<string>([
        ...currentItems.map((item) => item.id),
        ...baselineItems.map((item) => item.id),
    ]);
    const currentById = new Map(currentItems.map((item) => [item.id, item] as const));
    const baselineById = new Map(
        baselineItems.map((item) => [item.id, item] as const),
    );

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
            let status: ProcurementOfficerReviewItemDelta["status"] | null = null;
            if (current && !previous) {
                status = "added";
            } else if (!current && previous) {
                status = "removed";
            } else if (
                currentAmount !== previousAmount ||
                currentQuantity !== previousQuantity
            ) {
                status = "changed";
            }

            if (status === null) {
                return [];
            }

            return [
                {
                    categoryId: current?.categoryId ?? previous?.categoryId ?? "unknown-category",
                    categoryName:
                        resolveCategoryNameForItem({
                            categoryId: current?.categoryId ?? previous?.categoryId ?? "",
                            plan: current ? args.current : args.baseline,
                        }) ?? "Unnamed category",
                    currentAmount,
                    currentQuantity,
                    deltaAmount: roundCurrency(currentAmount - previousAmount),
                    deltaQuantity: roundCurrency(
                        currentQuantity - previousQuantity,
                    ),
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

function flattenComparableItems(
    plan: ProcurementOfficerReviewComparablePlan,
): ProcurementOfficerReviewComparableItem[] {
    return plan.categories.flatMap((category) => category.items ?? []);
}

function resolveCategoryNameForItem(args: {
    categoryId: string;
    plan: ProcurementOfficerReviewComparablePlan;
}): string | null {
    return (
        args.plan.categories.find((category) => category.id === args.categoryId)?.name ??
        null
    );
}

function buildFallbackItemKey(value: string): string {
    return value.trim().toLocaleLowerCase().replace(/\s+/g, "-") || "unknown-item";
}

function readBlocklyFieldValue(
    block: ProcurementOfficerReviewSelectableBlocklyBlockLike | null | undefined,
    fieldNames: readonly string[],
): string {
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

function findParentCategoryBlock(
    block: ProcurementOfficerReviewSelectableBlocklyBlockLike,
): ProcurementOfficerReviewSelectableBlocklyBlockLike | null {
    let currentParent = block.getParent?.() ?? null;

    while (currentParent) {
        if (currentParent.type === "category_block") {
            return currentParent;
        }

        currentParent = currentParent.getParent?.() ?? null;
    }

    return null;
}

function normalizeOptionalSnapshotText(
    value: string | null | undefined,
): string | null {
    const normalized = value?.trim() ?? "";
    return normalized.length > 0 ? normalized : null;
}

function roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
