"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcurementOfficerReviewTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const blockly_serialization_1 = require("../lib/blockly/blockly-serialization");
const review_1 = require("../lib/procurement-officer/review");
function runProcurementOfficerReviewTests() {
    const completedTests = [];
    strict_1.default.deepEqual((0, review_1.resolveProcurementOfficerReviewDepartmentContext)({
        joinedDepartmentCode: "ICT",
        joinedDepartmentIsActive: false,
        joinedDepartmentName: "ICT Services",
    }), {
        code: "ICT",
        name: "ICT Services (archived)",
    });
    strict_1.default.deepEqual((0, review_1.resolveProcurementOfficerReviewDepartmentContext)({
        planDepartmentCodeSnapshot: "FIN",
        planDepartmentNameSnapshot: "Finance",
    }), {
        code: "FIN",
        name: "Finance",
    });
    completedTests.push("procurement-officer review headers prefer live department joins, fall back to captured snapshots, and stay truthful when departments are archived");
    strict_1.default.deepEqual((0, review_1.normalizeProcurementOfficerReviewComment)("   "), {
        message: "Internal comments cannot be blank.",
        ok: false,
    });
    strict_1.default.deepEqual((0, review_1.normalizeProcurementOfficerReviewComment)("  Needs revision on ICT items.  "), {
        ok: true,
        value: "Needs revision on ICT items.",
    });
    completedTests.push("procurement-officer review comment validation trims canonical notes and rejects blank submissions");
    strict_1.default.deepEqual((0, review_1.buildProcurementOfficerReviewStartPatch)({
        currentDepartmentCode: "ICT",
        currentDepartmentName: "ICT Services",
        existingReviewStartedAt: null,
        existingReviewStartedByTenantUserId: null,
        existingReviewStartedByUserId: null,
        now: 1234,
        reviewerTenantUserId: "tenant-user-1",
        reviewerUserId: "user-1",
    }), {
        departmentCodeSnapshot: "ICT",
        departmentNameSnapshot: "ICT Services",
        reviewStartedAt: 1234,
        reviewStartedByTenantUserId: "tenant-user-1",
        reviewStartedByUserId: "user-1",
    });
    strict_1.default.equal((0, review_1.buildProcurementOfficerReviewStartPatch)({
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
    }), null);
    completedTests.push("procurement-officer review-start patching is first-writer-wins and does not overwrite canonical review ownership");
    strict_1.default.equal((0, review_1.buildProcurementOfficerReviewSnapshotSequenceKey)({
        planId: "plan-1",
        submittedAt: 5_000,
        tenantId: "tenant-1",
    }), "tenant-1:plan-1:5000");
    strict_1.default.deepEqual((0, review_1.prepareProcurementOfficerPlanReviewStart)({
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
        submittedAt: 5_000,
        tenantId: "tenant-1",
    }), {
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
        submissionSequenceKey: "tenant-1:plan-1:5000",
    });
    strict_1.default.deepEqual((0, review_1.prepareProcurementOfficerPlanReviewStart)({
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
        submittedAt: 5_000,
        tenantId: "tenant-1",
    }), {
        departmentCodeSnapshot: "ICT",
        departmentNameSnapshot: "ICT Services",
        planPatch: {},
        reviewStartedAt: 8_500,
        shouldCaptureSnapshot: false,
        submissionSequenceKey: "tenant-1:plan-1:5000",
    });
    completedTests.push("procurement-officer review start preparation now makes the first-open patch and immutable snapshot contract explicit for initial and repeat visits");
    strict_1.default.equal((0, review_1.derivePreviousFiscalYearKey)("2026-2027"), "2025-2026");
    strict_1.default.equal((0, review_1.derivePreviousFiscalYearKey)("bad-value"), null);
    const selectedPreviousSnapshot = (0, review_1.selectPreviousSubmissionBaseline)({
        currentSubmittedAt: 5_000,
        snapshots: [
            {
                capturedAt: 5_100,
                fiscalYear: "2026-2027",
                planId: "plan-1",
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
                planId: "plan-1",
                submittedAt: 4_000,
                summary: {
                    categorySummaries: [],
                    estimatedBudgetUsed: 700_000,
                    itemCount: 7,
                },
                workspaceState: null,
            },
            {
                capturedAt: 3_200,
                fiscalYear: "2024-2025",
                planId: "plan-1",
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
    strict_1.default.equal(selectedPreviousSnapshot?.submittedAt, 4_000);
    completedTests.push("procurement-officer review baseline selection skips the current immutable snapshot and picks the latest older submission for the same plan lifecycle");
    strict_1.default.deepEqual((0, review_1.resolveProcurementOfficerReviewTargetState)({
        planExists: false,
        planStatus: null,
        requestPlanIdIsValid: false,
        tenantMatches: false,
    }), {
        message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
        state: "redirect",
    });
    strict_1.default.deepEqual((0, review_1.resolveProcurementOfficerReviewTargetState)({
        planExists: true,
        planStatus: "draft",
        requestPlanIdIsValid: true,
        tenantMatches: true,
    }), {
        message: review_1.PROCUREMENT_OFFICER_REVIEW_TARGET_UNAVAILABLE_MESSAGE,
        state: "redirect",
    });
    strict_1.default.deepEqual((0, review_1.resolveProcurementOfficerReviewTargetState)({
        planExists: true,
        planStatus: "submitted",
        requestPlanIdIsValid: true,
        tenantMatches: true,
    }), {
        message: null,
        state: "ready",
    });
    completedTests.push("procurement-officer review target resolution fails closed for malformed, cross-tenant, and draft review links while allowing canonical submitted targets");
    strict_1.default.deepEqual((0, review_1.resolveProcurementOfficerReviewSelectionFromBlocklyBlock)({
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
    }), {
        id: "category:cat-it",
        label: "ICT Equipment",
        type: "category",
    });
    strict_1.default.deepEqual((0, review_1.resolveProcurementOfficerReviewSelectionFromBlocklyBlock)({
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
    }), {
        id: "item:cat-it:item-laptop",
        label: "Laptops (ICT Equipment)",
        type: "item",
    });
    strict_1.default.equal((0, review_1.resolveProcurementOfficerReviewSelectionFromBlocklyBlock)({
        getFieldValue() {
            return "";
        },
        type: "department_block",
    }), null);
    completedTests.push("procurement-officer review block selection now resolves read-only Blockly category and item clicks into stable flag-candidate targets");
    const currentWorkspace = (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
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
    });
    const previousWorkspace = (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
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
    });
    const comparison = (0, review_1.buildProcurementOfficerReviewComparison)({
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
    strict_1.default.equal(comparison.state, "ready");
    strict_1.default.equal(comparison.totals.deltaAmount, 110_000);
    strict_1.default.equal(comparison.itemDeltas.find((item) => item.itemId === "item-printer")?.status, "added");
    strict_1.default.equal(comparison.itemDeltas.find((item) => item.itemId === "item-router")?.status, "removed");
    strict_1.default.equal(comparison.itemDeltas?.find((item) => item.itemId === "item-laptop")?.deltaQuantity, 2);
    completedTests.push("procurement-officer review diffs detect item additions, removals, quantity changes, and category total deltas from immutable Blockly baselines");
    const summaryOnlyComparison = (0, review_1.buildProcurementOfficerReviewComparison)({
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
    strict_1.default.equal(summaryOnlyComparison.itemDeltaState, "unavailable");
    strict_1.default.equal(summaryOnlyComparison.categoryDeltas[0]?.deltaAmount, 20_000);
    completedTests.push("procurement-officer review comparisons stay truthful for summary-only historical baselines without fabricating item-level diffs");
    const renderFallback = (0, review_1.resolveProcurementOfficerReviewRenderState)({
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
    strict_1.default.equal(renderFallback.mode, "summary");
    strict_1.default.match(renderFallback.reason ?? "", /Detailed block rendering unavailable/i);
    strict_1.default.equal(renderFallback.summary.departmentTotal, 200_000);
    completedTests.push("procurement-officer review falls back to truthful persisted summaries when archived catalog metadata makes detailed Blockly hydration unsafe");
    const selectedIds = [
        (0, review_1.buildProcurementOfficerReviewSelectionId)({
            categoryId: "cat-it",
            type: "category",
        }),
        (0, review_1.buildProcurementOfficerReviewSelectionId)({
            categoryId: "cat-it",
            itemId: "item-laptop",
            type: "item",
        }),
    ];
    const selectionState = (0, review_1.revalidateProcurementOfficerReviewSelection)({
        selectedIds,
        visibleIds: [
            (0, review_1.buildProcurementOfficerReviewSelectionId)({
                categoryId: "cat-it",
                type: "category",
            }),
        ],
    });
    strict_1.default.deepEqual(selectionState.validSelectionIds, [
        "category:cat-it",
    ]);
    strict_1.default.deepEqual(selectionState.staleSelectionIds, [
        "item:cat-it:item-laptop",
    ]);
    strict_1.default.match(selectionState.notice ?? "", /no longer visible/i);
    completedTests.push("procurement-officer review selection state is revalidated whenever the visible node set changes so stale targets cannot silently persist");
    return completedTests;
}
exports.runProcurementOfficerReviewTests = runProcurementOfficerReviewTests;
