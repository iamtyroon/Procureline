"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcurementOfficerItemTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const values_1 = require("convex/values");
const item_backend_1 = require("../lib/procurement-officer/item-backend");
const items_1 = require("../lib/procurement-officer/items");
function createMockItemBackendQueryCtx(items) {
    return {
        db: {
            query() {
                return {
                    withIndex(_indexName, build) {
                        const values = new Map();
                        const chainBuilder = {
                            eq(field, value) {
                                values.set(field, value);
                                return chainBuilder;
                            },
                        };
                        build(chainBuilder);
                        return {
                            async collect() {
                                return items.filter((item) => item.tenantId === values.get("tenantId") &&
                                    item.categoryId === values.get("categoryId"));
                            },
                        };
                    },
                };
            },
        },
    };
}
async function expectConvexError(callback) {
    try {
        await callback();
        strict_1.default.fail("Expected a ConvexError");
    }
    catch (error) {
        strict_1.default.ok(error instanceof values_1.ConvexError);
        return error;
    }
}
async function runProcurementOfficerItemTests() {
    const completedTests = [];
    strict_1.default.equal((0, items_1.normalizeProcurementItemName)("  Laptop   Computer  "), "laptop computer");
    strict_1.default.deepEqual((0, items_1.normalizeComplianceFlags)(["AGPO", " pwd ", "unsupported", "agpo"]), ["agpo", "pwd"]);
    completedTests.push("item normalization helpers collapse description whitespace and keep only supported compliance flags in stable lowercase form");
    strict_1.default.deepEqual((0, items_1.buildProcurementItemTierLimitState)({
        activeItemCount: 50,
        tier: "free",
    }), {
        atLimit: true,
        limit: 50,
        remainingSlots: 0,
        tier: "free",
        tierLabel: "Free",
        upgradeHref: "/pricing",
    });
    strict_1.default.equal((0, items_1.buildProcurementItemImportLimitState)({
        tier: "professional",
    }).rowLimit, 1_000);
    strict_1.default.equal((0, items_1.buildProcurementItemImportLimitState)({
        tier: "enterprise",
    }).rowLimit, null);
    completedTests.push("item tier helpers enforce per-category caps and workbook row limits across Free, Professional, and Enterprise without inventing paid caps for enterprise");
    strict_1.default.equal((0, items_1.getProcurementItemImportRowFailure)({
        activeItemCount: 0,
        categoryName: "",
        hasActiveCategory: false,
        limit: 50,
        maxQuantity: null,
        minQuantity: null,
        normalizedName: "",
        price: null,
        rowIndexWithinTierCap: 0,
        rowLimit: 100,
        seenInFile: new Set(),
        unit: "",
    }), "Category is required");
    strict_1.default.equal((0, items_1.getProcurementItemImportRowFailure)({
        activeItemCount: 50,
        categoryName: "ICT Equipment",
        hasActiveCategory: true,
        limit: 50,
        maxQuantity: 2,
        minQuantity: 5,
        normalizedName: "cat-it::laptops",
        price: 50_000,
        rowIndexWithinTierCap: 0,
        rowLimit: 100,
        seenInFile: new Set(),
        unit: "each",
    }), "Maximum quantity must be greater than or equal to minimum quantity");
    strict_1.default.equal((0, items_1.getProcurementItemImportRowFailure)({
        activeItemCount: 1,
        categoryName: "ICT Equipment",
        hasActiveCategory: true,
        limit: 150,
        maxQuantity: null,
        minQuantity: null,
        normalizedName: "cat-it::laptops",
        price: 50_000,
        rowIndexWithinTierCap: 100,
        rowLimit: 100,
        seenInFile: new Set(),
        unit: "each",
    }), "Workbook row limit reached for this plan tier.");
    strict_1.default.equal((0, items_1.getProcurementItemImportRowFailure)({
        activeItemCount: 2,
        categoryName: "ICT Equipment",
        hasActiveCategory: true,
        limit: 150,
        maxQuantity: null,
        minQuantity: null,
        normalizedName: "cat-it::laptops",
        price: 50_000,
        rowIndexWithinTierCap: 0,
        rowLimit: 100,
        seenInFile: new Set(["cat-it::laptops"]),
        unit: "each",
    }), "This item appears more than once in the workbook for the same category.");
    completedTests.push("item workbook validation catches blank categories, invalid quantity ranges, tier row overflow, and duplicate workbook rows before import writes begin");
    const parsedDraft = (0, items_1.parseStoredItemDraft)(JSON.stringify({
        categoryId: "cat-it",
        categoryName: "ICT Equipment",
        complianceFlags: ["agpo", "local_content"],
        customUnit: "service",
        id: "item-service",
        maxQuantity: "12",
        minQuantity: "2",
        name: "Maintenance Support",
        procurementMethod: "Framework",
        revision: 3,
        sourceOfFunds: "R&D",
        unit: "custom",
        unitPrice: "15000",
    }));
    strict_1.default.deepEqual(parsedDraft, {
        categoryId: "cat-it",
        categoryName: "ICT Equipment",
        complianceFlags: ["agpo", "local_content"],
        customUnit: "service",
        id: "item-service",
        maxQuantity: 12,
        minQuantity: 2,
        name: "Maintenance Support",
        procurementMethod: "Framework",
        revision: 3,
        sourceOfFunds: "R&D",
        unit: "custom",
        unitPrice: 15_000,
    });
    completedTests.push("item draft restoration preserves custom-unit data and numeric bounds so category-to-items handoff can be resumed without silently flattening the operator draft");
    strict_1.default.equal((0, items_1.resolveProcurementItemDraftCategoryId)({
        categories: [
            {
                activeItemCount: 2,
                id: "cat-it",
                isActive: true,
                name: "ICT Equipment",
                sortOrder: 1,
            },
            {
                activeItemCount: 0,
                id: "cat-legacy",
                isActive: false,
                name: "Legacy Assets",
                sortOrder: 2,
            },
        ],
        draftCategoryId: "cat-legacy",
    }), "cat-legacy");
    strict_1.default.equal((0, items_1.resolveProcurementItemDraftCategoryId)({
        categories: [
            {
                activeItemCount: 2,
                id: "cat-it",
                isActive: true,
                name: "ICT Equipment",
                sortOrder: 1,
            },
            {
                activeItemCount: 0,
                id: "cat-legacy",
                isActive: false,
                name: "Legacy Assets",
                sortOrder: 2,
            },
        ],
        draftCategoryId: "cat-missing",
    }), "cat-it");
    strict_1.default.deepEqual((0, items_1.buildProcurementItemEditorCategoryOptions)({
        categories: [
            {
                activeItemCount: 2,
                id: "cat-it",
                isActive: true,
                name: "ICT Equipment",
                sortOrder: 1,
            },
            {
                activeItemCount: 0,
                id: "cat-legacy",
                isActive: false,
                name: "Legacy Assets",
                sortOrder: 2,
            },
        ],
        selectedCategoryId: "cat-legacy",
    }).map((category) => ({
        id: category.id,
        isPreservedInactiveSelection: category.isPreservedInactiveSelection,
    })), [
        { id: "cat-it", isPreservedInactiveSelection: false },
        { id: "cat-legacy", isPreservedInactiveSelection: true },
    ]);
    completedTests.push("item handoff helpers preserve a draft or current archived category selection while still defaulting new work back to the first live category when the draft target no longer exists");
    const workspaceRows = (0, items_1.buildProcurementItemWorkspaceRows)({
        categories: [
            {
                activeItemCount: 1,
                id: "cat-it",
                isActive: true,
                name: "ICT Equipment",
                sortOrder: 1,
            },
        ],
        items: [
            {
                archivedAt: Date.UTC(2026, 3, 2, 8, 0, 0),
                categoryId: "cat-it",
                categoryName: "ICT Equipment",
                complianceFlags: ["pwd"],
                id: "item-archived",
                isActive: false,
                lastPriceChangedAt: null,
                maxQuantity: null,
                minQuantity: null,
                name: "Legacy Printer",
                procurementMethod: null,
                revision: 1,
                sortOrder: 2,
                sourceOfFunds: null,
                unitOfMeasurement: "each",
                unitPrice: 10_000,
            },
            {
                archivedAt: null,
                categoryId: "cat-it",
                categoryName: "ICT Equipment",
                complianceFlags: ["agpo", "local_content"],
                id: "item-active",
                isActive: true,
                lastPriceChangedAt: Date.UTC(2026, 3, 1, 8, 0, 0),
                maxQuantity: 10,
                minQuantity: 1,
                name: "Laptop",
                procurementMethod: "RFQ",
                revision: 2,
                sortOrder: 1,
                sourceOfFunds: "GOK",
                unitOfMeasurement: "each",
                unitPrice: 75_000,
            },
        ],
        tier: "starter",
    });
    strict_1.default.deepEqual(workspaceRows.map((row) => row.id), ["item-active", "item-archived"]);
    strict_1.default.equal(workspaceRows[0]?.complianceSummary, "AGPO, Local Content");
    strict_1.default.equal(workspaceRows[1]?.archivedLabel, "Archived");
    completedTests.push("item workspace shaping keeps live records ahead of archived ones while surfacing compliance summaries and archived labels for the PO modal list");
    strict_1.default.equal((0, items_1.categoryAcceptsProcurementItems)({ isActive: true }), true);
    strict_1.default.equal((0, items_1.categoryAcceptsProcurementItems)({ isActive: false }), false);
    strict_1.default.equal((0, items_1.hasProcurementItemDuplicateConflict)({
        excludeItemId: "item-keep",
        items: [
            {
                _id: "item-keep",
                isActive: true,
                name: "Laptop",
                normalizedName: "laptop",
            },
            {
                _id: "item-archived",
                isActive: false,
                name: "Laptop",
                normalizedName: "laptop",
            },
            {
                _id: "item-conflict",
                isActive: true,
                name: "Laptop",
                normalizedName: "laptop",
            },
        ],
        normalizedName: "laptop",
    }), true);
    strict_1.default.equal((0, items_1.hasProcurementItemDuplicateConflict)({
        excludeItemId: "item-keep",
        items: [
            {
                _id: "item-keep",
                isActive: true,
                name: "Laptop",
                normalizedName: "laptop",
            },
            {
                _id: "item-archived",
                isActive: false,
                name: "Laptop",
                normalizedName: "laptop",
            },
        ],
        normalizedName: "laptop",
    }), false);
    strict_1.default.equal((0, items_1.getComparableProcurementItemRevision)(undefined), 0);
    strict_1.default.equal((0, items_1.getComparableProcurementItemRevision)(3), 3);
    strict_1.default.equal((0, items_1.getNextProcurementItemSortOrder)([
        { sortOrder: 1 },
        { sortOrder: 4 },
        { sortOrder: null },
    ]), 5);
    strict_1.default.equal((0, items_1.createProcurementItemDuplicateKey)({
        categoryId: "cat-it",
        normalizedName: "laptop",
    }), "cat-it::laptop");
    strict_1.default.deepEqual((0, items_1.normalizeImportedProcurementItemUnit)("Pieces"), {
        valid: true,
        value: "each",
    });
    strict_1.default.deepEqual((0, items_1.normalizeImportedProcurementItemUnit)("service"), {
        valid: false,
        value: "service",
    });
    completedTests.push("item backend helpers keep inactive-category checks, same-category duplicate guards, revision comparison, sort ordering, and workbook unit aliases deterministic before Convex mutations write anything");
    strict_1.default.doesNotThrow(() => {
        (0, item_backend_1.assertProcurementItemAssignmentAllowed)({
            categoryIsActive: false,
            currentCategoryId: "cat-legacy",
            nextCategoryId: "cat-legacy",
        });
    });
    const assignmentError = await expectConvexError(() => (0, item_backend_1.assertProcurementItemAssignmentAllowed)({
        categoryIsActive: false,
        currentCategoryId: "cat-legacy",
        nextCategoryId: "cat-it",
    }));
    strict_1.default.equal(assignmentError.data?.message, "Only active categories can accept new catalog items.");
    const backendCtx = createMockItemBackendQueryCtx([
        {
            _id: "item-1",
            categoryId: "cat-it",
            isActive: true,
            name: "Laptop",
            normalizedName: "laptop",
            sortOrder: 3,
            tenantId: "tenant-1",
        },
        {
            _id: "item-2",
            categoryId: "cat-it",
            isActive: false,
            name: "Printer",
            normalizedName: "printer",
            sortOrder: 1,
            tenantId: "tenant-1",
        },
        {
            _id: "item-3",
            categoryId: "cat-office",
            isActive: true,
            name: "Paper",
            normalizedName: "paper",
            sortOrder: 7,
            tenantId: "tenant-1",
        },
    ]);
    const duplicateError = await expectConvexError(async () => (0, item_backend_1.assertProcurementItemUnique)(backendCtx, {
        categoryId: "cat-it",
        normalizedName: "laptop",
        tenantId: "tenant-1",
    }));
    strict_1.default.equal(duplicateError.data?.message, "An active item with this description already exists in the selected category.");
    await (0, item_backend_1.assertProcurementItemUnique)(backendCtx, {
        categoryId: "cat-it",
        excludeItemId: "item-1",
        normalizedName: "laptop",
        tenantId: "tenant-1",
    });
    const capacityError = await expectConvexError(async () => (0, item_backend_1.assertProcurementItemTierCapacity)(createMockItemBackendQueryCtx(Array.from({ length: 50 }, (_, index) => ({
        _id: `item-${index}`,
        categoryId: "cat-it",
        isActive: true,
        name: `Item ${index}`,
        normalizedName: `item-${index}`,
        sortOrder: index + 1,
        tenantId: "tenant-1",
    }))), {
        categoryId: "cat-it",
        tenantId: "tenant-1",
        tier: "free",
    }));
    strict_1.default.equal(capacityError.data?.message, "Item limit reached for this category on the current plan tier.");
    strict_1.default.equal(await (0, item_backend_1.resolveNextProcurementItemSortOrder)({
        categoryId: "cat-office",
        ctx: backendCtx,
        tenantId: "tenant-1",
    }), 8);
    completedTests.push("item backend query helpers now cover archived-category edit safety, tenant-scoped duplicate checks, per-category tier caps, and next-sort-order resolution without needing a live Convex runtime");
    strict_1.default.deepEqual((0, items_1.createProcurementItemPriceHistoryEntry)({
        changedAt: 123,
        itemId: "item-laptop",
        nextUnitPrice: 85_000,
        previousUnitPrice: 75_000,
    }), {
        changedAt: 123,
        itemId: "item-laptop",
        nextUnitPrice: 85_000,
        previousUnitPrice: 75_000,
    });
    completedTests.push("item price-history shaping stays append-only and preserves both previous and next price values for the live catalog audit trail");
    return completedTests;
}
exports.runProcurementOfficerItemTests = runProcurementOfficerItemTests;
