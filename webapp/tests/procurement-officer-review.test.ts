import assert from "node:assert/strict";
import {
    createBlocklyWorkspaceRecord,
    createPersistedBlocklyWorkspaceRecord,
} from "../lib/shared/blockly/blockly-serialization";
import {
    buildProcurementOfficerReviewComparison,
    buildProcurementOfficerReviewSelectionId,
    buildProcurementOfficerReviewSnapshotSequenceKey,
    buildProcurementOfficerReviewStartPatch,
    derivePreviousFiscalYearKey,
    normalizeProcurementOfficerReviewBudgetAdjustment,
    normalizeProcurementOfficerReviewComment,
    prepareProcurementOfficerPlanReviewStart,
    PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
    revalidateProcurementOfficerReviewSelection,
    resolveProcurementOfficerReviewSelectionFromBlocklyBlock,
    resolveProcurementOfficerReviewDepartmentContext,
    resolveProcurementOfficerReviewRenderState,
    resolveProcurementOfficerReviewTargetState,
    shouldStartProcurementOfficerReviewTracking,
    selectPreviousSubmissionBaseline,
} from "../lib/procurement-officer/review";

export function runProcurementOfficerReviewTests(): string[] {
    const completedTests: string[] = [];

    assert.deepEqual(
        resolveProcurementOfficerReviewDepartmentContext({
            joinedDepartmentCode: "ICT",
            joinedDepartmentIsActive: false,
            joinedDepartmentName: "ICT Services",
        }),
        {
            code: "ICT",
            name: "ICT Services (archived)",
        },
    );
    assert.deepEqual(
        resolveProcurementOfficerReviewDepartmentContext({
            planDepartmentCodeSnapshot: "FIN",
            planDepartmentNameSnapshot: "Finance",
        }),
        {
            code: "FIN",
            name: "Finance",
        },
    );
    completedTests.push(
        "procurement-officer review headers prefer live department joins, fall back to captured snapshots, and stay truthful when departments are archived",
    );

    assert.deepEqual(normalizeProcurementOfficerReviewComment("   "), {
        message: "Internal comments cannot be blank.",
        ok: false,
    });
    assert.deepEqual(normalizeProcurementOfficerReviewComment("  Needs revision on ICT items.  "), {
        ok: true,
        value: "Needs revision on ICT items.",
    });
    completedTests.push(
        "procurement-officer review comment validation trims canonical notes and rejects blank submissions",
    );

    assert.deepEqual(
        normalizeProcurementOfficerReviewBudgetAdjustment(null),
        {
            ok: true,
            value: null,
        },
    );
    assert.deepEqual(
        normalizeProcurementOfficerReviewBudgetAdjustment(0),
        {
            message: "Updated department budget must be greater than zero.",
            ok: false,
        },
    );
    assert.deepEqual(
        normalizeProcurementOfficerReviewBudgetAdjustment(125000),
        {
            ok: true,
            value: 125000,
        },
    );
    completedTests.push(
        "procurement-officer review budget adjustments stay optional while failing closed for zero or invalid values",
    );

    assert.deepEqual(
        buildProcurementOfficerReviewStartPatch({
            currentDepartmentCode: "ICT",
            currentDepartmentName: "ICT Services",
            existingReviewStartedAt: null,
            existingReviewStartedByTenantUserId: null,
            existingReviewStartedByUserId: null,
            now: 1234,
            reviewerTenantUserId: "tenant-user-1",
            reviewerUserId: "user-1",
        }),
        {
            departmentCodeSnapshot: "ICT",
            departmentNameSnapshot: "ICT Services",
            reviewStartedAt: 1234,
            reviewStartedByTenantUserId: "tenant-user-1",
            reviewStartedByUserId: "user-1",
        },
    );
    assert.equal(
        buildProcurementOfficerReviewStartPatch({
            currentDepartmentCode: "ICT",
            currentDepartmentName: "ICT Services",
            existingDepartmentCodeSnapshot: "ICT",
            existingDepartmentNameSnapshot: "ICT Services",
            existingReviewStartedAt: 500,
            existingReviewStartedByTenantUserId: "tenant-user-0",
            existingReviewStartedByUserId: "user-0",
            now: 1234,
            reviewerTenantUserId: "tenant-user-1",
            reviewerUserId: "user-1",
        }),
        null,
    );
    completedTests.push(
        "procurement-officer review-start patching is first-writer-wins and does not overwrite canonical review ownership",
    );

    assert.equal(
        buildProcurementOfficerReviewSnapshotSequenceKey({
            planId: "plan-1",
            submittedAt: 5_000,
            tenantId: "tenant-1",
        }),
        "tenant-1:plan-1:submitted-at:5000",
    );
    assert.equal(
        buildProcurementOfficerReviewSnapshotSequenceKey({
            planId: "plan-1",
            submissionSequence: 2,
            submittedAt: 5_000,
            tenantId: "tenant-1",
        }),
        "tenant-1:plan-1:sequence:2",
    );
    assert.deepEqual(
        prepareProcurementOfficerPlanReviewStart({
            currentDepartmentCode: "ICT",
            currentDepartmentName: "ICT Services",
            existingDepartmentCodeSnapshot: null,
            existingDepartmentNameSnapshot: null,
            existingReviewStartedAt: null,
            existingReviewStartedByTenantUserId: null,
            existingReviewStartedByUserId: null,
            now: 9_000,
            planId: "plan-1",
            reviewerTenantUserId: "tenant-user-1",
            reviewerUserId: "user-1",
            snapshotAlreadyExists: false,
            submissionSequence: null,
            submittedAt: 5_000,
            tenantId: "tenant-1",
        }),
        {
            departmentCodeSnapshot: "ICT",
            departmentNameSnapshot: "ICT Services",
            planPatch: {
                departmentCodeSnapshot: "ICT",
                departmentNameSnapshot: "ICT Services",
                reviewStartedAt: 9_000,
                reviewStartedByTenantUserId: "tenant-user-1",
                reviewStartedByUserId: "user-1",
            },
            reviewStartedAt: 9_000,
            shouldCaptureSnapshot: true,
            submissionSequenceKey: "tenant-1:plan-1:submitted-at:5000",
        },
    );
    assert.deepEqual(
        prepareProcurementOfficerPlanReviewStart({
            currentDepartmentCode: "ICT",
            currentDepartmentName: "ICT Services",
            existingDepartmentCodeSnapshot: "ICT",
            existingDepartmentNameSnapshot: "ICT Services",
            existingReviewStartedAt: 8_500,
            existingReviewStartedByTenantUserId: "tenant-user-0",
            existingReviewStartedByUserId: "user-0",
            now: 9_000,
            planId: "plan-1",
            reviewerTenantUserId: "tenant-user-1",
            reviewerUserId: "user-1",
            snapshotAlreadyExists: true,
            submissionSequence: 3,
            submittedAt: 5_000,
            tenantId: "tenant-1",
        }),
        {
            departmentCodeSnapshot: "ICT",
            departmentNameSnapshot: "ICT Services",
            planPatch: {},
            reviewStartedAt: 8_500,
            shouldCaptureSnapshot: false,
            submissionSequenceKey: "tenant-1:plan-1:sequence:3",
        },
    );
    completedTests.push(
        "procurement-officer review start preparation now makes the first-open patch and immutable snapshot contract explicit for initial and repeat visits",
    );

    assert.equal(derivePreviousFiscalYearKey("2026-2027"), "2025-2026");
    assert.equal(derivePreviousFiscalYearKey("bad-value"), null);

    const selectedPreviousSnapshot = selectPreviousSubmissionBaseline({
        currentSubmissionSequence: 3,
        currentSubmittedAt: 5_000,
        snapshots: [
            {
                capturedAt: 5_100,
                fiscalYear: "2026-2027",
                lifecycleStatus: "active",
                planId: "plan-1",
                submissionSequence: 3,
                submittedAt: 5_000,
                summary: {
                    categorySummaries: [],
                    estimatedBudgetUsed: 900_000,
                    itemCount: 9,
                },
                workspaceState: null,
            },
            {
                capturedAt: 4_200,
                fiscalYear: "2025-2026",
                lifecycleStatus: "active",
                planId: "plan-1",
                submissionSequence: 2,
                submittedAt: 4_000,
                summary: {
                    categorySummaries: [],
                    estimatedBudgetUsed: 700_000,
                    itemCount: 7,
                },
                workspaceState: null,
            },
            {
                capturedAt: 4_300,
                fiscalYear: "2025-2026",
                lifecycleStatus: "withdrawn",
                planId: "plan-1",
                submissionSequence: 2,
                submittedAt: 4_100,
                summary: {
                    categorySummaries: [],
                    estimatedBudgetUsed: 710_000,
                    itemCount: 8,
                },
                workspaceState: null,
            },
            {
                capturedAt: 3_200,
                fiscalYear: "2024-2025",
                lifecycleStatus: "active",
                planId: "plan-1",
                submissionSequence: 1,
                submittedAt: 3_000,
                summary: {
                    categorySummaries: [],
                    estimatedBudgetUsed: 500_000,
                    itemCount: 5,
                },
                workspaceState: null,
            },
        ],
    });
    assert.equal(selectedPreviousSnapshot?.submittedAt, 4_000);
    assert.equal(selectedPreviousSnapshot?.submissionSequence, 2);
    completedTests.push(
        "procurement-officer review baseline selection skips the current immutable snapshot, ignores withdrawn histories, and picks the latest older active submission for the same plan lifecycle",
    );

    assert.equal(shouldStartProcurementOfficerReviewTracking("submitted"), true);
    assert.equal(shouldStartProcurementOfficerReviewTracking("approved"), false);
    assert.equal(shouldStartProcurementOfficerReviewTracking("rejected"), false);
    assert.equal(shouldStartProcurementOfficerReviewTracking("draft"), false);
    completedTests.push(
        "procurement-officer review tracking only auto-starts for actively submitted plans so closed review surfaces remain read-only",
    );

    assert.deepEqual(
        resolveProcurementOfficerReviewTargetState({
            planExists: false,
            planStatus: null,
            requestPlanIdIsValid: false,
            tenantMatches: false,
        }),
        {
            message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            state: "redirect",
        },
    );
    assert.deepEqual(
        resolveProcurementOfficerReviewTargetState({
            planExists: true,
            planStatus: "draft",
            requestPlanIdIsValid: true,
            tenantMatches: true,
        }),
        {
            message: PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
            state: "redirect",
        },
    );
    assert.deepEqual(
        resolveProcurementOfficerReviewTargetState({
            planExists: true,
            planStatus: "submitted",
            requestPlanIdIsValid: true,
            tenantMatches: true,
        }),
        {
            message: null,
            state: "ready",
        },
    );
    completedTests.push(
        "procurement-officer review target resolution fails closed for malformed, cross-tenant, and draft review links while allowing canonical submitted targets",
    );

    assert.deepEqual(
        resolveProcurementOfficerReviewSelectionFromBlocklyBlock({
            getFieldValue(name) {
                if (name === "CATEGORY_ID") {
                    return "cat-it";
                }
                if (name === "CATEGORY_NAME") {
                    return "ICT Equipment";
                }
                return "";
            },
            type: "category_block",
        }),
        {
            id: "category:cat-it",
            label: "ICT Equipment",
            type: "category",
        },
    );
    assert.deepEqual(
        resolveProcurementOfficerReviewSelectionFromBlocklyBlock({
            getFieldValue(name) {
                if (name === "ITEM_ID") {
                    return "item-laptop";
                }
                if (name === "ITEM_DESC") {
                    return "Laptops";
                }
                return "";
            },
            getParent() {
                return {
                    getFieldValue(name) {
                        if (name === "CATEGORY_ID") {
                            return "cat-it";
                        }
                        if (name === "CATEGORY_NAME") {
                            return "ICT Equipment";
                        }
                        return "";
                    },
                    getParent() {
                        return null;
                    },
                    type: "category_block",
                };
            },
            type: "item_block",
        }),
        {
            id: "item:cat-it:item-laptop",
            label: "Laptops (ICT Equipment)",
            type: "item",
        },
    );
    assert.equal(
        resolveProcurementOfficerReviewSelectionFromBlocklyBlock({
            getFieldValue() {
                return "";
            },
            type: "department_block",
        }),
        null,
    );
    completedTests.push(
        "procurement-officer review block selection now resolves read-only Blockly category and item clicks into stable flag-candidate targets",
    );

    const currentWorkspace = createPersistedBlocklyWorkspaceRecord(
        createBlocklyWorkspaceRecord({
        workspaceJson: {
            blocks: {
                blocks: [
                    {
                        type: "department_block",
                        inputs: {
                            CATEGORIES: {
                                block: {
                                    type: "category_block",
                                    fields: {
                                        CATEGORY_ID: "cat-it",
                                        CATEGORY_NAME: "ICT Equipment",
                                    },
                                    inputs: {
                                        ITEMS: {
                                            block: {
                                                type: "item_block",
                                                fields: {
                                                    COMPLIANCE_FLAGS: "",
                                                    ITEM_DESC: "Laptops",
                                                    ITEM_DESCRIPTION: "Portable computers",
                                                    ITEM_ID: "item-laptop",
                                                    ITEM_IS_ACTIVE: "true",
                                                    Q1_QTY: "2",
                                                    Q2_QTY: "2",
                                                    Q3_QTY: "0",
                                                    Q4_QTY: "0",
                                                    UNIT_OF_MEASUREMENT: "Each",
                                                    UNIT_PRICE: "50000",
                                                },
                                                next: {
                                                    block: {
                                                        type: "item_block",
                                                        fields: {
                                                            COMPLIANCE_FLAGS: "",
                                                            ITEM_DESC: "Printers",
                                                            ITEM_DESCRIPTION: "Office printers",
                                                            ITEM_ID: "item-printer",
                                                            ITEM_IS_ACTIVE: "true",
                                                            Q1_QTY: "1",
                                                            Q2_QTY: "0",
                                                            Q3_QTY: "0",
                                                            Q4_QTY: "0",
                                                            UNIT_OF_MEASUREMENT: "Each",
                                                            UNIT_PRICE: "30000",
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
                languageVersion: 0,
            },
        },
        }),
    );
    const previousWorkspace = createPersistedBlocklyWorkspaceRecord(
        createBlocklyWorkspaceRecord({
        workspaceJson: {
            blocks: {
                blocks: [
                    {
                        type: "department_block",
                        inputs: {
                            CATEGORIES: {
                                block: {
                                    type: "category_block",
                                    fields: {
                                        CATEGORY_ID: "cat-it",
                                        CATEGORY_NAME: "ICT Equipment",
                                    },
                                    inputs: {
                                        ITEMS: {
                                            block: {
                                                type: "item_block",
                                                fields: {
                                                    COMPLIANCE_FLAGS: "",
                                                    ITEM_DESC: "Laptops",
                                                    ITEM_DESCRIPTION: "Portable computers",
                                                    ITEM_ID: "item-laptop",
                                                    ITEM_IS_ACTIVE: "true",
                                                    Q1_QTY: "1",
                                                    Q2_QTY: "1",
                                                    Q3_QTY: "0",
                                                    Q4_QTY: "0",
                                                    UNIT_OF_MEASUREMENT: "Each",
                                                    UNIT_PRICE: "50000",
                                                },
                                                next: {
                                                    block: {
                                                        type: "item_block",
                                                        fields: {
                                                            COMPLIANCE_FLAGS: "",
                                                            ITEM_DESC: "Routers",
                                                            ITEM_DESCRIPTION: "Network routers",
                                                            ITEM_ID: "item-router",
                                                            ITEM_IS_ACTIVE: "true",
                                                            Q1_QTY: "1",
                                                            Q2_QTY: "0",
                                                            Q3_QTY: "0",
                                                            Q4_QTY: "0",
                                                            UNIT_OF_MEASUREMENT: "Each",
                                                            UNIT_PRICE: "20000",
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
                languageVersion: 0,
            },
        },
        }),
    );
    const comparison = buildProcurementOfficerReviewComparison({
        baseline: {
            capturedAt: 4_200,
            fiscalYear: "2025-2026",
            planId: "plan-1",
            submittedAt: 4_000,
            summary: {
                categorySummaries: [
                    {
                        amount: 120_000,
                        categoryId: "cat-it",
                        categoryName: "ICT Equipment",
                        itemCount: 2,
                    },
                ],
                estimatedBudgetUsed: 120_000,
                itemCount: 2,
            },
            workspaceState: previousWorkspace,
        },
        currentPlan: {
            fiscalYear: "2026-2027",
            submittedAt: 5_000,
            summary: {
                categorySummaries: [
                    {
                        amount: 230_000,
                        categoryId: "cat-it",
                        categoryName: "ICT Equipment",
                        itemCount: 2,
                    },
                ],
                estimatedBudgetUsed: 230_000,
                itemCount: 2,
            },
            workspaceState: currentWorkspace,
        },
        items: [
            {
                categoryId: "cat-it",
                description: "Portable computers",
                id: "item-laptop",
                isActive: true,
                name: "Laptops",
                procurementMethod: "RFQ",
                sourceOfFunds: "GOK",
                unitOfMeasurement: "Each",
                unitPrice: 50_000,
            },
            {
                categoryId: "cat-it",
                description: "Network routers",
                id: "item-router",
                isActive: true,
                name: "Routers",
                procurementMethod: "RFQ",
                sourceOfFunds: "GOK",
                unitOfMeasurement: "Each",
                unitPrice: 20_000,
            },
            {
                categoryId: "cat-it",
                description: "Office printers",
                id: "item-printer",
                isActive: true,
                name: "Printers",
                procurementMethod: "RFQ",
                sourceOfFunds: "GOK",
                unitOfMeasurement: "Each",
                unitPrice: 30_000,
            },
        ],
        kind: "previousSubmission",
        totalBudget: 500_000,
    });
    assert.equal(comparison.state, "ready");
    assert.equal(comparison.totals.deltaAmount, 110_000);
    assert.equal(
        comparison.itemDeltas!.find((item) => item.itemId === "item-printer")?.status,
        "added",
    );
    assert.equal(
        comparison.itemDeltas!.find((item) => item.itemId === "item-router")?.status,
        "removed",
    );
    assert.equal(
        comparison.itemDeltas?.find((item) => item.itemId === "item-laptop")?.deltaQuantity,
        2,
    );
    completedTests.push(
        "procurement-officer review diffs detect item additions, removals, quantity changes, and category total deltas from immutable Blockly baselines",
    );

    const summaryOnlyComparison = buildProcurementOfficerReviewComparison({
        baseline: {
            capturedAt: 2_000,
            fiscalYear: "2025-2026",
            planId: "plan-legacy",
            submittedAt: 2_000,
            summary: {
                categorySummaries: [
                    {
                        amount: 80_000,
                        categoryId: "cat-office",
                        categoryName: "Office Supplies",
                        itemCount: 4,
                    },
                ],
                estimatedBudgetUsed: 80_000,
                itemCount: 4,
            },
            workspaceState: null,
        },
        currentPlan: {
            fiscalYear: "2026-2027",
            summary: {
                categorySummaries: [
                    {
                        amount: 100_000,
                        categoryId: "cat-office",
                        categoryName: "Office Supplies",
                        itemCount: 5,
                    },
                ],
                estimatedBudgetUsed: 100_000,
                itemCount: 5,
            },
            workspaceState: null,
        },
        items: [],
        kind: "previousFiscalYear",
        totalBudget: null,
    });
    assert.equal(summaryOnlyComparison.itemDeltaState, "unavailable");
    assert.equal(summaryOnlyComparison.categoryDeltas[0]?.deltaAmount, 20_000);
    completedTests.push(
        "procurement-officer review comparisons stay truthful for summary-only historical baselines without fabricating item-level diffs",
    );

    const renderFallback = resolveProcurementOfficerReviewRenderState({
        items: [
            {
                categoryId: "cat-it",
                description: "Portable computers",
                id: "item-laptop",
                isActive: false,
                name: "Laptops",
                procurementMethod: "RFQ",
                sourceOfFunds: "GOK",
                unitOfMeasurement: "Each",
                unitPrice: 50_000,
            },
        ],
        persistedPlanSummary: {
            categorySummaries: [
                {
                    amount: 200_000,
                    categoryId: "cat-it",
                    categoryName: "ICT Equipment",
                    itemCount: 1,
                },
            ],
            estimatedBudgetUsed: 200_000,
            itemCount: 1,
        },
        totalBudget: 500_000,
        workspaceState: currentWorkspace,
    });
    assert.equal(renderFallback.mode, "summary");
    assert.match(renderFallback.reason ?? "", /Detailed block rendering unavailable/i);
    assert.equal(renderFallback.summary.departmentTotal, 200_000);
    completedTests.push(
        "procurement-officer review falls back to truthful persisted summaries when archived catalog metadata makes detailed Blockly hydration unsafe",
    );

    const selectedIds = [
        buildProcurementOfficerReviewSelectionId({
            categoryId: "cat-it",
            type: "category",
        }),
        buildProcurementOfficerReviewSelectionId({
            categoryId: "cat-it",
            itemId: "item-laptop",
            type: "item",
        }),
    ];
    const selectionState = revalidateProcurementOfficerReviewSelection({
        selectedIds,
        visibleIds: [
            buildProcurementOfficerReviewSelectionId({
                categoryId: "cat-it",
                type: "category",
            }),
        ],
    });
    assert.deepEqual(selectionState.validSelectionIds, [
        "category:cat-it",
    ]);
    assert.deepEqual(selectionState.staleSelectionIds, [
        "item:cat-it:item-laptop",
    ]);
    assert.match(selectionState.notice ?? "", /no longer visible/i);
    completedTests.push(
        "procurement-officer review selection state is revalidated whenever the visible node set changes so stale targets cannot silently persist",
    );

    return completedTests;
}
